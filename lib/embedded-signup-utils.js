// Pure helpers for Meta's WhatsApp Embedded Signup, shared by client and server.

export const ONBOARDING_TYPES = ["cloud", "coexistence"];

/** FB.login `extras.featureType` for each onboarding type. */
export function featureTypeFor(onboardingType) {
  return onboardingType === "coexistence" ? "whatsapp_business_app_onboarding" : "";
}

export function isFacebookOrigin(origin) {
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && (hostname === "facebook.com" || hostname.endsWith(".facebook.com"));
  } catch {
    return false;
  }
}

/**
 * Parses the `WA_EMBEDDED_SIGNUP` postMessage the signup popup sends.
 * Returns null for unrelated messages.
 *
 *  { kind: "finish", onboardingType, wabaId, phoneNumberId, businessId }
 *  { kind: "no_phone", wabaId, businessId }  – user created a WABA but added no number
 *  { kind: "cancel", step }
 *  { kind: "error", message, step }
 */
export function parseSignupMessage(raw) {
  let message = raw;
  if (typeof raw === "string") {
    try {
      message = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!message || message.type !== "WA_EMBEDDED_SIGNUP") return null;

  const data = message.data || {};
  const event = String(message.event || "");
  const ids = {
    wabaId: data.waba_id ? String(data.waba_id) : null,
    phoneNumberId: data.phone_number_id ? String(data.phone_number_id) : null,
    businessId: data.business_id ? String(data.business_id) : null,
  };

  if (event === "FINISH" || event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING") {
    if (!ids.wabaId || !ids.phoneNumberId) return { kind: "no_phone", ...ids };
    return {
      kind: "finish",
      onboardingType: event === "FINISH" ? "cloud" : "coexistence",
      ...ids,
    };
  }
  if (event === "FINISH_ONLY_WABA") return { kind: "no_phone", ...ids };
  if (event === "CANCEL") {
    if (data.error_message) return { kind: "error", message: String(data.error_message), step: data.current_step || null };
    return { kind: "cancel", step: data.current_step || null };
  }
  if (event === "ERROR") {
    return { kind: "error", message: String(data.error_message || "Meta reported an error during signup."), step: data.current_step || null };
  }
  return null;
}

/**
 * True when a debug_token result shows the token was issued by our app and can
 * manage the given WABA. Stops a browser from claiming someone else's account.
 */
export function tokenGrantsWaba(tokenInfo, wabaId, appId) {
  if (!tokenInfo || !tokenInfo.is_valid) return false;
  if (appId && String(tokenInfo.app_id) !== String(appId)) return false;
  const target = String(wabaId);
  return (tokenInfo.granular_scopes || []).some((grant) =>
    ["whatsapp_business_management", "whatsapp_business_messaging"].includes(grant.scope) &&
    (grant.target_ids || []).map(String).includes(target)
  );
}

/** Human labels for the step a user reached before cancelling. */
export function describeSignupStep(step) {
  const labels = {
    BUSINESS_ACCOUNT_SELECTION: "choosing a business portfolio",
    WABA_PHONE_PROFILE_PICKER: "choosing a WhatsApp account",
    PHONE_NUMBER_SETUP: "adding a phone number",
    PHONE_NUMBER_VERIFICATION: "verifying the phone number",
    WHATSAPP_BUSINESS_PROFILE_SETUP: "setting up the business profile",
    PERMISSIONS: "granting permissions",
  };
  return labels[step] || null;
}

/** Summarises Meta's `health_status` into problems a user can act on. */
export function healthProblems(health) {
  if (!health) return [];
  const problems = [];
  for (const entity of health.entities || []) {
    for (const error of entity.errors || []) {
      const text = [error.error_description, error.possible_solution].filter(Boolean).join(" ");
      if (text && !problems.includes(text)) problems.push(text);
    }
  }
  if (!problems.length && health.can_send_message && health.can_send_message !== "AVAILABLE") {
    problems.push(health.can_send_message === "LIMITED"
      ? "Meta says this account can only send limited messages."
      : "Meta says this account can't send messages yet.");
  }
  return problems;
}
