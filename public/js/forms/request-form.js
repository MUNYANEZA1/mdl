import { postJson } from "/js/api.js";
import { mountForm } from "/js/forms/mount.js";

const components = [
  ["/components/service-request-form.html", "/api/service-requests"],
  ["/components/corporate-training-form.html", "/api/corporate-training-requests"],
  ["/components/internship-form.html", "/api/internship-applications"]
];

for (const [componentPath, endpoint] of components) {
  const form = await mountForm(`[data-form-component="${componentPath}"]`, componentPath);
  if (!form) continue;
  form.dataset.api = endpoint;
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const message = form.querySelector(".form-message");
    const button = form.querySelector('button[type="submit"]');
    const values = new FormData(form);
    const payload = Object.fromEntries(values.entries());
    payload.consent = values.get("consent") === "on";
    payload.guardianConsent = values.get("guardianConsent") === "on";
    if (payload.participantCount) payload.participantCount = Number(payload.participantCount);
    message.textContent = "";
    message.className = "form-message";
    button.disabled = true;
    const initialLabel = button.innerHTML;
    button.textContent = "Submitting...";
    try {
      const result = await postJson(form.dataset.api, payload);
      message.textContent = `${result.message}${result.reference ? ` Reference: ${result.reference}` : ""}`;
      message.classList.add("success");
      form.reset();
    } catch (error) {
      message.textContent = error.message;
      message.classList.add("error");
    } finally {
      button.disabled = false;
      button.innerHTML = initialLabel;
    }
  });
}