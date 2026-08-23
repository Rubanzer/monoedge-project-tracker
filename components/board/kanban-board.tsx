"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
  type UniqueIdentifier,
} from "@dnd-kit/core";
import { arrayMove, sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import {
  ALL_COLUMNS,
  COLUMNS,
  PARKED_COLUMN,
  TEAM,
  columnForStatus,
  memberById,
  type BoardColumnDef,
} from "@/lib/constants";
import { byOrder } from "@/lib/store";
import type { GroupBy, Status, WorkItem } from "@/lib/types";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { BoardColumn } from "./board-column";
import { WorkItemCard } from "./work-item-card";

const ALL_LANE = "all";
const UNASSIGNED = "unassigned";

/** Droppable keys are `columnId__lane`; work item ids never contain "__". */
const dropKey = (columnId: string, lane: string) => `${columnId}__${lane}`;
const isColumnKey = (id: UniqueIdentifier) => String(id).includes("__");
const parseKey = (id: UniqueIdentifier) => {
  const [columnId, lane] = String(id).split("__");
  return { columnId, lane };
};

type Columns = Record<string, WorkItem[]>;

function buildColumns(
  items: WorkItem[],
  lanes: string[],
  groupBy: GroupBy,
): Columns {
  const cols: Columns = {};
  ALL_COLUMNS.forEach((c) => lanes.forEach((l) => (cols[dropKey(c.id, l)] = [])));

  [...items].sort(byOrder).forEach((item) => {
    const lane =
      groupBy === "assignee" ? (item.assigneeId ?? UNASSIGNED) : ALL_LANE;
    const k = dropKey(columnForStatus(item.status).id, lane);
    if (cols[k]) cols[k].push(item);
  });
  return cols;
}

export function KanbanBoard({
  items,
  groupBy,
  showParked,
  onOpen,
  onAdd,
  onStatus,
  onMove,
}: {
  items: WorkItem[];
  groupBy: GroupBy;
  showParked: boolean;
  onOpen: (id: string) => void;
  onAdd: (column: BoardColumnDef, assigneeId?: string | null) => void;
  onStatus: (id: string, status: Status) => void;
  onMove: (
    id: string,
    columnId: string,
    index: number,
    assigneeId?: string | null,
  ) => void;
}) {
  const lanes = useMemo(
    () =>
      groupBy === "assignee"
        ? [...TEAM.map((m) => m.id), UNASSIGNED]
        : [ALL_LANE],
    [groupBy],
  );

  const base = useMemo(
    () => buildColumns(items, lanes, groupBy),
    [items, lanes, groupBy],
  );

  const [preview, setPreview] = useState<Columns | null>(null);
  const [active, setActive] = useState<WorkItem | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const cols = preview ?? base;
  const columns = showParked ? [...COLUMNS, PARKED_COLUMN] : COLUMNS;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findKey = (id: UniqueIdentifier, source: Columns): string | null => {
    if (isColumnKey(id)) return String(id);
    return (
      Object.keys(source).find((k) => source[k].some((i) => i.id === id)) ?? null
    );
  };

  function handleDragStart(e: DragStartEvent) {
    setActive(items.find((i) => i.id === e.active.id) ?? null);
    setPreview(base);
  }

  function handleDragOver(e: DragOverEvent) {
    const { active: a, over } = e;
    if (!over) return;

    const source = preview ?? base;
    const from = findKey(a.id, source);
    const to = findKey(over.id, source);
    setOverKey(to);
    if (!from || !to || from === to) return;

    const next: Columns = { ...source };
    const fromList = [...next[from]];
    const idx = fromList.findIndex((i) => i.id === a.id);
    if (idx === -1) return;
    const [moved] = fromList.splice(idx, 1);

    const { lane: toLane } = parseKey(to);
    const toList = [...next[to]];
    const overIndex = toList.findIndex((i) => i.id === over.id);
    const insertAt =
      isColumnKey(over.id) || overIndex === -1 ? toList.length : overIndex;

    toList.splice(insertAt, 0, {
      ...moved,
      assigneeId:
        groupBy === "assignee"
          ? toLane === UNASSIGNED
            ? null
            : toLane
          : moved.assigneeId,
    });

    next[from] = fromList;
    next[to] = toList;
    setPreview(next);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active: a, over } = e;
    const source = preview ?? base;

    if (over) {
      const from = findKey(a.id, source);
      const to = findKey(over.id, source);

      if (from && to) {
        let list = source[to];

        // Same column: settle the final position with arrayMove.
        if (from === to && !isColumnKey(over.id)) {
          const oldIndex = list.findIndex((i) => i.id === a.id);
          const newIndex = list.findIndex((i) => i.id === over.id);
          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            list = arrayMove(list, oldIndex, newIndex);
          }
        }

        const index = list.findIndex((i) => i.id === a.id);
        const { columnId, lane } = parseKey(to);
        onMove(
          String(a.id),
          columnId,
          Math.max(0, index),
          groupBy === "assignee"
            ? lane === UNASSIGNED
              ? null
              : lane
            : undefined,
        );
      }
    }

    setActive(null);
    setPreview(null);
    setOverKey(null);
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={() => {
        setActive(null);
        setPreview(null);
        setOverKey(null);
      }}
    >
      {/* The entrance animation must live HERE, on a sibling of DragOverlay
          — never on an ancestor of it. DragOverlay is position:fixed, and a
          transform on any ancestor makes that fixed element resolve against
          the ancestor instead of the viewport, so the dragged card lands
          offset from the cursor by the height of the chrome above the board. */}
      <div className="board-scroll animate-rise h-full overflow-x-auto overflow-y-hidden">
        {groupBy === "none" ? (
          <div className="flex h-full gap-3 p-4 sm:px-6">
            {columns.map((column) => (
              <BoardColumn
                key={column.id}
                column={column}
                dropId={dropKey(column.id, ALL_LANE)}
                items={cols[dropKey(column.id, ALL_LANE)] ?? []}
                onOpen={onOpen}
                onAdd={(c) => onAdd(c)}
                onStatus={onStatus}
                isDropTarget={overKey === dropKey(column.id, ALL_LANE)}
              />
            ))}
          </div>
        ) : (
          <div className="board-scroll flex h-full min-w-max flex-col gap-6 overflow-y-auto p-4 sm:px-6">
            {lanes.map((lane) => {
              const member = memberById(lane === UNASSIGNED ? null : lane);
              const count = columns.reduce(
                (n, c) => n + (cols[dropKey(c.id, lane)]?.length ?? 0),
                0,
              );
              return (
                <div key={lane}>
                  <div className="sticky left-0 mb-2 flex w-fit items-center gap-2">
                    <PersonAvatar
                      memberId={lane === UNASSIGNED ? null : lane}
                      size="md"
                    />
                    <span className="text-[13px] font-semibold">
                      {member?.name ?? "Unassigned"}
                    </span>
                    <span className="font-mono text-[11px] text-muted-foreground tabular">
                      {count}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    {columns.map((column) => (
                      <BoardColumn
                        key={column.id}
                        column={column}
                        dropId={dropKey(column.id, lane)}
                        items={cols[dropKey(column.id, lane)] ?? []}
                        onOpen={onOpen}
                        onAdd={(c) =>
                          onAdd(c, lane === UNASSIGNED ? null : lane)
                        }
                        onStatus={onStatus}
                        isDropTarget={overKey === dropKey(column.id, lane)}
                        dense
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 180,
          easing: "cubic-bezier(0.2, 0.7, 0.3, 1)",
        }}
      >
        {/* No wrapper: DragOverlay sizes itself from the card it lifted, so
            forcing a width here made the ghost 4px wider than the original. */}
        {active ? <WorkItemCard item={active} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}
