/* ===
 * Переключение вкладок правой панели
=== */

// Кнопки вкладок правой панели
const rightPanelTab = document.querySelectorAll('.rightPanelTab');

/* ***
 * getActiveSubTabPanelId - получение id активной панели подвкладки для выбранной вкладки правой панели
 * - ищет активную кнопку подвкладки в заголовке подвкладок (data-tab-head)
 * - возвращает значение атрибута data-tab-btn или data-tab-tab активной кнопки
*** */
function getActiveSubTabPanelId(targetTab) {
    const header = document.querySelector(`.subTabsHeader[data-tab-head="${targetTab}"]`);
    const activeButton = header?.querySelector('.subTabBtn.active');

    return activeButton?.getAttribute('data-tab-btn') || activeButton?.getAttribute('data-tab-tab') || '';
}

/* ***
 * showActiveSubTabContent - отображение контента активной подвкладки для выбранной вкладки правой панели
 * - ищет активную кнопку подвкладки в заголовке подвкладок (data-tab-head)
 * - скрывает все элементы с классом propertiesTabContent
 * - отображает элемент с классом propertiesTabContent, соответствующий активной кнопке подвкладки
 * - если соответствующего элемента нет, скрывает все панели правой панели и отображает панель с id, соответствующим активной кнопке подвкладки
*** */
function showActiveSubTabContent(targetTab) {
    const header = document.querySelector(`.subTabsHeader[data-tab-head="${targetTab}"]`);
    const activeButton = header?.querySelector('.subTabBtn.active');

    if (!activeButton) {
        return;
    }

    const targetId = activeButton.getAttribute('data-tab-btn') || activeButton.getAttribute('data-tab-tab') || '';
    const propertyContent = document.querySelector(`.propertiesTabContent[data-tab="${targetId}"]`);

    document.querySelectorAll('.propertiesTabContent').forEach(c => {
        c.style.display = 'none';
    });

    if (propertyContent) {
        propertyContent.style.display = '';
    } else {
        document.querySelectorAll('#rightPanel > div:not(#rightPanelTabs)').forEach(panel => {
            panel.style.display = 'none';
        });

        const panel = document.getElementById(targetId);
        if (panel) {
            panel.style.display = '';
        }
    }
}

/* ***
 * handleRightPanelTabClick - обработка нажатия на вкладку правой панели
 * - получает связанные панели вкладки
 * - скрывает открытые панели
 * - показывает выбранные панели
 * - управляет отображением связанных разделов свойств (data-tab-head)
*** */
function handleRightPanelTabClick(event) {
    const targetTab = event.currentTarget.getAttribute('right-panel-tab') || '';
    const activeSubTabPanelId = getActiveSubTabPanelId(targetTab);
    const tabPanels = targetTab === 'code'
        ? (activeSubTabPanelId ? [activeSubTabPanelId] : ['attributesElement'])
        : targetTab.split(' ').filter(Boolean);
    
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

    // Управление видимостью заголовков подвкладок (data-tab-head)
    document.querySelectorAll('[data-tab-head]').forEach(tabHead => {
        const headAttribute = tabHead.getAttribute('data-tab-head');
        const shouldShow = headAttribute === targetTab || (targetTab === 'code' && headAttribute === 'code');

        tabHead.style.display = shouldShow ? '' : 'none';
    });

    if (targetTab === 'propertiesElement' || targetTab === 'code') {
        showActiveSubTabContent(targetTab);
    }
}

// Добавление обработчиков вкладок
rightPanelTab.forEach(tab => {
    tab.addEventListener('click', function (event) {
        rightPanelTab.forEach(item => item.classList.remove('active'));
        event.currentTarget.classList.add('active');
        handleRightPanelTabClick(event);
    });
});



/* ===
 * Переключение под-вкладок 
=== */

/* ***
 * initPropertiesTabs - инициализация вкладок панели свойств 
 * - добавляет обработчики клика на кнопки вкладок
 * - переключает активные классы и отображение контента
*** */
function initPropertiesTabs() {
    const buttons = document.querySelectorAll('.subTabBtn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const header = btn.closest('.subTabsHeader');
            header?.querySelectorAll('.subTabBtn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const targetId = btn.getAttribute('data-tab-btn') || btn.getAttribute('data-tab-tab') || '';
            const propertyContent = document.querySelector(`.propertiesTabContent[data-tab="${targetId}"]`);

            if (propertyContent) {
                document.querySelectorAll('.propertiesTabContent').forEach(c => {
                    c.style.display = 'none';
                });
                propertyContent.style.display = '';
            } else {
                document.querySelectorAll('#rightPanel > div:not(#rightPanelTabs)').forEach(panel => {
                    panel.style.display = 'none';
                });

                const panel = document.getElementById(targetId);
                if (panel) {
                    panel.style.display = '';
                }
            }
        });
    });
}

// Вызов функции
initPropertiesTabs();