const express = require("express");
const path = require("path");
const registrationRoutes = require("./routes/registrationRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const corporateTrainingRoutes = require("./routes/corporateTrainingRoutes");
const internshipRoutes = require("./routes/internshipRoutes");
const adminRoutes = require("./routes/adminRoutes");

const app = express();
const publicDirectory = path.join(__dirname, "..", "public");

app.use(express.json({ limit: "30kb" }));
app.use(express.static(publicDirectory));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/registrations", registrationRoutes);
app.use("/api/service-requests", serviceRoutes);
app.use("/api/corporate-training-requests", corporateTrainingRoutes);
app.use("/api", internshipRoutes);
app.use("/api/admin", adminRoutes);
app.get("*", (_req, res) => res.sendFile(path.join(publicDirectory, "index.html")));

module.exports = app;