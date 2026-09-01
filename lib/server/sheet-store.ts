import "server-only";

import {
  COLS,
  FIRST_DATA_ROW,
  LAST_COL,
  MANAGED_HEADERS,
  colIndex,
  highestRef,
  itemToRow,
  rowToItem,
  str,
} from "@/lib/sheet-mapping";
import type { WorkItem } from "@/lib/types";
import {
  deleteRow,
  getTab,
  readConfig,
  readRange,
  SheetError,
  writeRanges,
  type SheetConfig,
} from "./sheets";

/** The Sheets I/O. All row shaping lives in lib/sheet-mapping.ts. */

export interface LoadResult {
  items: WorkItem[];
  /** Surfaced in the app so bad cells are visible instead of silently coerced. */
  warnings: string[];
  tab: string;
}

interface Ctx {
  config: SheetConfig;
  tab: string;
  sheetId: number;
}

async function ctx(): Promise<Ctx> {
  const config = readConfig();
  const meta = await getTab(config);
  return { config, tab: meta.title, sheetId: meta.sheetId };
}

/**
 * Adds the four managed headers if they are not there yet. Runs on every
 * load but only writes when something is actually missing, so connecting an
 * untouched sheet needs no manual preparation.
 */
async function ensureHeaders(c: Ctx): Promise<void> {
  const header = (await readRange(c.config, c.tab, `A1:${LAST_COL}1`))[0] ?? [];
  const missing = MANAGED_HEADERS.filter(
    ([col]) => str(header[colIndex(col)]) === "",
  );
  if (!missing.length) return;

  await writeRanges(
    c.config,
    c.tab,
    missing.map(([col, label]) => ({ a1: `${col}1`, values: [[label]] })),
  );
}

/** Gives pre-existing rows a permanent ID the first time they are seen. */
async function backfillIds(c: Ctx, items: WorkItem[]): Promise<void> {
  const needing = items.filter((i) => !/^MON-\d+$/.test(i.id));
  if (!needing.length) return;

  let next = highestRef(items);
  const updates = needing.map((item) => {
    next += 1;
    item.id = `MON-${next}`;
    item.ref = next;
    return {
      a1: `${COLS.id}${item.sheetRow}:${COLS.order}${item.sheetRow}`,
      values: [[item.id, item.order]],
    };
  });
  await writeRanges(c.config, c.tab, updates);
}

export async function loadItems(): Promise<LoadResult> {
  const c = await ctx();
  await ensureHeaders(c);

  const rows = await readRange(
    c.config,
    c.tab,
    `A${FIRST_DATA_ROW}:${LAST_COL}`,
  );

  const warnings: string[] = [];
  const items = rows
    .map((row, i) => rowToItem(row, FIRST_DATA_ROW + i, warnings))
    .filter((i): i is WorkItem => i !== null);

  await backfillIds(c, items);
  return { items, warnings, tab: c.tab };
}

async function findRow(c: Ctx, id: string): Promise<number> {
  const col = await readRange(
    c.config,
    c.tab,
    `${COLS.id}${FIRST_DATA_ROW}:${COLS.id}`,
  );
  const idx = col.findIndex((r) => str(r?.[0]) === id);
  if (idx === -1) {
    throw new SheetError(
      `${id} is no longer in the sheet.`,
      409,
      "Someone may have deleted the row. Reload the board.",
    );
  }
  return FIRST_DATA_ROW + idx;
}

/** A row the importer would skip: every column the app reads is blank. */
const rowIsEmpty = (row: unknown[] | undefined): boolean =>
  !row || Object.values(COLS).every((c) => str(row[colIndex(c)]) === "");

/**
 * The row a new item should occupy: the first blank one, or the row after the
 * last used one if there are no gaps.
 *
 * Sheets' own `values.append` cannot be used here. It appends after the last
 * row of the *table* it detects, and this sheet is a structured Table whose
 * range keeps its old extent after the contents of a row are deleted — so
 * clearing rows 2-10 and adding an item put it on row 11, leaving nine blank
 * rows above it. Finding the row ourselves, with the same definition of empty
 * the importer uses, keeps writing and reading in agreement.
 */
