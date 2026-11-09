import { requireRole, requireSession } from "@/lib/server/auth";
import { listDeliveries } from "@/lib/server/outbound-webhooks";
import { handleApiError, jsonOk } from "@/lib/server/http";

export async function GET() {
  try {
    const session = await requireSession();
    requireRole(session, ["owner", "admin"]);
    return jsonOk({ deliveries: await listDeliveries(session.organization_id, 50) });
  } catch (error) {
    return handleApiError(error);
  }
}
