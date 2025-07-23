// theme.js - Dark/Light mode toggle and Monaco theme sync
const themeToggle = document.getElementById("theme-toggle");
function setTheme(dark) {
  document.body.setAttribute("data-theme", dark ? "dark" : "light");
  if (window.monaco) {
    monaco.editor.setTheme(dark ? "vs-dark" : "vs");
  }
}
themeToggle.onclick = () => {
  const dark = document.body.getAttribute("data-theme") !== "dark";
  setTheme(dark);
};
// On load, set theme from system or default
setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches);
