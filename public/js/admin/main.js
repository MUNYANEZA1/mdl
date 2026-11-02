import { restoreAdminSession } from "/js/admin/auth.js";
import { loadAdminOpportunities } from "/js/admin/opportunities.js";
import { loadApplications } from "/js/admin/applications.js";

function activatePanel(panelId) {
  document.querySelectorAll(".admin-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.panel === panelId));
  document.querySelectorAll(".admin-panel").forEach(panel => { panel.hidden = panel.id !== panelId; });
  if (panelId === "opportunitiesPanel") loadAdminOpportunities();
  if (panelId === "applicationsPanel") loadApplications();
}

document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => activatePanel(tab.dataset.panel));
});

document.addEventListener("mdl:admin-authenticated", () => activatePanel("opportunitiesPanel"));
restoreAdminSession();
