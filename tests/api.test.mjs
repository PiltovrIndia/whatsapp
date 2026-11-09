import assert from "node:assert/strict";
import test from "node:test";
import {
  apiKeyPrefix,
  describeApiVariables,
  generateApiKey,
  hashApiKey,
  looksLikeApiKey,
  mapApiVariables,
  signWebhookPayload,
  validateWebhookUrl,
  verifyWebhookPayload,
} from "../lib/api-utils.js";
import { templateVariableSlots } from "../lib/message-payload.js";

const components = [
  { type: "HEADER", format: "TEXT", text: "Class {{1}}", example: { header_text: ["7B"] } },
  { type: "BODY", text: "Hi {{1}}, your timetable for {{2}} is ready.", example: { body_text: [["Asha", "Monday"]] } },
  { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Thanks" }, { type: "URL", text: "Open", url: "https://ex.com/t/{{1}}" }] },
];
const slots = templateVariableSlots(components);

test("API keys have a recognizable prefix and are stored as hashes", () => {
  const key = generateApiKey();
  assert.ok(key.startsWith("pk_live_"));
  assert.ok(looksLikeApiKey(key));
  assert.equal(looksLikeApiKey("pk_live_short"), false);
  assert.equal(looksLikeApiKey("sk_live_" + "x".repeat(43)), false);
  assert.match(hashApiKey(key), /^[a-f0-9]{64}$/);
  assert.notEqual(hashApiKey(key), hashApiKey(generateApiKey()));
  assert.equal(apiKeyPrefix(key), key.slice(0, 12));
});

test("maps positional API variables onto template slots", () => {
  const { values, error } = mapApiVariables(slots, { header: ["7B"], body: ["Asha", "Monday"], buttons: ["1042"] });
  assert.equal(error, undefined);
  assert.deepEqual(values, { "header:1": "7B", "body:1": "Asha", "body:2": "Monday", "button:1:1": "1042" });
});

test("accepts a bare array as body variables and a scalar header", () => {
  const bodyOnly = templateVariableSlots([{ type: "BODY", text: "Hi {{1}} and {{2}}" }]);
  assert.deepEqual(mapApiVariables(bodyOnly, ["A", 2]).values, { "body:1": "A", "body:2": "2" });
  assert.deepEqual(mapApiVariables(slots, { header: "7B", body: ["a", "b"], buttons: ["x"] }).values["header:1"], "7B");
});

test("rejects wrong variable counts and empty values with clear messages", () => {
  assert.match(mapApiVariables(slots, { header: ["7B"], body: ["Asha"], buttons: ["1"] }).error, /needs 2 body variables, but 1 was given/);
  assert.match(mapApiVariables(slots, { body: ["a", "b"], buttons: ["1"] }).error, /needs 1 header variable/);
  assert.match(mapApiVariables(slots, { header: ["7B"], body: ["a", "  "], buttons: ["1"] }).error, /Body \{\{2\}\} is empty/);
  const none = templateVariableSlots([{ type: "BODY", text: "Hello there" }]);
  assert.deepEqual(mapApiVariables(none, undefined).values, {});
  assert.match(mapApiVariables(none, ["extra"]).error, /needs 0 body variables/);
});

test("authentication templates take the code as body[0] or `code`", () => {
  const auth = templateVariableSlots([
    { type: "BODY", add_security_recommendation: true },
    { type: "BUTTONS", buttons: [{ type: "OTP", otp_type: "COPY_CODE" }] },
  ]);
  assert.deepEqual(mapApiVariables(auth, { code: "482913" }).values, { "body:1": "482913" });
  assert.deepEqual(mapApiVariables(auth, ["482913"]).values, { "body:1": "482913" });
});

test("describes template variables for API consumers", () => {
  const described = describeApiVariables(slots);
  assert.equal(described.header.length, 1);
  assert.deepEqual(described.body.map((slot) => slot.example), ["Asha", "Monday"]);
  assert.equal(described.buttons.length, 1);
});

test("webhook signatures verify and reject tampering, wrong secrets and stale timestamps", () => {
  const body = JSON.stringify({ id: "evt_1", type: "message.delivered" });
  const now = Date.now();
  const header = signWebhookPayload("whsec_test", body, Math.floor(now / 1000));
  assert.match(header, /^t=\d+,v1=[a-f0-9]{64}$/);
  assert.equal(verifyWebhookPayload("whsec_test", body, header, { now }), true);
  assert.equal(verifyWebhookPayload("whsec_other", body, header, { now }), false);
  assert.equal(verifyWebhookPayload("whsec_test", `${body} `, header, { now }), false);
  assert.equal(verifyWebhookPayload("whsec_test", body, header, { now: now + 10 * 60 * 1000 }), false);
  assert.equal(verifyWebhookPayload("whsec_test", body, "garbage", { now }), false);
});

test("webhook URLs must be public https unless explicitly allowed", () => {
  assert.equal(validateWebhookUrl("https://example.com/hook"), "https://example.com/hook");
  for (const bad of ["http://example.com/hook", "https://localhost/x", "https://127.0.0.1/x", "https://10.0.0.5/x",
    "https://192.168.1.2/x", "https://172.20.0.1/x", "https://169.254.169.254/latest", "https://[::1]/x",
    "https://user:pass@example.com/x", "ftp://example.com", "not a url"]) {
    assert.throws(() => validateWebhookUrl(bad), Error, bad);
  }
  assert.equal(validateWebhookUrl("http://127.0.0.1:4700/hook", { allowInsecure: true }), "http://127.0.0.1:4700/hook");
});
