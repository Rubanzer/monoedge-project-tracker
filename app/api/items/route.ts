import type { NextRequest } from "next/server";
import {
  createItem,
  loadItems,
  saveOrder,
  SheetError,
} from "@/lib/server/sheet-store";
import type { WorkItem } from "@/lib/types";

// Every request hits Google; nothing here is cacheable, and the Node runtime
// is required because signing the service-account JWT needs node:crypto.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function fail(e: unknown) {
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
    return Response.json(await loadItems());
  } catch (e) {
    return fail(e);
  }
}

export async function POST(request: NextRequest) {
  try {
    const item = (await request.json()) as WorkItem;
    return Response.json(await createItem(item), { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

/** Board order only — used after a drag reorders a column. */
export async function PUT(request: NextRequest) {
  try {
    const { items } = (await request.json()) as { items: WorkItem[] };
    await saveOrder(items ?? []);
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e);
  }
}
