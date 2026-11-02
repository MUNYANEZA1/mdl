import { adminRequest, makeElement } from "/js/admin/api.js";

const form = document.getElementById("courseForm");
const list = document.getElementById("courseList");
const message = form.querySelector(".form-message");

function showMessage(text, kind) {
  message.textContent = text;
  message.className = `form-message ${kind}`;
}

function populateForm(course) {
  for (const [key, value] of Object.entries({
    id: course.id,
    title: course.title,
    category: course.category,
    level: course.level,
    duration: course.duration,
    description: course.description,
    learningObjectives: course.learning_objectives || "",
    prerequisites: course.prerequisites || "",
    trainingFormat: course.training_format,
    feeRwf: course.fee_rwf,
    imageUrl: course.image_url || ""
  })) {
    form.elements[key].value = value;
  }
  form.elements.published.checked = Boolean(course.published);
  form.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderCourse(course) {
  const item = makeElement("article", "admin-item");
  item.append(makeElement("h3", "", course.title));
  item.append(makeElement("p", "", `${course.category} · ${course.level} · ${course.duration}`));
  item.append(makeElement("p", "", `${course.training_format} · RWF ${new Intl.NumberFormat().format(Number(course.fee_rwf) || 0)} · ${course.published ? "Published" : "Draft"}`));
  item.append(makeElement("p", "", course.description));
  const actions = makeElement("div", "admin-item-actions");
  const edit = makeElement("button", "btn btn-secondary", "Edit");
  edit.type = "button";
  edit.addEventListener("click", () => populateForm(course));
  const publish = makeElement("button", "btn btn-secondary", course.published ? "Unpublish" : "Publish");
  publish.type = "button";
  publish.addEventListener("click", async () => {
    publish.disabled = true;
    try {
      const body = {
        title: course.title,
        category: course.category,
        level: course.level,
        duration: course.duration,
        description: course.description,
        learningObjectives: course.learning_objectives,
        prerequisites: course.prerequisites,
        trainingFormat: course.training_format,
        feeRwf: Number(course.fee_rwf),
        imageUrl: course.image_url,
        published: !Boolean(course.published)
      };
      await adminRequest(`/api/admin/courses/${course.id}`, { method: "PATCH", body: JSON.stringify(body) });
      await loadCourses();
    } catch (error) {
      showMessage(error.message, "error");
    } finally {
      publish.disabled = false;
    }
  });
  actions.append(edit, publish);
  item.append(actions);
  return item;
}

export async function loadCourses() {
  list.replaceChildren(makeElement("p", "admin-feedback", "Loading courses…"));
  try {
    const courses = await adminRequest("/api/admin/courses");
    list.replaceChildren();
    if (!courses.length) list.append(makeElement("p", "admin-empty", "No database courses have been created yet."));
    for (const course of courses) list.append(renderCourse(course));
  } catch (error) {
    list.replaceChildren(makeElement("p", "admin-error", error.message));
  }
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(form).entries());
  const id = data.id;
  delete data.id;
  data.feeRwf = data.feeRwf || "0";
  data.published = form.elements.published.checked;
  const url = id ? `/api/admin/courses/${id}` : "/api/admin/courses";
  const method = id ? "PATCH" : "POST";
  try {
    const result = await adminRequest(url, { method, body: JSON.stringify(data) });
    showMessage(result.message, "success");
    form.reset();
    form.elements.id.value = "";
    form.elements.feeRwf.value = "0";
    await loadCourses();
  } catch (error) {
    showMessage(error.message, "error");
  }
});

document.getElementById("courseFormReset").addEventListener("click", () => {
  form.reset();
  form.elements.id.value = "";
  form.elements.feeRwf.value = "0";
  message.textContent = "";
});
