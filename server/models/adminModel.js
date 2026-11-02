const { getPool } = require("../config/database");

async function createFirstAdmin(admin) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [setupRows] = await connection.execute(
      "SELECT initialized FROM admin_setup_guard WHERE id = 1 FOR UPDATE"
    );
    if (!setupRows.length) throw new Error("Admin setup guard is missing; apply the database migration.");
    if (setupRows[0].initialized) {
      await connection.rollback();
      return null;
    }

    const [countRows] = await connection.execute("SELECT COUNT(*) AS count FROM admin_users");
    if (countRows[0].count > 0) {
      await connection.execute("UPDATE admin_setup_guard SET initialized = 1 WHERE id = 1");
      await connection.commit();
      return null;
    }

    const [result] = await connection.execute(
      `INSERT INTO admin_users (username, email, password_hash, role, active)
       VALUES (?, ?, ?, 'Super Admin', 1)`,
      [admin.username, admin.email, admin.passwordHash]
    );
    await connection.execute("UPDATE admin_setup_guard SET initialized = 1 WHERE id = 1");
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id) VALUES (?, 'admin.setup', 'admin_user', ?)",
      [result.insertId, result.insertId]
    );
    await connection.commit();
    return { id: result.insertId, username: admin.username, email: admin.email, role: "Super Admin" };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findAdminByLogin(login) {
  const [rows] = await getPool().execute(
    `SELECT id, username, email, password_hash, role, active
     FROM admin_users WHERE username = ? OR email = ? LIMIT 1`,
    [login, login]
  );
  return rows[0] || null;
}

async function findActiveAdminById(id) {
  const [rows] = await getPool().execute(
    "SELECT id, role FROM admin_users WHERE id = ? AND active = 1 LIMIT 1",
    [id]
  );
  return rows[0] || null;
}

async function listActiveAdmins() {
  const [rows] = await getPool().execute(
    "SELECT id, username, email, role FROM admin_users WHERE active = 1 ORDER BY username"
  );
  return rows;
}

async function listAdminUsers() {
  const [rows] = await getPool().execute(
    `SELECT id, username, email, role, active, created_at, updated_at
     FROM admin_users ORDER BY created_at DESC`
  );
  return rows;
}

async function createAdminUser(admin, actorId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM admin_setup_guard WHERE id = 1 FOR UPDATE");
    const [result] = await connection.execute(
      "INSERT INTO admin_users (username, email, password_hash, role, active) VALUES (?, ?, ?, ?, 1)",
      [admin.username, admin.email, admin.passwordHash, admin.role]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'admin_user.create', 'admin_user', ?, ?)",
      [actorId, String(result.insertId), JSON.stringify({ role: admin.role })]
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

async function updateAdminUser(id, role, active, actorId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute("SELECT id FROM admin_setup_guard WHERE id = 1 FOR UPDATE");
    const [existingRows] = await connection.execute(
      "SELECT id, role, active FROM admin_users WHERE id = ? FOR UPDATE",
      [id]
    );
    if (!existingRows.length) {
      await connection.rollback();
      return false;
    }
    const existing = existingRows[0];
    if (existing.role === "Super Admin" && existing.active && (role !== "Super Admin" || !active)) {
      const [countRows] = await connection.execute(
        "SELECT COUNT(*) AS count FROM admin_users WHERE role = 'Super Admin' AND active = 1"
      );
      if (countRows[0].count <= 1) {
        await connection.rollback();
        return "last_super_admin";
      }
    }
    await connection.execute("UPDATE admin_users SET role = ?, active = ? WHERE id = ?", [role, active ? 1 : 0, id]);
    if (!active) await connection.execute("DELETE FROM admin_sessions WHERE admin_user_id = ?", [id]);
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'admin_user.update', 'admin_user', ?, ?)",
      [actorId, String(id), JSON.stringify({ role, active: Boolean(active) })]
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

async function resetAdminPassword(id, passwordHash, actorId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute("UPDATE admin_users SET password_hash = ? WHERE id = ?", [passwordHash, id]);
    if (!result.affectedRows) {
      const [rows] = await connection.execute("SELECT id FROM admin_users WHERE id = ?", [id]);
      if (!rows.length) {
        await connection.rollback();
        return false;
      }
    }
    await connection.execute("DELETE FROM admin_sessions WHERE admin_user_id = ?", [id]);
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id) VALUES (?, 'admin_user.password_reset', 'admin_user', ?)",
      [actorId, String(id)]
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

async function listAuditLogs(limit = 100) {
  const safeLimit = Math.floor(Math.min(200, Math.max(1, Number(limit) || 100)));
  const [rows] = await getPool().execute(
    `SELECT l.id, l.action, l.entity_type, l.entity_id, l.metadata, l.created_at,
     u.username AS actor
     FROM audit_logs l LEFT JOIN admin_users u ON u.id = l.actor_admin_id
     ORDER BY l.created_at DESC LIMIT ?`,
    [safeLimit]
  );
  return rows;
}

async function createSession(adminId, digest, csrfToken, expiresAt) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    await connection.execute(
      "INSERT INTO admin_sessions (admin_user_id, session_digest, csrf_token, expires_at) VALUES (?, ?, ?, ?)",
      [adminId, digest, csrfToken, expiresAt]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type) VALUES (?, 'admin.session.create', 'admin_session')",
      [adminId]
    );
    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function findSession(digest) {
  const [rows] = await getPool().execute(
    `SELECT u.id, u.username, u.email, u.role, s.csrf_token
     FROM admin_sessions s
     JOIN admin_users u ON u.id = s.admin_user_id
     WHERE s.session_digest = ? AND s.expires_at > CURRENT_TIMESTAMP AND u.active = 1
     LIMIT 1`,
    [digest]
  );
  return rows[0] || null;
}

