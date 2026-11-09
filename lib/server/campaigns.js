import { query } from "@/lib/server/db";

/** Adds per-status recipient counts to each send job. */
export async function attachStats(jobs) {
  if (!jobs.length) return jobs;
  const rows = await query(
    `SELECT send_job_id, status, COUNT(*) AS count
     FROM send_job_recipients WHERE send_job_id IN (:ids)
     GROUP BY send_job_id, status`,
    { ids: jobs.map((job) => job.id) }
  );
  const stats = {};
  for (const row of rows) {
    stats[row.send_job_id] ??= {};
    stats[row.send_job_id][row.status] = Number(row.count);
  }
  return jobs.map((job) => {
    const s = stats[job.id] || {};
    const delivered = (s.delivered || 0) + (s.read || 0);
    return {
      ...job,
      stats: {
        total: job.total_recipients,
        pending: (s.queued || 0) + (s.sending || 0),
        sent: (s.sent || 0) + delivered,
        delivered,
        read: s.read || 0,
        failed: s.failed || 0,
        skipped: s.skipped || 0,
        cancelled: s.cancelled || 0,
      },
    };
  });
}
