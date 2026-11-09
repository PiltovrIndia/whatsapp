import crypto from "crypto";
import { parseJson, query, withTransaction } from "@/lib/server/db";
import { summarizeComponents } from "@/lib/template-payload";
import { displayTemplateName, isManagedTemplateName } from "@/lib/server/whatsapp-config";
import { listMetaTemplates } from "@/lib/server/whatsapp";

const CATEGORIES = ["MARKETING", "UTILITY", "AUTHENTICATION"];


export function serializeTemplate(organizationId, template) {
  return {
    id: template.id,
    metaTemplateId: template.meta_template_id,
    name: displayTemplateName(organizationId, template.name),
    language: template.language,
    category: template.category,
    status: template.status,
    rejectedReason: template.rejected_reason || null,
    headerType: template.header_type,
    headerText: template.header_text,
    bodyText: template.body_text,
    footerText: template.footer_text,
    components: parseJson(template.components_json, []),
    createdAt: template.created_at,
    updatedAt: template.updated_at,
    lastSyncedAt: template.last_synced_at,
  };
}

export async function saveTemplateRecord(connection, { organizationId, metaTemplateId, name, language, category, status, components, examples, buttons, rejectedReason }) {
  const summary = summarizeComponents(components);
  await connection.query(
    `INSERT INTO templates
       (id, organization_id, meta_template_id, name, language, category, status, rejected_reason,
        header_type, header_text, body_text, footer_text, examples_json, buttons_json, components_json, last_synced_at)
     VALUES
       (:id, :organizationId, :metaTemplateId, :name, :language, :category, :status, :rejectedReason,
        :headerType, :headerText, :bodyText, :footerText, :examples, :buttons, :components, UTC_TIMESTAMP())
     ON DUPLICATE KEY UPDATE
       meta_template_id = VALUES(meta_template_id),
       category = VALUES(category),
       status = VALUES(status),
       rejected_reason = VALUES(rejected_reason),
       header_type = VALUES(header_type),
       header_text = VALUES(header_text),
       body_text = VALUES(body_text),
       footer_text = VALUES(footer_text),
       examples_json = COALESCE(VALUES(examples_json), examples_json),
       buttons_json = VALUES(buttons_json),
       components_json = VALUES(components_json),
       last_synced_at = UTC_TIMESTAMP()`,
    {
      id: crypto.randomUUID(),
      organizationId,
      metaTemplateId: metaTemplateId || null,
      name,
      language,
      category: CATEGORIES.includes(category) ? category : "UTILITY",
      status: status || "PENDING",
      rejectedReason: rejectedReason && rejectedReason !== "NONE" ? String(rejectedReason).slice(0, 512) : null,
      headerType: summary.headerType,
      headerText: summary.headerText ? summary.headerText.slice(0, 60) : null,
      bodyText: summary.bodyText || "",
      footerText: summary.footerText ? summary.footerText.slice(0, 60) : null,
      examples: examples ? JSON.stringify(examples) : null,
      buttons: JSON.stringify(buttons || summary.buttons || []),
      components: JSON.stringify(components || []),
    }
  );

  const [[saved]] = await connection.query(
    `SELECT id FROM templates WHERE organization_id = :organizationId AND name = :name AND language = :language`,
    { organizationId, name, language }
  );
  return saved.id;
}

/** Pulls every template from Meta and reconciles local records. */
export async function syncTemplates(organizationId, connection) {
  const meta = await listMetaTemplates({ wabaId: connection.wabaId, token: connection.accessToken });
  const templates = (meta.data || []).filter((template) =>
    connection.source !== "platform" || isManagedTemplateName(organizationId, template.name)
  );

  await withTransaction(async (db) => {
    for (const template of templates) {
      await saveTemplateRecord(db, {
        organizationId,
        metaTemplateId: template.id,
        name: template.name,
        language: template.language,
        category: template.category,
        status: template.status || "UNKNOWN",
        rejectedReason: template.rejected_reason,
        components: template.components || [],
      });
    }

    const remoteIds = templates.map((template) => String(template.id));
    await db.query(
      `UPDATE templates SET status = 'DELETED'
       WHERE organization_id = :organizationId
         AND meta_template_id IS NOT NULL
         AND status <> 'DELETED'
         ${remoteIds.length ? "AND meta_template_id NOT IN (:remoteIds)" : ""}`,
      { organizationId, remoteIds }
    );
  });

  return templates.length;
}

export async function getTemplate(organizationId, templateId) {
  const [template] = await query(
    "SELECT * FROM templates WHERE id = :templateId AND organization_id = :organizationId LIMIT 1",
    { templateId, organizationId }
  );
  return template || null;
}
