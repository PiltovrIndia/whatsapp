import { z } from "zod";

export const signupSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(8, "Password must be at least 8 characters.").max(200),
  fullName: z.string().trim().min(2).max(120),
  organizationName: z.string().trim().min(2).max(160),
});

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(200),
});

export const IMPORT_TARGETS = ["Ignore", "Phone", "First Name", "Last Name", "Email", "Company", "Opt In", "Attribute"];

export const contactImportSchema = z.object({
  listName: z.string().trim().min(1).max(120).default("All Contacts"),
  mapping: z.record(z.string(), z.enum(IMPORT_TARGETS)),
  rows: z.array(z.record(z.string(), z.unknown())).min(1).max(50000),
  source: z.string().max(120).default("import"),
  defaultCountryCode: z.string().regex(/^\+?\d{1,4}$/).optional().or(z.literal("")),
  consentConfirmed: z.boolean().optional().default(false),
});

const attributesSchema = z
  .record(z.string().regex(/^[a-z0-9_]{1,64}$/, "Attribute keys use lowercase letters, numbers and _"), z.string().max(500))
  .optional();

export const contactSchema = z.object({
  firstName: z.string().trim().max(120).optional().default(""),
  lastName: z.string().trim().max(120).optional().default(""),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),
  phone: z.string().trim().min(6).max(24),
  company: z.string().trim().max(160).optional().default(""),
  optIn: z.boolean().optional().default(true),
  source: z.string().max(120).optional().default("manual"),
  attributes: attributesSchema,
  listIds: z.array(z.string()).max(50).optional().default([]),
});

export const contactUpdateSchema = contactSchema
  .omit({ source: true, listIds: true })
  .partial();

export const contactBulkSchema = z.object({
  action: z.enum(["delete", "addToList", "removeFromList", "optIn", "optOut"]),
  contactIds: z.array(z.string().min(1)).min(1).max(5000),
  listId: z.string().optional(),
});

export const contactListSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const buttonSchema = z.object({
  type: z.enum(["QUICK_REPLY", "URL", "PHONE_NUMBER"]),
  text: z.string().trim().min(1).max(25),
  url: z.string().max(2000).optional(),
  urlExample: z.string().max(2000).optional(),
  phoneNumber: z.string().max(20).optional(),
});

export const templateSchema = z.object({
  name: z.string().trim().regex(/^[a-z0-9_]{1,512}$/, "Use lowercase letters, numbers and underscores only."),
  language: z.string().min(2).max(12),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]),
  headerType: z.enum(["NONE", "TEXT", "IMAGE", "DOCUMENT", "VIDEO"]).default("NONE"),
  headerText: z.string().max(60).optional().default(""),
  headerExample: z.string().max(200).optional().default(""),
  headerHandle: z.string().max(4000).optional().default(""),
  bodyText: z.string().max(1024).optional().default(""),
  footerText: z.string().max(60).optional().default(""),
  buttons: z.array(buttonSchema).max(10).default([]),
  examples: z.record(z.string(), z.string().max(200)).optional().default({}),
  auth: z
    .object({
      addSecurityRecommendation: z.boolean().optional().default(true),
      codeExpirationMinutes: z.coerce.number().int().min(1).max(90).optional(),
      otpButtonText: z.string().max(25).optional(),
    })
    .optional(),
});

const variableRuleSchema = z.union([
  z.object({ source: z.literal("static"), value: z.string().max(1024) }),
  z.object({
    source: z.literal("field"),
    field: z.string().regex(/^(first_name|last_name|full_name|phone|email|company|attr:[a-z0-9_]{1,64})$/),
    fallback: z.string().max(1024).optional().default(""),
  }),
]);

export const campaignSchema = z.object({
  name: z.string().trim().max(160).optional().default(""),
  templateId: z.string().min(1),
  audience: z.discriminatedUnion("type", [
    z.object({ type: z.literal("all") }),
    z.object({ type: z.literal("lists"), listIds: z.array(z.string().min(1)).min(1).max(50) }),
    z.object({ type: z.literal("contacts"), contactIds: z.array(z.string().min(1)).min(1).max(10000) }),
  ]),
  variables: z.record(z.string(), variableRuleSchema).optional().default({}),
  headerMedia: z
    .object({
      link: z.string().url().optional(),
      id: z.string().max(200).optional(),
      filename: z.string().max(240).optional(),
    })
    .refine((value) => value.link || value.id, "Provide a media link or upload a file.")
    .optional()
    .nullable(),
  scheduledAt: z.string().datetime({ offset: true }).optional().nullable(),
});

export const onboardingExchangeSchema = z.object({
  code: z.string().min(1),
  wabaId: z.string().min(1),
  phoneNumberId: z.string().min(1),
  businessId: z.string().optional(),
  displayPhoneNumber: z.string().optional(),
});

// ---- Developer API ----

const apiScalar = z.union([z.string().max(1024), z.number(), z.boolean()]).transform(String);
const apiVariables = z.union([
  z.array(apiScalar).max(100),
  z.object({
    header: z.union([apiScalar, z.array(apiScalar).max(1)]).optional(),
    body: z.array(apiScalar).max(100).optional(),
    buttons: z.array(apiScalar).max(10).optional(),
    code: apiScalar.optional(),
  }),
]);
const apiRecipient = z.object({
  to: z.union([z.string(), z.number()]).transform(String),
  variables: apiVariables.optional(),
  reference: z.string().max(255).optional(),
});

export const apiSendSchema = z
  .object({
    template: z.string().trim().min(1).max(512),
    language: z.string().trim().min(2).max(15).optional(),
    to: z.union([z.string(), z.number()]).transform(String).optional(),
    variables: apiVariables.optional(),
    reference: z.string().max(255).optional(),
    header_media: z
      .object({
        link: z.string().url().refine((value) => value.startsWith("https://"), "Media links must use https://.").optional(),
        id: z.string().max(200).optional(),
        filename: z.string().max(240).optional(),
      })
      .refine((value) => value.link || value.id, "Provide header_media.link or header_media.id.")
      .optional(),
    messages: z.array(apiRecipient).min(1).max(1000).optional(),
  })
  .refine((value) => Boolean(value.to) !== Boolean(value.messages), {
    message: "Send either `to` (one message) or `messages` (a batch), not both.",
    path: ["to"],
  });

export const apiKeyCreateSchema = z.object({
  name: z.string().trim().min(1, "Give the key a name.").max(120),
});

export const webhookEndpointSchema = z.object({
  url: z.string().trim().min(1, "Enter a webhook URL.").max(2048),
  events: z.array(z.string()).max(20).optional(),
  active: z.boolean().optional(),
  rotateSecret: z.boolean().optional(),
});
