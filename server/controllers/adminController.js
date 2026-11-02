const adminModel = require("../models/adminModel");
const { internshipDepartments, requiredText, clean, validDateOrNull } = require("../validation/values");
const { hashPassword } = require("../middleware/adminAuth");

const applicationStatuses = ["New", "Under review", "Shortlisted", "Interview Scheduled", "Accepted", "Rejected", "Waitlisted", "In Progress", "Completed"];
const staffApplicationStatuses = ["Under review", "Shortlisted", "Interview Scheduled", "Waitlisted", "In Progress", "Completed"];
const opportunityStatuses = ["Coming Soon", "Open", "Closed"];
const adminRoles = ["Super Admin", "Administrator", "Staff"];

function validId(value) {
  const parsed = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(parsed) && parsed > 0;
}

async function listStaff(_req, res) {
  try { return res.json(await adminModel.listAdminUsers()); }
  catch (err) {
    console.error("Admin staff list error:", err.message);
    return res.status(500).json({ message: "Unable to load administrator accounts." });
  }
}

async function createStaff(req, res) {
  const body = req.body || {};
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username) ||
      email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !adminRoles.includes(body.role) || typeof body.password !== "string" ||
      body.password.length < 12 || body.password.length > 128) {
    return res.status(400).json({ message: "Provide a valid username, email, role, and password of at least 12 characters." });
  }
  try {
    const id = await adminModel.createAdminUser({
      username, email, role: body.role, passwordHash: hashPassword(body.password)
    }, req.admin.id);
    return res.status(201).json({ message: "Administrator account created.", id });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "That username or email is already in use." });
    console.error("Admin staff create error:", error.message);
    return res.status(500).json({ message: "Unable to create the administrator account." });
  }
}

async function updateStaff(req, res) {
  const body = req.body || {};
  if (!validId(req.params.id) || !adminRoles.includes(body.role) || typeof body.active !== "boolean") {
    return res.status(400).json({ message: "A valid account ID, role, and active value are required." });
  }
  try {
    const updated = await adminModel.updateAdminUser(req.params.id, body.role, body.active, req.admin.id);
    if (updated === "last_super_admin") {
      return res.status(409).json({ message: "At least one active Super Admin account must remain." });
    }
    if (!updated) return res.status(404).json({ message: "Administrator account not found." });
    return res.json({ message: "Administrator account updated." });
  } catch (error) {
    console.error("Admin staff update error:", error.message);
    return res.status(500).json({ message: "Unable to update the administrator account." });
  }
}

async function resetStaffPassword(req, res) {
  if (!validId(req.params.id) || typeof req.body?.password !== "string" ||
      req.body.password.length < 12 || req.body.password.length > 128) {
    return res.status(400).json({ message: "A valid account ID and password of at least 12 characters are required." });
  }
  try {
    const updated = await adminModel.resetAdminPassword(
      req.params.id, hashPassword(req.body.password), req.admin.id
    );
    if (!updated) return res.status(404).json({ message: "Administrator account not found." });
    return res.json({ message: "Password reset. The account must sign in again." });
  } catch (error) {
    console.error("Admin staff password reset error:", error.message);
    return res.status(500).json({ message: "Unable to reset the administrator password." });
  }
}

async function auditLogs(req, res) {
  const limit = req.query.limit == null ? 100 : Number(req.query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    return res.status(400).json({ message: "Limit must be an integer between 1 and 200." });
  }
  try { return res.json(await adminModel.listAuditLogs(limit)); }
  catch (err) {
    console.error("Admin audit log error:", err.message);
    return res.status(500).json({ message: "Unable to load audit history." });
  }
}

async function listApplications(req, res) {
  const { type, department, educationLevel, status, search } = req.query;
  const page = req.query.page == null ? 1 : Number(req.query.page);
  const pageSize = req.query.pageSize == null ? 20 : Number(req.query.pageSize);
  if ((type && !["Academic", "Professional"].includes(type)) ||
      (department && !internshipDepartments.includes(department)) ||
      (educationLevel && (typeof educationLevel !== "string" || educationLevel.length > 100)) ||
      (status && !applicationStatuses.includes(status)) ||
      (search != null && (typeof search !== "string" || search.length > 190)) ||
      !Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return res.status(400).json({ message: "One or more application filters are invalid." });
  }
  try {
    return res.json(await adminModel.listApplications({
      type: type || null,
      department: department || null,
      educationLevel: educationLevel || null,
      status: status || null,
      search: typeof search === "string" ? search.trim() : "",
      reviewerId: req.admin.role === "Staff" ? req.admin.id : null,
      page,
      pageSize
    }));
  }
  catch (err) {
    console.error("Admin applications error:", err.message);
    return res.status(500).json({ message: "Unable to load applications." });
  }
}

