import { requireRole, requireSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { activeWabaId, deleteMetaTemplate, getMetaTemplate, resolveWhatsAppConnection } from "@/lib/server/whatsapp";
import { getTemplate, saveTemplateRecord, serializeTemplate } from "@/lib/server/templates";
import { withTransaction } from "@/lib/server/db";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export async function GET(request, { params }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const wabaId = await activeWabaId(session.organization_id);
    let template = await getTemplate(session.organization_id, id, { wabaId });
    if (!template) throw httpError(404, "Template not found.");

    // Refresh review status on demand so senders see approvals without waiting for a sync.
    if (new URL(request.url).searchParams.get("refresh") === "1" && template.meta_template_id) {
      const connection = await resolveWhatsAppConnection(session.organization_id);
      const remote = await getMetaTemplate({ templateId: template.meta_template_id, token: connection.accessToken });
      await withTransaction((db) => saveTemplateRecord(db, {
        organizationId: session.organization_id,
        wabaId: template.waba_id,
        metaTemplateId: remote.id,
        name: remote.name,
        language: remote.language,
        category: remote.category,
        status: remote.status,
        rejectedReason: remote.rejected_reason,
        components: remote.components || [],
      }));
      template = await getTemplate(session.organization_id, id, { wabaId });
    }

    return jsonOk({ template: serializeTemplate(session.organization_id, template) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await requireSession();
    requireRole(session, ["owner", "admin"]);
    const { id } = await params;
    const template = await getTemplate(session.organization_id, id, { wabaId: await activeWabaId(session.organization_id) });
    if (!template) throw httpError(404, "Template not found.");

    if (template.meta_template_id) {
      const connection = await resolveWhatsAppConnection(session.organization_id);
      try {
        await deleteMetaTemplate({
          wabaId: connection.wabaId,
          token: connection.accessToken,
          name: template.name,
          metaTemplateId: template.meta_template_id,
        });
      } catch (error) {
        // Already gone on Meta's side: fall through and mark it deleted locally.
        if (error.metaCode !== 100) throw error;
      }
    }

    // Soft delete keeps campaign history that references the template.
    await query("UPDATE templates SET status = 'DELETED' WHERE id = :id", { id });
    await query(
      `UPDATE send_job_recipients r INNER JOIN send_jobs j ON j.id = r.send_job_id
       SET r.status = 'cancelled' WHERE j.template_id = :id AND r.status = 'queued'`,
      { id }
    );
    await audit(session, "template.delete", { templateId: id, name: template.name });
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
