import { adminRequest, makeElement } from "/js/admin/api.js";

const staffList = document.getElementById("staffList");
const auditLogList = document.getElementById("auditLogList");
const staffForm = document.getElementById("staffForm");
const roles = ["Super Admin", "Administrator", "Staff"];

function renderStaff(user) {
  const item = makeElement("article", "admin-item");
  item.append(makeElement("h3", "", user.username));
  item.append(makeElement("p", "", `${user.email} · ${user.active ? "Active" : "Inactive"}`));
  item.append(makeElement("time", "", `Created ${new Date(user.created_at).toLocaleString()}`));
  const editor = makeElement("div", "admin-record-editor");
  const roleLabel = makeElement("label", "", "Role");
  const role = document.createElement("select");
  for (const value of roles) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === user.role;
    role.append(option);
  }
  roleLabel.append(role);
  const activeLabel = makeElement("label", "admin-publish");
  const active = document.createElement("input");
  active.type = "checkbox";
  active.checked = Boolean(user.active);
  activeLabel.append(active, document.createTextNode(" Account active"));
  const save = makeElement("button", "btn btn-secondary", "Save account");
  save.type = "button";
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      await adminRequest(`/api/admin/staff/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: role.value, active: active.checked })
      });
      await loadStaff();
    } catch (error) {
      document.getElementById("adminFeedback").textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });
  const resetPassword = document.createElement("input");
  resetPassword.type = "password";
  resetPassword.minLength = 12;
  resetPassword.maxLength = 128;
  resetPassword.autocomplete = "new-password";
  resetPassword.placeholder = "New password (min. 12 characters)";
  const reset = makeElement("button", "btn btn-secondary", "Reset password");
  reset.type = "button";
  reset.addEventListener("click", async () => {
    if (resetPassword.value.length < 12 || resetPassword.value.length > 128) {
      document.getElementById("adminFeedback").textContent = "The new password must be 12-128 characters.";
      return;
    }
    if (!window.confirm(`Reset the password for ${user.username}? Their active sessions will be revoked.`)) return;
    reset.disabled = true;
    try {
      const result = await adminRequest(`/api/admin/staff/${user.id}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPassword.value })
      });
      resetPassword.value = "";
      document.getElementById("adminFeedback").textContent = result.message;
      await loadStaff();
    } catch (error) {
      document.getElementById("adminFeedback").textContent = error.message;
    } finally {
      reset.disabled = false;
    }
  });
  editor.append(roleLabel, activeLabel, save, resetPassword, reset);
  item.append(editor);
  return item;
}

function renderAudit(entry) {
  const item = makeElement("article", "admin-item admin-activity");
  item.append(makeElement("h3", "", `${entry.actor || "System"} · ${entry.action}`));
  item.append(makeElement("p", "", `${entry.entity_type}${entry.entity_id ? ` #${entry.entity_id}` : ""}`));
  item.append(makeElement("time", "", new Date(entry.created_at).toLocaleString()));
  return item;
}

export async function loadStaff() {
  staffList.replaceChildren(makeElement("p", "admin-feedback", "Loading administrator accounts…"));
  auditLogList.replaceChildren(makeElement("p", "admin-feedback", "Loading audit log…"));
  try {
    const [users, logs] = await Promise.all([
      adminRequest("/api/admin/staff"),
      adminRequest("/api/admin/audit-logs?limit=50")
    ]);
    staffList.replaceChildren();
    auditLogList.replaceChildren();
    if (!users.length) staffList.append(makeElement("p", "admin-empty", "No administrator accounts found."));
    if (!logs.length) auditLogList.append(makeElement("p", "admin-empty", "No administrator activity yet."));
    for (const user of users) staffList.append(renderStaff(user));
    for (const entry of logs) auditLogList.append(renderAudit(entry));
  } catch (error) {
    staffList.replaceChildren(makeElement("p", "admin-error", error.message));
    auditLogList.replaceChildren();
  }
}

staffForm.addEventListener("submit", async event => {
  event.preventDefault();
  const fields = Object.fromEntries(new FormData(staffForm).entries());
  const message = staffForm.querySelector(".form-message");
  try {
    const result = await adminRequest("/api/admin/staff", {
      method: "POST",
      body: JSON.stringify(fields)
    });
    staffForm.reset();
    message.textContent = result.message;
    message.className = "form-message success";
    await loadStaff();
  } catch (error) {
    message.textContent = error.message;
    message.className = "form-message error";
  }
});
