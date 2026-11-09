import { requireRole, requireSession } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import {
  getPhoneNumberInfo,
  getSubscribedApps,
  resolveWhatsAppConnection,
  subscribeAppToWaba,
} from "@/lib/server/whatsapp";
import { handleApiError, httpError, jsonOk } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";

function configured(value) {
  return Boolean(value && !/replace/i.test(value));
}

/** Health check of the WhatsApp connection used by this workspace. */
export async function GET() {
  try {
    const session = await requireSession();
    const issues = [];
    const env = {
      appSecret: configured(process.env.META_APP_SECRET),
      appId: configured(process.env.META_APP_ID),
      webhookVerifyToken: configured(process.env.META_WEBHOOK_VERIFY_TOKEN),
    };
    if (!env.appSecret) issues.push("META_APP_SECRET is not set, so webhook events (delivery receipts, replies, template approvals) are rejected.");
    if (!env.webhookVerifyToken) issues.push("META_WEBHOOK_VERIFY_TOKEN is not set, so Meta cannot verify the webhook URL.");
    if (!env.appId) issues.push("META_APP_ID is not set, so image, video and document template headers can't be uploaded.");

    let connection;
    try {
      connection = await resolveWhatsAppConnection(session.organization_id);
    } catch (error) {
      return jsonOk({ connected: false, mode: null, issues: [error.message, ...issues], env });
    }

    let phone = null;
    let webhook = null;
    try {
      phone = await getPhoneNumberInfo({ phoneNumberId: connection.phoneNumberId, token: connection.accessToken });
      if (phone.quality_rating === "RED") issues.push("Phone number quality is LOW. Sending may be limited by Meta.");
      if (phone.name_status && !["APPROVED", "AVAILABLE_WITHOUT_REVIEW"].includes(phone.name_status)) {
        issues.push(`Display name status is ${phone.name_status}.`);
      }
    } catch (error) {
      issues.push(`Could not read the phone number from Meta: ${error.message}`);
    }
    try {
      const apps = await getSubscribedApps({ wabaId: connection.wabaId, token: connection.accessToken });
      webhook = { subscribed: (apps.data || []).length > 0, apps: (apps.data || []).map((app) => app.whatsapp_business_api_data?.name || app.id) };
      if (!webhook.subscribed) issues.push("No app is subscribed to this WhatsApp account's webhooks.");
    } catch (error) {
      issues.push(`Could not read webhook subscriptions: ${error.message}`);
    }

    const [lastEvent] = await query(
      "SELECT received_at FROM webhook_events WHERE organization_id = :organizationId ORDER BY received_at DESC LIMIT 1",
      { organizationId: session.organization_id }
    );

    return jsonOk({
      connected: Boolean(phone),
      mode: connection.source,
      phoneNumberId: connection.phoneNumberId,
      displayPhoneNumber: phone?.display_phone_number || connection.displayPhoneNumber,
      verifiedName: phone?.verified_name || null,
      qualityRating: phone?.quality_rating || null,
      messagingLimitTier: phone?.messaging_limit_tier || null,
      nameStatus: phone?.name_status || null,
      webhook,
      lastWebhookAt: lastEvent?.received_at || null,
      issues,
      env,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Subscribes the Meta app to the WABA's webhooks. */
export async function POST() {
  try {
    const session = await requireSession();
    requireRole(session, ["owner", "admin"]);
    const connection = await resolveWhatsAppConnection(session.organization_id);
    if (connection.source === "platform") {
      throw httpError(409, "The shared WhatsApp number is managed by the platform operator. Run `npm run check:config -- --subscribe` on the server.");
    }
    await subscribeAppToWaba({ wabaId: connection.wabaId, token: connection.accessToken });
    await audit(session, "whatsapp.webhook_subscribe", {});
    return jsonOk({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
