CREATE DATABASE IF NOT EXISTS mdl_registration
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE mdl_registration;

CREATE TABLE IF NOT EXISTS registrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(190) NULL,
  course VARCHAR(100) NOT NULL,
  learning_mode ENUM('Individual','Group','Online','Corporate') NOT NULL,
  skill_level ENUM('Beginner','Intermediate','Advanced') NOT NULL,
  preferred_schedule VARCHAR(100) NULL,
  goals TEXT NULL,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('New','Contacted','Enrolled','Closed') NOT NULL DEFAULT 'New',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_registrations_created_at (created_at),
  INDEX idx_registrations_status (status)
);

CREATE TABLE IF NOT EXISTS service_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  organization_name VARCHAR(190) NULL,
  contact_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NOT NULL,
  sector VARCHAR(100) NULL,
  service_category VARCHAR(100) NOT NULL,
  description TEXT NULL,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('New','Under review','Contacted','Closed') NOT NULL DEFAULT 'New',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_service_requests_created_at (created_at),
  INDEX idx_service_requests_status (status)
);

CREATE TABLE IF NOT EXISTS corporate_training_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  organization_name VARCHAR(190) NOT NULL,
  contact_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NULL,
  phone VARCHAR(40) NOT NULL,
  participant_count SMALLINT UNSIGNED NOT NULL,
  topic VARCHAR(150) NOT NULL,
  delivery_method ENUM('In person','Online','Flexible') NOT NULL,
  preferred_dates VARCHAR(190) NULL,
  requirements TEXT NULL,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('New','Under review','Contacted','Closed') NOT NULL DEFAULT 'New',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_corporate_requests_created_at (created_at),
  INDEX idx_corporate_requests_status (status)
);

CREATE TABLE IF NOT EXISTS internship_applications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  email VARCHAR(190) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  country VARCHAR(100) NOT NULL,
  education_level VARCHAR(100) NOT NULL,
  institution VARCHAR(190) NOT NULL,
  field_of_study VARCHAR(150) NOT NULL,
  internship_type ENUM('Academic','Professional') NOT NULL,
  department VARCHAR(100) NOT NULL,
  preferred_duration VARCHAR(100) NOT NULL,
  start_date DATE NULL,
  reason TEXT NOT NULL,
  skills TEXT NULL,
  portfolio_url VARCHAR(500) NULL,
  guardian_consent TINYINT(1) NOT NULL DEFAULT 0,
  consent TINYINT(1) NOT NULL DEFAULT 0,
  status ENUM('New','Under review','Shortlisted','Accepted','Rejected','Completed') NOT NULL DEFAULT 'New',
  internal_notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_internship_applications_created_at (created_at),
  INDEX idx_internship_applications_status (status),
  INDEX idx_internship_applications_type_department (internship_type, department)
);

CREATE TABLE IF NOT EXISTS internship_opportunities (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(190) NOT NULL,
  department VARCHAR(100) NOT NULL,
  description TEXT NOT NULL,
  skills TEXT NULL,
  requirements TEXT NULL,
  expected_duration VARCHAR(100) NOT NULL,
  application_deadline DATE NULL,
  available_places SMALLINT UNSIGNED NULL,
  status ENUM('Coming Soon','Open','Closed') NOT NULL DEFAULT 'Coming Soon',
  published TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_opportunities_status_published (status, published)
);
