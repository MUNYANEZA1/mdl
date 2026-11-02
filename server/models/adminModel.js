const { getPool } = require("../config/database");

async function listApplications(type, department) {
  const filters = [];
  const values = [];
  if (type) { filters.push("internship_type = ?"); values.push(type); }
  if (department) { filters.push("department = ?"); values.push(department); }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const [rows] = await getPool().execute(
    `SELECT id, full_name, email, phone, country, education_level, institution, field_of_study,
    internship_type, department, preferred_duration, start_date, reason, skills, portfolio_url,
    guardian_consent, status, internal_notes, created_at FROM internship_applications
    ${where} ORDER BY created_at DESC LIMIT 500`, values
  );
  return rows;
}

async function updateApplication(id, status, internalNotes) {
  const [result] = await getPool().execute(
    "UPDATE internship_applications SET status = ?, internal_notes = ? WHERE id = ?",
    [status, internalNotes, id]
  );
  return result.affectedRows;
}

async function listOpportunities() {
  const [rows] = await getPool().execute("SELECT * FROM internship_opportunities ORDER BY created_at DESC");
  return rows;
}

async function createOpportunity(opportunity) {
  const [result] = await getPool().execute(
    `INSERT INTO internship_opportunities
    (title, department, description, skills, requirements, expected_duration, application_deadline, available_places, status, published)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [opportunity.title, opportunity.department, opportunity.description, opportunity.skills,
      opportunity.requirements, opportunity.expectedDuration, opportunity.applicationDeadline,
      opportunity.availablePlaces, opportunity.status, opportunity.published]
  );
  return result.insertId;
}

async function updateOpportunity(id, status, published) {
  const [result] = await getPool().execute(
    "UPDATE internship_opportunities SET status = ?, published = ? WHERE id = ?",
    [status, published ? 1 : 0, id]
  );
  return result.affectedRows;
}

module.exports = { listApplications, updateApplication, listOpportunities, createOpportunity, updateOpportunity };