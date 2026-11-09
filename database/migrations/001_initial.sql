-- MySQL 8.0+ initial schema for WhatsApp Engage.
-- Create the database and application user before running `npm run db:migrate`.
-- The migration runner selects DB_NAME from the environment.

SET NAMES utf8mb4 COLLATE utf8mb4_0900_ai_ci;
SET SESSION time_zone = '+00:00';
SET SESSION sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS organizations (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS memberships (
  id CHAR(36) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  role ENUM('owner', 'admin', 'member') NOT NULL DEFAULT 'member',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_member_org (user_id, organization_id),
  KEY idx_memberships_organization (organization_id),
  CONSTRAINT fk_memberships_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_memberships_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id CHAR(64) PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  organization_id CHAR(36) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_sessions_user (user_id),
  KEY idx_sessions_organization (organization_id),
  KEY idx_sessions_expires_at (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS whatsapp_connections (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL UNIQUE,
  meta_business_id VARCHAR(64),
  waba_id VARCHAR(64) NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  template_namespace VARCHAR(128),
  business_status VARCHAR(64) DEFAULT 'connected',
  webhook_subscribed TINYINT(1) NOT NULL DEFAULT 0,
  connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_whatsapp_connections_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS whatsapp_phone_numbers (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  connection_id CHAR(36) NOT NULL,
  phone_number_id VARCHAR(64) NOT NULL,
  display_phone_number VARCHAR(32),
  verified_name VARCHAR(160),
  quality_rating VARCHAR(64),
  status VARCHAR(64) DEFAULT 'connected',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_phone_number_id (organization_id, phone_number_id),
  CONSTRAINT fk_phone_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_phone_connection FOREIGN KEY (connection_id) REFERENCES whatsapp_connections(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS contacts (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  first_name VARCHAR(120) DEFAULT '',
  last_name VARCHAR(120) DEFAULT '',
  email VARCHAR(255),
  phone VARCHAR(20) NOT NULL,
  company VARCHAR(160) DEFAULT '',
  opt_in TINYINT(1) NOT NULL DEFAULT 1,
  source VARCHAR(120) DEFAULT 'manual',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_phone (organization_id, phone),
  CONSTRAINT chk_contacts_opt_in CHECK (opt_in IN (0, 1)),
  CONSTRAINT fk_contacts_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS contact_lists (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_list_name (organization_id, name),
  CONSTRAINT fk_contact_lists_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS contact_list_members (
  id CHAR(36) PRIMARY KEY,
  contact_list_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_list_contact (contact_list_id, contact_id),
  CONSTRAINT fk_list_members_list FOREIGN KEY (contact_list_id) REFERENCES contact_lists(id) ON DELETE CASCADE,
  CONSTRAINT fk_list_members_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS templates (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  meta_template_id VARCHAR(64),
  name VARCHAR(256) NOT NULL,
  language VARCHAR(12) NOT NULL,
  category ENUM('MARKETING', 'UTILITY', 'AUTHENTICATION') NOT NULL,
  status VARCHAR(64) NOT NULL DEFAULT 'DRAFT',
  header_type VARCHAR(24) NOT NULL DEFAULT 'NONE',
  header_text VARCHAR(60),
  body_text TEXT NOT NULL,
  footer_text VARCHAR(60),
  examples_json JSON,
  buttons_json JSON,
  components_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_org_template_lang (organization_id, name, language),
  CONSTRAINT fk_templates_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS template_components (
  id CHAR(36) PRIMARY KEY,
  template_id CHAR(36) NOT NULL,
  component_type VARCHAR(32) NOT NULL,
  component_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_template_components_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS send_jobs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  template_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  total_recipients INT NOT NULL DEFAULT 0,
  sent_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  variables_json JSON,
  created_by CHAR(36),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_send_jobs_organization_created (organization_id, created_at),
  KEY idx_send_jobs_status (status),
  CONSTRAINT fk_send_jobs_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_send_jobs_template FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
  CONSTRAINT fk_send_jobs_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT chk_send_jobs_counts CHECK (
    total_recipients >= 0 AND sent_count >= 0 AND failed_count >= 0
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS send_job_recipients (
  id CHAR(36) PRIMARY KEY,
  send_job_id CHAR(36) NOT NULL,
  contact_id CHAR(36) NOT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'queued',
  error_message TEXT,
  meta_message_id VARCHAR(255),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_send_job_contact (send_job_id, contact_id),
  KEY idx_recipients_status (status),
  KEY idx_recipients_meta_message (meta_message_id),
  CONSTRAINT fk_recipients_job FOREIGN KEY (send_job_id) REFERENCES send_jobs(id) ON DELETE CASCADE,
  CONSTRAINT fk_recipients_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS message_logs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36) NOT NULL,
  contact_id CHAR(36),
  send_job_id CHAR(36),
  meta_message_id VARCHAR(255),
  direction ENUM('outbound', 'inbound') NOT NULL,
  status VARCHAR(64) NOT NULL,
  payload_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_message_logs_org_created (organization_id, created_at),
  KEY idx_message_logs_meta_message (meta_message_id),
  CONSTRAINT fk_message_logs_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
  CONSTRAINT fk_message_logs_contact FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE SET NULL,
  CONSTRAINT fk_message_logs_send_job FOREIGN KEY (send_job_id) REFERENCES send_jobs(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS webhook_events (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36),
  waba_id VARCHAR(64),
  phone_number_id VARCHAR(64),
  event_type VARCHAR(64) NOT NULL,
  payload_json JSON NOT NULL,
  received_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_webhook_events_org_received (organization_id, received_at),
  KEY idx_webhook_events_waba (waba_id),
  CONSTRAINT fk_webhook_events_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) PRIMARY KEY,
  organization_id CHAR(36),
  user_id CHAR(36),
  action VARCHAR(120) NOT NULL,
  metadata_json JSON,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_logs_org_created (organization_id, created_at),
  KEY idx_audit_logs_user_created (user_id, created_at),
  CONSTRAINT fk_audit_logs_org FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL,
  CONSTRAINT fk_audit_logs_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
