let csrfToken = "";

export async function adminRequest(url, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (!["GET", "HEAD", "OPTIONS"].includes(method) && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }
  const response = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error("The server returned an invalid response.");
  }
  if (!response.ok) {
    if (response.status === 401) {
      csrfToken = "";
      document.dispatchEvent(new Event("mdl:admin-session-expired"));
    }
    throw new Error(result.message || "Request failed.");
  }
  if (typeof result.csrfToken === "string") csrfToken = result.csrfToken;
  return result;
}

export function clearAdminCsrfToken() {
  csrfToken = "";
}

export function makeElement(tag, className = "", text = "") {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}
