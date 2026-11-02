const express = require("express");
const { createCorporateTrainingRequest } = require("../controllers/requestController");

const router = express.Router();
router.post("/", createCorporateTrainingRequest);
module.exports = router;