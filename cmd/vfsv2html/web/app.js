"use strict";

const API = "/api/v2/vfs";
const SCOPES_URI = "scopes@scopes[system]:///scopes";
const HTML_ROOT = "html@site[html-demo]:///";
const PAGES_URI = `${HTML_ROOT}pages`;
const PUBLISHERS_URI = `${HTML_ROOT}publishers`;
const CONTENT_ROOT = "demo-content@content[html-demo]:///content";

const state = {
  scope: "html-demo",
  browserURI: "demo-content@content[html-demo]:///content",
  selectedPage: null,
  selectedResource: null,
  tree: null,
};

const $ = (id) => document.getElementById(id);

async function api(path, uri, options = {}) {
  const query = new URLSearchParams({ uri });
  if (options.command) query.set("command", options.command);
  const hasBody = options.body !== undefined || options.rawBody !== undefined;
  const body = options.rawBody !== undefined ? options.rawBody : (options.body === undefined ? undefined : JSON.stringify(options.body));
  const response = await fetch(`${API}/${path}?${query}`, {
    method: options.method || "GET",
    headers: hasBody ? { "Content-Type": options.rawBody !== undefined ? (options.contentType || "application/octet-stream") : "application/json" } : undefined,
    body,
  });
  if (!response.ok) {
    let problem;
    try { problem = await response.json(); } catch { problem = null; }
    const detail = problem?.error?.details?.current_revision;
    const suffix = detail === undefined ? "" : ` (актуальная revision: ${detail})`;
    throw new Error(`${problem?.error?.code || response.status}: ${problem?.error?.message || response.statusText}${suffix}`);
  }
  if (response.status === 204) return null;
  const text = await response.text();
  if (options.raw) return text;
  return text ? JSON.parse(text) : null;
}

function notify(message, error = false) {
  const node = $("notice");
  node.textContent = message;
  node.classList.toggle("is-error", error);
  node.classList.add("is-visible");
  window.clearTimeout(notify.timer);
  notify.timer = window.setTimeout(() => node.classList.remove("is-visible"), 3600);
}

function itemButton(label, detail, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  const strong = document.createElement("strong");
  strong.textContent = label;
  button.append(strong);
  if (detail) {
    const small = document.createElement("small");
    small.textContent = detail;
    button.append(small);
  }
  button.addEventListener("click", onClick);
  return button;
}

async function loadScopes() {
  const result = await api("list", SCOPES_URI);
  const list = $("scope-list");
  list.replaceChildren();
  for (const scope of result.items) {
    const li = document.createElement("li");
    const button = itemButton(scope.name, "", () => selectScope(scope.name));
    button.classList.toggle("is-active", scope.name === state.scope);
    li.append(button);
    list.append(li);
  }
  await selectScope(state.scope);
}

async function selectScope(scope) {
  state.scope = scope;
  for (const button of $("scope-list").querySelectorAll("button")) {
    button.classList.toggle("is-active", button.textContent === scope);
  }
  const uri = `scopes@scopes[system]:///scopes/${encodeURIComponent(scope)}/connections`;
  const result = await api("list", uri);
  const list = $("connection-list");
  list.replaceChildren();
  for (const connection of result.items) {
    const li = document.createElement("li");
    li.append(itemButton(connection.name, "", () => openConnection(connection.name)));
    list.append(li);
  }
}

function openConnection(name) {
  const separator = name.indexOf("@");
  if (separator < 1) return;
  state.browserURI = `${name}[${state.scope}]:///`;
  browse(state.browserURI);
}

function splitURI(uri) {
  const marker = "://";
  const index = uri.indexOf(marker);
  if (index < 0) throw new Error("Некорректный VFS URI");
  const base = uri.slice(0, index + marker.length);
  const resourcePath = uri.slice(index + marker.length) || "/";
  return { base, path: resourcePath.startsWith("/") ? resourcePath : `/${resourcePath}` };
}

function childURI(uri, name) {
  const parsed = splitURI(uri);
  const parent = parsed.path === "/" ? "" : parsed.path.replace(/\/$/, "");
  return `${parsed.base}${parent}/${name}`;
}

function parentURI(uri) {
  const parsed = splitURI(uri);
  const parts = parsed.path.split("/").filter(Boolean);
  parts.pop();
  return `${parsed.base}/${parts.join("/")}`;
}

