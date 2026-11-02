const adminModel = require("../models/adminModel");
const { internshipDepartments, requiredText, clean, validDateOrNull } = require("../validation/values");

const applicationStatuses = ["New", "Under review", "Shortlisted", "Accepted", "Rejected", "Completed"];
const opportunityStatuses = ["Coming Soon", "Open", "Closed"];

async function listApplications(req, res) {
  const type = ["Academic", "Professional"].includes(req.query.type) ? req.query.type : null;
  const department = internshipDepartments.includes(req.query.department) ? req.query.department : null;
  try { return res.json(await adminModel.listApplications(type, department)); }
  catch (err) {
    console.error("Admin applications error:", err.message);
    return res.status(500).json({ message: "Unable to load applications." });
  }
}

async function updateApplication(req, res) {
  if (!/^\d+$/.test(req.params.id) || !applicationStatuses.includes(req.body?.status)) {
    return res.status(400).json({ message: "A valid application and status are required." });
  }
  try {
    const updated = await adminModel.updateApplication(req.params.id, req.body.status, clean(req.body.internalNotes, 4000) || null);
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
    });
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
    const updated = await adminModel.updateOpportunity(req.params.id, body.status, body.published);
    if (!updated) return res.status(404).json({ message: "Opportunity not found." });
    return res.json({ message: "Opportunity updated." });
  } catch (err) {
    console.error("Admin opportunity update error:", err.message);
    return res.status(500).json({ message: "Unable to update opportunity." });
  }
}

module.exports = { listApplications, updateApplication, listOpportunities, createOpportunity, updateOpportunity };