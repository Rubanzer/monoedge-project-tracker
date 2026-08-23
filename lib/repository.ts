import type { WorkItem } from "./types";

export interface LoadResult {
  items: WorkItem[];
  /** Cells the importer could not read cleanly. Surfaced once, in the UI. */
  warnings?: string[];
}

/** Thrown by adapters so the store can tell a conflict from a real failure. */
export class RepositoryError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "RepositoryError";
  }
  get isConflict() {
    return this.status === 409;
  }
}

/**
 * Everything the UI is allowed to know about storage. The board talks to
 * this and nothing else, so switching between the local draft and the
 * Google Sheet is a single line in lib/repositories/index.ts.
 */
export interface TrackerRepository {
  /** Shown in the sync pill so it is obvious where data is coming from. */
  readonly label: string;
  /** True when the data is shared with the rest of the team. */
  readonly remote: boolean;

  list(): Promise<LoadResult>;
  create(item: WorkItem): Promise<WorkItem>;
  /**
   * `expectedUpdatedAt` lets a remote adapter refuse the write when someone
   * else changed the same row first, rather than silently overwriting them.
   */
  update(
    id: string,
    patch: Partial<WorkItem>,
    expectedUpdatedAt?: string,
  ): Promise<WorkItem>;
  remove(id: string): Promise<void>;
  /** Persist board order after a drag. */
  saveAll(items: WorkItem[]): Promise<void>;
  /**
   * Start over. Destructive for the local draft; for a shared backend this
   * only re-reads, and the UI hides the action entirely.
   */
  reset(): Promise<LoadResult>;
}
