import { courses, registrationCourses } from "/data/courses.js";

const catalog = document.getElementById("courseCatalog");
if (catalog) {
  const existingTitles = new Set(courses.flatMap(group => group.items.map(item => item.toLowerCase())));
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
          if (select) {
            if (!Array.from(select.options).some(option => option.value === course)) {
              const option = document.createElement("option");
              option.value = course;
              option.textContent = course;
              select.append(option);
            }
            select.value = course;
          }
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

  fetch("/api/courses")
    .then(async response => {
      if (!response.ok) throw new Error("Published course information is temporarily unavailable.");
      const result = await response.json();
      if (!Array.isArray(result)) throw new Error("Published course information could not be loaded.");
      const groups = new Map();
      for (const course of result) {
        if (!course || typeof course.title !== "string" || typeof course.category !== "string") continue;
        if (existingTitles.has(course.title.toLowerCase())) continue;
        if (!groups.has(course.category)) groups.set(course.category, []);
        groups.get(course.category).push(course);
      }
      for (const [category, items] of groups) {
        const article = document.createElement("article");
        article.className = "course-category";
        const title = document.createElement("h3");
        title.textContent = category;
        const list = document.createElement("ul");
        for (const course of items) {
          const item = document.createElement("li");
          const choice = document.createElement("button");
          choice.type = "button";
          choice.className = "course-choice";
          choice.textContent = course.title;
          choice.addEventListener("click", () => {
            const select = document.getElementById("courseSelect");
            if (select) {
              if (!Array.from(select.options).some(option => option.value === course.title)) {
                const option = document.createElement("option");
                option.value = course.title;
                option.textContent = course.title;
                select.append(option);
              }
              select.value = course.title;
            }
            document.getElementById("register")?.scrollIntoView({ behavior: "smooth" });
            select?.focus({ preventScroll: true });
          });
          item.append(choice);
          if (course.description) {
            const description = document.createElement("p");
            description.textContent = course.description;
            item.append(description);
          }
          list.append(item);
        }
        article.append(title, list);
        catalog.append(article);
      }
    })
    .catch(error => {
      const message = document.createElement("p");
      message.className = "form-message error";
      message.setAttribute("role", "status");
      message.textContent = error.message;
      catalog.append(message);
    });
}
