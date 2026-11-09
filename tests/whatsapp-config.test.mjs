import assert from "node:assert/strict";
import test from "node:test";
import {
  displayTemplateName,
  isManagedTemplateName,
  managedTemplateName,
  managedTemplatePrefix,
  platformWhatsAppConfig,
} from "../lib/server/whatsapp-config.js";

test("returns a complete server-managed WhatsApp configuration", () => {
  assert.deepEqual(platformWhatsAppConfig({
    PLATFORM_WHATSAPP_ACCESS_TOKEN: "token",
    PLATFORM_WHATSAPP_WABA_ID: "waba-1",
    PLATFORM_WHATSAPP_PHONE_NUMBER_ID: "phone-1",
    PLATFORM_WHATSAPP_DISPLAY_PHONE_NUMBER: "+1 415 555 0123",
  }), {
    source: "platform",
    accessToken: "token",
    wabaId: "waba-1",
    phoneNumberId: "phone-1",
    displayPhoneNumber: "+1 415 555 0123",
  });
});

test("returns null when the platform connection is not configured", () => {
  assert.equal(platformWhatsAppConfig({}), null);
});

test("rejects a partial platform connection without exposing configuration details", () => {
  assert.throws(
    () => platformWhatsAppConfig({ PLATFORM_WHATSAPP_WABA_ID: "waba-1" }),
    (error) => error.status === 503 && error.message === "Platform messaging is temporarily unavailable."
  );
});

test("generates stable isolated Meta template names and restores display names", () => {
  const organizationId = "7ec61f4f-940d-40e6-83c0-b5ecaf87e320";
  const otherOrganizationId = "2a276915-624b-44bb-a254-e998d6f30cbd";
  const storedName = managedTemplateName(organizationId, "order_ready_update");

  assert.equal(storedName, `${managedTemplatePrefix(organizationId)}order_ready_update`);
  assert.equal(displayTemplateName(organizationId, storedName), "order_ready_update");
  assert.equal(isManagedTemplateName(organizationId, storedName), true);
  assert.equal(isManagedTemplateName(otherOrganizationId, storedName), false);
  assert.notEqual(
    managedTemplateName(organizationId, "order_ready_update"),
    managedTemplateName(otherOrganizationId, "order_ready_update")
  );
});

test("keeps managed Meta template names within the API limit", () => {
  const name = managedTemplateName("organization", "a".repeat(300));
  assert.equal(name.length, 256);
});
