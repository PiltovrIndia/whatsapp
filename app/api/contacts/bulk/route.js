import { requireSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { contactBulkSchema } from "@/lib/server/validators";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export async function POST(request) {
  try {
    const session = await requireSession();
    const { action, contactIds, listId } = contactBulkSchema.parse(await request.json());
    const params = { organizationId: session.organization_id, contactIds, listId };
    let affected = 0;

    if (action === "addToList" || action === "removeFromList") {
      if (!listId) throw httpError(422, "Choose a list.");
      const [list] = await query(
        "SELECT id FROM contact_lists WHERE id = :listId AND organization_id = :organizationId",
        params
      );
      if (!list) throw httpError(404, "List not found.");
    }

    if (action === "delete") {
      const result = await query(
        "DELETE FROM contacts WHERE organization_id = :organizationId AND id IN (:contactIds)",
        params
      );
      affected = result.affectedRows;
    } else if (action === "addToList") {
      const result = await query(
        `INSERT IGNORE INTO contact_list_members (id, contact_list_id, contact_id)
         SELECT UUID(), :listId, c.id FROM contacts c
         WHERE c.organization_id = :organizationId AND c.id IN (:contactIds)`,
        params
      );
      affected = result.affectedRows;
    } else if (action === "removeFromList") {
      const result = await query(
        `DELETE m FROM contact_list_members m
         INNER JOIN contacts c ON c.id = m.contact_id
         WHERE m.contact_list_id = :listId AND c.organization_id = :organizationId AND c.id IN (:contactIds)`,
        params
      );
      affected = result.affectedRows;
    } else if (action === "optOut") {
      const result = await query(
        `UPDATE contacts SET opt_in = 0, opted_out_at = COALESCE(opted_out_at, UTC_TIMESTAMP()), opt_out_reason = 'manual'
         WHERE organization_id = :organizationId AND id IN (:contactIds) AND opt_in = 1`,
        params
      );
      affected = result.affectedRows;
    } else if (action === "optIn") {
      const result = await query(
        `UPDATE contacts SET opt_in = 1, opted_out_at = NULL, opt_out_reason = NULL
         WHERE organization_id = :organizationId AND id IN (:contactIds) AND opt_in = 0`,
        params
      );
      affected = result.affectedRows;
    }

    await audit(session, `contacts.bulk.${action}`, { count: contactIds.length, listId: listId || null });
    return jsonOk({ ok: true, affected });
  } catch (error) {
    return handleApiError(error);
  }
}
