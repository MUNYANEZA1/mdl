import { services } from "/data/services.js";

const catalog = document.getElementById("serviceCatalog");
if (catalog) {
  catalog.replaceChildren(...services.map((service, index) => {
    const article = document.createElement("article");
    article.className = "service-detail";
    const number = document.createElement("span"); number.className = "service-number"; number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("h2"); title.textContent = service.title;
    const description = document.createElement("p"); description.textContent = service.description;
    const details = document.createElement("dl");
    [["Problems addressed", service.problems], ["Who it serves", service.audience], ["Potential deliverables", service.deliverables]].forEach(([term, value]) => {
      const dt = document.createElement("dt"); dt.textContent = term;
      const dd = document.createElement("dd"); dd.textContent = value;
      details.append(dt, dd);
    });
    const link = document.createElement("a"); link.className = "text-link"; link.href = "#request"; link.textContent = "Request this service →";
    article.append(number, title, description, details, link);
    return article;
  }));
}