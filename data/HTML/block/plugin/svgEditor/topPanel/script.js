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

    // Копируем все дочерние элементы и атрибуты из srcSvg в dstSvg
    dstSvg.children[0].replaceChildren(...srcSvg.cloneNode(true).childNodes);
    for (const attr of srcSvg.attributes) {
        dstSvg.setAttribute(attr.name, attr.value);
    }

    // Выделение активной вкладки
    tabs.querySelectorAll(".svgTab").forEach((tab) => {
        tab.classList.toggle("active", tab.dataset.num === String(num));
    });
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
        dstSvg.children[0].replaceChildren();
    }
}