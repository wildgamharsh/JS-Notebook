// notebook.js - Main app logic
// Handles notebook state, cell management, kernel execution, and UI events

import("./cell.js");
import("./storage.js");
import("./theme.js");

const notebookEl = document.getElementById("notebook");
const addCellBtn = document.getElementById("add-cell");
const restartKernelBtn = document.getElementById("restart-kernel");
const saveBtn = document.getElementById("save-notebook");
const loadBtn = document.getElementById("load-notebook");
const kernelStatus = document.getElementById("kernel-status");

let cells = [];
const statusBar = document.getElementById("notebook-statusbar");
const fileNameEl = document.getElementById("notebook-filename");
const savedStatusEl = document.getElementById("notebook-saved");
let currentFileName = "Untitled.jsnb";
let isSaved = true;
let executionCounter = 1;

// Cell Types: 'code' or 'markdown'
function createCell(code = "", output = "", execCount = null, type = "code") {
  const cell = new window.NotebookCell({
    code,
    output,
    execCount,
    type,
    onRun: runCell,
    onDelete: (cell) => {
      deleteCell(cell);
      saveAllCellsToLocalStorage();
    },
    onDuplicate: (cell) => {
      duplicateCell(cell);
      saveAllCellsToLocalStorage();
    },
    onFocus: focusCell,
    onToggleType: (cell) => {
      toggleCellType(cell);
      saveAllCellsToLocalStorage();
    },
    onCollapseOutput: collapseOutput,
    onExpandOutput: expandOutput,
    onCodeChange: (cellInstance) => {
      // Update the code property from the editor
      if (cellInstance && cellInstance.editor) {
        cellInstance.code = cellInstance.editor.getValue();
      }
      setSaved(false);
      saveAllCellsToLocalStorage();
    },
  });
  // Add Hide Output button to toolbar
  setTimeout(() => {
    if (cell.el && cell.outputEl) {
      const toolbar = cell.el.querySelector(".cell-toolbar");
      if (toolbar && !toolbar.querySelector(".hide-output-btn")) {
        const hideBtn = document.createElement("button");
        hideBtn.className = "btn btn-warning btn-sm hide-output-btn";
        hideBtn.innerHTML = "Hide Output";
        hideBtn.onclick = (e) => {
          e.stopPropagation();
          cell.outputEl.classList.add("hidden");
        };
        toolbar.appendChild(hideBtn);
      }
    }
  }, 0);
  cells.push(cell);
  notebookEl.appendChild(cell.el);
  saveAllCellsToLocalStorage();
  return cell;
  // Add CSS for hidden output (only once, at top level)
  if (!document.getElementById("notebook-output-hidden-style")) {
    const style = document.createElement("style");
    style.id = "notebook-output-hidden-style";
    style.textContent = `.output-hidden { display: none !important; }`;
    document.head.appendChild(style);
  }
}
// Save all code cells to localStorage (code, type, order)
function saveAllCellsToLocalStorage() {
  const data = cells.map((cell) => ({
    code: cell.getCode(),
    output: cell.output,
    execCount: cell.execCount,
    type: cell.type || "code",
  }));
  localStorage.setItem("jsnotebook_code_cells", JSON.stringify(data));
}

// Load code cells from localStorage (if present)
function loadAllCellsFromLocalStorage() {
  setSaved(false); // Mark as unsaved until user clicks Save
  const data = localStorage.getItem("jsnotebook_code_cells");
  if (data) {
    try {
      const arr = JSON.parse(data);
      if (Array.isArray(arr) && arr.length) {
        // Remove all current cells
        while (cells.length) deleteCell(cells[0]);
        arr.forEach((cellData) =>
          createCell(
            cellData.code || "",
            cellData.output || "",
            cellData.execCount || null,
            cellData.type || "code"
          )
        );
      }
    } catch {}
    setFileName("Untitled.jsnb");
    setSaved(true);
  }
}

function createMarkdownCell(md = "", output = "", execCount = null) {
  return createCell(md, output, execCount, "markdown");
}

// (Removed duplicate createCell definition)

