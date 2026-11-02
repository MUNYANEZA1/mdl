const adminOperationsModel = require("../models/adminOperationsModel");
const adminModel = require("../models/adminModel");
const { requiredText, validDateOrNull, validEmail, clean } = require("../validation/values");

const registrationStatuses = ["New", "Contacted", "Awaiting Payment", "Enrolled", "In Training", "Completed", "Cancelled", "Closed"];
const staffRegistrationStatuses = ["Contacted", "Awaiting Payment", "In Training", "Completed"];
const serviceStatuses = ["New Request", "Contacted", "Consultation Scheduled", "Proposal Sent", "Negotiation", "Approved", "In Progress", "Completed", "Rejected", "Cancelled", "Under review", "Closed"];
const corporateStatuses = ["New Request", "Contacted", "Proposal Sent", "Approved", "Scheduled", "In Progress", "Completed", "Cancelled", "Under review", "Closed"];
const staffServiceStatuses = ["Contacted", "Consultation Scheduled", "In Progress", "Completed"];
const staffCorporateStatuses = ["Contacted", "In Progress", "Completed"];
const priorities = ["Low", "Normal", "High", "Urgent"];
const courseCategories = [
  "Computer Basics", "Office Productivity", "Programming", "Web Development", "Mobile Development",
  "Graphic Design", "UI/UX Design", "Data Analysis", "Digital Marketing", "Networking",
  "Cybersecurity", "Cloud Computing", "Business Digital Skills"
];
const courseLevels = ["Beginner", "Intermediate", "Advanced", "All levels"];
const trainingFormats = ["Individual", "Group", "Online", "Corporate", "Flexible"];
const clientTypes = ["Individual", "Business", "School", "University", "NGO", "Government", "Other"];
const clientStatuses = ["Active", "Prospect", "Inactive"];
const reportTypes = ["registrations", "courses", "internships", "services", "corporate-training", "clients"];

function queryString(value, name, maximum = 190) {
  if (value == null || value === "") return "";
  if (typeof value !== "string" || value.length > maximum) {
    throw validationError(`${name} is invalid.`);
  }
  return value.trim();
}

function queryPage(req) {
  const pageValue = req.query.page == null ? 1 : Number(req.query.page);
  const pageSizeValue = req.query.pageSize == null ? 20 : Number(req.query.pageSize);
  if (!Number.isInteger(pageValue) || pageValue < 1 ||
      !Number.isInteger(pageSizeValue) || pageSizeValue < 1 || pageSizeValue > 100) {
    throw validationError("Page and page size must be valid positive integers (maximum page size is 100).");
  }
  return { page: pageValue, pageSize: pageSizeValue };
}

function validId(value) {
  const parsed = Number(value);
  return /^\d+$/.test(String(value)) && Number.isSafeInteger(parsed) && parsed > 0;
}

