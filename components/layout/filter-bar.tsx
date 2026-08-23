"use client";

import { Check, ChevronDown, Columns3, Rows3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { PRIORITY_TOKENS, TEAM, TYPE_TOKENS } from "@/lib/constants";
import { PRIORITIES, WORK_TYPES } from "@/lib/types";
import type { Filters, GroupBy, Priority, WorkType } from "@/lib/types";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { tone } from "@/components/shared/tone";

export type View = "board" | "sheet";

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T;
  options: { value: T; label: string; icon?: React.ReactNode }[];
  onChange: (v: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="flex h-8 items-center gap-0.5 rounded-md border border-rule bg-muted/60 p-0.5"
    >
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 font-mono text-[10px] font-medium tracking-[0.1em] uppercase transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            value === o.value
              ? "bg-card text-foreground shadow-[0_1px_2px_rgba(12,27,20,0.06)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function FilterBar({
  view,
  onView,
  filters,
  onFilters,
  onClear,
  groupBy,
  onGroupBy,
  showParked,
  onShowParked,
  visible,
  total,
}: {
  view: View;
  onView: (v: View) => void;
  filters: Filters;
  onFilters: (patch: Partial<Filters>) => void;
  onClear: () => void;
  groupBy: GroupBy;
  onGroupBy: (g: GroupBy) => void;
  showParked: boolean;
  onShowParked: (v: boolean) => void;
  visible: number;
  total: number;
}) {
  const dirty =
    filters.assigneeIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.types.length > 0 ||
    filters.hideCompleted ||
    filters.query.trim() !== "";

  const people = [
    ...TEAM.map((m) => ({ id: m.id, name: m.name })),
    { id: "unassigned", name: "Unassigned" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-rule bg-card px-4 py-2 sm:px-6">
      <Segmented
        ariaLabel="View"
        value={view}
        onChange={onView}
        options={[
          { value: "board", label: "Board", icon: <Columns3 className="size-3" /> },
          { value: "sheet", label: "Sheet", icon: <Rows3 className="size-3" /> },
        ]}
      />

      <span aria-hidden className="hidden h-5 w-px bg-rule sm:block" />

      {/* People filter as avatars — faster to hit than a menu, and the
          colours are the same ones used on every card. */}
      <div className="flex items-center gap-1">
        {people.map((p) => {
          const on = filters.assigneeIds.includes(p.id);
          return (
            <Tooltip key={p.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    onFilters({ assigneeIds: toggle(filters.assigneeIds, p.id) })
                  }
                  className={cn(
                    "rounded-full p-0.5 transition-all focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    on
                      ? "bg-brand-tint ring-1 ring-primary/50"
                      : "opacity-80 hover:opacity-100",
                  )}
                >
                  <PersonAvatar
                    memberId={p.id === "unassigned" ? null : p.id}
                    size="sm"
                  />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{p.name}</TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <span aria-hidden className="hidden h-5 w-px bg-rule sm:block" />

      <FilterMenu
        label="Priority"
        active={filters.priorities.length}
        options={PRIORITIES.map((p) => ({
          value: p,
          label: p,
          color: PRIORITY_TOKENS[p].color,
        }))}
        selected={filters.priorities}
        onToggle={(v) =>
          onFilters({ priorities: toggle(filters.priorities, v as Priority) })
        }
      />

      <FilterMenu
        label="Type"
        active={filters.types.length}
        options={WORK_TYPES.map((t) => ({
          value: t,
          label: t,
          color: TYPE_TOKENS[t].color,
        }))}
        selected={filters.types}
        onToggle={(v) => onFilters({ types: toggle(filters.types, v as WorkType) })}
      />

      {view === "board" && (
        <>
          <span aria-hidden className="hidden h-5 w-px bg-rule lg:block" />
          <Segmented
            ariaLabel="Group by"
            value={groupBy}
            onChange={onGroupBy}
            options={[
              { value: "none", label: "Flat" },
              { value: "assignee", label: "By person" },
            ]}
          />
          <Toggle
            on={showParked}
            onClick={() => onShowParked(!showParked)}
            label="On-hold"
          />
        </>
      )}

      <Toggle
        on={filters.hideCompleted}
        onClick={() => onFilters({ hideCompleted: !filters.hideCompleted })}
        label="Hide done"
      />

      <div className="ml-auto flex items-center gap-2">
        <span className="font-mono text-[10.5px] text-muted-foreground tabular">
          {visible === total ? `${total} items` : `${visible} of ${total}`}
        </span>
        {dirty && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="h-7 gap-1 px-2 font-mono text-[10px] tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground"
          >
            <X className="size-3" />
            Clear
          </Button>
        )}
      </div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] font-medium tracking-[0.1em] uppercase transition-colors",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        on
          ? "border-primary/40 bg-brand-tint text-foreground"
          : "border-rule bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {on && <Check className="size-3" />}
      {label}
    </button>
  );
}

function FilterMenu({
  label,
  options,
  selected,
  onToggle,
  active,
}: {
  label: string;
  options: { value: string; label: string; color: string }[];
  selected: string[];
  onToggle: (v: string) => void;
  active: number;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-8 items-center gap-1.5 rounded-md border px-2.5 font-mono text-[10px] font-medium tracking-[0.1em] uppercase transition-colors",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            active
              ? "border-primary/40 bg-brand-tint text-foreground"
              : "border-rule bg-card text-muted-foreground hover:text-foreground",
          )}
        >
          {label}
          {active > 0 && (
            <span className="rounded-full bg-primary px-1.5 text-[9px] leading-4 text-primary-foreground tabular">
              {active}
            </span>
          )}
          <ChevronDown className="size-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {options.map((o) => (
          <DropdownMenuCheckboxItem
            key={o.value}
            checked={selected.includes(o.value)}
            onCheckedChange={() => onToggle(o.value)}
            onSelect={(e) => e.preventDefault()}
            className="text-[13px]"
          >
            <span className="flex items-center gap-2">
              <i className="dot" style={tone(o.color)} />
              {o.label}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
