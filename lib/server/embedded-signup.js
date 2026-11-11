import crypto from "crypto";
import { query, withTransaction } from "@/lib/server/db";
import { encryptSecret } from "@/lib/server/crypto";
import { httpError } from "@/lib/server/http";
import { audit } from "@/lib/server/audit";
import { syncTemplates } from "@/lib/server/templates";
import { tokenGrantsWaba } from "@/lib/embedded-signup-utils";
import { platformWhatsAppConfig } from "@/lib/server/whatsapp-config";
import {
  accessTokenFromConnection,
  debugToken,
  encryptAccessToken,
  exchangeEmbeddedSignupCode,
  getPhoneNumberInfo,
  getWabaHealth,
  getWabaInfo,
  registerPhoneNumber,
  subscribeAppToWaba,
  unsubscribeAppFromWaba,
} from "@/lib/server/whatsapp";

function platformPhoneNumberId() {
  try {
    return platformWhatsAppConfig()?.phoneNumberId || null;
  } catch {
    return null;
  }
}

function randomPin() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

/** Stores Meta's health_status for the workspace; never fails the caller. */
export async function refreshConnectionHealth(organizationId, { wabaId, token }) {
  try {
    const health = await getWabaHealth({ wabaId, token });
    await query(
      `UPDATE whatsapp_connections SET health_json = :health, health_checked_at = UTC_TIMESTAMP()
       WHERE organization_id = :organizationId`,
      { organizationId, health: JSON.stringify(health) }
    );
    return health;
  } catch (error) {
    console.error("health check failed", error.message);
    return null;
  }
}

/**
 * Completes Embedded Signup: verifies what the browser reported against Meta,
 * subscribes our app to the WABA, registers the number and saves the connection.
 */
