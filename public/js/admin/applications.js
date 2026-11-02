import { adminRequest, makeElement } from "/js/admin/api.js";

const applicationList = document.getElementById("applicationList");
const statusMessage = document.getElementById("applicationStatus");
const filters = ["applicationSearch", "typeFilter", "departmentFilter", "applicationStatusFilter", "applicationEducationFilter"];
const statuses = ["New", "Under review", "Shortlisted", "Interview Scheduled", "Accepted", "Rejected", "Waitlisted", "In Progress", "Completed"];
const staffStatuses = ["Under review", "Shortlisted", "Interview Scheduled", "Waitlisted", "In Progress", "Completed"];
let currentPage = 1;
let currentResult = { items: [], total: 0, pageSize: 20 };
let reviewers = [];

function appendOptions(select, values, selected) {
  for (const value of values) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    option.selected = value === selected;
    select.append(option);
  }
}

function appendReviewerSelect(selectedId) {
  const label = makeElement("label", "", "Assigned reviewer");
  const select = document.createElement("select");
  const unassigned = document.createElement("option");
  unassigned.value = "";
  unassigned.textContent = "Unassigned";
  select.append(unassigned);
  for (const reviewer of reviewers) {
    const option = document.createElement("option");
    option.value = String(reviewer.id);
    option.textContent = `${reviewer.username} (${reviewer.role})`;
    option.selected = String(reviewer.id) === String(selectedId || "");
    select.append(option);
  }
  label.append(select);
  return { label, select };
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleDateString();
}

function renderApplication(application) {
  const item = makeElement("article", "admin-item admin-record applicant-item");
  item.append(makeElement("h3", "", application.full_name));
  item.append(makeElement("p", "", `${application.internship_type} · ${application.department} · ${application.education_level}`));
  item.append(makeElement("p", "", `${application.email} · ${application.phone} · ${application.institution}`));
  item.append(makeElement("p", "", `${application.field_of_study} · ${application.preferred_duration}${application.start_date ? ` · Starts ${formatDate(application.start_date)}` : ""}`));
  item.append(makeElement("p", "", `Guardian involvement: ${application.guardian_consent ? "Confirmed" : "Not confirmed"}`));
  item.append(makeElement("p", "", application.reason));
  if (application.skills) item.append(makeElement("p", "", `Skills: ${application.skills}`));
  item.append(makeElement("time", "", `Applied ${new Date(application.created_at).toLocaleString()}`));
  const isMinorReview = Boolean(application.minor_review_required);
  if (isMinorReview) {
    const warning = makeElement("p", "admin-minor-warning", "High-school application: review guardian involvement and school placement requirements. Submission does not guarantee placement.");
    warning.setAttribute("role", "note");
    item.append(warning);
  }
  if (application.portfolio_url) {
    const portfolio = document.createElement("a");
    portfolio.href = application.portfolio_url;
    portfolio.target = "_blank";
    portfolio.rel = "noopener noreferrer";
    portfolio.textContent = "Open portfolio";
    item.append(portfolio);
  }

  const editor = makeElement("div", "admin-record-editor");
  const statusLabel = makeElement("label", "", "Application status");
  const status = document.createElement("select");
  const userRole = document.body.dataset.adminRole;
  const selectableStatuses = userRole === "Staff" ? staffStatuses : statuses;
  const options = selectableStatuses.includes(application.status)
    ? selectableStatuses
    : [...selectableStatuses, application.status];
  appendOptions(status, options, application.status);
  const statusMayBeSaved = selectableStatuses.includes(application.status);
  statusLabel.append(status);
  const notesLabel = makeElement("label", "", "Private internal notes");
  const notes = document.createElement("textarea");
  notes.maxLength = 4000;
  notes.value = application.internal_notes || "";
  notesLabel.append(notes);
  const save = makeElement("button", "btn btn-secondary", "Save review");
  save.type = "button";
  save.disabled = userRole === "Staff" && !statusMayBeSaved;
  status.addEventListener("change", () => {
    save.disabled = userRole === "Staff" && !selectableStatuses.includes(status.value);
  });
  save.addEventListener("click", async () => {
    save.disabled = true;
    try {
      const body = { status: status.value, internalNotes: notes.value };
      if (userRole !== "Staff") {
        body.reviewerAdminUserId = reviewer.select.value || null;
        body.schoolLetterReceived = schoolLetter.checked;
      }
      const result = await adminRequest(`/api/admin/applications/${application.id}`, {
        method: "PATCH",
        body: JSON.stringify(body)
      });
      statusMessage.textContent = result.message;
      await loadApplications();
    } catch (error) {
      statusMessage.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });
  editor.append(statusLabel);
  let reviewer;
  let schoolLetter;
  if (userRole !== "Staff") {
    reviewer = appendReviewerSelect(application.reviewer_admin_user_id);
    const schoolLetterLabel = makeElement("label", "admin-publish");
    schoolLetter = document.createElement("input");
    schoolLetter.type = "checkbox";
    schoolLetter.checked = Boolean(application.school_letter_received);
    schoolLetterLabel.append(schoolLetter, document.createTextNode(" School placement letter received"));
    editor.append(reviewer.label, schoolLetterLabel);
  }
  editor.append(notesLabel, save);
  item.append(editor);
  return item;
}

function buildQuery() {
  const params = new URLSearchParams({ page: String(currentPage), pageSize: "20" });
  const mapping = {
    applicationSearch: "search",
    typeFilter: "type",
    departmentFilter: "department",
    applicationStatusFilter: "status",
    applicationEducationFilter: "educationLevel"
  };
  for (const id of filters) {
    const value = document.getElementById(id).value;
    if (value) params.set(mapping[id], value);
  }
  return params;
}

export async function loadApplications() {
  applicationList.replaceChildren();
  statusMessage.textContent = "Loading applications…";
  try {
    const userRole = document.body.dataset.adminRole;
    if (userRole !== "Staff" && !reviewers.length) {
      reviewers = await adminRequest("/api/admin/assignees");
    }
    currentResult = await adminRequest(`/api/admin/applications?${buildQuery()}`);
    for (const application of currentResult.items) applicationList.append(renderApplication(application));
    statusMessage.textContent = currentResult.total
      ? `${currentResult.total} application(s)`
      : "No applications match these filters.";
    document.getElementById("applicationPageLabel").textContent =
      `Page ${currentResult.page} of ${Math.max(1, Math.ceil(currentResult.total / currentResult.pageSize))}`;
    document.getElementById("applicationPrevious").disabled = currentResult.page <= 1;
    document.getElementById("applicationNext").disabled = currentResult.page * currentResult.pageSize >= currentResult.total;
  } catch (error) {
    statusMessage.textContent = error.message;
  }
}

for (const id of filters) {
  document.getElementById(id).addEventListener(id === "applicationSearch" ? "input" : "change", () => {
    currentPage = 1;
    loadApplications();
  });
}
document.getElementById("applicationPrevious").addEventListener("click", () => {
  currentPage = Math.max(1, currentPage - 1);
  loadApplications();
});
document.getElementById("applicationNext").addEventListener("click", () => {
  currentPage += 1;
  loadApplications();
});
