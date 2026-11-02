import { adminRequest, clearAdminCsrfToken } from "/js/admin/api.js";

const loginPanel = document.getElementById("loginPanel");
const setupPanel = document.getElementById("setupPanel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");
const setupForm = document.getElementById("setupForm");
const showSetupButton = document.getElementById("showSetupButton");

export function showDashboard(user) {
  loginPanel.hidden = true;
  setupPanel.hidden = true;
  dashboard.hidden = false;
  if (user) {
    document.body.dataset.adminRole = user.role;
    document.getElementById("adminIdentity").textContent = `${user.username} · ${user.role}`;
    for (const panel of ["staffPanel", "settingsPanel"]) {
      document.querySelector(`[data-panel="${panel}"]`).hidden = user.role !== "Super Admin";
    }
    for (const panel of ["coursesPanel", "opportunitiesPanel", "reportsPanel", "contentPanel"]) {
      document.querySelector(`[data-panel="${panel}"]`).hidden = user.role === "Staff";
    }
    document.querySelector('[data-panel="overviewPanel"]').hidden = user.role === "Staff";
  }
}

export function showLogin() {
  dashboard.hidden = true;
  setupPanel.hidden = true;
  loginPanel.hidden = false;
  delete document.body.dataset.adminRole;
}

function showSetup() {
  dashboard.hidden = true;
  loginPanel.hidden = true;
  setupPanel.hidden = false;
}

function showFormMessage(form, error) {
  const message = form.querySelector(".form-message");
  message.textContent = error.message;
  message.className = "form-message error";
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const fields = new FormData(loginForm);
  try {
    const result = await adminRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: fields.get("username"), password: fields.get("password") })
    });
    loginForm.reset();
    showDashboard(result.user);
    document.dispatchEvent(new CustomEvent("mdl:admin-authenticated", { detail: result.user }));
  } catch (error) {
    showFormMessage(loginForm, error);
  }
});

setupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const fields = new FormData(setupForm);
  try {
    const result = await adminRequest("/api/admin/setup", {
      method: "POST",
      body: JSON.stringify({
        setupToken: fields.get("setupToken"),
        username: fields.get("username"),
        email: fields.get("email"),
        password: fields.get("password")
      })
    });
    setupForm.reset();
    showDashboard(result.user);
    document.dispatchEvent(new CustomEvent("mdl:admin-authenticated", { detail: result.user }));
  } catch (error) {
    showFormMessage(setupForm, error);
  }
});

document.getElementById("showSetupButton").addEventListener("click", showSetup);
document.getElementById("showLoginButton").addEventListener("click", showLogin);

document.querySelectorAll("[data-password-toggle]").forEach(button => {
  button.addEventListener("click", () => {
    const form = document.getElementById(button.dataset.passwordToggle);
    const password = form.querySelector('input[name="password"]');
    const visible = password.type === "password";
    password.type = visible ? "text" : "password";
    button.textContent = visible ? "Hide password" : "Show password";
  });
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  try {
    await adminRequest("/api/admin/logout", { method: "POST" });
    clearAdminCsrfToken();
    showLogin();
  } catch (error) {
    document.getElementById("adminFeedback").textContent = error.message;
  }
});

document.addEventListener("mdl:admin-session-expired", showLogin);

export async function restoreAdminSession() {
  try {
    const session = await adminRequest("/api/admin/session");
    showSetupButton.hidden = !session.configured;
    if (session.authenticated) showDashboard(session.user);
    return session.authenticated;
  } catch (error) {
    showLogin();
    document.getElementById("loginError").textContent = error.message;
    return false;
  }
}
