import { adminRequest, makeElement } from "/js/admin/api.js";

const list = document.getElementById("adminOpportunityList");
const form = document.getElementById("opportunityForm");

export async function loadAdminOpportunities() {
  try {
    const opportunities = await adminRequest("/api/admin/opportunities");
    list.replaceChildren();
    if (!opportunities.length) list.append(makeElement("p", "admin-feedback", "No opportunities created yet."));
    for (const opportunity of opportunities) {
      const item = makeElement("article", "admin-item");
      item.append(makeElement("h3", "", opportunity.title), makeElement("p", "", `${opportunity.department} · ${opportunity.status} · ${opportunity.published ? "Published" : "Draft"}`));
      const actions = makeElement("div", "admin-item-actions");
      const status = document.createElement("select");
      ["Coming Soon", "Open", "Closed"].forEach(value => {
        const option = document.createElement("option"); option.value = value; option.textContent = value; option.selected = value === opportunity.status; status.append(option);
      });
      const publishedLabel = makeElement("label", "admin-publish");
      const published = document.createElement("input"); published.type = "checkbox"; published.checked = Boolean(opportunity.published);
      publishedLabel.append(published, document.createTextNode(" Published"));
      const save = makeElement("button", "btn btn-secondary", "Save"); save.type = "button";
      save.addEventListener("click", async () => {
        try {
          await adminRequest(`/api/admin/opportunities/${opportunity.id}`, { method: "PATCH", body: JSON.stringify({ status: status.value, published: published.checked }) });
          await loadAdminOpportunities();
        } catch (error) { window.alert(error.message); }
      });
      actions.append(status, publishedLabel, save); item.append(actions); list.append(item);
    }
  } catch (error) {
    list.replaceChildren(makeElement("p", "admin-feedback", error.message));
    if (error.message.includes("authentication")) document.dispatchEvent(new Event("mdl:admin-session-expired"));
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  data.published = form.elements.published.checked;
  data.availablePlaces = data.availablePlaces || null;
  const message = form.querySelector(".form-message");
  try {
    const result = await adminRequest("/api/admin/opportunities", { method: "POST", body: JSON.stringify(data) });
    message.textContent = result.message;
    message.className = "form-message success";
    form.reset();
    await loadAdminOpportunities();
  } catch (error) {
    message.textContent = error.message;
    message.className = "form-message error";
  }
});
