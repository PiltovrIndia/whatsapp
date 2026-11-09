import crypto from "crypto";
import { requireSession } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { onboardingExchangeSchema } from "@/lib/server/validators";
import { exchangeEmbeddedSignupCode, encryptAccessToken } from "@/lib/server/whatsapp";
import { platformWhatsAppConfig } from "@/lib/server/whatsapp-config";
import { handleApiError, jsonOk } from "@/lib/server/http";

export async function POST(request) {
  try {
    const session = await requireSession();
    if (platformWhatsAppConfig()) {
      const error = new Error("WhatsApp is managed by the platform for this workspace.");
      error.status = 409;
      throw error;
    }
    const payload = onboardingExchangeSchema.parse(await request.json());
    const tokenResponse = await exchangeEmbeddedSignupCode(payload.code);
    const accessToken = tokenResponse.access_token;

    if (!accessToken) {
      const error = new Error("Meta did not return an access token.");
      error.status = 502;
      throw error;
    }

    const result = await withTransaction(async (connection) => {
      const connectionId = crypto.randomUUID();

      await connection.execute(
        `INSERT INTO whatsapp_connections
           (id, organization_id, meta_business_id, waba_id, access_token_encrypted, business_status)
         VALUES
           (:id, :organizationId, :businessId, :wabaId, :accessTokenEncrypted, 'connected')
         ON DUPLICATE KEY UPDATE
           meta_business_id = VALUES(meta_business_id),
           waba_id = VALUES(waba_id),
           access_token_encrypted = VALUES(access_token_encrypted),
           business_status = 'connected'`,
        {
          id: connectionId,
          organizationId: session.organization_id,
          businessId: payload.businessId || null,
          wabaId: payload.wabaId,
          accessTokenEncrypted: encryptAccessToken(accessToken),
        }
      );

      const [connections] = await connection.execute(
        `SELECT id FROM whatsapp_connections
         WHERE organization_id = :organizationId
         LIMIT 1`,
        { organizationId: session.organization_id }
      );
      const savedConnectionId = connections[0].id;

      await connection.execute(
        `INSERT INTO whatsapp_phone_numbers
           (id, organization_id, connection_id, phone_number_id, display_phone_number, status)
         VALUES
           (:id, :organizationId, :connectionId, :phoneNumberId, :displayPhoneNumber, 'connected')
         ON DUPLICATE KEY UPDATE
           display_phone_number = VALUES(display_phone_number),
           status = 'connected'`,
        {
          id: crypto.randomUUID(),
          organizationId: session.organization_id,
          connectionId: savedConnectionId,
          phoneNumberId: payload.phoneNumberId,
          displayPhoneNumber: payload.displayPhoneNumber || null,
        }
      );

      return { connectionId: savedConnectionId };
    });

    return jsonOk({ ok: true, ...result });
  } catch (error) {
    return handleApiError(error);
  }
}
