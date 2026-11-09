import crypto from "crypto";

const PLATFORM_KEYS = [
  "PLATFORM_WHATSAPP_ACCESS_TOKEN",
  "PLATFORM_WHATSAPP_WABA_ID",
  "PLATFORM_WHATSAPP_PHONE_NUMBER_ID",
];

export function platformWhatsAppConfig(env = process.env) {
  const values = PLATFORM_KEYS.map((key) => String(env[key] || "").trim());
  const configured = values.filter(Boolean).length;

  if (configured === 0) return null;
  if (configured !== PLATFORM_KEYS.length) {
    const error = new Error("Platform messaging is temporarily unavailable.");
    error.status = 503;
    throw error;
  }

  return {
    source: "platform",
    accessToken: values[0],
    wabaId: values[1],
    phoneNumberId: values[2],
    displayPhoneNumber: String(env.PLATFORM_WHATSAPP_DISPLAY_PHONE_NUMBER || "").trim() || null,
  };
}

export function managedTemplatePrefix(organizationId) {
  const hash = crypto.createHash("sha256").update(String(organizationId)).digest("hex").slice(0, 10);
  return `eng_${hash}_`;
}

export function managedTemplateName(organizationId, requestedName) {
  const prefix = managedTemplatePrefix(organizationId);
  return `${prefix}${String(requestedName).slice(0, 256 - prefix.length)}`;
}

export function isManagedTemplateName(organizationId, name) {
  return String(name || "").startsWith(managedTemplatePrefix(organizationId));
}

export function displayTemplateName(organizationId, name) {
  const value = String(name || "");
  const prefix = managedTemplatePrefix(organizationId);
  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}
