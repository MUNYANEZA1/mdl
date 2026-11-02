const requestModel = require("../models/requestModel");
const { requiredText, validEmail, clean } = require("../validation/values");

async function createServiceRequest(req, res) {
  const body = req.body || {};
  if (!requiredText(body.contactName, 150) || !requiredText(body.phone, 40) ||
      !requiredText(body.serviceCategory, 100) || !validEmail(body.email) ||
      (body.email && !requiredText(body.email, 190)) ||
      (body.organizationName && !requiredText(body.organizationName, 190)) ||
      (body.sector && !requiredText(body.sector, 100)) ||
      (body.description && !requiredText(body.description, 4000)) || body.consent !== true) {
    return res.status(400).json({ message: "Provide a contact name, phone, service, valid email, and consent." });
  }
  try {
    const id = await requestModel.createServiceRequest({
      organizationName: clean(body.organizationName, 190) || null, contactName: body.contactName.trim(),
      email: clean(body.email, 190) || null, phone: body.phone.trim(), sector: clean(body.sector, 100) || null,
      serviceCategory: body.serviceCategory.trim(), description: clean(body.description, 4000) || null
    });
    return res.status(201).json({ message: "Your service request has been received.", reference: `MDL-S${id}` });
  } catch (err) {
    console.error("Service request error:", err.message);
    return res.status(500).json({ message: "Unable to save your request. Please try again later." });
  }
}

async function createCorporateTrainingRequest(req, res) {
  const body = req.body || {};
  const participantCount = Number(body.participantCount);
  if (!requiredText(body.organizationName, 190) || !requiredText(body.contactName, 150) ||
      !requiredText(body.phone, 40) || !requiredText(body.topic, 150) ||
      !Number.isInteger(participantCount) || participantCount < 1 || participantCount > 10000 ||
      !["In person", "Online", "Flexible"].includes(body.deliveryMethod) ||
      !validEmail(body.email) || (body.email && !requiredText(body.email, 190)) ||
      (body.preferredDates && !requiredText(body.preferredDates, 190)) ||
      (body.requirements && !requiredText(body.requirements, 4000)) || body.consent !== true) {
    return res.status(400).json({ message: "Check the required organization, contact, participant, topic, format, and consent fields." });
  }
  try {
    const id = await requestModel.createCorporateTrainingRequest({
      organizationName: body.organizationName.trim(), contactName: body.contactName.trim(),
      email: clean(body.email, 190) || null, phone: body.phone.trim(), participantCount,
      topic: body.topic.trim(), deliveryMethod: body.deliveryMethod,
      preferredDates: clean(body.preferredDates, 190) || null, requirements: clean(body.requirements, 4000) || null
    });
    return res.status(201).json({ message: "Your corporate training request has been received.", reference: `MDL-C${id}` });
  } catch (err) {
    console.error("Corporate training request error:", err.message);
    return res.status(500).json({ message: "Unable to save your request. Please try again later." });
  }
}

module.exports = { createServiceRequest, createCorporateTrainingRequest };