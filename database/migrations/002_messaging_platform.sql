-- Messaging platform: background send queue, delivery tracking, opt-outs,
-- contact attributes, template review metadata, and auth rate limiting.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET SESSION time_zone = '+00:00';

ALTER TABLE contacts
  ADD COLUMN wa_id VARCHAR(20) NULL AFTER phone,
  ADD COLUMN attributes_json JSON NULL,
  ADD COLUMN opted_out_at DATETIME NULL,
  ADD COLUMN opt_out_reason VARCHAR(120) NULL,
  ADD COLUMN last_inbound_at DATETIME NULL,
  ADD KEY idx_contacts_org_created (organization_id, created_at),
  ADD KEY idx_contacts_wa_id (wa_id);

ALTER TABLE templates
  ADD COLUMN rejected_reason VARCHAR(512) NULL,
  ADD COLUMN last_synced_at DATETIME NULL,
  ADD KEY idx_templates_meta_template (meta_template_id);

ALTER TABLE send_jobs
  ADD COLUMN name VARCHAR(160) NULL AFTER template_id,
  ADD COLUMN audience_json JSON NULL,
  ADD COLUMN header_media_json JSON NULL,
  ADD COLUMN scheduled_at DATETIME NULL,
  ADD COLUMN started_at DATETIME NULL,
  ADD COLUMN completed_at DATETIME NULL,
  ADD COLUMN updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

ALTER TABLE send_job_recipients
  ADD COLUMN phone VARCHAR(20) NULL AFTER contact_id,
  ADD COLUMN variables_json JSON NULL,
  ADD COLUMN attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN next_attempt_at DATETIME NULL,
  ADD COLUMN locked_until DATETIME NULL,
  ADD COLUMN error_code VARCHAR(32) NULL,
  ADD COLUMN sent_at DATETIME NULL,
  ADD COLUMN delivered_at DATETIME NULL,
  ADD COLUMN read_at DATETIME NULL,
  ADD COLUMN failed_at DATETIME NULL,
  ADD KEY idx_recipients_queue (status, next_attempt_at),
  ADD KEY idx_recipients_job_status (send_job_id, status);

ALTER TABLE message_logs
  ADD COLUMN wa_id VARCHAR(20) NULL AFTER meta_message_id,
  ADD COLUMN message_type VARCHAR(32) NULL,
  ADD COLUMN body_text TEXT NULL,
  ADD COLUMN error_code VARCHAR(32) NULL,
  ADD COLUMN error_message TEXT NULL,
  ADD COLUMN status_payload_json JSON NULL,
  ADD COLUMN status_updated_at DATETIME NULL,
  ADD KEY idx_message_logs_wa (wa_id, created_at),
  ADD KEY idx_message_logs_contact (contact_id, created_at);

CREATE TABLE IF NOT EXISTS rate_limits (
  bucket VARCHAR(191) PRIMARY KEY,
  hits INT NOT NULL DEFAULT 0,
  window_started_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Jobs created before the queue existed have no pending work.
UPDATE send_jobs SET status = 'completed' WHERE status = 'running';
