"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { PRIORITIES } from "@/lib/types";
import type { WorkItem } from "@/lib/types";
import { memberById } from "@/lib/constants";
import { formatShort, isOverdue } from "@/lib/dates";
import { PersonAvatar } from "@/components/shared/person-avatar";
import {
  PriorityChip,
  StatusChip,
  TypeChip,
  WorkItemRef,
} from "@/components/shared/badges";

type SortKey = "ref" | "title" | "status" | "planned" | "priority" | "person";

const HEADS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "ref", label: "ID", className: "w-[72px]" },
  { key: "title", label: "Tasks", className: "min-w-[280px]" },
  { key: null, label: "Description", className: "min-w-[200px]" },
  { key: "person", label: "Primary Person", className: "w-[172px]" },
  { key: "status", label: "Status", className: "w-[168px]" },
  { key: null, label: "Created", className: "w-[92px]" },
  { key: null, label: "Started", className: "w-[92px]" },
  { key: "planned", label: "Planned", className: "w-[100px]" },
  { key: null, label: "Actual", className: "w-[92px]" },
  { key: "priority", label: "Priority", className: "w-[116px]" },
  { key: null, label: "Functionality / Bug", className: "w-[148px]" },
];

/**
 * The sheet, as it will read once synced — same columns, same order, so
 * anyone who knows the spreadsheet can find their way around immediately.
 */
export function SheetTable({
  items,
  onOpen,
}: {
  items: WorkItem[];
  onOpen: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({
    key: "ref",
    dir: 1,
  });

  const rows = useMemo(() => {
    const value = (i: WorkItem): string | number => {
      switch (sort.key) {
        case "ref":
          return i.ref;
        case "title":
          return i.title.toLowerCase();
        case "status":
          return i.status;
        case "planned":
          return i.plannedDate ?? "9999-12-31";
        case "priority":
          return PRIORITIES.indexOf(i.priority);
        case "person":
          return memberById(i.assigneeId)?.name ?? "zzz";
      }
    };
    return [...items].sort((a, b) => {
      const av = value(a);
      const bv = value(b);
      if (av === bv) return a.ref - b.ref;
      return (av > bv ? 1 : -1) * sort.dir;
    });
  }, [items, sort]);

  const press = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));

  if (!items.length) {
    return (
      <div className="flex h-full items-center justify-center p-10">
        <p className="text-[13px] text-muted-foreground">
          Nothing matches these filters.
        </p>
      </div>
    );
  }

  return (
    <div className="board-scroll h-full overflow-auto">
      <table className="w-full border-separate border-spacing-0 text-left">
        <thead className="sticky top-0 z-10">
          <tr>
            {HEADS.map((h) => (
              <th
                key={h.label}
                scope="col"
                className={cn(
                  "border-b border-rule bg-primary px-3 py-2 whitespace-nowrap",
                  h.className,
                )}
              >
                {h.key ? (
                  <button
                    type="button"
                    onClick={() => press(h.key!)}
                    className="label-mono flex items-center gap-1 text-primary-foreground/85 transition-colors hover:text-primary-foreground"
                  >
                    {h.label}
                    {sort.key === h.key &&
                      (sort.dir === 1 ? (
                        <ArrowUp className="size-3" />
                      ) : (
                        <ArrowDown className="size-3" />
                      ))}
                  </button>
                ) : (
                  <span className="label-mono text-primary-foreground/85">
                    {h.label}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, idx) => {
            const overdue = isOverdue(item);
            const member = memberById(item.assigneeId);
            return (
              <tr
                key={item.id}
                onClick={() => onOpen(item.id)}
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onOpen(item.id);
                }}
                className={cn(
                  "cursor-default transition-colors focus-visible:outline-none",
                  idx % 2 ? "bg-muted/35" : "bg-card",
                  "hover:bg-brand-tint focus-visible:bg-brand-tint",
                )}
              >
                <Cell>
                  <WorkItemRef refNumber={item.ref} />
                </Cell>
                <Cell className="font-medium text-foreground">
                  <span className="line-clamp-1">{item.title}</span>
                </Cell>
                <Cell className="text-muted-foreground">
                  <span className="line-clamp-1">{item.description || "—"}</span>
                </Cell>
                <Cell>
                  <span className="flex items-center gap-2">
                    <PersonAvatar memberId={item.assigneeId} size="sm" />
                    <span className="truncate">{member?.name ?? "Unassigned"}</span>
                  </span>
                </Cell>
                <Cell>
                  <StatusChip status={item.status} />
                </Cell>
                <Cell mono>{formatShort(item.createdDate)}</Cell>
                <Cell mono>{formatShort(item.startedDate)}</Cell>
                <Cell mono>
                  <span
                    className={cn(
                      "flex items-center gap-1",
                      overdue && "font-semibold text-destructive",
                    )}
                  >
                    {overdue && <AlertTriangle className="size-3" />}
                    {formatShort(item.plannedDate)}
                  </span>
                </Cell>
                <Cell mono>{formatShort(item.actualDate)}</Cell>
                <Cell>
                  <PriorityChip priority={item.priority} />
                </Cell>
                <Cell>
                  <TypeChip type={item.type} short />
                </Cell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Cell({
  children,
  className,
  mono,
}: {
  children: React.ReactNode;
  className?: string;
  mono?: boolean;
}) {
  return (
    <td
      className={cn(
        "border-b border-rule px-3 py-2 text-[12.5px] align-middle",
        mono && "font-mono text-[11.5px] text-muted-foreground tabular",
        className,
      )}
    >
      {children}
    </td>
  );
}
