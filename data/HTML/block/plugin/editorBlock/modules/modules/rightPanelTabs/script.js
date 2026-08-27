/* ===
 * Переключение вкладок правой панели
=== */

// Кнопки вкладок правой панели
let rightPanelTab = document.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)');

// Кнопка добавления вкладки
const rightPanelTabAdd = document.querySelector('.rightPanelTabAdd');

// Меню добавления вкладок
const rightPanelTabsAddMenu = document.getElementById('rightPanelTabsAddMenu');

// Контейнер вкладок правой панели
const rightPanelTabsMain = document.getElementById('rightPanelTabsMain');

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
    const propertyContent = document.getElementById(targetId);

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
    if (targetTab !== 'propertiesElement' && targetTab !== 'code') {
        tabPanels.forEach(panelId => {
            const panel = document.getElementById(panelId);

            if (panel) {
                panel.style.display = '';
            }
        });
    }

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

/* ***
 * initRightPanelTab - инициализация вкладки правой панели
 * - принимает элемент вкладки
 * - добавляет обработчик переключения вкладки
*** */
function initRightPanelTab(tab) {
    tab.addEventListener('click', function (event) {
        rightPanelTab.forEach(item => {
            item.classList.remove('active');
        });

        event.currentTarget.classList.add('active');
        handleRightPanelTabClick(event);
    });
}

/* ***
 * initRightPanelTabDrag - инициализация перемещения вкладки правой панели
 * - принимает элемент вкладки
 * - позволяет менять положение вкладки перетаскиванием
*** */
function initRightPanelTabDrag(tab) {
    tab.draggable = true;

    tab.addEventListener('dragstart', event => {
        event.dataTransfer.setData('text/plain', '');
        tab.classList.add('dragging');
    });

    tab.addEventListener('dragend', () => {
        tab.classList.remove('dragging');
    });

    tab.addEventListener('dragover', event => {
        event.preventDefault();

        const draggingTab = document.querySelector('.rightPanelTab.dragging');

        if (!draggingTab || draggingTab === tab) {
            return;
        }

        const rect = tab.getBoundingClientRect();
        const isAfter = event.clientX > rect.left + rect.width / 2;

        rightPanelTabsMain.insertBefore(
            draggingTab,
            isAfter ? tab.nextSibling : tab
        );
    });
}

// Добавление обработчиков вкладок
rightPanelTab.forEach(tab => {
    initRightPanelTab(tab);
    initRightPanelTabDrag(tab);

    const close = document.createElement('span');

    close.className = 'rightPanelTabClose';
    close.textContent = '×';

    tab.appendChild(close);

    close.addEventListener('click', event => {
        event.stopPropagation();

        const targetTab = tab.getAttribute('right-panel-tab');
        const item = rightPanelTabsAddMenu.querySelector(`[data-right-panel-tab="${targetTab}"]`);
        const isActive = tab.classList.contains('active');

        tab.remove();

        if (item) {
            item.style.display = '';
        } else {
            const menuItem = document.createElement('div');

            menuItem.setAttribute('data-right-panel-tab', targetTab);
            menuItem.textContent = tab.childNodes[0].textContent.trim();

            rightPanelTabsAddMenu.appendChild(menuItem);
        }

        rightPanelTab = document.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)');
        rightPanelTabAdd.style.display = '';

        if (isActive && rightPanelTab.length) {
            rightPanelTab[0].click();
        }
    });
});

// Обработчик открытия списка вкладок
if (rightPanelTabAdd && rightPanelTabsAddMenu) {
    rightPanelTabAdd.addEventListener('click', () => {
        rightPanelTabsAddMenu.style.display = rightPanelTabsAddMenu.style.display === 'none' ? '' : 'none';
    });
}

// Обработчик добавления вкладки
if (rightPanelTabsAddMenu && rightPanelTabsMain && rightPanelTabAdd) {
    rightPanelTabsAddMenu.addEventListener('click', event => {
        const item = event.target.closest('[data-right-panel-tab]');

        if (!item) {
            return;
        }

        const tab = document.createElement('div');

        tab.className = 'rightPanelTab';
        tab.setAttribute('right-panel-tab', item.getAttribute('data-right-panel-tab'));
        tab.textContent = item.textContent;

        const close = document.createElement('span');
        close.className = 'rightPanelTabClose';
        close.textContent = '×';
        tab.appendChild(close);

        rightPanelTabsMain.insertBefore(tab, rightPanelTabAdd);

        rightPanelTab = document.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)');

        initRightPanelTab(tab);
        initRightPanelTabDrag(tab);

        close.addEventListener('click', event => {
            event.stopPropagation();

            const isActive = tab.classList.contains('active');

            tab.remove();
            item.style.display = '';

            rightPanelTab = document.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)');
            rightPanelTabAdd.style.display = '';

            if (isActive) {
                const propertiesTab = document.querySelector('.rightPanelTab[right-panel-tab="propertiesElement"]');

                if (propertiesTab) {
                    propertiesTab.click();
                }
            }
        });

        item.style.display = 'none';
        rightPanelTabsAddMenu.style.display = 'none';

        const hasAvailableTabs = Array.from(rightPanelTabsAddMenu.querySelectorAll('[data-right-panel-tab]')).some(tab => tab.style.display !== 'none');
        rightPanelTabAdd.style.display = hasAvailableTabs ? '' : 'none';

        tab.click();
    });
}



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

            header?.querySelectorAll('.subTabBtn').forEach(b => {
                b.classList.remove('active');
            });

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