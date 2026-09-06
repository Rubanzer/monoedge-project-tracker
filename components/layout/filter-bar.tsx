"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Columns3, Rows3, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PRIORITY_TOKENS, TYPE_TOKENS } from "@/lib/constants";
import { useMembers } from "@/lib/store";
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
  // Everyone, not just the assignable: work already owned by someone stood
  // down must still be findable.
  const members = useMembers();

  const dirty =
    filters.assigneeIds.length > 0 ||
    filters.priorities.length > 0 ||
    filters.types.length > 0 ||
    filters.hideCompleted ||
    filters.query.trim() !== "";

  const people = [
    ...members.map((m) => ({ id: m.id, name: m.name })),
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
        onSet={(assigneeIds) => onFilters({ assigneeIds })}
        searchable
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
        onSet={(v) => onFilters({ priorities: v as Priority[] })}
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
        onSet={(v) => onFilters({ types: v as WorkType[] })}
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
  onSet,
  searchable,
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
  /** Replaces the whole selection at once, for the select-all row. */
  onSet: (values: string[]) => void;
  /** A search box. Worth it for people, noise for four priorities. */
  searchable?: boolean;
  active: number;
  /** Replaces the count badge when a selection needs richer shorthand. */
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  // Filtered here rather than by cmdk, so the select-all row knows exactly
  // which options it is talking about.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const allShown =
    shown.length > 0 && shown.every((o) => selected.includes(o.value));

  const toggleShown = () => {
    const ids = shown.map((o) => o.value);
    onSet(
      allShown
        ? selected.filter((v) => !ids.includes(v))
        : [...new Set([...selected, ...ids])],
    );
  };

  const bulkLabel = allShown
    ? query
      ? "Clear these"
      : "Clear all"
    : query
      ? `Select these ${shown.length}`
      : "Select all";

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // A stale query would hide most of the list on reopen, with the
        // reason scrolled out of sight in a closed box.
        if (!next) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 gap-0 p-0">
        {/* shouldFilter off: `shown` above is the filter, and it is the
            list the select-all row acts on. */}
        <Command shouldFilter={false}>
          {searchable && (
            <CommandInput
              value={query}
              onValueChange={setQuery}
              placeholder={`Search ${label.toLowerCase()}`}
            />
          )}
          <CommandList className="p-1">
            <CommandEmpty className="px-2 py-3 text-[12.5px] text-muted-foreground">
              No match.
            </CommandEmpty>

            {options.length > 1 && shown.length > 0 && (
              <>
                <CommandGroup>
                  <CommandItem
                    onSelect={toggleShown}
                    className="text-[12.5px] text-muted-foreground"
                  >
                    {bulkLabel}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}

            <CommandGroup>
              {shown.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => onToggle(o.value)}
                  data-checked={selected.includes(o.value)}
                  className="text-[13px]"
                >
                  <span className="flex items-center gap-2">
                    {o.leading ??
                      (o.color ? <i className="dot" style={tone(o.color)} /> : null)}
                    {o.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
