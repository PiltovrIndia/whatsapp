import { after } from "next/server";
import { requireSession } from "@/lib/server/auth";
import { parseJson, query, safeInt } from "@/lib/server/db";
import { campaignSchema } from "@/lib/server/validators";
import { createCampaign } from "@/lib/server/send-queue";
import { drainSendQueue, nudgeSendQueue } from "@/lib/server/queue-trigger";
import { getTemplate } from "@/lib/server/templates";
import { activeWabaId } from "@/lib/server/whatsapp";
import { resolveWhatsAppConnection } from "@/lib/server/whatsapp";
import { displayTemplateName } from "@/lib/server/whatsapp-config";
import {
  headerMediaFormat,
  templateVariableSlots,
  unsupportedSendFeatures,
} from "@/lib/message-payload";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { attachStats } from "@/lib/server/campaigns";
import { audit } from "@/lib/server/audit";


// Sending starts right after the response; large campaigns continue in
// chained invocations (see lib/server/queue-trigger.js).
export const maxDuration = 60;

export async function GET(request) {
  try {
    const session = await requireSession();
    const url = new URL(request.url);
    const page = safeInt(url.searchParams.get("page"), { min: 1, fallback: 1 });
    const pageSize = safeInt(url.searchParams.get("pageSize"), { min: 1, max: 100, fallback: 20 });

    const jobs = await query(
      `SELECT j.id, j.name, j.status, j.total_recipients, j.scheduled_at, j.started_at, j.completed_at,
              j.created_at, t.name AS template_name, t.language, u.full_name AS created_by_name
       FROM send_jobs j
       INNER JOIN templates t ON t.id = j.template_id
       LEFT JOIN users u ON u.id = j.created_by
       WHERE j.organization_id = :organizationId AND j.source = 'campaign'
       ORDER BY j.created_at DESC
       LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}`,
      { organizationId: session.organization_id }
    );
    const [{ total }] = await query(
      "SELECT COUNT(*) AS total FROM send_jobs WHERE organization_id = :organizationId AND source = 'campaign'",
      { organizationId: session.organization_id }
    );

    const campaigns = (await attachStats(jobs)).map((job) => ({
      ...job,
      template_name: displayTemplateName(session.organization_id, job.template_name),
    }));
    if (jobs.some((job) => ["queued", "running", "scheduled"].includes(job.status))) {
      after(() => nudgeSendQueue());
    }
    return jsonOk({ campaigns, total: Number(total), page, pageSize });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSession();
    const payload = campaignSchema.parse(await request.json());

    const template = await getTemplate(session.organization_id, payload.templateId, {
      wabaId: await activeWabaId(session.organization_id),
    });
    if (!template || template.status === "DELETED") throw httpError(404, "Template not found.");
    if (template.status !== "APPROVED") {
      throw httpError(409, `This template is ${template.status.toLowerCase()}. Only approved templates can be sent.`);
    }

    const components = parseJson(template.components_json, []);
    const unsupported = unsupportedSendFeatures(components);
    if (unsupported.length) throw httpError(422, unsupported[0]);

    const mediaFormat = headerMediaFormat(components);
    if (mediaFormat && !payload.headerMedia) {
      throw httpError(422, `This template has a ${mediaFormat.toLowerCase()} header. Add a media link or upload a file.`);
    }

    for (const slot of templateVariableSlots(components)) {
      const rule = payload.variables[slot.key];
      const hasValue = rule && (rule.source === "static" ? rule.value.trim() : rule.field);
      if (!hasValue) throw httpError(422, `Set a value for ${slot.label}.`);
    }

    if (payload.scheduledAt && new Date(payload.scheduledAt).getTime() > Date.now() + 60 * 24 * 60 * 60 * 1000) {
      throw httpError(422, "Campaigns can be scheduled up to 60 days ahead.");
    }

    // Fail fast if messaging is not configured, before queueing anything.
    await resolveWhatsAppConnection(session.organization_id);

    const result = await createCampaign({
      session,
      template,
      audience: payload.audience,
      variables: payload.variables,
      headerMedia: mediaFormat ? payload.headerMedia : null,
      scheduledAt: payload.scheduledAt,
      name: payload.name || displayTemplateName(session.organization_id, template.name),
    });

    if (result.recipients === 0) {
      throw httpError(422, "No opted-in contacts match this audience.");
    }

    await audit(session, "campaign.create", { jobId: result.jobId, recipients: result.recipients });
    if (!result.scheduled) after(() => drainSendQueue());

    return jsonOk({ ok: true, ...result }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
