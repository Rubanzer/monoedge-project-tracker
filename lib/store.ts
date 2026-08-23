"use client";

import { create } from "zustand";
import { repository } from "./repositories";
import { todayIso } from "./dates";
import { STARTED_STAGES, TERMINAL_STAGES, columnById } from "./constants";
import type {
  Filters,
  GroupBy,
  NewWorkItem,
  Status,
  SyncState,
  WorkItem,
} from "./types";

export const EMPTY_FILTERS: Filters = {
  query: "",
  assigneeIds: [],
  priorities: [],
  types: [],
  hideCompleted: false,
};

/**
 * Dates the sheet would otherwise be updated by hand. Moving a card into a
 * working stage stamps the start; moving it into Completed stamps the actual
 * finish. Dragging back out of Completed clears the finish again, so the
 * column and the date can never disagree.
 */
export function stampDates(item: WorkItem, next: Status): Partial<WorkItem> {
  const patch: Partial<WorkItem> = { status: next };

  if (STARTED_STAGES.includes(next) && !item.startedDate) {
    patch.startedDate = todayIso();
  }
  if (next === "Completed" && !item.actualDate) {
    patch.actualDate = todayIso();
  }
  if (next !== "Completed" && item.actualDate) {
    patch.actualDate = null;
  }
  return patch;
}

/**
 * Which status a card takes when dropped on a column. A column can hold
 * several statuses — dropping a "PR review" card back into In progress must
 * not silently demote it to "In Progress".
 */
export function statusForDrop(item: WorkItem, columnId: string): Status {
  const column = columnById(columnId);
  if (!column) return item.status;
  return column.statuses.includes(item.status) ? item.status : column.primary;
}

interface TrackerState {
  items: WorkItem[];
  loading: boolean;
  sync: SyncState;
  lastSyncedAt: string | null;
  error: string | null;

  filters: Filters;
  groupBy: GroupBy;
  selectedId: string | null;
  composerOpen: boolean;

  load: () => Promise<void>;
  createItem: (input: NewWorkItem) => Promise<WorkItem>;
  patchItem: (id: string, patch: Partial<WorkItem>) => Promise<void>;
  moveItem: (
    id: string,
    columnId: string,
    index: number,
    assigneeId?: string | null,
  ) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  resetBoard: () => Promise<void>;

  setFilters: (patch: Partial<Filters>) => void;
  clearFilters: () => void;
  setGroupBy: (g: GroupBy) => void;
  select: (id: string | null) => void;
  setComposerOpen: (open: boolean) => void;
}

