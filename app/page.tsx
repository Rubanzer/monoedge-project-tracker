"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { TopBar } from "@/components/layout/top-bar";
import { FilterBar, type View } from "@/components/layout/filter-bar";
import { PipelineRail } from "@/components/board/pipeline-rail";
import { KanbanBoard } from "@/components/board/kanban-board";
import { SheetTable } from "@/components/sheet-view/sheet-table";
import { WorkItemPanel } from "@/components/work-item/work-item-panel";
import { NewWorkItemDialog } from "@/components/work-item/new-work-item-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { COLUMNS, type BoardColumnDef } from "@/lib/constants";
import { repository } from "@/lib/repositories";
import { applyFilters, statusForDrop, useTracker } from "@/lib/store";
import type { Status } from "@/lib/types";

export default function TrackerPage() {
  const {
    items,
    loading,
    sync,
    lastSyncedAt,
    error,
    warnings,
    filters,
    groupBy,
    selectedId,
    composerOpen,
    load,
    refresh,
    createItem,
    patchItem,
    moveItem,
    deleteItem,
    resetBoard,
    setFilters,
    clearFilters,
    setGroupBy,
    select,
    setComposerOpen,
    dismissWarnings,
  } = useTracker();

  const [view, setView] = useState<View>("board");
  const [showParked, setShowParked] = useState(true);
  const [composerDefaults, setComposerDefaults] = useState<{
    status: Status;
    assigneeId: string | null;
  }>({ status: "Yet to Start", assigneeId: null });

  useEffect(() => {
    void load();
  }, [load]);

  // Poll a shared backend so edits made by someone else — or straight in the
  // sheet — appear without a manual reload. Paused while the tab is hidden,
  // because five idle laptops polling all day is the fastest way to spend
  // the rate limit on nothing.
  useEffect(() => {
    if (!repository.remote) return;
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const timer = setInterval(tick, 25_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [refresh]);

  // Import problems are reported once rather than on every poll.
  const reported = useRef("");
  useEffect(() => {
    const signature = warnings.join("|");
    if (!warnings.length || signature === reported.current) return;
    reported.current = signature;
    toast.warning(
      `${warnings.length} row${warnings.length === 1 ? "" : "s"} needed guessing`,
      {
        description: warnings.slice(0, 4).join(" · "),
        duration: 12_000,
        action: { label: "Dismiss", onClick: dismissWarnings },
      },
    );
  }, [warnings, dismissWarnings]);

  const visible = useMemo(() => applyFilters(items, filters), [items, filters]);
  const selected = items.find((i) => i.id === selectedId) ?? null;

  const openComposer = (
    column: BoardColumnDef = COLUMNS[0],
    assigneeId: string | null = null,
  ) => {
    setComposerDefaults({ status: column.primary, assigneeId });
    setComposerOpen(true);
  };

  return (
    <main className="flex h-full flex-col bg-background">
      <TopBar
        query={filters.query}
        onQuery={(query) => setFilters({ query })}
        sync={sync}
        lastSyncedAt={lastSyncedAt}
        error={error}
        onRefresh={() => void load()}
        onClear={() => {
          void resetBoard();
          toast("Board cleared");
        }}
        onNew={() => openComposer()}
      />

      <FilterBar
        view={view}
        onView={setView}
        filters={filters}
        onFilters={setFilters}
        onClear={clearFilters}
        groupBy={groupBy}
        onGroupBy={setGroupBy}
        showParked={showParked}
        onShowParked={setShowParked}
        visible={visible.length}
        total={items.length}
      />

      {view === "board" && items.length > 0 && <PipelineRail items={visible} />}

      <div className="flex min-h-0 flex-1 flex-col">
        {/* An empty board still shows its columns. The stages are the thing
            worth learning on the first run, and a centred message in place of
            them taught nothing and hid the "add" affordance each column
            already carries. The hint sits above the board rather than
            replacing it. */}
        {!loading && view === "board" && items.length === 0 && (
          <FirstRun onAdd={() => openComposer()} />
        )}

        {loading ? (
          <BoardSkeleton />
        ) : view === "sheet" && items.length === 0 ? (
          <EmptyBoard onAdd={() => openComposer()} />
        ) : items.length > 0 && visible.length === 0 ? (
          <NoMatches onClear={clearFilters} />
        ) : view === "board" ? (
          // The board is a flex child now that the first-run hint can sit
          // above it, so it takes the remaining height rather than 100% of a
          // container the hint has already eaten into.
          <div className="min-h-0 flex-1">
            <KanbanBoard
              items={visible}
              groupBy={groupBy}
              showParked={showParked}
              onOpen={select}
              onAdd={openComposer}
              onStatus={(id, status) => void patchItem(id, { status })}
              onMove={(id, columnId, index, assigneeId) => {
                const item = items.find((i) => i.id === id);
                void moveItem(id, columnId, index, assigneeId);
                if (!item) return;

                const next = statusForDrop(item, columnId);
                if (next === item.status) return;

                toast(`MON-${item.ref} → ${next}`, {
                  description:
                    next === "Completed"
                      ? "Actual date stamped with today."
                      : !item.startedDate
                        ? "Started date stamped with today."
                        : undefined,
                });
              }}
            />
          </div>
        ) : (
          <SheetTable items={visible} onOpen={select} />
        )}
      </div>

      <WorkItemPanel
        item={selected}
        onClose={() => select(null)}
        onPatch={(id, patch) => void patchItem(id, patch)}
        onDelete={(id) => void deleteItem(id)}
      />

      <NewWorkItemDialog
        open={composerOpen}
        defaultStatus={composerDefaults.status}
        defaultAssigneeId={composerDefaults.assigneeId}
        onOpenChange={setComposerOpen}
        onCreate={(input) => void createItem(input)}
      />
    </main>
  );
}

function BoardSkeleton() {
  return (
    <div className="flex h-full gap-3 p-4 sm:px-6" aria-busy>
      {/* Same widths as the real columns, so nothing jumps when it loads. */}
      {Array.from({ length: 5 }).map((_, col) => (
        <div key={col} className="min-w-[236px] flex-1 basis-0 space-y-2">
          <Skeleton className="h-9 rounded-lg" />
          {Array.from({ length: 3 - (col % 3) }).map((__, card) => (
            <Skeleton key={card} className="h-[86px] rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

/**
 * First run, board view. One line and one control, sitting above a board that
 * is already showing all five stages — so the columns do the explaining and
 * this only says what to do next. It states plainly whether the sheet is
 * connected, because that is the one thing the columns cannot show.
 */
function FirstRun({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule px-4 py-2.5 sm:px-6">
      <p className="text-[12px] text-muted-foreground">
        {repository.remote
          ? "No work items yet. Add one and it reaches the sheet within about half a minute."
          : "No work items yet. These are kept in this browser until the tracking sheet is connected."}
      </p>
      <Button size="sm" className="h-7 text-[12px]" onClick={onAdd}>
        Add the first work item
      </Button>
    </div>
  );
}

/** Sheet view has no columns to fall back on, so it keeps a plain message. */
function EmptyBoard({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="max-w-sm space-y-4 text-center">
        <div className="flex justify-center gap-1.5">
          {COLUMNS.map((c) => (
            <span
              key={c.id}
              className="h-1 w-9 rounded-full"
              style={{ background: c.color, opacity: 0.5 }}
            />
          ))}
        </div>
        <h2 className="text-[15px] font-semibold">Nothing on the board yet</h2>
        <p className="text-[13px] leading-relaxed text-muted-foreground">
          Add a work item to start, or connect the tracking sheet and the board
          will fill itself.
        </p>
        <Button size="sm" onClick={onAdd}>
          Add the first work item
        </Button>
      </div>
    </div>
  );
}

function NoMatches({ onClear }: { onClear: () => void }) {
  return (
    <div className="flex h-full items-center justify-center px-6">
      <div className="space-y-3 text-center">
        <p className="text-[13px] text-muted-foreground">
          No work items match these filters.
        </p>
        <Button size="sm" variant="outline" onClick={onClear}>
          Clear filters
        </Button>
      </div>
    </div>
  );
}
