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
  await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
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

test("admin data remains protected when credentials are not configured", async () => {
  const response = await fetch(`${baseUrl}/api/admin/opportunities`);
  const credentialsConfigured = Boolean(process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD_HASH && process.env.MDL_ADMIN_SECRET);
  assert.equal(response.status, credentialsConfigured ? 401 : 503);
});

test("admin session probe succeeds without exposing credential state", async () => {
  const response = await fetch(`${baseUrl}/api/admin/session`);
  assert.equal(response.status, 200);
  const session = await response.json();
  assert.equal(typeof session.configured, "boolean");
  assert.equal(session.authenticated, false);
});

test("public pages and shared form components are served", async () => {
  for (const url of ["/", "/pages/services.html", "/pages/sectors.html", "/pages/academy.html",
    "/pages/internships.html", "/pages/careers.html", "/pages/contact.html",
    "/pages/corporate-training.html", "/admin.html", "/privacy.html",
    "/components/site-header.html", "/components/site-footer.html",
    "/components/registration-form.html", "/components/internship-form.html"]) {
    const response = await fetch(`${baseUrl}${url}`);
    assert.equal(response.status, 200, url);
  }
});
