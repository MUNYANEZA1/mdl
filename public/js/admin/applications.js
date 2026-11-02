import { adminRequest, makeElement } from "/js/admin/api.js";

const applicationList = document.getElementById("applicationList");
const statusMessage = document.getElementById("applicationStatus");
const typeFilter = document.getElementById("typeFilter");
const departmentFilter = document.getElementById("departmentFilter");
typeFilter.addEventListener("change", loadApplications);
departmentFilter.addEventListener("change", loadApplications);

export async function loadApplications() {
  const params = new URLSearchParams();
  if (typeFilter.value) params.set("type", typeFilter.value);
  if (departmentFilter.value) params.set("department", departmentFilter.value);
  statusMessage.textContent = "Loading applications…";
  try {
    const applications = await adminRequest(`/api/admin/applications?${params}`);
    applicationList.replaceChildren();
    statusMessage.textContent = `${applications.length} application(s)`;
    for (const application of applications) {
      const item = makeElement("article", "admin-item applicant-item");
      item.append(makeElement("h3", "", application.full_name), makeElement("p", "", `${application.internship_type} · ${application.department} · ${application.education_level}`));
      item.append(makeElement("p", "", `${application.email} · ${application.phone} · ${application.institution}`));
      item.append(makeElement("p", "", application.reason));
      if (application.portfolio_url) {
        const portfolio = document.createElement("a"); portfolio.href = application.portfolio_url; portfolio.target = "_blank"; portfolio.rel = "noopener noreferrer"; portfolio.textContent = "Open portfolio"; item.append(portfolio);
      }
      const controls = makeElement("div", "admin-item-actions");
      const status = document.createElement("select");
      ["New", "Under review", "Shortlisted", "Accepted", "Rejected", "Completed"].forEach(value => {
        const option = document.createElement("option"); option.value = value; option.textContent = value; option.selected = value === application.status; status.append(option);
      });
      const notes = document.createElement("textarea"); notes.placeholder = "Internal notes"; notes.maxLength = 4000; notes.value = application.internal_notes || "";
      const save = makeElement("button", "btn btn-secondary", "Save review"); save.type = "button";
      save.addEventListener("click", async () => {
        try {
          await adminRequest(`/api/admin/applications/${application.id}`, { method: "PATCH", body: JSON.stringify({ status: status.value, internalNotes: notes.value }) });
          statusMessage.textContent = "Application updated.";
        } catch (error) { statusMessage.textContent = error.message; }
      });
      controls.append(status, save); item.append(notes, controls); applicationList.append(item);
    }
  } catch (error) {
    statusMessage.textContent = error.message;
    if (error.message.includes("authentication")) document.dispatchEvent(new Event("mdl:admin-session-expired"));
  }
}
