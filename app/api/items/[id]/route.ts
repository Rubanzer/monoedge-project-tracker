import type { NextRequest } from "next/server";
import { removeItem, updateItem } from "@/lib/server/sheet-store";
import { fail } from "../route";
import type { WorkItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    const body = (await request.json()) as {
      patch: Partial<WorkItem>;
      /** When present, the write is refused if the sheet has moved on. */
      expectedUpdatedAt?: string;
    };
    return Response.json(
      await updateItem(id, body.patch ?? {}, body.expectedUpdatedAt),
    );
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const { id } = await params;
    await removeItem(id);
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e);
  }
}
