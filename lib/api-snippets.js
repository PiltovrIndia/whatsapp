// Builds copy-paste examples for POST /api/v1/messages (safe for client components).
import { headerMediaFormat, templateVariableSlots } from "@/lib/message-payload";

const MEDIA_EXAMPLES = {
  IMAGE: "https://example.com/banner.jpg",
  VIDEO: "https://example.com/clip.mp4",
  DOCUMENT: "https://example.com/report.pdf",
};

export function exampleRequestBody({ name, language, components }, to = "+919876543210") {
  const slots = templateVariableSlots(components || []);
  const pick = (prefix) => slots.filter((slot) => slot.key.startsWith(prefix));
  const header = pick("header:").map((slot) => slot.example || "value");
  const body = pick("body:").map((slot) => slot.example || "value");
  const buttons = pick("button:").map(() => "value");
  const mediaFormat = headerMediaFormat(components || []);

  return {
    template: name,
    language,
    to,
    ...(slots.length ? {
      variables: {
        ...(header.length ? { header } : {}),
        ...(body.length ? { body } : {}),
        ...(buttons.length ? { buttons } : {}),
      },
    } : {}),
    ...(mediaFormat ? { header_media: { link: MEDIA_EXAMPLES[mediaFormat] || MEDIA_EXAMPLES.DOCUMENT } } : {}),
    reference: "order-1042",
  };
}

export function curlExample(baseUrl, body, key = "pk_live_YOUR_KEY") {
  const json = JSON.stringify(body, null, 2).replaceAll("'", "'\\''");
  return [
    `curl -X POST ${baseUrl}/api/v1/messages \\`,
    `  -H "Authorization: Bearer ${key}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -H "Idempotency-Key: order-1042-ready" \\`,
    `  -d '${json}'`,
  ].join("\n");
}

export function nodeExample(baseUrl, body) {
  return `const response = await fetch("${baseUrl}/api/v1/messages", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.PILTOVR_API_KEY}\`,
    "Content-Type": "application/json",
    "Idempotency-Key": "order-1042-ready", // safe to retry with the same key
  },
  body: JSON.stringify(${JSON.stringify(body, null, 2).replaceAll("\n", "\n  ")}),
});
const result = await response.json(); // { batch_id, messages: [{ id, status, error }] }`;
}
