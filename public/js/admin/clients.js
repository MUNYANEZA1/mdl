import { adminRequest, makeElement } from "/js/admin/api.js";

const form = document.getElementById("clientForm");
const list = document.getElementById("clientList");
const history = document.getElementById("clientHistory");
let assignees = [];
let currentPage = 1;
let currentResult = { items: [], total: 0, pageSize: 20 };

function fillAssigneeSelect(select, selectedId) {
  select.replaceChildren();
  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = "Unassigned";
  select.append(empty);
  for (const person of assignees) {
    const option = document.createElement("option");
    option.value = String(person.id);
    option.textContent = `${person.username} (${person.role})`;
    option.selected = String(person.id) === String(selectedId || "");
    select.append(option);
  }
}

function editClient(client) {
  form.elements.namedItem("id").value = client.id;
  for (const key of ["name", "organizationType", "email", "phone", "status", "internalNotes"]) {
    const field = form.elements.namedItem(key);
    const source = key === "internalNotes" ? "internal_notes" : key === "organizationType" ? "organization_type" : key;
    field.value = client[source] || "";
  }
  fillAssigneeSelect(form.elements.namedItem("assignedAdminUserId"), client.assigned_admin_user_id);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderClient(client) {
  const item = makeElement("article", "admin-item");
  item.append(makeElement("h3", "", client.name));
  item.append(makeElement("p", "", `${client.organization_type} · ${client.status}`));
  item.append(makeElement("p", "", `${client.email || "No email"} · ${client.phone || "No phone"}`));
  item.append(makeElement("p", "", `${client.service_request_count} service request(s) · ${client.training_request_count} training request(s)`));
  if (client.internal_notes) item.append(makeElement("p", "", `Internal notes: ${client.internal_notes}`));
  const actions = makeElement("div", "admin-item-actions");
  if (document.body.dataset.adminRole !== "Staff") {
    const edit = makeElement("button", "btn btn-secondary", "Edit profile");
    edit.type = "button";
    edit.addEventListener("click", () => editClient(client));
    actions.append(edit);
  }
  const viewHistory = makeElement("button", "btn btn-secondary", "View history");
  viewHistory.type = "button";
  viewHistory.addEventListener("click", () => loadHistory(client.id, client.name));
  actions.append(viewHistory);
  item.append(actions);
  return item;
}

async function loadHistory(id, name) {
  history.replaceChildren(makeElement("p", "admin-feedback", `Loading activity for ${name}…`));
  try {
    const result = await adminRequest(`/api/admin/clients/${id}/history`);
    history.replaceChildren();
    const entries = [
      ...result.serviceRequests.map(record => ({ ...record, type: "Technology service" })),
      ...result.trainingRequests.map(record => ({ ...record, type: "Corporate training" }))
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    if (!entries.length) history.append(makeElement("p", "admin-empty", "No linked service or training history."));
    for (const entry of entries) {
      const item = makeElement("article", "admin-item admin-activity");
      item.append(makeElement("h3", "", `${entry.type} · ${entry.detail}`));
      item.append(makeElement("p", "", `#${entry.id} · ${entry.status}`));
      item.append(makeElement("time", "", new Date(entry.created_at).toLocaleString()));
      history.append(item);
    }
  } catch (error) {
    history.replaceChildren(makeElement("p", "admin-error", error.message));
  }
}

function query() {
  const params = new URLSearchParams({ page: String(currentPage), pageSize: "20" });
  const search = document.getElementById("clientSearch").value.trim();
  const organizationType = document.getElementById("clientTypeFilter").value;
  const status = document.getElementById("clientStatusFilter").value;
  if (search) params.set("search", search);
  if (organizationType) params.set("organizationType", organizationType);
  if (status) params.set("status", status);
  return params;
}

export async function loadClients() {
  form.hidden = document.body.dataset.adminRole === "Staff";
  list.replaceChildren(makeElement("p", "admin-feedback", "Loading client directory…"));
  try {
    if (document.body.dataset.adminRole !== "Staff" && !assignees.length) {
      assignees = await adminRequest("/api/admin/assignees");
      fillAssigneeSelect(form.elements.namedItem("assignedAdminUserId"), "");
    }
    currentResult = await adminRequest(`/api/admin/clients?${query()}`);
    list.replaceChildren();
    for (const client of currentResult.items) list.append(renderClient(client));
    if (!currentResult.items.length) list.append(makeElement("p", "admin-empty", "No clients match these filters."));
    document.getElementById("clientPageLabel").textContent =
      `Page ${currentResult.page} of ${Math.max(1, Math.ceil(currentResult.total / currentResult.pageSize))}`;
    document.getElementById("clientPrevious").disabled = currentResult.page <= 1;
    document.getElementById("clientNext").disabled = currentResult.page * currentResult.pageSize >= currentResult.total;
  } catch (error) {
    list.replaceChildren(makeElement("p", "admin-error", error.message));
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const id = data.id;
  delete data.id;
  data.assignedAdminUserId = data.assignedAdminUserId || null;
  try {
    const result = await adminRequest(id ? `/api/admin/clients/${id}` : "/api/admin/clients", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(data)
    });
    const message = form.querySelector(".form-message");
    message.textContent = result.message;
    message.className = "form-message success";
    form.reset();
    form.elements.namedItem("id").value = "";
    fillAssigneeSelect(form.elements.namedItem("assignedAdminUserId"), "");
    await loadClients();
  } catch (error) {
    const message = form.querySelector(".form-message");
    message.textContent = error.message;
    message.className = "form-message error";
  }
});

document.getElementById("clientFormReset").addEventListener("click", () => {
  form.reset();
  form.elements.namedItem("id").value = "";
  fillAssigneeSelect(form.elements.namedItem("assignedAdminUserId"), "");
  form.querySelector(".form-message").textContent = "";
});

for (const id of ["clientSearch", "clientTypeFilter", "clientStatusFilter"]) {
  document.getElementById(id).addEventListener(id === "clientSearch" ? "input" : "change", () => {
    currentPage = 1;
    loadClients();
  });
}
document.getElementById("clientPrevious").addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  loadClients();
});
document.getElementById("clientNext").addEventListener("click", () => {
  currentPage += 1;
  loadClients();
});
