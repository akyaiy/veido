// === Вкладки ===
const propertiesTab = document.querySelectorAll(".propertiesTab");
const propertiesContent = "propertiesContent";

// При клике на вкладку загружаем соответствующий блок в правой панели
propertiesTab.forEach((tab) => {
    tab.addEventListener("click", async () => {
        // Активируем выбранную вкладку
        propertiesTab.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Загружаем блок, указанный в атрибуте data-block
        const path = tab.dataset.block;
        await loadBlock(path, propertiesContent);
        document.getElementById(propertiesContent).dataset.block = path;
    });
});

// Загружаем первую вкладку по умолчанию
if (propertiesTab.length) {
    propertiesTab[0].click();
}

document.addEventListener("svgSelectionChanged", () => updateTabsVisibility());

document.addEventListener("openSvgBlock", () => updateTabsVisibility());

// === Видимость вкладок ===

// Списки разрешенных вкладок для разных типов выделения
const tabsVisibilityMap = {
    "-": ["propertiesTabColor"],
    "g": ["propertiesTabColor"],
    "rect": ["propertiesTabColor"],
    "circle": ["propertiesTabColor"],
    "line": ["propertiesTabColor"],
    "path": ["propertiesTabColor"]
};

// Обновление видимости вкладок при изменении выделения
function updateTabsVisibility() {
    const selected = window.selectedElementsSvg || [];
    let allowedTabs = tabsVisibilityMap["-"];

    // Если элементы выделены, находим только общие вкладки для всех типов
    if (selected.length > 0) {
        const tabsArrays = selected.map(el => tabsVisibilityMap[el.tagName.toLowerCase()] || tabsVisibilityMap["-"]);
        allowedTabs = tabsArrays.reduce((acc, current) => acc.filter(tab => current.includes(tab)));
    }

    // Находим текущую активную вкладку
    const activeTabEl = document.querySelector(".propertiesTab.active");
    const activeTabId = activeTabEl ? activeTabEl.id : null;

    // Если у текущего режима нет прав на активную вкладку, кликаем на вкладку из "-"
    if (activeTabId && !allowedTabs.includes(activeTabId)) {
        const fallbackTabId = tabsVisibilityMap["-"][0];
        const fallbackTabEl = document.getElementById(fallbackTabId);
        if (fallbackTabEl) {
            fallbackTabEl.click();
        }
    }

    // Управляем видимостью самих вкладок на панели
    const allTabIds = ["propertiesTabCoordinates", "propertiesTabColor"];
    allTabIds.forEach((tabId) => {
        const tabEl = document.getElementById(tabId);
        if (tabEl) {
            tabEl.style.display = allowedTabs.includes(tabId) ? "block" : "none";
        }
    });
}