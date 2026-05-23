const root = document.documentElement;
const input = document.getElementById("jsonInput");
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

function parseJson() {
  const rawValue = input.value.trim();

  if (!rawValue) {
    throw new Error("Please enter JSON before running this action.");
  }

  return JSON.parse(rawValue);
}

function handleJsonAction(transformer, successMessage) {
  try {
    setError("");
    const parsedJson = parseJson();
    output.value = transformer(parsedJson);
    setStatus(successMessage);
  } catch (error) {
    output.value = "";
    setError(`Invalid JSON: ${error.message}`);
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
  setError("");
  setStatus("Cleared");
  input.focus();
});

themeToggle.addEventListener("click", () => {
  root.classList.toggle("dark");
  updateThemeButton();
});

input.addEventListener("input", () => {
  if (errorMessage.textContent) {
    setError("");
  }
});

updateThemeButton();
