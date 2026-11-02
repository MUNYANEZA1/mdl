USE mdl_registration;

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(64) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(161) NOT NULL,
  role ENUM('Super Admin','Administrator','Staff') NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_users_username (username),
  UNIQUE KEY uq_admin_users_email (email),
  INDEX idx_admin_users_role_active (role, active)
);

CREATE TABLE IF NOT EXISTS admin_setup_guard (
  id TINYINT UNSIGNED NOT NULL PRIMARY KEY,
  initialized TINYINT(1) NOT NULL DEFAULT 0
);

INSERT IGNORE INTO admin_setup_guard (id, initialized) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  session_digest CHAR(64) NOT NULL,
  csrf_token CHAR(64) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admin_sessions_digest (session_digest),
  INDEX idx_admin_sessions_expiration (expires_at),
  CONSTRAINT fk_admin_sessions_user FOREIGN KEY (admin_user_id)
    REFERENCES admin_users (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  actor_admin_id BIGINT UNSIGNED NULL,
  action VARCHAR(80) NOT NULL,
  entity_type VARCHAR(80) NOT NULL,
  entity_id VARCHAR(80) NULL,
  metadata JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_audit_logs_actor_created (actor_admin_id, created_at),
  INDEX idx_audit_logs_entity_created (entity_type, entity_id, created_at),
  CONSTRAINT fk_audit_logs_actor FOREIGN KEY (actor_admin_id)
    REFERENCES admin_users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS courses (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  category VARCHAR(100) NOT NULL,
  level ENUM('Beginner','Intermediate','Advanced','All levels') NOT NULL DEFAULT 'Beginner',
  duration VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  learning_objectives TEXT NULL,
  prerequisites TEXT NULL,
  training_format ENUM('Individual','Group','Online','Corporate','Flexible') NOT NULL DEFAULT 'Flexible',
  fee_rwf DECIMAL(12,2) UNSIGNED NOT NULL DEFAULT 0,
  image_url VARCHAR(500) NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_courses_title (title),
  INDEX idx_courses_published_category (published, category)
);

CREATE TABLE IF NOT EXISTS registration_management (
  registration_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  status ENUM('New','Contacted','Awaiting Payment','Enrolled','In Training','Completed','Cancelled','Closed')
    NOT NULL DEFAULT 'New',
  internal_notes TEXT NULL,
  assigned_admin_user_id BIGINT UNSIGNED NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_registration_management_status (status),
  INDEX idx_registration_management_assignee (assigned_admin_user_id),
  CONSTRAINT fk_registration_management_registration FOREIGN KEY (registration_id)
    REFERENCES registrations (id) ON DELETE CASCADE,
  CONSTRAINT fk_registration_management_admin FOREIGN KEY (updated_by)
    REFERENCES admin_users (id) ON DELETE SET NULL,
  CONSTRAINT fk_registration_management_assignee FOREIGN KEY (assigned_admin_user_id)
    REFERENCES admin_users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS service_request_management (
  service_request_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  status ENUM('New Request','Contacted','Consultation Scheduled','Proposal Sent','Negotiation','Approved','In Progress','Completed','Rejected','Cancelled','Under review','Closed')
    NOT NULL DEFAULT 'New Request',
  assigned_admin_user_id BIGINT UNSIGNED NULL,
  priority ENUM('Low','Normal','High','Urgent') NOT NULL DEFAULT 'Normal',
  expected_completion_date DATE NULL,
  estimated_value_rwf DECIMAL(12,2) UNSIGNED NULL,
  agreed_value_rwf DECIMAL(12,2) UNSIGNED NULL,
  progress TINYINT UNSIGNED NOT NULL DEFAULT 0,
  project_notes TEXT NULL,
  internal_notes TEXT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_service_management_status (status),
  INDEX idx_service_management_assignee (assigned_admin_user_id),
  CONSTRAINT fk_service_management_request FOREIGN KEY (service_request_id)
    REFERENCES service_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_service_management_assignee FOREIGN KEY (assigned_admin_user_id)
    REFERENCES admin_users (id) ON DELETE SET NULL,
  CONSTRAINT fk_service_management_updated_by FOREIGN KEY (updated_by)
    REFERENCES admin_users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS corporate_training_management (
  request_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  status ENUM('New Request','Contacted','Proposal Sent','Approved','Scheduled','In Progress','Completed','Cancelled','Under review','Closed')
    NOT NULL DEFAULT 'New Request',
  coordinator_admin_user_id BIGINT UNSIGNED NULL,
  proposed_fee_rwf DECIMAL(12,2) UNSIGNED NULL,
  agreed_fee_rwf DECIMAL(12,2) UNSIGNED NULL,
  training_start_date DATE NULL,
  training_end_date DATE NULL,
  proposal_notes TEXT NULL,
  internal_notes TEXT NULL,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_corporate_management_status (status),
  INDEX idx_corporate_management_coordinator (coordinator_admin_user_id),
  CONSTRAINT fk_corporate_management_request FOREIGN KEY (request_id)
    REFERENCES corporate_training_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_corporate_management_coordinator FOREIGN KEY (coordinator_admin_user_id)
    REFERENCES admin_users (id) ON DELETE SET NULL,
  CONSTRAINT fk_corporate_management_updated_by FOREIGN KEY (updated_by)
    REFERENCES admin_users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS internship_application_management (
  application_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  review_status VARCHAR(40) NULL,
  reviewer_admin_user_id BIGINT UNSIGNED NULL,
  minor_review_required TINYINT(1) NOT NULL DEFAULT 0,
  school_letter_received TINYINT(1) NOT NULL DEFAULT 0,
  updated_by BIGINT UNSIGNED NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_internship_management_status (review_status),
  INDEX idx_internship_management_reviewer (reviewer_admin_user_id),
  CONSTRAINT fk_internship_management_application FOREIGN KEY (application_id)
    REFERENCES internship_applications (id) ON DELETE CASCADE,
  CONSTRAINT fk_internship_management_reviewer FOREIGN KEY (reviewer_admin_user_id)
    REFERENCES admin_users (id) ON DELETE SET NULL,
  CONSTRAINT fk_internship_management_updated_by FOREIGN KEY (updated_by)
    REFERENCES admin_users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS clients (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(190) NOT NULL,
  identity_key CHAR(64) NOT NULL,
  organization_type ENUM('Individual','Business','School','University','NGO','Government','Other') NOT NULL DEFAULT 'Other',
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NULL,
  assigned_admin_user_id BIGINT UNSIGNED NULL,
  status ENUM('Active','Prospect','Inactive') NOT NULL DEFAULT 'Prospect',
  internal_notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_clients_name (name),
  INDEX idx_clients_status (status),
  INDEX idx_clients_assignee (assigned_admin_user_id),
  UNIQUE KEY uq_clients_identity_key (identity_key),
  CONSTRAINT fk_clients_assignee FOREIGN KEY (assigned_admin_user_id)
    REFERENCES admin_users (id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS client_service_requests (
  service_request_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client_service_client (client_id),
  CONSTRAINT fk_client_service_request FOREIGN KEY (service_request_id)
    REFERENCES service_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_client_service_client FOREIGN KEY (client_id)
    REFERENCES clients (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS client_training_requests (
  training_request_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  client_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_client_training_client (client_id),
  CONSTRAINT fk_client_training_request FOREIGN KEY (training_request_id)
    REFERENCES corporate_training_requests (id) ON DELETE CASCADE,
  CONSTRAINT fk_client_training_client FOREIGN KEY (client_id)
    REFERENCES clients (id) ON DELETE CASCADE
);

INSERT IGNORE INTO clients (name, identity_key, organization_type, email, phone, status)
SELECT MIN(source.name), source.identity_key, source.organization_type,
  MAX(source.email), MAX(source.phone), 'Prospect'
FROM (
  SELECT
    COALESCE(NULLIF(TRIM(r.organization_name), ''), r.contact_name) AS name,
    SHA2(CONCAT(
      CASE WHEN NULLIF(TRIM(r.organization_name), '') IS NOT NULL THEN 'business:' ELSE 'individual:' END,
      LOWER(TRIM(CASE WHEN NULLIF(TRIM(r.organization_name), '') IS NOT NULL
        THEN r.organization_name
        ELSE COALESCE(NULLIF(TRIM(r.email), ''), NULLIF(TRIM(r.phone), ''), r.contact_name)
      END))
    ), 256) AS identity_key,
    CASE WHEN NULLIF(TRIM(r.organization_name), '') IS NOT NULL THEN 'Business' ELSE 'Individual' END AS organization_type,
    r.email,
    r.phone
  FROM service_requests r
  UNION ALL
  SELECT
    r.organization_name AS name,
    SHA2(CONCAT('business:', LOWER(TRIM(r.organization_name))), 256) AS identity_key,
    'Business' AS organization_type,
    r.email,
    r.phone
  FROM corporate_training_requests r
) AS source
GROUP BY source.identity_key, source.organization_type;

INSERT IGNORE INTO client_service_requests (service_request_id, client_id)
SELECT r.id, c.id
FROM service_requests r
JOIN clients c ON c.identity_key = SHA2(CONCAT(
  CASE WHEN NULLIF(TRIM(r.organization_name), '') IS NOT NULL THEN 'business:' ELSE 'individual:' END,
  LOWER(TRIM(CASE WHEN NULLIF(TRIM(r.organization_name), '') IS NOT NULL
    THEN r.organization_name
    ELSE COALESCE(NULLIF(TRIM(r.email), ''), NULLIF(TRIM(r.phone), ''), r.contact_name)
  END))
), 256);

INSERT IGNORE INTO client_training_requests (training_request_id, client_id)
SELECT r.id, c.id
FROM corporate_training_requests r
JOIN clients c ON c.identity_key = SHA2(CONCAT('business:', LOWER(TRIM(r.organization_name))), 256);

CREATE TABLE IF NOT EXISTS announcements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  body TEXT NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_announcements_published_dates (published, starts_at, ends_at),
  CONSTRAINT fk_announcements_author FOREIGN KEY (created_by)
    REFERENCES admin_users (id) ON DELETE SET NULL
);
