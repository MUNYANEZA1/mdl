const express = require("express");
const path = require("path");
const registrationRoutes = require("./routes/registrationRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const corporateTrainingRoutes = require("./routes/corporateTrainingRoutes");
const internshipRoutes = require("./routes/internshipRoutes");
const adminRoutes = require("./routes/adminRoutes");
const courseRoutes = require("./routes/courseRoutes");
const announcementRoutes = require("./routes/announcementRoutes");

const app = express();
const publicDirectory = path.join(__dirname, "..", "public");

if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use(express.json({ limit: "30kb" }));
app.use(express.static(publicDirectory));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/registrations", registrationRoutes);
app.use("/api/service-requests", serviceRoutes);
app.use("/api/corporate-training-requests", corporateTrainingRoutes);
app.use("/api", internshipRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/admin", adminRoutes);
app.use((error, _req, res, _next) => {
  console.error("HTTP request error:", error.message);
  if (error.type === "entity.too.large") {
    return res.status(413).json({ message: "Request body is too large." });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ message: "Request body must be valid JSON." });
  }
  return res.status(500).json({ message: "Unable to process this request." });
});
app.get("*", (_req, res) => res.sendFile(path.join(publicDirectory, "index.html")));

module.exports = app;