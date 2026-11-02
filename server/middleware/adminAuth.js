const crypto = require("crypto");

const loginAttempts = new Map();
const sessionDuration = 8 * 60 * 60 * 1000;

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyAdminPassword(password) {
  const encoded = process.env.ADMIN_PASSWORD_HASH || "";
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected || !password) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(actual, expected);
}

function createAdminToken(expiresAt) {
  return `${expiresAt}.${crypto.createHmac("sha256", process.env.MDL_ADMIN_SECRET).update(String(expiresAt)).digest("hex")}`;
}

function hasAdminConfig() {
  return Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH && process.env.MDL_ADMIN_SECRET);
}

function isAdminTokenValid(req) {
  if (!hasAdminConfig()) return false;
  const token = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith("mdl_admin="))?.slice("mdl_admin=".length);
  const [expiresAt, signature] = token?.split(".") || [];
  const expected = expiresAt && createAdminToken(expiresAt).split(".")[1];
  return Boolean(expiresAt && signature && Number(expiresAt) >= Date.now() && expected && safeEqual(signature, expected));
}

function adminSession(req, res) {
  return res.json({ configured: hasAdminConfig(), authenticated: isAdminTokenValid(req) });
}

function loginAdmin(req, res) {
  if (!hasAdminConfig()) return res.status(503).json({ message: "Admin access is not configured on this server." });
  const address = req.ip;
  const attempt = loginAttempts.get(address) || { count: 0, resetAt: Date.now() + 15 * 60 * 1000 };
  if (attempt.resetAt < Date.now()) {
    attempt.count = 0;
    attempt.resetAt = Date.now() + 15 * 60 * 1000;
  }
  if (attempt.count >= 5) return res.status(429).json({ message: "Too many login attempts. Try again later." });
  attempt.count += 1;
  loginAttempts.set(address, attempt);
  const usernameMatches = safeEqual(String(req.body?.username || ""), process.env.ADMIN_USERNAME);
  if (!usernameMatches || !verifyAdminPassword(String(req.body?.password || ""))) {
    return res.status(401).json({ message: "Invalid username or password." });
  }
  loginAttempts.delete(address);
  const expiresAt = Date.now() + sessionDuration;
  res.setHeader("Set-Cookie", `mdl_admin=${createAdminToken(expiresAt)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDuration / 1000}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  return res.json({ message: "Signed in." });
}

function requireAdmin(req, res, next) {
  if (!hasAdminConfig()) return res.status(503).json({ message: "Admin access is not configured on this server." });
  if (!isAdminTokenValid(req)) return res.status(401).json({ message: "Administrator authentication required." });
  return next();
}

function logoutAdmin(_req, res) {
  res.setHeader("Set-Cookie", "mdl_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
  return res.json({ message: "Signed out." });
}

module.exports = { loginAdmin, adminSession, requireAdmin, logoutAdmin };