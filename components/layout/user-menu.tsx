"use client";

import { LogOut } from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Who you are signed in as, and the way out.
 *
 * Deliberately shows the address rather than just the name: on a tool where
 * what you can see depends on which account you are in, "signed in as
 * someone" is the thing worth being unambiguous about.
 *
 * The session comes from the server through SessionProvider, so this does not
 * cost a request on load.
 */
export function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <Skeleton className="size-8 rounded-full" />;
  }

  const user = session?.user;
  if (!user?.email) return null;

  const name = user.name?.trim() || user.email.split("@")[0];
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Signed in as ${user.email}`}
          className="flex size-8 items-center justify-center rounded-full bg-primary font-mono text-[10px] font-semibold text-primary-foreground ring-1 ring-black/5 transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {initials}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block text-[13px] text-foreground">{name}</span>
          <span className="block truncate font-mono text-[11px] text-muted-foreground">
            {user.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-[13px]"
          onSelect={() => void signOut({ redirectTo: "/sign-in" })}
        >
          <LogOut className="size-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
