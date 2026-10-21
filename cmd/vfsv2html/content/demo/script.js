(() => {
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = "/_static/css/admin.css";
  document.head.appendChild(stylesheet);

  const script = document.createElement("script");
  script.src = "/_static/js/admin.js";
  script.onerror = () => {
    document.getElementById("page-content").textContent = "Не удалось загрузить панель управления";
  };
  document.body.appendChild(script);
})();
