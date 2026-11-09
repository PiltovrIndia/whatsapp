import crypto from "crypto";
import { after } from "next/server";
import { jsonError, jsonOk } from "@/lib/server/http";
import { processWebhookPayload, verifyWebhookSignature } from "@/lib/server/webhook";
import { nudgeSendQueue } from "@/lib/server/queue-trigger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");
  const expected = process.env.META_WEBHOOK_VERIFY_TOKEN;

  if (mode === "subscribe" && token && expected && safeEqual(token, expected)) {
    return new Response(challenge || "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }

  return jsonError("Webhook verification failed.", 403);
}

export async function POST(request) {
  const rawBody = await request.text();
  const appSecret = process.env.META_APP_SECRET;
  const skipVerification = process.env.WEBHOOK_SKIP_SIGNATURE === "1" && process.env.NODE_ENV !== "production";

  if (!skipVerification) {
    if (!appSecret || /replace/i.test(appSecret)) {
      console.error("Webhook rejected: META_APP_SECRET is not configured.");
      return jsonError("Webhook is not configured.", 503);
    }
    if (!verifyWebhookSignature(rawBody, request.headers.get("x-hub-signature-256"), appSecret)) {
      return jsonError("Invalid signature.", 401);
    }
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonError("Invalid JSON.", 400);
  }

  try {
    await processWebhookPayload(payload);
    // Webhooks arrive often while campaigns run; use them to pick up due
    // retries and scheduled sends without a frequent cron.
    after(() => nudgeSendQueue());
    return jsonOk({ ok: true });
  } catch (error) {
    // A non-2xx response makes Meta retry delivery later.
    console.error("webhook processing failed", error);
    return jsonError("Webhook processing failed.", 500);
  }
}
