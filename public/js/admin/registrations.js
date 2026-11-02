import { adminRequest, makeElement } from "/js/admin/api.js";

const list = document.getElementById("registrationList");
const statusMessage = document.getElementById("registrationStatusMessage");
const filterIds = [
  "registrationSearch", "registrationCourseFilter", "registrationStatusFilter",
  "registrationLevelFilter", "registrationModeFilter", "registrationFromFilter", "registrationToFilter"
];
const statuses = ["New", "Contacted", "Awaiting Payment", "Enrolled", "In Training", "Completed", "Cancelled", "Closed"];
const staffStatuses = ["Contacted", "Awaiting Payment", "In Training", "Completed"];
let currentPage = 1;
let currentResult = { items: [], total: 0, pageSize: 20 };
let assignees = [];

function optionList(select, values, current) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === current;
    select.append(option);
  }
}

function renderRegistration(registration) {
  const item = makeElement("article", "admin-item admin-record");
  item.append(makeElement("h3", "", registration.full_name));
  item.append(makeElement("p", "", `${registration.course} · ${registration.skill_level} · ${registration.learning_mode}`));
  item.append(makeElement("p", "", `${registration.email || "No email"} · ${registration.phone}`));
  if (registration.assigned_username) item.append(makeElement("p", "", `Assigned to ${registration.assigned_username}`));
  if (registration.preferred_schedule) item.append(makeElement("p", "", `Preferred schedule: ${registration.preferred_schedule}`));
  if (registration.goals) item.append(makeElement("p", "", `Goals: ${registration.goals}`));
  item.append(makeElement("time", "", `Registered ${new Date(registration.created_at).toLocaleString()}`));

  const editor = makeElement("div", "admin-record-editor");
  const statusLabel = makeElement("label", "", "Registration status");
  const status = document.createElement("select");
  const userRole = document.body.dataset.adminRole;
  const selectableStatuses = userRole === "Staff" ? staffStatuses : statuses;
  optionList(status, selectableStatuses.includes(registration.status)
    ? selectableStatuses
    : [...selectableStatuses, registration.status], registration.status);
  statusLabel.append(status);
  const notesLabel = makeElement("label", "", "Internal notes");
  const notes = document.createElement("textarea");
  notes.maxLength = 4000;
  notes.value = registration.internal_notes || "";
  notesLabel.append(notes);
  const save = makeElement("button", "btn btn-secondary", "Save changes");
  save.type = "button";
  save.disabled = userRole === "Staff" && !selectableStatuses.includes(registration.status);
  status.addEventListener("change", () => {
    save.disabled = userRole === "Staff" && !selectableStatuses.includes(status.value);
  });
  let assigned;
  if (userRole !== "Staff") {
    const assignedLabel = makeElement("label", "", "Assigned staff");
    assigned = document.createElement("select");
    const unassigned = document.createElement("option");
    unassigned.value = "";
    unassigned.textContent = "Unassigned";
    assigned.append(unassigned);
    for (const person of assignees) {
      const option = document.createElement("option");
      option.value = String(person.id);
      option.textContent = `${person.username} (${person.role})`;
      option.selected = String(person.id) === String(registration.assigned_admin_user_id || "");
      assigned.append(option);
    }
    assignedLabel.append(assigned);
    editor.append(statusLabel, assignedLabel, notesLabel);
  } else {
    editor.append(statusLabel, notesLabel);
  }
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const result = await adminRequest(`/api/admin/registrations/${registration.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status: status.value,
          internalNotes: notes.value,
          ...(userRole !== "Staff" ? { assignedAdminUserId: assigned.value || null } : {})
        })
      });
      statusMessage.textContent = result.message;
      await loadRegistrations();
    } catch (error) {
      statusMessage.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });
  editor.append(save);
  item.append(editor);
  return item;
}

function currentFilters() {
  const params = new URLSearchParams({ page: String(currentPage), pageSize: "20" });
  for (const id of filterIds) {
    const element = document.getElementById(id);
    if (element.value) {
      const key = id.replace(/^registration/, "").replace(/Filter$/, "");
      const apiKey = {
        Search: "search", Course: "course", Status: "status", Level: "level", Mode: "mode",
        From: "from", To: "to"
      }[key];
      params.set(apiKey, element.value);
    }
  }
  return params;
}

export async function loadRegistrations() {
  list.replaceChildren();
  statusMessage.textContent = "Loading registrations…";
  try {
    if (document.body.dataset.adminRole !== "Staff" && !assignees.length) {
      assignees = await adminRequest("/api/admin/assignees");
    }
    currentResult = await adminRequest(`/api/admin/registrations?${currentFilters()}`);
    for (const registration of currentResult.items) list.append(renderRegistration(registration));
    statusMessage.textContent = currentResult.total
      ? `${currentResult.total} registration(s)`
      : "No registrations match these filters.";
    document.getElementById("registrationPageLabel").textContent =
      `Page ${currentResult.page} of ${Math.max(1, Math.ceil(currentResult.total / currentResult.pageSize))}`;
    document.getElementById("registrationPrevious").disabled = currentResult.page <= 1;
    document.getElementById("registrationNext").disabled =
      currentResult.page * currentResult.pageSize >= currentResult.total;
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

for (const id of filterIds) {
  document.getElementById(id).addEventListener("change", () => {
    currentPage = 1;
    loadRegistrations();
  });
}
document.getElementById("registrationSearch").addEventListener("input", () => {
  currentPage = 1;
  loadRegistrations();
});
document.getElementById("registrationPrevious").addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  loadRegistrations();
});
document.getElementById("registrationNext").addEventListener("click", () => {
  currentPage += 1;
  loadRegistrations();
});

function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

document.getElementById("registrationExport").addEventListener("click", () => {
  const columns = [
    ["full_name", "Name"], ["email", "Email"], ["phone", "Phone"], ["course", "Course"],
    ["skill_level", "Level"], ["learning_mode", "Format"], ["status", "Status"],
    ["preferred_schedule", "Preferred schedule"], ["created_at", "Registered at"]
  ];
  const lines = [
    columns.map(([, label]) => csvCell(label)).join(","),
    ...currentResult.items.map(row => columns.map(([key]) => csvCell(row[key])).join(","))
  ];
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "mdl-registrations.csv";
  anchor.click();
  URL.revokeObjectURL(url);
});
