// ==== Вкладки ====
const propertiesTab = document.querySelectorAll(".propertiesTab");

// При клике на вкладку загружаем соответствующий блок в правой панели
propertiesTab.forEach((tab) => {
    tab.addEventListener("click", async () => {
        // Активируем выбранную вкладку
        propertiesTab.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        // Загружаем блок, указанный в атрибуте data-block
        const path = tab.dataset.block;
        await loadBlock(path, "propertiesContent");
    });
});

// Загружаем первую вкладку по умолчанию
if (propertiesTab.length) {
    propertiesTab[0].click();
} 