async function browse(uri) {
  state.browserURI = uri;
  $("uri-input").value = uri;
  clearPreview();
  try {
    const result = await api("list", uri);
    $("browser-count").textContent = `${result.items.length} объектов`;
    const list = $("file-list");
    list.replaceChildren();
    for (const item of result.items) {
      const li = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      const name = document.createElement("span");
      const icon = document.createElement("span");
      icon.className = "file-icon";
      icon.textContent = item.is_dir ? "▸" : "·";
      name.append(icon, document.createTextNode(item.name));
      const meta = document.createElement("small");
      meta.textContent = item.is_dir ? item.kind : formatBytes(item.size);
      button.append(name, meta);
      const target = childURI(uri, item.name);
      button.addEventListener("click", () => item.is_dir ? browse(target) : previewFile(target, item));
      const controls = document.createElement("div");
      controls.className = "resource-actions";
      const move = document.createElement("button");
      move.type = "button";
      move.textContent = "↔";
      move.title = "Переместить или переименовать";
      move.addEventListener("click", () => moveResource(target));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "×";
      remove.title = "Удалить";
      remove.className = "is-danger";
      remove.addEventListener("click", () => deleteResource(target));
      controls.append(move, remove);
      li.append(button, controls);
      list.append(li);
    }
  } catch (error) {
    notify(error.message, true);
  }
}

async function previewFile(uri, item) {
  try {
    const content = await api("read", uri, { raw: true });
    state.selectedResource = uri;
    $("preview-meta").textContent = `${item.name} · ${formatBytes(item.size)} · ${uri}`;
    $("file-preview").value = content;
    $("file-preview").disabled = false;
    $("save-file").disabled = false;
    $("move-resource").disabled = false;
    $("delete-resource").disabled = false;
  } catch (error) {
    notify(error.message, true);
  }
}

function clearPreview() {
  state.selectedResource = null;
  $("file-preview").value = "";
  $("file-preview").disabled = true;
  $("preview-meta").textContent = "Выберите файл.";
  for (const id of ["save-file", "move-resource", "delete-resource"]) $(id).disabled = true;
}

async function createDirectory() {
  const name = window.prompt("Имя нового каталога:");
  if (!name) return;
  try {
    await api("directory", childURI(state.browserURI, name.trim()), { method: "POST" });
    notify(`Каталог ${name.trim()} создан`);
    await browse(state.browserURI);
  } catch (error) { notify(error.message, true); }
}

async function createFile() {
  const name = window.prompt("Имя нового файла:");
  if (!name) return;
  const target = childURI(state.browserURI, name.trim());
  try {
    await api("file", target, { method: "POST", rawBody: "" });
    notify(`Файл ${name.trim()} создан`);
    await browse(state.browserURI);
    await previewFile(target, { name: name.trim(), size: 0 });
  } catch (error) { notify(error.message, true); }
}

async function saveFile() {
  if (!state.selectedResource) return;
  try {
    await api("file", state.selectedResource, { method: "PUT", rawBody: $("file-preview").value, contentType: "text/plain; charset=utf-8" });
    notify("Файл сохранён");
    const selected = state.selectedResource;
    await browse(parentURI(selected));
  } catch (error) { notify(error.message, true); }
}

async function moveResource(uri = state.selectedResource) {
  if (!uri) return;
  const target = window.prompt("Новый полный VFS URI:", uri);
  if (!target || target === uri) return;
  try {
    await api("move", uri, { method: "POST", body: { target_uri: target.trim() } });
    notify("Ресурс перемещён");
    await browse(parentURI(target.trim()));
  } catch (error) { notify(error.message, true); }
}

async function deleteResource(uri = state.selectedResource) {
  if (!uri || !window.confirm(`Удалить ${uri}?`)) return;
  try {
    await api("resource", uri, { method: "DELETE" });
    notify("Ресурс удалён");
    await browse(parentURI(uri));
  } catch (error) { notify(error.message, true); }
}

