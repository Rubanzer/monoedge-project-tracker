import "server-only";

import { TEAM } from "@/lib/constants";
import { str } from "@/lib/sheet-mapping";
import type { Member, Role } from "@/lib/types";
import { getTab, readConfig, readRange, writeRanges, SheetError } from "./sheets";

/**
 * The roster, kept in a `Team` tab in the same spreadsheet as the work.
 *
 * Sign-in decides whether someone is *from MonoEdge* (see auth.ts); this file
 * decides who they *are* — their role, colour, and the id written into the
 * sheet's Primary Person column. Anyone with a Workspace account can sign in,
 * so the roster is discovered rather than declared: a new joiner is appended
 * the first time they arrive.
 *
 * It lives in the sheet rather than in code so that adding someone needs no
 * deploy, demoting someone is a cell edit, and — the part that matters for
 * the rest of the app — a new joiner immediately becomes assignable in the
 * Primary Person dropdown.
 */

export const TEAM_TAB = "Team";

const COL = {
  email: 0,
  id: 1,
  name: 2,
  initials: 3,
  color: 4,
  role: 5,
  active: 6,
  firstSeen: 7,
  lastSeen: 8,
} as const;

const HEADERS = [
  "Email",
  "Member ID",
  "Name",
  "Initials",
  "Colour",
  "Role",
  "Active",
  "First Seen",
  "Last Seen",
];

const FIRST_DATA_ROW = 2;
const LAST_COL = "I";

/**
 * Colours for people who join after the founding five. Same cool-forward
 * family as the hand-picked ones in constants.ts, and every one of them
 * clears 4.5:1 against white initials.
 */
const PALETTE = [
  "#1F6F4A",
  "#7A3E9D",
  "#A34A16",
  "#2B5D8A",
  "#8C2F6B",
  "#3F5A72",
  "#775C0E",
  "#5D4037",
];

/**
 * Read-through cache. Every authenticated request resolves a member, and
 * without this each one would cost a Sheets round trip.
 *
 * The TTL is the revocation delay: flipping Active to FALSE takes up to this
 * long to bite. Sixty seconds is the trade — long enough to matter for cost,
 * short enough that removing someone is still same-minute.
 */
const CACHE_TTL_MS = 60_000;
let cache: { at: number; members: Member[] } | null = null;

export const invalidateTeamCache = () => {
  cache = null;
};

const normalise = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ");

const asRole = (v: string): Role =>
  normalise(v) === "admin" ? "admin" : "developer";

/** Sheets hands back a real boolean for TRUE/FALSE cells, text otherwise. */
function asActive(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  const text = normalise(str(v));
  // Blank means active: a row typed by hand shouldn't lock someone out.
  if (!text) return true;
  return !["false", "no", "n", "0", "inactive", "revoked"].includes(text);
}

