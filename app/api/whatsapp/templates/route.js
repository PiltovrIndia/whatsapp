import { requireSession } from "@/lib/server/auth";
import { query, withTransaction } from "@/lib/server/db";
import { templateSchema } from "@/lib/server/validators";
import { buildTemplatePayload, validateTemplateInput } from "@/lib/template-payload";
import { createMetaTemplate, resolveWhatsAppConnection } from "@/lib/server/whatsapp";
import { managedTemplateName } from "@/lib/server/whatsapp-config";
import { saveTemplateRecord, serializeTemplate } from "@/lib/server/templates";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

export async function GET(request) {
  try {
    const session = await requireSession();
    const status = new URL(request.url).searchParams.get("status");
    const templates = await query(
      `SELECT * FROM templates
       WHERE organization_id = :organizationId
         AND status <> 'DELETED'
         ${status ? "AND status = :status" : ""}
       ORDER BY updated_at DESC
       LIMIT 500`,
      { organizationId: session.organization_id, status }
    );

    return jsonOk({ templates: templates.map((template) => serializeTemplate(session.organization_id, template)) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request) {
  try {
    const session = await requireSession();
    const payload = templateSchema.parse(await request.json());
    const problems = validateTemplateInput(payload);
    if (problems.length) throw httpError(422, problems[0], { problems });

    const connection = await resolveWhatsAppConnection(session.organization_id);
    const storedName = connection.source === "platform"
      ? managedTemplateName(session.organization_id, payload.name)
      : payload.name;

    const [existing] = await query(
      `SELECT id FROM templates
       WHERE organization_id = :organizationId AND name = :name AND language = :language AND status <> 'DELETED'`,
      { organizationId: session.organization_id, name: storedName, language: payload.language }
    );
    if (existing) {
      throw httpError(409, `A template named "${payload.name}" already exists in ${payload.language}. Choose another name.`);
    }

    const metaTemplate = { ...payload, name: storedName };
    const built = buildTemplatePayload(metaTemplate);
    const metaResponse = await createMetaTemplate({
      wabaId: connection.wabaId,
      token: connection.accessToken,
      template: metaTemplate,
    });

    const templateId = await withTransaction((db) =>
      saveTemplateRecord(db, {
        organizationId: session.organization_id,
        metaTemplateId: metaResponse?.id,
        name: storedName,
        language: payload.language,
        category: metaResponse?.category || payload.category,
        status: metaResponse?.status || "PENDING",
        components: built.components,
        examples: payload.examples,
        buttons: payload.buttons,
      })
    );

    await audit(session, "template.create", { templateId, name: payload.name, language: payload.language });
    return jsonOk(
      { ok: true, id: templateId, status: metaResponse?.status || "PENDING", category: metaResponse?.category || payload.category },
      { status: 201 }
    );
  } catch (error) {
    return handleApiError(error);
  }
}
