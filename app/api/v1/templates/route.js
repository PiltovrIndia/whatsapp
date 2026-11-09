import { NextResponse } from "next/server";
import { parseJson, query } from "@/lib/server/db";
import { withApiKey } from "@/lib/server/api-keys";
import { displayTemplateName } from "@/lib/server/whatsapp-config";
import { headerMediaFormat, templateVariableSlots, unsupportedSendFeatures } from "@/lib/message-payload";
import { describeApiVariables } from "@/lib/api-utils";

export const dynamic = "force-dynamic";

/** GET /api/v1/templates — approved templates and the variables each one needs. */
export const GET = withApiKey(async (request, context, apiSession) => {
  const rows = await query(
    `SELECT id, name, language, category, components_json, updated_at
     FROM templates WHERE organization_id = :organizationId AND status = 'APPROVED'
     ORDER BY name, language`,
    { organizationId: apiSession.organization_id }
  );

  const data = rows.map((row) => {
    const components = parseJson(row.components_json, []);
    const slots = templateVariableSlots(components);
    const variables = describeApiVariables(slots);
    const name = displayTemplateName(apiSession.organization_id, row.name);
    const mediaFormat = headerMediaFormat(components);
    const example = {
      template: name,
      language: row.language,
      to: "+919876543210",
      ...(slots.length ? {
        variables: {
          ...(variables.header.length ? { header: variables.header.map((slot) => slot.example || "value") } : {}),
          ...(variables.body.length ? { body: variables.body.map((slot) => slot.example || "value") } : {}),
          ...(variables.buttons.length ? { buttons: variables.buttons.map(() => "value") } : {}),
        },
      } : {}),
      ...(mediaFormat ? { header_media: { link: `https://example.com/file.${mediaFormat === "IMAGE" ? "jpg" : mediaFormat === "VIDEO" ? "mp4" : "pdf"}` } } : {}),
    };
    return {
      name,
      language: row.language,
      category: row.category,
      header_media: mediaFormat ? mediaFormat.toLowerCase() : null,
      variables,
      sendable: unsupportedSendFeatures(components).length === 0,
      example_request: example,
      updated_at: row.updated_at,
    };
  });

  return NextResponse.json({ data });
});
