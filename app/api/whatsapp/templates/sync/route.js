import { requireSession } from "@/lib/server/auth";
import { resolveWhatsAppConnection } from "@/lib/server/whatsapp";
import { syncTemplates } from "@/lib/server/templates";
import { handleApiError, jsonOk } from "@/lib/server/http";

export async function POST() {
  try {
    const session = await requireSession();
    const connection = await resolveWhatsAppConnection(session.organization_id);
    const synced = await syncTemplates(session.organization_id, connection);
    return jsonOk({ ok: true, synced });
  } catch (error) {
    return handleApiError(error);
  }
}
