// cell.js - Cell logic and Monaco integration
// Defines NotebookCell class and cell UI/behavior

window.NotebookCell = class {
  static focusedCell = null;
  static getFocused() {
    return NotebookCell.focusedCell;
  }

  constructor({
    code = "",
    output = "",
    execCount = null,
    onRun,
    onDelete,
    onDuplicate,
    onFocus,
    onCodeChange,
  }) {
    this.code = code;
    this.output = output;
    this.execCount = execCount;
    this.onRun = onRun;
    this.onDelete = onDelete;
    this.onDuplicate = onDuplicate;
    this.onFocus = onFocus;
    this.onCodeChange = onCodeChange;
    this.el = this.render();
    this.setFocused(false);
  }

  render() {
    const card = document.createElement("div");
    card.className = "card cell-card";
    card.tabIndex = 0;
    card.onclick = () => {
      this.setFocused(true);
      if (this.onFocus) this.onFocus(this);
    };
    // Toolbar
    const toolbar = document.createElement("div");
    toolbar.className = "cell-toolbar";
    // Execution count
    this.execCountEl = document.createElement("span");
    this.execCountEl.className = "execution-count";
    toolbar.appendChild(this.execCountEl);
    // Run button
    const runBtn = document.createElement("button");
    runBtn.className = "btn btn-success btn-sm";
    runBtn.innerHTML = "Run ▶";
    runBtn.onclick = (e) => {
      e.stopPropagation();
      if (this.onRun) this.onRun(this);
    };
    toolbar.appendChild(runBtn);
    // Duplicate button
    const dupBtn = document.createElement("button");
    dupBtn.className = "btn btn-info btn-sm";
    dupBtn.innerHTML = "Duplicate";
    dupBtn.onclick = (e) => {
      e.stopPropagation();
      if (this.onDuplicate) this.onDuplicate(this);
    };
    toolbar.appendChild(dupBtn);
    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "btn btn-danger btn-sm";
    delBtn.innerHTML = "Delete";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (this.onDelete) this.onDelete(this);
    };
    toolbar.appendChild(delBtn);
    card.appendChild(toolbar);
    // Monaco Editor
    this.editorEl = document.createElement("div");
    this.editorEl.className = "cell-editor";
    card.appendChild(this.editorEl);
    // Output
    this.outputEl = document.createElement("div");
    this.outputEl.className = "cell-output";
    this.outputEl.textContent = this.output;
    card.appendChild(this.outputEl);
    // Monaco integration
    require.config({
      paths: { vs: "https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs" },
    });
    require(["vs/editor/editor.main"], () => {
      this.editor = monaco.editor.create(this.editorEl, {
        value: this.code,
        language: "javascript",
        theme:
          document.body.getAttribute("data-theme") === "dark"
            ? "vs-dark"
            : "vs",
        fontFamily: "Fira Mono, Consolas, monospace",
        fontSize: 15,
        minimap: { enabled: false },
        automaticLayout: true,
        wordWrap: "on",
        scrollBeyondLastLine: false,
        lineNumbers: "off",
        tabSize: 2,
      });
      this.editor.onDidFocusEditorWidget(() => {
        this.setFocused(true);
        if (this.onFocus) this.onFocus(this);
      });
      // Save code on every change
      this.editor.onDidChangeModelContent(() => {
        if (this.onCodeChange) this.onCodeChange(this);
      });
      this.editor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.Enter, () => {
        if (this.onRun) this.onRun(this);
      });
      this.editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_D,
        () => {
          if (this.onDuplicate) this.onDuplicate(this);
        }
      );
      this.editor.addCommand(
        monaco.KeyMod.CtrlCmd | monaco.KeyCode.KEY_S,
        () => {
          if (this.onCodeChange) this.onCodeChange(this);
        }
      );
      // Snippets and global variable/property completion
      monaco.languages.registerCompletionItemProvider("javascript", {
        triggerCharacters: [
          ".",
          ..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_",
        ],
        provideCompletionItems: (model, position) => {
          const suggestions = [
            {
              label: "clg",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "console.log($1);",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "console.log()",
            },
            {
              label: "fore",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: ".forEach(element => {\n  $1\n});",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: ".forEach snippet",
            },
            {
              label: "forl",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "for (let i = 0; i < $1; i++) {\n  \n}",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "for loop",
            },
            {
              label: "func",
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: "function name(params) {\n  $1\n}",
              insertTextRules:
                monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: "function snippet",
            },
          ];
          // Get the text before the cursor
          const word = model.getWordUntilPosition(position);
          const textUntilPosition = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });
          // Check for property access (e.g., restaurant.)
          const match = textUntilPosition.match(/([a-zA-Z0-9_$.]+)\.$/);
          if (match) {
            // Try to resolve the object in window
            try {
              const objPath = match[1].split(".");
              let obj = window;
              for (const part of objPath) {
                obj = obj[part];
                if (!obj) break;
              }
              if (obj && typeof obj === "object") {
                Object.getOwnPropertyNames(obj).forEach((prop) => {
                  suggestions.push({
                    label: prop,
                    kind: monaco.languages.CompletionItemKind.Property,
                    insertText: prop,
                    documentation: typeof obj[prop],
                  });
                });
              }
            } catch {}
          } else {
            // Top-level: add global variables, functions, and properties from window
            const globalKeys = Object.getOwnPropertyNames(window).filter(
              (k) => !k.startsWith("_")
            );
            globalKeys.forEach((key) => {
              suggestions.push({
                label: key,
                kind: monaco.languages.CompletionItemKind.Variable,
                insertText: key,
                documentation:
                  typeof window[key] +
                  (typeof window[key] === "function" ? "()" : ""),
              });
            });
          }
          return { suggestions };
        },
      });
    });
    return card;
  }

  getCode() {
    return this.editor ? this.editor.getValue() : this.code;
  }
  setOutput(output) {
    this.output = output;
    this.outputEl.textContent = output;
    // Do not set style.display here; let CSS class handle hiding
  }
  clearOutput() {
    this.setOutput("");
    this.setExecCount(null);
  }
  setExecCount(n) {
    this.execCount = n;
    this.execCountEl.textContent = n ? `[${n}]` : "";
  }
  setFocused(focused) {
    if (focused) {
      if (NotebookCell.focusedCell && NotebookCell.focusedCell !== this)
        NotebookCell.focusedCell.setFocused(false);
      this.el.classList.add("border-primary", "shadow-lg");
      NotebookCell.focusedCell = this;
    } else {
      this.el.classList.remove("border-primary", "shadow-lg");
      if (NotebookCell.focusedCell === this) NotebookCell.focusedCell = null;
    }
  }
};
