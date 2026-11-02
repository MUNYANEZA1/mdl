const express = require("express");
const { listCourses } = require("../controllers/adminOperationsController");

const router = express.Router();
router.get("/", listCourses);
module.exports = router;
