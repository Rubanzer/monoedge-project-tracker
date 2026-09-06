import type { NextRequest } from "next/server";
import {
  createItem,
  loadItems,
  saveOrder,
  SheetError,
} from "@/lib/server/sheet-store";
import { AuthError, isAdmin, requireMember, visibleTo } from "@/lib/server/session";
import type { WorkItem } from "@/lib/types";

// Every request hits Google; nothing here is cacheable, and the Node runtime
// is required because signing the service-account JWT needs node:crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function fail(e: unknown) {
  // Checked before SheetError so a refusal reads as a refusal rather than as
  // a spreadsheet problem.
  if (e instanceof AuthError) {
    return Response.json(
      { error: e.message, hint: e.hint },
      { status: e.status },
    );
  }
  if (e instanceof SheetError) {
    return Response.json(
      { error: e.message, hint: e.hint },
      { status: e.status },
    );
  }
  console.error("[tracker] unexpected", e);
  return Response.json(
    { error: e instanceof Error ? e.message : "Something went wrong" },
    { status: 500 },
  );
}

export async function GET() {
  try {
    const member = await requireMember();
    const result = await loadItems();
    // Filtered here, on the server. The board's own filters are a
    // convenience; this is the boundary.
    return Response.json({
      ...result,
      items: visibleTo(member, result.items),
    });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const member = await requireMember();
    const item = (await request.json()) as WorkItem;

    // A developer may raise work for themselves or leave it unclaimed;
    // handing it to someone else is a scheduling decision.
    if (!isAdmin(member) && item.assigneeId && item.assigneeId !== member.id) {
      throw new AuthError(
        "You can only create work assigned to yourself.",
        403,
        "Leave it unassigned, or ask an admin to assign it.",
      );
    }

    return Response.json(await createItem(item), { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

/** Board order only — used after a drag reorders a column. */
export async function PUT(request: NextRequest) {
  try {
    await requireMember();
    const { items } = (await request.json()) as { items: WorkItem[] };
    await saveOrder(items ?? []);
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e);
  }
}