function validHttpsUrl(value) {
  if (!requiredText(value, 500)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && Boolean(url.hostname) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function optionalMoney(value) {
  if (value == null || value === "") return null;
  const text = String(value);
  if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(text)) return undefined;
  return Number(text);
}

function optionalAssignee(value) {
  if (value == null || value === "") return null;
  return validId(value) ? Number(value) : undefined;
}

function handleError(res, message, error) {
  if (error.validation) return res.status(400).json({ message: error.message });
  console.error(message, error.message);
  return res.status(500).json({ message: "Unable to complete this administrator request." });
}

function validationError(message) {
  const error = new Error(message);
  error.validation = true;
  return error;
}

async function overview(_req, res) {
  try {
    return res.json(await adminOperationsModel.getDashboardOverview());
  } catch (error) {
    return handleError(res, "Admin overview error:", error);
  }
}

async function listRegistrations(req, res) {
  try {
    const page = queryPage(req);
    const from = queryString(req.query.from, "Start date", 10);
    const to = queryString(req.query.to, "End date", 10);
    const search = queryString(req.query.search, "Search", 190);
    const course = queryString(req.query.course, "Course", 100);
    const level = queryString(req.query.level, "Learning level", 30);
    const mode = queryString(req.query.mode, "Learning format", 30);
    const status = queryString(req.query.status, "Status", 30);
    const assignee = optionalAssignee(req.query.assignee);
    if ((from && !validDateOrNull(from)) || (to && !validDateOrNull(to)) ||
        (from && to && from > to) ||
        (level && !["Beginner", "Intermediate", "Advanced"].includes(level)) ||
        (mode && !["Individual", "Group", "Online", "Corporate"].includes(mode)) ||
        (status && !registrationStatuses.includes(status)) || assignee === undefined) {
      throw validationError("One or more registration filters are invalid.");
    }
    return res.json(await adminOperationsModel.listRegistrations({
      ...page, from, to, search, course, level, mode, status,
      assignee: req.admin.role === "Staff" ? req.admin.id : assignee
    }));
  } catch (error) {
    return handleError(res, "Admin registrations error:", error);
  }
}

async function updateRegistration(req, res) {
  const body = req.body || {};
  const isStaff = req.admin.role === "Staff";
  const assignedAdminUserId = optionalAssignee(body.assignedAdminUserId);
  if (!validId(req.params.id) || !registrationStatuses.includes(body.status) ||
      (isStaff && !staffRegistrationStatuses.includes(body.status)) ||
      (!isStaff && assignedAdminUserId === undefined) ||
      (body.internalNotes != null && !requiredText(body.internalNotes, 4000) && body.internalNotes !== "")) {
    return res.status(400).json({ message: "A valid registration ID, status, and notes are required." });
  }
  if (isStaff && Object.prototype.hasOwnProperty.call(body, "assignedAdminUserId")) {
    return res.status(403).json({ message: "Staff may not change record assignments." });
  }
  try {
    if (!isStaff && assignedAdminUserId != null && !await adminModel.findActiveAdminById(assignedAdminUserId)) {
      return res.status(400).json({ message: "The assigned administrator is not active." });
    }
    const updated = await adminOperationsModel.updateRegistration(
      req.params.id,
      {
        status: body.status,
        internalNotes: clean(body.internalNotes, 4000) || null,
        assignedAdminUserId,
        assignAdmin: !isStaff && Object.prototype.hasOwnProperty.call(body, "assignedAdminUserId")
      },
      req.admin.id,
      req.admin.role
    );
    if (!updated) return res.status(404).json({ message: "Registration not found." });
    return res.json({ message: "Registration updated." });
  } catch (error) {
    return handleError(res, "Admin registration update error:", error);
  }
}

async function listServiceRequests(req, res) {
  try {
    const page = queryPage(req);
    const search = queryString(req.query.search, "Search", 190);
    const category = queryString(req.query.category, "Service category", 100);
    const status = queryString(req.query.status, "Status", 40);
    const assignee = optionalAssignee(req.query.assignee);
    if (assignee === undefined || (status && !serviceStatuses.includes(status))) {
      throw validationError("One or more service request filters are invalid.");
    }
    return res.json(await adminOperationsModel.listServiceRequests({
      ...page, search, category, status, assignee: req.admin.role === "Staff" ? req.admin.id : assignee
    }));
  } catch (error) {
    return handleError(res, "Admin service requests error:", error);
  }
}

async function updateServiceRequest(req, res) {
  const body = req.body || {};
  if (!validId(req.params.id)) return res.status(400).json({ message: "A valid service request ID is required." });
  if (req.admin.role === "Staff") {
    if (!staffServiceStatuses.includes(body.status) ||
        (body.internalNotes != null && !requiredText(body.internalNotes, 4000) && body.internalNotes !== "") ||
        Object.keys(body).some(key => !["status", "internalNotes"].includes(key))) {
      return res.status(403).json({ message: "Staff may update only assigned request statuses and internal notes." });
    }
    try {
      const updated = await adminOperationsModel.updateAssignedServiceRequest(
        req.params.id, body.status, clean(body.internalNotes, 4000) || null, req.admin.id
      );
      if (!updated) return res.status(404).json({ message: "Assigned service request not found." });
      return res.json({ message: "Service request updated." });
    } catch (error) {
      return handleError(res, "Admin service request update error:", error);
    }
  }
  const assignedAdminUserId = optionalAssignee(body.assignedAdminUserId);
  const estimatedValueRwf = optionalMoney(body.estimatedValueRwf);
  const agreedValueRwf = optionalMoney(body.agreedValueRwf);
  const progress = Number(body.progress);
  if (!validId(req.params.id) || !serviceStatuses.includes(body.status) ||
      !priorities.includes(body.priority) || assignedAdminUserId === undefined ||
      estimatedValueRwf === undefined || agreedValueRwf === undefined ||
      !Number.isInteger(progress) || progress < 0 || progress > 100 ||
      !validDateOrNull(body.expectedCompletionDate) ||
      (body.projectNotes != null && !requiredText(body.projectNotes, 4000) && body.projectNotes !== "") ||
      (body.internalNotes != null && !requiredText(body.internalNotes, 4000) && body.internalNotes !== "")) {
    return res.status(400).json({ message: "Check the service status, assignment, priority, date, values, progress, and notes." });
  }
  try {
    if (assignedAdminUserId != null && !await adminModel.findActiveAdminById(assignedAdminUserId)) {
      return res.status(400).json({ message: "The assigned administrator is not active." });
    }
    const updated = await adminOperationsModel.updateServiceRequest(
      req.params.id,
      {
        status: body.status,
        assignedAdminUserId,
        priority: body.priority,
        expectedCompletionDate: body.expectedCompletionDate || null,
        estimatedValueRwf,
        agreedValueRwf,
        progress,
        projectNotes: clean(body.projectNotes, 4000) || null,
        internalNotes: clean(body.internalNotes, 4000) || null
      },
      req.admin.id
    );
    if (!updated) return res.status(404).json({ message: "Service request not found." });
    return res.json({ message: "Service request updated." });
  } catch (error) {
    return handleError(res, "Admin service request update error:", error);
  }
}

async function listCorporateTrainingRequests(req, res) {
  try {
    const page = queryPage(req);
    const search = queryString(req.query.search, "Search", 190);
    const status = queryString(req.query.status, "Status", 40);
    const assignee = optionalAssignee(req.query.assignee);
    if (assignee === undefined || (status && !corporateStatuses.includes(status))) {
      throw validationError("One or more corporate training filters are invalid.");
    }
    return res.json(await adminOperationsModel.listCorporateTrainingRequests({
      ...page, search, status, assignee: req.admin.role === "Staff" ? req.admin.id : assignee
    }));
  } catch (error) {
    return handleError(res, "Admin corporate training error:", error);
  }
}

async function updateCorporateTrainingRequest(req, res) {
  const body = req.body || {};
  if (!validId(req.params.id)) return res.status(400).json({ message: "A valid training request ID is required." });
  if (req.admin.role === "Staff") {
    if (!staffCorporateStatuses.includes(body.status) ||
        (body.internalNotes != null && !requiredText(body.internalNotes, 4000) && body.internalNotes !== "") ||
        Object.keys(body).some(key => !["status", "internalNotes"].includes(key))) {
      return res.status(403).json({ message: "Staff may update only assigned training statuses and internal notes." });
    }
    try {
      const updated = await adminOperationsModel.updateAssignedCorporateTrainingRequest(
        req.params.id, body.status, clean(body.internalNotes, 4000) || null, req.admin.id
      );
      if (!updated) return res.status(404).json({ message: "Assigned training request not found." });
      return res.json({ message: "Corporate training request updated." });
    } catch (error) {
      return handleError(res, "Admin corporate training update error:", error);
    }
  }
  const coordinatorAdminUserId = optionalAssignee(body.coordinatorAdminUserId);
  const proposedFeeRwf = optionalMoney(body.proposedFeeRwf);
  const agreedFeeRwf = optionalMoney(body.agreedFeeRwf);
  if (!validId(req.params.id) || !corporateStatuses.includes(body.status) ||
      coordinatorAdminUserId === undefined || proposedFeeRwf === undefined || agreedFeeRwf === undefined ||
      !validDateOrNull(body.trainingStartDate) || !validDateOrNull(body.trainingEndDate) ||
      (body.trainingStartDate && body.trainingEndDate && body.trainingStartDate > body.trainingEndDate) ||
      (body.proposalNotes != null && !requiredText(body.proposalNotes, 4000) && body.proposalNotes !== "") ||
      (body.internalNotes != null && !requiredText(body.internalNotes, 4000) && body.internalNotes !== "")) {
    return res.status(400).json({ message: "Check the training status, coordinator, fees, dates, and notes." });
  }
  try {
    if (coordinatorAdminUserId != null && !await adminModel.findActiveAdminById(coordinatorAdminUserId)) {
      return res.status(400).json({ message: "The assigned coordinator is not active." });
    }
    const updated = await adminOperationsModel.updateCorporateTrainingRequest(
      req.params.id,
      {
        status: body.status,
        coordinatorAdminUserId,
        proposedFeeRwf,
        agreedFeeRwf,
        trainingStartDate: body.trainingStartDate || null,
        trainingEndDate: body.trainingEndDate || null,
        proposalNotes: clean(body.proposalNotes, 4000) || null,
        internalNotes: clean(body.internalNotes, 4000) || null
      },
      req.admin.id
    );
    if (!updated) return res.status(404).json({ message: "Corporate training request not found." });
    return res.json({ message: "Corporate training request updated." });
  } catch (error) {
    return handleError(res, "Admin corporate training update error:", error);
  }
}

function courseFromBody(body) {
  if (!requiredText(body.title, 190) || !courseCategories.includes(body.category) ||
      !courseLevels.includes(body.level) || !requiredText(body.duration, 100) ||
      !requiredText(body.description, 4000) ||
      (body.learningObjectives && !requiredText(body.learningObjectives, 4000)) ||
      (body.prerequisites && !requiredText(body.prerequisites, 2000)) ||
      !trainingFormats.includes(body.trainingFormat) ||
      optionalMoney(body.feeRwf) === undefined ||
      (body.imageUrl && !validHttpsUrl(body.imageUrl)) ||
      typeof body.published !== "boolean") {
    return null;
  }
  return {
    title: body.title.trim(),
    category: body.category,
    level: body.level,
    duration: body.duration.trim(),
    description: body.description.trim(),
    learningObjectives: clean(body.learningObjectives, 4000) || null,
    prerequisites: clean(body.prerequisites, 2000) || null,
    trainingFormat: body.trainingFormat,
    feeRwf: optionalMoney(body.feeRwf) ?? 0,
    imageUrl: clean(body.imageUrl, 500) || null,
    published: body.published ? 1 : 0
  };
}

async function listCourses(req, res) {
  try {
    return res.json(await adminOperationsModel.listCourses({ includeUnpublished: req.admin != null }));
  } catch (error) {
    return handleError(res, "Courses error:", error);
  }
}

async function createCourse(req, res) {
  const course = courseFromBody(req.body || {});
  if (!course) return res.status(400).json({ message: "Check the course title, category, level, description, format, fee, and image URL." });
  try {
    const id = await adminOperationsModel.createCourse(course, req.admin.id);
    return res.status(201).json({ message: "Course created.", id });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "A course with that title already exists." });
    return handleError(res, "Admin course create error:", error);
  }
}

