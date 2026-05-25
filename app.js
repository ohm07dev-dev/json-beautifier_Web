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

function getPreviousNonWhitespace(text, position) {
  for (let index = position - 1; index >= 0; index -= 1) {
    if (!/\s/.test(text[index])) {
      return { char: text[index], index };
    }
  }

  return { char: "", index: -1 };
}

function getNextNonWhitespace(text, position) {
  for (let index = position + 1; index < text.length; index += 1) {
    if (!/\s/.test(text[index])) {
      return { char: text[index], index };
    }
  }

  return { char: "", index: -1 };
}

function addIssuePosition(positions, position) {
  if (position >= 0) {
    positions.add(position);
  }
}

function findLikelyJsonIssuePositions(text) {
  const positions = new Set();
  const stack = [];
  let inString = false;
  let escaped = false;
  let stringStart = -1;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        if (!["\"", "\\", "/", "b", "f", "n", "r", "t", "u"].includes(char)) {
          addIssuePosition(positions, index - 1);
        }

        if (char === "u") {
          const hexValue = text.slice(index + 1, index + 5);

          if (!/^[0-9a-fA-F]{4}$/.test(hexValue)) {
            addIssuePosition(positions, index);
          }
        }

        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === "\"") {
        inString = false;
        stringStart = -1;
        continue;
      }

      if (char === "\n" || char === "\r") {
        addIssuePosition(positions, stringStart);
        inString = false;
        stringStart = -1;
      }

      continue;
    }

    if (char === "\"") {
      inString = true;
      stringStart = index;
      continue;
    }

    if (/\s/.test(char) || char === ":" || char === "-" || /[0-9]/.test(char)) {
      continue;
    }

    if (char === "{") {
      stack.push({ char, index });
      continue;
    }

    if (char === "[") {
      stack.push({ char, index });
      continue;
    }

    if (char === "}" || char === "]") {
      const opener = stack.pop();
      const expectedOpener = char === "}" ? "{" : "[";

      if (!opener || opener.char !== expectedOpener) {
        addIssuePosition(positions, index);
      }

      continue;
    }

    if (char === ",") {
      const previous = getPreviousNonWhitespace(text, index);
      const next = getNextNonWhitespace(text, index);

      if (
        previous.char === "{" ||
        previous.char === "[" ||
        previous.char === "," ||
        next.char === "}" ||
        next.char === "]" ||
        next.char === ","
      ) {
        addIssuePosition(positions, index);
      }

      continue;
    }

    if (char === "'") {
      addIssuePosition(positions, index);
      let end = index + 1;

      while (end < text.length && text[end] !== "'" && text[end] !== "\n" && text[end] !== "\r") {
        end += 1;
      }

      if (text[end] === "'") {
        addIssuePosition(positions, end);
        index = end;
      }

      continue;
    }

    if (char === "/" && (text[index + 1] === "/" || text[index + 1] === "*")) {
      addIssuePosition(positions, index);

      if (text[index + 1] === "/") {
        while (index < text.length && text[index] !== "\n" && text[index] !== "\r") {
          index += 1;
        }
      } else {
        index += 2;

        while (index < text.length - 1 && !(text[index] === "*" && text[index + 1] === "/")) {
          index += 1;
        }
      }

      continue;
    }

    if (/[A-Za-z_$]/.test(char)) {
      let end = index + 1;

      while (end < text.length && /[A-Za-z0-9_$]/.test(text[end])) {
        end += 1;
      }

      const token = text.slice(index, end);
      const next = getNextNonWhitespace(text, end - 1);

      if (!["true", "false", "null"].includes(token)) {
        addIssuePosition(positions, index);
      } else if (next.char === ":") {
        addIssuePosition(positions, index);
      }

      index = end - 1;
      continue;
    }

    if (![".", "+", "e", "E"].includes(char)) {
      addIssuePosition(positions, index);
    }
  }

  if (inString) {
    addIssuePosition(positions, stringStart);
  }

  stack.forEach((opener) => addIssuePosition(positions, opener.index));

  return [...positions];
}

function normalizeErrorPositions(positions) {
  return [...new Set(positions)]
    .filter((position) => position !== null && !Number.isNaN(position))
    .map((position) => Math.max(0, Math.min(position, input.value.length)))
    .sort((first, second) => first - second);
}

function renderInputHighlight(errorPositions = []) {
  inputHighlight.textContent = "";

  if (!input.value) {
    inputHighlight.textContent = "";
    return;
  }

  const markerPositions = normalizeErrorPositions(Array.isArray(errorPositions) ? errorPositions : [errorPositions]);

  if (!markerPositions.length) {
    inputHighlight.textContent = input.value;
    return;
  }

  let currentPosition = 0;

  markerPositions.forEach((markerPosition) => {
    const tokenStart = markerPosition >= input.value.length ? Math.max(0, input.value.length - 1) : markerPosition;
    const tokenEnd = Math.min(input.value.length, tokenStart + 1);

    if (tokenStart < currentPosition) {
      return;
    }

    const marker = document.createElement("span");

    inputHighlight.append(document.createTextNode(input.value.slice(currentPosition, tokenStart)));
    marker.className = "json-error-token";
    marker.textContent = input.value.slice(tokenStart, tokenEnd) || " ";
    inputHighlight.append(marker);
    currentPosition = tokenEnd;
  });

  inputHighlight.append(document.createTextNode(input.value.slice(currentPosition)));
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
    const likelyIssuePositions = findLikelyJsonIssuePositions(input.value);
    const allErrorPositions = normalizeErrorPositions([errorPosition, ...likelyIssuePositions]);
    const errorLocation = errorPosition === null ? "" : getLineColumn(input.value, errorPosition);
    output.value = "";
    renderInputHighlight(allErrorPositions);
    setError(
      errorLocation
        ? `Invalid JSON at line ${errorLocation.line}, column ${errorLocation.column}: ${error.message}${allErrorPositions.length > 1 ? ` (${allErrorPositions.length} possible issues highlighted)` : ""}`
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