export const useTracker = create<TrackerState>((set, get) => ({
  items: [],
  loading: true,
  sync: "idle",
  lastSyncedAt: null,
  error: null,

  filters: EMPTY_FILTERS,
  groupBy: "none",
  selectedId: null,
  composerOpen: false,

  async load() {
    set({ loading: true, sync: "syncing" });
    try {
      const items = await repository.list();
      set({
        items,
        loading: false,
        sync: "synced",
        lastSyncedAt: new Date().toISOString(),
        error: null,
      });
    } catch (e) {
      set({
        loading: false,
        sync: "error",
        error: e instanceof Error ? e.message : "Could not load the board",
      });
    }
  },

  async createItem(input) {
    const items = get().items;
    const ref = items.reduce((max, i) => Math.max(max, i.ref), 0) + 1;
    const item: WorkItem = {
      ...input,
      id: `wi-${ref}-${Date.now().toString(36)}`,
      ref,
      createdDate: input.createdDate ?? todayIso(),
      order: -1, // newest sits at the top of its column
      updatedAt: new Date().toISOString(),
    };

    set({ items: [...items, item], sync: "syncing" });
    try {
      await repository.create(item);
      set({ sync: "synced", lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({
        items,
        sync: "error",
        error: e instanceof Error ? e.message : "Could not save the work item",
      });
    }
    return item;
  },

  async patchItem(id, patch) {
    const previous = get().items;
    const current = previous.find((i) => i.id === id);
    if (!current) return;

    const full: Partial<WorkItem> = {
      ...(patch.status && patch.status !== current.status
        ? stampDates(current, patch.status)
        : {}),
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    set({
      items: previous.map((i) => (i.id === id ? { ...i, ...full } : i)),
      sync: "syncing",
    });
    try {
      await repository.update(id, full);
      set({ sync: "synced", lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({
        items: previous,
        sync: "error",
        error: e instanceof Error ? e.message : "Could not save the change",
      });
    }
  },

  async moveItem(id, columnId, index, assigneeId) {
    const previous = get().items;
    const moving = previous.find((i) => i.id === id);
    if (!moving) return;

    const nextStatus = statusForDrop(moving, columnId);
    const patch: Partial<WorkItem> = {
      ...(nextStatus === moving.status
        ? { status: nextStatus }
        : stampDates(moving, nextStatus)),
      // Dropping into another person's swimlane reassigns the item.
      ...(assigneeId !== undefined ? { assigneeId } : {}),
    };

    // Re-seat the item at `index` within the destination column, then
    // renumber that column so the order is dense and stable.
    const column = columnById(columnId);
    const peers = previous
      .filter(
        (i) =>
          i.id !== id && !!column && column.statuses.includes(i.status),
      )
      .sort(byOrder);
    const reseated = [...peers];
    reseated.splice(index, 0, { ...moving, ...patch } as WorkItem);

    const orderById = new Map(reseated.map((i, idx) => [i.id, idx]));
    const next = previous.map((i) => {
      if (i.id === id) {
        return {
          ...i,
          ...patch,
          order: orderById.get(id) ?? index,
          updatedAt: new Date().toISOString(),
        };
      }
      const o = orderById.get(i.id);
      return o === undefined ? i : { ...i, order: o };
    });

    set({ items: next, sync: "syncing" });
    try {
      await repository.saveAll(next);
      set({ sync: "synced", lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({
        items: previous,
        sync: "error",
        error: e instanceof Error ? e.message : "Could not move the work item",
      });
    }
  },

  async deleteItem(id) {
    const previous = get().items;
    set({
      items: previous.filter((i) => i.id !== id),
      selectedId: null,
      sync: "syncing",
    });
    try {
      await repository.remove(id);
      set({ sync: "synced", lastSyncedAt: new Date().toISOString() });
    } catch (e) {
      set({
        items: previous,
        sync: "error",
        error: e instanceof Error ? e.message : "Could not delete the item",
      });
    }
  },

  async resetBoard() {
    set({ sync: "syncing" });
    const items = await repository.reset();
    set({ items, sync: "synced", lastSyncedAt: new Date().toISOString() });
  },

  setFilters(patch) {
    set({ filters: { ...get().filters, ...patch } });
  },
  clearFilters() {
    set({ filters: EMPTY_FILTERS });
  },
  setGroupBy(groupBy) {
    set({ groupBy });
  },
  select(selectedId) {
    set({ selectedId });
  },
  setComposerOpen(composerOpen) {
    set({ composerOpen });
  },
}));

/** Filters applied in one place so board and table can never disagree. */
export function applyFilters(items: WorkItem[], f: Filters): WorkItem[] {
  const q = f.query.trim().toLowerCase();
  return items.filter((i) => {
    // "Hide done" covers both finished columns, not just Completed.
    if (f.hideCompleted && TERMINAL_STAGES.includes(i.status)) return false;
    if (f.assigneeIds.length) {
      const key = i.assigneeId ?? "unassigned";
      if (!f.assigneeIds.includes(key)) return false;
    }
    if (f.priorities.length && !f.priorities.includes(i.priority)) return false;
    if (f.types.length) {
      if (!i.type || !f.types.includes(i.type)) return false;
    }
    if (q) {
      const hay = `${i.title} ${i.description} MON-${i.ref}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export const isFiltered = (f: Filters): boolean =>
  f.query.trim() !== "" ||
  f.assigneeIds.length > 0 ||
  f.priorities.length > 0 ||
  f.types.length > 0 ||
  f.hideCompleted;

export const byOrder = (a: WorkItem, b: WorkItem): number =>
  a.order - b.order || a.ref - b.ref;
