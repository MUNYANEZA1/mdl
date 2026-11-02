function renderOpportunity(opportunity) {
  const article = document.createElement("article"); article.className = "opportunity-card";
  const badge = document.createElement("span"); badge.className = `opportunity-status status-${String(opportunity.status).toLowerCase().replaceAll(" ", "-")}`; badge.textContent = opportunity.status;
  const title = document.createElement("h3"); title.textContent = opportunity.title;
  const department = document.createElement("p"); department.className = "opportunity-department"; department.textContent = opportunity.department;
  const description = document.createElement("p"); description.textContent = opportunity.description;
  article.append(badge, title, department, description);
  if (opportunity.expected_duration) { const duration = document.createElement("small"); duration.textContent = `Expected duration: ${opportunity.expected_duration}`; article.append(duration); }
  if (opportunity.application_deadline) { const deadline = document.createElement("small"); deadline.textContent = `Deadline: ${opportunity.application_deadline}`; article.append(deadline); }
  return article;
}

async function loadOpportunities() {
  const list = document.getElementById("opportunityList");
  const status = document.getElementById("opportunityStatus");
  if (!list || !status) return;
  try {
    const response = await fetch("/api/internship-opportunities");
    if (!response.ok) throw new Error("Unavailable");
    const opportunities = await response.json();
    list.replaceChildren(...opportunities.map(renderOpportunity));
    status.textContent = opportunities.length
      ? "Published opportunities from MDL. Check each status before applying."
      : "There are no published internship opportunities at this time. Applications of interest do not guarantee placement.";
  } catch {
    status.textContent = "Current opportunities could not be loaded. Please try again later.";
  }
}

loadOpportunities();