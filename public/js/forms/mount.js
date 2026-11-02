export async function mountForm(selector, componentPath) {
  const target = document.querySelector(selector);
  if (!target) return null;
  const response = await fetch(componentPath);
  if (!response.ok) throw new Error(`Could not load form component: ${componentPath}`);
  target.innerHTML = await response.text();
  return target.querySelector("form");
}
