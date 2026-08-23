import type { IsoDate, WorkItem } from "./types";
import { TERMINAL_STAGES } from "./constants";

export const todayIso = (): IsoDate => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const parse = (iso: IsoDate): Date => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
};

/** "20 Aug" — the form used on cards, where the year is almost always now. */
export const formatShort = (iso: IsoDate | null): string => {
  if (!iso) return "—";
  return parse(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

/** "20 Aug 2026" — used in the detail panel and table where space allows. */
export const formatLong = (iso: IsoDate | null): string => {
  if (!iso) return "—";
  return parse(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** Whole days from today. Negative means the date has passed. */
export const daysFromToday = (iso: IsoDate | null): number | null => {
  if (!iso) return null;
  const ms = parse(iso).getTime() - parse(todayIso()).getTime();
  return Math.round(ms / 86_400_000);
};

/**
 * Past its planned date and still owed. Finished work is not late, and
 * neither is parked work — On-hold means the slip was a decision, so
 * flagging it every day is noise rather than a signal.
 */
export const isOverdue = (item: WorkItem): boolean => {
  if (TERMINAL_STAGES.includes(item.status)) return false;
  if (item.status === "On-hold") return false;
  const days = daysFromToday(item.plannedDate);
  return days !== null && days < 0;
};

export const isDueSoon = (item: WorkItem): boolean => {
  if (TERMINAL_STAGES.includes(item.status)) return false;
  const days = daysFromToday(item.plannedDate);
  return days !== null && days >= 0 && days <= 2;
};

/** "3 days late" / "due today" / "in 5 days" */
export const dueLabel = (iso: IsoDate | null): string => {
  const days = daysFromToday(iso);
  if (days === null) return "No planned date";
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  if (days === -1) return "1 day late";
  if (days < 0) return `${Math.abs(days)} days late`;
  return `Due in ${days} days`;
};

/** How long an item has been sitting in its current stage, roughly. */
export const ageInDays = (item: WorkItem): number | null => {
  const anchor = item.startedDate ?? item.createdDate;
  const days = daysFromToday(anchor);
  return days === null ? null : Math.abs(days);
};

export const relativeTime = (isoDateTime: string): string => {
  const then = new Date(isoDateTime).getTime();
  const mins = Math.round((Date.now() - then) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};
