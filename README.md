# Monoedge Tracker

A Kanban board for Monoedge project work, built to sit on top of the team
tracking sheet. Four columns, drag to move, assign to anyone on the team.

**Status: the Google Sheets adapter is built and waiting on credentials.**
Set the environment variables in [Connecting the Google Sheet](#connecting-the-google-sheet)
and the board reads and writes the tracking sheet for the whole team. Until
then it falls back to a browser-local draft, which is per-person and shared
with nobody.

The local draft lives in `localStorage` under `monoedge.tracker.items.v2`.
Because that survives a code change, **bump the key in
[`lib/repositories/local.ts`](lib/repositories/local.ts) and add the old one to
`DEAD_KEYS` whenever the shape of a `WorkItem` changes** — otherwise everyone
who loaded an earlier build keeps seeing stale rows the code no longer knows
about. To wipe it by hand, use **Clear board** in the sync pill menu.

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

The adapter is built. It needs credentials and one environment flag, and it
adapts to the sheet rather than the other way round: the existing dropdown
values are accepted as-is, and the columns it needs are created on first
connect. **No manual preparation of the sheet is required.**

### 1. Create a service account

1. In the [Google Cloud console](https://console.cloud.google.com), create (or
   pick) a project.
2. **APIs & Services → Library → Google Sheets API → Enable.**
3. **IAM & Admin → Service Accounts → Create service account.** No roles are
   needed; access is granted by sharing the sheet, not by IAM.
4. On the account, **Keys → Add key → Create new key → JSON.** Keep the file
   somewhere safe; it is the only copy.

### 2. Share the sheet with it

Open the tracking sheet, **Share**, and add the service account's
`client_email` (it looks like `something@project.iam.gserviceaccount.com`) as
an **Editor**.

> Google Workspace often blocks sharing outside the organisation by default.
> If the address is rejected, an admin has to allow external sharing for this
> file. Do this step early — it is the one that needs someone else.

### 3. Set four environment variables

In Vercel, **Settings → Environment Variables** (and `.env.local` for local
work — see [`.env.example`](.env.example)):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_TRACKER_BACKEND` | `sheets` |
| `GOOGLE_SHEET_ID` | the part of the sheet URL between `/d/` and `/edit` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` from the JSON key |
| `GOOGLE_PRIVATE_KEY` | `private_key` from the JSON key, pasted whole including the BEGIN and END lines |
| `GOOGLE_SHEET_TAB` | *optional* — defaults to the first tab |

Redeploy. Without `NEXT_PUBLIC_TRACKER_BACKEND=sheets` the app stays on the
browser-local draft, so a checkout with no credentials still runs.

### 4. Check it

Visit **`/api/sheet/diagnose`** on the deployment. It walks the connection one
step at a time and names the step that fails, with a fix:

```json
{ "ok": true, "checks": [
  { "step": "Environment variables", "ok": true,  "detail": "..." },
  { "step": "Private key format",    "ok": true,  "detail": "..." },
  { "step": "Spreadsheet access",    "ok": true,  "detail": "Reading tab \"Sheet1\"" },
  { "step": "Managed columns (K–N)", "ok": true,  "detail": "All four present" },
  { "step": "Read and map rows",     "ok": true,  "detail": "14 work items imported" },
  { "step": "Row warnings",          "ok": true,  "detail": "None" }
]}
```

It never returns cell contents or any part of the private key.

### What the app does to your sheet

On first successful load it adds four headers in **K–N** and fills them in.
Columns **A–J** are never restructured.

| Column | Header | Why |
|---|---|---|
| K | `Item ID` | `MON-7`. Without it, inserting a row shifts every card's identity and edits land on the wrong task |
| L | `Board Order` | Card position within a column; otherwise order resets to row order on every load |
| M | `Assignee Key` | The stable member id. Column C keeps the readable name for humans |
| N | `Updated At` | Used to refuse a write when someone else changed the row first |

Existing rows are given IDs automatically the first time they are seen. You
can hide K–N in Google Sheets; the app does not care.

### It reads your dropdown as it is

The importer normalises values, so `Testing` maps to `Testing done` and the
retired `Define Approach` folds into `In Progress`. Casing and spacing are
ignored. Anything it cannot place is defaulted **and reported** — the app
raises a toast listing the rows, and `/api/sheet/diagnose` lists them too.
Nothing is silently mangled. Aliases live in
[`lib/sheet-mapping.ts`](lib/sheet-mapping.ts).

### How it stays in sync

- The board polls every 25 seconds, only while the tab is visible, and never
  over a write in flight or a card someone has open.
- Edits write just the affected row. A drag writes the row plus the order
  column for that column — never the whole sheet.
- Before writing, the row's `Updated At` is compared with what the browser
  last saw. If the sheet moved on, the write is refused with a 409 and the
  board reloads instead of overwriting the other person.

### Limits worth knowing

- Google allows roughly **60 requests per minute per service account**, and
  that budget is shared by everyone using the app, because every request is
  signed by the same account. Five people polling is about 12/minute, so
  there is headroom — but a tight loop of drags can hit it. The app surfaces
  a 429 as "Hit Google's rate limit" rather than failing silently.
- Deleting a work item deletes the sheet row. There is no undo.
- **Clear board** is hidden when the sheet is connected. It only ever wipes
  the local draft.

### Verifying the mapping

The row mapping has its own check, because a wrong date epoch is silently
wrong rather than loudly broken:

```bash
npm run check:mapping
```

42 assertions over the Sheets serial-date epoch, every value in your current
dropdown, a row shaped exactly like the ones in the sheet today, and a full
round trip. It needs no credentials.

---

## Layout

```
app/
  layout.tsx              fonts, theme, tooltip and toast providers
  page.tsx                composes the workspace, owns view state and polling
  api/items/              list, create, update, delete, reorder
  api/sheet/diagnose/     step-by-step connection check
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
  store.ts                zustand store — optimistic writes, conflicts, filters
  repository.ts           the storage interface every adapter implements
  repositories/           local (browser) and remote (calls /api/items)
  sheet-mapping.ts        row <-> WorkItem and the alias tables. Pure, testable
  server/sheets.ts        Sheets REST client. Credentials never leave here
  server/sheet-store.ts   the Sheets I/O built on top of the mapping
  dates.ts                formatting, overdue and due-soon logic
scripts/
  check-mapping.ts        assertions over the mapping — no credentials needed
```

The browser never sees the service account. It calls `/api/items`, and those
route handlers hold the credentials — which is why the Sheets code sits under
`lib/server/` behind `import "server-only"`.

Colour tokens live in `app/globals.css`. Every chip takes its accent as a `--c`
custom property and derives fill, text and border from it with `color-mix`, so
one token set serves both themes.

## Deploying

```bash
npx vercel
```

No environment variables are needed while the local adapter is in use.
