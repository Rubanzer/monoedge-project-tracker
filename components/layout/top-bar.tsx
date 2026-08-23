"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import {
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  TriangleAlert,
  X,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { relativeTime } from "@/lib/dates";
import { repository } from "@/lib/repositories";
import type { SyncState } from "@/lib/types";

/** A hard edge cut off one corner — mono, with an edge. */
function Mark() {
  return (
    <svg viewBox="0 0 20 20" className="size-[19px]" aria-hidden>
      <path
        d="M0 4a4 4 0 0 1 4-4h12a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H4a4 4 0 0 1-4-4V4Z"
        fill="var(--brand)"
      />
      <path d="M20 4v9.5L6.5 0H16a4 4 0 0 1 4 4Z" fill="#fff" fillOpacity="0.34" />
    </svg>
  );
}

function SyncPill({
  state,
  lastSyncedAt,
  error,
  onRefresh,
  onClear,
}: {
  state: SyncState;
  lastSyncedAt: string | null;
  error: string | null;
  onRefresh: () => void;
  onClear: () => void;
}) {
  const [, force] = useState(0);
  // Keep the "2m ago" honest without a render loop on every state change.
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  const copy: Record<SyncState, string> = {
    idle: "Not loaded",
    syncing: "Saving…",
    synced: lastSyncedAt ? `Saved ${relativeTime(lastSyncedAt)}` : "Saved",
    error: "Save failed",
  };

  const dot: Record<SyncState, string> = {
    idle: "bg-muted-foreground/50",
    syncing: "bg-amber-500 animate-pulse",
    synced: "bg-primary",
    error: "bg-destructive",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "group flex h-8 items-center gap-2 rounded-full border border-rule bg-card pr-2.5 pl-3 transition-colors hover:border-rule-strong",
            "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          )}
        >
          <span className={cn("size-1.5 rounded-full", dot[state])} />
          <span className="font-mono text-[10.5px] tracking-tight text-muted-foreground">
            {repository.label} · {copy[state]}
          </span>
          <RefreshCw className="size-3 text-muted-foreground/60 transition-transform group-hover:rotate-90" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-[11px] leading-relaxed font-normal text-muted-foreground">
          {repository.remote
            ? "Reading and writing the Google Sheet. Changes appear for everyone within about half a minute."
            : "Work items are kept in this browser only. Connect the sheet to share them with the team."}
        </DropdownMenuLabel>

        {error && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex gap-1.5 text-[11px] leading-relaxed font-normal text-destructive">
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              <span>{error}</span>
            </DropdownMenuLabel>
          </>
        )}

        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-[13px]" onSelect={onRefresh}>
          <RefreshCw className="size-3.5" />
          Reload
        </DropdownMenuItem>

        {/* Clearing a shared sheet from a menu is not a thing anyone should
            be one misclick away from, so it is local-draft only. */}
        {!repository.remote && (
          <DropdownMenuItem
            className="text-[13px] text-destructive focus:text-destructive"
            onSelect={onClear}
          >
            <Trash2 className="size-3.5" />
            Clear board
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      variant="ghost"
      size="icon"
      className="size-8 text-muted-foreground"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Switch between light and dark"
    >
      {/* Both icons render; the dark class picks one. Avoids the usual
          mounted-flag dance and the hydration flash that comes with it. */}
      <Moon className="size-4 dark:hidden" />
      <Sun className="hidden size-4 dark:block" />
    </Button>
  );
}

export function TopBar({
  query,
  onQuery,
  sync,
  lastSyncedAt,
  error,
  onRefresh,
  onClear,
  onNew,
}: {
  query: string;
  onQuery: (v: string) => void;
  sync: SyncState;
  lastSyncedAt: string | null;
  error: string | null;
  onRefresh: () => void;
  onClear: () => void;
  onNew: () => void;
}) {
  // "/" focuses search, the way every tool this team already uses behaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      const typing =
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el as HTMLElement | null)?.isContentEditable;
      if (e.key === "/" && !typing) {
        e.preventDefault();
        document.getElementById("board-search")?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-rule bg-card px-4 sm:px-6">
      <div className="flex shrink-0 items-center gap-2">
        <Mark />
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-semibold tracking-[-0.015em]">
            Monoedge
          </span>
          <span className="label-mono hidden text-muted-foreground sm:inline">
            Tracker
          </span>
        </div>
      </div>

      <div className="relative ml-2 hidden min-w-0 max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="board-search"
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search tasks, descriptions, MON-14"
          className="h-8 bg-background pr-8 pl-8 text-[13px]"
        />
        {query ? (
          <button
            type="button"
            onClick={() => onQuery("")}
            className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="size-3.5" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-rule px-1 font-mono text-[10px] text-muted-foreground">
            /
          </kbd>
        )}
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        <div className="hidden lg:block">
          <SyncPill
            state={sync}
            lastSyncedAt={lastSyncedAt}
            error={error}
            onRefresh={onRefresh}
            onClear={onClear}
          />
        </div>
        <ThemeToggle />
        <Button size="sm" className="h-8 gap-1.5 pr-3 pl-2.5" onClick={onNew}>
          <Plus className="size-3.5" />
          New item
        </Button>
      </div>
    </header>
  );
}
