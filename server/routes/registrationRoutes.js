const express = require("express");
const { createRegistration } = require("../controllers/registrationController");

const router = express.Router();
router.post("/", createRegistration);
module.exports = router;