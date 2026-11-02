const express = require("express");
const { publicAnnouncements } = require("../controllers/adminOperationsController");

const router = express.Router();
router.get("/", publicAnnouncements);
module.exports = router;
