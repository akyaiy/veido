/* ===
 * Переключение вкладок правой панели
=== */

// Кнопки вкладок правой панели
let rightPanelTab = document.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)');

// Кнопка добавления вкладки
let rightPanelTabAdd = document.querySelector('.rightPanelTabAdd');

// Меню добавления вкладок
const rightPanelTabsAddMenu = document.getElementById('rightPanelTabsAddMenu');

// Контейнер вкладок правой панели
const rightPanelTabsMain = document.getElementById('rightPanelTabsMain');

// Правая панель
const rightPanel = document.getElementById('rightPanel');

// Текущая область для добавления вкладки
let rightPanelTabsAddMenuTarget = null;

// Перетаскиваемая вкладка
let draggingRightPanelTab = null;

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
 * getRightPanelTabPanel - получение панели вкладки
 * - принимает название вкладки
 * - получает связанную панель
 * - возвращает элемент панели или null
*** */
function getRightPanelTabPanel(targetTab) {
    if (targetTab === 'code') {
        const activeSubTabPanelId = getActiveSubTabPanelId(targetTab);
        const panelId = activeSubTabPanelId || 'attributesElement';

        return document.getElementById(panelId);
    }

    return document.getElementById(targetTab);
}

/* ***
 * updateRightPanelTabs - обновление списка вкладок правой панели
 * - получает все открытые вкладки
 * - обновляет переменную rightPanelTab
*** */
function updateRightPanelTabs() {
    rightPanelTab = document.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)');
}

/* ***
 * updateRightPanelAddButtons - обновление кнопок добавления вкладок
 * - проверяет наличие скрытых вкладок в меню
 * - показывает или скрывает кнопки добавления
*** */
function updateRightPanelAddButtons() {
    const hasAvailableTabs = Array.from(
        rightPanelTabsAddMenu.querySelectorAll('[data-right-panel-tab]')
    ).some(item => item.style.display !== 'none');

    document.querySelectorAll('.rightPanelTabAdd').forEach(addButton => {
        addButton.style.display = hasAvailableTabs ? '' : 'none';
    });
}

/* ***
 * showRightPanelRegionTab - отображение вкладки в области правой панели
 * - принимает вкладку
 * - скрывает содержимое других вкладок текущей области
 * - показывает выбранную панель
*** */
function showRightPanelRegionTab(tab) {
    const region = tab.closest('.rightPanelTabsRegion');

    if (!region) {
        return;
    }

    const header = region.querySelector('.rightPanelTabsRegionHeader');
    const content = region.querySelector('.rightPanelTabsRegionContent');
    const targetTab = tab.getAttribute('right-panel-tab') || '';
    const panel = getRightPanelTabPanel(targetTab);

    if (!header || !content || !panel) {
        return;
    }

    header.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)').forEach(item => {
        item.classList.remove('active');
    });

    content.querySelectorAll(':scope > [data-right-panel-content]').forEach(item => {
        item.style.display = 'none';
    });

    if (panel.parentElement !== content) {
        content.appendChild(panel);
    }

    panel.setAttribute('data-right-panel-content', targetTab);
    panel.style.display = '';

    tab.classList.add('active');
}

/* ***
 * createRightPanelAddButton - создание кнопки добавления вкладки
 * - принимает область вкладок
 * - создаёт кнопку +
 * - открывает меню добавления для выбранной области
 * - возвращает кнопку
*** */
function createRightPanelAddButton(region) {
    const addButton = document.createElement('div');

    addButton.className = 'rightPanelTab rightPanelTabAdd';
    addButton.textContent = '+';

    addButton.addEventListener('click', event => {
        event.stopPropagation();

        rightPanelTabsAddMenuTarget = region;
        rightPanelTabAdd = addButton;

        const buttonRect = addButton.getBoundingClientRect();
        const tabsRect = document.getElementById('rightPanelTabs').getBoundingClientRect();

        rightPanelTabsAddMenu.style.left = `${buttonRect.left - tabsRect.left}px`;
        rightPanelTabsAddMenu.style.top = `${buttonRect.bottom - tabsRect.top}px`;
        rightPanelTabsAddMenu.style.display = rightPanelTabsAddMenu.style.display === 'none'
            ? ''
            : 'none';
    });

    return addButton;
}

