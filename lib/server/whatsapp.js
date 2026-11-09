import { encryptSecret, decryptSecret } from "@/lib/server/crypto";
import { buildTemplatePayload } from "@/lib/template-payload";
import { query } from "@/lib/server/db";
import { platformWhatsAppConfig } from "@/lib/server/whatsapp-config";

const GRAPH_TIMEOUT_MS = 30_000;

// Meta error codes that are safe to retry after a delay.
// https://developers.facebook.com/docs/whatsapp/cloud-api/support/error-codes
const RETRYABLE_META_CODES = new Set([1, 2, 4, 17, 341, 80007, 130429, 131000, 131016, 131048, 131056, 133004]);

export function graphVersion() {
  return process.env.META_GRAPH_API_VERSION || "v23.0";
}

function graphUrl(path) {
  // META_GRAPH_BASE_URL lets tests point at a mock Graph API.
  const base = process.env.META_GRAPH_BASE_URL || "https://graph.facebook.com";
  return `${base}/${graphVersion()}${path}`;
}

/** Converts a Meta error response into an Error our API layer understands. */
export function metaError(httpStatus, data) {
  const meta = data?.error || {};
  const detail = meta.error_user_msg || meta.error_data?.details || meta.message;
  const title = meta.error_user_title;
  const message = detail
    ? (title && !detail.startsWith(title) ? `${title}: ${detail}` : detail)
    : `WhatsApp API request failed (${httpStatus}).`;

  const error = new Error(message);
  error.metaStatus = httpStatus;
  error.metaCode = meta.code ?? null;
  error.metaSubcode = meta.error_subcode ?? null;
  error.meta = { code: meta.code, subcode: meta.error_subcode, type: meta.type, fbtrace_id: meta.fbtrace_id };

  if (httpStatus === 401 || meta.code === 190) {
    error.status = 502;
    error.message = `WhatsApp credentials were rejected by Meta. ${message}`;
  } else if (httpStatus === 429 || RETRYABLE_META_CODES.has(meta.code)) {
    error.status = 429;
  } else if (httpStatus >= 400 && httpStatus < 500) {
    error.status = 422;
  } else {
    error.status = 502;
  }

  error.retryable = httpStatus >= 500 || httpStatus === 429 || RETRYABLE_META_CODES.has(meta.code);
  return error;
}

async function graphFetch(path, { token, method = "GET", body, headers: extraHeaders, rawBody } = {}) {
  const headers = { ...(extraHeaders || {}) };
  if (token && !headers.Authorization) headers.Authorization = `Bearer ${token}`;
  if (body && !rawBody) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(path.startsWith("https://") ? path : graphUrl(path), {
      method,
      headers,
      body: rawBody ?? (body ? JSON.stringify(body) : undefined),
      cache: "no-store",
      signal: AbortSignal.timeout(GRAPH_TIMEOUT_MS),
    });
  } catch (cause) {
    const error = new Error(`Could not reach the WhatsApp API: ${cause.message}`);
    error.status = 502;
    error.retryable = true;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok || data?.error) {
    throw metaError(response.status, data);
  }

  return data;
}

export async function exchangeEmbeddedSignupCode(code) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    throw new Error("META_APP_ID and META_APP_SECRET are required.");
  }

  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID,
    client_secret: process.env.META_APP_SECRET,
    code,
  });

  return graphFetch(`/oauth/access_token?${params.toString()}`);
}

export function encryptAccessToken(accessToken) {
  return encryptSecret(accessToken);
}

export function accessTokenFromConnection(connection) {
  return decryptSecret(connection.access_token_encrypted);
}

export async function resolveWhatsAppConnection(organizationId) {
  const platform = platformWhatsAppConfig();
  if (platform) return platform;

  const [connection] = await query(
    `SELECT wc.*, pn.phone_number_id, pn.display_phone_number
     FROM whatsapp_connections wc
     INNER JOIN whatsapp_phone_numbers pn ON pn.connection_id = wc.id
     WHERE wc.organization_id = :organizationId
     ORDER BY pn.created_at ASC
     LIMIT 1`,
    { organizationId }
  );

  if (!connection) {
    const error = new Error(
      "WhatsApp is not connected for this workspace. Ask your administrator to configure the messaging service."
    );
    error.status = 503;
    throw error;
  }

  return {
    source: "organization",
    accessToken: accessTokenFromConnection(connection),
    wabaId: connection.waba_id,
    phoneNumberId: connection.phone_number_id,
    displayPhoneNumber: connection.display_phone_number || null,
  };
}

