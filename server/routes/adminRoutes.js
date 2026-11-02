const express = require("express");
const { loginAdmin, adminSession, requireAdmin, logoutAdmin } = require("../middleware/adminAuth");
const adminController = require("../controllers/adminController");

const router = express.Router();
router.post("/login", loginAdmin);
router.get("/session", adminSession);
router.post("/logout", requireAdmin, logoutAdmin);
router.get("/applications", requireAdmin, adminController.listApplications);
router.patch("/applications/:id", requireAdmin, adminController.updateApplication);
router.get("/opportunities", requireAdmin, adminController.listOpportunities);
router.post("/opportunities", requireAdmin, adminController.createOpportunity);
router.patch("/opportunities/:id", requireAdmin, adminController.updateOpportunity);
module.exports = router;