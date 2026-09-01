"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { BoardColumnDef } from "@/lib/constants";
import type { Status, WorkItem } from "@/lib/types";
import { SortableWorkItemCard } from "./work-item-card";

export function BoardColumn({
  column,
  /** Droppable key owned by the board — `columnId__lane`. */
  dropId,
  items,
  onOpen,
  onAdd,
  onStatus,
  isDropTarget,
  /** Swimlane mode: empty columns collapse instead of holding a full height. */
  dense = false,
}: {
  column: BoardColumnDef;
  dropId: string;
  items: WorkItem[];
  onOpen: (id: string) => void;
  onAdd: (column: BoardColumnDef) => void;
  onStatus: (id: string, status: Status) => void;
  isDropTarget: boolean;
  dense?: boolean;
}) {
  const { setNodeRef } = useDroppable({
    id: dropId,
    data: { type: "column", columnId: column.id },
  });
  const empty = items.length === 0;

  return (
    <section
      data-column={column.id}
      className={cn(
        "flex flex-col",
        dense
          ? // Swimlanes: every lane must line its stages up with every other
            // lane, so the width is fixed and the row scrolls as one.
            "h-auto w-[276px] shrink-0"
          : // Flat: share the viewport out between the stages, down to a
            // floor where a card stops being readable — 236px, which is exactly
            // what lets five columns fit a 1280 laptop. Past that the board
            // scrolls rather than squeezing further, so a laptop gets five
            // usable columns and a wide monitor gets no dead margin.
            "h-full min-w-[236px] flex-1 basis-0",
      )}
      aria-label={`${column.label}, ${items.length} items`}
    >
      {/* Header: the colour rule is the only status signal on the board */}
      <div className="shrink-0 rounded-t-lg border border-b-0 border-rule bg-card">
        <div
          aria-hidden
          className="h-[3px] rounded-t-[7px]"
          style={{ background: column.color }}
        />
        <div className="flex items-center justify-between gap-2 px-3 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <h2 className="label-mono min-w-0 truncate text-foreground">
                {column.label}
              </h2>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-56">
              {column.hint}
            </TooltipContent>
          </Tooltip>

          <div className="flex shrink-0 items-center gap-1">
            <span
              className={cn(
                "font-mono text-[11px] font-semibold tabular",
                empty ? "text-muted-foreground/50" : "text-muted-foreground",
              )}
            >
              {items.length}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() => onAdd(column)}
              aria-label={`Add a work item to ${column.label}`}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-0 flex-col gap-2 overflow-y-auto rounded-b-lg border border-t-0 border-rule bg-canvas p-2 transition-colors duration-150",
          dense ? "min-h-[46px]" : "flex-1",
          isDropTarget && "border-primary/45 bg-brand-tint",
        )}
      >
        <SortableContext
          items={items.map((i) => i.id)}
          strategy={verticalListSortingStrategy}
        >
          {items.map((item) => (
            <SortableWorkItemCard
              key={item.id}
              item={item}
              onOpen={onOpen}
              onStatus={onStatus}
            />
          ))}
        </SortableContext>

        {empty &&
          (dense ? (
            // In swimlanes an empty stage is the common case, so it stays a
            // quiet strip rather than repeated invitations to add work.
            <button
              type="button"
              onClick={() => onAdd(column)}
              aria-label={`Add a work item to ${column.label}`}
              className={cn(
                "h-[30px] w-full rounded-md border border-dashed border-rule-strong/50 text-[11px] text-transparent transition-colors",
                "hover:border-primary/40 hover:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                isDropTarget && "border-primary/50 text-muted-foreground",
              )}
            >
              {isDropTarget ? "Drop here" : "Add"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onAdd(column)}
              className={cn(
                "flex min-h-24 w-full flex-1 items-center justify-center rounded-md border border-dashed border-rule-strong/60 text-[11px] text-muted-foreground transition-colors",
                "hover:border-primary/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              {isDropTarget ? "Drop here" : "Nothing here — add one"}
            </button>
          ))}
      </div>
    </section>
  );
}
