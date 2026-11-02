const crypto = require("node:crypto");
const adminModel = require("../models/adminModel");

const sessionDuration = 8 * 60 * 60 * 1000;
const loginAttempts = new Map();
const setupAttempts = new Map();

function safeEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, encoded) {
  const [salt, expected] = String(encoded || "").split(":");
  if (!salt || !/^[a-f0-9]{128}$/i.test(expected || "")) return false;
  const actual = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(actual, expected);
}

function readCookie(req, name) {
  const prefix = `${name}=`;
  const value = req.headers.cookie?.split(";").map(part => part.trim()).find(part => part.startsWith(prefix));
  return value ? value.slice(prefix.length) : "";
}

function tokenDigest(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function requestIsSameOrigin(req) {
  const origin = req.get("origin");
  if (!origin) return false;
  try {
    const parsedOrigin = new URL(origin);
    return parsedOrigin.host === req.get("host") && parsedOrigin.protocol === `${req.protocol}:`;
  } catch {
    return false;
  }
}

function setSessionCookie(res, token) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `mdl_admin=${encodeURIComponent(token)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${sessionDuration / 1000}${secure}`);
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader("Set-Cookie", `mdl_admin=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secure}`);
}

function consumeAttempt(map, key, limit) {
  const now = Date.now();
  if (map.size > 10000) {
    for (const [address, attempt] of map) {
      if (attempt.resetAt <= now) map.delete(address);
    }
  }
  let attempt = map.get(key);
  if (!attempt || attempt.resetAt <= now) {
    attempt = { count: 0, resetAt: now + 15 * 60 * 1000 };
  }
  if (attempt.count >= limit) {
    map.set(key, attempt);
    return false;
  }
  attempt.count += 1;
  map.set(key, attempt);
  return true;
}

async function setupAdmin(req, res) {
  if (!process.env.ADMIN_SETUP_TOKEN) {
    return res.status(404).json({ message: "Initial administrator setup is unavailable." });
  }
  if (!requestIsSameOrigin(req)) {
    return res.status(403).json({ message: "Setup requests must come from this site." });
  }
  const address = req.ip;
  if (!consumeAttempt(setupAttempts, address, 5)) {
    return res.status(429).json({ message: "Too many setup attempts. Try again later." });
  }

  const { setupToken, username, email, password } = req.body || {};
  if (typeof setupToken !== "string" || !safeEqual(setupToken, process.env.ADMIN_SETUP_TOKEN)) {
    return res.status(401).json({ message: "Invalid setup token." });
  }
  if (typeof username !== "string" || !/^[a-zA-Z0-9._-]{3,64}$/.test(username) ||
      typeof email !== "string" || email.length > 190 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      typeof password !== "string" || password.length < 12 || password.length > 128) {
    return res.status(400).json({ message: "Provide a valid username, email, and password of at least 12 characters." });
  }

  try {
    const user = await adminModel.createFirstAdmin({
      username,
      email: email.trim().toLowerCase(),
      passwordHash: hashPassword(password)
    });
    if (!user) return res.status(409).json({ message: "Initial administrator setup has already been completed." });
    setupAttempts.delete(address);
    process.env.ADMIN_SETUP_TOKEN = "";
    const token = crypto.randomBytes(32).toString("base64url");
    const csrfToken = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + sessionDuration);
    await adminModel.createSession(user.id, tokenDigest(token), csrfToken, expiresAt);
    setSessionCookie(res, token);
    return res.status(201).json({ message: "Administrator created.", csrfToken, user });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(409).json({ message: "That username or email is already in use." });
    }
    console.error("Admin setup error:", error.message);
    return res.status(500).json({ message: "Unable to complete administrator setup." });
  }
}

async function loginAdmin(req, res) {
  if (!requestIsSameOrigin(req)) {
    return res.status(403).json({ message: "Sign-in requests must come from this site." });
  }
  const { username, password } = req.body || {};
  const login = typeof username === "string" ? username.trim().slice(0, 190) : "";
  const address = req.ip;
  if (!consumeAttempt(loginAttempts, address, 5)) {
    return res.status(429).json({ message: "Too many login attempts. Try again later." });
  }
  if (!login || typeof password !== "string" || password.length > 128) {
    return res.status(401).json({ message: "Invalid username/email or password." });
  }

  try {
    const user = await adminModel.findAdminByLogin(login);
    if (!user || !user.active || !verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ message: "Invalid username/email or password." });
    }
    loginAttempts.delete(address);
    const token = crypto.randomBytes(32).toString("base64url");
    const csrfToken = crypto.randomBytes(32).toString("hex");
    await adminModel.createSession(user.id, tokenDigest(token), csrfToken, new Date(Date.now() + sessionDuration));
    setSessionCookie(res, token);
    return res.json({
      message: "Signed in.",
      csrfToken,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (error) {
    console.error("Admin login error:", error.message);
    return res.status(500).json({ message: "Unable to sign in right now." });
  }
}

async function adminSession(req, res) {
  const token = readCookie(req, "mdl_admin");
  if (!token) {
    return res.json({
      configured: Boolean(process.env.ADMIN_SETUP_TOKEN),
      authenticated: false
    });
  }
  try {
    const session = await adminModel.findSession(tokenDigest(token));
    if (!session) {
      clearSessionCookie(res);
      return res.json({ configured: Boolean(process.env.ADMIN_SETUP_TOKEN), authenticated: false });
    }
    return res.json({
      configured: Boolean(process.env.ADMIN_SETUP_TOKEN),
      authenticated: true,
      csrfToken: session.csrf_token,
      user: { id: session.id, username: session.username, email: session.email, role: session.role }
    });
  } catch (error) {
    console.error("Admin session lookup error:", error.message);
    return res.status(500).json({ message: "Unable to verify administrator session." });
  }
}

async function requireAdmin(req, res, next) {
  const token = readCookie(req, "mdl_admin");
  if (!token) return res.status(401).json({ message: "Administrator authentication required." });
  try {
    const session = await adminModel.findSession(tokenDigest(token));
    if (!session) {
      clearSessionCookie(res);
      return res.status(401).json({ message: "Administrator authentication required." });
    }
    req.admin = {
      id: session.id,
      username: session.username,
      email: session.email,
      role: session.role,
      sessionDigest: tokenDigest(token),
      csrfToken: session.csrf_token
    };
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (!requestIsSameOrigin(req)) {
        return res.status(403).json({ message: "Changes must be submitted from this site." });
      }
      const suppliedToken = req.get("x-csrf-token");
      if (!suppliedToken || !safeEqual(suppliedToken, session.csrf_token)) {
        return res.status(403).json({ message: "A valid CSRF token is required." });
      }
    }
    return next();
  } catch (error) {
    console.error("Admin authorization error:", error.message);
    return res.status(500).json({ message: "Unable to verify administrator access." });
  }
}

async function logoutAdmin(req, res) {
  try {
    await adminModel.deleteSession(req.admin.sessionDigest, req.admin.id);
    clearSessionCookie(res);
    return res.json({ message: "Signed out." });
  } catch (error) {
    console.error("Admin logout error:", error.message);
    return res.status(500).json({ message: "Unable to sign out." });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.admin || !roles.includes(req.admin.role)) {
      return res.status(403).json({ message: "You do not have permission to perform this action." });
    }
    return next();
  };
}

module.exports = {
  setupAdmin,
  loginAdmin,
  adminSession,
  requireAdmin,
  requireRole,
  logoutAdmin,
  hashPassword
};
