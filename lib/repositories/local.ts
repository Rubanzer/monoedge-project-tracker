"use client";

import type { TrackerRepository } from "../repository";
import type { WorkItem } from "../types";

const KEY = "monoedge.tracker.items.v2";

/**
 * v1 held the sample board and the old nine-status model. Both are gone, but
 * a browser that loaded an earlier build still has those rows cached and will
 * keep showing them. Drop the old key on first read rather than asking anyone
 * to clear site data by hand.
 */
const DEAD_KEYS = ["monoedge.tracker.items.v1"];

function purgeOldVersions() {
  if (typeof window === "undefined") return;
  DEAD_KEYS.forEach((k) => window.localStorage.removeItem(k));
}

/** Small delay so optimistic UI and the sync pill behave like they will
 *  once a network round-trip to Sheets is in the way. */
const settle = <T,>(value: T, ms = 140): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms));

function read(): WorkItem[] {
  if (typeof window === "undefined") return [];
  purgeOldVersions();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WorkItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write(items: WorkItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
}

export const localRepository: TrackerRepository = {
  label: "Local draft",
  remote: false,

  async list() {
    return settle({ items: read() });
  },

  async create(item) {
    write([...read(), item]);
    return settle(item);
  },

  async update(id, patch) {
    const next = read().map((i) => (i.id === id ? { ...i, ...patch } : i));
    write(next);
    const updated = next.find((i) => i.id === id);
    if (!updated) throw new Error(`No work item with id ${id}`);
    return settle(updated);
  },

  async remove(id) {
    write(read().filter((i) => i.id !== id));
    await settle(null);
  },

  async saveAll(items) {
    write(items);
    await settle(null);
  },

  async reset() {
    write([]);
    return settle({ items: [] });
  },
};
