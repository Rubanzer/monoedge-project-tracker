"use client";

import { Check, ChevronDown, Columns3, Rows3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

      {/* Person sits first among the menus: who is on it is the question
          asked most often, and the trigger keeps the selected avatars in
          view so the answer is readable without opening anything. */}
      <FilterMenu
        label="Person"
        active={filters.assigneeIds.length}
        badge={<AvatarStack ids={filters.assigneeIds} />}
        options={people.map((p) => ({
          value: p.id,
          label: p.name,
          leading: (
            <PersonAvatar
              memberId={p.id === "unassigned" ? null : p.id}
              size="sm"
            />
          ),
        }))}
        selected={filters.assigneeIds}
        onToggle={(v) =>
          onFilters({ assigneeIds: toggle(filters.assigneeIds, v) })
        }
      />

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

/**
 * Up to three selected avatars, then a count for the rest. Stands in for the
 * plain number badge on the Person menu so a glance at the closed trigger
 * still says *who*, which is what the old avatar strip was good at.
 */
function AvatarStack({ ids }: { ids: string[] }) {
  const shown = ids.slice(0, 3);
  const rest = ids.length - shown.length;

  return (
    <span className="flex items-center">
      {shown.map((id, i) => (
        <PersonAvatar
          key={id}
          memberId={id === "unassigned" ? null : id}
          size="sm"
          // Overlap all but the first, so four chips still fit the 8px gap.
          className={cn("ring-1 ring-card", i > 0 && "-ml-1.5")}
        />
      ))}
      {rest > 0 && (
        <span className="ml-1 text-[9px] text-muted-foreground tabular">
          +{rest}
        </span>
      )}
    </span>
  );
}

function FilterMenu({
  label,
  options,
  selected,
  onToggle,
  active,
  badge,
}: {
  label: string;
  options: {
    value: string;
    label: string;
    /** Renders the usual colour dot. Ignored when `leading` is given. */
    color?: string;
    /** Replaces the dot, for options that carry their own mark. */
    leading?: React.ReactNode;
  }[];
  selected: string[];
  onToggle: (v: string) => void;
  active: number;
  /** Replaces the count badge when a selection needs richer shorthand. */
  badge?: React.ReactNode;
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
          {active > 0 &&
            (badge ?? (
              <span className="rounded-full bg-primary px-1.5 text-[9px] leading-4 text-primary-foreground tabular">
                {active}
              </span>
            ))}
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
              {o.leading ??
                (o.color ? <i className="dot" style={tone(o.color)} /> : null)}
              {o.label}
            </span>
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
