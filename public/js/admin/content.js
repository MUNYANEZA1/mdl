import { adminRequest, makeElement } from "/js/admin/api.js";

const form = document.getElementById("announcementForm");
const list = document.getElementById("announcementList");

function localDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "";
  const pad = number => String(number).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function editAnnouncement(item) {
  form.elements.namedItem("id").value = item.id;
  form.elements.namedItem("title").value = item.title;
  form.elements.namedItem("body").value = item.body;
  form.elements.namedItem("startsAt").value = localDateTime(item.starts_at);
  form.elements.namedItem("endsAt").value = localDateTime(item.ends_at);
  form.elements.namedItem("published").checked = Boolean(item.published);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderAnnouncement(item) {
  const card = makeElement("article", "admin-item");
  card.append(makeElement("h3", "", item.title));
  card.append(makeElement("p", "", `${item.published ? "Published" : "Draft"}${item.starts_at ? ` · Starts ${localDateTime(item.starts_at)}` : ""}${item.ends_at ? ` · Ends ${localDateTime(item.ends_at)}` : ""}`));
  card.append(makeElement("p", "", item.body));
  const actions = makeElement("div", "admin-item-actions");
  const edit = makeElement("button", "btn btn-secondary", "Edit");
  edit.type = "button";
  edit.addEventListener("click", () => editAnnouncement(item));
  const visibility = makeElement("button", "btn btn-secondary", item.published ? "Unpublish" : "Publish");
  visibility.type = "button";
  visibility.addEventListener("click", async () => {
    visibility.disabled = true;
    try {
      await adminRequest(`/api/admin/announcements/${item.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: item.title,
          body: item.body,
          startsAt: localDateTime(item.starts_at) || null,
          endsAt: localDateTime(item.ends_at) || null,
          published: !Boolean(item.published)
        })
      });
      await loadAnnouncements();
    } catch (error) {
      form.querySelector(".form-message").textContent = error.message;
      form.querySelector(".form-message").className = "form-message error";
    } finally {
      visibility.disabled = false;
    }
  });
  actions.append(edit, visibility);
  card.append(actions);
  return card;
}

export async function loadAnnouncements() {
  list.replaceChildren(makeElement("p", "admin-feedback", "Loading announcements…"));
  try {
    const announcements = await adminRequest("/api/admin/announcements");
    list.replaceChildren();
    if (!announcements.length) list.append(makeElement("p", "admin-empty", "No announcements yet."));
    for (const item of announcements) list.append(renderAnnouncement(item));
  } catch (error) {
    list.replaceChildren(makeElement("p", "admin-error", error.message));
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const id = data.id;
  delete data.id;
  data.published = form.elements.namedItem("published").checked;
  try {
    const result = await adminRequest(id ? `/api/admin/announcements/${id}` : "/api/admin/announcements", {
      method: id ? "PATCH" : "POST",
      body: JSON.stringify(data)
    });
    const message = form.querySelector(".form-message");
    message.textContent = result.message;
    message.className = "form-message success";
    form.reset();
    form.elements.namedItem("id").value = "";
    await loadAnnouncements();
  } catch (error) {
    const message = form.querySelector(".form-message");
    message.textContent = error.message;
    message.className = "form-message error";
  }
});

document.getElementById("announcementFormReset").addEventListener("click", () => {
  form.reset();
  form.elements.namedItem("id").value = "";
  form.querySelector(".form-message").textContent = "";
});
