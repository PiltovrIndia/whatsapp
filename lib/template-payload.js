// Builds and validates WhatsApp message template definitions for the Meta
// Cloud API (`POST /{waba-id}/message_templates`). Pure functions only, so
// they are shared by the template builder UI and the API route.

const VARIABLE_PATTERN = /\{\{\s*(\d+)\s*\}\}/g;
const MEDIA_HEADERS = ["IMAGE", "DOCUMENT", "VIDEO"];

export function variableIndexes(text) {
  return [...String(text || "").matchAll(VARIABLE_PATTERN)].map((match) => Number(match[1]));
}

export function uniqueVariableIndexes(text) {
  return [...new Set(variableIndexes(text))].sort((a, b) => a - b);
}

function isSequential(indexes) {
  return indexes.every((value, position) => value === position + 1);
}

function orderedButtons(buttons = []) {
  // Meta requires quick replies and call-to-action buttons to be grouped.
  return [
    ...buttons.filter((button) => button.type === "QUICK_REPLY"),
    ...buttons.filter((button) => button.type !== "QUICK_REPLY"),
  ];
}

/** Returns a list of human-readable problems; empty when the template is valid. */
export function validateTemplateInput(template) {
  const errors = [];
  const name = String(template.name || "");

  if (!/^[a-z0-9_]{1,512}$/.test(name)) {
    errors.push("Name may only contain lowercase letters, numbers and underscores.");
  }

  if (template.category === "AUTHENTICATION") {
    const minutes = template.auth?.codeExpirationMinutes;
    if (minutes != null && minutes !== "" && (Number(minutes) < 1 || Number(minutes) > 90)) {
      errors.push("Code expiration must be between 1 and 90 minutes.");
    }
    return errors;
  }

  const body = String(template.bodyText || "");
  const bodyVars = uniqueVariableIndexes(body);

  if (!body.trim()) errors.push("Body text is required.");
  if (body.length > 1024) errors.push("Body text must be 1024 characters or fewer.");
  if (!isSequential(bodyVars)) {
    errors.push("Body variables must be numbered in order starting at {{1}} with no gaps.");
  }
  if (/^\s*\{\{\s*\d+\s*\}\}/.test(body) || /\{\{\s*\d+\s*\}\}\s*$/.test(body)) {
    errors.push("Body text can't start or end with a variable. Add words before and after it.");
  }
  if (/\{\{\s*\d+\s*\}\}\s*\{\{\s*\d+\s*\}\}/.test(body)) {
    errors.push("Body variables must be separated by text.");
  }
  for (const index of bodyVars) {
    if (!String(template.examples?.[index] ?? "").trim()) {
      errors.push(`Add a sample value for body variable {{${index}}}.`);
    }
  }

  if (template.headerType === "TEXT") {
    const headerText = String(template.headerText || "");
    const headerVars = variableIndexes(headerText);
    if (!headerText.trim()) errors.push("Header text is required for a text header.");
    if (headerText.length > 60) errors.push("Header text must be 60 characters or fewer.");
    if (headerVars.length > 1 || (headerVars.length === 1 && headerVars[0] !== 1)) {
      errors.push("A text header can contain at most one variable, {{1}}.");
    }
    if (headerVars.length && !String(template.headerExample || "").trim()) {
      errors.push("Add a sample value for the header variable.");
    }
  }

  if (MEDIA_HEADERS.includes(template.headerType) && !template.headerHandle) {
    errors.push(`Upload a sample ${template.headerType.toLowerCase()} for the header.`);
  }

  if (template.footerText) {
    if (template.footerText.length > 60) errors.push("Footer must be 60 characters or fewer.");
    if (variableIndexes(template.footerText).length) errors.push("Footer text can't contain variables.");
  }

  const buttons = template.buttons || [];
  if (buttons.length > 10) errors.push("A template can have at most 10 buttons.");
  if (buttons.filter((button) => button.type === "URL").length > 2) {
    errors.push("A template can have at most 2 URL buttons.");
  }
  if (buttons.filter((button) => button.type === "PHONE_NUMBER").length > 1) {
    errors.push("A template can have at most 1 phone number button.");
  }

  buttons.forEach((button, position) => {
    const label = `Button ${position + 1}`;
    if (!String(button.text || "").trim()) errors.push(`${label}: text is required.`);
    if (String(button.text || "").length > 25) errors.push(`${label}: text must be 25 characters or fewer.`);

    if (button.type === "URL") {
      const url = String(button.url || "");
      const urlVars = variableIndexes(url);
      if (!/^https?:\/\/[^\s]+$/i.test(url.replace(VARIABLE_PATTERN, "x"))) {
        errors.push(`${label}: enter a valid URL starting with https://.`);
      }
      if (urlVars.length > 1 || (urlVars.length === 1 && !/\{\{\s*1\s*\}\}$/.test(url))) {
        errors.push(`${label}: a URL may contain one variable, {{1}}, at the very end.`);
      }
      if (urlVars.length && !String(button.urlExample || "").trim()) {
        errors.push(`${label}: add a sample value for the URL variable.`);
      }
    }

    if (button.type === "PHONE_NUMBER" && !/^\+[1-9]\d{7,14}$/.test(String(button.phoneNumber || ""))) {
      errors.push(`${label}: enter the phone number in international format, e.g. +14155550123.`);
    }
  });

  return errors;
}

