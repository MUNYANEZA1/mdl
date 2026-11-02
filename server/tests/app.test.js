const test = require("node:test");
const assert = require("node:assert/strict");
const app = require("../app");

let server;
let baseUrl;

test.before(async () => {
  server = app.listen(0);
  await new Promise(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections?.();
  });
});

test("health endpoint retains its response contract", async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok" });
});

test("course registration rejects invalid data before database access", async () => {
  const response = await fetch(`${baseUrl}/api/registrations`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({})
  });
  assert.equal(response.status, 400);
});

test("request workflows reject incomplete submissions", async () => {
  for (const endpoint of ["/api/service-requests", "/api/corporate-training-requests", "/api/internship-applications"]) {
    const response = await fetch(`${baseUrl}${endpoint}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({})
    });
    assert.equal(response.status, 400, endpoint);
  }
});

test("admin data remains protected without a valid session", async () => {
  const response = await fetch(`${baseUrl}/api/admin/opportunities`);
  assert.equal(response.status, 401);
});

test("all operational administrator endpoints require a session", async () => {
  for (const [path, method] of [
    ["/api/admin/overview", "GET"],
    ["/api/admin/registrations", "GET"],
    ["/api/admin/service-requests", "GET"],
    ["/api/admin/corporate-training-requests", "GET"],
    ["/api/admin/courses", "GET"],
    ["/api/admin/clients", "GET"],
    ["/api/admin/clients/1/history", "GET"],
    ["/api/admin/announcements", "GET"],
    ["/api/admin/reports/registrations", "GET"],
    ["/api/admin/staff", "GET"],
    ["/api/admin/audit-logs", "GET"],
    ["/api/admin/applications", "GET"],
    ["/api/admin/opportunities", "GET"],
    ["/api/admin/assignees", "GET"],
    ["/api/admin/courses", "POST"]
  ]) {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: method === "POST" ? { "content-type": "application/json" } : undefined,
      body: method === "POST" ? JSON.stringify({}) : undefined
    });
    assert.equal(response.status, 401, `${method} ${path}`);
  }
});

test("admin session probe succeeds without exposing credential state", async () => {
  const response = await fetch(`${baseUrl}/api/admin/session`);
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(typeof session.configured, "boolean");
  assert.equal(session.authenticated, false);
});

test("admin login rejects cross-origin requests", async () => {
  const response = await fetch(`${baseUrl}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: "https://attacker.example" },
    body: JSON.stringify({ username: "admin", password: "not-a-password" })
  });
  assert.equal(response.status, 403);
});

test("public pages and shared form components are served", async () => {
  for (const url of ["/", "/pages/services.html", "/pages/sectors.html", "/pages/academy.html",
    "/pages/internships.html", "/pages/careers.html", "/pages/contact.html",
    "/pages/corporate-training.html", "/admin.html", "/privacy.html",
    "/components/site-header.html", "/components/site-footer.html",
    "/components/registration-form.html", "/components/internship-form.html",
    "/js/admin/overview.js", "/js/admin/registrations.js", "/js/admin/courses.js",
    "/js/admin/requests.js"]) {
    const response = await fetch(`${baseUrl}${url}`);
    assert.equal(response.status, 200, url);
  }
});