/* ***
 * createRightPanelTabsRegion - создание области вкладок правой панели
 * - создаёт заголовок и область содержимого
 * - добавляет собственную кнопку +
 * - возвращает созданную область
*** */
function createRightPanelTabsRegion() {
    const region = document.createElement('div');
    const header = document.createElement('div');
    const content = document.createElement('div');
    const addButton = createRightPanelAddButton(region);

    region.className = 'rightPanelTabsRegion';
    header.className = 'rightPanelTabsRegionHeader';
    content.className = 'rightPanelTabsRegionContent';

    header.appendChild(addButton);

    region.appendChild(header);
    region.appendChild(content);

    initRightPanelRegionDrop(region);

    return region;
}

/* ***
 * removeEmptyRightPanelRegions - удаление пустых областей правой панели
 * - оставляет минимум одну область
 * - удаляет области без вкладок
*** */
function removeEmptyRightPanelRegions() {
    const regions = Array.from(
        rightPanelTabsMain.querySelectorAll('.rightPanelTabsRegion')
    );

    if (regions.length <= 1) {
        return;
    }

    regions.forEach(region => {
        const tab = region.querySelector('.rightPanelTab:not(.rightPanelTabAdd)');

        if (!tab && rightPanelTabsMain.querySelectorAll('.rightPanelTabsRegion').length > 1) {
            region.remove();
        }
    });
}

/* ***
 * activateFirstRightPanelTab - открытие первой вкладки области
 * - принимает область
 * - открывает первую доступную вкладку
*** */
function activateFirstRightPanelTab(region) {
    if (!region) {
        return;
    }

    const tab = region.querySelector('.rightPanelTab:not(.rightPanelTabAdd)');

    if (tab) {
        showRightPanelRegionTab(tab);
    }
}

/* ***
 * moveRightPanelTab - перенос вкладки между областями
 * - принимает вкладку и целевую область
 * - переносит вкладку и связанную панель
 * - обновляет активные вкладки областей
*** */
function moveRightPanelTab(tab, targetRegion) {
    if (!tab || !targetRegion) {
        return;
    }

    const sourceRegion = tab.closest('.rightPanelTabsRegion');
    const targetHeader = targetRegion.querySelector('.rightPanelTabsRegionHeader');
    const targetContent = targetRegion.querySelector('.rightPanelTabsRegionContent');
    const targetAddButton = targetHeader.querySelector('.rightPanelTabAdd');
    const targetTab = tab.getAttribute('right-panel-tab') || '';
    const panel = getRightPanelTabPanel(targetTab);
    const wasActive = tab.classList.contains('active');

    if (!sourceRegion || !targetHeader || !targetContent) {
        return;
    }

    if (targetAddButton) {
        targetHeader.insertBefore(tab, targetAddButton);
    } else {
        targetHeader.appendChild(tab);
    }

    if (panel) {
        targetContent.appendChild(panel);
    }

    showRightPanelRegionTab(tab);

    if (sourceRegion !== targetRegion && wasActive) {
        activateFirstRightPanelTab(sourceRegion);
    }

    removeEmptyRightPanelRegions();
    updateRightPanelTabs();
}

/* ***
 * createRightPanelTab - создание вкладки правой панели
 * - принимает название панели, текст и область
 * - создаёт вкладку с кнопкой закрытия
 * - возвращает созданную вкладку
*** */
function createRightPanelTab(targetTab, title, region) {
    const tab = document.createElement('div');
    const close = document.createElement('span');

    tab.className = 'rightPanelTab';
    tab.setAttribute('right-panel-tab', targetTab);
    tab.textContent = title;

    close.className = 'rightPanelTabClose';
    close.textContent = '×';

    tab.appendChild(close);

    initRightPanelTab(tab);
    initRightPanelTabDrag(tab);

    close.addEventListener('click', event => {
        event.stopPropagation();

        closeRightPanelTab(tab);
    });

    const header = region.querySelector('.rightPanelTabsRegionHeader');
    const addButton = header.querySelector('.rightPanelTabAdd');

    if (addButton) {
        header.insertBefore(tab, addButton);
    } else {
        header.appendChild(tab);
    }

    updateRightPanelTabs();

    return tab;
}

