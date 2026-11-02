const { getPool } = require("../config/database");
const { clientIdentityKey } = require("./clientIdentity");

const pageSizeLimit = 100;

function pageValues(page, pageSize) {
  const safePage = Math.max(1, Number(page) || 1);
  const safeSize = Math.min(pageSizeLimit, Math.max(1, Number(pageSize) || 20));
  return { page: safePage, pageSize: safeSize, offset: (safePage - 1) * safeSize };
}

function addFilter(filters, values, field, value, expression = `${field} = ?`) {
  if (value) {
    filters.push(expression);
    values.push(value);
  }
}

function addSearch(filters, values, fields, search) {
  if (!search) return;
  const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
  filters.push(`(${fields.map(field => `${field} LIKE ?`).join(" OR ")})`);
  for (const _field of fields) values.push(pattern);
}

async function fetchPage(query, countQuery, values, page, pageSize) {
  const paging = pageValues(page, pageSize);
  const [rows] = await getPool().execute(query, [...values, paging.pageSize, paging.offset]);
  const [counts] = await getPool().execute(countQuery, values);
  return { items: rows, page: paging.page, pageSize: paging.pageSize, total: counts[0].total };
}

async function getDashboardOverview() {
  const db = getPool();
  const [summaryRows] = await db.execute(
    `SELECT
      (SELECT COUNT(*) FROM registrations) AS totalRegistrations,
      (SELECT COUNT(*) FROM registrations WHERE created_at >= CURRENT_DATE) AS newRegistrations,
      (SELECT COUNT(*) FROM internship_applications) AS totalInternshipApplications,
      (SELECT COUNT(*) FROM internship_applications WHERE status IN ('New','Under review')) AS pendingInternshipApplications,
      (SELECT COUNT(*) FROM internship_applications WHERE status = 'Accepted') AS acceptedInternshipApplications,
      (SELECT COUNT(*) FROM internship_opportunities WHERE published = 1 AND status = 'Open') AS publishedOpportunities,
      (SELECT COUNT(*) FROM service_requests) AS totalServiceRequests,
      (SELECT COUNT(*) FROM service_requests r
       LEFT JOIN service_request_management m ON m.service_request_id = r.id
       WHERE COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END)
       IN ('New Request','Under review')) AS pendingServiceRequests,
      (SELECT COUNT(*) FROM corporate_training_requests) AS corporateTrainingRequests,
      (SELECT COUNT(*) FROM courses) AS totalCourses,
      (SELECT COUNT(*) FROM courses WHERE published = 1) AS activeCourses,
      (SELECT COUNT(*) FROM clients) AS totalClients`
  );
  const [registrationTrend] = await db.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, COUNT(*) AS count
     FROM registrations WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 11 MONTH)
     GROUP BY period ORDER BY period`
  );
  const [internshipTrend] = await db.execute(
    `SELECT DATE_FORMAT(created_at, '%Y-%m') AS period, COUNT(*) AS count
     FROM internship_applications WHERE created_at >= DATE_SUB(CURRENT_DATE, INTERVAL 11 MONTH)
     GROUP BY period ORDER BY period`
  );
  const [applicationsByDepartment] = await db.execute(
    "SELECT department AS label, COUNT(*) AS count FROM internship_applications GROUP BY department ORDER BY count DESC"
  );
  const [registrationsByCourse] = await db.execute(
    "SELECT course AS label, COUNT(*) AS count FROM registrations GROUP BY course ORDER BY count DESC LIMIT 10"
  );
  const [servicesByCategory] = await db.execute(
    "SELECT service_category AS label, COUNT(*) AS count FROM service_requests GROUP BY service_category ORDER BY count DESC"
  );
  const [applicationStatuses] = await db.execute(
    "SELECT status AS label, COUNT(*) AS count FROM internship_applications GROUP BY status ORDER BY count DESC"
  );
  const [recentRegistrations] = await db.execute(
    `SELECT r.id, r.full_name AS name, r.course AS detail,
     COALESCE(m.status, r.status) AS status, r.created_at
     FROM registrations r LEFT JOIN registration_management m ON m.registration_id = r.id
     ORDER BY r.created_at DESC LIMIT 5`
  );
  const [recentApplications] = await db.execute(
    "SELECT id, full_name AS name, CONCAT(internship_type, ' · ', department) AS detail, status, created_at FROM internship_applications ORDER BY created_at DESC LIMIT 5"
  );
  const [recentServices] = await db.execute(
    `SELECT r.id, COALESCE(r.organization_name, r.contact_name) AS name,
     r.service_category AS detail,
     COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END) AS status,
     r.created_at FROM service_requests r
     LEFT JOIN service_request_management m ON m.service_request_id = r.id
     ORDER BY r.created_at DESC LIMIT 5`
  );
  const [recentTraining] = await db.execute(
    `SELECT r.id, r.organization_name AS name, r.topic AS detail,
     COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END) AS status,
     r.created_at FROM corporate_training_requests r
     LEFT JOIN corporate_training_management m ON m.request_id = r.id
     ORDER BY r.created_at DESC LIMIT 5`
  );

  return {
    summary: summaryRows[0],
    charts: {
      registrationTrend,
      internshipTrend,
      applicationsByDepartment,
      registrationsByCourse,
      servicesByCategory,
      applicationStatuses
    },
    recent: {
      registrations: recentRegistrations,
      applications: recentApplications,
      serviceRequests: recentServices,
      corporateTrainingRequests: recentTraining
    }
  };
}

async function listRegistrations(filters) {
  const clauses = [];
  const values = [];
  addFilter(clauses, values, "r.course", filters.course);
  addFilter(clauses, values, "COALESCE(m.status, r.status)", filters.status, "COALESCE(m.status, r.status) = ?");
  addFilter(clauses, values, "m.assigned_admin_user_id", filters.assignee);
  if (filters.level) addFilter(clauses, values, "r.skill_level", filters.level);
  if (filters.mode) addFilter(clauses, values, "r.learning_mode", filters.mode);
  if (filters.from) addFilter(clauses, values, "DATE(r.created_at)", filters.from);
  if (filters.to) addFilter(clauses, values, "DATE(r.created_at)", filters.to, "DATE(r.created_at) <= ?");
  addSearch(clauses, values, ["r.full_name", "r.email", "r.phone"], filters.search);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query =
    `SELECT r.id, r.full_name, r.phone, r.email, r.course, r.learning_mode, r.skill_level,
     r.preferred_schedule, r.goals, r.consent, r.status AS original_status,
     COALESCE(m.status, r.status) AS status,
     m.internal_notes, m.assigned_admin_user_id, u.username AS assigned_username, r.created_at
     FROM registrations r LEFT JOIN registration_management m ON m.registration_id = r.id
     LEFT JOIN admin_users u ON u.id = m.assigned_admin_user_id
     ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) AS total FROM registrations r
    LEFT JOIN registration_management m ON m.registration_id = r.id ${where}`;
  return fetchPage(query, countQuery, values, filters.page, filters.pageSize);
}

async function updateRegistration(id, update, adminId, role) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [registrationRows] = await connection.execute("SELECT id FROM registrations WHERE id = ? FOR UPDATE", [id]);
    if (!registrationRows.length) {
      await connection.rollback();
      return false;
    }
    const [managementRows] = await connection.execute(
      "SELECT assigned_admin_user_id FROM registration_management WHERE registration_id = ? FOR UPDATE",
      [id]
    );
    const existingAssignee = managementRows[0]?.assigned_admin_user_id || null;
    if (role === "Staff" && Number(existingAssignee) !== Number(adminId)) {
      await connection.rollback();
      return false;
    }
    const assignedAdminUserId = update.assignAdmin
      ? update.assignedAdminUserId
      : existingAssignee;
    await connection.execute(
      `INSERT INTO registration_management
       (registration_id, status, internal_notes, assigned_admin_user_id, updated_by)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), internal_notes = VALUES(internal_notes),
        assigned_admin_user_id = VALUES(assigned_admin_user_id), updated_by = VALUES(updated_by)`,
      [id, update.status, update.internalNotes, assignedAdminUserId, adminId]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'registration.update', 'registration', ?, ?)",
      [adminId, String(id), JSON.stringify({ fields: ["status", "internal_notes"] })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listServiceRequests(filters) {
  const clauses = [];
  const values = [];
  addFilter(clauses, values, "r.service_category", filters.category);
  addFilter(clauses, values,
    "COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END)",
    filters.status,
    "COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END) = ?");
  addFilter(clauses, values, "m.assigned_admin_user_id", filters.assignee);
  addSearch(clauses, values, ["r.organization_name", "r.contact_name", "r.email", "r.phone"], filters.search);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query =
    `SELECT r.id, r.organization_name, r.contact_name, r.email, r.phone, r.sector,
     r.service_category, r.description, r.consent, r.status AS original_status,
     COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END) AS status,
     m.assigned_admin_user_id, m.priority, m.expected_completion_date, m.estimated_value_rwf,
     m.agreed_value_rwf, m.progress, m.project_notes, m.internal_notes, r.created_at
     FROM service_requests r LEFT JOIN service_request_management m ON m.service_request_id = r.id
     ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) AS total FROM service_requests r
    LEFT JOIN service_request_management m ON m.service_request_id = r.id ${where}`;
  return fetchPage(query, countQuery, values, filters.page, filters.pageSize);
}

async function updateServiceRequest(id, update, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute("SELECT id FROM service_requests WHERE id = ? FOR UPDATE", [id]);
    if (!existing.length) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `INSERT INTO service_request_management
       (service_request_id, status, assigned_admin_user_id, priority, expected_completion_date,
        estimated_value_rwf, agreed_value_rwf, progress, project_notes, internal_notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), assigned_admin_user_id = VALUES(assigned_admin_user_id),
        priority = VALUES(priority), expected_completion_date = VALUES(expected_completion_date),
        estimated_value_rwf = VALUES(estimated_value_rwf), agreed_value_rwf = VALUES(agreed_value_rwf),
        progress = VALUES(progress), project_notes = VALUES(project_notes), internal_notes = VALUES(internal_notes),
        updated_by = VALUES(updated_by)`,
      [id, update.status, update.assignedAdminUserId, update.priority, update.expectedCompletionDate,
        update.estimatedValueRwf, update.agreedValueRwf, update.progress, update.projectNotes,
        update.internalNotes, adminId]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'service_request.update', 'service_request', ?, ?)",
      [adminId, String(id), JSON.stringify({ fields: Object.keys(update) })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAssignedServiceRequest(id, status, internalNotes, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT service_request_id FROM service_request_management WHERE service_request_id = ? AND assigned_admin_user_id = ? FOR UPDATE",
      [id, adminId]
    );
    if (!rows.length) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `UPDATE service_request_management
       SET status = ?, internal_notes = ?, updated_by = ?
       WHERE service_request_id = ? AND assigned_admin_user_id = ?`,
      [status, internalNotes, adminId, id, adminId]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'service_request.status_update', 'service_request', ?, ?)",
      [adminId, String(id), JSON.stringify({ status })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listCorporateTrainingRequests(filters) {
  const clauses = [];
  const values = [];
  addFilter(clauses, values,
    "COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END)",
    filters.status,
    "COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END) = ?");
  addFilter(clauses, values, "m.coordinator_admin_user_id", filters.assignee);
  addSearch(clauses, values, ["r.organization_name", "r.contact_name", "r.email", "r.phone", "r.topic"], filters.search);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query =
    `SELECT r.id, r.organization_name, r.contact_name, r.email, r.phone, r.participant_count,
     r.topic, r.delivery_method, r.preferred_dates, r.requirements, r.consent,
     r.status AS original_status,
     COALESCE(m.status, CASE r.status WHEN 'New' THEN 'New Request' ELSE r.status END) AS status,
     m.coordinator_admin_user_id, m.proposed_fee_rwf, m.agreed_fee_rwf,
     m.training_start_date, m.training_end_date, m.proposal_notes, m.internal_notes, r.created_at
     FROM corporate_training_requests r LEFT JOIN corporate_training_management m ON m.request_id = r.id
     ${where} ORDER BY r.created_at DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) AS total FROM corporate_training_requests r
    LEFT JOIN corporate_training_management m ON m.request_id = r.id ${where}`;
  return fetchPage(query, countQuery, values, filters.page, filters.pageSize);
}

async function updateCorporateTrainingRequest(id, update, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute("SELECT id FROM corporate_training_requests WHERE id = ? FOR UPDATE", [id]);
    if (!existing.length) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `INSERT INTO corporate_training_management
       (request_id, status, coordinator_admin_user_id, proposed_fee_rwf, agreed_fee_rwf,
        training_start_date, training_end_date, proposal_notes, internal_notes, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE status = VALUES(status), coordinator_admin_user_id = VALUES(coordinator_admin_user_id),
        proposed_fee_rwf = VALUES(proposed_fee_rwf), agreed_fee_rwf = VALUES(agreed_fee_rwf),
        training_start_date = VALUES(training_start_date), training_end_date = VALUES(training_end_date),
        proposal_notes = VALUES(proposal_notes), internal_notes = VALUES(internal_notes), updated_by = VALUES(updated_by)`,
      [id, update.status, update.coordinatorAdminUserId, update.proposedFeeRwf, update.agreedFeeRwf,
        update.trainingStartDate, update.trainingEndDate, update.proposalNotes, update.internalNotes, adminId]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'corporate_training.update', 'corporate_training_request', ?, ?)",
      [adminId, String(id), JSON.stringify({ fields: Object.keys(update) })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateAssignedCorporateTrainingRequest(id, status, internalNotes, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [rows] = await connection.execute(
      "SELECT request_id FROM corporate_training_management WHERE request_id = ? AND coordinator_admin_user_id = ? FOR UPDATE",
      [id, adminId]
    );
    if (!rows.length) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `UPDATE corporate_training_management
       SET status = ?, internal_notes = ?, updated_by = ?
       WHERE request_id = ? AND coordinator_admin_user_id = ?`,
      [status, internalNotes, adminId, id, adminId]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'corporate_training.status_update', 'corporate_training_request', ?, ?)",
      [adminId, String(id), JSON.stringify({ status })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listCourses({ includeUnpublished = true } = {}) {
  const [rows] = await getPool().execute(
    `SELECT id, title, category, level, duration, description, learning_objectives,
     prerequisites, training_format, fee_rwf, image_url, published, created_at, updated_at
     FROM courses ${includeUnpublished ? "" : "WHERE published = 1"}
     ORDER BY category, title`
  );
  return rows;
}

async function createCourse(course, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO courses
       (title, category, level, duration, description, learning_objectives, prerequisites,
        training_format, fee_rwf, image_url, published)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [course.title, course.category, course.level, course.duration, course.description,
        course.learningObjectives, course.prerequisites, course.trainingFormat, course.feeRwf,
        course.imageUrl, course.published]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'course.create', 'course', ?, ?)",
      [adminId, String(result.insertId), JSON.stringify({ published: Boolean(course.published) })]
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

async function updateCourse(id, course, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE courses SET title = ?, category = ?, level = ?, duration = ?, description = ?,
       learning_objectives = ?, prerequisites = ?, training_format = ?, fee_rwf = ?,
       image_url = ?, published = ? WHERE id = ?`,
      [course.title, course.category, course.level, course.duration, course.description,
        course.learningObjectives, course.prerequisites, course.trainingFormat, course.feeRwf,
        course.imageUrl, course.published, id]
    );
    if (!result.affectedRows) {
      const [rows] = await connection.execute("SELECT id FROM courses WHERE id = ?", [id]);
      if (!rows.length) {
        await connection.rollback();
        return false;
      }
    }
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'course.update', 'course', ?, ?)",
      [adminId, String(id), JSON.stringify({ published: Boolean(course.published) })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listClients(filters) {
  const clauses = [];
  const values = [];
  addFilter(clauses, values, "c.organization_type", filters.organizationType);
  addFilter(clauses, values, "c.status", filters.status);
  addFilter(clauses, values, "c.assigned_admin_user_id", filters.assignee);
  addSearch(clauses, values, ["c.name", "c.email", "c.phone"], filters.search);
  const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const query =
    `SELECT c.id, c.name, c.organization_type, c.email, c.phone, c.assigned_admin_user_id,
     c.status, c.internal_notes, c.created_at, c.updated_at,
     COALESCE(s.request_count, 0) AS service_request_count,
     COALESCE(t.request_count, 0) AS training_request_count
     FROM clients c
     LEFT JOIN (SELECT client_id, COUNT(*) AS request_count FROM client_service_requests GROUP BY client_id) s
       ON s.client_id = c.id
     LEFT JOIN (SELECT client_id, COUNT(*) AS request_count FROM client_training_requests GROUP BY client_id) t
       ON t.client_id = c.id
     ${where} ORDER BY c.updated_at DESC LIMIT ? OFFSET ?`;
  const countQuery = `SELECT COUNT(*) AS total FROM clients c ${where}`;
  return fetchPage(query, countQuery, values, filters.page, filters.pageSize);
}

async function getClientHistory(id) {
  const db = getPool();
  const [serviceRequests] = await db.execute(
    `SELECT r.id, r.service_category AS detail, r.status, r.created_at
     FROM client_service_requests l JOIN service_requests r ON r.id = l.service_request_id
     WHERE l.client_id = ? ORDER BY r.created_at DESC LIMIT 100`,
    [id]
  );
  const [trainingRequests] = await db.execute(
    `SELECT r.id, r.topic AS detail, r.status, r.created_at
     FROM client_training_requests l JOIN corporate_training_requests r ON r.id = l.training_request_id
     WHERE l.client_id = ? ORDER BY r.created_at DESC LIMIT 100`,
    [id]
  );
  return { serviceRequests, trainingRequests };
}

async function isClientAssignedTo(id, adminId) {
  const [rows] = await getPool().execute(
    "SELECT id FROM clients WHERE id = ? AND assigned_admin_user_id = ? LIMIT 1",
    [id, adminId]
  );
  return rows.length > 0;
}

async function createClient(client, adminId) {
  const identityKey = clientIdentityKey(client);
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO clients
       (name, identity_key, organization_type, email, phone, assigned_admin_user_id, status, internal_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [client.name, identityKey, client.organizationType, client.email, client.phone,
        client.assignedAdminUserId, client.status, client.internalNotes]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'client.create', 'client', ?, ?)",
      [adminId, String(result.insertId), JSON.stringify({ organizationType: client.organizationType })]
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

async function updateClient(id, client, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existing] = await connection.execute("SELECT id FROM clients WHERE id = ? FOR UPDATE", [id]);
    if (!existing.length) {
      await connection.rollback();
      return false;
    }
    await connection.execute(
      `UPDATE clients SET name = ?, identity_key = ?, organization_type = ?, email = ?, phone = ?,
       assigned_admin_user_id = ?, status = ?, internal_notes = ? WHERE id = ?`,
      [client.name, clientIdentityKey(client), client.organizationType, client.email, client.phone,
        client.assignedAdminUserId, client.status, client.internalNotes, id]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'client.update', 'client', ?, ?)",
      [adminId, String(id), JSON.stringify({ fields: ["profile", "assignment", "status", "internal_notes"] })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listAnnouncements(publicOnly = false) {
  const where = publicOnly
    ? `WHERE published = 1 AND (starts_at IS NULL OR starts_at <= CURRENT_TIMESTAMP)
       AND (ends_at IS NULL OR ends_at >= CURRENT_TIMESTAMP)`
    : "";
  const [rows] = await getPool().execute(
    `SELECT id, title, body, starts_at, ends_at, published, created_at, updated_at
     FROM announcements ${where} ORDER BY created_at DESC LIMIT 500`
  );
  return rows;
}

async function createAnnouncement(announcement, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO announcements (title, body, starts_at, ends_at, published, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [announcement.title, announcement.body, announcement.startsAt, announcement.endsAt,
        announcement.published, adminId]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'announcement.create', 'announcement', ?, ?)",
      [adminId, String(result.insertId), JSON.stringify({ published: Boolean(announcement.published) })]
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

async function updateAnnouncement(id, announcement, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `UPDATE announcements SET title = ?, body = ?, starts_at = ?, ends_at = ?, published = ?
       WHERE id = ?`,
      [announcement.title, announcement.body, announcement.startsAt, announcement.endsAt,
        announcement.published, id]
    );
    if (!result.affectedRows) {
      const [rows] = await connection.execute("SELECT id FROM announcements WHERE id = ?", [id]);
      if (!rows.length) {
        await connection.rollback();
        return false;
      }
    }
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'announcement.update', 'announcement', ?, ?)",
      [adminId, String(id), JSON.stringify({ published: Boolean(announcement.published) })]
    );
    await connection.commit();
    return true;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getReport(type, from, to) {
  const filters = [];
  const values = [];
  const fields = {
    registrations: "r.created_at",
    courses: "r.created_at",
    internships: "a.created_at",
    services: "r.created_at",
    "corporate-training": "r.created_at",
    clients: "c.created_at"
  };
  const dateField = fields[type];
  if (!dateField) return null;
  if (from) {
    filters.push(`${dateField} >= ?`);
    values.push(`${from} 00:00:00`);
  }
  if (to) {
    filters.push(`${dateField} < DATE_ADD(?, INTERVAL 1 DAY)`);
    values.push(to);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  let query;
  if (type === "registrations") {
    query = `SELECT r.id, r.full_name, r.email, r.phone, r.course, r.learning_mode,
      r.skill_level, COALESCE(m.status, r.status) AS status, r.created_at
      FROM registrations r LEFT JOIN registration_management m ON m.registration_id = r.id
      ${where} ORDER BY r.created_at DESC LIMIT 10001`;
  } else if (type === "courses") {
    query = `SELECT r.course, COUNT(*) AS registrations,
      COUNT(DISTINCT r.email) AS unique_students
      FROM registrations r ${where} GROUP BY r.course ORDER BY registrations DESC LIMIT 10001`;
  } else if (type === "internships") {
    query = `SELECT a.internship_type, a.department,
      COUNT(*) AS applications,
      SUM(CASE WHEN COALESCE(m.review_status, a.status) = 'Accepted' THEN 1 ELSE 0 END) AS accepted,
      ROUND(100 * SUM(CASE WHEN COALESCE(m.review_status, a.status) = 'Accepted' THEN 1 ELSE 0 END) / COUNT(*), 2) AS acceptance_rate_percent
      FROM internship_applications a LEFT JOIN internship_application_management m ON m.application_id = a.id
      ${where} GROUP BY a.internship_type, a.department ORDER BY applications DESC LIMIT 10001`;
  } else if (type === "services") {
    query = `SELECT r.service_category, COALESCE(m.status, r.status) AS status,
      COUNT(*) AS requests, SUM(m.estimated_value_rwf) AS estimated_value_rwf,
      SUM(m.agreed_value_rwf) AS agreed_value_rwf
      FROM service_requests r LEFT JOIN service_request_management m ON m.service_request_id = r.id
      ${where} GROUP BY r.service_category, status ORDER BY requests DESC LIMIT 10001`;
  } else if (type === "corporate-training") {
    query = `SELECT r.topic, COALESCE(m.status, r.status) AS status,
      COUNT(*) AS requests, SUM(r.participant_count) AS participants,
      SUM(m.proposed_fee_rwf) AS proposed_fee_rwf, SUM(m.agreed_fee_rwf) AS agreed_fee_rwf
      FROM corporate_training_requests r LEFT JOIN corporate_training_management m ON m.request_id = r.id
      ${where} GROUP BY r.topic, status ORDER BY requests DESC LIMIT 10001`;
  } else {
    query = `SELECT c.id, c.name, c.organization_type, c.status, c.created_at,
      COALESCE(s.request_count, 0) AS service_requests,
      COALESCE(t.request_count, 0) AS training_requests
      FROM clients c
      LEFT JOIN (SELECT client_id, COUNT(*) AS request_count FROM client_service_requests GROUP BY client_id) s
        ON s.client_id = c.id
      LEFT JOIN (SELECT client_id, COUNT(*) AS request_count FROM client_training_requests GROUP BY client_id) t
        ON t.client_id = c.id
      ${where} ORDER BY c.created_at DESC LIMIT 10001`;
  }
  const [rows] = await getPool().execute(query, values);
  const truncated = rows.length > 10000;
  return { rows: truncated ? rows.slice(0, 10000) : rows, truncated };
}

module.exports = {
  getDashboardOverview,
  listRegistrations,
  updateRegistration,
  listServiceRequests,
  updateServiceRequest,
  updateAssignedServiceRequest,
  listCorporateTrainingRequests,
  updateCorporateTrainingRequest,
  updateAssignedCorporateTrainingRequest,
  listCourses,
  createCourse,
  updateCourse,
  listClients,
  getClientHistory,
  isClientAssignedTo,
  createClient,
  updateClient,
  listAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  getReport,
  pageValues,
  pageSizeLimit
};
