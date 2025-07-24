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
  const savedCode = localStorage.getItem("jsnotebook_script_js");
  if (savedCode !== null) {
    scriptEditorInstance.setValue(savedCode);
    try {
      window.eval(savedCode);
    } catch (e) {
      console.error("Error evaluating saved script.js code:", e);
    }
  } else {
    // Fetch script.js from the server if not in localStorage
    fetch("js/script.js")
      .then((r) => r.text())
      .then((fileText) => {
        scriptEditorInstance.setValue(fileText);
        try {
          window.eval(fileText);
        } catch (e) {
          console.error("Error evaluating fetched script.js code:", e);
        }
      })
      .catch(() => {
        scriptEditorInstance.setValue(""); // Initialize empty editor if fetch fails
      });
  }
}

// Update saveScriptJsFromEditor to reload kernel with editor code
function saveScriptJsFromEditor() {
  if (scriptEditorInstance) {
    let code = scriptEditorInstance.getValue();

    // Validate code syntax before evaluation
    try {
      new Function(code); // Throws error if syntax is invalid
    } catch (syntaxError) {
      console.error("Syntax error in script.js code:", syntaxError);
      return;
    }

    // Hoist top-level declarations to window
    code = code.replace(
      /^\s*(const|let|var)\s+([a-zA-Z0-9_$]+)\s*=/gm,
      "window.$2 ="
    );
    code = code.replace(
      /^\s*function\s+([a-zA-Z0-9_$]+)\s*\(/gm,
      "window.$1 = function("
    );
    code = code.replace(
      /^\s*class\s+([a-zA-Z0-9_$]+)\s*/gm,
      "window.$1 = class "
    );

    // Evaluate code and add to kernel
    try {
      window.eval(code);
      console.log(
        "Code from script.js editor successfully added to the kernel."
      );
    } catch (e) {
      console.error("Error evaluating script.js code:", e);
    }
  }
}

function setupScriptJsEditor() {
  require.config({
    paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" },
  });
  require(["vs/editor/editor.main"], function () {
    const editorElement = document.getElementById("scriptjs-editor");
    if (!editorElement) {
      console.error("Editor element with ID 'scriptjs-editor' not found.");
      return;
    }
    scriptEditorInstance = monaco.editor.create(editorElement, {
      value: "",
      language: "javascript",
      theme:
        document.body.getAttribute("data-theme") === "dark" ? "vs-dark" : "vs",
      fontSize: 15,
      minimap: { enabled: false },
      automaticLayout: true,
      wordWrap: "on",
      scrollBeyondLastLine: false,
      lineNumbers: "on",
      tabSize: 2,
    });

    // Add auto-save listener after editor instance is created
    scriptEditorInstance.onDidChangeModelContent(() => {
      const code = scriptEditorInstance.getValue();
      localStorage.setItem("jsnotebook_script_js", code);
    });

    loadScriptJsForEditor();
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const editorElement = document.getElementById("scriptjs-editor");
  if (!editorElement) {
    console.error(
      "Editor element with ID 'scriptjs-editor' not found. Ensure the element exists in the DOM."
    );
    return;
  }
  console.log("Editor element found. Initializing Monaco Editor...");
  setupScriptJsEditor();
  document.getElementById("save-scriptjs-btn").onclick = saveScriptJsFromEditor;
  document.getElementById("download-scriptjs-btn").onclick =
    downloadScriptJsFromEditor;
});
