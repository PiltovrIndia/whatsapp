import { requireRole, requireSession } from "@/lib/server/auth";
import { deleteWebhookEndpoint, getWebhookEndpoint, saveWebhookEndpoint } from "@/lib/server/outbound-webhooks";
import { webhookEndpointSchema } from "@/lib/server/validators";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
import { WEBHOOK_EVENTS } from "@/lib/api-utils";

const MANAGERS = ["owner", "admin"];

export async function GET() {
  try {
    const session = await requireSession();
    requireRole(session, MANAGERS);
    return jsonOk({ endpoint: await getWebhookEndpoint(session.organization_id, { includeSecret: true }), events: WEBHOOK_EVENTS });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request) {
  try {
    const session = await requireSession();
    requireRole(session, MANAGERS);
    const payload = webhookEndpointSchema.parse(await request.json());
    let endpoint;
    try {
      endpoint = await saveWebhookEndpoint(session.organization_id, payload);
    } catch (error) {
      if (!error.status && !error.code) throw httpError(422, error.message);
      throw error;
    }
    await audit(session, "webhook_endpoint.save", { url: endpoint.url, events: endpoint.events, active: endpoint.active, rotated: Boolean(payload.rotateSecret) });
    return jsonOk({ endpoint, events: WEBHOOK_EVENTS });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE() {
  try {
    const session = await requireSession();
    requireRole(session, MANAGERS);
    await deleteWebhookEndpoint(session.organization_id);
    await audit(session, "webhook_endpoint.delete", {});
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
