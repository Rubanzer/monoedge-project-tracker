import {
  highestRef,
  itemToRow,
  resolveMember,
  rowToItem,
  toIsoDate,
} from "../lib/sheet-mapping";

let pass = 0;
let fail = 0;
const check = (name: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL  ${name}\n      expected ${e}\n      got      ${a}`);
  }
};

// --- Sheets serial epoch. Anchors verified independently: serial 1 is
// 1899-12-31, and 45900 is 2025-08-06 in Google's own numbering.
check("serial 1", toIsoDate(1), "1899-12-31");
check("serial 25569 (unix epoch)", toIsoDate(25569), "1970-01-01");
check("serial 46240 (2026-08-06)", toIsoDate(46240), "2026-08-06");
check("serial 46253 (2026-08-19)", toIsoDate(46253), "2026-08-19");
check("blank", toIsoDate(""), null);
check("null", toIsoDate(null), null);
check("already ISO", toIsoDate("2026-08-23"), "2026-08-23");
check("garbage text", toIsoDate("sometime next week"), null);

// --- Status aliases: the sheet's current dropdown must all land somewhere.
const statusOf = (raw: string) =>
  rowToItem(["t", "", "", raw, "", "", "", "", "High", ""], 2, [])?.status;

check("sheet says Testing", statusOf("Testing"), "In testing");
check("legacy Testing done", statusOf("Testing done"), "In testing");
check("new In testing", statusOf("In testing"), "In testing");
check("sheet says Define Approach", statusOf("Define Approach"), "In Progress");
check("new PR created", statusOf("PR created"), "PR created");
check("legacy PR review", statusOf("PR review"), "PR created");
check("legacy Ready to Merge", statusOf("Ready to Merge"), "PR created");
check(
  "legacy Pending Prod Push",
  statusOf("Pending Prod Push"),
  "PR created",
);
check("sheet says Completed", statusOf("Completed"), "Completed");
check("sheet says On-hold", statusOf("On-hold"), "On-hold");
check("sheet says Yet to Start", statusOf("Yet to Start"), "Yet to Start");
check("casing and spacing", statusOf("  in  progress "), "In Progress");
check("blank defaults", statusOf(""), "Yet to Start");

const warned: string[] = [];
rowToItem(["t", "", "", "Marinating", "", "", "", "", "", ""], 7, warned);
check("unknown status warns", warned.length, 1);

// --- A row exactly as it exists in the sheet today: blank Tasks/Description/
// Person, real dates and enums, and none of the K..N columns yet.
const real = rowToItem(
  ["", "", "", "In Progress", 46240, 46244, 46245, "", "High", ""],
  2,
  [],
);
check("blank title becomes placeholder", real?.title, "(untitled)");
check("status", real?.status, "In Progress");
check("created", real?.createdDate, "2026-08-06");
check("started", real?.startedDate, "2026-08-10");
check("planned", real?.plannedDate, "2026-08-11");
check("actual stays null", real?.actualDate, null);
check("priority", real?.priority, "High");
check("no type", real?.type, null);
check("unassigned", real?.assigneeId, null);
check("row number retained", real?.sheetRow, 2);

// --- Completely empty rows are skipped, not imported as ghosts.
check("empty row skipped", rowToItem(["", "", "", ""], 9, []), null);

// --- Round trip: item -> row -> item must be stable.
const item = {
  id: "MON-7",
  ref: 7,
  title: "Rate limit the public API",
  description: "One integration is hammering us.",
  assigneeId: "vismay",
  status: "PR created" as const,
  createdDate: "2026-08-14",
  startedDate: "2026-08-15",
  plannedDate: "2026-08-22",
  actualDate: null,
  priority: "High" as const,
  type: "Product Functionality" as const,
  sheetRow: 8,
  order: 3,
  updatedAt: "2026-08-23T10:00:00.000Z",
};
const back = rowToItem(itemToRow(item), 8, []);
check("round trip id", back?.id, item.id);
check("round trip ref", back?.ref, item.ref);
check("round trip title", back?.title, item.title);
check("round trip status", back?.status, item.status);
check("round trip assignee", back?.assigneeId, item.assigneeId);
check("round trip planned", back?.plannedDate, item.plannedDate);
check("round trip actual null", back?.actualDate, null);
check("round trip type", back?.type, item.type);
check("round trip order", back?.order, item.order);
check("round trip updatedAt", back?.updatedAt, item.updatedAt);
check(
  "column C is the readable name",
  itemToRow(item)[2],
  "Vismay Rathod",
);
check("column M is the stable key", itemToRow(item)[12], "vismay");

// --- Reference numbering. A row with no Item ID yet carries a placeholder
// ref derived from its row number. Counting those as claimed made a fresh
// five-row sheet import as MON-6..MON-10 instead of MON-1..MON-5.
check("no ids yet", highestRef([{ id: "row-2" }, { id: "row-3" }]), 0);
check("mixed", highestRef([{ id: "MON-3" }, { id: "row-9" }]), 3);
check(
  "highest wins, not last",
  highestRef([{ id: "MON-1" }, { id: "MON-12" }, { id: "MON-4" }]),
  12,
);
check("empty sheet", highestRef([]), 0);

// --- Primary Person. The app writes full names, humans type whatever.
const team = [
  { id: "vismay", name: "Vismay Rathod", initials: "VR", email: "vismay@monoedge.in", color: "#1" },
  { id: "priya-m", name: "Priya Menon", initials: "PM", email: "priya@monoedge.in", color: "#2" },
  { id: "priya-s", name: "Priya Shah", initials: "PS", email: "priyas@monoedge.in", color: "#3" },
];
const who = (cell: string, stored = "") =>
  resolveMember(cell, stored, team)?.id ?? null;

check("full name", who("Vismay Rathod"), "vismay");
check("first name only", who("Vismay"), "vismay");
check("case and spacing", who("  vismay   rathod "), "vismay");
check("initials", who("VR"), "vismay");
check("email", who("vismay@monoedge.in"), "vismay");
check("email local part", who("vismay"), "vismay");
check("blank", who(""), null);
check("stranger", who("Someone Else"), null);
// Two Priyas: a bare first name must NOT guess.
check("ambiguous first name refuses", who("Priya"), null);
check("ambiguous resolved by surname", who("Priya Menon"), "priya-m");
check("ambiguous resolved by initials", who("PS"), "priya-s");
// Column M wins over whatever the readable column says.
check("stored key wins", who("Priya Menon", "vismay"), "vismay");
check("unknown stored key falls back to name", who("Priya Menon", "ghost"), "priya-m");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
