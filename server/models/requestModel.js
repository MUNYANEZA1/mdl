const { getPool } = require("../config/database");
const { clientIdentityKey } = require("./clientIdentity");

async function ensureClient(connection, details) {
  const isOrganization = Boolean(details.organizationName);
  const name = details.organizationName || details.contactName;
  const type = isOrganization ? "Business" : "Individual";
  const identityKey = clientIdentityKey({ organizationType: type, name, email: details.email, phone: details.phone });
  const [result] = await connection.execute(
    `INSERT INTO clients (name, identity_key, organization_type, email, phone, status)
     VALUES (?, ?, ?, ?, ?, 'Prospect')
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id)`,
    [name, identityKey, type, details.email, details.phone]
  );
  return result.insertId;
}

async function createServiceRequest(request) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO service_requests
      (organization_name, contact_name, email, phone, sector, service_category, description, consent)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [request.organizationName, request.contactName, request.email, request.phone,
        request.sector, request.serviceCategory, request.description]
    );
    const clientId = await ensureClient(connection, request);
    await connection.execute(
      "INSERT INTO client_service_requests (service_request_id, client_id) VALUES (?, ?)",
      [result.insertId, clientId]
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function createCorporateTrainingRequest(request) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO corporate_training_requests
      (organization_name, contact_name, email, phone, participant_count, topic, delivery_method, preferred_dates, requirements, consent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [request.organizationName, request.contactName, request.email, request.phone,
        request.participantCount, request.topic, request.deliveryMethod, request.preferredDates,
        request.requirements]
    );
    const clientId = await ensureClient(connection, request);
    await connection.execute(
      "INSERT INTO client_training_requests (training_request_id, client_id) VALUES (?, ?)",
      [result.insertId, clientId]
    );
    await connection.commit();
    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { createServiceRequest, createCorporateTrainingRequest };