import { adminRequest, makeElement } from "/js/admin/api.js";

const serviceStatuses = ["New Request", "Contacted", "Consultation Scheduled", "Proposal Sent", "Negotiation", "Approved", "In Progress", "Completed", "Rejected", "Cancelled", "Under review", "Closed"];
const trainingStatuses = ["New Request", "Contacted", "Proposal Sent", "Approved", "Scheduled", "In Progress", "Completed", "Cancelled", "Under review", "Closed"];
const staffServiceStatuses = ["Contacted", "Consultation Scheduled", "In Progress", "Completed"];
const staffTrainingStatuses = ["Contacted", "In Progress", "Completed"];
const priorities = ["Low", "Normal", "High", "Urgent"];
let assignees = [];
let servicePage = 1;
let trainingPage = 1;
let serviceResult = { items: [], total: 0, pageSize: 20 };
let trainingResult = { items: [], total: 0, pageSize: 20 };
let assigneesLoaded = false;

function appendSelect(labelText, values, selected, className = "") {
  const label = makeElement("label", className, labelText);
  const select = document.createElement("select");
  if (selected && !values.includes(selected)) values = [...values, selected];
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selected;
    select.append(option);
  }
  label.append(select);
  return { label, select };
}

function appendAssignee(labelText, selectedId) {
  const label = makeElement("label", "", labelText);
  const select = document.createElement("select");
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
  label.append(select);
  return { label, select };
}

function appendInput(labelText, type, value, options = {}) {
  const label = makeElement("label", "", labelText);
  const input = document.createElement("input");
  input.type = type;
  if (options.min != null) input.min = String(options.min);
  if (options.max != null) input.max = String(options.max);
  if (options.step != null) input.step = String(options.step);
  if (options.maxLength != null) input.maxLength = options.maxLength;
  if (value == null) input.value = "";
  else if (type === "date") {
    const raw = String(value);
    const date = new Date(value);
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) input.value = raw;
    else if (Number.isNaN(date.valueOf())) input.value = "";
    else {
      const pad = number => String(number).padStart(2, "0");
      input.value = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }
  } else input.value = String(value);
  label.append(input);
  return { label, input };
}

function appendTextarea(labelText, value) {
  const label = makeElement("label", "", labelText);
  const textarea = document.createElement("textarea");
  textarea.maxLength = 4000;
  textarea.rows = 3;
  textarea.value = value || "";
  label.append(textarea);
  return { label, textarea };
}

function addContact(item, request) {
  item.append(makeElement("p", "", `${request.organization_name || request.contact_name} · ${request.contact_name}`));
  item.append(makeElement("p", "", `${request.email || "No email"} · ${request.phone}`));
}

