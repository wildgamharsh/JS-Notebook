function downloadScriptJsFromEditor() {
  if (scriptEditorInstance) {
    const code = scriptEditorInstance.getValue();
    const blob = new Blob([code], { type: "text/javascript" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "script.js";
    a.click();
  }
}
// scriptEditor.js - Handles the left-side script.js editor UI and logic

let scriptEditorInstance = null;

function loadScriptJsForEditor() {
  // Always load from file, then apply localStorage if present
  fetch("js/script.js")
    .then((r) => r.text())
    .then((fileText) => {
      let code = localStorage.getItem("jsnotebook_script_js");
      if (code === null) code = fileText;
      scriptEditorInstance.setValue(code);
      // Evaluate in kernel
      try {
        window.eval(code);
      } catch (e) {}
    });
}

function saveScriptJsFromEditor() {
  if (scriptEditorInstance) {
    let code = scriptEditorInstance.getValue();
    localStorage.setItem("jsnotebook_script_js", code);
    // Hoist top-level declarations to window
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
    try {
      window.eval(code);
    } catch (e) {}
  }
}

function setupScriptJsEditor() {
  require.config({
    paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" },
  });
  require(["vs/editor/editor.main"], function () {
    scriptEditorInstance = monaco.editor.create(
      document.getElementById("scriptjs-editor"),
      {
        value: "",
        language: "javascript",
        theme:
          document.body.getAttribute("data-theme") === "dark"
            ? "vs-dark"
            : "vs",
        fontSize: 15,
        minimap: { enabled: false },
        automaticLayout: true,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        lineNumbers: "on",
        tabSize: 2,
      }
    );
    loadScriptJsForEditor();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  setupScriptJsEditor();
  document.getElementById("save-scriptjs-btn").onclick = saveScriptJsFromEditor;
  document.getElementById("download-scriptjs-btn").onclick =
    downloadScriptJsFromEditor;
});
