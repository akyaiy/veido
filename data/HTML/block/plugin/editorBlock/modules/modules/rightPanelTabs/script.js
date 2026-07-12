/* ===
 * Переключение вкладок правой панели
=== */

// Кнопки вкладок правой панели
const rightPanelTabs = document.querySelectorAll('#rightPanelTabs > .rightPanelTab');

/* ***
 * handleRightPanelTabClick - обработка нажатия на вкладку правой панели
 * - получает связанные панели вкладки
 * - скрывает открытые панели
 * - показывает выбранные панели
*** */
function handleRightPanelTabClick(event) {
    const tabPanels = event.currentTarget.getAttribute('right-panel-tab').split(' ');

    // Скрытие панелей правой панели
    document.querySelectorAll('#rightPanel > div:not(#rightPanelTabs)').forEach(panel => {
        panel.style.display = 'none';
    });

    // Открытие выбранных панелей
    tabPanels.forEach(panelId => {
        const panel = document.getElementById(panelId);

        if (panel) {
            panel.style.display = '';
        }
    });
}

// Добавление обработчиков вкладок
rightPanelTabs.forEach(tab => {
    tab.addEventListener('click', handleRightPanelTabClick);
});