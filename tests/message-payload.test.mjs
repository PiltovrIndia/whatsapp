import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSendComponents,
  resolveVariables,
  sanitizeParameter,
  templateVariableSlots,
  unsupportedSendFeatures,
} from "../lib/message-payload.js";

const components = [
  { type: "HEADER", format: "TEXT", text: "Hello {{1}}", example: { header_text: ["Asha"] } },
  { type: "BODY", text: "Hi {{1}}, order {{2}} ships today.", example: { body_text: [["Asha", "#1"]] } },
  { type: "BUTTONS", buttons: [
    { type: "QUICK_REPLY", text: "Stop" },
    { type: "URL", text: "Track", url: "https://x.com/o/{{1}}" },
  ] },
];

test("lists every variable slot with examples", () => {
  assert.deepEqual(templateVariableSlots(components).map((s) => s.key), ["header:1", "body:1", "body:2", "button:1:1"]);
  assert.equal(templateVariableSlots(components)[1].example, "Asha");
});

test("resolves per-contact values with fallbacks and attributes", () => {
  const slots = templateVariableSlots(components);
  const mapping = {
    "header:1": { source: "field", field: "first_name", fallback: "there" },
    "body:1": { source: "field", field: "full_name" },
    "body:2": { source: "field", field: "attr:order_id" },
    "button:1:1": { source: "static", value: "abc" },
  };
  const contact = { first_name: "", last_name: "Rao", attributes_json: '{"order_id":"1042"}' };
  const { values, missing } = resolveVariables(slots, mapping, contact);
  assert.deepEqual(values, { "header:1": "there", "body:1": "Rao", "body:2": "1042", "button:1:1": "abc" });
  assert.deepEqual(missing, []);
  assert.deepEqual(resolveVariables(slots, {}, contact).missing.length, 4);
});

test("builds send components with header, body and button parameters", () => {
  const sent = buildSendComponents(components, { "header:1": "A", "body:1": "B", "body:2": "C", "button:1:1": "D" });
  assert.deepEqual(sent, [
    { type: "header", parameters: [{ type: "text", text: "A" }] },
    { type: "body", parameters: [{ type: "text", text: "B" }, { type: "text", text: "C" }] },
    { type: "button", sub_type: "url", index: "1", parameters: [{ type: "text", text: "D" }] },
  ]);
});

test("builds media headers and authentication messages", () => {
  const media = buildSendComponents(
    [{ type: "HEADER", format: "DOCUMENT" }, { type: "BODY", text: "Your invoice" }],
    {},
    { id: "123", filename: "invoice.pdf" }
  );
  assert.deepEqual(media, [{ type: "header", parameters: [{ type: "document", document: { id: "123", filename: "invoice.pdf" } }] }]);

  const auth = [{ type: "BODY", add_security_recommendation: true }, { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] }];
  assert.deepEqual(templateVariableSlots(auth).map((s) => s.key), ["body:1"]);
  assert.deepEqual(buildSendComponents(auth, { "body:1": "654321" }), [
    { type: "body", parameters: [{ type: "text", text: "654321" }] },
    { type: "button", sub_type: "url", index: "0", parameters: [{ type: "text", text: "654321" }] },
  ]);
});

test("sanitizes parameters and flags unsupported templates", () => {
  assert.equal(sanitizeParameter("a\nb\t c      d"), "a b  c   d");
  assert.equal(unsupportedSendFeatures([{ type: "HEADER", format: "LOCATION" }]).length, 1);
});
