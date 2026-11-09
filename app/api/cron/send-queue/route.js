import crypto from "crypto";
import { after } from "next/server";
import { jsonError, jsonOk } from "@/lib/server/http";
import { drainSendQueue } from "@/lib/server/queue-trigger";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") || "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);
  return expected.length === received.length && crypto.timingSafeEqual(expected, received);
}

/**
 * Drains the send queue. Called by Vercel Cron, an external scheduler
 * (e.g. cron-job.org), or by the app itself to continue a large campaign.
 * Responds immediately and works in the background, so callers with short
 * HTTP timeouts don't cut the run short.
 */
export async function GET(request) {
  if (!authorized(request)) return jsonError("Unauthorized.", 401);
  const depth = Number.parseInt(request.headers.get("x-queue-chain-depth") || "0", 10) || 0;
  after(() => drainSendQueue({ depth }));
  return jsonOk({ ok: true, accepted: true }, { status: 202 });
}
