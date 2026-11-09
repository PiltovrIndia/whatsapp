import crypto from "crypto";
import { requireSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { contactListSchema } from "@/lib/server/validators";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";

export async function GET() {
  try {
    const session = await requireSession();
    const lists = await query(
      `SELECT cl.id, cl.name, cl.created_at,
              COUNT(m.id) AS member_count,
              COALESCE(SUM(c.opt_in = 1), 0) AS opted_in_count
       FROM contact_lists cl
       LEFT JOIN contact_list_members m ON m.contact_list_id = cl.id
       LEFT JOIN contacts c ON c.id = m.contact_id
       WHERE cl.organization_id = :organizationId
       GROUP BY cl.id, cl.name, cl.created_at
       ORDER BY cl.name ASC`,
      { organizationId: session.organization_id }
    );
    return jsonOk({
      lists: lists.map((list) => ({
        ...list,
        member_count: Number(list.member_count),
        opted_in_count: Number(list.opted_in_count),
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSession();
    const { name } = contactListSchema.parse(await request.json());
    const id = crypto.randomUUID();
    try {
      await query(
        "INSERT INTO contact_lists (id, organization_id, name) VALUES (:id, :organizationId, :name)",
        { id, organizationId: session.organization_id, name }
      );
    } catch (error) {
      if (error.code === "ER_DUP_ENTRY") throw httpError(409, "A list with this name already exists.");
      throw error;
    }
    return jsonOk({ ok: true, id }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
