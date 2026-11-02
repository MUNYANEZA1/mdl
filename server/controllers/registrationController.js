const registrationModel = require("../models/registrationModel");
const { allowedCourses, allowedModes, allowedLevels, requiredText, validEmail } = require("../validation/values");

async function createRegistration(req, res) {
  const { fullName, phone, email, course, learningMode, skillLevel, preferredSchedule, goals, consent } = req.body || {};
  if (!fullName || !phone || !course || !learningMode || !skillLevel) {
    return res.status(400).json({ message: "Nyamuneka uzuza imyanya yose isabwa." });
  }
  if (String(fullName).trim().length < 2 || String(phone).trim().length < 7) {
    return res.status(400).json({ message: "Reba amazina na telefone wanditse." });
  }
  if ((email && !requiredText(email, 190)) || !validEmail(email)) {
    return res.status(400).json({ message: "Reba aderesi ya email wanditse." });
  }
  if (!allowedCourses.includes(course) || !allowedModes.includes(learningMode) || !allowedLevels.includes(skillLevel)) {
    return res.status(400).json({ message: "Hari amakuru atemewe. Ongera ugerageze." });
  }
  if (consent !== true) return res.status(400).json({ message: "Ugomba kwemera ko MDL igukoresha amakuru mu kugusubiza." });
  try {
    const registrationId = await registrationModel.createRegistration({
      fullName: String(fullName).trim(), phone: String(phone).trim(), email: email ? String(email).trim() : null,
      course, learningMode, skillLevel, preferredSchedule: preferredSchedule ? String(preferredSchedule).trim() : null,
      goals: goals ? String(goals).trim().slice(0, 2000) : null
    });
    return res.status(201).json({
      message: "Registration yawe yakiriwe! MDL izakuvugisha kugira ngo mwumvikane ku ntambwe ikurikira.",
      registrationId
    });
  } catch (err) {
    console.error("Registration error:", err.message);
    return res.status(500).json({ message: "Habaye ikibazo mu kubika registration. Ongera ugerageze nyuma cyangwa utuvugishe." });
  }
}

module.exports = { createRegistration };