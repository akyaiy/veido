// ==== Вкладки ====
const propertiesTab = document.querySelectorAll(".propertiesTab");

// При клике на вкладку загружаем соответствующий блок в правой панели
propertiesTab.forEach((tab) => {
    tab.addEventListener("click", () => {
        propertiesTab.forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        const path = tab.dataset.block;
        loadBlock(path, "propertiesContent");
    });
});

// Загружаем первую вкладку по умолчанию
if (propertiesTab.length) {
    propertiesTab[0].click();
} 