import "server-only";

import { cache } from "react";
import { auth, ALLOWED_DOMAIN } from "@/auth";
import { resolveOrProvision } from "./team-store";
import type { Member, WorkItem } from "@/lib/types";

/**
 * The authorization boundary.
 *
 * proxy.ts redirects signed-out browsers, but that is an optimistic check on
 * a cookie and Next's own guidance is explicit that it must not be the only
 * defence. Everything that touches sheet data goes through here instead, as
 * close to the data as it gets.
 *
 * `cache` memoises per render pass / per request, so a route that asks who is
 * calling three times still costs one resolution.
 */

export class AuthError extends Error {
  constructor(
    message: string,
    readonly status = 401,
    readonly hint?: string,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Who is calling, or a throw. Never returns an inactive member: the caller
 * would have to remember to check, and one forgetful route is a hole.
 */
export const requireMember = cache(async (): Promise<Member> => {
  const session = await auth();
  const email = session?.user?.email?.trim().toLowerCase();

  if (!email) {
    throw new AuthError("You are not signed in.", 401, "Reload and sign in.");
  }

  // Belt and braces. The domain was proven against Google's `hd` claim at
  // sign-in; re-checking here means a session minted before a config change
  // cannot outlive it.
  if (!email.endsWith(`@${ALLOWED_DOMAIN}`)) {
    throw new AuthError(
      `${email} is not a ${ALLOWED_DOMAIN} account.`,
      403,
    );
  }

  const member = await resolveOrProvision(email, session?.user?.name);

  if (member.active === false) {
    throw new AuthError(
      "Your access to the tracker has been turned off.",
      403,
      `Ask an admin to set Active to TRUE on your row in the Team tab.`,
    );
  }

  return member;
});

/** Admins see the whole board. */
export const isAdmin = (member: Member) => member.role === "admin";

/**
 * What a person is allowed to see. A developer gets their own work plus
 * anything unassigned, so a backlog item can still be picked up.
 */
export function visibleTo(member: Member, items: WorkItem[]): WorkItem[] {
  if (isAdmin(member)) return items;
  return items.filter(
    (i) => i.assigneeId === member.id || i.assigneeId === null,
  );
}

/**
 * Whether this person may change this item. Developers own their own rows
 * and may claim unassigned ones; everything else is an admin's call.
 */
export function canEdit(member: Member, item: WorkItem): boolean {
  if (isAdmin(member)) return true;
  return item.assigneeId === member.id || item.assigneeId === null;
}

/** The same rule as a throw, for use inside a write path. */
export function assertCanEdit(member: Member, item: WorkItem): void {
  if (canEdit(member, item)) return;
  throw new AuthError(
    `${item.id} is assigned to someone else.`,
    403,
    "Only an admin, or the person it is assigned to, can change it.",
  );
}
