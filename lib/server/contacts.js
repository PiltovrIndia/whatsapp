const OPT_IN_VALUES = ["true", "yes", "y", "1", "opted in", "opt in", "opt-in", "subscribed"];

/**
 * Normalizes a phone number to E.164 (`+<country><number>`).
 * Numbers written with `+` or `00` are treated as international. When a
 * `defaultCountryCode` is given, national numbers (leading 0 or 10 digits or
 * fewer) get that code prepended; otherwise digits are assumed to already
 * include the country code.
 */
export function normalizePhone(value, { defaultCountryCode } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  let digits = raw.replace(/[^\d]/g, "");
  const international = raw.startsWith("+") || raw.startsWith("00");
  if (raw.startsWith("00")) digits = digits.slice(2);

  const countryCode = String(defaultCountryCode || "").replace(/[^\d]/g, "");
  if (!international && countryCode) {
    if (digits.startsWith("0")) digits = `${countryCode}${digits.replace(/^0+/, "")}`;
    else if (digits.length <= 10) digits = `${countryCode}${digits}`;
  }

  if (digits.length < 8 || digits.length > 15 || digits.startsWith("0")) return null;
  return `+${digits}`;
}

export function normalizeEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  return email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function attributeKey(header) {
  return String(header || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function parseOptIn(value) {
  return OPT_IN_VALUES.includes(String(value ?? "").trim().toLowerCase());
}

/**
 * Converts a spreadsheet row into a contact using a column mapping of
 * `{ [header]: "Phone" | "First Name" | ... | "Attribute" | "Ignore" }`.
 * Returns null when the row has no usable phone number.
 */
export function contactFromMappedRow(row, mapping, options = {}) {
  const contact = {
    firstName: "",
    lastName: "",
    email: null,
    phone: null,
    company: "",
    optIn: options.defaultOptIn ?? true,
    source: "import",
  };
  const attributes = {};

  for (const [sourceField, targetField] of Object.entries(mapping || {})) {
    const value = row[sourceField];
    if (targetField === "First Name") contact.firstName = String(value ?? "").trim().slice(0, 120);
    if (targetField === "Last Name") contact.lastName = String(value ?? "").trim().slice(0, 120);
    if (targetField === "Email") contact.email = normalizeEmail(value);
    if (targetField === "Phone") contact.phone = normalizePhone(value, options);
    if (targetField === "Company") contact.company = String(value ?? "").trim().slice(0, 160);
    if (targetField === "Opt In") contact.optIn = parseOptIn(value);
    if (targetField === "Attribute") {
      const key = attributeKey(sourceField);
      const text = String(value ?? "").trim();
      if (key && text) attributes[key] = text.slice(0, 500);
    }
  }

  if (Object.keys(attributes).length) contact.attributes = attributes;
  return contact.phone ? contact : null;
}

export function sampleTemplateVariables(text) {
  const matches = [...String(text || "").matchAll(/\{\{(\d+)\}\}/g)];
  return [...new Set(matches.map((match) => Number(match[1])))].sort((a, b) => a - b);
}

export function contactDisplayName(contact) {
  const name = `${contact.first_name || ""} ${contact.last_name || ""}`.trim();
  return name || contact.phone;
}
