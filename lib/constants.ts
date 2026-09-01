import type { Member, Priority, Status, WorkType } from "./types";

/**
 * The team. id, name, initials and a colour is all it takes; avatars,
 * filters, swimlanes and the assignee picker all read from this one list.
 *
 * `id` is what gets written to the sheet's Primary Person column, so keep it
 * stable once work has been assigned.
 *
 * Colours run cool-forward from MonoEdge Blue so a row of avatars reads as
 * one family. Every one of them clears 4.5:1 against the white initials.
 */
export const TEAM: Member[] = [
  {
    id: "vismay",
    name: "Vismay Rathod",
    initials: "VR",
    role: "admin",
    email: "vismay@monoedge.in",
    color: "#204494",
  },
  {
    id: "vrushit",
    name: "Vrushit",
    initials: "V",
    role: "admin",
    // TODO: real @monoedge.in address. Until it is here this person cannot
    // sign in — the resolver fails closed rather than guessing at a pattern.
    email: undefined,
    color: "#0B6E75",
  },
  {
    id: "krishna",
    name: "Krishna",
    initials: "K",
    role: "admin",
    email: undefined, // TODO
    color: "#5B45A8",
  },
  {
    id: "manav",
    name: "Manav",
    initials: "M",
    role: "admin",
    email: undefined, // TODO
    color: "#9A5A12",
  },
  {
    id: "tushar",
    name: "Tushar",
    initials: "T",
    role: "developer",
    email: undefined, // TODO
    color: "#9E2F4E",
  },
];

export const memberByEmail = (email: string | null | undefined) => {
  const key = email?.trim().toLowerCase();
  if (!key) return undefined;
  return TEAM.find((m) => m.email?.toLowerCase() === key);
};

export const memberById = (id: string | null): Member | undefined =>
  id ? TEAM.find((m) => m.id === id) : undefined;

interface Token {
  color: string;
}

/**
 * Every status the sheet's Status dropdown may contain. These strings must
 * match the dropdown exactly or rows will not map on import.
 */
export const STATUS_TOKENS: Record<Status, Token> = {
  "Yet to Start": { color: "#6B7690" },
  "In Progress": { color: "#C8871F" },
  // The one delivery stage, so it takes MonoEdge Blue itself.
  "PR Created": { color: "#204494" },
  "In Testing": { color: "#0F8C93" },
  Completed: { color: "#1A7F52" },
  "On-hold": { color: "#B33A2B" },
};

export interface BoardColumnDef {
  /** Stable droppable key. No spaces, and never contains a double underscore. */
  id: string;
  label: string;
  /** Applied when a card is dropped here and its status does not already
   *  belong to this column. */
  primary: Status;
  /** Every status that lives in this column. */
  statuses: Status[];
  color: string;
  hint: string;
}

/**
 * Four columns. PR Created lives inside In progress rather than as its own
 * column, so the board stays readable without losing the precise status.
 * Change a card's exact status from the card menu or the detail panel.
 */
export const COLUMNS: BoardColumnDef[] = [
  {
    id: "yet-to-start",
    label: "Yet to start",
    primary: "Yet to Start",
    statuses: ["Yet to Start"],
    color: STATUS_TOKENS["Yet to Start"].color,
    hint: "Queued, nobody has picked it up",
  },
  {
    id: "in-progress",
    label: "In progress",
    primary: "In Progress",
    statuses: ["In Progress", "PR Created"],
    color: STATUS_TOKENS["In Progress"].color,
    hint: "Being built, or up for review as a pull request",
  },
  {
    id: "in-testing",
    label: "In testing",
    primary: "In Testing",
    statuses: ["In Testing"],
    color: STATUS_TOKENS["In Testing"].color,
    hint: "Being verified on the deployed build",
  },
  {
    id: "completed",
    label: "Completed",
    primary: "Completed",
    statuses: ["Completed"],
    color: STATUS_TOKENS.Completed.color,
    hint: "Shipped and closed out",
  },
];

/** Not a stage — a parked lane, shown or hidden on its own. */
export const PARKED_COLUMN: BoardColumnDef = {
  id: "on-hold",
  label: "On hold",
  primary: "On-hold",
  statuses: ["On-hold"],
  color: STATUS_TOKENS["On-hold"].color,
  hint: "Blocked or deprioritised",
};

export const ALL_COLUMNS: BoardColumnDef[] = [...COLUMNS, PARKED_COLUMN];

export const columnForStatus = (status: Status): BoardColumnDef =>
  ALL_COLUMNS.find((c) => c.statuses.includes(status)) ?? COLUMNS[0];

export const columnById = (id: string): BoardColumnDef | undefined =>
  ALL_COLUMNS.find((c) => c.id === id);

/** Statuses that mean work is actively moving, for the in-flight readout. */
export const ACTIVE_STAGES: Status[] = [
  "In Progress",
  "PR Created",
  "In Testing",
];

/**
 * Past these, a missed planned date is history rather than a problem.
 * Only Completed qualifies: something sitting in testing is still owed, so
 * it counts as in flight and can run late like anything else.
 */
export const TERMINAL_STAGES: Status[] = ["Completed"];

/** Statuses that mean work has begun, for the automatic start date. */
export const STARTED_STAGES: Status[] = [
  "In Progress",
  "PR Created",
  "In Testing",
];

/** Order used by the pipeline rail — the fine detail the board collapses. */
export const FLOW: Status[] = [
  "Yet to Start",
  "In Progress",
  "PR Created",
  "In Testing",
  "Completed",
];

export const PRIORITY_TOKENS: Record<Priority, Token> = {
  Critical: { color: "#DC2626" },
  High: { color: "#2E7FD4" },
  Medium: { color: "#DD8B3F" },
  Low: { color: "#7C8B82" },
};

/** Short forms so a dense card does not carry a 21-character label. */
export const TYPE_TOKENS: Record<WorkType, Token & { short: string }> = {
  "Product Functionality": { color: "#1E4E8C", short: "Product" },
  "Client Functionality": { color: "#8A5A20", short: "Client" },
  Bug: { color: "#C6304A", short: "Bug" },
};

export const REF_PREFIX = "MON";
