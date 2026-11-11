import assert from "node:assert/strict";
import test from "node:test";
import {
  describeSignupStep,
  featureTypeFor,
  healthProblems,
  isFacebookOrigin,
  parseSignupMessage,
  tokenGrantsWaba,
} from "../lib/embedded-signup-utils.js";

const msg = (event, data = {}) => JSON.stringify({ type: "WA_EMBEDDED_SIGNUP", event, data, version: "3" });

test("parses a finished cloud signup", () => {
  assert.deepEqual(parseSignupMessage(msg("FINISH", { waba_id: "111", phone_number_id: "222", business_id: "333" })), {
    kind: "finish", onboardingType: "cloud", wabaId: "111", phoneNumberId: "222", businessId: "333",
  });
});

test("parses a coexistence signup and accepts objects", () => {
  const parsed = parseSignupMessage({ type: "WA_EMBEDDED_SIGNUP", event: "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING", data: { waba_id: 1, phone_number_id: 2 } });
  assert.equal(parsed.kind, "finish");
  assert.equal(parsed.onboardingType, "coexistence");
  assert.equal(parsed.wabaId, "1");
  assert.equal(parsed.businessId, null);
});

test("a finish without a phone number is reported as no_phone", () => {
  assert.equal(parseSignupMessage(msg("FINISH_ONLY_WABA", { waba_id: "1" })).kind, "no_phone");
  assert.equal(parseSignupMessage(msg("FINISH", { waba_id: "1" })).kind, "no_phone");
});

test("cancel and error carry the step", () => {
  assert.deepEqual(parseSignupMessage(msg("CANCEL", { current_step: "PHONE_NUMBER_SETUP" })), { kind: "cancel", step: "PHONE_NUMBER_SETUP" });
  const error = parseSignupMessage(msg("CANCEL", { error_message: "Number is in use", current_step: "PHONE_NUMBER_VERIFICATION" }));
  assert.equal(error.kind, "error");
  assert.equal(error.message, "Number is in use");
  assert.equal(parseSignupMessage(msg("ERROR", {})).kind, "error");
  assert.equal(describeSignupStep("PHONE_NUMBER_SETUP"), "adding a phone number");
  assert.equal(describeSignupStep("SOMETHING_NEW"), null);
});

test("ignores unrelated or malformed messages", () => {
  assert.equal(parseSignupMessage("not json"), null);
  assert.equal(parseSignupMessage({ type: "OTHER" }), null);
  assert.equal(parseSignupMessage(msg("SOMETHING_ELSE")), null);
  assert.equal(parseSignupMessage(null), null);
});

test("only trusts https facebook.com origins", () => {
  assert.equal(isFacebookOrigin("https://www.facebook.com"), true);
  assert.equal(isFacebookOrigin("https://web.facebook.com"), true);
  assert.equal(isFacebookOrigin("https://facebook.com"), true);
  assert.equal(isFacebookOrigin("http://www.facebook.com"), false);
  assert.equal(isFacebookOrigin("https://evilfacebook.com"), false);
  assert.equal(isFacebookOrigin("https://facebook.com.evil.io"), false);
  assert.equal(isFacebookOrigin("null"), false);
});

test("featureType selects coexistence onboarding", () => {
  assert.equal(featureTypeFor("coexistence"), "whatsapp_business_app_onboarding");
  assert.equal(featureTypeFor("cloud"), "");
});

test("token must be ours, valid, and scoped to the WABA", () => {
  const info = {
    is_valid: true,
    app_id: "567",
    granular_scopes: [
      { scope: "whatsapp_business_management", target_ids: ["111", "112"] },
      { scope: "business_management" },
    ],
  };
  assert.equal(tokenGrantsWaba(info, "111", "567"), true);
  assert.equal(tokenGrantsWaba(info, 112, "567"), true);
  assert.equal(tokenGrantsWaba(info, "999", "567"), false);
  assert.equal(tokenGrantsWaba(info, "111", "other-app"), false);
  assert.equal(tokenGrantsWaba({ ...info, is_valid: false }, "111", "567"), false);
  assert.equal(tokenGrantsWaba(null, "111", "567"), false);
});

test("health problems surface Meta's descriptions", () => {
  assert.deepEqual(healthProblems(null), []);
  assert.deepEqual(healthProblems({ can_send_message: "AVAILABLE", entities: [] }), []);
  assert.deepEqual(
    healthProblems({
      can_send_message: "BLOCKED",
      entities: [{ entity_type: "WABA", errors: [{ error_code: 141006, error_description: "No valid payment method.", possible_solution: "Add a payment method." }] }],
    }),
    ["No valid payment method. Add a payment method."]
  );
  assert.equal(healthProblems({ can_send_message: "LIMITED" }).length, 1);
});