function renderServiceRequest(request) {
  const item = makeElement("article", "admin-item admin-record");
  item.append(makeElement("h3", "", request.organization_name || request.contact_name));
  item.append(makeElement("p", "", `${request.service_category} · ${request.sector || "No sector"}`));
  addContact(item, request);
  if (request.description) item.append(makeElement("p", "", request.description));
  item.append(makeElement("time", "", `Received ${new Date(request.created_at).toLocaleString()}`));
  const editor = makeElement("div", "admin-record-editor");
  const isStaff = document.body.dataset.adminRole === "Staff";
  const selectableStatuses = isStaff ? staffServiceStatuses : serviceStatuses;
  const status = appendSelect("Status", selectableStatuses, request.status);
  const priority = !isStaff && appendSelect("Priority", priorities, request.priority || "Normal");
  const assignee = !isStaff && appendAssignee("Assigned staff", request.assigned_admin_user_id);
  const due = !isStaff && appendInput("Expected completion", "date", request.expected_completion_date);
  const estimated = !isStaff && appendInput("Estimated value (RWF)", "number", request.estimated_value_rwf, { min: 0, step: "0.01" });
  const agreed = !isStaff && appendInput("Agreed value (RWF)", "number", request.agreed_value_rwf, { min: 0, step: "0.01" });
  const progress = !isStaff && appendInput("Progress (%)", "number", request.progress || 0, { min: 0, max: 100, step: 1 });
  const projectNotes = !isStaff && appendTextarea("Project notes", request.project_notes);
  const internalNotes = appendTextarea("Internal notes", request.internal_notes);
  const save = makeElement("button", "btn btn-secondary", "Save request");
  save.type = "button";
  save.disabled = isStaff && !selectableStatuses.includes(request.status);
  status.select.addEventListener("change", () => {
    save.disabled = isStaff && !selectableStatuses.includes(status.select.value);
  });
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const body = { status: status.select.value, internalNotes: internalNotes.textarea.value };
      if (!isStaff) {
        Object.assign(body, {
          assignedAdminUserId: assignee.select.value || null,
          priority: priority.select.value,
          expectedCompletionDate: due.input.value || null,
          estimatedValueRwf: estimated.input.value || null,
          agreedValueRwf: agreed.input.value || null,
          progress: Number(progress.input.value),
          projectNotes: projectNotes.textarea.value
        });
      }
      const result = await adminRequest(`/api/admin/service-requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      document.getElementById("serviceStatusMessage").textContent = result.message;
      await loadServiceRequests();
    } catch (error) {
      document.getElementById("serviceStatusMessage").textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });
  editor.append(status.label);
  if (!isStaff) editor.append(priority.label, assignee.label, due.label, estimated.label,
    agreed.label, progress.label, projectNotes.label);
  editor.append(internalNotes.label, save);
  item.append(editor);
  return item;
}

function renderTrainingRequest(request) {
  const item = makeElement("article", "admin-item admin-record");
  item.append(makeElement("h3", "", request.organization_name));
  item.append(makeElement("p", "", `${request.topic} · ${request.participant_count} participant(s) · ${request.delivery_method}`));
  addContact(item, request);
  if (request.preferred_dates) item.append(makeElement("p", "", `Requested dates: ${request.preferred_dates}`));
  if (request.requirements) item.append(makeElement("p", "", request.requirements));
  item.append(makeElement("time", "", `Received ${new Date(request.created_at).toLocaleString()}`));
  const editor = makeElement("div", "admin-record-editor");
  const isStaff = document.body.dataset.adminRole === "Staff";
  const selectableStatuses = isStaff ? staffTrainingStatuses : trainingStatuses;
  const status = appendSelect("Status", selectableStatuses, request.status);
  const coordinator = !isStaff && appendAssignee("Training coordinator", request.coordinator_admin_user_id);
  const proposed = !isStaff && appendInput("Proposed fee (RWF)", "number", request.proposed_fee_rwf, { min: 0, step: "0.01" });
  const agreed = !isStaff && appendInput("Agreed fee (RWF)", "number", request.agreed_fee_rwf, { min: 0, step: "0.01" });
  const start = !isStaff && appendInput("Training start", "date", request.training_start_date);
  const end = !isStaff && appendInput("Training end", "date", request.training_end_date);
  const proposal = !isStaff && appendTextarea("Proposal notes", request.proposal_notes);
  const notes = appendTextarea("Internal notes", request.internal_notes);
  const save = makeElement("button", "btn btn-secondary", "Save training request");
  save.type = "button";
  save.disabled = isStaff && !selectableStatuses.includes(request.status);
  status.select.addEventListener("change", () => {
    save.disabled = isStaff && !selectableStatuses.includes(status.select.value);
  });
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const body = { status: status.select.value, internalNotes: notes.textarea.value };
      if (!isStaff) {
        Object.assign(body, {
          coordinatorAdminUserId: coordinator.select.value || null,
          proposedFeeRwf: proposed.input.value || null,
          agreedFeeRwf: agreed.input.value || null,
          trainingStartDate: start.input.value || null,
          trainingEndDate: end.input.value || null,
          proposalNotes: proposal.textarea.value
        });
      }
      const result = await adminRequest(`/api/admin/corporate-training-requests/${request.id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      document.getElementById("trainingStatusMessage").textContent = result.message;
      await loadTrainingRequests();
    } catch (error) {
      document.getElementById("trainingStatusMessage").textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });
  editor.append(status.label);
  if (!isStaff) editor.append(coordinator.label, proposed.label, agreed.label, start.label,
    end.label, proposal.label);
  editor.append(notes.label, save);
  item.append(editor);
  return item;
}

