import { requireSession } from "@/lib/server/auth";
import { resolveWhatsAppConnection, uploadMessageMedia } from "@/lib/server/whatsapp";
import { readMediaUpload } from "@/lib/server/uploads";
import { handleApiError, jsonOk } from "@/lib/server/http";

// Uploads a header file for a campaign; Meta keeps it for 30 days.
export async function POST(request) {
  try {
    const session = await requireSession();
    const upload = await readMediaUpload(request);
    const connection = await resolveWhatsAppConnection(session.organization_id);
    const result = await uploadMessageMedia({ phoneNumberId: connection.phoneNumberId, token: connection.accessToken, ...upload });
    return jsonOk({ ok: true, id: result.id, fileName: upload.fileName });
  } catch (error) {
    return handleApiError(error);
  }
}
