// === Общие элементы ===

// Главный контейнер для вкладок меню
const tabsMenuContainer = document.getElementById("tabsMenuContainer");

// Идентификаторы и классы для работы с svg блоками
const canvas = document.getElementById("svgCanvas");
const canvasId = "svgCanvas";
const storage = document.getElementById("svgStorage");
const tabs = document.getElementById("tabs");
const svgBlockClass = "svgBlock";

// Загрузка тест блоков
document.addEventListener("svgEditorBlocksLoaded", async () => {
    await loadSvg("plugin/svgEditor/test/test1");
    await loadSvg("plugin/svgEditor/test/test2");
});

// Получение слоев из SVG
function getContentLayer(svg) { return svg?.children[1]; }
function getOverlayLayer(svg) { return svg?.children[2]; }
function getBorderLayer(svg) { return svg?.children[0]; }



// === Вкладки меню ===
const tabsIcon = document.getElementById("tabsIcon");
const tabsMenu = document.getElementById("tabsMenu");

// Элементы вкладок
const tabNew = document.getElementById("tabNew");
const tabOpen = document.getElementById("tabOpen");
const tabSave = document.getElementById("tabSave");
const tabSaveAs = document.getElementById("tabSaveAs");

// Открытие и закрытие меню
tabsIcon.addEventListener("click", () => {
    tabsMenu.classList.toggle("active");
});

document.addEventListener("click", (event) => {
    if (!tabsMenuContainer.contains(event.target) || !tabsIcon.contains(event.target)) {
        tabsMenu.classList.remove("active");
    }
});

// Создание новой вкладки
tabNew.addEventListener("click", () => { loadSvg() });

// Открытие svg через файл менеджер
tabOpen.addEventListener("click", async () => {
    await openSvgFromFileManager();
});

// Сохранение svg стандартным именем
tabSave.addEventListener("click", async () => {
    await saveSvgWithStandardName();
});

// Сохранение svg через файл менеджер
tabSaveAs.addEventListener("click", async () => {
    await saveSvgAsFileManager();
});



// === Работа с svg блоками ===

// Вычисление следующего свободного номера для блока svg
function getNextSvgNum() {
    const used = new Set();

    storage.querySelectorAll(`.${svgBlockClass}`).forEach((el) => {
        const n = parseInt(el.dataset.num, 10);
        if (!isNaN(n)) used.add(n);
    });

    let num = 1;
    while (used.has(num)) num++;

    return num;
}

// Получение текста текущего svg
function getCurrentSvgText() {
    const svg = canvas.querySelector("svg");
    if (!svg) return "";

    const borderLayer = getBorderLayer(svg);
    const contentLayer = getContentLayer(svg);

    if (!borderLayer || !contentLayer) return "";

    const borderPath = borderLayer.querySelector("#borderPath");
    if (!borderPath) return "";

    const match = borderPath
        .getAttribute("d")
        ?.match(/M\s+0\s+0\s+H\s+([\d.]+)\s+V\s+([\d.]+)/);

    if (!match) return "";

    const width = match[1];
    const height = match[2];

    const exportSvg = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
    );

    exportSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    exportSvg.setAttribute("width", width);
    exportSvg.setAttribute("height", height);
    exportSvg.setAttribute("viewBox", `0 0 ${width} ${height}`);

    Array.from(contentLayer.childNodes).forEach((node) => {
        exportSvg.appendChild(node.cloneNode(true));
    });

    return new XMLSerializer().serializeToString(exportSvg);
}

// Получение стандартного имени файла
function getStandardSvgFileName() {
    return "document.svg";
}

// Получение имени файла для активной вкладки
function getActiveSvgFileName() {
    const activeTab = tabs.querySelector(".svgTab.active");
    if (!activeTab) return getStandardSvgFileName();

    const svgBlock = storage.querySelector(`.${svgBlockClass}[data-num="${activeTab.dataset.num}"]`);
    if (!svgBlock) return getStandardSvgFileName();

    if (svgBlock.dataset.url) {
        const fileName = svgBlock.dataset.url.split("/").pop() || "document.svg";
        return fileName.endsWith(".svg") ? fileName : fileName + ".svg";
    }

    const title = activeTab.querySelector(".svgTabTitle")?.textContent || "document";
    return title.endsWith(".svg") ? title : title + ".svg";
}

