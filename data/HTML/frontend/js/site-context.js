(() => {
  "use strict";

  const context = fetch("/_static/site-context.json", { credentials: "include" })
    .then((response) => {
      if (!response.ok) throw new Error("Не удалось получить контекст сайта");
      return response.json();
    })
    .then(({ scope }) => {
      if (typeof scope !== "string" || !scope) throw new Error("Некорректный scope сайта");
      return Object.freeze({ scope, uri: `html@site[${scope}]:///` });
    });

  window.HTMLSiteContext = Object.freeze({ context });
})();
