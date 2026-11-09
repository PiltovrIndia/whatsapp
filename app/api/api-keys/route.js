import { requireRole, requireSession } from "@/lib/server/auth";
import { createApiKey, listApiKeys } from "@/lib/server/api-keys";
import { apiKeyCreateSchema } from "@/lib/server/validators";
import { handleApiError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

const MANAGERS = ["owner", "admin"];

export async function GET() {
  try {
    const session = await requireSession();
    requireRole(session, MANAGERS);
    return jsonOk({ keys: await listApiKeys(session.organization_id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSession();
    requireRole(session, MANAGERS);
    const { name } = apiKeyCreateSchema.parse(await request.json());
    const created = await createApiKey(session, name);
    await audit(session, "api_key.create", { keyId: created.id, name, prefix: created.prefix });
    // The plaintext key is returned only here; it can't be retrieved later.
    return jsonOk({ ok: true, ...created }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
