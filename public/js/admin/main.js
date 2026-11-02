import { restoreAdminSession } from "/js/admin/auth.js";
import { loadAdminOpportunities } from "/js/admin/opportunities.js";
import { loadApplications } from "/js/admin/applications.js";
import { loadOverview } from "/js/admin/overview.js";
import { loadRegistrations } from "/js/admin/registrations.js";
import { loadCourses } from "/js/admin/courses.js";
import { loadServiceRequests, loadTrainingRequests } from "/js/admin/requests.js";
import { loadStaff } from "/js/admin/staff.js";
import { loadClients } from "/js/admin/clients.js";
import { loadAnnouncements } from "/js/admin/content.js";
import { loadReports } from "/js/admin/reports.js";

const panelTitles = {
  overviewPanel: "Overview",
  registrationsPanel: "Students & registrations",
  coursesPanel: "Courses & academy",
  opportunitiesPanel: "Internship opportunities",
  applicationsPanel: "Internship applications",
  servicesPanel: "Service requests",
  trainingPanel: "Corporate training",
  clientsPanel: "Clients & organizations",
  reportsPanel: "Reports & analytics",
  contentPanel: "Website content",
  staffPanel: "Staff & administrators",
  settingsPanel: "Settings"
};
const panelLoaders = {
  overviewPanel: loadOverview,
  registrationsPanel: loadRegistrations,
  coursesPanel: loadCourses,
  opportunitiesPanel: loadAdminOpportunities,
  applicationsPanel: loadApplications,
  servicesPanel: loadServiceRequests,
  trainingPanel: loadTrainingRequests,
  clientsPanel: loadClients,
  reportsPanel: loadReports,
  contentPanel: loadAnnouncements,
  staffPanel: loadStaff
};

function activatePanel(panelId) {
  if (!panelTitles[panelId]) return;
  document.querySelectorAll(".admin-tab").forEach(tab => {
    tab.classList.toggle("active", tab.dataset.panel === panelId);
    tab.setAttribute("aria-current", tab.dataset.panel === panelId ? "page" : "false");
  });
  document.querySelectorAll(".admin-panel").forEach(panel => {
    panel.hidden = panel.id !== panelId;
  });
  document.getElementById("workspaceTitle").textContent = panelTitles[panelId];
  if (panelLoaders[panelId]) panelLoaders[panelId]();
}

document.querySelectorAll(".admin-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    activatePanel(tab.dataset.panel);
    if (window.matchMedia("(max-width: 760px)").matches) {
      document.querySelector(".admin-sidebar").classList.add("is-collapsed");
      document.getElementById("sidebarToggle").setAttribute("aria-expanded", "false");
      document.getElementById("sidebarToggle").textContent = "Show navigation";
    }
  });
});

const sidebar = document.querySelector(".admin-sidebar");
const sidebarToggle = document.getElementById("sidebarToggle");
function updateSidebarForViewport() {
  const isMobile = window.matchMedia("(max-width: 760px)").matches;
  sidebar.classList.toggle("is-collapsed", isMobile);
  sidebarToggle.setAttribute("aria-expanded", String(!isMobile));
  sidebarToggle.textContent = isMobile ? "Show navigation" : "Hide navigation";
}
sidebarToggle.addEventListener("click", () => {
  const collapsed = sidebar.classList.toggle("is-collapsed");
  sidebarToggle.setAttribute("aria-expanded", String(!collapsed));
  sidebarToggle.textContent = collapsed ? "Show navigation" : "Hide navigation";
});
window.matchMedia("(max-width: 760px)").addEventListener("change", updateSidebarForViewport);
updateSidebarForViewport();

function defaultPanel() {
  return document.body.dataset.adminRole === "Staff" ? "registrationsPanel" : "overviewPanel";
}

document.addEventListener("mdl:admin-authenticated", () => activatePanel(defaultPanel()));
restoreAdminSession().then(authenticated => {
  if (authenticated) activatePanel(defaultPanel());
});
