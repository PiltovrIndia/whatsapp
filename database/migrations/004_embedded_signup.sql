-- Embedded Signup: workspaces connect their own WhatsApp Business Account.
-- The shared platform number stays as the fallback for workspaces without one.

ALTER TABLE whatsapp_connections
  ADD COLUMN waba_name VARCHAR(255) NULL AFTER waba_id,
  ADD COLUMN currency VARCHAR(8) NULL AFTER waba_name,
  ADD COLUMN onboarding_type VARCHAR(16) NOT NULL DEFAULT 'cloud' AFTER currency,
  ADD COLUMN pin_encrypted TEXT NULL AFTER access_token_encrypted,
  ADD COLUMN connected_by CHAR(36) NULL,
  ADD COLUMN health_json JSON NULL,
  ADD COLUMN health_checked_at DATETIME NULL;

-- Webhooks are routed by phone_number_id, so a number can belong to one workspace only.
ALTER TABLE whatsapp_phone_numbers
  ADD COLUMN platform_type VARCHAR(32) NULL AFTER quality_rating,
  ADD COLUMN name_status VARCHAR(64) NULL AFTER platform_type,
  ADD UNIQUE KEY uniq_phone_number_id (phone_number_id);

-- Templates belong to a WhatsApp Business Account. A workspace sees the
-- templates of the account it currently sends from.
ALTER TABLE templates
  ADD COLUMN waba_id VARCHAR(64) NULL AFTER organization_id;

-- scripts/migrate.mjs sets @platform_waba_id from PLATFORM_WHATSAPP_WABA_ID.
-- Until now every workspace sent from the platform number, so every existing
-- template lives on the platform WABA.
UPDATE templates SET waba_id = @platform_waba_id
WHERE waba_id IS NULL AND @platform_waba_id IS NOT NULL;

ALTER TABLE templates
  DROP INDEX uniq_org_template_lang,
  ADD UNIQUE KEY uniq_org_waba_template_lang (organization_id, waba_id, name, language);
