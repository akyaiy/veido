(() => {
  "use strict";

  const route = window.location.pathname.replace(/\/+$/, "") || "/";

  function readBootstrap() {
    const element = document.getElementById("html-page-bootstrap");
    if (!element) throw new Error("Страница не содержит bootstrap-данные");
    const value = JSON.parse(element.textContent);
    if (value.route !== route || !value.site_name || !value.page_key || !value.bundle_root_uri) {
      throw new Error("Некорректные bootstrap-данные страницы");
    }
    return value;
  }

  const bootstrap = readBootstrap();

  document.body.innerHTML = `
    <header class="site-header">
      <a class="site-title" href="/" id="site-title"></a>
      <a class="site-admin" href="/demo">Управление</a>
    </header>
    <main class="site-content" id="page-content"></main>
    <footer class="site-footer">HTML Provider</footer>`;

  async function renderPage() {
    const root = String(bootstrap.bundle_root_uri).replace(/\/+$/, "");
    const [markdown, css, javascript] = await Promise.all([
      window.VFSv2.read(`${root}/content.md`),
      window.VFSv2.read(`${root}/style.css`),
      window.VFSv2.read(`${root}/script.js`)
    ]);

    document.title = bootstrap.page_title || bootstrap.site_name;
    document.getElementById("site-title").textContent = bootstrap.site_name;
    document.getElementById("page-content").innerHTML = window.markdownit({ html: true, linkify: true, typographer: true }).render(markdown);

    const style = document.createElement("style");
    style.dataset.pageBundle = bootstrap.page_key;
    style.textContent = css;
    document.head.appendChild(style);

    if (javascript.trim()) {
      const script = document.createElement("script");
      script.dataset.pageBundle = bootstrap.page_key;
      script.textContent = javascript;
      document.body.appendChild(script);
    }
  }

  renderPage().catch((error) => {
    console.error(error);
    const problem = document.createElement("div");
    problem.className = "page-error";
    problem.textContent = String(error.message || error);
    document.getElementById("page-content").replaceChildren(problem);
  });
})();
