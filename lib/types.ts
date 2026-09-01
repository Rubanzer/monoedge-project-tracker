/**
 * Domain model. Every field maps 1:1 to a column in the Monoedge tracking
 * sheet so the Google Sheets adapter is a straight column<->field mapping
 * with no reshaping. Column letters are noted against each field.
 */

/**
 * The fine-grained status, exactly as it must appear in the sheet's Status
 * dropdown. The board groups several of these into one column (see COLUMNS
 * in constants.ts) but the precise status is never lost — it stays settable
 * on the card and in the detail panel.
 */
export const STATUSES = [
  "Yet to Start",
  "In Progress",
  "PR created",
  "In testing",
  "Completed",
  "On-hold",
] as const;

export const PRIORITIES = ["Critical", "High", "Medium", "Low"] as const;

export const WORK_TYPES = [
  "Product Functionality",
  "Client Functionality",
  "Bug",
] as const;

export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type WorkType = (typeof WORK_TYPES)[number];

/** ISO date, yyyy-mm-dd. Null means the cell is blank in the sheet. */
export type IsoDate = string;

export interface WorkItem {
  /** Stable internal key. Never shown. */
  id: string;
  /** Human reference rendered as MON-<ref>. Not a sheet column — the sheet
   *  has no ID column, so this is assigned on import and held in the app. */
  ref: number;
  /** Col A — Tasks */
  title: string;
  /** Col B — Description */
  description: string;
  /** Col C — Primary Person. Holds a Member.id, or null when unassigned. */
  assigneeId: string | null;
  /** Col D — Status */
  status: Status;
  /** Col E — Task Creation Date */
  createdDate: IsoDate | null;
  /** Col F — Task Started Date */
  startedDate: IsoDate | null;
  /** Col G — Task Planned Date (the due date) */
  plannedDate: IsoDate | null;
  /** Col H — Task Actual Date (when it actually landed) */
  actualDate: IsoDate | null;
  /** Col I — Priority */
  priority: Priority;
  /** Col J — Functionality / Bug */
  type: WorkType | null;

  /** 1-based row this item occupies in the sheet. Set by the Sheets adapter
   *  so an update writes back to the right row; undefined until synced. */
  sheetRow?: number;
  /** Local ordering within a board column. */
  order: number;
  updatedAt: string;
}

export interface Member {
  id: string;
  name: string;
  initials: string;
  /** Work email. Used to match a Primary Person cell someone typed by hand. */
  email?: string;
  /** Colour used for the avatar chip so people are recognisable at a glance. */
  color: string;
}

export type NewWorkItem = Omit<
  WorkItem,
  "id" | "ref" | "order" | "updatedAt" | "createdDate"
> & { createdDate?: IsoDate | null };

export interface Filters {
  query: string;
  assigneeIds: string[];
  priorities: Priority[];
  types: WorkType[];
  /** Hide anything already shipped. */
  hideCompleted: boolean;
}

export type GroupBy = "none" | "assignee";
export type SyncState = "idle" | "syncing" | "synced" | "error";
