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

// Открытие и закрытие меню
tabsIcon.addEventListener("click", () => {
    tabsMenu.classList.toggle("active");
});

document.addEventListener("click", (event) => {
    if (!tabsMenuContainer.contains(event.target) || !tabsIcon.contains(event.target)) {
        tabsMenu.classList.remove("active");
    }
});



// === Работа с svg блоками ===

// Загрузка svg блока по url и создание для него вкладки
async function loadSvg(url) {
    // Вычисление следующего свободного номера для блока svg
    const used = new Set();

    storage.querySelectorAll(`.${svgBlockClass}`).forEach((el) => {
        const n = parseInt(el.dataset.num, 10);
        if (!isNaN(n)) used.add(n);
    });

    let num = 1;
    while (used.has(num)) num++;

    // Создание нового блока для svg
    const svgBlock = document.createElement("div");
    svgBlock.className = svgBlockClass;
    svgBlock.dataset.num = num;
    svgBlock.dataset.url = url;
    svgBlock.id = "svgTab" + num;
    svgBlock.textContent = canvas.innerHTML;
    storage.appendChild(svgBlock);
    
    // Загрузка svg блока
    await loadBlock(url, svgBlock.id);

    // Создание нового блока для svg
    const svgTab = document.createElement("div");
    svgTab.className = "svgTab";
    svgTab.dataset.num = num;

    // Название вкладки
    const svgTabTitle = document.createElement("div");
    svgTabTitle.textContent = url.split("/").pop();
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
    const srcSvg = document.getElementById(svgBlock.id)?.querySelector("svg");
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
    selectedElements = [];

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