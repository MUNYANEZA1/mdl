const { getPool } = require("../config/database");

async function createServiceRequest(request) {
  const [result] = await getPool().execute(
    `INSERT INTO service_requests
    (organization_name, contact_name, email, phone, sector, service_category, description, consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [request.organizationName, request.contactName, request.email, request.phone,
      request.sector, request.serviceCategory, request.description]
  );
  return result.insertId;
}

async function createCorporateTrainingRequest(request) {
  const [result] = await getPool().execute(
    `INSERT INTO corporate_training_requests
    (organization_name, contact_name, email, phone, participant_count, topic, delivery_method, preferred_dates, requirements, consent)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
    [request.organizationName, request.contactName, request.email, request.phone,
      request.participantCount, request.topic, request.deliveryMethod, request.preferredDates,
      request.requirements]
  );
  return result.insertId;
}

module.exports = { createServiceRequest, createCorporateTrainingRequest };