export async function connectWorkspace(session, { code, wabaId, phoneNumberId, businessId, onboardingType }) {
  const organizationId = session.organization_id;

  // The code expires after about 30 seconds, so exchange it before anything else.
  const tokenResponse = await exchangeEmbeddedSignupCode(code);
  const token = tokenResponse.access_token;
  if (!token) throw httpError(502, "Meta did not return an access token. Please try connecting again.");

  const tokenInfo = await debugToken(token);
  if (!tokenGrantsWaba(tokenInfo, wabaId, process.env.META_APP_ID)) {
    throw httpError(403, "Meta didn't grant access to that WhatsApp account. Please try connecting again and approve access to it.");
  }

  if (phoneNumberId === platformPhoneNumberId()) {
    throw httpError(409, "That's the shared TxtIt number. Connect a number that belongs to your business.");
  }
  const [owner] = await query(
    "SELECT organization_id FROM whatsapp_phone_numbers WHERE phone_number_id = :phoneNumberId LIMIT 1",
    { phoneNumberId }
  );
  if (owner && owner.organization_id !== organizationId) {
    throw httpError(409, "This number is already connected to another TxtIt workspace. Disconnect it there first.");
  }

  const [waba, phone] = await Promise.all([
    getWabaInfo({ wabaId, token }),
    getPhoneNumberInfo({ phoneNumberId, token }),
  ]);

  await subscribeAppToWaba({ wabaId, token });

  let pin = null;
  if (onboardingType === "cloud" && phone.status !== "CONNECTED") {
    pin = randomPin();
    try {
      await registerPhoneNumber({ phoneNumberId, token, pin });
    } catch (error) {
      // A retry after a partial failure may find the number already registered.
      const latest = await getPhoneNumberInfo({ phoneNumberId, token }).catch(() => null);
      if (latest?.status !== "CONNECTED") {
        throw httpError(error.status || 422, `Meta couldn't register ${phone.display_phone_number || "this number"} for messaging: ${error.message}`);
      }
      pin = null;
    }
  }

  const connectionId = await withTransaction(async (db) => {
    await db.execute(
      `INSERT INTO whatsapp_connections
         (id, organization_id, meta_business_id, waba_id, waba_name, currency, onboarding_type,
          access_token_encrypted, pin_encrypted, business_status, webhook_subscribed, connected_by, connected_at)
       VALUES
         (:id, :organizationId, :businessId, :wabaId, :wabaName, :currency, :onboardingType,
          :token, :pin, 'connected', 1, :userId, UTC_TIMESTAMP())
       ON DUPLICATE KEY UPDATE
         -- Runs before waba_id is overwritten: keep the PIN only for the same account.
         pin_encrypted = COALESCE(VALUES(pin_encrypted), IF(waba_id = VALUES(waba_id), pin_encrypted, NULL)),
         meta_business_id = VALUES(meta_business_id),
         waba_id = VALUES(waba_id),
         waba_name = VALUES(waba_name),
         currency = VALUES(currency),
         onboarding_type = VALUES(onboarding_type),
         access_token_encrypted = VALUES(access_token_encrypted),
         business_status = 'connected',
         webhook_subscribed = 1,
         connected_by = VALUES(connected_by),
         connected_at = UTC_TIMESTAMP(),
         health_json = NULL,
         health_checked_at = NULL`,
      {
        id: crypto.randomUUID(),
        organizationId,
        businessId: businessId || waba.owner_business_info?.id || null,
        wabaId,
        wabaName: waba.name || null,
        currency: waba.currency || null,
        onboardingType,
        token: encryptAccessToken(token),
        pin: pin ? encryptSecret(pin) : null,
        userId: session.user_id || null,
      }
    );
    const [[saved]] = await db.execute(
      "SELECT id FROM whatsapp_connections WHERE organization_id = :organizationId",
      { organizationId }
    );

    // One number per workspace: replace whatever was connected before.
    await db.execute(
      "DELETE FROM whatsapp_phone_numbers WHERE connection_id = :connectionId AND phone_number_id <> :phoneNumberId",
      { connectionId: saved.id, phoneNumberId }
    );
    await db.execute(
      `INSERT INTO whatsapp_phone_numbers
         (id, organization_id, connection_id, phone_number_id, display_phone_number, verified_name,
          quality_rating, platform_type, name_status, status)
       VALUES
         (:id, :organizationId, :connectionId, :phoneNumberId, :display, :verifiedName,
          :quality, :platformType, :nameStatus, 'connected')
       ON DUPLICATE KEY UPDATE
         connection_id = VALUES(connection_id),
         display_phone_number = VALUES(display_phone_number),
         verified_name = VALUES(verified_name),
         quality_rating = VALUES(quality_rating),
         platform_type = VALUES(platform_type),
         name_status = VALUES(name_status),
         status = 'connected'`,
      {
        id: crypto.randomUUID(),
        organizationId,
        connectionId: saved.id,
        phoneNumberId,
        display: phone.display_phone_number || null,
        verifiedName: phone.verified_name || null,
        quality: phone.quality_rating || null,
        platformType: phone.platform_type || null,
        nameStatus: phone.name_status || null,
      }
    );
    return saved.id;
  });

  const connection = { source: "organization", wabaId, phoneNumberId, accessToken: token };
  const [health, templateCount] = await Promise.all([
    refreshConnectionHealth(organizationId, { wabaId, token }),
    syncTemplates(organizationId, connection).catch((error) => {
      console.error("template sync after connect failed", error.message);
      return null;
    }),
  ]);

  await audit(session, "whatsapp.connect", {
    wabaId,
    phoneNumberId,
    displayPhoneNumber: phone.display_phone_number || null,
    onboardingType,
  });

  return {
    connectionId,
    wabaId,
    wabaName: waba.name || null,
    phoneNumberId,
    displayPhoneNumber: phone.display_phone_number || null,
    verifiedName: phone.verified_name || null,
    onboardingType,
    registered: Boolean(pin),
    templatesSynced: templateCount,
    health,
  };
}

/**
 * Disconnects the workspace's own number. The number and WABA stay the
 * customer's; the workspace falls back to the shared number.
 */
export async function disconnectWorkspace(session) {
  const organizationId = session.organization_id;
  const [row] = await query(
    `SELECT wc.id, wc.waba_id, wc.access_token_encrypted, pn.phone_number_id, pn.display_phone_number
     FROM whatsapp_connections wc
     LEFT JOIN whatsapp_phone_numbers pn ON pn.connection_id = wc.id
     WHERE wc.organization_id = :organizationId LIMIT 1`,
    { organizationId }
  );
  if (!row) throw httpError(404, "This workspace doesn't have its own WhatsApp number connected.");

  let unsubscribed = true;
  try {
    await unsubscribeAppFromWaba({ wabaId: row.waba_id, token: accessTokenFromConnection(row) });
  } catch (error) {
    // The customer may already have removed our app in Meta; disconnect anyway.
    unsubscribed = false;
    console.error("unsubscribe on disconnect failed", error.message);
  }

  // Phone rows go with the connection (ON DELETE CASCADE). Templates stay,
  // scoped to that WABA, and come back if the same account is reconnected.
  await query("DELETE FROM whatsapp_connections WHERE id = :id", { id: row.id });
  await audit(session, "whatsapp.disconnect", {
    wabaId: row.waba_id,
    phoneNumberId: row.phone_number_id,
    displayPhoneNumber: row.display_phone_number,
    unsubscribed,
  });
  return { ok: true, unsubscribed };
}
