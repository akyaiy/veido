// ==== Вкладки ====
const propertiesTab = document.querySelectorAll(".propertiesTab");

// При клике на вкладку загружаем соответствующий блок в правой панели
propertiesTab.forEach((tab) => {
    tab.addEventListener("click", () => {
        const path = tab.dataset.block;

        loadBlock(path, "propertiesContent");
    });
});
// Загружаем первую вкладку по умолчанию
propertiesTab[0].click(); 