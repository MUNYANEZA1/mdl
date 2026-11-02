import { sectors } from "/data/sectors.js";

const catalog = document.getElementById("sectorCatalog");
if (catalog) {
  catalog.replaceChildren(...sectors.map((sector, index) => {
    const article = document.createElement("article"); article.className = "sector-item";
    const number = document.createElement("span"); number.textContent = String(index + 1).padStart(2, "0");
    const title = document.createElement("h3"); title.textContent = sector.title;
    const description = document.createElement("p"); description.textContent = sector.description;
    article.append(number, title, description);
    return article;
  }));
}