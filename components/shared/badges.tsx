"use client";

import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PRIORITY_TOKENS,
  STATUS_TOKENS,
  TYPE_TOKENS,
} from "@/lib/constants";
import type { Priority, Status, WorkType } from "@/lib/types";
import { tone } from "./tone";

export function StatusChip({
  status,
  className,
}: {
  status: Status;
  className?: string;
}) {
  return (
    <span
      className={cn("chip chip-mono", className)}
      style={tone(STATUS_TOKENS[status].color)}
    >
      <i className="dot" />
      {status}
    </span>
  );
}

export function PriorityChip({
  priority,
  className,
}: {
  priority: Priority;
  className?: string;
}) {
  const critical = priority === "Critical";
  return (
    <span
      className={cn("chip chip-mono", className)}
      style={tone(PRIORITY_TOKENS[priority].color)}
    >
      {critical ? (
        <AlertTriangle className="size-3" strokeWidth={2.5} />
      ) : (
        <i className="dot" />
      )}
      {priority}
    </span>
  );
}

export function TypeChip({
  type,
  short = false,
  className,
}: {
  type: WorkType | null;
  short?: boolean;
  className?: string;
}) {
  if (!type) return null;
  const token = TYPE_TOKENS[type];
  return (
    <span
      className={cn("chip chip-mono", className)}
      style={tone(token.color)}
      title={type}
    >
      {short ? token.short : type}
    </span>
  );
}

/** MON-14. Monospace because it is an identifier, not prose. */
export function WorkItemRef({
  refNumber,
  className,
}: {
  refNumber: number;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "font-mono text-[11px] font-medium tracking-tight text-muted-foreground tabular",
        className,
      )}
    >
      MON-{refNumber}
    </span>
  );
}
