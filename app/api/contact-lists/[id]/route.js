import { requireSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { contactListSchema } from "@/lib/server/validators";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export async function PATCH(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const { name } = contactListSchema.parse(await request.json());
    try {
      const result = await query(
        "UPDATE contact_lists SET name = :name WHERE id = :id AND organization_id = :organizationId",
        { id, name, organizationId: session.organization_id }
      );
      if (!result.affectedRows) throw httpError(404, "List not found.");
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") throw httpError(409, "A list with this name already exists.");
      throw error;
    }
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}

// Deleting a list removes memberships only; contacts are kept.
export async function DELETE(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const result = await query(
      "DELETE FROM contact_lists WHERE id = :id AND organization_id = :organizationId",
      { id, organizationId: session.organization_id }
    );
    if (!result.affectedRows) throw httpError(404, "List not found.");
    await audit(session, "contact_list.delete", { listId: id });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
