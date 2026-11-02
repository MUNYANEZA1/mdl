import { adminRequest, makeElement } from "/js/admin/api.js";

const typeField = document.getElementById("reportType");
const fromField = document.getElementById("reportFrom");
const toField = document.getElementById("reportTo");
const results = document.getElementById("reportResults");
const message = document.getElementById("reportMessage");
const exportButton = document.getElementById("exportReport");
let reportLoaded = false;

function reportParams() {
  const params = new URLSearchParams();
  if (fromField.value) params.set("from", fromField.value);
  if (toField.value) params.set("to", toField.value);
  return params;
}

function renderReport(report) {
  results.replaceChildren();
  if (!report.rows.length) {
    results.append(makeElement("p", "admin-empty", "No records match the selected date range."));
    return;
  }
  const columns = Object.keys(report.rows[0]);
  const table = document.createElement("table");
  table.className = "admin-table";
  const head = document.createElement("thead");
  const headerRow = document.createElement("tr");
  for (const column of columns) {
    const cell = document.createElement("th");
    cell.scope = "col";
    cell.textContent = column.replace(/_/g, " ");
    headerRow.append(cell);
  }
  head.append(headerRow);
  const body = document.createElement("tbody");
  for (const record of report.rows) {
    const row = document.createElement("tr");
    for (const column of columns) {
      const cell = document.createElement("td");
      cell.textContent = record[column] == null ? "" : String(record[column]);
      row.append(cell);
    }
    body.append(row);
  }
  table.append(head, body);
  results.append(table);
  if (report.truncated) {
    message.textContent = "The result is limited to 10,000 rows. Export the CSV for the same limit.";
  }
}

async function generateReport() {
  exportButton.disabled = true;
  reportLoaded = false;
  results.replaceChildren();
  message.textContent = "Generating report from database records…";
  try {
    const report = await adminRequest(`/api/admin/reports/${typeField.value}?${reportParams()}`);
    renderReport(report);
    reportLoaded = true;
    exportButton.disabled = false;
    if (!report.truncated) message.textContent = `${report.rows.length} report row(s).`;
  } catch (error) {
    message.textContent = error.message;
  }
}

export function loadReports() {
  return generateReport();
}

document.getElementById("generateReport").addEventListener("click", generateReport);
for (const field of [typeField, fromField, toField]) {
  field.addEventListener("change", () => {
    reportLoaded = false;
    exportButton.disabled = true;
  });
}

exportButton.addEventListener("click", async () => {
  if (!reportLoaded) return;
  exportButton.disabled = true;
  try {
    const response = await fetch(`/api/admin/reports/${typeField.value}.csv?${reportParams()}`, {
      credentials: "same-origin"
    });
    if (!response.ok) {
      let errorMessage = "Unable to export report.";
      try {
        const error = await response.json();
        errorMessage = error.message || errorMessage;
      } catch {
        errorMessage = "The server returned an invalid export response.";
      }
      throw new Error(errorMessage);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mdl-${typeField.value}-report.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    message.textContent = response.headers.get("X-Report-Truncated") === "true"
      ? "CSV exported with the first 10,000 rows. Narrow the date range for smaller reports."
      : "CSV report downloaded.";
  } catch (error) {
    message.textContent = error.message;
  } finally {
    exportButton.disabled = false;
  }
});