async function updateCourse(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "A valid course ID is required." });
  const course = courseFromBody(req.body || {});
  if (!course) return res.status(400).json({ message: "Check the course title, category, level, description, format, fee, and image URL." });
  try {
    const updated = await adminOperationsModel.updateCourse(req.params.id, course, req.admin.id);
    if (!updated) return res.status(404).json({ message: "Course not found." });
    return res.json({ message: "Course updated." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "A course with that title already exists." });
    return handleError(res, "Admin course update error:", error);
  }
}

async function listClients(req, res) {
  try {
    const page = queryPage(req);
    const search = queryString(req.query.search, "Search", 190);
    const organizationType = queryString(req.query.organizationType, "Organization type", 30);
    const status = queryString(req.query.status, "Status", 20);
    if ((organizationType && !clientTypes.includes(organizationType)) ||
        (status && !clientStatuses.includes(status))) {
      throw validationError("One or more client filters are invalid.");
    }
    return res.json(await adminOperationsModel.listClients({
      ...page, search, organizationType, status,
      assignee: req.admin.role === "Staff" ? req.admin.id : null
    }));
  } catch (error) {
    return handleError(res, "Admin clients error:", error);
  }
}

function clientFromBody(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const assignedAdminUserId = optionalAssignee(body.assignedAdminUserId);
  if (!requiredText(name, 190) || (email && (!requiredText(email, 190) || !validEmail(email))) ||
      (phone && !requiredText(phone, 40)) || !clientTypes.includes(body.organizationType) ||
      !clientStatuses.includes(body.status) || assignedAdminUserId === undefined ||
      (body.internalNotes != null && !requiredText(body.internalNotes, 4000) && body.internalNotes !== "")) {
    return null;
  }
  return {
    name,
    email: email || null,
    phone: phone || null,
    organizationType: body.organizationType,
    assignedAdminUserId,
    status: body.status,
    internalNotes: clean(body.internalNotes, 4000) || null
  };
}