function runCell(cell) {
  if (cell.type === "markdown") {
    // Render markdown using marked.js (must be loaded in index.html)
    if (window.marked) {
      cell.setOutput(window.marked.parse(cell.getCode()));
    } else {
      cell.setOutput(cell.getCode());
    }
    cell.setExecCount(null);
    if (cell.outputEl) cell.outputEl.classList.remove("hidden");
    return;
  }
  // Evaluate code in shared window context, hoisting top-level declarations to window
  if (cell.outputEl) cell.outputEl.classList.remove("hidden");
  let result,
    error,
    logs = [];
  const origLog = window.console.log;
  window.console.log = (...args) => {
    logs.push(args.map(formatOutput).join(" "));
    origLog.apply(console, args);
  };
  try {
    let code = cell.getCode();
    // Hoist top-level const/let/function/class to window
    code = code.replace(
      /^(\s*)(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/gm,
      "$1window.$3 ="
    );
    code = code.replace(
      /^(\s*)function\s+([a-zA-Z0-9_$]+)\s*\(/gm,
      "$1window.$2 = function("
    );
    code = code.replace(
      /^(\s*)class\s+([a-zA-Z0-9_$]+)\s*/gm,
      "$1window.$2 = class "
    );
    let lastValue;
    if (/;\s*$/.test(code) || code.trim().includes("\n")) {
      result = window.eval(code);
      lastValue = result;
    } else {
      lastValue = window.eval(code);
    }
    if (logs.length === 0 && lastValue !== undefined) {
      logs.push(formatOutput(lastValue));
    } else if (lastValue !== undefined && code.trim().length > 0) {
      if (!logs.includes(formatOutput(lastValue))) {
        logs.push(formatOutput(lastValue));
      }
    }
    cell.setOutput(logs.join("\n"));
    cell.setExecCount(executionCounter++);
  } catch (e) {
    cell.setOutput(logs.concat([e.stack || e.toString()]).join("\n"));
    cell.setExecCount(executionCounter++);
  }
  window.console.log = origLog;

  // Helper to format output values
  function formatOutput(val) {
    if (val === null) return "null";
    if (val === undefined) return "undefined";
    if (typeof val === "string") return val;
    if (typeof val === "function") return val.toString();
    if (Array.isArray(val)) return JSON.stringify(val, null, 2);
    if (val instanceof Set)
      return `Set(${val.size}) { " + Array.from(val).map(formatOutput).join(", ") + " }`;
    if (val instanceof Map)
      return `Map(${val.size}) { " + Array.from(val.entries()).map(([k,v]) => formatOutput(k)+": "+formatOutput(v)).join(", ") + " }`;
    if (typeof val === "object") return JSON.stringify(val, null, 2);
    return String(val);
  }
}

function deleteCell(cell) {
  const idx = cells.indexOf(cell);
  if (idx !== -1) {
    notebookEl.removeChild(cell.el);
    cells.splice(idx, 1);
    saveAllCellsToLocalStorage();
  }
}

function duplicateCell(cell) {
  const idx = cells.indexOf(cell);
  if (idx !== -1) {
    const newCell = createCell(
      cell.getCode(),
      cell.output,
      cell.execCount,
      cell.type
    );
    notebookEl.insertBefore(newCell.el, cell.el.nextSibling);
    newCell.setFocused(true);
    newCell.el.classList.add("cell-duplicate-anim");
    setTimeout(() => newCell.el.classList.remove("cell-duplicate-anim"), 500);
    saveAllCellsToLocalStorage();
  }
}

function focusCell(cell) {
  // For keyboard navigation, highlight, etc.
  cells.forEach((c) => c.setFocused(c === cell));
}

function toggleCellType(cell) {
  if (cell.type === "code") {
    cell.setType("markdown");
    runCell(cell);
  } else {
    cell.setType("code");
    cell.setOutput("");
  }
}

function collapseOutput(cell) {
  cell.setOutputCollapsed(true);
}
function expandOutput(cell) {
  cell.setOutputCollapsed(false);
}

// Drag-and-drop reordering
let dragSrcIdx = null;
notebookEl.addEventListener("dragstart", (e) => {
  const idx = Array.from(notebookEl.children).indexOf(
    e.target.closest(".cell-card")
  );
  dragSrcIdx = idx;
  e.dataTransfer.effectAllowed = "move";
});
// End of notebook.js
notebookEl.addEventListener("dragover", (e) => {
  e.preventDefault();
});
notebookEl.addEventListener("drop", (e) => {
  e.preventDefault();
  const tgtIdx = Array.from(notebookEl.children).indexOf(
    e.target.closest(".cell-card")
  );
  if (dragSrcIdx !== null && tgtIdx !== -1 && dragSrcIdx !== tgtIdx) {
    const [cell] = cells.splice(dragSrcIdx, 1);
    cells.splice(tgtIdx, 0, cell);
    notebookEl.insertBefore(cell.el, notebookEl.children[tgtIdx]);
    saveAllCellsToLocalStorage();
  }
  dragSrcIdx = null;
});

function restartKernel() {
  // Remove all user-defined properties from window except built-ins
  for (let key in window) {
    if (
      window.hasOwnProperty(key) &&
      ![
        "window",
        "document",
        "console",
        "location",
        "navigator",
        "alert",
        "setTimeout",
        "setInterval",
        "clearTimeout",
        "clearInterval",
      ].includes(key)
    ) {
      try {
        delete window[key];
      } catch {}
    }
  }
  // Reload script.js
  const script = document.createElement("script");
  script.src = "js/script.js?t=" + Date.now();
  document.body.appendChild(script);
  script.onload = () => {
    kernelStatus.textContent = "Kernel: Ready";
    kernelStatus.className = "badge bg-success ms-2";
    cells.forEach((cell) => cell.clearOutput());
    executionCounter = 1;
  };
  kernelStatus.textContent = "Kernel: Restarting...";
  kernelStatus.className = "badge bg-warning ms-2";
}

// Export all code cells to output.js
function exportAllCode() {
  const code = cells
    .filter((c) => c.type === "code")
    .map((c) => c.getCode())
    .join("\n\n");
  const blob = new Blob([code], { type: "text/javascript" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "output.js";
  a.click();
}

addCellBtn.onclick = () => createCell();

// Add markdown cell button (optional, or use shortcut)
if (!document.getElementById("add-md-cell")) {
  const mdBtn = document.createElement("button");
  mdBtn.id = "add-md-cell";
  mdBtn.className = "btn btn-secondary ms-2";
  mdBtn.textContent = "+ Markdown Cell";
  mdBtn.onclick = () => createMarkdownCell("# Markdown");
  addCellBtn.parentNode.insertBefore(mdBtn, addCellBtn.nextSibling);
}
// Save as .jsnb file
saveBtn.onclick = () => {
  const data = cells.map((cell) => ({
    code: cell.getCode(),
    output: cell.output,
    execCount: cell.execCount,
    type: cell.type || "code",
  }));
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = currentFileName;
  a.click();
  setSaved(true);
};
// Load from .jsnb file
loadBtn.onclick = () => {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".jsnb,application/json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const arr = JSON.parse(evt.target.result);
        if (Array.isArray(arr) && arr.length) {
          while (cells.length) deleteCell(cells[0]);
          arr.forEach((cellData) =>
            createCell(
              cellData.code || "",
              cellData.output || "",
              cellData.execCount || null,
              cellData.type || "code"
            )
          );
          setFileName(file.name);
          setSaved(true);
          // Save loaded file to localStorage for autosave
          localStorage.setItem("jsnotebook_code_cells", JSON.stringify(arr));
        }
      } catch {}
    };
    reader.readAsText(file);
  };
  input.click();
};
// Status bar helpers
function setFileName(name) {
  currentFileName = name;
  if (fileNameEl) fileNameEl.textContent = name;
}
function setSaved(saved) {
  isSaved = saved;
  if (savedStatusEl) {
    savedStatusEl.textContent = saved ? "Saved" : "Unsaved";
    savedStatusEl.className = saved
      ? "ms-2 badge bg-success"
      : "ms-2 badge bg-warning";
  }
}

// Export all code button
if (!document.getElementById("export-all-code")) {
  const expBtn = document.createElement("button");
  expBtn.id = "export-all-code";
  expBtn.className = "btn btn-info ms-2";
  expBtn.textContent = "Export Code";
  expBtn.onclick = exportAllCode;
  setFileName("Untitled.jsnb");
  setSaved(true);
  addCellBtn.parentNode.appendChild(expBtn);
}

// Jupyter-style cell mode: 'edit' (Monaco focused) or 'command' (cell selected)
let cellMode = "edit"; // default to edit mode on load
function setCellMode(mode) {
  cellMode = mode;
  document.body.setAttribute("data-cell-mode", mode);
}
// On page load, restore notebook from localStorage if present
window.addEventListener("DOMContentLoaded", () => {
  loadAllCellsFromLocalStorage();
});
window.addEventListener("keydown", (e) => {
  // Helper: is event inside Monaco editor?
  function isInEditor(target) {
    return target.closest && target.closest(".cell-editor");
  }
  // Esc: switch to command mode if in editor
  if (e.key === "Escape") {
    const cell = window.NotebookCell.getFocused();
    if (cell) {
      setCellMode("command");
      cell.el.focus();
      e.preventDefault();
    }
    return;
  }
  // Enter: switch to edit mode if in command mode
  if (e.key === "Enter" && cellMode === "command") {
    const cell = window.NotebookCell.getFocused();
    if (cell && cell.editor) {
      setCellMode("edit");
      cell.editor.focus();
      e.preventDefault();
    }
    return;
  }
});
