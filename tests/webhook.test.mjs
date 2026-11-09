import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { isStatusAdvance, keywordIntent, verifyWebhookSignature } from "../lib/server/webhook-utils.js";

test("verifies Meta webhook signatures", () => {
  const body = '{"entry":[]}';
  const signature = `sha256=${crypto.createHmac("sha256", "secret").update(body).digest("hex")}`;
  assert.equal(verifyWebhookSignature(body, signature, "secret"), true);
  assert.equal(verifyWebhookSignature(body, signature, "other"), false);
  assert.equal(verifyWebhookSignature(`${body} `, signature, "secret"), false);
  assert.equal(verifyWebhookSignature(body, undefined, "secret"), false);
  assert.equal(verifyWebhookSignature(body, signature, ""), false);
});

test("never moves delivery status backwards", () => {
  assert.equal(isStatusAdvance("sent", "delivered"), true);
  assert.equal(isStatusAdvance("read", "delivered"), false);
  assert.equal(isStatusAdvance("delivered", "sent"), false);
  assert.equal(isStatusAdvance("sent", "failed"), true);
  assert.equal(isStatusAdvance("read", "failed"), false);
  assert.equal(isStatusAdvance("failed", "delivered"), false);
});

test("detects opt-out and opt-in keywords", () => {
  assert.equal(keywordIntent(" STOP "), "opt_out");
  assert.equal(keywordIntent("Unsubscribe."), "opt_out");
  assert.equal(keywordIntent("start"), "opt_in");
  assert.equal(keywordIntent("please stop calling"), null);
  assert.equal(keywordIntent("cancel"), null);
});
