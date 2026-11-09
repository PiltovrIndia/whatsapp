import { requireSession } from "@/lib/server/auth";
import { parseJson, query } from "@/lib/server/db";
import { handleApiError, jsonOk } from "@/lib/server/http";

export async function GET() {
  try {
    const session = await requireSession();
    const events = await query(
      `SELECT a.id, a.action, a.metadata_json AS metadata, a.created_at, u.full_name, u.email
       FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
       WHERE a.organization_id = :organizationId
       ORDER BY a.created_at DESC LIMIT 50`,
      { organizationId: session.organization_id }
    );
    return jsonOk({ events: events.map((event) => ({ ...event, metadata: parseJson(event.metadata, {}) })) });
  } catch (error) {
    return handleApiError(error);
  }
}
