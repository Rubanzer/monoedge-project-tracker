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

/**
 * The MonoEdge symbol, from the brand assets. The two strokes take
 * `currentColor` so the mark inverts with the theme the way the black and
 * white lockups do; the descending wings keep the MonoEdge Blue → Ice Blue
 * gradient, which is the one place the gradient is allowed to appear.
 *
 * The second gradient is the first mirrored about the artboard centre
 * (x' = 410.4 − x) rather than the source file's rotate-and-translate, which
 * is the same geometry written in a way a human can check.
 */
function Mark() {
  return (
    <svg
      viewBox="0 0 410.4 288"
      className="h-[19px] w-auto text-foreground"
      role="img"
      aria-label="MonoEdge Systems"
    >
      <defs>
        <linearGradient
          id="me-wing-right"
          x1="370.12"
          y1="108.33"
          x2="295.97"
          y2="244.19"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.03" stopColor="#204494" />
          <stop offset="0.41" stopColor="#3256a1" />
          <stop offset="0.84" stopColor="#698dc9" />
          <stop offset="1" stopColor="#85a9dd" />
        </linearGradient>
        <linearGradient
          id="me-wing-left"
          x1="40.28"
          y1="108.33"
          x2="114.43"
          y2="244.19"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0.03" stopColor="#204494" />
          <stop offset="0.41" stopColor="#3256a1" />
          <stop offset="0.84" stopColor="#698dc9" />
          <stop offset="1" stopColor="#85a9dd" />
        </linearGradient>
      </defs>
      <path
        fill="currentColor"
        d="M97.36,35.83h-53.81v49.15c34.26,34.26,67.05,67.05,101.31,101.31,17.94-17.94,33.32-33.77,51.25-51.71-34.26-34.26-64.49-64.49-98.76-98.76Z"
      />
      <polygon
        fill="currentColor"
        points="314.16 35.83 151.59 198.18 151.59 251.99 201.28 252.18 366.85 86.63 366.85 35.82 314.16 35.83"
      />
      <path
        fill="url(#me-wing-right)"
        d="M366.85,106.54c-31.41,31.39-62.82,62.46-94.23,93.85v50.63s28.63,0,28.63,0c16.19,0,31.72-6.46,43.13-17.96,1.61-1.62,3.23-3.25,4.83-4.87,11.3-11.38,17.63-26.77,17.63-42.8v-78.85Z"
      />
      <path
        fill="url(#me-wing-left)"
        d="M43.55,106.54c31.41,31.39,62.82,62.46,94.23,93.85v50.63s-28.63,0-28.63,0c-16.19,0-31.72-6.46-43.13-17.96-1.61-1.62-3.23-3.25-4.83-4.87-11.3-11.38-17.63-26.77-17.63-42.8v-78.85Z"
      />
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
      <div className="flex shrink-0 items-center gap-2.5">
        <Mark />
        <div className="flex items-baseline gap-2">
          <span className="display-mark text-[13px] leading-none">
            MonoEdge
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
