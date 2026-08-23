"use client";

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  ALL_COLUMNS,
  PRIORITY_TOKENS,
  STATUS_TOKENS,
  TEAM,
  TYPE_TOKENS,
} from "@/lib/constants";
import { PRIORITIES, WORK_TYPES } from "@/lib/types";
import type { Priority, Status, WorkType } from "@/lib/types";
import { PersonAvatar } from "@/components/shared/person-avatar";
import { tone } from "@/components/shared/tone";

const UNASSIGNED = "__unassigned__";
const NO_TYPE = "__none__";

const triggerClass =
  "h-9 w-full border-input bg-card text-[13px] data-[placeholder]:text-muted-foreground";

/** A labelled row. Labels are mono so a field name never reads as content. */
export function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-mono text-muted-foreground">{label}</span>
        {hint && (
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {hint}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

export function StatusSelect({
  value,
  onChange,
}: {
  value: Status;
  onChange: (v: Status) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Status)}>
      <SelectTrigger className={triggerClass} aria-label="Status">
        <SelectValue />
      </SelectTrigger>
      {/* Grouped by board column, so it is obvious which column a status
          will land the card in. */}
      <SelectContent>
        {ALL_COLUMNS.map((column) => (
          <SelectGroup key={column.id}>
            <SelectLabel className="label-mono text-muted-foreground">
              {column.label}
            </SelectLabel>
            {column.statuses.map((s) => (
              <SelectItem key={s} value={s} className="text-[13px]">
                <span className="flex items-center gap-2">
                  <i className="dot" style={tone(STATUS_TOKENS[s].color)} />
                  {s}
                </span>
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

export function PrioritySelect({
  value,
  onChange,
}: {
  value: Priority;
  onChange: (v: Priority) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Priority)}>
      <SelectTrigger className={triggerClass} aria-label="Priority">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {PRIORITIES.map((p) => (
          <SelectItem key={p} value={p} className="text-[13px]">
            <span className="flex items-center gap-2">
              <i className="dot" style={tone(PRIORITY_TOKENS[p].color)} />
              {p}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function TypeSelect({
  value,
  onChange,
}: {
  value: WorkType | null;
  onChange: (v: WorkType | null) => void;
}) {
  return (
    <Select
      value={value ?? NO_TYPE}
      onValueChange={(v) => onChange(v === NO_TYPE ? null : (v as WorkType))}
    >
      <SelectTrigger className={triggerClass} aria-label="Functionality or bug">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TYPE} className="text-[13px] text-muted-foreground">
          Not categorised
        </SelectItem>
        {WORK_TYPES.map((t) => (
          <SelectItem key={t} value={t} className="text-[13px]">
            <span className="flex items-center gap-2">
              <i className="dot" style={tone(TYPE_TOKENS[t].color)} />
              {t}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function AssigneeSelect({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <Select
      value={value ?? UNASSIGNED}
      onValueChange={(v) => onChange(v === UNASSIGNED ? null : v)}
    >
      <SelectTrigger className={triggerClass} aria-label="Primary person">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          value={UNASSIGNED}
          className="text-[13px] text-muted-foreground"
        >
          <span className="flex items-center gap-2">
            <PersonAvatar memberId={null} size="sm" />
            Unassigned
          </span>
        </SelectItem>
        {TEAM.map((m) => (
          <SelectItem key={m.id} value={m.id} className="text-[13px]">
            <span className="flex items-center gap-2">
              <PersonAvatar memberId={m.id} size="sm" />
              {m.name}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function DateField({
  value,
  onChange,
  label,
  readOnlyHint,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  label: string;
  readOnlyHint?: string;
}) {
  return (
    <Field label={label} hint={readOnlyHint}>
      <input
        type="date"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        aria-label={label}
        className={cn(
          "h-9 w-full rounded-md border border-input bg-card px-2.5 font-mono text-[12.5px] tabular",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          !value && "text-muted-foreground",
        )}
      />
    </Field>
  );
}
