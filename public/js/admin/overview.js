import { adminRequest, makeElement } from "/js/admin/api.js";

const overviewStats = document.getElementById("overviewStats");
const chartTargets = {
  registrationTrend: "registrationChart",
  internshipTrend: "internshipChart",
  applicationsByDepartment: "departmentChart",
  registrationsByCourse: "courseChart",
  servicesByCategory: "serviceChart",
  applicationStatuses: "applicationStatusChart"
};
const statDefinitions = [
  ["totalRegistrations", "Registered students"],
  ["newRegistrations", "New registrations today"],
  ["totalInternshipApplications", "Internship applications"],
  ["pendingInternshipApplications", "Pending applications"],
  ["acceptedInternshipApplications", "Accepted applications"],
  ["publishedOpportunities", "Open opportunities"],
  ["totalServiceRequests", "Service requests"],
  ["pendingServiceRequests", "Pending service requests"],
  ["corporateTrainingRequests", "Corporate training requests"],
  ["totalCourses", "Total courses"],
  ["activeCourses", "Published courses"],
  ["totalClients", "Clients"]
];

function renderChart(targetId, rows) {
  const target = document.getElementById(targetId);
  target.replaceChildren();
  if (!rows.length) {
    target.append(makeElement("p", "admin-empty", "No records for this chart yet."));
    return;
  }
  const maximum = Math.max(1, ...rows.map(row => Number(row.count) || 0));
  for (const row of rows) {
    const line = makeElement("div", "admin-chart-row");
    const label = makeElement("span", "admin-chart-label", String(row.label || row.period || ""));
    const track = makeElement("span", "admin-chart-track");
    const bar = makeElement("span", "admin-chart-bar");
    bar.style.width = `${Math.max(0, Math.min(100, (Number(row.count) / maximum) * 100))}%`;
    track.append(bar);
    const value = makeElement("strong", "admin-chart-value", String(row.count));
    line.append(label, track, value);
    target.append(line);
  }
}

function renderRecent(recent) {
  const target = document.getElementById("recentActivity");
  target.replaceChildren();
  const all = Object.values(recent).flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  if (!all.length) {
    target.append(makeElement("p", "admin-empty", "No recent activity."));
    return;
  }
  for (const row of all.slice(0, 12)) {
    const item = makeElement("article", "admin-item admin-activity");
    const title = makeElement("h3", "", row.name);
    const detail = makeElement("p", "", `${row.detail} · ${row.status}`);
    const date = makeElement("time", "", new Date(row.created_at).toLocaleString());
    item.append(title, detail, date);
    target.append(item);
  }
}

export async function loadOverview() {
  overviewStats.replaceChildren(makeElement("p", "admin-feedback", "Loading live dashboard statistics…"));
  try {
    const result = await adminRequest("/api/admin/overview");
    overviewStats.replaceChildren();
    for (const [key, label] of statDefinitions) {
      const card = makeElement("article", "admin-stat");
      card.append(makeElement("span", "", label));
      card.append(makeElement("strong", "", new Intl.NumberFormat().format(Number(result.summary[key]) || 0)));
      overviewStats.append(card);
    }
    for (const [key, targetId] of Object.entries(chartTargets)) {
      renderChart(targetId, result.charts[key] || []);
    }
    renderRecent(result.recent);
  } catch (error) {
    overviewStats.replaceChildren(makeElement("p", "admin-feedback admin-error", error.message));
  }
}