async function updateApplication(req, res) {
  const body = req.body || {};
  const isStaff = req.admin.role === "Staff";
  if (!validId(req.params.id) || !applicationStatuses.includes(body.status) ||
      (isStaff && !staffApplicationStatuses.includes(body.status)) ||
      (body.internalNotes != null && !requiredText(body.internalNotes, 4000) && body.internalNotes !== "") ||
      (body.schoolLetterReceived != null && typeof body.schoolLetterReceived !== "boolean") ||
      (body.reviewerAdminUserId != null && !validId(body.reviewerAdminUserId))) {
    return res.status(400).json({ message: "A valid application and status are required." });
  }
  if (isStaff && (body.reviewerAdminUserId != null || body.schoolLetterReceived != null)) {
    return res.status(403).json({ message: "Staff may update only assigned application statuses and authorized notes." });
  }
  try {
    const reviewerAdminUserId = body.reviewerAdminUserId == null ? null : Number(body.reviewerAdminUserId);
    if (reviewerAdminUserId != null && !await adminModel.findActiveAdminById(reviewerAdminUserId)) {
      return res.status(400).json({ message: "The assigned reviewer is not active." });
    }
    const updated = await adminModel.updateApplication(
      req.params.id,
      {
        status: body.status,
        internalNotes: clean(body.internalNotes, 4000) || null,
        reviewerAdminUserId,
        assignReviewer: !isStaff && Object.prototype.hasOwnProperty.call(body, "reviewerAdminUserId"),
        schoolLetterReceived: isStaff ? null : body.schoolLetterReceived
      },
      req.admin.id,
      req.admin.role
    );
    if (!updated) return res.status(404).json({ message: "Application not found." });
    return res.json({ message: "Application updated." });
  } catch (err) {
    console.error("Admin application update error:", err.message);
    return res.status(500).json({ message: "Unable to update application." });
  }
}

async function listOpportunities(_req, res) {
  try { return res.json(await adminModel.listOpportunities()); }
  catch (err) {
    console.error("Admin opportunities error:", err.message);
    return res.status(500).json({ message: "Unable to load opportunities." });
  }
}

async function listAssignees(_req, res) {
  try { return res.json(await adminModel.listActiveAdmins()); }
  catch (err) {
    console.error("Admin assignee list error:", err.message);
    return res.status(500).json({ message: "Unable to load active staff." });
  }
}

async function createOpportunity(req, res) {
  const body = req.body || {};
  const availablePlaces = body.availablePlaces;
  if (!requiredText(body.title, 190) || !internshipDepartments.includes(body.department) ||
      !requiredText(body.description, 4000) || !requiredText(body.expectedDuration, 100) ||
      !opportunityStatuses.includes(body.status) || !validDateOrNull(body.applicationDeadline) ||
      (availablePlaces !== "" && availablePlaces != null && (!Number.isInteger(Number(availablePlaces)) || Number(availablePlaces) < 0 || Number(availablePlaces) > 65535))) {
    return res.status(400).json({ message: "Check the opportunity title, department, description, duration, and status." });
  }
  try {
    const id = await adminModel.createOpportunity({
      title: body.title.trim(), department: body.department, description: body.description.trim(),
      skills: clean(body.skills, 4000) || null, requirements: clean(body.requirements, 4000) || null,
      expectedDuration: body.expectedDuration.trim(), applicationDeadline: body.applicationDeadline || null,
      availablePlaces: availablePlaces === "" || availablePlaces == null ? null : Number(availablePlaces),
      status: body.status, published: body.published === true ? 1 : 0
    }, req.admin.id);
    return res.status(201).json({ message: "Opportunity created.", id });
  } catch (err) {
    console.error("Admin opportunity create error:", err.message);
    return res.status(500).json({ message: "Unable to create opportunity." });
  }
}

async function updateOpportunity(req, res) {
  const body = req.body || {};
  if (!/^\d+$/.test(req.params.id) || !opportunityStatuses.includes(body.status) || typeof body.published !== "boolean") {
    return res.status(400).json({ message: "A valid opportunity ID, status, and published value are required." });
  }
  try {
    const updated = await adminModel.updateOpportunity(req.params.id, body.status, body.published, req.admin.id);
    if (!updated) return res.status(404).json({ message: "Opportunity not found." });
    return res.json({ message: "Opportunity updated." });
  } catch (err) {
    console.error("Admin opportunity update error:", err.message);
    return res.status(500).json({ message: "Unable to update opportunity." });
  }
}

module.exports = {
  listStaff,
  createStaff,
  updateStaff,
  resetStaffPassword,
  auditLogs,
  listApplications,
  updateApplication,
  listOpportunities,
  listAssignees,
  createOpportunity,
  updateOpportunity
};