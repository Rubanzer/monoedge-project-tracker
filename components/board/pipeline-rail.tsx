"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ACTIVE_STAGES,
  FLOW,
  STATUS_TOKENS,
  columnForStatus,
} from "@/lib/constants";
import { isOverdue } from "@/lib/dates";
import type { Status, WorkItem } from "@/lib/types";

/**
 * The board's one loud element, and the place the collapsed detail still
 * lives: four columns hide whether work is in review, ready to merge or
 * waiting on a deploy, so the rail breaks all seven stages out by volume.
 * A stage that is backing up gets visibly fatter. Clicking a segment jumps
 * the board to the column that holds it.
 */
export function PipelineRail({ items }: { items: WorkItem[] }) {
  const { segments, total, inFlight, late } = useMemo(() => {
    const counts = new Map<Status, number>();
    FLOW.forEach((s) => counts.set(s, 0));
    items.forEach((i) => {
      if (counts.has(i.status)) counts.set(i.status, counts.get(i.status)! + 1);
    });

    const totalCount = FLOW.reduce((n, s) => n + (counts.get(s) ?? 0), 0);
    return {
      segments: FLOW.map((status) => ({
        status,
        count: counts.get(status) ?? 0,
        share: totalCount ? (counts.get(status) ?? 0) / totalCount : 0,
      })),
      total: totalCount,
      inFlight: items.filter((i) => ACTIVE_STAGES.includes(i.status)).length,
      late: items.filter(isOverdue).length,
    };
  }, [items]);

  const jumpTo = (status: Status) => {
    document
      .querySelector(`[data-column="${columnForStatus(status).id}"]`)
      ?.scrollIntoView({ behavior: "smooth", inline: "start", block: "nearest" });
  };

  return (
    <section
      className="flex items-center gap-4 border-b border-rule bg-card px-4 py-2.5 sm:px-6"
      aria-label="Pipeline distribution"
    >
      <span className="label-mono hidden shrink-0 text-muted-foreground sm:block">
        Pipeline
      </span>

      <div className="flex min-w-0 flex-1 items-stretch gap-[3px]">
        {segments.map(({ status, count, share }) => {
          const token = STATUS_TOKENS[status];
          const wideEnough = share >= 0.07;
          return (
            <Tooltip key={status}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => jumpTo(status)}
                  style={{
                    flexGrow: count + 0.28,
                    flexBasis: 0,
                    background: count
                      ? token.color
                      : "color-mix(in oklab, var(--rule-strong) 60%, transparent)",
                  }}
                  className={cn(
                    "group relative h-6 min-w-[10px] overflow-hidden rounded-[3px] transition-[filter] duration-200",
                    "hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-card focus-visible:outline-none",
                    count === 0 && "opacity-45",
                  )}
                  aria-label={`${status}: ${count} ${count === 1 ? "item" : "items"}`}
                >
                  {wideEnough && count > 0 && (
                    <span className="font-mono text-[10px] font-semibold text-white/95 tabular drop-shadow-sm">
                      {count}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-56">
                <p className="font-medium">
                  {status} · {count}
                </p>
                <p className="text-[11px] opacity-75">
                  In the {columnForStatus(status).label} column
                </p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>

      <div className="hidden shrink-0 items-center gap-3 font-mono text-[11px] text-muted-foreground tabular md:flex">
        <span>
          <b className="font-semibold text-foreground">{total}</b> open
        </span>
        <span aria-hidden className="text-rule-strong">
          /
        </span>
        <span>
          <b className="font-semibold text-foreground">{inFlight}</b> in flight
        </span>
        {late > 0 && (
          <>
            <span aria-hidden className="text-rule-strong">
              /
            </span>
            <span className="font-semibold text-destructive">{late} late</span>
          </>
        )}
      </div>
    </section>
  );
}
