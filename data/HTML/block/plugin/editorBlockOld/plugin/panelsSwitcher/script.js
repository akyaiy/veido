const tabs = document.querySelectorAll('#panelsSwitcher .tab');
const specRoot = document.getElementById('propertiesPanel');

/***********************************************************************
 * tabs tab click — переключение вкладок CSS и JS:
 * - Снимает активное состояние со всех вкладок.
 * - Активирует выбранную вкладку.
 * - Отображает соответствующую панель (CSS или JS).
 * - Скрывает неактивную панель.
 **********************************************************************/
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        switchTabPanel(tab.dataset.tab);
    });
});

/***********************************************************************
 * switchTabPanel — переключение видимости панелей (properties, css, js):
 * - Принимает имя вкладки: 'properties', 'css' или 'js'.
 * - Показывает соответствующую панель.
 * - Скрывает остальные панели.
 **********************************************************************/
function switchTabPanel(tabName) {
    if (tabName === 'properties') {
        propertiesPanel.style.display = '';
        jsPanel.style.display = 'none';
        syncCssPanelVisibility();
    } else if (tabName === 'css') {
        propertiesPanel.style.display = 'none';
        /* if (cssPanel) cssPanel.style.display = 'flex'; */
        jsPanel.style.display = 'none';
    } else if (tabName === 'js') {
        propertiesPanel.style.display = 'none';
        /* if (cssPanel) cssPanel.style.display = 'none'; */
        jsPanel.style.display = 'flex';
        const blockId = getActiveBlockId();
        if (blockId) ensureJsPanelSelection(blockId);
    }

    // если вкладка не properties, прячем панель спец‑свойств
    if (tabName !== 'properties' && specRoot) {
        specRoot.style.display = 'none';
    }
}