(function () {
  function applyTheme() {
    try {
      var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
      if (prefersDark) {
        document.documentElement.setAttribute("data-theme", "dark");
      } else {
        document.documentElement.removeAttribute("data-theme");
      }
    } catch (err) {
      document.documentElement.removeAttribute("data-theme");
    }
  }

  applyTheme();

  try {
    var mediaQuery = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (!mediaQuery) return;

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyTheme);
    } else if (typeof mediaQuery.addListener === "function") {
      mediaQuery.addListener(applyTheme);
    }
  } catch (err) {
    // Automatic theme detection is optional; the site remains fully usable.
  }
})();
