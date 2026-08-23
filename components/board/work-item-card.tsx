"use client";

import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, ChevronDown, MessageSquareText } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PRIORITY_TOKENS, STATUS_TOKENS, columnForStatus } from "@/lib/constants";
import { formatShort, isDueSoon, isOverdue } from "@/lib/dates";
import type { Status, WorkItem } from "@/lib/types";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { TypeChip, WorkItemRef } from "@/components/shared/badges";
import { tone } from "@/components/shared/tone";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  item: WorkItem;
  onOpen?: (id: string) => void;
  /** Only passed on the board — the drag overlay renders the chip static. */
  onStatus?: (id: string, status: Status) => void;
  dragging?: boolean;
  overlay?: boolean;
  style?: CSSProperties;
}

/**
 * Status is carried by the column, so the card spends its one loud signal on
 * priority: a full-height stripe down the left edge.
 *
 * The exception is In progress, which holds four statuses. Those cards show
 * which one, as a menu — moving PR review → Ready to Merge is the commonest
 * edit on the board and should not cost a trip through the detail panel.
 *
 * This is a single interactive node: dnd-kit's drag attributes sit on the
 * same element that handles opening, so there is one tab stop per card.
 */
export const WorkItemCard = forwardRef<HTMLDivElement, CardProps>(
  function WorkItemCard(
    { item, onOpen, onStatus, dragging, overlay, className, ...rest },
    ref,
  ) {
    const overdue = isOverdue(item);
    const soon = isDueSoon(item);
    const priority = PRIORITY_TOKENS[item.priority];
    const column = columnForStatus(item.status);
    const showStatus = column.statuses.length > 1;

    return (
      <div
        ref={ref}
        role="button"
        tabIndex={0}
        aria-label={`MON-${item.ref}: ${item.title}`}
        {...rest}
        onClick={(e) => {
          rest.onClick?.(e);
          onOpen?.(item.id);
        }}
        onKeyDown={(e) => {
          rest.onKeyDown?.(e);
          // Space is dnd-kit's lift key, so only Enter opens the panel.
          if (e.key === "Enter") {
            e.preventDefault();
            onOpen?.(item.id);
          }
        }}
        className={cn(
          "group relative w-full touch-none overflow-hidden rounded-lg border border-rule bg-card text-left",
          "shadow-[0_1px_2px_rgba(12,27,20,0.04)] transition-[border-color,box-shadow] duration-150",
          "hover:border-rule-strong hover:shadow-[0_2px_10px_rgba(12,27,20,0.07)]",
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
          dragging && "opacity-40",
          overlay &&
            "rotate-[1.5deg] border-rule-strong shadow-[0_12px_28px_rgba(12,27,20,0.18)]",
          className,
        )}
      >
        {/* Priority stripe */}
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-[3px]"
          style={{ background: priority.color }}
        />

        <div className="space-y-2 py-2.5 pr-3 pl-4">
          <div className="flex items-center justify-between gap-2">
            <WorkItemRef refNumber={item.ref} />
            <span
              className="font-mono text-[10px] font-semibold tracking-[0.1em] uppercase tone-text"
              style={tone(priority.color)}
            >
              {item.priority}
            </span>
          </div>

          <p className="line-clamp-2 text-[13.5px] leading-snug font-medium text-foreground">
            {item.title}
          </p>

          {/* Multi-status columns get the status on its own line — squeezed
              into the meta row it truncates to "PR RE…" and says nothing. */}
          {showStatus && (
            <div className="flex pt-0.5">
              {onStatus && !overlay ? (
                <StatusMenu
                  item={item}
                  statuses={column.statuses}
                  onStatus={onStatus}
                />
              ) : (
                <span
                  className="chip chip-mono"
                  style={tone(STATUS_TOKENS[item.status].color)}
                >
                  <i className="dot" />
                  {item.status}
                </span>
              )}
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <div className="flex min-w-0 items-center gap-1.5">
              <TypeChip type={item.type} short />
              {item.description && (
                <MessageSquareText
                  className="size-3 shrink-0 text-muted-foreground/60"
                  aria-label="Has a description"
                />
              )}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  "flex items-center gap-1 font-mono text-[10.5px] tabular",
                  overdue
                    ? "font-semibold text-destructive"
                    : soon
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                )}
                title={
                  item.plannedDate
                    ? `Planned for ${formatShort(item.plannedDate)}`
                    : "No planned date"
                }
              >
                {overdue && <AlertTriangle className="size-3" strokeWidth={2.5} />}
                {formatShort(item.plannedDate)}
              </span>
              <PersonAvatar memberId={item.assigneeId} size="sm" />
            </div>
          </div>
        </div>
      </div>
    );
  },
);

/**
 * The chip sits inside a draggable, so every pointer and key event is stopped
 * here — otherwise opening the menu starts a drag or opens the detail panel.
 */
function StatusMenu({
  item,
  statuses,
  onStatus,
}: {
  item: WorkItem;
  statuses: Status[];
  onStatus: (id: string, status: Status) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Status: ${item.status}. Change it.`}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="chip chip-mono transition-[filter] hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none dark:hover:brightness-125"
          style={tone(STATUS_TOKENS[item.status].color)}
        >
          <i className="dot" />
          {item.status}
          <ChevronDown className="size-2.5 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="w-48"
        onClick={(e) => e.stopPropagation()}
      >
        {statuses.map((s) => (
          <DropdownMenuItem
            key={s}
            className="text-[13px]"
            onSelect={() => onStatus(item.id, s)}
          >
            <span className="flex items-center gap-2">
              <i className="dot" style={tone(STATUS_TOKENS[s].color)} />
              {s}
            </span>
            {s === item.status && (
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">
                now
              </span>
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Sortable wrapper — kept separate so DragOverlay can render the card raw. */
export function SortableWorkItemCard({
  item,
  onOpen,
  onStatus,
}: {
  item: WorkItem;
  onOpen: (id: string) => void;
  onStatus: (id: string, status: Status) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id, data: { type: "item", item } });

  return (
    <WorkItemCard
      ref={setNodeRef}
      item={item}
      onOpen={onOpen}
      onStatus={onStatus}
      dragging={isDragging}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
    />
  );
}
