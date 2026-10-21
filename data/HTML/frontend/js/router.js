(() => {
  "use strict";
  const route = window.location.pathname.replace(/\/+$/, "") || "/";
  const root = route === "/";
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = root ? "/_static/css/style.css" : "/_static/css/page.css";
  document.head.appendChild(stylesheet);

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = src;
      script.onload = resolve;
      script.onerror = () => reject(new Error(`Не удалось загрузить ${src}`));
      document.body.appendChild(script);
    });
  }

  if (root) {
    loadScript("/_static/js/app.js").catch((error) => {
      document.getElementById("content").textContent = error.message;
    });
  } else {
    Promise.all([
      loadScript("/_static/vendor/markdown-it.min.js"),
      loadScript("/_static/js/vfsv2.js")
    ])
      .then(() => loadScript("/_static/js/page.js"))
      .catch((error) => { document.body.textContent = error.message; });
  }
})();
