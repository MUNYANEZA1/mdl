async function loadComponent(selector, path) {
  const host = document.querySelector(selector);
  if (!host) return;
  const response = await fetch(path);
  if (!response.ok) return;
  host.innerHTML = await response.text();
}

await Promise.all([
  loadComponent("[data-site-header]", "/components/site-header.html"),
  loadComponent("[data-site-footer]", "/components/site-footer.html")
]);

document.querySelectorAll("[data-current-year]").forEach(element => {
  element.textContent = new Date().getFullYear();
});

const menuToggle = document.getElementById("menuToggle");
const mainNav = document.getElementById("mainNav");
menuToggle?.addEventListener("click", () => {
  const open = mainNav.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(open));
});
mainNav?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => {
  mainNav.classList.remove("open");
  menuToggle?.setAttribute("aria-expanded", "false");
}));