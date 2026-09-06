import type { NextRequest } from "next/server";
import { removeItem, updateItem } from "@/lib/server/sheet-store";
import {
  AuthError,
  assertCanEdit,
  isAdmin,
  requireMember,
} from "@/lib/server/session";
import { fail } from "../route";
import type { WorkItem } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Ctx) {
  try {
    const member = await requireMember();
    const { id } = await params;
    const body = (await request.json()) as {
      patch: Partial<WorkItem>;
      /** When present, the write is refused if the sheet has moved on. */
      expectedUpdatedAt?: string;
    };
    const patch = body.patch ?? {};

    // Reassigning work away from yourself is a scheduling call, so it stays
    // with admins even on a row you are otherwise allowed to edit.
    if (
      !isAdmin(member) &&
      patch.assigneeId !== undefined &&
      patch.assigneeId !== member.id
    ) {
      throw new AuthError(
        "You cannot reassign work to someone else.",
        403,
        "An admin can move it.",
      );
    }

    return Response.json(
      await updateItem(id, patch, body.expectedUpdatedAt, (current) =>
        assertCanEdit(member, current),
      ),
    );
  } catch (e) {
    return fail(e);
  }
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  try {
    const member = await requireMember();
    const { id } = await params;
    await removeItem(id, (current) => assertCanEdit(member, current));
    return new Response(null, { status: 204 });
  } catch (e) {
    return fail(e);
  }
}
