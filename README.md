# Monoedge Tracker

A Kanban board for Monoedge project work, built to sit on top of the team
tracking sheet. Four columns, drag to move, assign to anyone on the team.

**Status: frontend complete, backend not connected.** The board starts empty
and everything runs against a browser-local adapter, so nothing is shared
between people yet. That lands with the Google Sheets adapter.

Work items live in `localStorage` under `monoedge.tracker.items.v2`. Because
that survives a code change, **bump the key in
[`lib/repositories/local.ts`](lib/repositories/local.ts) and add the old one to
`DEAD_KEYS` whenever the shape of a `WorkItem` changes** — otherwise everyone
who loaded an earlier build keeps seeing stale rows the code no longer knows
about. To wipe the board by hand, use **Clear board** in the sync pill menu.

```bash
npm run dev
```

---

## Columns and statuses

Four columns, plus **On hold** as a parked lane you can hide.

```
Yet to start  │  In progress  │  Testing done  │  Completed        ⟨ On hold ⟩
```

**In progress holds four statuses.** Collapsing the delivery detail into one
column keeps the board readable without losing precision — a card shows which
of the four it is, and the chip is a menu, so `PR review → Ready to Merge` is
one click on the board rather than a trip through the detail panel.

| Column | Statuses it holds |
|---|---|
| Yet to start | `Yet to Start` |
| In progress | `In Progress`, `PR review`, `Ready to Merge`, `Pending Prod Push` |
| Testing done | `Testing done` |
| Completed | `Completed` |
| On hold *(parked)* | `On-hold` |

`Define Approach` has been removed.

### ⚠ Your sheet's dropdown needs to match

The sheet's Status dropdown currently reads `Testing`, and still contains
`Define Approach`. Before connecting it, the dropdown must be exactly these
eight values — the import maps on the string, so anything else silently fails
to place a row:

```
Yet to Start · In Progress · PR review · Ready to Merge
Pending Prod Push · Testing done · Completed · On-hold
```

Column order and grouping live in `COLUMNS` in
[`lib/constants.ts`](lib/constants.ts) — one array, nothing else to change.

## Automatic dates

Moving a card writes the dates you would otherwise fill in by hand:

- into any working stage → stamps `Task Started Date`, if it is blank
- into **Completed** → stamps `Task Actual Date`
- out of **Completed** → clears `Task Actual Date`, so the column and the date
  can never disagree

Both are editable in the detail panel if the automatic value is wrong.

Nothing in **Testing done**, **Completed** or **On hold** is flagged late.
Finished work cannot be late, and a parked slip was a decision rather than a
problem to chase.

## The team

`TEAM` in [`lib/constants.ts`](lib/constants.ts) currently holds one person.
Add the other four — id, name, initials, colour — and avatars, filters,
swimlanes and the assignee picker all follow. The `id` is what gets written to
the sheet's Primary Person column, so keep it stable once work is assigned.

## What else is in there

| | |
|---|---|
| **Swimlanes** | Group by person — dragging a card into someone else's lane reassigns it |
| **Sheet view** | The same data as a dense table, same columns and order as the spreadsheet |
| **Detail panel** | Every field editable, saves on change |
| **Filters** | Person (click the avatars), priority, type, free text, hide-done |
| **Pipeline rail** | Proportional bar across the top. It breaks out all seven flow statuses, so the detail the four columns collapse is still visible at a glance. Click a segment to jump to its column |
| **Themes** | Light and dark |
| **Keyboard** | `/` focuses search, `Enter` opens a card, `Space` lifts it, arrows move it |

---

## Connecting the Google Sheet

The UI talks to one interface and nothing else. Implement it once and the whole
app switches over.

### 1. Column mapping

Already fixed in [`lib/types.ts`](lib/types.ts) — each `WorkItem` field is
annotated with its column letter:

| Sheet column | Field |
|---|---|
| A · Tasks | `title` |
| B · Description | `description` |
| C · Primary Person | `assigneeId` (a `Member.id`, not a display name) |
| D · Status | `status` |
| E · Task Creation Date | `createdDate` |
| F · Task Started Date | `startedDate` |
| G · Task Planned Date | `plannedDate` |
| H · Task Actual Date | `actualDate` |
| I · Priority | `priority` |
| J · Functionality / Bug | `type` |

Dates are ISO `yyyy-mm-dd` in the app and formatted for display only.

Two fields have no column yet:

- **`ref`** — the `MON-14` identifier. Assigned on import today, which means it
  is not stable across reloads once rows move. Worth adding a hidden ID column.
- **`order`** — position within a board column. Also worth a hidden column,
  otherwise card order resets to sheet-row order on every load.

### 2. Write the adapter

Create `lib/repositories/sheets.ts` implementing
[`TrackerRepository`](lib/repository.ts):

```ts
list()                  // read the sheet → WorkItem[], setting sheetRow on each
create(item)            // append a row
update(id, patch)       // write the changed cells of item.sheetRow
remove(id)              // delete the row
saveAll(items)          // batch write — called after a drag reorders a column
reset()                 // reload
```

`sheetRow` is carried on every item so an update targets the right row rather
than searching by title.

### 3. Switch it on

One line in [`lib/repositories/index.ts`](lib/repositories/index.ts):

```ts
export const repository: TrackerRepository = sheetsRepository;
```

The sync pill in the header reads `repository.label` and `repository.remote`,
so it will start describing the sheet with no other change.

### Still to decide

- **Auth.** A service account with the sheet shared to it is simplest, but the
  credential has to live in a Vercel env var and every write is then anonymous.
  OAuth per person costs more setup and gives real attribution.
- **Concurrent edits.** Five people on one sheet will overwrite each other. The
  store is optimistic and rolls back on error, but nothing detects a conflict
  yet. Cheapest fix is to compare `updatedAt` before writing.
- **Rate limits.** Sheets allows 60 reads/minute per user. A drag currently
  calls `saveAll`, which rewrites the column. Batch or debounce it.

---

## Layout

```
app/
  layout.tsx              fonts, theme, tooltip and toast providers
  page.tsx                composes the workspace, owns view state
components/
  board/                  kanban board, columns, cards, pipeline rail
  sheet-view/             the table
  work-item/              detail panel, new-item dialog, shared field controls
  layout/                 top bar, filter bar
  shared/                 chips, avatars, tone helper
  ui/                     shadcn primitives
lib/
  types.ts                domain model, annotated with sheet columns
  constants.ts            team, columns, statuses, colour tokens
  store.ts                zustand store — optimistic writes, filters
  repository.ts           the storage interface
  repositories/           local adapter now, sheets adapter later
  dates.ts                formatting, overdue and due-soon logic
```

Colour tokens live in `app/globals.css`. Every chip takes its accent as a `--c`
custom property and derives fill, text and border from it with `color-mix`, so
one token set serves both themes.

## Deploying

```bash
npx vercel
```

No environment variables are needed while the local adapter is in use.