// Скачивание svg как файла
async function downloadSvgText(svgText, fileName) {
    const blob = new Blob([svgText], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(link.href);
}

// Преобразование пути в VFS URI
function svgFileUri(path) {
    return path.includes(":///") ? path : window.VFS_ROOT + path.replace(/^\/+/, "");
}

// Получение активного SVG блока
function getActiveSvgBlock() {
    const tab = tabs.querySelector(".svgTab.active");
    return tab ? storage.querySelector(`.${svgBlockClass}[data-num="${tab.dataset.num}"]`) : null;
}

// Открытие SVG из VFS
async function openSvgFromFileManager() {
    const path = prompt("Путь к SVG:");
    if (!path) return;

    try {
        const uri = svgFileUri(path);
        const text = await window.vfs.read(uri);
        await loadSvgFromText(text, uri);
    } catch (error) {
        console.error("Ошибка открытия SVG:", error);
    }
}

// Сохранение SVG как нового файла в VFS
async function saveSvgAsFileManager() {
    const svgText = getCurrentSvgText();
    if (!svgText) return;

    const path = prompt("Путь для сохранения:", getActiveSvgFileName());
    if (!path) return;

    const uri = svgFileUri(path.endsWith(".svg") ? path : path + ".svg");

    try {
        // Проверяем, существует ли файл
        let exists = false;

        try {
            await window.vfs.stat(uri);
            exists = true;
        } catch (error) {
            if (error.status !== 404) throw error;
        }

        if (exists) {
            // Подтверждение перезаписи
            if (!confirm("Файл уже существует. Перезаписать?")) return;

            await window.vfs.write(uri, svgText);
        } else {
            // Создание нового файла
            await window.vfs.create(uri, new Blob([svgText], { type: "image/svg+xml" }));
        }

        // Обновление пути и названия вкладки
        const svgBlock = getActiveSvgBlock();
        if (svgBlock) svgBlock.dataset.url = uri;

        const title = tabs.querySelector(".svgTab.active .svgTabTitle");
        if (title) title.textContent = uri.split("/").pop().replace(/\.svg$/i, "");

    } catch (error) {
        console.error("Ошибка сохранения SVG:", error);
    }
}

// Сохранение SVG в VFS
async function saveSvgWithStandardName() {
    const svgBlock = getActiveSvgBlock();
    const svgText = getCurrentSvgText();
    if (!svgText) return;

    if (!svgBlock?.dataset.url?.endsWith(".svg")) {
        await saveSvgAsFileManager();
        return;
    }

    try {
        await window.vfs.write(svgFileUri(svgBlock.dataset.url), svgText);
    } catch (error) {
        console.error("Ошибка сохранения SVG:", error);
    }
}

// Загрузка svg из текста
async function loadSvgFromText(svgText, fileName = null) {
    // Вычисление следующего свободного номера для блока svg
    const num = getNextSvgNum();

    // Создание нового блока для svg
    const svgBlock = document.createElement("div");
    svgBlock.className = svgBlockClass;
    svgBlock.dataset.num = num;
    svgBlock.dataset.url = fileName || "";
    svgBlock.id = "svgTab" + num;

    const parser = new DOMParser();
    const doc = parser.parseFromString(svgText, "image/svg+xml");
    const parsedSvg = doc.querySelector("svg");

    if (!parsedSvg) return;

    svgBlock.appendChild(document.importNode(parsedSvg, true));
    storage.appendChild(svgBlock);

    // Создание нового блока для svg
    const svgTab = document.createElement("div");
    svgTab.className = "svgTab";
    svgTab.dataset.num = num;

    // Название вкладки
    const svgTabTitle = document.createElement("div");
    if (fileName) {
        svgTabTitle.textContent = fileName.split("/").pop().replace(/\.svg$/i, "");
    } else {
        svgTabTitle.textContent = "*new";
    }
    svgTabTitle.className = "svgTabTitle";
    svgTab.addEventListener("click", () => openSvgBlock(num));

    // Кнопка закрытия вкладки
    const svgTabclose = document.createElement("div");
    svgTabclose.textContent = "×";
    svgTabclose.className = "svgTabClose";
    svgTabclose.addEventListener("click", (event) => closeSvgBlock(num, event));

    svgTab.appendChild(svgTabTitle);
    svgTab.appendChild(svgTabclose);
    tabs.appendChild(svgTab);

    // Открываем загруженный блок через функцию после добавления вкладки
    openSvgBlock(num);
}

// Загрузка svg блока по url и создание для него вкладки
async function loadSvg(url = null) {
    // Вычисление следующего свободного номера для блока svg
    const num = getNextSvgNum();

    // Создание нового блока для svg
    const svgBlock = document.createElement("div");
    svgBlock.className = svgBlockClass;
    svgBlock.dataset.num = num;
    svgBlock.dataset.url = url;
    svgBlock.id = "svgTab" + num;
    svgBlock.textContent = canvas.innerHTML;
    storage.appendChild(svgBlock);
    
    // Загрузка svg блока
    if (url) {
        svgBlock.textContent = canvas.innerHTML;
        await loadBlock(url, svgBlock.id);
    } else {
        svgBlock.innerHTML = `<svg width="800" height="600" xmlns="http://www.w3.org/2000/svg"></svg>`;
    }

    // Создание нового блока для svg
    const svgTab = document.createElement("div");
    svgTab.className = "svgTab";
    svgTab.dataset.num = num;

    // Название вкладки
    const svgTabTitle = document.createElement("div");
    if (url) {
        svgTabTitle.textContent = url.split("/").pop();
    } else {
        svgTabTitle.textContent = "*new";
    }
    svgTabTitle.className = "svgTabTitle";
    svgTab.addEventListener("click", () => openSvgBlock(num));

    // Кнопка закрытия вкладки
    const svgTabclose = document.createElement("div");
    svgTabclose.textContent = "×";
    svgTabclose.className = "svgTabClose";
    svgTabclose.addEventListener("click", (event) => closeSvgBlock(num, event));

    svgTab.appendChild(svgTabTitle);
    svgTab.appendChild(svgTabclose);
    tabs.appendChild(svgTab);

    // Открываем загруженный блок через функцию после добавления вкладки
    openSvgBlock(num);
}

// Открытие svg блока на канве и выделение соответствующей вкладки
function openSvgBlock(num) {
    const svgBlock = storage.querySelector(`.${svgBlockClass}[data-num="${num}"]`);
    if (!svgBlock) return;

    // Получаем svg из блока и канвы
    const srcSvg = svgBlock.querySelector("svg");;
    const dstSvg = canvas.querySelector("svg");
    if (!srcSvg || !dstSvg) return;

    // Получаем размеры оригинального листа
    const w = parseFloat(srcSvg.getAttribute("width"));
    const h = parseFloat(srcSvg.getAttribute("height"));

    // Делаем основную канву бесконечной
    dstSvg.setAttribute("width", "100%");
    dstSvg.setAttribute("height", "100%");
    dstSvg.removeAttribute("viewBox");

    // Высчитываем координаты для центрирования листа на экране
    const rect = dstSvg.getBoundingClientRect();
    const tx = Math.max(0, (rect.width - w) / 2);
    const ty = Math.max(0, (rect.height - h) / 2);

    // Копируем дочерние элементы в второй g вместе с белым фоном
    const drawGroup = dstSvg.children[1];
    drawGroup.replaceChildren(...srcSvg.cloneNode(true).childNodes);
    drawGroup.setAttribute("transform", `translate(${tx}, ${ty})`);

    // Очищаем технический слой от старых рамок выделения
    const techLayer = dstSvg.children[0];
    if (techLayer) {
        techLayer.innerHTML = "";
        dstSvg.children[2].innerHTML = "";
        techLayer.setAttribute("transform", `translate(${tx}, ${ty})`);

        // Рисуем рамку вокруг листа
        const borderPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        borderPath.setAttribute("d", `M 0 0 H ${w} V ${h} H 0 Z`);
        borderPath.setAttribute("fill", "#ffffff");
        borderPath.setAttribute("stroke-width", "1");
        borderPath.setAttribute("id", "borderPath");
        borderPath.style.filter = "drop-shadow(0 1px 2.5px rgba(0,0,0,0.25))";
        techLayer.appendChild(borderPath);
    }

    // Сбрасываем выделение при открытии новой вкладки
    if (!Array.isArray(window.selectedElementsSvg)) {
        window.selectedElementsSvg = [];
    } else {
        window.selectedElementsSvg.length = 0;
    }

    // Удаляем рамки старого выделения
    const activeSvg = canvas.querySelector("svg");
    const overlayLayer = activeSvg ? activeSvg.children[2] : null;
    if (overlayLayer) overlayLayer.innerHTML = "";

    // Выделение активной вкладки
    tabs.querySelectorAll(".svgTab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.num === String(num));
    });
        
    document.dispatchEvent(new Event("openSvgBlock"));
}

// Закрытие svg блока и удаление соответствующей вкладки
function closeSvgBlock(num, event) {
    event?.stopPropagation();

    // Удаление вкладки и блока svg
    const tab = tabs.querySelector(`.svgTab[data-num="${num}"]`);
    if (tab) tab.remove();

    // Удаление блока svg из хранилища
    const svgBlock = storage.querySelector(`.${svgBlockClass}[data-num="${num}"]`);
    if (svgBlock) svgBlock.remove();

    // Если остались другие вкладки, открываем последнюю из них
    const remainingTabs = Array.from(tabs.querySelectorAll(".svgTab"));
    if (remainingTabs.length) {
        const maxNum = Math.max(...remainingTabs.map((tab) => parseInt(tab.dataset.num, 10)));
        openSvgBlock(maxNum);
        return;
    }

    // Если вкладок не осталось, очищаем канву
    const dstSvg = canvas.querySelector("svg");
    if (dstSvg) {
        dstSvg.children[1].replaceChildren();
    }
}