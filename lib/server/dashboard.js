import { query } from "@/lib/server/db";
import { attachStats } from "@/lib/server/campaigns";
import { displayTemplateName } from "@/lib/server/whatsapp-config";

const DAYS = 14;

export async function getDashboard(organizationId) {
  const params = { organizationId };

  const [[contacts], templateRows, [campaignCount], messageRows, recentJobs, [inbound]] = await Promise.all([
    query(
      `SELECT COUNT(*) AS total, COALESCE(SUM(opt_in = 1), 0) AS opted_in, COALESCE(SUM(opt_in = 0), 0) AS opted_out
       FROM contacts WHERE organization_id = :organizationId`,
      params
    ),
    query(
      `SELECT status, COUNT(*) AS count FROM templates
       WHERE organization_id = :organizationId AND status <> 'DELETED' GROUP BY status`,
      params
    ),
    query("SELECT COUNT(*) AS total FROM send_jobs WHERE organization_id = :organizationId AND source = 'campaign'", params),
    query(
      `SELECT DATE(created_at) AS day, status, COUNT(*) AS count
       FROM message_logs
       WHERE organization_id = :organizationId AND direction = 'outbound'
         AND created_at >= UTC_DATE() - INTERVAL ${DAYS - 1} DAY
       GROUP BY DATE(created_at), status`,
      params
    ),
    query(
      `SELECT j.id, j.name, j.status, j.total_recipients, j.created_at, j.scheduled_at, t.name AS template_name
       FROM send_jobs j INNER JOIN templates t ON t.id = j.template_id
       WHERE j.organization_id = :organizationId AND j.source = 'campaign' ORDER BY j.created_at DESC LIMIT 5`,
      params
    ),
    query(
      `SELECT COUNT(*) AS total FROM message_logs
       WHERE organization_id = :organizationId AND direction = 'inbound'
         AND created_at >= UTC_DATE() - INTERVAL ${DAYS - 1} DAY`,
      params
    ),
  ]);

  const templates = Object.fromEntries(templateRows.map((row) => [row.status, Number(row.count)]));
  const days = [];
  for (let offset = DAYS - 1; offset >= 0; offset -= 1) {
    const date = new Date();
    date.setUTCHours(0, 0, 0, 0);
    date.setUTCDate(date.getUTCDate() - offset);
    days.push({ day: date.toISOString().slice(0, 10), sent: 0, delivered: 0, read: 0, failed: 0 });
  }
  const byDay = Object.fromEntries(days.map((entry) => [entry.day, entry]));
  const totals = { sent: 0, delivered: 0, read: 0, failed: 0 };
  for (const row of messageRows) {
    const key = new Date(row.day).toISOString().slice(0, 10);
    const entry = byDay[key];
    const count = Number(row.count);
    const bucket = row.status === "failed" ? "failed" : row.status === "read" ? "read" : row.status === "delivered" ? "delivered" : "sent";
    if (entry) entry[bucket] += count;
    totals[bucket] += count;
  }
  // "sent" counts every accepted message; delivered includes read.
  const accepted = totals.sent + totals.delivered + totals.read;
  const series = days.map((entry) => ({
    day: entry.day,
    messages: entry.sent + entry.delivered + entry.read + entry.failed,
  }));

  return {
    contacts: { total: Number(contacts.total), optedIn: Number(contacts.opted_in), optedOut: Number(contacts.opted_out) },
    templates: {
      approved: templates.APPROVED || 0,
      pending: (templates.PENDING || 0) + (templates.IN_APPEAL || 0),
      rejected: templates.REJECTED || 0,
      total: Object.values(templates).reduce((sum, value) => sum + value, 0),
    },
    campaigns: Number(campaignCount.total),
    messages: {
      total: accepted + totals.failed,
      accepted,
      delivered: totals.delivered + totals.read,
      read: totals.read,
      failed: totals.failed,
      inbound: Number(inbound.total),
      series,
    },
    recentCampaigns: (await attachStats(recentJobs)).map((job) => ({
      ...job,
      template_name: displayTemplateName(organizationId, job.template_name),
    })),
  };
}
