import { TEAM } from "./constants";
import type { IsoDate, Priority, Status, WorkItem, WorkType } from "./types";

/**
 * Pure row <-> WorkItem mapping. No I/O and no credentials, so it can be
 * exercised directly; lib/server/sheet-store.ts wraps it with the Sheets
 * calls.
 *
 * A..J are the columns already in the tracking sheet and are left exactly as
 * they are. K..N are added by the app on first connect: without a stable ID,
 * inserting a row above shifts every card's identity and edits land on the
 * wrong task.
 */
export const COLS = {
  title: "A",
  description: "B",
  person: "C",
  status: "D",
  created: "E",
  started: "F",
  planned: "G",
  actual: "H",
  priority: "I",
  type: "J",
  id: "K",
  order: "L",
  assigneeKey: "M",
  updatedAt: "N",
} as const;

export const LAST_COL = "N";
export const FIRST_DATA_ROW = 2;

/** Only the columns the app owns. A..J keep whatever headings you gave them. */
export const MANAGED_HEADERS: [string, string][] = [
  [COLS.id, "Item ID"],
  [COLS.order, "Board Order"],
  [COLS.assigneeKey, "Assignee Key"],
  [COLS.updatedAt, "Updated At"],
];

export const colIndex = (col: string) => col.charCodeAt(0) - 65;

export const str = (v: unknown): string =>
  v === null || v === undefined ? "" : String(v).trim();

/**
 * Sheets stores dates as whole days since 1899-12-30. Reading the formatted
 * text instead would give "6-Aug", which has no year and cannot be turned
 * back into a real date.
 */
const SHEETS_EPOCH = Date.UTC(1899, 11, 30);
const pad = (n: number) => String(n).padStart(2, "0");

export function toIsoDate(v: unknown): IsoDate | null {
  if (v === null || v === undefined || v === "") return null;

  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(SHEETS_EPOCH + Math.round(v) * 86_400_000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }

  // Someone typed into the cell rather than using the date picker.
  const text = str(v);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
  }
  return null;
}

const key = (v: unknown) => str(v).toLowerCase().replace(/[\s_-]+/g, " ");

/**
 * Accepts the sheet's current dropdown as well as the app's own values, so
 * the existing sheet imports without anyone editing it first. "Define
 * Approach" no longer exists as a column, so it folds into In Progress.
 */
export const STATUS_ALIASES: Record<string, Status> = {
  "yet to start": "Yet to Start",
  "not started": "Yet to Start",
  backlog: "Yet to Start",
  "define approach": "In Progress",
  "in progress": "In Progress",
  wip: "In Progress",
  "pr review": "PR review",
  "in review": "PR review",
  review: "PR review",
  "ready to merge": "Ready to Merge",
  "pending prod push": "Pending Prod Push",
  "pending production push": "Pending Prod Push",
  testing: "Testing done",
  "testing done": "Testing done",
  qa: "Testing done",
  completed: "Completed",
  complete: "Completed",
  done: "Completed",
  shipped: "Completed",
  "on hold": "On-hold",
  onhold: "On-hold",
  blocked: "On-hold",
  parked: "On-hold",
};

export const PRIORITY_ALIASES: Record<string, Priority> = {
  critical: "Critical",
  urgent: "Critical",
  p0: "Critical",
  high: "High",
  p1: "High",
  medium: "Medium",
  med: "Medium",
  normal: "Medium",
  p2: "Medium",
  low: "Low",
  p3: "Low",
};

export const TYPE_ALIASES: Record<string, WorkType> = {
  "product functionality": "Product Functionality",
  product: "Product Functionality",
  "client functionality": "Client Functionality",
  client: "Client Functionality",
  bug: "Bug",
  defect: "Bug",
  fix: "Bug",
};

export function rowToItem(
  row: unknown[],
  rowNumber: number,
  warnings: string[],
): WorkItem | null {
  const cell = (col: string) => row[colIndex(col)];

  // A row is only skipped when it is completely empty; a blank Tasks cell
  // with real dates and a status is still a real row worth importing.
  const hasContent = Object.values(COLS).some((c) => str(cell(c)) !== "");
  if (!hasContent) return null;

  const rawStatus = str(cell(COLS.status));
  let status = STATUS_ALIASES[key(rawStatus)];
  if (!status) {
    status = "Yet to Start";
    if (rawStatus) {
      warnings.push(`Row ${rowNumber}: status "${rawStatus}" not recognised`);
    }
  }

  const rawPriority = str(cell(COLS.priority));
  let priority = PRIORITY_ALIASES[key(rawPriority)];
  if (!priority) {
    priority = "Medium";
    if (rawPriority) {
      warnings.push(`Row ${rowNumber}: priority "${rawPriority}" not recognised`);
    }
  }

  const rawType = str(cell(COLS.type));
  const type: WorkType | null = rawType
    ? (TYPE_ALIASES[key(rawType)] ?? null)
    : null;
  if (rawType && !type) {
    warnings.push(`Row ${rowNumber}: type "${rawType}" not recognised`);
  }

  // Prefer the stable key the app writes; fall back to matching the readable
  // name in column C, so a person typed straight into the sheet still lands.
  const assigneeKey = str(cell(COLS.assigneeKey));
  const personName = str(cell(COLS.person));
  const assigneeId =
    TEAM.find((m) => m.id === assigneeKey)?.id ??
    TEAM.find((m) => m.name.toLowerCase() === personName.toLowerCase())?.id ??
    null;
  if (personName && !assigneeId) {
    warnings.push(`Row ${rowNumber}: "${personName}" is not on the team list`);
  }

  const id = str(cell(COLS.id));
  const refMatch = /(\d+)\s*$/.exec(id);
  const orderRaw = cell(COLS.order);

  return {
    id: id || `row-${rowNumber}`,
    ref: refMatch ? Number(refMatch[1]) : rowNumber - 1,
    title: str(cell(COLS.title)) || "(untitled)",
    description: str(cell(COLS.description)),
    assigneeId,
    status,
    createdDate: toIsoDate(cell(COLS.created)),
    startedDate: toIsoDate(cell(COLS.started)),
    plannedDate: toIsoDate(cell(COLS.planned)),
    actualDate: toIsoDate(cell(COLS.actual)),
    priority,
    type,
    sheetRow: rowNumber,
    order: typeof orderRaw === "number" ? orderRaw : rowNumber,
    updatedAt: str(cell(COLS.updatedAt)) || new Date(0).toISOString(),
  };
}

/**
 * Highest reference already claimed in the sheet. Only rows carrying a real
 * `MON-n` id count: an unsaved row gets a placeholder ref derived from its
 * row number, and treating those as claimed makes the first import skip a
 * block of numbers — a sheet of five fresh rows would come out MON-6..MON-10.
 */
export function highestRef(items: { id: string }[]): number {
  return items.reduce((max, i) => {
    const m = /^MON-(\d+)$/.exec(i.id);
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);
}

/** The A..N cells for a whole row, in column order. */
export function itemToRow(item: WorkItem): unknown[] {
  const member = TEAM.find((m) => m.id === item.assigneeId);
  return [
    item.title,
    item.description,
    member?.name ?? "", // C stays human-readable for anyone reading the sheet
    item.status,
    item.createdDate ?? "",
    item.startedDate ?? "",
    item.plannedDate ?? "",
    item.actualDate ?? "",
    item.priority,
    item.type ?? "",
    item.id,
    item.order,
    item.assigneeId ?? "",
    item.updatedAt,
  ];
}
