import assert from "node:assert/strict";
import test from "node:test";
import {
  contactFromMappedRow,
  normalizeEmail,
  normalizePhone,
  sampleTemplateVariables,
} from "../lib/server/contacts.js";
import {
  CONTACT_TEMPLATE_HEADERS,
  CONTACT_TEMPLATE_INSTRUCTIONS,
} from "../lib/contact-template.js";

test("normalizes phone numbers to E.164-like values", () => {
  assert.equal(normalizePhone("(415) 555-0199"), "+4155550199");
  assert.equal(normalizePhone("+91 98765 43210"), "+919876543210");
  assert.equal(normalizePhone("123"), null);
});

test("maps imported rows into contacts and skips rows without phones", () => {
  const mapping = {
    Mobile: "Phone",
    First: "First Name",
    Email: "Email",
    Consent: "Opt In",
  };

  assert.deepEqual(contactFromMappedRow({
    Mobile: "+1 415 555 0199",
    First: "Asha",
    Email: "ASHA@EXAMPLE.COM",
    Consent: "yes",
  }, mapping), {
    firstName: "Asha",
    lastName: "",
    email: "asha@example.com",
    phone: "+14155550199",
    company: "",
    optIn: true,
    source: "import",
  });

  assert.equal(contactFromMappedRow({ First: "No Phone" }, mapping), null);
});

test("extracts unique ordered template variable indexes", () => {
  assert.deepEqual(sampleTemplateVariables("Hi {{2}} {{1}} {{2}}"), [1, 2]);
  assert.equal(normalizeEmail("bad-email"), null);
});

test("contact template uses importer-recognized fields and documents required consent", () => {
  assert.deepEqual(CONTACT_TEMPLATE_HEADERS, [
    "First Name",
    "Last Name",
    "Phone",
    "Email",
    "Company",
    "Opt In",
  ]);
  assert.equal(CONTACT_TEMPLATE_INSTRUCTIONS.some((row) => row[0] === "Phone" && row[1] === "Yes"), true);
  assert.equal(CONTACT_TEMPLATE_INSTRUCTIONS.some((row) => row[0] === "Opt In" && row[1] === "Yes"), true);
});

test("applies a default country code to national numbers only", () => {
  assert.equal(normalizePhone("98765 43210", { defaultCountryCode: "91" }), "+919876543210");
  assert.equal(normalizePhone("098765 43210", { defaultCountryCode: "+91" }), "+919876543210");
  assert.equal(normalizePhone("919876543210", { defaultCountryCode: "91" }), "+919876543210");
  assert.equal(normalizePhone("+1 415 555 0199", { defaultCountryCode: "91" }), "+14155550199");
  assert.equal(normalizePhone("0044 7700 900123"), "+447700900123");
});

test("keeps unmapped columns as custom attributes", () => {
  const contact = contactFromMappedRow(
    { Phone: "+919876543210", "Order ID": " 1042 ", Notes: "" },
    { Phone: "Phone", "Order ID": "Attribute", Notes: "Attribute" }
  );
  assert.deepEqual(contact.attributes, { order_id: "1042" });
});
