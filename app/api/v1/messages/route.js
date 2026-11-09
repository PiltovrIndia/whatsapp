import { after, NextResponse } from "next/server";
import { withApiKey } from "@/lib/server/api-keys";
import { apiSendSchema } from "@/lib/server/validators";
import { enqueueApiMessages, findApiTemplate, listApiMessages } from "@/lib/server/api-messages";
import { resolveWhatsAppConnection } from "@/lib/server/whatsapp";
import { drainSendQueue } from "@/lib/server/queue-trigger";
import { httpError } from "@/lib/server/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/v1/messages — queue one message (`to`) or a batch (`messages`)
 * using an approved template. Returns 202 with a per-message result.
 */
export const POST = withApiKey(async (request, context, apiSession) => {
  const payload = apiSendSchema.parse(await request.json());
  const idempotencyKey = request.headers.get("idempotency-key")?.trim() || null;
  if (idempotencyKey && idempotencyKey.length > 128) {
    throw httpError(422, "Idempotency-Key must be at most 128 characters.", { code: "invalid_request" });
  }

  const template = await findApiTemplate(apiSession.organization_id, payload.template, payload.language);
  try {
    await resolveWhatsAppConnection(apiSession.organization_id);
  } catch (error) {
    throw httpError(503, "WhatsApp isn't connected for this workspace yet.", { code: "not_connected", cause: error.message });
  }

  const items = payload.messages || [{ to: payload.to, variables: payload.variables, reference: payload.reference }];
  const result = await enqueueApiMessages({
    apiSession,
    template,
    items,
    headerMedia: payload.header_media || null,
    idempotencyKey,
  });

  if (!result.replayed) after(() => drainSendQueue());
  return NextResponse.json(result, { status: result.replayed ? 200 : 202 });
});

/** GET /api/v1/messages?reference=…|batch_id=… — look up messages you sent. */
export const GET = withApiKey(async (request, context, apiSession) => {
  const url = new URL(request.url);
  const reference = url.searchParams.get("reference") || undefined;
  const batchId = url.searchParams.get("batch_id") || undefined;
  if (!reference && !batchId) {
    throw httpError(422, "Filter by `reference` or `batch_id`, or fetch one message with GET /api/v1/messages/{id}.", { code: "invalid_request" });
  }
  const data = await listApiMessages(apiSession.organization_id, {
    reference,
    batchId,
    limit: url.searchParams.get("limit") || 100,
  });
  return NextResponse.json({ data });
});
