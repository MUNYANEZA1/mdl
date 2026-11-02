const { getPool } = require("../config/database");

async function createRegistration(registration) {
  const db = getPool();
  const [result] = await db.execute(
    `INSERT INTO registrations
    (full_name, phone, email, course, learning_mode, skill_level, preferred_schedule, goals, consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [registration.fullName, registration.phone, registration.email, registration.course,
      registration.learningMode, registration.skillLevel, registration.preferredSchedule,
      registration.goals, 1]
  );
  return result.insertId;
}

async function isPublishedCourse(title) {
  const [rows] = await getPool().execute(
    "SELECT id FROM courses WHERE title = ? AND published = 1 LIMIT 1",
    [title]
  );
  return rows.length > 0;
}

module.exports = { createRegistration, isPublishedCourse };