async function deleteSession(digest, adminId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute("DELETE FROM admin_sessions WHERE session_digest = ?", [digest]);
    if (result.affectedRows) {
      await connection.execute(
        "INSERT INTO audit_logs (actor_admin_id, action, entity_type) VALUES (?, 'admin.session.delete', 'admin_session')",
        [adminId]
      );
    }
    await connection.commit();
    return result.affectedRows;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function listApplications(options) {
  const filters = [];
  const values = [];
  if (options.type) { filters.push("a.internship_type = ?"); values.push(options.type); }
  if (options.department) { filters.push("a.department = ?"); values.push(options.department); }
  if (options.educationLevel) { filters.push("a.education_level = ?"); values.push(options.educationLevel); }
  if (options.status) {
    filters.push("COALESCE(m.review_status, a.status) = ?");
    values.push(options.status);
  }
  if (options.reviewerId) {
    filters.push("m.reviewer_admin_user_id = ?");
    values.push(options.reviewerId);
  }
  if (options.search) {
    const search = `%${options.search.replace(/[\\%_]/g, "\\$&")}%`;
    filters.push("(a.full_name LIKE ? OR a.email LIKE ? OR a.phone LIKE ? OR a.institution LIKE ?)");
    values.push(search, search, search, search);
  }
  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
  const pageSize = Math.min(100, Math.max(1, Number(options.pageSize) || 20));
  const page = Math.max(1, Number(options.page) || 1);
  const offset = (page - 1) * pageSize;
  const [rows] = await getPool().execute(
    `SELECT a.id, a.full_name, a.email, a.phone, a.country, a.education_level, a.institution, a.field_of_study,
    a.internship_type, a.department, a.preferred_duration, a.start_date, a.reason, a.skills, a.portfolio_url,
    a.guardian_consent, COALESCE(m.review_status, a.status) AS status, a.internal_notes, a.created_at,
    CASE WHEN a.education_level IN ('High school','Secondary school') THEN 1 ELSE 0 END AS minor_review_required,
    m.reviewer_admin_user_id, m.school_letter_received, u.username AS reviewer_username
    FROM internship_applications a
    LEFT JOIN internship_application_management m ON m.application_id = a.id
    LEFT JOIN admin_users u ON u.id = m.reviewer_admin_user_id
    ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
    [...values, pageSize, offset]
  );
  const [countRows] = await getPool().execute(
    `SELECT COUNT(*) AS total FROM internship_applications a
     LEFT JOIN internship_application_management m ON m.application_id = a.id ${where}`,
    values
  );
  return { items: rows, page, pageSize, total: countRows[0].total };
}

async function updateApplication(id, update, adminId, role) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [existingRows] = await connection.execute(
      `SELECT a.education_level, m.reviewer_admin_user_id, m.school_letter_received
       FROM internship_applications a
       LEFT JOIN internship_application_management m ON m.application_id = a.id
       WHERE a.id = ? FOR UPDATE`,
      [id]
    );
    if (!existingRows.length ||
        (role === "Staff" && Number(existingRows[0].reviewer_admin_user_id) !== Number(adminId))) {
      await connection.rollback();
      return false;
    }
    const existing = existingRows[0];
    const reviewerAdminUserId = update.assignReviewer
      ? update.reviewerAdminUserId
      : existing.reviewer_admin_user_id;
    const schoolLetterReceived = update.schoolLetterReceived == null
      ? existing.school_letter_received || 0
      : update.schoolLetterReceived;
    const isMinor = ["High school", "Secondary school"].includes(existing.education_level);
    await connection.execute("UPDATE internship_applications SET internal_notes = ? WHERE id = ?", [update.internalNotes, id]);
    await connection.execute(
      `INSERT INTO internship_application_management
       (application_id, review_status, reviewer_admin_user_id, minor_review_required,
        school_letter_received, updated_by)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE review_status = VALUES(review_status),
        reviewer_admin_user_id = IF(?, VALUES(reviewer_admin_user_id), reviewer_admin_user_id),
        minor_review_required = VALUES(minor_review_required),
        school_letter_received = VALUES(school_letter_received), updated_by = VALUES(updated_by)`,
      [id, update.status, reviewerAdminUserId, isMinor ? 1 : 0, schoolLetterReceived, adminId, update.assignReviewer ? 1 : 0]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'internship_application.update', 'internship_application', ?, ?)",
      [adminId, String(id), JSON.stringify({ status: update.status, minor: isMinor })]
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

async function listOpportunities() {
  const [rows] = await getPool().execute("SELECT * FROM internship_opportunities ORDER BY created_at DESC");
  return rows;
}

async function createOpportunity(opportunity, actorId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      `INSERT INTO internship_opportunities
      (title, department, description, skills, requirements, expected_duration, application_deadline, available_places, status, published)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [opportunity.title, opportunity.department, opportunity.description, opportunity.skills,
        opportunity.requirements, opportunity.expectedDuration, opportunity.applicationDeadline,
        opportunity.availablePlaces, opportunity.status, opportunity.published]
    );
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'internship_opportunity.create', 'internship_opportunity', ?, ?)",
      [actorId, String(result.insertId), JSON.stringify({ status: opportunity.status, published: Boolean(opportunity.published) })]
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

async function updateOpportunity(id, status, published, actorId) {
  const connection = await getPool().getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "UPDATE internship_opportunities SET status = ?, published = ? WHERE id = ?",
      [status, published ? 1 : 0, id]
    );
    if (!result.affectedRows) {
      const [rows] = await connection.execute("SELECT id FROM internship_opportunities WHERE id = ?", [id]);
      if (!rows.length) {
        await connection.rollback();
        return false;
      }
    }
    await connection.execute(
      "INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata) VALUES (?, 'internship_opportunity.update', 'internship_opportunity', ?, ?)",
      [actorId, String(id), JSON.stringify({ status, published: Boolean(published) })]
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

module.exports = {
  createFirstAdmin,
  findAdminByLogin,
  findActiveAdminById,
  listActiveAdmins,
  listAdminUsers,
  createAdminUser,
  updateAdminUser,
  resetAdminPassword,
  listAuditLogs,
  createSession,
  findSession,
  deleteSession,
  listApplications,
  updateApplication,
  listOpportunities,
  createOpportunity,
  updateOpportunity
};