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

module.exports = { createRegistration };