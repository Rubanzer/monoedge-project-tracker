import type { WorkItem } from "./types";

/**
 * Everything the UI is allowed to know about storage. The board talks to
 * this and nothing else, so swapping the local adapter for the Google
 * Sheets one is a single line in lib/repositories/index.ts.
 */
export interface TrackerRepository {
  /** Shown in the sync pill so it is obvious where data is coming from. */
  readonly label: string;
  /** True once a real remote is wired up. */
  readonly remote: boolean;

  list(): Promise<WorkItem[]>;
  create(item: WorkItem): Promise<WorkItem>;
  update(id: string, patch: Partial<WorkItem>): Promise<WorkItem>;
  remove(id: string): Promise<void>;
  /** Persist a whole set at once — used after a drag reorders a column. */
  saveAll(items: WorkItem[]): Promise<void>;
  /** Drop everything and start from an empty board. */
  reset(): Promise<WorkItem[]>;
}