export { buildTemplatePayload };

export async function createMetaTemplate({ wabaId, token, template }) {
  return graphFetch(`/${wabaId}/message_templates`, {
    token,
    method: "POST",
    body: buildTemplatePayload(template),
  });
}

const TEMPLATE_FIELDS = "id,name,language,status,category,components,rejected_reason,quality_score";

/** Fetches every template on the WABA, following pagination cursors. */
export async function listMetaTemplates({ wabaId, token }) {
  const templates = [];
  let after = null;

  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ fields: TEMPLATE_FIELDS, limit: "100" });
    if (after) params.set("after", after);
    const data = await graphFetch(`/${wabaId}/message_templates?${params}`, { token });
    templates.push(...(data.data || []));
    after = data.paging?.cursors?.after;
    if (!data.paging?.next || !after) break;
  }

  return { data: templates };
}

export async function getMetaTemplate({ templateId, token }) {
  return graphFetch(`/${templateId}?fields=${TEMPLATE_FIELDS}`, { token });
}

export async function deleteMetaTemplate({ wabaId, token, name, metaTemplateId }) {
  const params = new URLSearchParams({ name });
  if (metaTemplateId) params.set("hsm_id", metaTemplateId);
  return graphFetch(`/${wabaId}/message_templates?${params}`, { token, method: "DELETE" });
}

/**
 * Uploads a sample file with the Resumable Upload API and returns the
 * `header_handle` Meta requires for media template headers.
 */
export async function uploadTemplateSample({ token, bytes, fileName, mimeType }) {
  const appId = process.env.META_APP_ID;
  if (!appId || /replace/i.test(appId)) {
    const error = new Error("META_APP_ID must be configured to upload template media.");
    error.status = 503;
    throw error;
  }

  const params = new URLSearchParams({
    file_name: fileName,
    file_length: String(bytes.byteLength),
    file_type: mimeType,
  });
  const session = await graphFetch(`/${appId}/uploads?${params}`, { token, method: "POST" });
  const uploaded = await graphFetch(`/${session.id}`, {
    method: "POST",
    headers: { Authorization: `OAuth ${token}`, file_offset: "0" },
    rawBody: bytes,
  });
  return uploaded.h;
}

/** Uploads media to the phone number so it can be referenced by id when sending. */
export async function uploadMessageMedia({ phoneNumberId, token, bytes, fileName, mimeType }) {
  const form = new FormData();
  form.append("messaging_product", "whatsapp");
  form.append("type", mimeType);
  form.append("file", new Blob([bytes], { type: mimeType }), fileName);
  return graphFetch(`/${phoneNumberId}/media`, { token, method: "POST", rawBody: form });
}

export async function sendMetaTemplateMessage({ phoneNumberId, token, to, templateName, language, components }) {
  return graphFetch(`/${phoneNumberId}/messages`, {
    token,
    method: "POST",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: String(to).replace(/^\+/, ""),
      type: "template",
      template: {
        name: templateName,
        language: { code: language },
        ...(components?.length ? { components } : {}),
      },
    },
  });
}

export async function getPhoneNumberInfo({ phoneNumberId, token }) {
  const fields = "display_phone_number,verified_name,quality_rating,code_verification_status,name_status,messaging_limit_tier,throughput,platform_type";
  return graphFetch(`/${phoneNumberId}?fields=${fields}`, { token });
}

export async function getSubscribedApps({ wabaId, token }) {
  return graphFetch(`/${wabaId}/subscribed_apps`, { token });
}

export async function subscribeAppToWaba({ wabaId, token }) {
  return graphFetch(`/${wabaId}/subscribed_apps`, { token, method: "POST" });
}