function queryFor(prefix, page) {
  const search = document.getElementById(`${prefix}Search`).value.trim();
  const status = document.getElementById(`${prefix}StatusFilter`).value;
  const params = new URLSearchParams({ page: String(page), pageSize: "20" });
  if (search) params.set("search", search);
  if (status) params.set("status", status);
  if (prefix === "service") {
    const category = document.getElementById("serviceCategoryFilter").value;
    if (category) params.set("category", category);
  }
  return params;
}

function updatePagination(prefix, result) {
  document.getElementById(`${prefix}PageLabel`).textContent =
    `Page ${result.page} of ${Math.max(1, Math.ceil(result.total / result.pageSize))}`;
  document.getElementById(`${prefix}Previous`).disabled = result.page <= 1;
  document.getElementById(`${prefix}Next`).disabled = result.page * result.pageSize >= result.total;
}

export async function loadServiceRequests() {
  const list = document.getElementById("serviceList");
  const message = document.getElementById("serviceStatusMessage");
  list.replaceChildren();
  message.textContent = "Loading service requests…";
  try {
    if (!assigneesLoaded && document.body.dataset.adminRole !== "Staff") await loadAssignees();
    else assigneesLoaded = true;
    serviceResult = await adminRequest(`/api/admin/service-requests?${queryFor("service", servicePage)}`);
    for (const request of serviceResult.items) list.append(renderServiceRequest(request));
    message.textContent = serviceResult.total ? `${serviceResult.total} service request(s)` : "No service requests found.";
    updatePagination("service", serviceResult);
  } catch (error) {
    message.textContent = error.message;
  }
}

export async function loadTrainingRequests() {
  const list = document.getElementById("trainingList");
  const message = document.getElementById("trainingStatusMessage");
  list.replaceChildren();
  message.textContent = "Loading corporate training requests…";
  try {
    if (!assigneesLoaded && document.body.dataset.adminRole !== "Staff") await loadAssignees();
    else assigneesLoaded = true;
    trainingResult = await adminRequest(`/api/admin/corporate-training-requests?${queryFor("training", trainingPage)}`);
    for (const request of trainingResult.items) list.append(renderTrainingRequest(request));
    message.textContent = trainingResult.total
      ? `${trainingResult.total} corporate training request(s)`
      : "No corporate training requests found.";
    updatePagination("training", trainingResult);
  } catch (error) {
    message.textContent = error.message;
  }
}

async function loadAssignees() {
  assignees = await adminRequest("/api/admin/assignees");
  assigneesLoaded = true;
}

for (const prefix of ["service", "training"]) {
  const filters = [`${prefix}StatusFilter`];
  if (prefix === "service") filters.push("serviceCategoryFilter");
  for (const filterId of filters) {
    document.getElementById(filterId).addEventListener("change", () => {
      if (prefix === "service") servicePage = 1;
      else trainingPage = 1;
      prefix === "service" ? loadServiceRequests() : loadTrainingRequests();
    });
  }
  document.getElementById(`${prefix}Search`).addEventListener("input", () => {
    if (prefix === "service") servicePage = 1;
    else trainingPage = 1;
    prefix === "service" ? loadServiceRequests() : loadTrainingRequests();
  });
  document.getElementById(`${prefix}Previous`).addEventListener("click", () => {
    if (prefix === "service") {
      servicePage = Math.max(1, servicePage - 1);
      loadServiceRequests();
    } else {
      trainingPage = Math.max(1, trainingPage - 1);
      loadTrainingRequests();
    }
  });
  document.getElementById(`${prefix}Next`).addEventListener("click", () => {
    if (prefix === "service") {
      servicePage += 1;
      loadServiceRequests();
    } else {
      trainingPage += 1;
      loadTrainingRequests();
    }
  });
}
