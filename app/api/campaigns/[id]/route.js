import { after } from "next/server";
import { requireSession } from "@/lib/server/auth";
import { nudgeSendQueue } from "@/lib/server/queue-trigger";
import { query, safeInt } from "@/lib/server/db";
import { displayTemplateName } from "@/lib/server/whatsapp-config";
import { attachStats } from "@/lib/server/campaigns";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";

export const maxDuration = 60;

const STATUS_FILTERS = ["queued", "sending", "sent", "delivered", "read", "failed", "skipped", "cancelled"];

export async function GET(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const url = new URL(request.url);
    const page = safeInt(url.searchParams.get("page"), { min: 1, fallback: 1 });
    const pageSize = safeInt(url.searchParams.get("pageSize"), { min: 1, max: 200, fallback: 50 });
    const status = STATUS_FILTERS.includes(url.searchParams.get("status")) ? url.searchParams.get("status") : null;

    const [job] = await query(
      `SELECT j.*, t.name AS template_name, t.language, t.components_json, u.full_name AS created_by_name
       FROM send_jobs j
       INNER JOIN templates t ON t.id = j.template_id
       LEFT JOIN users u ON u.id = j.created_by
       WHERE j.id = :id AND j.organization_id = :organizationId`,
      { id, organizationId: session.organization_id }
    );
    if (!job) throw httpError(404, "Campaign not found.");
    // The campaign page polls while sending; keep the queue moving.
    if (["queued", "running", "scheduled"].includes(job.status)) after(() => nudgeSendQueue());

    const filter = status ? "AND r.status = :status" : "";
    const recipients = await query(
      `SELECT r.id, r.status, r.phone, r.error_code, r.error_message, r.attempts,
              r.sent_at, r.delivered_at, r.read_at, r.failed_at, r.updated_at,
              c.first_name, c.last_name
       FROM send_job_recipients r
       LEFT JOIN contacts c ON c.id = r.contact_id
       WHERE r.send_job_id = :id ${filter}
       ORDER BY r.updated_at DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      { id, status }
    );
    const [{ total }] = await query(
      `SELECT COUNT(*) AS total FROM send_job_recipients r WHERE r.send_job_id = :id ${filter}`,
      { id, status }
    );

    const [withStats] = await attachStats([job]);
    return jsonOk({
      campaign: { ...withStats, template_name: displayTemplateName(session.organization_id, job.template_name) },
      recipients,
      total: Number(total),
      page,
      pageSize,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