async function nextFreeRow(c: Ctx): Promise<number> {
  const rows = await readRange(
    c.config,
    c.tab,
    `A${FIRST_DATA_ROW}:${LAST_COL}`,
  );
  const gap = rows.findIndex(rowIsEmpty);
  // Trailing empty rows are not returned at all, so no gap means append.
  return FIRST_DATA_ROW + (gap === -1 ? rows.length : gap);
}

export async function createItem(item: WorkItem): Promise<WorkItem> {
  const c = await ctx();
  await ensureHeaders(c);

  // Derive the reference from the sheet rather than the caller's board, so
  // two people adding at the same time cannot both claim the same number.
  const ids = await readRange(
    c.config,
    c.tab,
    `${COLS.id}${FIRST_DATA_ROW}:${COLS.id}`,
  );
  const highest = ids.reduce((max, r) => {
    const m = /^MON-(\d+)$/.exec(str(r?.[0]));
    return m ? Math.max(max, Number(m[1])) : max;
  }, 0);

  const saved: WorkItem = {
    ...item,
    ref: highest + 1,
    id: `MON-${highest + 1}`,
    updatedAt: new Date().toISOString(),
  };
  const row = await nextFreeRow(c);
  await writeRanges(c.config, c.tab, [
    { a1: `A${row}:${LAST_COL}${row}`, values: [itemToRow(saved)] },
  ]);
  return { ...saved, sheetRow: row };
}

export async function updateItem(
  id: string,
  patch: Partial<WorkItem>,
  /** When given and the sheet has moved on, the write is refused. */
  expectedUpdatedAt?: string,
): Promise<WorkItem> {
  const c = await ctx();
  const rowNumber = await findRow(c, id);
  const row =
    (
      await readRange(c.config, c.tab, `A${rowNumber}:${LAST_COL}${rowNumber}`)
    )[0] ?? [];

  const current = rowToItem(row, rowNumber, []);
  if (!current) throw new SheetError(`${id} row is empty.`, 409);

  const epoch = new Date(0).toISOString();
  if (
    expectedUpdatedAt &&
    current.updatedAt !== epoch &&
    current.updatedAt !== expectedUpdatedAt
  ) {
    throw new SheetError(
      `${id} was changed in the sheet while you were editing it.`,
      409,
      "Reload the board to pick up the other change.",
    );
  }

  const next: WorkItem = {
    ...current,
    ...patch,
    id: current.id,
    ref: current.ref,
    sheetRow: rowNumber,
    updatedAt: new Date().toISOString(),
  };

  await writeRanges(c.config, c.tab, [
    { a1: `A${rowNumber}:${LAST_COL}${rowNumber}`, values: [itemToRow(next)] },
  ]);
  return next;
}

export async function removeItem(id: string): Promise<void> {
  const c = await ctx();
  const rowNumber = await findRow(c, id);
  await deleteRow(c.config, c.sheetId, rowNumber);
}

/**
 * Writes only the board-order column. A drag reorders a column, and
 * rewriting whole rows for that would clobber any cell edited in the sheet
 * in the meantime.
 */
export async function saveOrder(items: WorkItem[]): Promise<void> {
  const c = await ctx();
  const ids = await readRange(
    c.config,
    c.tab,
    `${COLS.id}${FIRST_DATA_ROW}:${COLS.id}`,
  );
  const rowById = new Map<string, number>();
  ids.forEach((r, i) => {
    const v = str(r?.[0]);
    if (v) rowById.set(v, FIRST_DATA_ROW + i);
  });

  const updates = items
    .filter((i) => rowById.has(i.id))
    .map((i) => ({
      a1: `${COLS.order}${rowById.get(i.id)}`,
      values: [[i.order]],
    }));

  await writeRanges(c.config, c.tab, updates);
}

export { SheetError };
