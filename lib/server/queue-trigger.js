import { hasDueWork, kickSendQueue } from "@/lib/server/send-queue";

// Every Vercel plan allows 60s functions. Stop claiming work well before that
// so claimed recipients finish cleanly.
export const QUEUE_TIME_BUDGET_MS = Number(process.env.QUEUE_TIME_BUDGET_MS || 45_000);
const MAX_CHAIN_DEPTH = Number(process.env.QUEUE_MAX_CHAIN_DEPTH || 500);

export function isServerless() {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

/** Public base URL of this deployment, used to call our own queue endpoint. */
export function appBaseUrl() {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return host ? `https://${host}` : null;
}

/**
 * Asks a fresh function invocation to keep draining. Serverless functions
 * have a hard time limit, so a large campaign is sent as a chain of short
 * runs instead of one long one.
 */
export async function triggerQueueContinuation(depth = 0) {
  const secret = process.env.CRON_SECRET;
  const base = appBaseUrl();
  if (!secret || !base || depth >= MAX_CHAIN_DEPTH) {
    if (depth >= MAX_CHAIN_DEPTH) console.warn("send queue chain depth limit reached");
    return false;
  }
  try {
    const response = await fetch(`${base}/api/cron/send-queue`, {
      headers: { authorization: `Bearer ${secret}`, "x-queue-chain-depth": String(depth + 1) },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) console.error("send queue continuation failed:", response.status);
    return response.ok;
  } catch (error) {
    console.error("send queue continuation failed:", error.message);
    return false;
  }
}

/** Drains for one time budget, then hands off to a new invocation if work remains. */
export async function drainSendQueue({ depth = 0 } = {}) {
  try {
    await kickSendQueue({ timeBudgetMs: QUEUE_TIME_BUDGET_MS });
    if (isServerless() && (await hasDueWork())) await triggerQueueContinuation(depth);
  } catch (error) {
    console.error("send queue drain failed", error);
  }
}

/** Cheap opportunistic nudge (webhooks, page polls): drain only if something is due. */
export async function nudgeSendQueue() {
  try {
    if (await hasDueWork()) await drainSendQueue();
  } catch (error) {
    console.error("send queue nudge failed", error.message);
  }
}
