import { after } from "next/server";
import { requireSession } from "@/lib/server/auth";
import { parseJson, query } from "@/lib/server/db";
import { ACTIVE_JOB_STATUSES, createCampaign } from "@/lib/server/send-queue";
import { drainSendQueue } from "@/lib/server/queue-trigger";
import { getTemplate, TEMPLATE_WRONG_ACCOUNT } from "@/lib/server/templates";
import { activeWabaId, resolveWhatsAppConnection } from "@/lib/server/whatsapp";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export const maxDuration = 60;

/**
 * Re-sends a campaign to the recipients whose messages failed, as a new
 * campaign with the same template, variables and header media. Opted-out
 * contacts are excluded by createCampaign.
 */
export async function POST(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;

    const [job] = await query(
      `SELECT id, name, status, source, template_id, variables_json, header_media_json
       FROM send_jobs WHERE id = :id AND organization_id = :organizationId`,
      { id, organizationId: session.organization_id }
    );
    if (!job) throw httpError(404, "Campaign not found.");
    if (job.source === "api") throw httpError(409, "API messages are resent from your own system with POST /api/v1/messages.");
    if (ACTIVE_JOB_STATUSES.includes(job.status)) {
      throw httpError(409, "This campaign is still sending. Wait for it to finish before resending.");
    }

    const failed = await query(
      `SELECT DISTINCT contact_id FROM send_job_recipients
       WHERE send_job_id = :id AND status = 'failed' AND contact_id IS NOT NULL`,
      { id }
    );
    if (!failed.length) throw httpError(422, "No failed messages to resend.");

    const template = await getTemplate(session.organization_id, job.template_id);
    if (!template || template.status === "DELETED") throw httpError(409, "This campaign's template was deleted.");
    if (template.status !== "APPROVED") {
      throw httpError(409, `This campaign's template is now ${template.status.toLowerCase()}. Only approved templates can be sent.`);
    }
    if (template.waba_id !== await activeWabaId(session.organization_id)) {
      throw httpError(409, `${TEMPLATE_WRONG_ACCOUNT} Start a new campaign with one of the current number's templates.`);
    }

    // Fail fast if messaging is not configured, before queueing anything.
    await resolveWhatsAppConnection(session.organization_id);

    const baseName = String(job.name || "Campaign").replace(/ \(resend\)$/, "");
    const result = await createCampaign({
      session,
      template,
      audience: { type: "contacts", contactIds: failed.map((row) => row.contact_id) },
      variables: parseJson(job.variables_json, {}),
      headerMedia: parseJson(job.header_media_json, null),
      name: `${baseName} (resend)`.slice(0, 255),
    });

    if (result.recipients === 0) {
      throw httpError(422, "All failed recipients have since opted out or been deleted.");
    }

    await audit(session, "campaign.resend", { fromJobId: id, jobId: result.jobId, recipients: result.recipients });
    after(() => drainSendQueue());

    return jsonOk({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