/* ***
 * closeRightPanelTab - закрытие вкладки правой панели
 * - принимает вкладку
 * - возвращает вкладку в меню +
 * - удаляет пустую область
*** */
function closeRightPanelTab(tab) {
    const targetTab = tab.getAttribute('right-panel-tab') || '';
    const title = tab.childNodes[0] ? tab.childNodes[0].textContent.trim() : '';
    const region = tab.closest('.rightPanelTabsRegion');
    const panel = getRightPanelTabPanel(targetTab);
    const isActive = tab.classList.contains('active');

    let menuItem = rightPanelTabsAddMenu.querySelector(
        `[data-right-panel-tab="${targetTab}"]`
    );

    if (!menuItem) {
        menuItem = document.createElement('div');
        menuItem.setAttribute('data-right-panel-tab', targetTab);
        menuItem.textContent = title;

        rightPanelTabsAddMenu.appendChild(menuItem);
    }

    menuItem.style.display = '';

    if (panel) {
        panel.style.display = 'none';

        if (rightPanel) {
            rightPanel.appendChild(panel);
        }
    }

    tab.remove();

    updateRightPanelTabs();

    if (isActive) {
        activateFirstRightPanelTab(region);
    }

    removeEmptyRightPanelRegions();
    updateRightPanelAddButtons();
}

/* ***
 * initRightPanelTab - инициализация вкладки правой панели
 * - принимает элемент вкладки
 * - добавляет обработчик переключения вкладки
*** */
function initRightPanelTab(tab) {
    tab.addEventListener('click', event => {
        if (event.target.closest('.rightPanelTabClose')) {
            return;
        }

        showRightPanelRegionTab(event.currentTarget);
    });
}

/* ***
 * initRightPanelTabDrag - инициализация перемещения вкладки правой панели
 * - принимает элемент вкладки
 * - позволяет менять порядок вкладок
 * - позволяет переносить вкладки между областями
*** */
function initRightPanelTabDrag(tab) {
    tab.draggable = true;

    tab.addEventListener('dragstart', event => {
        draggingRightPanelTab = tab;

        event.dataTransfer.setData('text/plain', '');
        tab.classList.add('dragging');
    });

    tab.addEventListener('dragend', () => {
        tab.classList.remove('dragging');

        draggingRightPanelTab = null;

        removeEmptyRightPanelRegions();
    });

    tab.addEventListener('dragover', event => {
        event.preventDefault();
        event.stopPropagation();

        if (!draggingRightPanelTab || draggingRightPanelTab === tab) {
            return;
        }

        const region = tab.closest('.rightPanelTabsRegion');
        const header = tab.closest('.rightPanelTabsRegionHeader');

        if (!region || !header) {
            return;
        }

        const rect = tab.getBoundingClientRect();
        const isAfter = event.clientX > rect.left + rect.width / 2;

        if (draggingRightPanelTab.closest('.rightPanelTabsRegion') !== region) {
            moveRightPanelTab(draggingRightPanelTab, region);
        }

        if (isAfter) {
            const nextTab = tab.nextElementSibling;

            if (
                nextTab &&
                !nextTab.classList.contains('rightPanelTabAdd')
            ) {
                header.insertBefore(draggingRightPanelTab, nextTab.nextSibling);
            }
        } else {
            header.insertBefore(draggingRightPanelTab, tab);
        }
    });
}

/* ***
 * initRightPanelRegionDrop - инициализация переноса вкладки в область
 * - принимает область вкладок
 * - при переносе в содержимое перемещает вкладку в эту область
*** */
function initRightPanelRegionDrop(region) {
    region.addEventListener('dragover', event => {
        if (!draggingRightPanelTab) {
            return;
        }

        event.preventDefault();
    });

    region.addEventListener('drop', event => {
        if (!draggingRightPanelTab) {
            return;
        }

        const header = event.target.closest('.rightPanelTabsRegionHeader');

        if (header) {
            return;
        }

        event.preventDefault();

        moveRightPanelTab(draggingRightPanelTab, region);
    });
}

/* ***
 * initRightPanelBottomDrop - инициализация создания нижней области
 * - при переносе вкладки вниз создаёт новую область
 * - переносит вкладку в созданную область
*** */
function initRightPanelBottomDrop() {
    rightPanelTabsMain.addEventListener('dragover', event => {
        if (!draggingRightPanelTab) {
            return;
        }

        event.preventDefault();

        const regions = Array.from(
            rightPanelTabsMain.querySelectorAll('.rightPanelTabsRegion')
        );
        const lastRegion = regions[regions.length - 1];

        if (!lastRegion) {
            return;
        }

        const rect = lastRegion.getBoundingClientRect();
        const isBottom = event.clientY > rect.top + rect.height * 0.75;

        if (!isBottom) {
            return;
        }

        const sourceRegion = draggingRightPanelTab.closest('.rightPanelTabsRegion');
        const sourceTabs = sourceRegion
            ? sourceRegion.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)')
            : [];

        if (
            sourceRegion === lastRegion &&
            sourceTabs.length <= 1
        ) {
            return;
        }

        let newRegion = rightPanelTabsMain.querySelector('.rightPanelTabsRegion.dragTarget');

        if (!newRegion) {
            newRegion = createRightPanelTabsRegion();
            newRegion.classList.add('dragTarget');

            rightPanelTabsMain.appendChild(newRegion);
        }

        moveRightPanelTab(draggingRightPanelTab, newRegion);
    });

    rightPanelTabsMain.addEventListener('dragend', () => {
        rightPanelTabsMain.querySelectorAll('.rightPanelTabsRegion.dragTarget').forEach(region => {
            region.classList.remove('dragTarget');
        });
    });
}