async function saveClient(req, res) {
  const client = clientFromBody(req.body || {});
  if (!client) return res.status(400).json({ message: "Check the client name, type, status, contact details, and notes." });
  if (client.assignedAdminUserId != null) {
    try {
      if (!await adminModel.findActiveAdminById(client.assignedAdminUserId)) {
        return res.status(400).json({ message: "The assigned administrator is not active." });
      }
    } catch (error) {
      return handleError(res, "Admin client assignee validation error:", error);
    }
  }
  try {
    if (req.method === "POST") {
      const id = await adminOperationsModel.createClient(client, req.admin.id);
      return res.status(201).json({ message: "Client created.", id });
    }
    if (!validId(req.params.id)) return res.status(400).json({ message: "A valid client ID is required." });
    const updated = await adminOperationsModel.updateClient(req.params.id, client, req.admin.id);
    if (!updated) return res.status(404).json({ message: "Client not found." });
    return res.json({ message: "Client updated." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ message: "A client with that identity already exists." });
    return handleError(res, "Admin client save error:", error);
  }
}

async function clientHistory(req, res) {
  if (!validId(req.params.id)) return res.status(400).json({ message: "A valid client ID is required." });
  try {
    if (req.admin.role === "Staff" && !await adminOperationsModel.isClientAssignedTo(req.params.id, req.admin.id)) {
      return res.status(404).json({ message: "Assigned client not found." });
    }
    return res.json(await adminOperationsModel.getClientHistory(req.params.id));
  } catch (error) {
    return handleError(res, "Admin client history error:", error);
  }
}