function formatBytes(value) {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KiB`;
}

async function loadPages(selectKey = state.selectedPage?.page_key) {
  try {
    const [listing, tree] = await Promise.all([
      api("list", PAGES_URI),
      readJSON(`${HTML_ROOT}tree.json`),
    ]);
    state.tree = tree;
    $("tree-preview").textContent = JSON.stringify(tree, null, 2);
    const list = $("page-list");
    list.replaceChildren();
    for (const item of listing.items) {
      const li = document.createElement("li");
      const button = itemButton(item.name, item.kind, () => selectPage(item.name));
      button.classList.toggle("is-active", item.name === selectKey);
      li.append(button);
      list.append(li);
    }
    if (selectKey && listing.items.some((item) => item.name === selectKey)) {
      await selectPage(selectKey);
    } else if (listing.items.length) {
      await selectPage(listing.items[0].name);
    } else {
      resetPageForm();
    }
  } catch (error) {
    notify(error.message, true);
  }
}

async function readJSON(uri) {
  const text = await api("read", uri, { raw: true });
  return JSON.parse(text);
}

async function selectPage(key) {
  try {
    const page = await readJSON(`${PAGES_URI}/${key}/info.json`);
    state.selectedPage = page;
    for (const button of $("page-list").querySelectorAll("button")) {
      button.classList.toggle("is-active", button.querySelector("strong")?.textContent === key);
    }
    fillPageForm(page);
  } catch (error) {
    notify(error.message, true);
  }
}

function fillPageForm(page) {
  $("page-key").value = page.page_key;
  $("page-key").disabled = true;
  $("page-slug").value = page.slug;
  $("page-parent-id").value = page.parent_id ?? "";
  $("page-position-mode").value = "last";
  $("page-position-anchor").value = "";
  $("page-title").value = page.title;
  $("page-note").value = page.note;
  $("page-description").value = page.description;
  $("page-status").value = page.status;
  $("page-bundle").value = page.bundle_root_uri;
  $("page-bundle").disabled = true;
  $("prepare-bundle").disabled = true;
  $("page-types").value = (page.types || []).join(", ");
  $("page-tags").value = (page.search_tags || []).join(", ");
  $("page-visible-to").value = (page.visible_to || []).join(", ");
  $("page-revision").value = page.revision;
  $("page-state").textContent = `page rev ${page.revision}`;
  $("delete-page").hidden = false;
  $("delete-mode").disabled = false;
  $("move-page").hidden = false;
  $("save-page").textContent = "Сохранить";
}

function resetPageForm() {
  state.selectedPage = null;
  $("page-form").reset();
  $("page-key").disabled = false;
  $("page-bundle").disabled = false;
  $("page-bundle").value = "";
  $("prepare-bundle").disabled = false;
  $("page-visible-to").value = "user:html-demo";
  $("page-status").value = "draft";
  $("page-revision").value = "";
  $("page-state").textContent = `tree rev ${state.tree?.tree_revision ?? "—"}`;
  $("delete-page").hidden = true;
  $("delete-mode").disabled = true;
  $("move-page").hidden = true;
  $("save-page").textContent = "Создать";
  for (const button of $("page-list").querySelectorAll("button")) button.classList.remove("is-active");
}

function csv(id) {
  return $(id).value.split(",").map((value) => value.trim()).filter(Boolean);
}

function optionalID(id) {
  const value = $(id).value.trim();
  return value ? Number(value) : null;
}

function positionInput() {
  const mode = $("page-position-mode").value;
  if (mode === "first" || mode === "last") return { [mode]: true };
  const anchor = optionalID("page-position-anchor");
  if (!anchor) throw new Error(`Для позиции ${mode} нужен anchor page ID`);
  return { [`${mode}_id`]: anchor };
}

async function prepareBundle() {
  const key = $("page-key").value.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(key)) {
    notify("Сначала задайте Page key из букв, цифр, '.', '_' или '-'", true);
    return;
  }
  const root = `${CONTENT_ROOT}/${key}`;
  const files = {
    "content.md": `# ${$("page-title").value.trim() || key}\n\nНовая страница.`,
    "style.css": `/* Стили страницы ${key} */\n`,
    "script.js": `// Скрипт страницы ${key}\n`,
  };
  try {
    await api("directory", root, { method: "POST" });
    for (const [name, content] of Object.entries(files)) {
      await api("file", `${root}/${name}`, { method: "POST", rawBody: content, contentType: "text/plain; charset=utf-8" });
    }
    $("page-bundle").value = root;
    notify(`Bundle ${root} создан`);
    await browse(root);
  } catch (error) {
    notify(`${error.message}. При частичном создании проверьте bundle в файловом браузере.`, true);
    await browse(CONTENT_ROOT);
  }
}

async function savePage(event) {
  event.preventDefault();
  try {
    if (!state.selectedPage) {
      const input = {
        expected_tree_revision: state.tree.tree_revision,
        parent_id: optionalID("page-parent-id"),
        position: positionInput(),
        page_key: $("page-key").value.trim(),
        slug: $("page-slug").value.trim(),
        title: $("page-title").value,
        note: $("page-note").value,
        description: $("page-description").value,
        status: $("page-status").value,
        bundle_root_uri: $("page-bundle").value.trim(),
        visible_to: csv("page-visible-to"),
        types: csv("page-types"),
        search_tags: csv("page-tags"),
      };
      await api("control", PAGES_URI, { method: "POST", command: "create", body: input });
      notify(`Страница ${input.page_key} создана`);
      await loadPages(input.page_key);
      return;
    }

    const key = state.selectedPage.page_key;
    const base = `${PAGES_URI}/${key}`;
    const update = {
      expected_page_revision: state.selectedPage.revision,
      slug: $("page-slug").value.trim(),
      title: $("page-title").value,
      note: $("page-note").value,
      description: $("page-description").value,
      status: $("page-status").value,
    };
    const updated = await api("control", base, { method: "POST", command: "update", body: update });
    const typed = await api("control", base, { method: "POST", command: "set-types", body: { expected_page_revision: updated.page_revision, values: csv("page-types") } });
    await api("control", base, { method: "POST", command: "set-search-tags", body: { expected_page_revision: typed.page_revision, values: csv("page-tags") } });
    const visibleTo = csv("page-visible-to");
    if (!sameValues(visibleTo, state.selectedPage.visible_to || [])) {
      await api("control", base, {
        method: "POST",
        command: "set-visibility",
        body: { expected_visibility_revision: state.tree.visibility_revision, visible_to: visibleTo },
      });
    }
    notify(`Страница ${key} сохранена`);
    await loadPages(key);
  } catch (error) {
    notify(error.message, true);
    await loadPages(state.selectedPage?.page_key);
  }
}