/* ***
 * initRightPanelTabs - инициализация областей правой панели
 * - создаёт первую область
 * - переносит текущие вкладки и панели
 * - подключает обработчики
*** */
function initRightPanelTabs() {
    const initialTabs = Array.from(
        rightPanelTabsMain.querySelectorAll('.rightPanelTab:not(.rightPanelTabAdd)')
    );
    const oldAddButton = rightPanelTabsMain.querySelector('.rightPanelTabAdd');
    const activeTab = initialTabs.find(tab => tab.classList.contains('active')) || initialTabs[0];
    const region = createRightPanelTabsRegion();
    const header = region.querySelector('.rightPanelTabsRegionHeader');
    const content = region.querySelector('.rightPanelTabsRegionContent');
    const addButton = header.querySelector('.rightPanelTabAdd');

    initialTabs.forEach(tab => {
        header.insertBefore(tab, addButton);

        initRightPanelTab(tab);
        initRightPanelTabDrag(tab);

        let close = tab.querySelector('.rightPanelTabClose');

        if (!close) {
            close = document.createElement('span');
            close.className = 'rightPanelTabClose';
            close.textContent = '×';

            tab.appendChild(close);
        }

        close.addEventListener('click', event => {
            event.stopPropagation();

            closeRightPanelTab(tab);
        });

        const targetTab = tab.getAttribute('right-panel-tab') || '';
        const panel = getRightPanelTabPanel(targetTab);

        if (panel) {
            panel.setAttribute('data-right-panel-content', targetTab);
            panel.style.display = 'none';

            content.appendChild(panel);
        }
    });

    if (oldAddButton) {
        oldAddButton.remove();
    }

    rightPanelTabsMain.innerHTML = '';
    rightPanelTabsMain.appendChild(region);

    rightPanelTabAdd = addButton;

    updateRightPanelTabs();
    initRightPanelBottomDrop();
    updateRightPanelAddButtons();

    if (activeTab) {
        showRightPanelRegionTab(activeTab);
    }
}

/* ***
 * handleRightPanelAddMenuClick - обработка добавления вкладки
 * - получает выбранный пункт меню
 * - добавляет вкладку в выбранную область
*** */
function handleRightPanelAddMenuClick(event) {
    const item = event.target.closest('[data-right-panel-tab]');

    if (!item) {
        return;
    }

    const targetTab = item.getAttribute('data-right-panel-tab') || '';
    const region = rightPanelTabsAddMenuTarget ||
        rightPanelTabsMain.querySelector('.rightPanelTabsRegion');

    if (!region) {
        return;
    }

    const tab = createRightPanelTab(
        targetTab,
        item.textContent.trim(),
        region
    );

    const panel = getRightPanelTabPanel(targetTab);
    const content = region.querySelector('.rightPanelTabsRegionContent');

    if (panel && content) {
        panel.setAttribute('data-right-panel-content', targetTab);
        content.appendChild(panel);
    }

    item.style.display = 'none';
    rightPanelTabsAddMenu.style.display = 'none';

    rightPanelTabsAddMenuTarget = null;

    updateRightPanelAddButtons();
    showRightPanelRegionTab(tab);
}

// Обработчик добавления вкладки
rightPanelTabsAddMenu.addEventListener('click', handleRightPanelAddMenuClick);

// Закрытие меню добавления при клике вне его
document.addEventListener('click', event => {
    if (
        !event.target.closest('.rightPanelTabAdd') &&
        !event.target.closest('#rightPanelTabsAddMenu')
    ) {
        rightPanelTabsAddMenu.style.display = 'none';
    }
});

// Инициализация вкладок правой панели
initRightPanelTabs();



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

