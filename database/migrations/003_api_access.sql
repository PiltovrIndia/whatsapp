-- Developer API: API keys, outbound webhooks, and API-originated sends.

CREATE TABLE IF NOT EXISTS api_keys (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  key_prefix VARCHAR(16) NOT NULL,
  key_hash CHAR(64) NOT NULL,
  created_by CHAR(36),
  last_used_at TIMESTAMP NULL,
  revoked_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_api_keys_hash (key_hash),
  KEY idx_api_keys_org (organization_id, created_at),
  CONSTRAINT fk_api_keys_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_api_keys_user FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  url VARCHAR(2048) NOT NULL,
  secret_encrypted TEXT NOT NULL,
  events_json JSON NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  failure_count INT NOT NULL DEFAULT 0,
  last_success_at TIMESTAMP NULL,
  last_failure_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_webhook_endpoints_org (organization_id),
  CONSTRAINT fk_webhook_endpoints_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  endpoint_id CHAR(36) NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'pending',
  attempts INT NOT NULL DEFAULT 0,
  next_attempt_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  last_status_code INT NULL,
  last_error VARCHAR(500) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  delivered_at TIMESTAMP NULL,
  KEY idx_webhook_deliveries_due (status, next_attempt_at),
  KEY idx_webhook_deliveries_org (organization_id, created_at),
  CONSTRAINT fk_webhook_deliveries_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_webhook_deliveries_endpoint FOREIGN KEY (endpoint_id) REFERENCES webhook_endpoints(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

ALTER TABLE send_jobs
  ADD COLUMN source VARCHAR(16) NOT NULL DEFAULT 'campaign',
  ADD COLUMN api_key_id CHAR(36) NULL,
  ADD COLUMN idempotency_key VARCHAR(128) NULL,
  ADD UNIQUE KEY uniq_send_jobs_idempotency (organization_id, idempotency_key),
  ADD KEY idx_send_jobs_org_source (organization_id, source, created_at);

ALTER TABLE send_job_recipients
  ADD COLUMN values_json JSON NULL,
  ADD COLUMN client_reference VARCHAR(255) NULL,
  ADD KEY idx_recipients_reference (client_reference);
