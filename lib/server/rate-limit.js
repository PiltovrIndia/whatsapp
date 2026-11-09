import { query } from "@/lib/server/db";
import { httpError } from "@/lib/server/http";

/**
 * Fixed-window rate limiter backed by MySQL so it works across instances.
 * Throws a 429 when `bucket` exceeds `limit` hits within `windowSeconds`.
 */
export async function enforceRateLimit(bucket, { limit, windowSeconds, message }) {
  const params = { bucket: bucket.slice(0, 191), windowSeconds };

  // `hits` is assigned before `window_started_at`, so both read the old window.
  await query(
    `INSERT INTO rate_limits (bucket, hits, window_started_at)
     VALUES (:bucket, 1, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       hits = IF(window_started_at < UTC_TIMESTAMP() - INTERVAL :windowSeconds SECOND, 1, hits + 1),
       window_started_at = IF(window_started_at < UTC_TIMESTAMP() - INTERVAL :windowSeconds SECOND, UTC_TIMESTAMP(), window_started_at)`,
    params
  );

  const [row] = await query("SELECT hits FROM rate_limits WHERE bucket = :bucket", params);
  if (row && row.hits > limit) {
    throw httpError(429, message || "Too many attempts. Please wait a few minutes and try again.");
  }
}

export async function resetRateLimit(bucket) {
  await query("DELETE FROM rate_limits WHERE bucket = :bucket", { bucket: bucket.slice(0, 191) });
}