function buildAuthenticationComponents(template) {
  const auth = template.auth || {};
  const components = [
    { type: "BODY", add_security_recommendation: Boolean(auth.addSecurityRecommendation) },
  ];
  const minutes = Number(auth.codeExpirationMinutes);
  if (minutes >= 1 && minutes <= 90) {
    components.push({ type: "FOOTER", code_expiration_minutes: minutes });
  }
  components.push({
    type: "BUTTONS",
    buttons: [{ type: "OTP", otp_type: "COPY_CODE", text: auth.otpButtonText || "Copy code" }],
  });
  return components;
}

function stripUndefined(object) {
  return Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined));
}

export function buildTemplatePayload(template) {
  if (template.category === "AUTHENTICATION") {
    return {
      name: template.name,
      language: template.language,
      category: template.category,
      components: buildAuthenticationComponents(template),
    };
  }

  const components = [];

  if (template.headerType === "TEXT" && template.headerText) {
    const hasVariable = variableIndexes(template.headerText).length > 0;
    components.push(stripUndefined({
      type: "HEADER",
      format: "TEXT",
      text: template.headerText,
      example: hasVariable ? { header_text: [String(template.headerExample || "")] } : undefined,
    }));
  } else if (MEDIA_HEADERS.includes(template.headerType)) {
    components.push({
      type: "HEADER",
      format: template.headerType,
      example: { header_handle: [template.headerHandle].filter(Boolean) },
    });
  }

  const bodyVars = uniqueVariableIndexes(template.bodyText);
  components.push(stripUndefined({
    type: "BODY",
    text: template.bodyText,
    example: bodyVars.length
      ? { body_text: [bodyVars.map((index) => String(template.examples?.[index] ?? ""))] }
      : undefined,
  }));

  if (template.footerText) {
    components.push({ type: "FOOTER", text: template.footerText });
  }

  if (template.buttons?.length) {
    components.push({
      type: "BUTTONS",
      buttons: orderedButtons(template.buttons).map((button) => {
        if (button.type === "QUICK_REPLY") {
          return { type: "QUICK_REPLY", text: button.text };
        }
        if (button.type === "URL") {
          const dynamic = variableIndexes(button.url).length > 0;
          return stripUndefined({
            type: "URL",
            text: button.text,
            url: button.url,
            example: dynamic
              ? [String(button.url).replace(VARIABLE_PATTERN, String(button.urlExample || ""))]
              : undefined,
          });
        }
        return {
          type: "PHONE_NUMBER",
          text: button.text,
          phone_number: button.phoneNumber,
        };
      }),
    });
  }

  return {
    name: template.name,
    language: template.language,
    category: template.category,
    components,
  };
}

/** Extracts the flat columns we store locally from Meta-format components. */
export function summarizeComponents(components = []) {
  const header = components.find((component) => component.type === "HEADER");
  const body = components.find((component) => component.type === "BODY");
  const footer = components.find((component) => component.type === "FOOTER");
  const buttons = components.find((component) => component.type === "BUTTONS")?.buttons || [];

  return {
    headerType: header?.format || "NONE",
    headerText: header?.format === "TEXT" ? header.text || null : null,
    bodyText: body?.text || (body?.add_security_recommendation !== undefined
      ? "{{1}} is your verification code."
      : ""),
    footerText: footer?.text || (footer?.code_expiration_minutes
      ? `This code expires in ${footer.code_expiration_minutes} minutes.`
      : null),
    buttons,
  };
}
