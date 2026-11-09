import { requireRole, requireSession } from "@/lib/server/auth";
import { revokeApiKey } from "@/lib/server/api-keys";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export async function DELETE(request, { params }) {
  try {
    const session = await requireSession();
    requireRole(session, ["owner", "admin"]);
    const { id } = await params;
    if (!(await revokeApiKey(session.organization_id, id))) throw httpError(404, "Key not found or already revoked.");
    await audit(session, "api_key.revoke", { keyId: id });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
