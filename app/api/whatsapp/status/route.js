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
import { refreshConnectionHealth } from "@/lib/server/embedded-signup";
import { healthProblems } from "@/lib/embedded-signup-utils";
import { platformWhatsAppConfig } from "@/lib/server/whatsapp-config";

function platformAvailable() {
  try {
    return Boolean(platformWhatsAppConfig());
  } catch {
    return false;
  }
}

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

    const signup = {
      configured: configured(process.env.NEXT_PUBLIC_META_APP_ID) && configured(process.env.NEXT_PUBLIC_META_CONFIG_ID),
      platformAvailable: platformAvailable(),
    };

    let connection;
    try {
      connection = await resolveWhatsAppConnection(session.organization_id);
    } catch (error) {
      return jsonOk({ connected: false, mode: null, issues: [error.message, ...issues], env, signup });
    }

    let account = null;
    if (connection.source === "organization") {
      const [row] = await query(
        `SELECT waba_name, onboarding_type, connected_at, currency FROM whatsapp_connections
         WHERE organization_id = :organizationId`,
        { organizationId: session.organization_id }
      );
      const health = await refreshConnectionHealth(session.organization_id, {
        wabaId: connection.wabaId,
        token: connection.accessToken,
      });
      const problems = healthProblems(health);
      issues.push(...problems);
      account = {
        wabaId: connection.wabaId,
        wabaName: row?.waba_name || null,
        onboardingType: row?.onboarding_type || "cloud",
        connectedAt: row?.connected_at || null,
        currency: row?.currency || null,
        canSend: health?.can_send_message || null,
        healthProblems: problems,
      };
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
      const list = apps.data || [];
      const appId = process.env.META_APP_ID;
      const ours = appId
        ? list.some((app) => String(app.whatsapp_business_api_data?.id || app.id) === String(appId))
        : list.length > 0;
      webhook = { subscribed: ours, apps: list.map((app) => app.whatsapp_business_api_data?.name || app.id) };
      if (!webhook.subscribed) issues.push("No app is subscribed to this WhatsApp account's webhooks, so delivery receipts and replies won't arrive.");
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
      platformType: phone?.platform_type || null,
      account,
      issues,
      env,
      signup,
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
