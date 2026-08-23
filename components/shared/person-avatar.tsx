"use client";

import { cn } from "@/lib/utils";
import { memberById } from "@/lib/constants";

const SIZES = {
  sm: "size-5 text-[9px]",
  md: "size-6 text-[10px]",
  lg: "size-9 text-xs",
} as const;

export function PersonAvatar({
  memberId,
  size = "md",
  className,
}: {
  memberId: string | null;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  const member = memberById(memberId);

  if (!member) {
    return (
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full border border-dashed border-rule-strong font-mono font-medium text-muted-foreground",
          SIZES[size],
          className,
        )}
        aria-label="Unassigned"
        title="Unassigned"
      >
        ?
      </span>
    );
  }

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full font-mono font-semibold text-white ring-1 ring-black/5",
        SIZES[size],
        className,
      )}
      style={{ background: member.color }}
      aria-label={member.name}
      title={member.name}
    >
      {member.initials}
    </span>
  );
}
