import { adminRequest } from "/js/admin/api.js";

const loginPanel = document.getElementById("loginPanel");
const dashboard = document.getElementById("dashboard");
const loginForm = document.getElementById("loginForm");

export function showDashboard() {
  loginPanel.hidden = true;
  dashboard.hidden = false;
}

export function showLogin() {
  dashboard.hidden = true;
  loginPanel.hidden = false;
}

loginForm.addEventListener("submit", async event => {
  event.preventDefault();
  const message = loginForm.querySelector(".form-message");
  const fields = new FormData(loginForm);
  try {
    await adminRequest("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ username: fields.get("username"), password: fields.get("password") })
    });
    loginForm.reset();
    showDashboard();
    document.dispatchEvent(new Event("mdl:admin-authenticated"));
  } catch (error) {
    message.textContent = error.message;
    message.className = "form-message error";
  }
});

document.getElementById("logoutButton").addEventListener("click", async () => {
  await adminRequest("/api/admin/logout", { method: "POST" }).catch(() => {});
  showLogin();
});

document.addEventListener("mdl:admin-session-expired", showLogin);

export async function restoreAdminSession() {
  try {
    const session = await adminRequest("/api/admin/session");
    if (session.authenticated) showDashboard();
    return session.authenticated;
  } catch {
    return false;
  }
}
