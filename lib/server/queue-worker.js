import { hasDatabaseConfig } from "@/lib/server/db";
import { drainSendQueue, hasPendingWork } from "@/lib/server/queue-trigger";

const POLL_MS = Number(process.env.QUEUE_POLL_INTERVAL_MS || 5000);

export function startQueueWorker() {
  if (globalThis.__engageQueueWorker || !hasDatabaseConfig()) return;

  let warned = false;
  globalThis.__engageQueueWorker = setInterval(async () => {
    try {
      if (await hasPendingWork()) await drainSendQueue();
      warned = false;
    } catch (error) {
      if (!warned) console.error("queue worker poll failed:", error.message);
      warned = true;
    }
  }, POLL_MS);
  globalThis.__engageQueueWorker.unref?.();
}