function dateTimeOrNull(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return undefined;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match || !validDateOrNull(match[1]) || Number(match[2]) > 23 ||
      Number(match[3]) > 59 || Number(match[4] || 0) > 59) return undefined;
  return `${match[1]} ${match[2]}:${match[3]}:${match[4] || "00"}`;
}

function announcementFromBody(body) {
  const startsAt = dateTimeOrNull(body.startsAt);
  const endsAt = dateTimeOrNull(body.endsAt);
  if (!requiredText(body.title, 190) || !requiredText(body.body, 4000) ||
      startsAt === undefined || endsAt === undefined ||
      (body.startsAt && body.endsAt && body.startsAt > body.endsAt) ||
      typeof body.published !== "boolean") {
    return null;
  }
  return {
    title: body.title.trim(),
    body: body.body.trim(),
    startsAt,
    endsAt,
    published: body.published ? 1 : 0
  };
}

async function publicAnnouncements(_req, res) {
  try {
    return res.json(await adminOperationsModel.listAnnouncements(true));
  } catch (error) {
    console.error("Public announcements error:", error.message);
    return res.status(500).json({ message: "Unable to load announcements." });
  }
}

async function listAnnouncements(_req, res) {
  try {
    return res.json(await adminOperationsModel.listAnnouncements());
  } catch (error) {
    return handleError(res, "Admin announcements error:", error);
  }
}

