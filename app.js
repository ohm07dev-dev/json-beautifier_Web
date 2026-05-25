const root = document.documentElement;
const input = document.getElementById("jsonInput");
const inputHighlight = document.getElementById("inputHighlight");
const output = document.getElementById("jsonOutput");
const errorMessage = document.getElementById("errorMessage");
const statusText = document.getElementById("statusText");
const themeToggle = document.getElementById("themeToggle");

const formatBtn = document.getElementById("formatBtn");
const minifyBtn = document.getElementById("minifyBtn");
const copyBtn = document.getElementById("copyBtn");
const clearBtn = document.getElementById("clearBtn");

function setError(message) {
  errorMessage.textContent = message;
  statusText.textContent = message ? "Invalid JSON" : "Ready";
}

function setStatus(message) {
  statusText.textContent = message;
}

function getLineColumn(text, position) {
  const safePosition = Math.max(0, Math.min(position, text.length));
  const beforeError = text.slice(0, safePosition);
  const lines = beforeError.split("\n");

  return {
    line: lines.length,
    column: lines[lines.length - 1].length + 1
  };
}

function getErrorPosition(error, text) {
  const message = error.message || "";
  const positionMatch = message.match(/position\s+(\d+)/i);

  if (positionMatch) {
    return Number(positionMatch[1]);
  }

  const lineColumnMatch = message.match(/line\s+(\d+)\s+column\s+(\d+)/i);

  if (lineColumnMatch) {
    const targetLine = Number(lineColumnMatch[1]);
    const targetColumn = Number(lineColumnMatch[2]);
    const lines = text.split("\n");
    let position = 0;

    for (let index = 0; index < targetLine - 1; index += 1) {
      position += (lines[index] || "").length + 1;
    }

    return position + targetColumn - 1;
  }

  return null;
}

function renderInputHighlight(errorPosition = null) {
  inputHighlight.textContent = "";

  if (!input.value) {
    inputHighlight.textContent = "";
    return;
  }

  if (errorPosition === null || Number.isNaN(errorPosition)) {
    inputHighlight.textContent = input.value;
    return;
  }

  const markerPosition = Math.max(0, Math.min(errorPosition, input.value.length));
  const tokenStart = markerPosition >= input.value.length ? Math.max(0, input.value.length - 1) : markerPosition;
  const tokenEnd = Math.min(input.value.length, tokenStart + 1);
  const before = input.value.slice(0, tokenStart);
  const token = input.value.slice(tokenStart, tokenEnd) || " ";
  const after = input.value.slice(tokenEnd);
  const marker = document.createElement("span");

  inputHighlight.append(document.createTextNode(before));
  marker.className = "json-error-token";
  marker.textContent = token;
  inputHighlight.append(marker, document.createTextNode(after));
}

function syncHighlightScroll() {
  inputHighlight.scrollTop = input.scrollTop;
  inputHighlight.scrollLeft = input.scrollLeft;
}

function parseJson() {
  const rawValue = input.value;

  if (!rawValue.trim()) {
    throw new Error("Please enter JSON before running this action.");
  }

  return JSON.parse(rawValue);
}

function handleJsonAction(transformer, successMessage) {
  try {
    setError("");
    const parsedJson = parseJson();
    output.value = transformer(parsedJson);
    renderInputHighlight();
    setStatus(successMessage);
  } catch (error) {
    const errorPosition = getErrorPosition(error, input.value);
    const errorLocation = errorPosition === null ? "" : getLineColumn(input.value, errorPosition);
    output.value = "";
    renderInputHighlight(errorPosition);
    setError(
      errorLocation
        ? `Invalid JSON at line ${errorLocation.line}, column ${errorLocation.column}: ${error.message}`
        : `Invalid JSON: ${error.message}`
    );
  }
}

function updateThemeButton() {
  const isDark = root.classList.contains("dark");
  themeToggle.textContent = isDark ? "Light Mode" : "Dark Mode";
  themeToggle.setAttribute("aria-pressed", String(isDark));
}

formatBtn.addEventListener("click", () => {
  handleJsonAction((json) => JSON.stringify(json, null, 2), "Formatted");
});

minifyBtn.addEventListener("click", () => {
  handleJsonAction((json) => JSON.stringify(json), "Minified");
});

copyBtn.addEventListener("click", async () => {
  setError("");

  if (!output.value) {
    setError("Nothing to copy. Please format or minify JSON first.");
    return;
  }

  try {
    await navigator.clipboard.writeText(output.value);
    setStatus("Copied");
  } catch (error) {
    setError("Unable to copy to clipboard. Please copy the output manually.");
  }
});

clearBtn.addEventListener("click", () => {
  input.value = "";
  output.value = "";
  renderInputHighlight();
  setError("");
  setStatus("Cleared");
  input.focus();
});

themeToggle.addEventListener("click", () => {
  root.classList.toggle("dark");
  updateThemeButton();
});

input.addEventListener("input", () => {
  renderInputHighlight();

  if (errorMessage.textContent) {
    setError("");
  }
});

input.addEventListener("scroll", syncHighlightScroll);

renderInputHighlight();
updateThemeButton();
