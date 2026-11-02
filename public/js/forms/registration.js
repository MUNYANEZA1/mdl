import { postJson } from "/js/api.js";
import { mountForm } from "/js/forms/mount.js";
import { registrationCourses } from "/data/courses.js";

const form = await mountForm('[data-form-component="/components/registration-form.html"]', "/components/registration-form.html");
const courseSelect = form?.querySelector("#courseSelect");
courseSelect && registrationCourses.forEach(course => {
  const option = document.createElement("option"); option.value = course; option.textContent = course; courseSelect.append(option);
});
form?.addEventListener("submit", async event => {
  event.preventDefault();
  const message = document.getElementById("formMessage");
  const button = document.getElementById("submitButton");
  const values = new FormData(form);
  const payload = Object.fromEntries(values.entries());
  payload.consent = values.get("consent") === "on";
  message.textContent = "";
  message.className = "form-message";
  button.disabled = true;
  const initialLabel = button.innerHTML;
  button.textContent = "Submitting...";
  try {
    const result = await postJson("/api/registrations", payload);
    message.textContent = `${result.message}${result.registrationId ? ` Reference: MDL-${result.registrationId}` : ""}`;
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