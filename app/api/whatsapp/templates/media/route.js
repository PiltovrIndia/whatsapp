import { requireSession } from "@/lib/server/auth";
import { resolveWhatsAppConnection, uploadTemplateSample } from "@/lib/server/whatsapp";
import { readMediaUpload } from "@/lib/server/uploads";
import { handleApiError, jsonOk } from "@/lib/server/http";

// Uploads a sample header file for template review and returns its handle.
export async function POST(request) {
  try {
    const session = await requireSession();
    const upload = await readMediaUpload(request);
    const connection = await resolveWhatsAppConnection(session.organization_id);
    const handle = await uploadTemplateSample({ token: connection.accessToken, ...upload });
    return jsonOk({ ok: true, handle, fileName: upload.fileName });
  } catch (error) {
    return handleApiError(error);
  }
}
