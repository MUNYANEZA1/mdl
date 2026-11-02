const express = require("express");
const { createServiceRequest } = require("../controllers/requestController");

const router = express.Router();
router.post("/", createServiceRequest);
module.exports = router;