async function movePage() {
  if (!state.selectedPage) return;
  try {
    await api("control", `${PAGES_URI}/${state.selectedPage.page_key}`, {
      method: "POST",
      command: "move",
      body: {
        expected_tree_revision: state.tree.tree_revision,
        parent_id: optionalID("page-parent-id"),
        position: positionInput(),
      },
    });
    notify(`Страница ${state.selectedPage.page_key} перемещена`);
    await loadPages(state.selectedPage.page_key);
  } catch (error) {
    notify(error.message, true);
    await loadPages(state.selectedPage?.page_key);
  }
}

async function registerCurrentRoot() {
  const purpose = window.prompt("Назначение publisher root:", "content");
  if (!purpose) return;
  try {
    await api("control", PUBLISHERS_URI, {
      method: "POST",
      command: "register-root",
      body: { root_uri: state.browserURI, purpose: purpose.trim(), visible_to: ["user:html-demo"] },
    });
    notify(`Publisher root ${state.browserURI} зарегистрирован`);
  } catch (error) { notify(error.message, true); }
}

async function runControl() {
  const uri = $("uri-input").value.trim();
  const command = window.prompt("Имя Control-команды:");
  if (!uri || !command) return;
  const raw = window.prompt("JSON payload:", "{}");
  if (raw === null) return;
  try {
    const payload = JSON.parse(raw);
    const result = await api("control", uri, { method: "POST", command: command.trim(), body: payload });
    clearPreview();
    $("preview-meta").textContent = `Control ${command.trim()} · ${uri}`;
    $("file-preview").value = JSON.stringify(result, null, 2);
    notify(`Control ${command.trim()} выполнен`);
    await loadPages();
  } catch (error) { notify(error.message, true); }
}

function sameValues(left, right) {
  return [...left].sort().join("\u0000") === [...right].sort().join("\u0000");
}

async function deletePage() {
  if (!state.selectedPage || !window.confirm(`Удалить страницу ${state.selectedPage.page_key}?`)) return;
  try {
    const key = state.selectedPage.page_key;
    await api("control", `${PAGES_URI}/${key}`, {
      method: "POST",
      command: "delete",
      body: {
        expected_page_revision: state.selectedPage.revision,
        expected_tree_revision: state.tree.tree_revision,
        mode: $("delete-mode").value,
      },
    });
    notify(`Страница ${key} удалена`);
    state.selectedPage = null;
    await loadPages();
  } catch (error) {
    notify(error.message, true);
    await loadPages(state.selectedPage?.page_key);
  }
}

function bindEvents() {
  $("refresh-all").addEventListener("click", () => Promise.all([loadScopes(), browse(state.browserURI), loadPages()]));
  $("refresh-pages").addEventListener("click", () => loadPages());
  $("new-page").addEventListener("click", resetPageForm);
  $("prepare-bundle").addEventListener("click", prepareBundle);
  $("move-page").addEventListener("click", movePage);
  $("page-form").addEventListener("submit", savePage);
  $("delete-page").addEventListener("click", deletePage);
  $("uri-form").addEventListener("submit", (event) => { event.preventDefault(); browse($("uri-input").value.trim()); });
  $("run-control").addEventListener("click", runControl);
  $("go-parent").addEventListener("click", () => browse(parentURI(state.browserURI)));
  $("new-directory").addEventListener("click", createDirectory);
  $("new-file").addEventListener("click", createFile);
  $("register-root").addEventListener("click", registerCurrentRoot);
  $("save-file").addEventListener("click", saveFile);
  $("move-resource").addEventListener("click", () => moveResource());
  $("delete-resource").addEventListener("click", () => deleteResource());
  $("close-preview").addEventListener("click", clearPreview);
}

async function start() {
  bindEvents();
  resetPageForm();
  await Promise.all([loadScopes(), browse(state.browserURI), loadPages()]);
}

start().catch((error) => notify(error.message, true));
