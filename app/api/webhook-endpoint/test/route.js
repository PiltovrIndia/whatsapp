import { requireRole, requireSession } from "@/lib/server/auth";
import { sendTestEvent } from "@/lib/server/outbound-webhooks";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";

export const maxDuration = 30;

export async function POST() {
  try {
    const session = await requireSession();
    requireRole(session, ["owner", "admin"]);
    const result = await sendTestEvent(session.organization_id);
    if (!result) throw httpError(404, "Save a webhook URL first.");
    return jsonOk(result);
  } catch (error) {
    return handleApiError(error);
  }
}
