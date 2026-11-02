const express = require("express");
const { listPublishedOpportunities, createApplication } = require("../controllers/internshipController");

const router = express.Router();
router.get("/internship-opportunities", listPublishedOpportunities);
router.post("/internship-applications", createApplication);
module.exports = router;