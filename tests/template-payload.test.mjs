import assert from "node:assert/strict";
import test from "node:test";
import { buildTemplatePayload } from "../lib/template-payload.js";

test("builds WhatsApp template payload with body examples and buttons", () => {
  const payload = buildTemplatePayload({
    name: "order_ready_update",
    language: "en_US",
    category: "UTILITY",
    headerType: "TEXT",
    headerText: "Order update",
    bodyText: "Hi {{1}}, order {{2}} is ready.",
    footerText: "Reply STOP to opt out.",
    examples: { 1: "Asha", 2: "#1042" },
    buttons: [{ type: "URL", text: "Track order", url: "https://example.com/orders/{{1}}" }],
  });

  assert.equal(payload.name, "order_ready_update");
  assert.equal(payload.components[0].type, "HEADER");
  assert.equal(payload.components[1].example.body_text[0][0], "Asha");
  assert.equal(payload.components[3].buttons[0].type, "URL");
});

import { summarizeComponents, validateTemplateInput } from "../lib/template-payload.js";

const base = {
  name: "order_update",
  language: "en_US",
  category: "UTILITY",
  headerType: "NONE",
  bodyText: "Hi {{1}}, order {{2}} is ready.",
  examples: { 1: "Asha", 2: "#1042" },
  buttons: [],
};

test("accepts a valid template", () => {
  assert.deepEqual(validateTemplateInput(base), []);
});

test("rejects variable gaps, edge variables, and missing samples", () => {
  assert.ok(validateTemplateInput({ ...base, bodyText: "Hi {{1}}, order {{3}} is ready." }).some((e) => e.includes("in order")));
  assert.ok(validateTemplateInput({ ...base, bodyText: "{{1}} your order is ready" }).some((e) => e.includes("start or end")));
  assert.ok(validateTemplateInput({ ...base, bodyText: "Your order is {{1}}" }).some((e) => e.includes("start or end")));
  assert.ok(validateTemplateInput({ ...base, examples: { 1: "Asha" } }).some((e) => e.includes("{{2}}")));
});

test("validates buttons and media headers", () => {
  const problems = validateTemplateInput({
    ...base,
    headerType: "IMAGE",
    buttons: [
      { type: "URL", text: "Track", url: "https://x.com/{{1}}/track" },
      { type: "PHONE_NUMBER", text: "Call", phoneNumber: "12345" },
    ],
  });
  assert.ok(problems.some((e) => e.includes("Upload a sample image")));
  assert.ok(problems.some((e) => e.includes("at the very end")));
  assert.ok(problems.some((e) => e.includes("international format")));
});

test("orders body examples numerically and adds URL/header examples", () => {
  const payload = buildTemplatePayload({
    ...base,
    headerType: "TEXT",
    headerText: "Update for {{1}}",
    headerExample: "Asha",
    examples: { 2: "#1042", 1: "Asha" },
    buttons: [
      { type: "URL", text: "Track", url: "https://x.com/o/{{1}}", urlExample: "1042" },
      { type: "QUICK_REPLY", text: "Stop" },
    ],
  });
  assert.deepEqual(payload.components[0].example, { header_text: ["Asha"] });
  assert.deepEqual(payload.components[1].example.body_text, [["Asha", "#1042"]]);
  const buttons = payload.components.find((c) => c.type === "BUTTONS").buttons;
  assert.equal(buttons[0].type, "QUICK_REPLY", "quick replies are grouped first");
  assert.deepEqual(buttons[1].example, ["https://x.com/o/1042"]);
});

test("builds authentication templates in Meta's fixed format", () => {
  const payload = buildTemplatePayload({
    name: "login_code", language: "en_US", category: "AUTHENTICATION",
    auth: { addSecurityRecommendation: true, codeExpirationMinutes: 10, otpButtonText: "Copy" },
  });
  assert.deepEqual(payload.components, [
    { type: "BODY", add_security_recommendation: true },
    { type: "FOOTER", code_expiration_minutes: 10 },
    { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: "Copy" }] },
  ]);
  assert.equal(summarizeComponents(payload.components).bodyText, "{{1}} is your verification code.");
});
