const internshipModel = require("../models/internshipModel");
const { internshipDepartments, requiredText, validEmail, validDateOrNull, clean } = require("../validation/values");

async function listPublishedOpportunities(_req, res) {
  try {
    return res.json(await internshipModel.getPublishedOpportunities());
  } catch (err) {
    console.error("Internship opportunities error:", err.message);
    return res.status(500).json({ message: "Unable to load internship opportunities." });
  }
}

async function createApplication(req, res) {
  const body = req.body || {};
  const internshipTypes = ["Academic", "Professional"];
  const isMinor = ["High school", "Secondary school"].includes(body.educationLevel);
  if (!requiredText(body.fullName, 150) || !validEmail(body.email) || !body.email ||
      !requiredText(body.phone, 40) || !requiredText(body.country, 100) ||
      !requiredText(body.educationLevel, 100) || !requiredText(body.institution, 190) ||
      !requiredText(body.fieldOfStudy, 150) || !internshipTypes.includes(body.internshipType) ||
      !internshipDepartments.includes(body.department) || !requiredText(body.preferredDuration, 100) ||
      !requiredText(body.reason, 4000) || body.consent !== true || (isMinor && body.guardianConsent !== true) ||
      !validDateOrNull(body.startDate) || (body.skills && !requiredText(body.skills, 4000)) ||
      (body.portfolioUrl && (!requiredText(body.portfolioUrl, 500) || !/^https:\/\//i.test(body.portfolioUrl)))) {
    return res.status(400).json({ message: "Check the application details, consent, and portfolio link. Guardian consent is required for high-school applicants." });
  }
  try {
    const id = await internshipModel.createApplication({
      fullName: body.fullName.trim(), email: body.email.trim(), phone: body.phone.trim(), country: body.country.trim(),
      educationLevel: body.educationLevel.trim(), institution: body.institution.trim(), fieldOfStudy: body.fieldOfStudy.trim(),
      internshipType: body.internshipType, department: body.department, preferredDuration: body.preferredDuration.trim(),
      startDate: body.startDate || null, reason: body.reason.trim(), skills: clean(body.skills, 4000) || null,
      portfolioUrl: clean(body.portfolioUrl, 500) || null, guardianConsent: isMinor ? 1 : 0
    });
    return res.status(201).json({
      message: "Your internship application has been received. Placement depends on eligibility, open opportunities, and supervision capacity.",
      reference: `MDL-I${id}`
    });
  } catch (err) {
    console.error("Internship application error:", err.message);
    return res.status(500).json({ message: "Unable to save your application. Please try again later." });
  }
}

module.exports = { listPublishedOpportunities, createApplication };