export function initialsFor(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** A stable, readable id from the address, since that is the one thing about
 *  a person that cannot change without IT's involvement. */
function idFor(email: string, taken: Set<string>): string {
  const base =
    normalise(email).split("@")[0].replace(/[^a-z0-9]+/g, "-") || "member";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

function rowToMember(row: unknown[]): Member | null {
  const email = normalise(str(row[COL.email]));
  const id = str(row[COL.id]);
  const name = str(row[COL.name]);
  // A row with neither an id nor an address is a stray; skip it rather than
  // inventing a person.
  if (!id && !email) return null;

  return {
    id: id || idFor(email, new Set()),
    name: name || email.split("@")[0] || id,
    initials: str(row[COL.initials]) || initialsFor(name || email),
    role: asRole(str(row[COL.role])),
    email: email || undefined,
    color: str(row[COL.color]) || PALETTE[0],
    active: asActive(row[COL.active]),
  };
}

function memberToRow(m: Member, firstSeen: string, lastSeen: string) {
  return [
    m.email ?? "",
    m.id,
    m.name,
    m.initials,
    m.color,
    m.role,
    m.active === false ? "FALSE" : "TRUE",
    firstSeen,
    lastSeen,
  ];
}

async function ctx() {
  const config = readConfig();
  // getTab resolves by name and throws a 404 listing the tabs it did find,
  // which is exactly the message someone who forgot to add the tab needs.
  const meta = await getTab({ ...config, tabName: TEAM_TAB }).catch(() => {
    throw new SheetError(
      `The spreadsheet has no "${TEAM_TAB}" tab.`,
      500,
      `Add a tab named ${TEAM_TAB} with these headers in row 1: ${HEADERS.join(", ")}`,
    );
  });
  return { config, tab: meta.title };
}

async function ensureHeaders(c: Awaited<ReturnType<typeof ctx>>) {
  const header = (await readRange(c.config, c.tab, `A1:${LAST_COL}1`))[0] ?? [];
  if (str(header[0])) return;
  await writeRanges(c.config, c.tab, [
    { a1: `A1:${LAST_COL}1`, values: [HEADERS] },
  ]);
}

/**
 * The roster as the sheet has it. An empty tab is seeded from the TEAM
 * constant so the founding five keep their roles and colours instead of
 * being rediscovered as brand-new developers.
 */
export async function loadTeam(force = false): Promise<Member[]> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.members;
  }

  const c = await ctx();
  await ensureHeaders(c);

  const rows = await readRange(
    c.config,
    c.tab,
    `A${FIRST_DATA_ROW}:${LAST_COL}`,
  );
  let members = rows
    .map(rowToMember)
    .filter((m): m is Member => m !== null);

  if (!members.length) {
    const now = new Date().toISOString();
    members = TEAM.map((m) => ({ ...m, active: true }));
    await writeRanges(c.config, c.tab, [
      {
        a1: `A${FIRST_DATA_ROW}:${LAST_COL}${FIRST_DATA_ROW + members.length - 1}`,
        values: members.map((m) => memberToRow(m, now, "")),
      },
    ]);
  }

  cache = { at: Date.now(), members };
  return members;
}

/**
 * A seeded row that plainly refers to this person but has no address on it
 * yet — the four placeholders in constants.ts are exactly this case.
 *
 * Claiming one keeps their colour, id and admin role instead of appending a
 * duplicate. It only counts when the name lands on exactly one row: with two
 * Krishnas a wrong guess would hand out an admin seat, so ambiguity loses.
 */
function claimable(members: Member[], name: string): Member | undefined {
  const full = normalise(name);
  const first = full.split(" ")[0];
  if (!first) return undefined;

  const candidates = members.filter((m) => {
    if (m.email) return false;
    const theirs = normalise(m.name);
    return theirs === full || theirs.split(" ")[0] === first;
  });
  return candidates.length === 1 ? candidates[0] : undefined;
}

/**
 * The member record for a signed-in address, creating or completing one as
 * needed. Returns inactive members too — refusing them is the caller's job,
 * so it can say *why*.
 *
 * Two people signing in for the very first time in the same second could
 * both target the same row. With a team this size that is not worth a lock;
 * the duplicate is visible in the tab and one row can be deleted by hand.
 */
export async function resolveOrProvision(
  email: string,
  displayName?: string | null,
): Promise<Member> {
  const key = normalise(email);
  const members = await loadTeam();

  const existing = members.find((m) => m.email === key);
  const now = new Date().toISOString();
  const c = await ctx();

  if (existing) {
    const row = FIRST_DATA_ROW + members.indexOf(existing);
    await writeRanges(c.config, c.tab, [
      { a1: `${colLetter(COL.lastSeen)}${row}`, values: [[now]] },
    ]);
    return existing;
  }

  const name = displayName?.trim() || key.split("@")[0];
  const claim = claimable(members, name);

  if (claim) {
    const row = FIRST_DATA_ROW + members.indexOf(claim);
    const filled: Member = { ...claim, email: key };
    await writeRanges(c.config, c.tab, [
      {
        a1: `A${row}:${LAST_COL}${row}`,
        values: [memberToRow(filled, now, now)],
      },
    ]);
    invalidateTeamCache();
    return filled;
  }

  // Genuinely new. Developer by default — a role is granted deliberately,
  // never inherited by showing up.
  const created: Member = {
    id: idFor(key, new Set(members.map((m) => m.id))),
    name,
    initials: initialsFor(name),
    role: "developer",
    email: key,
    color: PALETTE[members.length % PALETTE.length],
    active: true,
  };

  const row = FIRST_DATA_ROW + members.length;
  await writeRanges(c.config, c.tab, [
    { a1: `A${row}:${LAST_COL}${row}`, values: [memberToRow(created, now, now)] },
  ]);
  invalidateTeamCache();
  return created;
}

const colLetter = (index: number) => String.fromCharCode(65 + index);
