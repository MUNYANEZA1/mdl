const { getPool } = require("../config/database");

async function getPublishedOpportunities() {
  const [rows] = await getPool().execute(
    `SELECT id, title, department, description, skills, requirements, expected_duration,
    application_deadline, available_places, status FROM internship_opportunities
    WHERE published = 1 ORDER BY created_at DESC`
  );
  return rows;
}

async function createApplication(application) {
  const [result] = await getPool().execute(
    `INSERT INTO internship_applications
    (full_name, email, phone, country, education_level, institution, field_of_study, internship_type,
    department, preferred_duration, start_date, reason, skills, portfolio_url, guardian_consent, consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [application.fullName, application.email, application.phone, application.country,
      application.educationLevel, application.institution, application.fieldOfStudy,
      application.internshipType, application.department, application.preferredDuration,
      application.startDate, application.reason, application.skills, application.portfolioUrl,
      application.guardianConsent]
  );
  return result.insertId;
}

module.exports = { getPublishedOpportunities, createApplication };