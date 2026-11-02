import { courses, registrationCourses } from "/data/courses.js";

const catalog = document.getElementById("courseCatalog");
if (catalog) {
  catalog.replaceChildren(...courses.map(group => {
    const article = document.createElement("article"); article.className = "course-category";
    const title = document.createElement("h3"); title.textContent = group.category;
    const list = document.createElement("ul");
    group.items.forEach(course => {
      const item = document.createElement("li");
      if (registrationCourses.includes(course)) {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = "course-choice";
        choice.textContent = course;
        choice.addEventListener("click", () => {
          const select = document.getElementById("courseSelect");
          if (select) select.value = course;
          document.getElementById("register")?.scrollIntoView({ behavior: "smooth" });
          select?.focus({ preventScroll: true });
        });
        item.append(choice);
      } else item.textContent = course;
      list.append(item);
    });
    article.append(title, list);
    return article;
  }));
}
