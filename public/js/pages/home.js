const section = document.getElementById("announcementsSection");
const container = document.getElementById("publicAnnouncements");

if (section && container) {
  try {
    const response = await fetch("/api/announcements");
    const result = await response.json();
    if (!response.ok || !Array.isArray(result)) {
      throw new Error(result.message || "Announcements are temporarily unavailable.");
    }
    if (result.length) {
      for (const announcement of result) {
        const article = document.createElement("article");
        article.className = "home-announcement";
        const title = document.createElement("h3");
        title.textContent = announcement.title;
        const body = document.createElement("p");
        body.textContent = announcement.body;
        article.append(title, body);
        container.append(article);
      }
      section.hidden = false;
    }
  } catch (error) {
    section.hidden = false;
    const message = document.createElement("p");
    message.className = "form-message error";
    message.setAttribute("role", "status");
    message.textContent = error.message || "Announcements are temporarily unavailable.";
    container.append(message);
  }
}
