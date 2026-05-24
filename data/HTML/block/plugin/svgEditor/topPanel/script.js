// === Общие элементы ===

// Главный контейнер для вкладок меню
const tabsMenuContainer = document.getElementById("tabsMenuContainer");

// Идентификаторы и классы для работы с svg блоками
const canvas = document.getElementById("svgCanvas");
const canvasId = "svgCanvas";
const storage = document.getElementById("svgStorage");
const tabs = document.getElementById("tabs");
const svgBlockClass = "svgBlock";

// Загрузка тест блока
document.addEventListener("svgEditorBlocksLoaded", () => {
    loadSvg("plugin/svgEditor/test");
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



// === Загрузка svg блоков редактора ===

// Загрузка svg блока по url и создание для него вкладки
async function loadSvg(url) {
    // Загрузка svg блока
    await loadBlock(url, canvasId);

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
    svgBlock.textContent = canvas.innerHTML;
    storage.appendChild(svgBlock);

    // Создание нового блока для svg
    const svgTab = document.createElement("div");
    svgTab.textContent = url.split("/").pop();
    svgTab.className = "svgTab";
    svgTab.dataset.num = num;

    const svgTabclose = document.createElement("div");
    svgTabclose.textContent = "×";
    svgTabclose.className = "svgTabClose";

    svgTab.appendChild(svgTabclose);
    tabs.appendChild(svgTab);
}