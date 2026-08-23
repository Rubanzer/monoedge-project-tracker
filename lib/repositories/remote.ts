"use client";

import {
  RepositoryError,
  type LoadResult,
  type TrackerRepository,
} from "../repository";
import type { WorkItem } from "../types";

/**
 * Talks to the /api/items routes, which own the Google Sheets credentials.
 * Nothing about the service account reaches the browser.
 */
async function send<T>(
  path: string,
  init?: RequestInit,
): Promise<T | undefined> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch {
    throw new RepositoryError(
      "Could not reach the server.",
      0,
      "Check your connection and try again.",
    );
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let hint: string | undefined;
    try {
      const body = (await res.json()) as { error?: string; hint?: string };
      if (body.error) message = body.error;
      hint = body.hint;
    } catch {
      // Non-JSON error body — keep the status-code message.
    }
    throw new RepositoryError(message, res.status, hint);
  }

  if (res.status === 204) return undefined;
  return (await res.json()) as T;
}

export const remoteRepository: TrackerRepository = {
  label: "Google Sheet",
  remote: true,

  async list() {
    const data = await send<LoadResult>("/api/items");
    return { items: data?.items ?? [], warnings: data?.warnings ?? [] };
  },

  async create(item) {
    const saved = await send<WorkItem>("/api/items", {
      method: "POST",
      body: JSON.stringify(item),
    });
    if (!saved) throw new RepositoryError("The sheet returned nothing.");
    return saved;
  },

  async update(id, patch, expectedUpdatedAt) {
    const saved = await send<WorkItem>(`/api/items/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ patch, expectedUpdatedAt }),
    });
    if (!saved) throw new RepositoryError("The sheet returned nothing.");
    return saved;
  },

  async remove(id) {
    await send(`/api/items/${encodeURIComponent(id)}`, { method: "DELETE" });
  },

  async saveAll(items) {
    // Only the board-order column travels; a drag must not rewrite whole
    // rows and clobber a cell someone edited in the sheet meanwhile.
    await send("/api/items", {
      method: "PUT",
      body: JSON.stringify({
        items: items.map((i) => ({ id: i.id, order: i.order })),
      }),
    });
  },

  async reset() {
    // Never wipes the sheet. "Clear board" is hidden for remote backends;
    // this exists so the interface stays honest, and it just re-reads.
    return this.list();
  },
};
