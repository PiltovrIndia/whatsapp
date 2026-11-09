// Turns a stored template (Meta-format components) plus per-recipient values
// into the `components` array for `POST /{phone-number-id}/messages`.
// Pure functions: shared by the campaign builder UI and the send worker.

const VARIABLE_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;
const MEDIA_FORMATS = ["IMAGE", "VIDEO", "DOCUMENT"];

export const CONTACT_FIELDS = [
  { value: "first_name", label: "First name" },
  { value: "last_name", label: "Last name" },
  { value: "full_name", label: "Full name" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
];

function indexes(text) {
  return [...new Set([...String(text || "").matchAll(VARIABLE_PATTERN)].map((m) => Number(m[1])))]
    .sort((a, b) => a - b);
}

function find(components, type) {
  return (components || []).find((component) => String(component.type).toUpperCase() === type);
}

export function isAuthenticationTemplate(components) {
  const buttons = find(components, "BUTTONS")?.buttons || [];
  return buttons.some((button) => button.type === "OTP");
}

export function headerMediaFormat(components) {
  const header = find(components, "HEADER");
  const format = String(header?.format || "").toUpperCase();
  return MEDIA_FORMATS.includes(format) ? format : null;
}

export function unsupportedSendFeatures(components) {
  const problems = [];
  const header = find(components, "HEADER");
  if (header && String(header.format).toUpperCase() === "LOCATION") {
    problems.push("Location headers are not supported for campaigns yet.");
  }
  const buttons = find(components, "BUTTONS")?.buttons || [];
  for (const button of buttons) {
    if (["FLOW", "CATALOG", "MPM", "SPM"].includes(button.type)) {
      problems.push(`${button.type} buttons are not supported for campaigns yet.`);
    }
  }
  return problems;
}

/**
 * Lists every value a sender must supply, e.g.
 * `[{ key: "body:1", label: "Body {{1}}", example: "Asha" }]`.
 */
export function templateVariableSlots(components) {
  const slots = [];

  if (isAuthenticationTemplate(components)) {
    return [{ key: "body:1", label: "Verification code", example: "123456" }];
  }

  const header = find(components, "HEADER");
  if (header && String(header.format).toUpperCase() === "TEXT" && indexes(header.text).length) {
    slots.push({ key: "header:1", label: "Header {{1}}", example: header.example?.header_text?.[0] || "" });
  }

  const body = find(components, "BODY");
  for (const index of indexes(body?.text)) {
    slots.push({
      key: `body:${index}`,
      label: `Body {{${index}}}`,
      example: body?.example?.body_text?.[0]?.[index - 1] || "",
    });
  }

  const buttons = find(components, "BUTTONS")?.buttons || [];
  buttons.forEach((button, position) => {
    if (button.type === "URL" && indexes(button.url).length) {
      slots.push({
        key: `button:${position}:1`,
        label: `"${button.text}" link suffix`,
        example: "",
      });
    }
    if (button.type === "COPY_CODE") {
      slots.push({ key: `button:${position}:coupon`, label: `"${button.text}" coupon code`, example: "" });
    }
  });

  return slots;
}

/** WhatsApp rejects text parameters containing newlines, tabs or 4+ spaces. */
export function sanitizeParameter(value) {
  return String(value ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/ {4,}/g, "   ")
    .trim()
    .slice(0, 1024);
}

function contactFieldValue(contact, field) {
  if (!field) return "";
  if (field === "full_name") return `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  if (field.startsWith("attr:")) {
    const attributes = typeof contact.attributes_json === "string"
      ? JSON.parse(contact.attributes_json || "{}")
      : contact.attributes_json || {};
    return attributes[field.slice(5)] ?? "";
  }
  return contact[field] ?? "";
}

/**
 * Resolves a variable mapping for one contact.
 * mapping: `{ [slotKey]: { source: "static", value } | { source: "field", field, fallback } }`
 */
export function resolveVariables(slots, mapping, contact) {
  const values = {};
  const missing = [];

  for (const slot of slots) {
    const rule = mapping?.[slot.key] || {};
    let value = rule.source === "field"
      ? contactFieldValue(contact, rule.field) || rule.fallback || ""
      : rule.value || "";
    value = sanitizeParameter(value);
    if (!value) missing.push(slot.label);
    values[slot.key] = value;
  }

  return { values, missing };
}

export function buildSendComponents(components, values = {}, headerMedia = null) {
  const result = [];

  if (isAuthenticationTemplate(components)) {
    const code = values["body:1"];
    const buttons = find(components, "BUTTONS")?.buttons || [];
    const otpIndex = buttons.findIndex((button) => button.type === "OTP");
    result.push({ type: "body", parameters: [{ type: "text", text: code }] });
    if (otpIndex >= 0) {
      result.push({
        type: "button",
        sub_type: "url",
        index: String(otpIndex),
        parameters: [{ type: "text", text: code }],
      });
    }
    return result;
  }

  const header = find(components, "HEADER");
  const mediaFormat = headerMediaFormat(components);
  if (mediaFormat) {
    const kind = mediaFormat.toLowerCase();
    const media = headerMedia?.id ? { id: headerMedia.id } : { link: headerMedia?.link };
    if (kind === "document" && headerMedia?.filename) media.filename = headerMedia.filename;
    result.push({ type: "header", parameters: [{ type: kind, [kind]: media }] });
  } else if (header && String(header.format).toUpperCase() === "TEXT" && indexes(header.text).length) {
    result.push({ type: "header", parameters: [{ type: "text", text: values["header:1"] }] });
  }

  const body = find(components, "BODY");
  const bodyIndexes = indexes(body?.text);
  if (bodyIndexes.length) {
    result.push({
      type: "body",
      parameters: bodyIndexes.map((index) => ({ type: "text", text: values[`body:${index}`] })),
    });
  }

  const buttons = find(components, "BUTTONS")?.buttons || [];
  buttons.forEach((button, position) => {
    if (button.type === "URL" && indexes(button.url).length) {
      result.push({
        type: "button",
        sub_type: "url",
        index: String(position),
        parameters: [{ type: "text", text: values[`button:${position}:1`] }],
      });
    }
    if (button.type === "COPY_CODE") {
      result.push({
        type: "button",
        sub_type: "copy_code",
        index: String(position),
        parameters: [{ type: "coupon_code", coupon_code: values[`button:${position}:coupon`] }],
      });
    }
  });

  return result;
}

/** Renders a plain-text preview of the message with values substituted. */
export function renderPreview(components, values = {}) {
  const fill = (text, prefix) =>
    String(text || "").replace(VARIABLE_PATTERN, (_, index) => values[`${prefix}:${index}`] || `{{${index}}}`);
  const header = find(components, "HEADER");
  const body = find(components, "BODY");
  const footer = find(components, "FOOTER");
  const buttons = find(components, "BUTTONS")?.buttons || [];

  if (isAuthenticationTemplate(components)) {
    return {
      header: null,
      body: `${values["body:1"] || "{{1}}"} is your verification code.${body?.add_security_recommendation ? " For your security, do not share this code." : ""}`,
      footer: footer?.code_expiration_minutes ? `This code expires in ${footer.code_expiration_minutes} minutes.` : null,
      buttons: buttons.map((button) => button.text || "Copy code"),
      mediaFormat: null,
    };
  }

  return {
    header: header && String(header.format).toUpperCase() === "TEXT" ? fill(header.text, "header") : null,
    mediaFormat: headerMediaFormat(components),
    body: fill(body?.text, "body"),
    footer: footer?.text || null,
    buttons: buttons.map((button) => button.text),
  };
}
