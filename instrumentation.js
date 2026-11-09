// Starts the in-process send-queue worker when the Node.js server boots.
// Set DISABLE_QUEUE_WORKER=1 on serverless platforms and call
// GET /api/cron/send-queue from a scheduler instead.
export async function register() {
  // Keep the import inside this check: NEXT_RUNTIME is inlined at build time,
  // which lets the edge bundle drop the Node-only worker code.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startQueueWorker } = await import("./lib/server/queue-worker");
    // Serverless hosts have no long-running process; sending is driven by
    // lib/server/queue-trigger.js there instead.
    const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    if (!serverless && process.env.DISABLE_QUEUE_WORKER !== "1") startQueueWorker();
  }
}