async function saveAnnouncement(req, res) {
  const announcement = announcementFromBody(req.body || {});
  if (!announcement) return res.status(400).json({ message: "Check the announcement title, content, dates, and published value." });
  try {
    if (req.method === "POST") {
      const id = await adminOperationsModel.createAnnouncement(announcement, req.admin.id);
      return res.status(201).json({ message: "Announcement created.", id });
    }
    if (!validId(req.params.id)) return res.status(400).json({ message: "A valid announcement ID is required." });
    const updated = await adminOperationsModel.updateAnnouncement(req.params.id, announcement, req.admin.id);
    if (!updated) return res.status(404).json({ message: "Announcement not found." });
    return res.json({ message: "Announcement updated." });
  } catch (error) {
    return handleError(res, "Admin announcement save error:", error);
  }
}

function reportDateFilters(req) {
  const from = queryString(req.query.from, "Start date", 10);
  const to = queryString(req.query.to, "End date", 10);
  if ((from && !validDateOrNull(from)) || (to && !validDateOrNull(to)) || (from && to && from > to)) {
    throw validationError("Report dates must be valid and the start date must not follow the end date.");
  }
  return { from, to };
}

async function reportData(req, res) {
  const type = req.params.type;
  if (!reportTypes.includes(type)) return res.status(400).json({ message: "Unsupported report type." });
  try {
    const dates = reportDateFilters(req);
    const report = await adminOperationsModel.getReport(type, dates.from, dates.to);
    return res.json({ type, ...dates, ...report });
  } catch (error) {
    return handleError(res, "Admin report error:", error);
  }
}

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

const reportColumns = {
  registrations: ["id", "full_name", "email", "phone", "course", "learning_mode", "skill_level", "status", "created_at"],
  courses: ["course", "registrations", "unique_students"],
  internships: ["internship_type", "department", "applications", "accepted", "acceptance_rate_percent"],
  services: ["service_category", "status", "requests", "estimated_value_rwf", "agreed_value_rwf"],
  "corporate-training": ["topic", "status", "requests", "participants", "proposed_fee_rwf", "agreed_fee_rwf"],
  clients: ["id", "name", "organization_type", "status", "service_requests", "training_requests", "created_at"]
};

async function reportCsv(req, res) {
  const type = req.params.type;
  if (!reportTypes.includes(type)) return res.status(400).json({ message: "Unsupported report type." });
  try {
    const dates = reportDateFilters(req);
    const report = await adminOperationsModel.getReport(type, dates.from, dates.to);
    const columns = reportColumns[type];
    const rows = [
      columns.map(csvCell).join(","),
      ...report.rows.map(row => columns.map(column => csvCell(row[column])).join(","))
    ];
    if (report.truncated) {
      res.setHeader("X-Report-Truncated", "true");
    }
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="mdl-${type}-report.csv"`);
    return res.send(`\uFEFF${rows.join("\r\n")}`);
  } catch (error) {
    return handleError(res, "Admin report export error:", error);
  }
}

module.exports = {
  overview,
  listRegistrations,
  updateRegistration,
  listServiceRequests,
  updateServiceRequest,
  listCorporateTrainingRequests,
  updateCorporateTrainingRequest,
  listCourses,
  createCourse,
  updateCourse,
  listClients,
  saveClient,
  clientHistory,
  publicAnnouncements,
  listAnnouncements,
  saveAnnouncement,
  reportData,
  reportCsv,
  registrationStatuses,
  serviceStatuses,
  corporateStatuses
};
