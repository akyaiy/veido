window.tempStore.getByRecipient = async () => [{ path: "/pages/example" }];
newLoadedBlock();
window.tempStore.getByRecipient = async () => [{ path: "/pages/test" }];
newLoadedBlock();


document.addEventListener('keydown', function(e) {
    if (e.key !== 'Enter') return;

    const editable = e.target.closest('[contenteditable="true"]');
    if (!editable) return;

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    const node = range.startContainer.nodeType === 3
        ? range.startContainer.parentElement
        : range.startContainer;

    // если внутри списка - не трогаем
    if (node.closest('li')) return;

    // ищем block, span не учитывается
    const block = node.closest('div');
    if (!block || !editable.contains(block)) return;

    e.preventDefault();

    const br = document.createElement('br');
    range.deleteContents();
    range.insertNode(br);

    range.setStartAfter(br);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);

    // проверяем последний узел в блоке
    const last = block.lastChild;
    if (last && last.nodeType === 3) { // текстовый узел
        block.appendChild(document.createElement('br'));
    }

    range.setStartAfter(br);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
});



document.querySelector('#center-panel').addEventListener('click', (e) => {
    const link = e.target.closest('a');
    if (link) {
        e.preventDefault();
    }
});

/* document.querySelector('#center-panel').addEventListener('click', (e) => {
    const table = e.target.closest('table');

    // удалить старые кнопки, если клик вне таблицы
    document.querySelectorAll('.table-controls-btn').forEach(btn => btn.remove());
    if (!table) return;

    // помечаем таблицу уникальным id
    if (!table.dataset._tcid) table.dataset._tcid = String(Math.random()).slice(2);

    table.style.position = table.style.position || 'relative';

    // кнопка справа — добавить столбец
    const btnRight = document.createElement('button');
    btnRight.textContent = '+';
    btnRight.title = 'Добавить столбец справа';
    btnRight.className = 'table-controls-btn';
    btnRight.style.position = 'absolute';
    btnRight.style.width = '16px';
    btnRight.style.height = '16px';
    btnRight.style.top = '10px';
    btnRight.style.right = '-17px';
    btnRight.style.transform = 'translateY(-50%)';
    btnRight.style.fontSize = '12px';
    btnRight.style.opacity = '0.8';
    btnRight.style.padding = '2px';
    table.appendChild(btnRight);

    // кнопка снизу — добавить строку
    const btnBottom = document.createElement('button');
    btnBottom.textContent = '+';
    btnBottom.title = 'Добавить строку снизу';
    btnBottom.className = 'table-controls-btn';
    btnBottom.style.position = 'absolute';
    btnBottom.style.right = '-7px';
    btnBottom.style.bottom = '-17px';
    btnBottom.style.transform = 'translateX(-50%)';
    btnBottom.style.width = '16px';
    btnBottom.style.height = '16px';
    btnBottom.style.fontSize = '12px';
    btnBottom.style.opacity = '0.8';
    btnBottom.style.padding = '2px';
    table.appendChild(btnBottom);

    // добавить столбец
    btnRight.addEventListener('click', ev => {
        ev.stopPropagation();
        Array.from(table.querySelectorAll('tr')).forEach(tr => {
            const td = document.createElement('td');
            td.innerHTML = '<br>';
            tr.appendChild(td);
        });
    });

    // добавить строку
    btnBottom.addEventListener('click', ev => {
        ev.stopPropagation();
        const firstRow = table.querySelector('tr');
        const cols = firstRow ? firstRow.children.length : 1;
        const tr = document.createElement('tr');
        for (let i = 0; i < cols; i++) {
            const td = document.createElement('td');
            td.innerHTML = '<br>';
            tr.appendChild(td);
        }
        const tbody = table.querySelector('tbody');
        if (tbody) tbody.appendChild(tr);
        else table.appendChild(tr);
    });

    // убрать кнопки при клике вне таблицы
    const onDocClick = ev => {
        if (!ev.target.closest('table') || ev.target.closest('.table-controls-btn') === null) {
            document.querySelectorAll('.table-controls-btn').forEach(btn => btn.remove());
            document.removeEventListener('click', onDocClick, true);
        }
    };
    document.addEventListener('click', onDocClick, true);
}); */

/***********************************************************************
 * jsTable — таблица редактора JS-кода блока.
 **********************************************************************/
const jsTable = document.getElementById('editor-js-panel');
jsTable.innerHTML = '';

// Храним введенный id без data-атрибутов на элементе
const activeIdByEl = new WeakMap();


let selectedElBorder = null;
let lastSelectedEl = null;
let isResizing = false;
let startX, startY, startWidth, startHeight;
const margin = 2; // зона границы

document.addEventListener('mousemove', e => {
    if (!selectedElBorder) return;

    const rect = selectedElBorder.getBoundingClientRect();

    if (isResizing) {
        // изменение размеров
        if (isResizing === 'width') {
            selectedElBorder.style.width = startWidth + (e.clientX - startX) + 'px';
        } else if (isResizing === 'height') {
            selectedElBorder.style.height = startHeight + (e.clientY - startY) + 'px';
        }

        // обновляем рамку на текущие размеры
        updateOutline(selectedElBorder);
        return;
    }

    // курсор на границах
    if (e.clientX >= rect.right - margin && e.clientX <= rect.right + margin) {
        document.body.style.cursor = 'e-resize';
    } else if (e.clientY >= rect.bottom - margin && e.clientY <= rect.bottom + margin) {
        document.body.style.cursor = 's-resize';
    } else {
        document.body.style.cursor = '';
    }
});

document.addEventListener('mousedown', e => {
    if (!selectedElBorder) return;

    const rect = selectedElBorder.getBoundingClientRect();
    // правая граница
    if (e.clientX >= rect.right - margin && e.clientX <= rect.right + margin) {
        isResizing = 'width';
        startX = e.clientX;
        startWidth = rect.width;
        e.preventDefault();
    }
    // нижняя граница
    else if (e.clientY >= rect.bottom - margin && e.clientY <= rect.bottom + margin) {
        isResizing = 'height';
        startY = e.clientY;
        startHeight = rect.height;
        e.preventDefault();
    }
});

document.addEventListener('mousemove', e => {
    if (!isResizing) return;

    if (isResizing === 'width') {
        selectedElBorder.style.width = startWidth + (e.clientX - startX) + 'px';
    } else if (isResizing === 'height') {
        selectedElBorder.style.height = startHeight + (e.clientY - startY) + 'px';
    }
});

document.addEventListener('mouseup', () => {
    isResizing = false;
    document.body.style.cursor = '';
});

/* document.addEventListener('dblclick', e => {
    const el = findEditableElement(e.target); // вызываем только на клике
    if (!el) {
        selectedElBorder = null;
        return;
    }

    selectedElBorder = el;
}); */




/* выделеине в view при клике по нему */
document.getElementById('loadedBlock').addEventListener('click', e => {
    const all = document.querySelectorAll('[id^="loadedBlock_"]');
    let active = null;
    for (const el of all) {
        if (!/^loadedBlock_\d+$/.test(el.id)) continue;
        if (getComputedStyle(el).display !== 'none') { active = el; break; }
    }
    if (!active) return;

    const view = document.getElementById(active.id + '_view');
    const sel = window.getSelection();
    if (!view || (sel.rangeCount && view.contains(sel.anchorNode))) return;

    const range = document.createRange();
    range.selectNodeContents(view);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);
});




/***********************************************************************
 * Элементы интерфейса вкладок CSS / JS.
 **********************************************************************/
const tabs = document.querySelectorAll('#css-js-tabs .tab');
const propertiesPanel = document.getElementById('properties-panel');
const cssPanel = document.getElementById('css-panel');
const jsPanel = document.getElementById('js-panel');
const toggleCssPanel = document.getElementById('toggle-css-panel');

/***********************************************************************
 * Элементы вкладок view / html / js центрального редактора.
 **********************************************************************/
const centerTabs = document.querySelectorAll('#center-tabs .center-tab');
const centerContent = document.getElementById('center-tab-content');
const centerPreHtml = document.getElementById('center-tab-pre-html');
const centerPreJs = document.getElementById('center-tab-pre-js');
/* const btnLoadFromView = document.getElementById('btn-load-from-view');
const btnApplyToView = document.getElementById('btn-apply-to-view'); */
const btnApplyJs = document.getElementById('btn-apply-js');

// Сохранение текста JavaScript в блок памяти происходит немедленно при редактировании пользователем JS-редактора (без выполнения).
if (centerPreJs) {
    centerPreJs.addEventListener('input', () => {
        const blockId = getActiveBlockId();
        if (!blockId) return;
        saveJsToScript(blockId);
    });
}

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
        if (cssPanel) cssPanel.style.display = 'flex';
        jsPanel.style.display = 'none';
    } else if (tabName === 'js') {
        propertiesPanel.style.display = 'none';
        if (cssPanel) cssPanel.style.display = 'none';
        jsPanel.style.display = 'flex';
        const blockId = getActiveBlockId();
        if (blockId) ensureJsPanelSelection(blockId);
    }

    // если вкладка не properties, прячем панель спец‑свойств
    if (tabName !== 'properties' && specRoot) {
        specRoot.style.display = 'none';
    }
}

function syncCssPanelVisibility() {
    const cssPanel = document.getElementById('css-panel');
    const toggle = document.getElementById('toggle-css-panel');

    if (!cssPanel || !toggle) {
        return;
    }

    cssPanel.style.display = toggle.checked ? 'flex' : 'none';
}

syncCssPanelVisibility();

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
 * Специальные свойства (рефакторинг: универсальная обработка).
 **********************************************************************/
window.selectedEl = null;
const specRoot = document.getElementById('properties-panel-spec');
const normalPanel = document.getElementById('properties-panel');

// по умолчанию скрыть панель специальных свойств
specRoot.style.display = 'none';

// --- конфигурация: какие теги считаем "специальными" ---
const EDITABLE_TAGS = new Set([
    // Базовые и структурные
    'block', 'div', 'a', 'table', 'hr', 'img', 'code',
    // Формы
    'form', 'textarea', 'input', 'select', 'option',
    // Медиа
    'figure', 'figcaption', 'video', 'audio', 'iframe',
    // Интерактив
    'button', 'details', 'summary', 'progress', 'meter'
]);

// --- Утилиты -----------------------------------------------------------------

// Переменная вне функции для хранения текущего подсвеченного элемента
window.lastHighlightedElement = null;

// Список тегов, которые не могут содержать другие элементы или текст
const ATOMIC_TAGS = new Set(['img', 'hr', 'input', 'progress', 'meter', 'video', 'audio', 'iframe', 'select']);

function findEditableElement(startNode) {
    // --- ПРОВЕРКА ДЛЯ ATOMIC TAGS (оставлена без изменений) ---
    if (startNode && startNode.nodeType === 1) {
        const startTag = startNode.tagName.toLowerCase();
        if (ATOMIC_TAGS.has(startTag) && EDITABLE_TAGS.has(startTag)) {
            if (!startNode.closest('[contenteditable="true"]')) return updateOutline(null);
            return updateOutline(startNode);
        }
    }

    if (!startNode) return updateOutline(null);

    // 1. Инициализация таргета (сразу берем родителя, если это текст)
    let target = startNode;
    let el = target.nodeType === Node.TEXT_NODE ? target.parentElement : target;

    // 2. Поиск контейнера view
    const view = el.closest('[id^="loadedBlock_"][id$="_view"]');
    if (!view) return updateOutline(null);

    // 3. --- ГИБРИДНАЯ ПРОВЕРКА ССЫЛКИ (интегрирована из contextmenu) ---
    let closestLink = el.closest('a');

    if (!closestLink) {
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0 && sel.anchorNode) {
            const nodeInside = sel.anchorNode;
            const parentInside = nodeInside.nodeType === Node.TEXT_NODE ? nodeInside.parentElement : nodeInside;
            closestLink = parentInside.closest('a');
        }
    }

    // Если ссылка найдена (любым способом) - проверяем, что она в нашем view и редактируема
    if (closestLink && view.contains(closestLink) && EDITABLE_TAGS.has('a')) {
        if (!closestLink.closest('[contenteditable="true"]')) return updateOutline(null);
        return updateOutline(closestLink);
    }

    // 4. Поиск вверх по дереву (оставлен без изменений)
    let foundUp = null;
    let upNode = el;
    while (upNode && upNode !== view) {
        if (upNode.nodeType === 1) {
            const tag = upNode.tagName.toLowerCase();
            if (EDITABLE_TAGS.has(tag)) {
                foundUp = upNode;
                break; // Мы нашли ближайший редактируемый элемент
            }
        }
        upNode = upNode.parentElement;
    }

    if (foundUp && !foundUp.closest('[contenteditable="true"]')) {
        return updateOutline(null);
    }

    return updateOutline(foundUp);
}

// Рекурсивный поиск (без изменений)
function searchDownRecursive(element) {
    if (!element || element.nodeType !== 1) return null;
    for (let child of element.children) {
        const tag = child.tagName.toLowerCase();
        if (EDITABLE_TAGS.has(tag)) return child;
        const deep = searchDownRecursive(child);
        if (deep) return deep;
    }
    return null;
}

/**
 * Вспомогательная функция для управления outline
 */
function updateOutline(element) {
    const specRoot = document.getElementById('properties-panel-spec');
    const normalPanel = document.getElementById('properties-panel');
    const root = document.getElementById('loadedBlockMain');

    // 1. Очистка старой обводки у всех элементов в рабочей области
    if (root) {
        const allWithOutline = root.querySelectorAll('[style*="outline"]');
        allWithOutline.forEach(el => {
            el.style.outline = '';
        });
    }

    // 2. Если фокус или клик внутри самой панели свойств — игнорируем, чтобы не сбросить выбор
    if (document.activeElement && document.activeElement.closest('#properties-panel-spec')) {
        return lastHighlightedElement;
    }

    // 3. Если элемент найден и он находится внутри редактируемого контейнера
    if (element && element.closest('[contenteditable="true"]')) {
        const tagName = element.tagName.toLowerCase();
        
        // Визуально выделяем элемент
        element.style.outline = '1px solid #2196F3';
        lastHighlightedElement = element;
        selectedEl = element;

        // Показываем спец-панель и скрываем стандартную
        if (specRoot) specRoot.style.display = 'block';
        if (normalPanel) normalPanel.style.display = 'none';

        if (specRoot) {
            const allFields = specRoot.querySelectorAll('[data-target]');
            
            allFields.forEach(field => {
                const targetAttr = field.getAttribute('data-target') || '';
                const targets = targetAttr.toLowerCase().split(/\s+/).map(t => t.trim());

                // Проверяем: подходит ли поле под текущий тег
                if (targets.includes(tagName) || targets.includes('all')) {
                    // Используем !important через setProperty, чтобы перебить любые другие стили
                    field.style.setProperty('display', 'block', 'important');
                } else {
                    field.style.setProperty('display', 'none', 'important');
                }
            });
        }

    } else {
        // Если кликнули в пустое место (не по редактируемому тегу)
        lastHighlightedElement = null;
        selectedEl = null;
        
        // Показать обычную панель только если вкладка properties активна
        const cssActive = document.querySelector('#css-js-tabs .tab.active');
        if (specRoot) specRoot.style.display = 'none';
        if (normalPanel) normalPanel.style.display = (cssActive && cssActive.dataset.tab === 'properties') ? 'block' : 'none';
    }

    return element;
}

// Сброс выбора: скрыть specRoot, восстановить normalPanel
function clearSelection() {
    selectedEl = null;
    const cssActiveTab = document.querySelector('#css-js-tabs .tab.active');
    if (specRoot.style.display !== 'none' && normalPanel) {
        normalPanel.style.display = (cssActiveTab && cssActiveTab.dataset.tab === 'properties') ? '' : 'none';
    }
    specRoot.style.display = 'none';
    // очистить значения контролов
    specRoot.querySelectorAll('[data-prop]').forEach(inp => {
        if (inp.type === 'checkbox') inp.checked = false;
        else if (inp.type === 'color') inp.value = '#000000';
        else inp.value = '';
    });
}

function shouldKeepSpecPanelVisible(target) {
    return Boolean(
        target &&
        target.closest &&
        (
            target.closest('#properties-panel-spec') ||
            target.closest('#rgb-picker') ||
            target.closest('.color-swatch')
        )
    );
}

// --- Слушатели для панели (делегированно) ------------------------------------

// ввод/изменение в любом контроле применяет свойство немедленно
// но для color-контролов мы управляем через собственный picker
specRoot.addEventListener('input', e => {
    if (!lastHighlightedElement) return;
    const ctrl = e.target.closest('[data-prop]');
    if (!ctrl) return;
    if (ctrl.type === 'color') return; // игнорируем, цвет устанавливается через picker
    const prop = ctrl.getAttribute('data-prop');
    const val = ctrl.type === 'checkbox' ? ctrl.checked : ctrl.value;
    applyPropToElement(lastHighlightedElement, prop, val);
});
specRoot.addEventListener('change', e => {
    if (!lastHighlightedElement) return;
    const ctrl = e.target.closest('[data-prop]');
    if (!ctrl) return;
    if (ctrl.type === 'color') return; // игнорируем color
    const prop = ctrl.getAttribute('data-prop');
    const val = ctrl.type === 'checkbox' ? ctrl.checked : ctrl.value;
    applyPropToElement(lastHighlightedElement, prop, val);
});

// --- Внешние интерфейсы: выбор элемента и отображение панели ------------------
// функция, которая вызывается извне при выборе элемента (оставлена простая)
function selectElementForEditing(el) {
    selectedEl = el;
    if (!el) { clearSelection(); return; }
    selectElementForPanels(el);
    // показать подходящие контролы (передаём сам элемент — функция учтёт тип input)
    showSpecForTarget(el);
    // заполнить контролы значениями элемента
    populateSpecialProps(el);
    syncCssPanelVisibility();
}

// экспорт/назначение - если модульная среда не используется, оставить глобально
/* window.BlockEditorSpec = {
    select: selectElementForEditing,
    clear: clearSelection,
    findEditableElement: findEditableElement
}; */




// --- Взаимодействие с loadedBlock_*_view ------------------------------------

// Левый клик - выбрать элемент (только специальные элементы), не открываем панель
/* document.addEventListener('dblclick', e => {
    const el = findEditableElement(e.target);
    if (!el) return; // игнорируем клики по тексту и обычным контейнерам
    selectedEl = el;
    populateSpecialProps(selectedEl);
}, true); */

// левый клик - открыть properties-panel-spec (скрыть обычную), показать только нужные контролы
/* document.addEventListener('dblclick', e => {
    const inSpec = !!e.target.closest('#properties-panel-spec');
    if (inSpec) return;
    const editableContainer = e.target.closest('[contenteditable="true"]');
    if (!editableContainer) return;

    const el = findEditableElement(e.target);
    const selection = window.getSelection();
    const hasTextSelection = selection && !selection.isCollapsed;

    if (el && !hasTextSelection) {
        selectedEl = el;
        const tag = el.tagName.toLowerCase();
        let target = 'all';

        // Расширяем поддержку новых тегов
        if (tag === 'img') target = 'img';
        else if (tag === 'a') target = 'a';
        else if (tag === 'input') target = 'input';
        else if (tag === 'table') target = 'table';
        else if (tag === 'block') target = 'block';
        else if (tag === 'div') target = 'div';
        else if (tag === 'video') target = 'video';
        else if (tag === 'audio') target = 'audio';
        else if (tag === 'iframe') target = 'iframe';
        else if (tag === 'details') target = 'details';
        else if (tag === 'textarea') target = 'textarea';
        else if (tag === 'button') target = 'button';
        else if (tag === 'select') target = 'select';
        else if (tag === 'form') target = 'form';
        else if (tag === 'code') target = 'code';
        else if (tag === 'hr') target = 'hr';
        // можно добавить другие, если появятся

        showSpecForTarget(el);
        populateSpecialProps(selectedEl);
        return;
    }

    // clearSelection(); // убрано, чтобы selectedEl сохранялся
}); */






/***********************************************************************
 * Элементы интерфейса управления загруженным блоком.
 **********************************************************************/
const handle = document.querySelector('.small-handle');
const loadedBlock = document.getElementById('loadedBlock');

/***********************************************************************
 * Переменные состояния перетаскивания и изменения размера блока.
 **********************************************************************/
let active = false;
let sx, sy, sw, sh;

/***********************************************************************
 * Обновление позиции handle при скролле или изменении размера блока
 **********************************************************************/
function updateHandlePosition() {
    handle.style.display = '';
    handle.style.top = loadedBlock.scrollTop + loadedBlock.clientHeight - handle.offsetHeight - 8 + 'px';
    handle.style.left = loadedBlock.scrollLeft + loadedBlock.clientWidth - handle.offsetWidth - 8 + 'px';
}

/***********************************************************************
 * handle mousedown — начало изменения размера блока
 **********************************************************************/
handle.onmousedown = e => {
    e.preventDefault();
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    sw = loadedBlock.offsetWidth;
    sh = loadedBlock.offsetHeight;

    document.onmousemove = move;
    document.onmouseup = () => {
        active = false;
        document.onmousemove = null;
        updateHandlePosition(); // после отпускания мыши корректируем позицию
    };
};

/***********************************************************************
 * move — обработчик изменения размеров блока
 **********************************************************************/
function move(e) {
    if (!active) return;

    let deltaX = e.clientX - sx;
    let deltaY = e.clientY - sy;

    loadedBlock.style.width = sw + deltaX + 'px';
    loadedBlock.style.height = sh + deltaY + 'px';

    updateHandlePosition(); // handle двигается вместе с прокруткой видимой области
}

/***********************************************************************
 * Обновление позиции при скролле блока
 **********************************************************************/
loadedBlock.addEventListener('click', updateHandlePosition);
loadedBlock.addEventListener('scroll', () => {
    handle.style.display = 'none';
});



/* меню действий */
const menuBtn = document.getElementById('tabs-menu-btn');
const tabsMenu = document.getElementById('tabs-menu');

menuBtn.addEventListener('click', () => {
    tabsMenu.style.display = tabsMenu.style.display === 'none' ? 'flex' : 'none';
});

document.addEventListener('click', (e) => {
    if (!tabsMenu.contains(e.target) && !menuBtn.contains(e.target)) {
        tabsMenu.style.display = 'none';
    }
});

/***********************************************************************
 * Кнопка вкладки "Открыть" и контейнер содержимого.
 **********************************************************************/
const tabOpen = document.getElementById('tab-open');
const content = document.getElementById('content');

/***********************************************************************
 * tabOpen onclick — обработчик клика по вкладке "Открыть":
 * - Создаёт контейнер файлового менеджера.
 * - Добавляет его в основную область контента.
 * - Устанавливает режим нижней панели для загрузки блока.
 * - Инициирует загрузку файлового менеджера.
 **********************************************************************/
tabOpen.onclick = async() => {
    let fm = document.createElement('div');
    fm.id = 'fManager';
    content.appendChild(fm);

    await tempStore.store({path: "/data/HTML/block", listTfootAct: "loadBlock", sender: "editorBlock", callbackFun: "newLoadedBlock"}, { recipient: 'fManager', ttlMs: 5000, destroyOnRead: true })
    loadBlock('plugin/fManager', 'fManager');
};

/***********************************************************************
 * Кнопка вкладки "Новая" и контейнер содержимого.
 **********************************************************************/
const tabNew = document.getElementById('tab-new');

/***********************************************************************
 * tabNew onclick — обработчик клика по вкладке "Новая":
 **********************************************************************/
tabNew.onclick = async() => {
    window.tempStore.getByRecipient = async () => [{ path: "" }];
    newLoadedBlock("");
};

/***********************************************************************
 * newLoadedBlock — загрузка и регистрация нового блока:
 * - Принимает путь к блоку.
 * - Проверяет, открыт ли блок с указанным путём, и активирует его при наличии.
 * - Создаёт новый блок с view / html / scripts контейнерами.
 * - Добавляет вкладку блока с возможностью переключения и закрытия.
 * - Загружает содержимое блока и активирует его отображение.
 **********************************************************************/
async function newLoadedBlock() {
    const viewTab = document.querySelector('#center-tabs .center-tab[data-tab="view"]');
    viewTab.click();

    const path = (await tempStore.getByRecipient("editorBlock"))?.[0]?.path || "";
    let tabs = document.getElementById('blocks-tabs');
    let container = document.getElementById('loadedBlockMain');
    if (!container) {
        container = document.createElement('div');
        container.id = 'loadedBlockMain';
        mainEl.appendChild(container);
    }

    let existingTab;
    if (path) {
        tabs.querySelectorAll('.tab').forEach(t => {
            if (t.dataset.path === path) existingTab = t;
        });
    }
    
function switchTo(blockId, tabEl) {
    tabs.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    if (tabEl) tabEl.classList.add('active');

    Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });

    // 🔑 ВАЖНО: применяем текущий режим центра
    const activeCenterTab = document.querySelector('#center-tabs .center-tab.active');
    if (!activeCenterTab) return;

    const mode = activeCenterTab.dataset.tab;
    if (mode === 'view') showView(blockId);
    if (mode === 'html') showHtml(blockId);
    if (mode === 'js') showJs(blockId);
}

    if (existingTab) {
        switchTo(existingTab.dataset.blockId, existingTab);
        return;
    }

    let num = 1;
    while (document.getElementById('loadedBlock_' + num)) num++;
    const blockId = 'loadedBlock_' + num;

    const block = document.createElement('div');
    block.id = blockId;

    const viewDiv = document.createElement('div');
    viewDiv.id = blockId + '_view';
    viewDiv.className = 'loadedBlock_view';
    viewDiv.contentEditable = 'true';
    viewDiv.addEventListener('input', () => { viewDiv.dataset.dirty = "true"; syncHtmlFromView(blockId); });

    const htmlDiv = document.createElement('div');
    htmlDiv.id = blockId + '_html';
    htmlDiv.style.display = 'none';

    const cssDiv = document.createElement('div');
    cssDiv.id = blockId + '_css';
    cssDiv.style.display = 'none';

    const scriptsDiv = document.createElement('div');
    scriptsDiv.id = blockId + '_scripts';

    const scriptText = document.createElement('script');
    scriptText.setAttribute('data-dynamic-text', blockId + '_view');
    scriptText.type = 'text/plain';
    scriptsDiv.appendChild(scriptText);

    const jsDiv = document.createElement('div');
    jsDiv.id = blockId + '_js';
    jsDiv.style.display = 'none';

    block.appendChild(viewDiv);
    block.appendChild(htmlDiv);
    block.appendChild(cssDiv);
    block.appendChild(scriptsDiv);
    block.appendChild(jsDiv);
    container.appendChild(block);

    // Наблюдатель: если загрузчик вставит <script> в scriptsDiv позже,
    try {
        const observer = new MutationObserver(mutations => {
            mutations.forEach(m => {
                m.addedNodes.forEach(n => {
                    if (!n || n.nodeType !== 1) return;
                    if (n.tagName !== 'SCRIPT') return;
                    const s = n;
                    // пропускаем служебные скрипты
                    if (s.getAttribute('data-dynamic-text') === blockId + '_view' || s.getAttribute('data-dynamic') === blockId + '_view') return;
                    try {
                        let txt = s.textContent || '';
                        if (!txt && s.src) txt = `// external: ${s.src}`;
                        scriptText.textContent = (scriptText.textContent || '') + '\n' + txt;
                    } catch (e) {}
                    try { s.parentNode && s.parentNode.removeChild(s); } catch (e) {}
                });
            });
        });
        observer.observe(scriptsDiv, { childList: true });
        scriptsDiv._beObserver = observer;
    } catch (e) {}

    const tabEl = document.createElement('div');
    tabEl.className = 'tab';
    tabEl.dataset.path = path || blockId;
    tabEl.dataset.blockId = blockId;
    tabEl.textContent = path ? (path.split('/').filter(Boolean).pop() || path) : "*new";
    tabEl.onclick = () => switchTo(blockId, tabEl);
    tabs.appendChild(tabEl);

    const closeBtn = document.createElement('span');
    closeBtn.textContent = '×';
    closeBtn.style.marginLeft = '6px';
    closeBtn.style.cursor = 'pointer';
    closeBtn.onclick = e => closeBlock(e, block, tabEl);

    tabEl.appendChild(closeBtn);

    switchTo(blockId, tabEl);

    if (path) await loadBlock(path, viewDiv.id, ["js", "html"]);
    const loadedScript = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (loadedScript) {
        scriptText.textContent = loadedScript.textContent || '';
    }
    if (path) extractContentParts(blockId);
    showJs(blockId);
    showView(blockId);
}
window.newLoadedBlock = newLoadedBlock;

/***********************************************************************
 * centerEditor — HTML/Markdown-редактор центра.
 **********************************************************************/
const centerEditor = document.getElementById('center-tab-pre-html');

/***********************************************************************
 * syncActiveBlock — синхронизация активного блока:
 * - Копирует содержимое HTML-редактора в HTML-блок.
 * - Обновляет визуальное представление блока через syncViewFromHtml.
 **********************************************************************/
function syncActiveBlock() {
    const tab = document.querySelector('#blocks-tabs .tab.active');
    if (!tab) return;

    const blockId = tab.dataset.blockId;
    const htmlEl = document.getElementById(blockId + '_html');
    if (!htmlEl) return;

    htmlEl.textContent = centerEditor.textContent;
    syncViewFromHtml(blockId);
}

/***********************************************************************
 * Асинхронная синхронизация активного блока при input, paste и keydown (Enter / Ctrl+Z / Ctrl+Y).
 **********************************************************************/
const scheduleSync = () => queueMicrotask(syncActiveBlock);
centerEditor.addEventListener('input', scheduleSync);
centerEditor.addEventListener('paste', () => {
    setTimeout(syncActiveBlock, 0);
});
centerEditor.addEventListener('keydown', e =>
    (e.key === 'Enter') &&
    queueMicrotask(syncActiveBlock)
);

/***********************************************************************
 * CenterEditor keydown — Вставка переноса строки при Enter:
 **********************************************************************/
centerEditor.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;

    // работаем только если включён contenteditable
    if (!centerEditor.isContentEditable) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    if (!e.shiftKey) {
        e.preventDefault();

        // обычный enter - вставка \n
        const textNode = document.createTextNode('\n');
        range.deleteContents();
        range.insertNode(textNode);

        // перенос курсора после \n
        range.setStartAfter(textNode);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
    } else {
        let container = range.commonAncestorContainer;
        if (container.nodeType === Node.TEXT_NODE) {
            container = container.parentElement;
        }

        if (container !== centerEditor) {
            e.preventDefault();

            // вставка узла вне текущего тега
            const exitNode = document.createTextNode('\u00A0');
            container.after(exitNode);

            // перенос курсора
            const newRange = document.createRange();
            newRange.setStart(exitNode, 0);
            newRange.collapse(true);
            sel.removeAllRanges();
            sel.addRange(newRange);
        }
    }
});




/***********************************************************************
 * Создает объект MarkdownIt с HTML, автоссылками и типографикой
 **********************************************************************/
const md = window.markdownit({ html: true, linkify: true, typographer: true });

/***********************************************************************
 * Хранит идентификатор текущего активного блока
 **********************************************************************/
let activeBlockId = null;
/***********************************************************************
 * Хранит источник последней синхронизации (например, HTML или редактор)
 **********************************************************************/
let activeSyncSource = null;

/***********************************************************************
 * logSync — Проверяет совпадение активного блока с переданным:
 * - Принимает идентификатор следующего блока и источник.
 * - Сравнивает с активным блоком.
 * - Возвращает true, если блоки совпадают.
 **********************************************************************/
function logSync(nextBlockId, nextSource) {
    const sameId = activeBlockId === nextBlockId;
    return sameId;
}

/***********************************************************************
 * syncViewFromHtml — Синхронизирует содержимое HTML-блока с редактором:
 * - Принимает идентификатор блока.
 * - Проверяет, нужно ли обновлять блок через logSync.
 * - Копирует текст из редактора в скрытый HTML и обновляет визуальный блок через Markdown.
 * - Обновляет активный блок и источник синхронизации.
 **********************************************************************/
function syncViewFromHtml(blockId) {
    activeBlockId = blockId;
    activeSyncSource = 'html';

    const canRender = logSync(blockId, 'html');

    const htmlElPre = document.getElementById('center-tab-pre-html');
    const htmlEl = document.getElementById(blockId + '_html');
    const viewEl = document.getElementById(blockId + '_view');
    if (!htmlElPre || !htmlEl || !viewEl) return;

    if (canRender) {
        let content = htmlElPre.textContent.trim();
        if (!content) content = '<div><br></div>';

        const markdownBlocks = [
            /^\s*#/,               // заголовки
            /^\s*\*\*\*.*\*\*\*/, // жирный курсив
            /^\s*\*\*.*\*\*/,     // жирный
            /^\s*\*.*\*/,         // курсив
            /^\s*-/ ,             // маркированный список
            /^\s*\d+\./,          // нумерованный список
            /^\s*>/,              // блок цитаты
            /^\s*```/,            // блок кода
            /^\s*<s>/,            // зачеркнутый
        ];

        const lines = content.split('\n');
        let prevIsMd = false;

        for (let i = 0; i < lines.length; i++) {
            const isMd = markdownBlocks.some(re => re.test(lines[i]));
            if (isMd && !prevIsMd) {
                // добавляем перенос только если предыдущий не Markdown
                lines[i] = '\n' + lines[i];
            }
            prevIsMd = isMd;
        }

        content = lines.join('\n');

        htmlEl.innerHTML = content;
        viewEl.innerHTML = md.render(content);
    }
}

/***********************************************************************
 * syncHtmlFromView — Синхронизирует HTML-блок с визуальным представлением:
 * - Принимает идентификатор блока.
 * - Проверяет, нужно ли обновлять блок через logSync.
 * - Преобразует содержимое визуального блока в смешанный HTML и обновляет HTML-блок.
 * - Обновляет активный блок и источник синхронизации.
 **********************************************************************/
function syncHtmlFromView(blockId) {
    activeBlockId = blockId;
    activeSyncSource = 'view';

    const canRender = logSync(blockId, 'view');

    const viewEl = document.getElementById(blockId + '_view');
    const htmlEl = document.getElementById(blockId + '_html');
    if (!viewEl || !htmlEl) return;

    if (canRender) {
        let mdText = htmlToMixed(viewEl.innerHTML);
        htmlEl.innerHTML = mdText;
        // also reflect changes immediately in the central HTML editor
        const centerPre = document.getElementById('center-tab-pre-html');
        if (centerPre) {
            centerPre.textContent = mdText;
            centerPre.dataset.userEdited = '0';
        }
    }
}

/***********************************************************************
 * nodeToMd — Преобразует HTML-узел в Markdown:
 * - Принимает HTML-узел.
 * - Конвертирует текстовые узлы в текст.
 * - Конвертирует элементы (заголовки, параграфы, списки, ссылки, изображения, код) в Markdown.
 * - Рекурсивно обрабатывает дочерние узлы.
 **********************************************************************/
function nodeToMd(node) {
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue;
    if (node.nodeType !== Node.ELEMENT_NODE) return '';

    const tag = node.tagName.toLowerCase();
    const children = [...node.childNodes].map(nodeToMd).join('');

    switch (tag) {
        case 'h1': return '# ' + children.trim() + '\n\n';
        case 'h2': return '## ' + children.trim() + '\n\n';
        case 'h3': return '### ' + children.trim() + '\n\n';
        case 'h4': return '#### ' + children.trim() + '\n\n';
        case 'strong':
        case 'b': return '**' + children + '**';
        case 'em':
        case 'i': return '*' + children + '*';
        case 'p': return children.trim() + '\n\n';
        case 'br': return '  \n';
        case 'ul':
            return '\n' + [...node.children]
                .map(li => '- ' + [...li.childNodes].map(nodeToMd).join('').trim())
                .join('\n') + '\n\n';
        case 'ol':
            return '\n' + [...node.children]
                .map((li, i) =>
                    (i + 1) + '. ' +
                    [...li.childNodes].map(nodeToMd).join('').trim()
                ).join('\n') + '\n\n';
        case 'a':
            return '[' + (children || node.getAttribute('href') || '') + '](' +
                   (node.getAttribute('href') || '') + ')';
        case 'img':
            return '![' + (node.getAttribute('alt') || '') + '](' +
                   (node.getAttribute('src') || '') + ')';
        case 'pre': {
            const code = node.querySelector('code');
            const txt = code ? code.textContent : node.textContent;
            return '\n```\n' + txt.replace(/^\n+|\n+$/g, '') + '\n```\n\n';
        }
        default:
            // сохранить тег целиком, если он не преобразуется в Markdown
            try {
                return node.outerHTML;
            } catch (e) {
                // если по какой-то причине outerHTML недоступен — вернуть дочерний контент
                return children;
            }
    }
}

/***********************************************************************
 * htmlToMixed — Конвертирует HTML в Markdown:
 * - Принимает HTML строку.
 * - Парсит и обрабатывает дочерние узлы через nodeToMd.
 * - Убирает лишние пустые строки.
 * - Возвращает Markdown с переносом строки.
 **********************************************************************/
function htmlToMixed(html) {
    let out = html;
    const doc = new DOMParser().parseFromString('<div>' + html + '</div>', 'text/html');
    const wrapper = doc.body.firstElementChild;
    if (!wrapper) return '\n';

    out = [...wrapper.childNodes]
        .map(nodeToMd)
        .join('')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    out = out ? out + '\n' : '\n'
    return out;
}

/**
* extractContentParts — Перемещает встроенные теги <style> и <script> из представления в блочные контейнеры
* — Сохраняет CSS в <style data-dynamic="blockId_view"> и JS в <script data-dynamic-text="blockId_view"> (только текст)
* — Удаляет исходные встроенные теги из представления, чтобы избежать автоматического выполнения
*/
function extractContentParts(blockId) {
    const viewEl = document.getElementById(blockId + '_view');
    if (!viewEl) return;

    const scriptsDiv = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
    const cssDiv = document.getElementById(blockId + '_css');
    const htmlDiv = document.getElementById(blockId + '_html');

   // собирать стили
    viewEl.querySelectorAll('style').forEach(st => {
        try {
            let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
            if (!styleEl) {
                styleEl = document.createElement('style');
                styleEl.setAttribute('data-dynamic', blockId + '_view');
                (scriptsDiv || document.head).appendChild(styleEl);
            }
            styleEl.textContent = (styleEl.textContent || '') + '\n' + (st.textContent || '');
        } catch (e) {}
        st.parentNode && st.parentNode.removeChild(st);
    });

    // готовим контейнер для скриптов 
    let textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl && scriptsDiv) {
        textEl = document.createElement('script');
        textEl.setAttribute('data-dynamic-text', blockId + '_view');
        textEl.type = 'text/plain';
        scriptsDiv.appendChild(textEl);
    }

    // также нормализуем любые скрипты, которые были помещены в scriptsDiv загрузчиком: преобразуем их в хранилище текста
    if (scriptsDiv) {
        scriptsDiv.querySelectorAll('script').forEach(s => {
            if (s.getAttribute('data-dynamic-text') === blockId + '_view' || s.getAttribute('data-dynamic') === blockId + '_view') return;
            try {
                textEl.textContent = (textEl.textContent || '') + '\n' + (s.textContent || '');
            } catch (e) {}
            s.parentNode && s.parentNode.removeChild(s);
        });
    }

    // собирать скрипты из представления
    viewEl.querySelectorAll('script').forEach(sc => {
        // пропускаем служебные скрипты
        if (sc.getAttribute('data-dynamic-text') === blockId + '_view' || sc.getAttribute('data-dynamic') === blockId + '_view') return;
        try {
            textEl.textContent = (textEl.textContent || '') + '\n' + (sc.textContent || '');
        } catch (e) {}
        sc.parentNode && sc.parentNode.removeChild(sc);
    });

    // обновляем HTML-контейнер, удаляя встроенные стили и скрипты из представления
    if (htmlDiv) htmlDiv.innerHTML = viewEl.innerHTML;

    // обновляем центральные редакторы
    const centerPre = document.getElementById('center-tab-pre-html');
    if (centerPre) centerPre.textContent = htmlToMixed(viewEl.innerHTML);
    const centerJs = document.getElementById('center-tab-pre-js');
    if (centerJs && textEl) centerJs.textContent = textEl.textContent || '';
}




/***********************************************************************
 * closeBlock — закрытие блока и очистка интерфейса:
 * - Принимает событие клика, элемент блока и вкладку.
 * - Удаляет блок и связанную с ним вкладку.
 * - Сбрасывает содержимое редакторов HTML и JS.
 * - Очищает панели CSS, атрибутов, свойств и событий.
 **********************************************************************/
function closeBlock(e, block, tabEl) {
    e.stopPropagation();
    try {
        const scriptsDiv = block ? block.querySelector('#' + block.id + '_scripts') : null;
        if (scriptsDiv && scriptsDiv._beObserver) {
            try { scriptsDiv._beObserver.disconnect(); } catch (e) {}
            scriptsDiv._beObserver = null;
        }
    } catch (e) {}

    const container = document.getElementById('loadedBlockMain');
    if (container && block) container.removeChild(block);
    if (tabEl.parentNode) tabEl.parentNode.removeChild(tabEl);

    centerPreHtml.textContent = '';
    centerPreJs.textContent = '';
    centerContent.style.display = 'none';
    document.getElementById('loadedBlock').style.display = '';

    const tagLabel = document.getElementById('tag-label');
    if (tagLabel) tagLabel.textContent = 'TAG';

    const attrId = document.getElementById('attr-id');
    const attrClass = document.getElementById('attr-class');
    if (attrId) attrId.value = '';
    if (attrClass) attrClass.value = '';

    const attrTable = document.getElementById('attributes-table');
    if (attrTable) {
        attrTable.innerHTML = '<tr><td contenteditable="true" data-placeholder="name"></td><td contenteditable="true" data-placeholder="value"></td></tr>';
    }

    const propTable = document.getElementById('properties-table');
    if (propTable) {
        propTable.innerHTML = '<tr><td contenteditable="true" data-placeholder="property"></td><td contenteditable="true" data-placeholder="value"></td></tr>';
    }

    const jsTable = document.getElementById('editor-js-panel');
    if (jsTable) {
        jsTable.querySelectorAll('td[contenteditable="true"]').forEach(td => td.textContent = '');
    }

    const cssPanel = document.getElementById('css-panel');
    const jsPanel = document.getElementById('js-panel');
    /* if (cssPanel) cssPanel.style.display = ''; */
    if (jsPanel) jsPanel.style.display = 'none';
}




/***********************************************************************
 * getActiveBlockId — определение активного блока:
 * - Проверяет активную вкладку и возвращает связанный с ней blockId.
 * - Если вкладка не найдена, ищет видимый блок в контейнере loadedBlockMain.
 * - Возвращает идентификатор активного блока или null при его отсутствии.
 **********************************************************************/
function getActiveBlockId() {
    const tab = document.querySelector('#blocks-tabs .tab.active');
    if (tab && tab.dataset.blockId) return tab.dataset.blockId;

    const container = document.getElementById('loadedBlockMain');
    if (!container) return null;

    for (const ch of container.children) {
        if (getComputedStyle(ch).display !== 'none') return ch.id;
    }
    return null;
}

/***********************************************************************
 * applyJs — применение JavaScript-кода к блоку:
 * - Принимает идентификатор блока.
 * - Получает код из JS-редактора и привязывает его к блоку.
 * - Создаёт или обновляет динамический script-элемент блока.
 * - Оборачивает код в защитную IIFE с обработкой ошибок.
 * - Выполняет обновлённый скрипт для активного блока.
 **********************************************************************/
function runJs(blockId) {
    const textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl) return;
    const content = textEl.textContent || '';
    if (!content.trim()) return;

    const prev = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    const exec = document.createElement('script');
    exec.setAttribute('data-dynamic', blockId + '_view');
    exec.type = '';
    exec.textContent = `(function(){try{${content}\nif(typeof pageInit==='function')pageInit();}catch(e){console.error('Block script error:',e);}})();`;
    const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain') || document.body;
    wrap.appendChild(exec);
    showMarkerModal('JS-код блока успешно применён!');
}
function saveJsToScript(blockId) {
    const content = centerPreJs.textContent || '';
    let textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl) {
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain');
        textEl = document.createElement('script');
        textEl.setAttribute('data-dynamic-text', blockId + '_view');
        textEl.type = 'text/plain';
        wrap.appendChild(textEl);
    }
    textEl.textContent = content;
}

/***********************************************************************
 * updateCenterControls — управление кнопками центральной панели:
 * - Принимает текущий режим отображения (view / html / js).
 * - Показывает или скрывает кнопку применения JS.
 **********************************************************************/
function updateCenterControls(mode) {
    /* btnLoadFromView.style.display = mode === 'html' ? '' : 'none';
    btnApplyToView.style.display = mode === 'html' ? '' : 'none'; */
    btnApplyJs.style.display = mode === 'js' ? '' : 'none';

    const panel = document.getElementById('center-tab-controls');

    const buttons = panel.querySelectorAll('button');
    const visible = Array.from(buttons).some(btn => btn.style.display !== 'none');

    panel.style.display = visible ? 'flex' : 'none';
}

/***********************************************************************
 * showView — показ блока в режиме визуального просмотра:
 * - Принимает идентификатор блока, который нужно отобразить.
 * - Скрывает область редактирования HTML и JS.
 * - Обновляет состояние кнопок управления в центре.
 * - Отображает только активный блок, скрывая остальные.
 **********************************************************************/
function showView(blockId) {
    centerContent.style.display = 'none';
    updateCenterControls('view');
    const container = document.getElementById('loadedBlockMain');
    if (!container) return;
    Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = '';
    document.getElementById('left-panel').style.display = 'flex';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = '';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').click();
    ensureJsPanelSelection(blockId);
}

/***********************************************************************
 * showHtml — показ блока в режиме редактирования HTML:
 * - Принимает идентификатор блока.
 * - Показывает HTML-редактор и скрывает JS-редактор.
 * - Обновляет состояние кнопок управления.
 * - Скрывает визуальный режим и отображает только активный блок.
 * - Загружает HTML блока в редактор, если пользователь ещё не редактировал код.
 **********************************************************************/
function showHtml(blockId) {
    centerContent.style.display = '';
    centerPreHtml.style.display = '';
    centerPreJs.style.display = 'none';
    updateCenterControls('html');

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';

    const htmlContainer = document.getElementById(blockId + '_html');
    centerPreHtml.textContent = htmlContainer.innerHTML;
    document.getElementById('left-panel').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="js"]').click();
}

/***********************************************************************
 * centerPreHtml input — помечает HTML-редактор как изменённый пользователем.
 **********************************************************************/
centerPreHtml.addEventListener('input', () => {
    centerPreHtml.dataset.userEdited = '1';
});

centerPreHtml.addEventListener('paste', e => {
    e.preventDefault();

    const text = e.clipboardData.getData('text/plain');

    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;

    const range = sel.getRangeAt(0);

    range.deleteContents();

    const textNode = document.createTextNode(text);
    range.insertNode(textNode);

    range.setStartAfter(textNode);
    range.collapse(true);

    sel.removeAllRanges();
    sel.addRange(range);
});

/***********************************************************************
 * showJs — отображение и подготовка JS-кода блока:
 * - Переключает интерфейс в режим редактирования JS.
 * - Извлекает JS-код блока и очищает его от служебной обёртки.
 * - Показывает JS-редактор и скрывает визуальное представление блока.
 **********************************************************************/
function ensureHandlerFunctions(code) {
    const handlerNames = new Set();
    let m;

    // find .onX = handler;
    const onAssignRe = /\.on[a-zA-Z]+\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = onAssignRe.exec(code)) !== null) {
        handlerNames.add(m[1]);
    }

    // find addEventListener(..., handler)
    const addListenerRe = /\.addEventListener\(\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = addListenerRe.exec(code)) !== null) {
        handlerNames.add(m[1]);
    }

    // собрать уже определенные функции и переменные, присвоенные функциям/стрелочным функциям
    const defined = new Set();
    const funcDefRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while ((m = funcDefRe.exec(code)) !== null) {
        defined.add(m[1]);
    }
    const varFuncRe = /(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:function\b|\()/g;
    while ((m = varFuncRe.exec(code)) !== null) {
        defined.add(m[1]);
    }

    handlerNames.forEach(name => {
        if (!defined.has(name)) {
            code += `\nfunction ${name}() {\n    // автоматически сгенерированный функция\n}\n`;
        }
    });

    return code;
}

function stripJsWrapper(code) {
    // Arrow IIFE with try/catch + optional pageInit
    let out = code
        .replace(/^\s*\(\(\)\s*=>\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*if\s*\(\s*typeof pageInit[\s\S]*?\)\s*pageInit\(\);\s*/s, '')
        .replace(/\s*}\s*catch[\s\S]*?}\s*\}\)\s*\(\s*\)\s*;?\s*$/s, '');

    // Legacy function IIFE wrapper (fallback)
    out = out
        .replace(/^\s*\(function\(\)\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*}\s*catch\s*\(e\)\s*{\s*console\.error\(\"Block script error:\",\s*e\);\s*}\s*}\)\(\);?\s*$/s, '');

    return out;
}

function showJs(blockId, highlightSearch=null) {
    centerContent.style.display = '';
    centerPreHtml.style.display = 'none';
    centerPreJs.style.display = '';
    updateCenterControls('js');

    const scriptEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    let code = scriptEl ? scriptEl.textContent : '';

    code = stripJsWrapper(code);

    code = ensureHandlerFunctions(code);

    centerPreJs.textContent = code;

    if (highlightSearch) {
        setTimeout(() => {
            highlightInJsEditor(highlightSearch, code);
        }, 0);
    }

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';
    document.getElementById('left-panel').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="js"]').click();
}

/***********************************************************************
 * centerTabs tab click — переключение режимов просмотра блока:
 * - Обрабатывает клик по вкладкам view / html / js.
 * - Делает выбранную вкладку активной.
 * - Определяет текущий активный блок.
 * - Переключает отображение блока в соответствующий режим.
 **********************************************************************/
centerTabs.forEach(tab => {
    tab.onclick = () => {
        centerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const blockId = getActiveBlockId();
        if (!blockId) return;
        if (tab.dataset.tab === 'view') showView(blockId);
        if (tab.dataset.tab === 'html') showHtml(blockId);
        if (tab.dataset.tab === 'js') showJs(blockId);
    };
});

/* btnLoadFromView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;
    htmlDiv.innerHTML = view.innerHTML;
    centerPreHtml.textContent = htmlDiv.innerHTML;
};

btnApplyToView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;

    const md = window.markdownit({ html: true, linkify: true, typographer: true });
    const rendered = centerPreHtml.textContent;

    htmlDiv.innerHTML = rendered;
    view.innerHTML = rendered;
}; */

/***********************************************************************
 * btnApplyJs onclick — применение JS-кода:
 * - Определяет активный блок.
 * - Применяет JS-код из редактора к выбранному блоку.
 **********************************************************************/
btnApplyJs.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    runJs(blockId);
};
[centerPreJs, centerPreHtml].forEach(el => {
    el.addEventListener('keydown', (e) => {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);

        if (e.key === 'Tab') {
            e.preventDefault();
            const tabNode = document.createTextNode('\t');
            range.deleteContents();
            range.insertNode(tabNode);
            range.setStartAfter(tabNode);
            range.setEndAfter(tabNode);
            sel.removeAllRanges();
            sel.addRange(range);
        }

        if (e.key === 'Enter') {
            e.preventDefault();

            // 1. Получаем ВЕСЬ текст от начала блока до курсора через Range
            const preRange = document.createRange();
            preRange.selectNodeContents(el);
            preRange.setEnd(range.startContainer, range.startOffset);
            const textBefore = preRange.toString();

            // 2. Находим отступ последней строки (табы и пробелы)
            const lines = textBefore.split('\n');
            const currentLine = lines[lines.length - 1];
            const indent = currentLine.match(/^[ \t]*/)[0];

            // 3. Проверяем, есть ли текст ПОСЛЕ курсора
            const afterRange = document.createRange();
            afterRange.selectNodeContents(el);
            afterRange.setStart(range.startContainer, range.startOffset);
            const textAfter = afterRange.toString();

            // Если после курсора ничего нет, нужен "добивочный" \n
            const isAtEnd = textAfter.length === 0;
            const insertText = '\n' + indent + (isAtEnd ? '\n' : '');

            const newNode = document.createTextNode(insertText);
            range.deleteContents();
            range.insertNode(newNode);

            // 4. Устанавливаем курсор строго после \n и indent
            // Смещение = 1 (для \n) + длина отступа
            const newOffset = 1 + indent.length;
            range.setStart(newNode, newOffset);
            range.setEnd(newNode, newOffset);

            sel.removeAllRanges();
            sel.addRange(range);
        }
    });
});




/***********************************************************************
 * Ссылка на текущий выбранный элемент в view.
 **********************************************************************/
window.currentSelectedEl = null;

/***********************************************************************
 * document click — выбор элемента в режиме view:
 * - Обрабатывает клик по элементу внутри блока просмотра.
 * - Определяет выбранный HTML-элемент для редактирования.
 * - Обновляет связанные панели (CSS, свойства, JS).
 **********************************************************************/

function getDefaultJsPanelElement(view) {
    if (!view) return null;
    const all = view.querySelectorAll('*');
    for (const el of all) {
        const tag = el.tagName.toLowerCase();
        if (tag === 'script' || tag === 'style') continue;
        return el;
    }
    return view;
}

function selectElementForPanels(el, resetPrevious = true) {
    if (!el) return;
    if (resetPrevious && lastSelectedEl && lastSelectedEl !== el) {
        delete lastSelectedEl.dataset.selectorType;
    }

    lastSelectedEl = el;
    selectedElBorder = el;

    updateCssPanel(el);
    updateTagLabel(el);
    updateJsPanel(el);
    updateJsPanelName(el);
    updatePropertiesPanel(el);
}

function ensureJsPanelSelection(blockId) {
    const view = document.getElementById(blockId + '_view');
    if (!view) return;

    if (lastSelectedEl && view.contains(lastSelectedEl)) {
        selectElementForPanels(lastSelectedEl, false);
        return;
    }

    const el = getDefaultJsPanelElement(view);
    if (el) selectElementForPanels(el);
}

document.addEventListener('click', e => {
    const clicked = e.target;

    const view = clicked.closest('[id^="loadedBlock_"][id$="_view"]');

    if (!view) {
        if (lastSelectedEl) {
            delete lastSelectedEl.dataset.selectorType;
            lastSelectedEl = null;
        }
        return;
    }

    const el =
        (lastHighlightedElement && view.contains(lastHighlightedElement) && lastHighlightedElement) ||
        /* findEditableElement(clicked) || */
        view;
    selectElementForPanels(el);
});

/***********************************************************************
 * updateTagLabel — обновление метки тега:
 * - Получает имя тега выбранного элемента.
 * - Отображает его в панели информации.
 **********************************************************************/
function updateTagLabel(el) {
    const label = document.getElementById('tag-label');
    if (!label) return;
    let name = el.tagName.toLowerCase();
    label.textContent = name;
}




/***********************************************************************
 * updateCssPanel — Обновляет панель атрибутов CSS для выбранного элемента:
 * - Принимает HTML элемент.
 * - Заполняет поля ввода ID и класса текущего элемента.
 * - Очищает и заполняет таблицу остальных атрибутов.
 * - Добавляет пустую строку для нового атрибута.
 **********************************************************************/
function updateCssPanel(el) {
    currentSelectedEl = el;
    const attrsTable = document.getElementById('attributes-table');
    if (!attrsTable) return;
    attrsTable.innerHTML = '';
    // include id and class as ordinary attributes first
    if (el.id) createAttrRow('id', el.id);
    if (el.className) createAttrRow('class', el.className);
    const names = el.getAttributeNames().filter(n => n !== 'id' && n !== 'class');
    names.forEach(name => createAttrRow(name, el.getAttribute(name) || ''));
    ensureEmptyAttrRow();
}

/***********************************************************************
 * attr-id input — Синхронизирует ввод ID с текущим элементом:
 * - Принимает событие ввода.
 * - Обновляет ID выбранного элемента или удаляет его, если пусто.
 **********************************************************************/
/* document.getElementById('attr-id')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    const v = e.target.value.trim();
    v ? currentSelectedEl.id = v : currentSelectedEl.removeAttribute('id');
});
 */
/***********************************************************************
 * attr-class input — Синхронизирует ввод класса с текущим элементом:
 * - Принимает событие ввода.
 * - Обновляет class выбранного элемента.
 **********************************************************************/
/* document.getElementById('attr-class')?.addEventListener('input', e => {
    if (!currentSelectedEl) return;
    currentSelectedEl.className = e.target.value;
}); */


/***********************************************************************
 * createAttrRow — Создает строку таблицы атрибутов элемента:
 * - Принимает имя и значение атрибута.
 * - Создает редактируемые ячейки name и value.
 * - Добавляет кнопку удаления, если атрибут задан.
 * - Вставляет строку в таблицу атрибутов.
 **********************************************************************/
function createAttrRow(name, value) {
    const attrsTable = document.getElementById('attributes-table');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');

    td1.contentEditable = 'true';
    td1.dataset.placeholder = 'name';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = 'value';

    td1.textContent = name || '';
    td2.textContent = value || '';
    td1.dataset.prev = name || '';

    tr.append(td1, td2);

    if (name || value) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = () => removeAttrRow(tr, td1);
        tr.appendChild(td3);
    }

    attrsTable.appendChild(tr);
}

/***********************************************************************
 * removeAttrRow — Удаляет строку атрибута из таблицы:
 * - Удаляет атрибут с элемента, если он был задан.
 * - Удаляет строку из таблицы.
 * - Обеспечивает наличие пустой строки для нового атрибута.
 **********************************************************************/
function removeAttrRow(tr, td1) {
    const prev = td1.dataset.prev || '';
    if (prev && currentSelectedEl) {
        currentSelectedEl.removeAttribute(prev);
    }
    tr.remove();
    ensureEmptyAttrRow();
}

/***********************************************************************
 * ensureEmptyAttrRow — Гарантирует наличие пустой строки в таблице атрибутов:
 * - Проверяет последнюю строку таблицы.
 * - Если строки нет или она не пуста, создаёт новую пустую строку.
 **********************************************************************/
function ensureEmptyAttrRow() {
    const t = document.getElementById('attributes-table');
    if (!t) return;

    const last = t.lastElementChild;
    if (
        !last ||
        last.children[0].textContent.trim() ||
        last.children[1].textContent.trim()
    ) {
        createAttrRow('', '');
    }
}

/***********************************************************************
 * attributes-table input — Обновление атрибутов элемента:
 * - Получает событие ввода.
 * - Отслеживает редактирование ячеек name и value.
 * - При изменении name удаляет старый атрибут и ставит новый.
 * - При изменении value обновляет текущий атрибут.
 * - Добавляет кнопку удаления при появлении значения.
 * - Гарантирует наличие пустой строки в конце таблицы.
 **********************************************************************/
const attrsTableElement = document.getElementById('attributes-table');

attrsTableElement?.addEventListener('input', e => {
    const td = e.target.closest('td');
    if (!td) return;

    const tr = td.parentNode;
    const nameTd = tr.children[0];
    const valTd = tr.children[1];

    const prev = nameTd.dataset.prev || '';
    const nameNow = nameTd.textContent.trim();
    const valNow = valTd.textContent;

    if (td === nameTd) {
        if (prev && prev !== nameNow && currentSelectedEl) {
            currentSelectedEl.removeAttribute(prev);
        }
        if (nameNow && currentSelectedEl) {
            if (nameNow === 'id') {
                const result = syncElementId(valNow, currentSelectedEl, [valTd]);
                if (!result.valid) return;
            } else {
                currentSelectedEl.setAttribute(nameNow, valNow);
            }
        }
        nameTd.dataset.prev = nameNow;
    } else {
        if (nameNow && currentSelectedEl) {
            if (nameNow === 'id') {
                const result = syncElementId(valNow, currentSelectedEl, [valTd]);
                if (!result.valid) return;
            } else {
                currentSelectedEl.setAttribute(nameNow, valNow);
            }
        }
    }

    // update class autocomplete if we are editing value of class attribute
    if (td === valTd && nameNow === 'class') {
        updateClassAutocomplete(td);
    }

    if ((nameNow || valNow) && tr.children.length === 2) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = () => removeAttrRow(tr, nameTd);
        tr.appendChild(td3);
    }

    if (tr === tr.parentNode.lastElementChild && nameNow) {
        ensureEmptyAttrRow();
    }
});

// show autocomplete when focusing value cell of class attribute
attrsTableElement?.addEventListener('focusin', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    const nameTd = tr.children[0];
    if (td === tr.children[1] && nameTd && nameTd.textContent.trim() === 'class') {
        prepareClassAutocomplete(td);
    }
});

/***********************************************************************
 * attributes-table blur — Обработка потери фокуса ячейки таблицы:
 * - Получает событие потери фокуса.
 * - Определяет ячейку и строку таблицы, к которой относится событие.
 * - Удаляет атрибут у элемента, если имя стало пустым.
 * - Удаляет строку таблицы, если она пустая и не последняя.
 **********************************************************************/
document.getElementById('attributes-table')?.addEventListener('blur', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    const nameTd = tr.children[0];
    const prev = nameTd.dataset.prev || '';
    const nameNow = nameTd.textContent.trim();
    if (!nameNow && prev && currentSelectedEl) currentSelectedEl.removeAttribute(prev);
    if (!nameNow && tr !== tr.parentNode.lastElementChild) {
        tr.remove();
        ensureEmptyAttrRow();
    }
}, true);


/***********************************************************************
 * getBlockIdFromEl — Определяет id блока по элементу:
 * - Принимает DOM-элемент.
 * - Поднимается по DOM вверх от переданного элемента.
 * - Ищет первый элемент с id, оканчивающимся на "_view".
 * - Возвращает id без суффикса "_view" или null, если такого элемента нет.
 **********************************************************************/
function getBlockIdFromEl(el) {
    let node = el;
    while (node) {
        if (node.id && node.id.endsWith('_view')) return node.id.replace(/_view$/, '');
        node = node.parentElement;
    }
    return null;
}

/***********************************************************************
 * updatePropertiesPanel — Обновляет панель CSS-свойств элемента:
 * - Принимает DOM-элемент.
 * - Определяет id блока и связанные динамические стили.
 * - Парсит CSS правила и сопоставляет их с элементом.
 * - Формирует список селекторов по приоритету (id, классы, тег, matched rules).
 * - Заполняет таблицу свойствами и добавляет строки для новых свойств.
 **********************************************************************/
function updatePropertiesPanel(el) {
    const table = document.getElementById('properties-table');
    if (!table) return;
    table.innerHTML = '';
    const blockId = getBlockIdFromEl(el) || getActiveBlockId() || 'loadedBlock_1';
    let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
    const css = styleEl ? styleEl.textContent : '';
    const rules = parseCssToRules(css);
    const existingMap = new Map();
    const existingOrder = [];
    rules.forEach(r => {
        if (!existingMap.has(r.selector)) {
            existingMap.set(r.selector, r.decls);
            existingOrder.push(r.selector);
        }
    });
    const matchedSet = new Set();
    rules.forEach(r => {
        try {
            if (el.matches(r.selector)) matchedSet.add(r.selector);
        } catch (e) {
            const selStripped = r.selector.replace(/::[a-zA-Z0-9\-\(\)]+/g, '').trim();
            try { if (selStripped && el.matches(selStripped)) matchedSet.add(r.selector); } catch (e2) {}
        }
    });
    const candidates = [];
    const id = el.id ? '#' + el.id : null;
    const classes = Array.from(el.classList || []);
    const tag = el.tagName.toLowerCase();
    if (id) candidates.push(id);
    classes.forEach(c => candidates.push('.' + c));
    candidates.push(tag);
    const order = [];
    existingOrder.forEach(s => { if (matchedSet.has(s) && !order.includes(s)) order.push(s); });
    candidates.forEach(s => { if (!order.includes(s)) order.push(s); });
    if (order.length === 0) order.push(buildSelector(el));
    order.forEach(sel => {
        const trSel = document.createElement('tr');
        const tdSel = document.createElement('td');
        tdSel.colSpan = 3;
        tdSel.textContent = sel;
        trSel.appendChild(tdSel);
        table.appendChild(trSel);
        const decls = existingMap.get(sel) || '';
        decls.split(';').map(v => v.trim()).filter(Boolean).forEach(line => {
            const i = line.indexOf(':');
            const p = i !== -1 ? line.slice(0, i).trim() : '';
            const v = i !== -1 ? line.slice(i + 1).trim() : '';
            createPropRow(p, v, true);
        });
        createAddPropRow();
    });

    updateSimpleFormats(el);
    updateSelectProperties(el);
}

/***********************************************************************
 * parseCssToRules — Преобразует CSS строку в массив правил:
 * - Принимает CSS строку.
 * - Разбивает её на селекторы и декларации.
 * - Для каждого селектора формирует объект {selector, decls}.
 * - Возвращает массив таких объектов.
 **********************************************************************/
function parseCssToRules(css) {
    const out = [];
    const re = /([^{]+)\{([^}]*)\}/g;
    let m;
    while ((m = re.exec(css)) !== null) {
        const selectorText = m[1].trim();
        const decls = m[2].trim();
        const selectors = selectorText.split(',').map(s => s.trim()).filter(Boolean);
        selectors.forEach(sel => out.push({ selector: sel, decls }));
    }
    return out;
}

/***********************************************************************
 * buildSelector — Создает CSS-селектор для элемента по id, классам или тегу.
 * - Принимает DOM-элемент.
 * - Возвращает селектор как строку.
 **********************************************************************/
function buildSelector(el) {
    if (el.id) return '#' + el.id;
    if (el.className) return '.' + el.className.split(' ').filter(Boolean).join('.');
    return el.tagName.toLowerCase();
}

/***********************************************************************
 * createPropRow — Создает строку свойства CSS в таблице:
 * - Принимает имя свойства, значение и флаг удаляемости.
 * - Создает редактируемые ячейки для имени и значения.
 * - Добавляет кнопку удаления, если нужно.
 * - Вставляет строку в таблицу properties-table.
 **********************************************************************/
function createPropRow(prop, val, deletable) {
    const table = document.getElementById('properties-table');
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    td1.contentEditable = 'true';
    td1.dataset.placeholder = td1.dataset.placeholder || 'property';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = td2.dataset.placeholder || 'value';
    td1.textContent = prop || '';
    td2.textContent = val || '';
    tr.append(td1, td2);
    if (deletable) {
        const td3 = document.createElement('td');
        td3.textContent = '×';
        td3.style.cursor = 'pointer';
        td3.onclick = () => {
            tr.remove();
            rebuildStyleForActive();
        };
        tr.appendChild(td3);
    }
    table.appendChild(tr);
}

/***********************************************************************
 * createAddPropRow — Добавляет пустую строку для нового свойства CSS:
 * - Проверяет, что последняя строка таблицы пустая.
 * - Создает редактируемые ячейки для имени и значения.
 * - Вставляет строку в таблицу properties-table.
 **********************************************************************/
function createAddPropRow() {
    const table = document.getElementById('properties-table');
    const last = table.lastElementChild;
    if (last && last.children.length === 2 && !last.children[0].textContent.trim() && !last.children[1].textContent.trim()) return;
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');
    td1.contentEditable = 'true';
    td1.dataset.placeholder = 'property';
    td2.contentEditable = 'true';
    td2.dataset.placeholder = 'value';
    td1.textContent = '';
    td2.textContent = '';
    tr.append(td1, td2);
    table.appendChild(tr);
}

/***********************************************************************
 * properties-table input — следит за вводом в таблице CSS-свойств:
 * - Получает объект события ввода в таблице.
 * - Берёт имя и значение свойства из этой строки таблицы.
 * - Если свойство новое, добавляет крестик для удаления.
 * - Обновляет стиль выбранного блока на странице.
 * - Всегда оставляет пустую строку для добавления следующего свойства.
 **********************************************************************/
document.getElementById('properties-table')?.addEventListener('input', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    if (tr.children.length === 2) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (prop && val) {
            if (!tr.children[2]) {
                const td3 = document.createElement('td');
                td3.textContent = '×';
                td3.style.cursor = 'pointer';
                td3.onclick = () => {
                    tr.remove();
                    rebuildStyleForActive();
                };
                tr.appendChild(td3);
            }
            ensureAddRowExists();
        }
    }
    rebuildStyleForActive();
});

/***********************************************************************
 * properties-table blur — обработка потери фокуса в таблице CSS-свойств:
 * - Получает событие потери фокуса.
 * - Проверяет имя и значение свойства в строке таблицы.
 * - Удаляет пустые строки, кроме последней.
 * - Восстанавливает плейсхолдеры для имени и значения свойства.
 **********************************************************************/
document.getElementById('properties-table')?.addEventListener('blur', e => {
    const td = e.target.closest('td');
    if (!td) return;
    const tr = td.parentNode;
    if (!tr) return;
    if (tr.children.length === 3) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (!prop && !val) {
            tr.remove();
            rebuildStyleForActive();
        }
    } else if (tr.children.length === 2) {
        const prop = tr.children[0].textContent.trim();
        const val = tr.children[1].textContent.trim();
        if (!prop && !val && tr !== tr.parentNode.lastElementChild) {
            tr.remove();
        } else {
            tr.children[0].dataset.placeholder = tr.children[0].dataset.placeholder || 'property';
            tr.children[1].dataset.placeholder = tr.children[1].dataset.placeholder || 'value';
        }
    }
}, true);

/***********************************************************************
 * ensureAddRowExists — гарантирует наличие пустой строки для нового свойства:
 * - Проверяет последнюю строку таблицы свойств.
 * - Если строки нет или она некорректная, создаёт новую пустую строку.
 * - Иначе восстанавливает плейсхолдеры для имени и значения свойства.
 **********************************************************************/
function ensureAddRowExists() {
    const table = document.getElementById('properties-table');
    const last = table.lastElementChild;
    if (!last || last.children.length !== 2) createAddPropRow();
    else {
        last.children[0].dataset.placeholder = last.children[0].dataset.placeholder || 'property';
        last.children[1].dataset.placeholder = last.children[1].dataset.placeholder || 'value';
    }
}

/***********************************************************************
 * rebuildStyleForActive — обновляет CSS для активного элемента блока:
 * - Считывает все строки таблицы свойств и формирует карту селекторов и их стилей.
 * - Сохраняет порядок существующих правил и добавляет новые.
 * - Генерирует итоговый CSS текст.
 * - Создаёт или обновляет динамический `<style>` для текущего блока.
 **********************************************************************/
function rebuildStyleForActive() {
    const table = document.getElementById('properties-table');
    if (!table) return;
    const rows = Array.from(table.children);
    const newMap = new Map();
    let currentSelector = null;
    rows.forEach(r => {
        if (r.children.length === 1 || (r.children.length === 1 && r.children[0].colSpan === 3)) {
            currentSelector = r.children[0].textContent.trim();
            if (currentSelector && !newMap.has(currentSelector)) newMap.set(currentSelector, []);
        } else if (r.children.length >= 2 && currentSelector) {
            const p = r.children[0].textContent.trim();
            const v = r.children[1].textContent.trim();
            if (p && v) newMap.get(currentSelector).push(p + ': ' + v + ';');
        }
    });
    const activeEl = currentSelectedEl;
    const blockId = getBlockIdFromEl(activeEl) || getActiveBlockId() || 'loadedBlock_1';
    let styleEl = document.querySelector('style[data-dynamic="' + blockId + '_view"]');
    let existingCss = '';
    if (styleEl) existingCss = styleEl.textContent;
    const existingRules = parseCssToRules(existingCss);
    const existingOrder = existingRules.map(r => r.selector);
    const existingMap = new Map();
    existingRules.forEach(r => {
        if (!existingMap.has(r.selector)) existingMap.set(r.selector, r.decls);
    });
    const processed = new Set();
    const out = [];
    existingOrder.forEach(sel => {
        if (newMap.has(sel)) {
            const decls = newMap.get(sel).join(' ');
            out.push(sel + ' { ' + decls + ' }');
            processed.add(sel);
        } else {
            const decls = existingMap.get(sel);
            if (decls && decls.trim()) out.push(sel + ' { ' + decls + ' }');
        }
    });
    Array.from(newMap.keys()).forEach(sel => {
        if (!processed.has(sel) && sel) {
            const decls = newMap.get(sel).join(' ');
            if (decls) out.push(sel + ' { ' + decls + ' }');
        }
    });
    const cssText = out.join('\n');
    if (!styleEl) {
        styleEl = document.createElement('style');
        styleEl.setAttribute('data-dynamic', blockId + '_view');
        const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain') || document.head;
        wrap.appendChild(styleEl);
    }
    styleEl.textContent = cssText;
}




/***********************************************************************
 * Список групп событий для элементов интерфейса.
 **********************************************************************/
const events = [
    [
        'onclick',
        'ondblclick',
        'oncontextmenu'
    ],
    [
        'oninput',
        'onchange',
        'onfocus',
        'onblur',
        'onkeydown',
        'onkeyup',
        'onkeypress'
    ],
    [
        'onmouseover',
        'onmouseout',
        'onmouseenter',
        'onmouseleave',
        'ontouchstart',
        'ontouchmove',
        'ontouchend',
        'onpointerdown',
        'onpointerup',
        'onpointermove'
    ]
];

/***********************************************************************
 * Инициализация интерфейса событий:
 * Создаем панель: слева список всех событий (select), справа кнопка (button)
 **********************************************************************/
const controlsDiv = document.createElement('div');
controlsDiv.className = 'js-panel-controls';
controlsDiv.style.display = 'flex';
controlsDiv.style.gap = '10px';
controlsDiv.style.marginBottom = '15px';

const eventSelect = document.createElement('select');
eventSelect.style.flexGrow = '1';
eventSelect.style.width = '80px';

// Заполняем выпадающий список всеми возможными событиями
events.forEach((group) => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = "Group"; // Можно стилизовать или убрать optgroup, если не нужно
    group.forEach(ev => {
        const option = document.createElement('option');
        option.value = ev;
        option.textContent = ev;
        optgroup.appendChild(option);
    });
    eventSelect.appendChild(optgroup);
});

const addBtn = document.createElement('button');
addBtn.textContent = 'Добавить';
addBtn.type = 'button';
addBtn.style.cursor = 'pointer';

controlsDiv.appendChild(eventSelect);
controlsDiv.appendChild(addBtn);

// Вставляем элементы управления перед таблицей
// Предполагается, что jsTable уже существует в DOM
jsTable.parentNode.insertBefore(controlsDiv, jsTable);

// Функция для создания одной строки таблицы
function createEventRow(eventName, handlerName = '', rawStr = null, scriptTxt = '') {
    const tr = document.createElement('tr');
    const tdEvent = document.createElement('td');
    const tdName = document.createElement('td');

    tdEvent.textContent = eventName;
    tdEvent.contentEditable = 'false';

    // клик по событию — перейти в JS с подсветкой обработчика или строки
    tdEvent.style.cursor = 'pointer';
    tdEvent.onclick = () => {
        const jsTab = document.querySelector('#center-tabs .center-tab[data-tab="js"]');
        if (jsTab) jsTab.click();
        const blockId = getActiveBlockId();
        if (!blockId) return;
        // выбираем, что подсвечивать
        let search;
        const name = tdName.textContent.trim();
        if (name) search = 'function ' + name + '(';
        else if (rawStr) search = rawStr;
        if (search) showJs(blockId, search);
    };

    tdName.contentEditable = 'true';
    tdName.dataset.placeholder = 'name';
    tdName.textContent = handlerName;

    // гарантируем, что в ячейку попадёт только текст без HTML
    tdName.addEventListener('input', () => {
        const txt = tdName.textContent;
        if (tdName.innerHTML !== txt) {
            tdName.textContent = txt;
        }
        updateJsNameAutocomplete(tdName);
    });
    tdName.addEventListener('focus', () => {
        prepareJsNameAutocomplete(tdName);
    });

    tr.appendChild(tdEvent);
    tr.appendChild(tdName);
    return tr;
}

// Autocomplete support for handler names in JS panel -------------------
const jsAutoBox = document.createElement('div');
jsAutoBox.id = 'js-autocomplete';
jsAutoBox.style.position = 'absolute';
jsAutoBox.style.background = '#fff';
jsAutoBox.style.border = '1px solid #ccc';
jsAutoBox.style.zIndex = 10000;
jsAutoBox.style.display = 'none';
jsAutoBox.style.maxHeight = '200px';
jsAutoBox.style.overflowY = 'auto';
jsAutoBox.style.overflowX = 'hidden';
jsAutoBox.style.maxWidth = '300px';
jsAutoBox.style.wordBreak = 'break-word';
jsAutoBox.style.fontSize = '12px'; // smaller text to fit viewport
// ensure box doesn't affect layout (absolute already) and hide any overflow

document.body.appendChild(jsAutoBox);

// Autocomplete support for class names when editing class attribute --------
const classAutoBox = document.createElement('div');
classAutoBox.id = 'class-autocomplete';
classAutoBox.style.position = 'absolute';
classAutoBox.style.background = '#fff';
classAutoBox.style.border = '1px solid #ccc';
classAutoBox.style.zIndex = 10000;
classAutoBox.style.display = 'none';
classAutoBox.style.maxHeight = '200px';
classAutoBox.style.overflowY = 'auto';
classAutoBox.style.overflowX = 'hidden';
classAutoBox.style.maxWidth = '300px';
classAutoBox.style.wordBreak = 'break-word';
classAutoBox.style.fontSize = '12px';

document.body.appendChild(classAutoBox);

function parseFunctionNames(code) {
    const names = new Set();
    let m;
    const funcRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while ((m = funcRe.exec(code)) !== null) names.add(m[1]);
    const varRe = /(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:function\b|\()/g;
    while ((m = varRe.exec(code)) !== null) names.add(m[1]);
    return Array.from(names).sort();
}

// --- class name autocomplete helpers --------------------------------------
function gatherClasses(blockId) {
    const view = document.getElementById(blockId + '_view');
    if (!view) return [];
    const set = new Set();
    view.querySelectorAll('[class]').forEach(el => {
        el.classList.forEach(c => set.add(c));
    });
    return Array.from(set).sort();
}

let currentClassAutoTarget = null;
function prepareClassAutocomplete(td) {
    currentClassAutoTarget = td;
    const blockId = getActiveBlockId();
    const list = blockId ? gatherClasses(blockId) : [];
    td.dataset.classNames = JSON.stringify(list);
    showClassAutocomplete(td, '');
}

function updateClassAutocomplete(td) {
    if (currentClassAutoTarget !== td) return;
    const prefix = td.value ? td.value.trim() : td.textContent.trim();
    showClassAutocomplete(td, prefix);
}

function showClassAutocomplete(td, prefix) {
    const list = JSON.parse(td.dataset.classNames || '[]');
    const filtered = prefix ? list.filter(n => n.startsWith(prefix)) : list;
    if (!filtered.length) {
        hideClassAutocomplete();
        return;
    }
    classAutoBox.innerHTML = '';
    filtered.forEach(name => {
        const div = document.createElement('div');
        div.textContent = name;
        div.style.padding = '2px 4px';
        div.style.cursor = 'pointer';
        div.addEventListener('mousedown', e => {
            e.preventDefault();
            if (currentClassAutoTarget) {
                if (currentClassAutoTarget.value !== undefined) currentClassAutoTarget.value = name;
                else currentClassAutoTarget.textContent = name;
                currentClassAutoTarget.focus();
            }
            hideClassAutocomplete();
        });
        classAutoBox.appendChild(div);
    });
    positionClassAutocomplete(td);
    classAutoBox.style.display = '';
}

function positionClassAutocomplete(td) {
    const rect = td.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY;
    const boxWidth = classAutoBox.offsetWidth || 0;
    const avail = window.innerWidth - 10;
    if (left + boxWidth > avail) {
        left = Math.max(10, avail - boxWidth);
    }
    classAutoBox.style.top = top + 'px';
    classAutoBox.style.left = left + 'px';
    if (top + classAutoBox.offsetHeight > window.innerHeight + window.scrollY) {
        classAutoBox.style.top = (rect.top + window.scrollY - classAutoBox.offsetHeight - 2) + 'px';
    }
}

function hideClassAutocomplete() {
    classAutoBox.style.display = 'none';
    currentClassAutoTarget = null;
}

let currentAutocompleteTarget = null;

function prepareJsNameAutocomplete(td) {
    currentAutocompleteTarget = td;
    const code = centerPreJs ? centerPreJs.textContent || '' : '';
    td.dataset.jsNames = JSON.stringify(parseFunctionNames(code));
    showJsAutocomplete(td, '');
}

function updateJsNameAutocomplete(td) {
    if (currentAutocompleteTarget !== td) return;
    const prefix = td.value ? td.value.trim() : td.textContent.trim();
    showJsAutocomplete(td, prefix);
}

function showJsAutocomplete(td, prefix) {
    const list = JSON.parse(td.dataset.jsNames || '[]');
    const filtered = prefix ? list.filter(n => n.startsWith(prefix)) : list;
    if (!filtered.length) {
        hideJsAutocomplete();
        return;
    }
    jsAutoBox.innerHTML = '';
    filtered.forEach(name => {
        const div = document.createElement('div');
        div.textContent = name;
        div.style.padding = '2px 4px';
        div.style.cursor = 'pointer';
        div.addEventListener('mousedown', e => {
            e.preventDefault();
            if (currentAutocompleteTarget) {
                currentAutocompleteTarget.textContent = name;
                currentAutocompleteTarget.focus();
            }
            hideJsAutocomplete();
        });
        jsAutoBox.appendChild(div);
    });
    positionJsAutocomplete(td);
    jsAutoBox.style.display = '';
}

function positionJsAutocomplete(td) {
    const rect = td.getBoundingClientRect();
    let left = rect.left + window.scrollX;
    const top = rect.bottom + window.scrollY;
    const boxWidth = jsAutoBox.offsetWidth || 0;
    const avail = window.innerWidth - 10; // 10px margin
    if (left + boxWidth > avail) {
        left = Math.max(10, avail - boxWidth);
    }
    jsAutoBox.style.top = top + 'px';
    jsAutoBox.style.left = left + 'px';
    if (top + jsAutoBox.offsetHeight > window.innerHeight + window.scrollY) {
        jsAutoBox.style.top = (rect.top + window.scrollY - jsAutoBox.offsetHeight - 2) + 'px';
    }
}

// reposition when page moves
window.addEventListener('scroll', () => {
    if (currentAutocompleteTarget && jsAutoBox.style.display !== 'none') {
        positionJsAutocomplete(currentAutocompleteTarget);
    }
});
window.addEventListener('resize', () => {
    if (currentAutocompleteTarget && jsAutoBox.style.display !== 'none') {
        positionJsAutocomplete(currentAutocompleteTarget);
    }
    if (currentClassAutoTarget && classAutoBox.style.display !== 'none') {
        positionClassAutocomplete(currentClassAutoTarget);
    }
});

// hide when clicking outside
document.addEventListener('mousedown', e => {
    if (currentAutocompleteTarget && !jsAutoBox.contains(e.target) && e.target !== currentAutocompleteTarget) {
        hideJsAutocomplete();
    }
    if (currentClassAutoTarget && !classAutoBox.contains(e.target) && e.target !== currentClassAutoTarget) {
        hideClassAutocomplete();
    }
});

function hideJsAutocomplete() {
    jsAutoBox.style.display = 'none';
    currentAutocompleteTarget = null;
}

function hideClassAutocomplete() {
    classAutoBox.style.display = 'none';
    currentClassAutoTarget = null;
}


// Логика кнопки "Добавить"
addBtn.addEventListener('click', () => {
    const selectedEv = eventSelect.value;
    
    // Проверяем, есть ли уже такое событие в таблице, чтобы не дублировать
    const existingRows = Array.from(jsTable.querySelectorAll('tr'));
    const exists = existingRows.some(tr => tr.children[0] && tr.children[0].textContent === selectedEv);

    if (!exists) {
        const tr = createEventRow(selectedEv);
        jsTable.appendChild(tr);
        // Сразу фокусируемся на поле ввода имени, чтобы пользователю было удобно печатать
        tr.children[1].focus();
    }
});

function getActiveId(el) {
    if (!el) return '';
    if (activeIdByEl.has(el)) return activeIdByEl.get(el) || '';
    return el.id || '';
}

function setActiveId(el, val) {
    if (!el) return;
    activeIdByEl.set(el, val);
}


/***********************************************************************
 * updateJsPanel — обновляет панель JS-событий для выбранного элемента:
 * - Очищает таблицу, оставляя только верхнюю панель управления.
 * - Отрисовывает ТОЛЬКО те события, которые уже назначены элементу.
 * - Поддерживает как id так и class селекторы
 **********************************************************************/
function updateJsPanel(el, updateJsPanelNameTrigger=true) {
    // Инициализируем тип селектора при первом выборе элемента
    if (!el.dataset.selectorType) {
        el.dataset.selectorType = 'id';
    }
    
    // Полностью очищаем таблицу перед обновлением
    jsTable.innerHTML = '';
    if (updateJsPanelNameTrigger) updateJsPanelName(el);

    const blockId = getBlockIdFromEl(el) || getActiveBlockId() || 'loadedBlock_1';
    const script = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!script) return;

    const txt = script.textContent;
    const entries = [];
    const selectorType = el.dataset.selectorType || 'id';

// Поиск addEventListener
    const addListenerRe = /([^\n;]+?)\.addEventListener\(\s*['"]([^'"]+)['"]\s*,\s*([A-Za-z0-9_$]+|function\b)/g;
    let m;
    while ((m = addListenerRe.exec(txt)) !== null) {
        const rawExpr = m[1].trim();
        let selector = resolveSelectorFromExpr(rawExpr, txt);
        
        // --- ИСПРАВЛЕНИЕ: Вытаскиваем селектор, если это цепочка с querySelectorAll ---
        if (!selector || selector === rawExpr || rawExpr.includes('querySelectorAll')) {
            const qsaMatch = rawExpr.match(/querySelectorAll\(\s*['"]([^'"]+)['"]\s*\)/);
            if (qsaMatch) selector = qsaMatch[1]; // Забираем '.xdfgb'
        }

        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    // Поиск прямого присваивания (onX = ...)
    const onAssignRe = /([^\n;]+?)\.on([a-zA-Z]+)\s*=\s*([A-Za-z0-9_$]+|function\b)/g;
    while ((m = onAssignRe.exec(txt)) !== null) {
        const rawExpr = m[1].trim();
        let selector = resolveSelectorFromExpr(rawExpr, txt);

        // --- ИСПРАВЛЕНИЕ: То же самое для прямого присваивания ---
        if (!selector || selector === rawExpr || rawExpr.includes('querySelectorAll')) {
            const qsaMatch = rawExpr.match(/querySelectorAll\(\s*['"]([^'"]+)['"]\s*\)/);
            if (qsaMatch) selector = qsaMatch[1]; // Забираем '.xdfgb'
        }

        entries.push({
            selector,
            event: 'on' + m[2].toLowerCase(),
            handler: m[3].startsWith('function') ? null : m[3],
            raw: m[0]
        });
    }

    // Фильтруем те, что относятся именно к выделенному DOM-элементу
    const activeValue = (selectorType === 'id' ? getActiveId(el) : el.dataset.activeClass) || '';

    const matched = entries.filter(en => {
        if (!en.selector || !activeValue) return false;
        
        // Формируем паттерн для поиска конкретного селектора (#id или .class)
        const pattern = selectorType === 'id' ? '#' + activeValue : '.' + activeValue;
        
        // Экранируем для регулярки
        const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        // Ищем вхождение именно этого класса/id (с границами слова для классов)
        const re = new RegExp('(^|[^a-zA-Z0-9_-])' + esc + '($|[^a-zA-Z0-9_-])', 'i');
        return re.test(en.selector);
    });

    const eventToSelector = new Map();

    // Отрисовываем строки ТОЛЬКО для найденных событий
    if (matched.length) {
        matched.forEach(en => {
            eventToSelector.set(en.event, en.selector);
            const tr = createEventRow(en.event, en.handler || '', en.raw, txt);
            jsTable.appendChild(tr);
        });
    }

    // Всегда обновляем слушатели blur/input, так как пользователь может добавить новое событие кнопкой
    if (jsTable.currentBlurHandler) jsTable.removeEventListener('blur', jsTable.currentBlurHandler, true);
    jsTable.currentBlurHandler = e => onJsTableBlur(e, eventToSelector, blockId, el);
    jsTable.addEventListener('blur', jsTable.currentBlurHandler, true);
    
    if (jsTable.currentInputHandler) jsTable.removeEventListener('input', jsTable.currentInputHandler);
    jsTable.currentInputHandler = e => onJsTableInput(e, eventToSelector, blockId, el);
    jsTable.addEventListener('input', jsTable.currentInputHandler);
}
function updateJsPanelName(el) {
    const typeSelect = document.getElementById('selector-type');
    const nameInputId = document.getElementById('selector-name-id');
    const nameInputClass = document.getElementById('selector-name-class');
    const classSelect = document.getElementById('selector-class');

    // 1. Синхронизируем тип
    const selectorType = el?.dataset?.selectorType || typeSelect.value || 'id';
    typeSelect.value = selectorType;

    // 2. Управляем видимостью полей
    if (selectorType === 'id') {
        nameInputId.style.display = 'block';
        nameInputClass.style.display = 'none';
        classSelect.style.display = 'none';
        
        // Если элемент нажат — берем сохраненный ID или его текущий ID
        if (el) nameInputId.value = getActiveId(el) || '';
    } else {
        nameInputId.style.display = 'none';
        nameInputClass.style.display = 'block';
        
        const classes = el?.className?.split(/\s+/).filter(c => c) || [];
        
        // Показываем селект классов ТОЛЬКО если у нажатого элемента их > 1
        if (el && classes.length > 1) {
            classSelect.style.display = 'block';
            classSelect.innerHTML = '';
            classes.forEach(cls => classSelect.add(new Option(cls, cls)));
            
            // Если в dataset нет активного класса, берем первый
            if (!el.dataset.activeClass || !classes.includes(el.dataset.activeClass)) {
                el.dataset.activeClass = classes[0];
            }
            classSelect.value = el.dataset.activeClass;
            nameInputClass.value = el.dataset.activeClass;
        } else {
            classSelect.style.display = 'none';
            if (el) {
                const singleClass = classes[0] || '';
                nameInputClass.value = singleClass;
                el.dataset.activeClass = singleClass;
            }
        }
    }

    // --- ОБРАБОТЧИКИ СОБЫТИЙ ---

    typeSelect.onchange = () => {
        if (el) el.dataset.selectorType = typeSelect.value;
        updateJsPanelName(el);
        updateJsPanel(el);
    };

    // Для ID
    nameInputId.oninput = () => {
        const val = nameInputId.value.trim();
        setActiveId(el, val);
        updateJsPanel(el, false);
    };

    // Для Class
    nameInputClass.oninput = () => {
        const val = nameInputClass.value.trim();
        if (el) el.dataset.activeClass = val;
        
        // Если пользователь начал менять текст вручную — скрываем селект (логика из п.3)
        classSelect.style.display = 'none';
        
        updateJsPanel(el, false);
    };

    // Переключение через селект
    classSelect.onchange = () => {
        const val = classSelect.value;
        nameInputClass.value = val;
        if (el) el.dataset.activeClass = val;
        updateJsPanel(el, false);
    };
}

/***********************************************************************
 * onJsTableInput — обновляет имя обработчика JS-события при редактировании:
 * - Получает объект события, карту событий-селекторов, ID блока и элемент DOM.
 * - Проверяет, что редактируется именно имя обработчика.
 * - Берёт текст события и нового обработчика.
 * - Находит селектор для события через карту или строит его.
 * - Вызывает updateScriptAssignment для сохранения изменений в скрипте.
 **********************************************************************/
function onJsTableInput(e, eventToSelectorMap, blockId, el) {
    const td = e.target.closest('td');
    if (!td || td.cellIndex !== 1) return; // Редактируем только колонку с именем (индекс 1)

    const tr = td.parentNode;
    const ev = tr.children[0].textContent.trim();
    const handler = td.textContent.trim();

    // Валидация: разрешаем пустую строку (для удаления) или корректное имя функции
    if (handler !== "" && !/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(handler)) return;

    // Определяем селектор: либо из карты, либо текущий активный (ID или выбранный класс)
    let selector = eventToSelectorMap.get(ev);
    if (!selector) {
        selector = (el.dataset.selectorType === 'id'
            ? '#' + (getActiveId(el) || '')
            : '.' + (el.dataset.activeClass || ''));
    }

    updateScriptAssignment(blockId, selector, ev, handler, el);
}

/***********************************************************************
 * onJsTableBlur — сохраняет изменения имени обработчика JS-события при потере фокуса:
 * - Получает объект события, карту событий-селекторов, ID блока и элемент DOM.
 * - Проверяет, что редактируется именно имя обработчика.
 * - Берёт текст события и нового обработчика.
 * - Находит селектор для события через карту или строит его.
 * - Вызывает updateScriptAssignment для сохранения изменений в скрипте.
 **********************************************************************/
function onJsTableBlur(e, eventToSelectorMap, blockId, el) {
    const td = e.target.closest('td');
    if (!td || td.cellIndex !== 1) return;

    const handler = td.textContent.trim();

    // Запускаем обновление (на случай если input не сработал)
    onJsTableInput(e, eventToSelectorMap, blockId, el);

    // Если значение было стерто, перерисовываем панель, чтобы пустая строка исчезла из таблицы
    if (handler === "") {
        updateJsPanel(el);
    }
}

function findFreeElNumber() {
    const els = document.querySelectorAll('[id^="el_"]');
    const nums = Array.from(els).map(el => parseInt(el.id.slice(3))).filter(n => !isNaN(n));
    let max = 0;
    nums.forEach(n => { if (n > max) max = n; });
    return max + 1;
}

/***********************************************************************
 * updateScriptAssignment — обновляет присвоение обработчика JS-события в скрипте:
 * - Получает ID блока, селектор элемента, полное имя события, имя обработчика и DOM-элемент.
 * - Находит скрипт блока и его текст.
 * - Для id селектора: document.getElementById('id').event = handler;
 * - Для class селектора: document.querySelectorAll('.class').forEach(el => el.event = handler);
 * - Удаляет старые присвоения для данного события.
 * - Если указано имя обработчика, создаёт новое присвоение и вставляет его в скрипт.
 * - Обновляет содержимое блока pre-js в интерфейсе, если он открыт для текущего блока.
 **********************************************************************/
function updateScriptAssignment(blockId, selector, eventFull, handlerName, el) {
    const scriptEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!scriptEl) return;
    let s = scriptEl.textContent;
    
    const ev = eventFull.replace(/^on/, '');
    const selectorType = el.dataset.selectorType || 'id';
    const activeVal = selectorType === 'id' ? getActiveId(el) : el.dataset.activeClass;
    if (!activeVal) return;

    let regex;
    let newLine = '';

    if (selectorType === 'id') {
        // Ищем конструкцию document.getElementById('...').onсобытие = ...;
        const escapedId = activeVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`document\\.getElementById\\(['"]${escapedId}['"]\\)\\.on${ev}\\s*=\\s*[^;\\n]+;?`, 'g');
        newLine = `document.getElementById('${activeVal}').on${ev} = ${handlerName};`;
    } else {
        // Ищем конструкцию document.querySelectorAll('....').forEach(...)
        const escapedClass = activeVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(`document\\.querySelectorAll\\(['"]\\.${escapedClass}['"]\\)\\.forEach\\(el\\s*=>\\s*el\\.on${ev}\\s*=\\s*[^)]+\\);?`, 'g');
        newLine = `document.querySelectorAll('.${activeVal}').forEach(el => el.on${ev} = ${handlerName});`;
    }

    const exists = regex.test(s);

    if (handlerName === "") {
        // УДАЛЕНИЕ: если имя пустое, просто вырезаем найденную регулярку
        s = s.replace(regex, '').replace(/\n\s*\n/g, '\n'); 
    } else {
        if (exists) {
            // ЗАМЕНА: если нашли старое, меняем на новое
            s = s.replace(regex, newLine);
        } else {
            // ДОБАВЛЕНИЕ: если не нашли, вставляем в конец IIFE
            const insertIdx = findInsertIndexBeforeClosingIIFE(s);
            const formattedLine = "\n" + newLine;
            if (insertIdx !== -1) s = s.slice(0, insertIdx) + formattedLine + s.slice(insertIdx);
            else s = s.trimEnd() + formattedLine + "\n";
        }
    }

    // Сохранение и обновление интерфейса
    scriptEl.textContent = s;
    const blockPre = document.getElementById('center-tab-pre-js');
    if (blockPre && (getActiveBlockId() === blockId)) {
        let cleanedCode = stripJsWrapper(s);
        blockPre.textContent = cleanedCode;
    }
}

/***********************************************************************
 * buildLhsCandidates — строит возможные варианты левой части присвоения для селектора:
 * - Получает селектор элемента и текст скрипта блока.
 * - Ищет переменные, которым присвоен этот элемент в коде.
 * - Добавляет прямые обращения к элементу.
 * - Возвращает массив всех найденных вариантов для использования при обновлении обработчиков.
 **********************************************************************/
function buildLhsCandidates(selector, scriptText) {
    const out = [];
    const id = selector.startsWith('#') ? selector.slice(1) : null;
    const escapedSel = escapeRegExp(id || selector);
    const varAssignRe = new RegExp('\\b(var|let|const)\\s+([A-Za-z_$][A-Za-z0-9_$]*)\\s*=\\s*document\\.(getElementById|querySelector(All)?)\\(\\s*[\'"]' + escapedSel + '[\'"]\\s*\\)', 'g');
    let mm;
    while ((mm = varAssignRe.exec(scriptText)) !== null) out.push(mm[2]);
    if (id) out.push("document.getElementById('" + id + "')");
    out.push("document.querySelector('" + selector.replace(/'/g, "\\'") + "')");
    return out;
}

/***********************************************************************
 * findInsertIndexBeforeClosingIIFE — находит место для вставки новой строки перед закрывающейся самовызывающейся функцией:
 * - Получает текст скрипта блока.
 * - Ищет ' } catch (e) {' и вставляет перед ним.
 * - Если не найдено, ищет `})();`.
 * - Если не найдено, ищет последний закрывающийся фигурный скобку `}`.
 * - Возвращает индекс для вставки новой строки кода.
 **********************************************************************/
function findInsertIndexBeforeClosingIIFE(text) {
    const catchPattern = '} catch (e) {';
    const catchIdx = text.lastIndexOf(catchPattern);
    if (catchIdx !== -1) return catchIdx;
    
    const iife = '})();';
    const idx = text.lastIndexOf(iife);
    if (idx !== -1) return idx;
    
    const lastClose = text.lastIndexOf('}');
    if (lastClose !== -1) return lastClose + 1;
    return -1;
}

/***********************************************************************
 * escapeRegExp — экранирует специальные символы для использования в RegExp:
 * - Получает строку и возвращает её с экранированными символами.
 **********************************************************************/
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/***********************************************************************
 * highlightInJsEditor — подсвечивает фрагмент кода в панели JS:
 * - Получает строку для поиска и полный текст скрипта.
 * - Находит индекс строки в тексте.
 * - Создаёт диапазон на соответствующем текстовом узле.
 * - Вставляет временный span для подсветки.
 * - Скроллит подсветку в центр видимой области.
 * - Через 800 мс убирает span, оставляя текст без изменений.
 * - Фокусируется на панели кода.
 **********************************************************************/
function highlightInJsEditor(search, fullText) {
    const pre = document.getElementById('center-tab-pre-js');
    if (!pre) return;

    const idx = fullText.indexOf(search);
    if (idx === -1) return;

    let pos = 0;
    let node;
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);

    while ((node = walker.nextNode())) {
        const next = pos + node.length;
        if (idx >= pos && idx < next) {
            const range = document.createRange();
            range.setStart(node, idx - pos);
            range.setEnd(node, Math.min(node.length, idx - pos + search.length));

            const sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);

            const span = document.createElement('span');
            range.surroundContents(span);

            span.scrollIntoView({ behavior: 'smooth', block: 'center' });

            setTimeout(() => {
                const parent = span.parentNode;
                while (span.firstChild) parent.insertBefore(span.firstChild, span);
                parent.removeChild(span);
            }, 100);

            pre.focus();
            return;
        }
        pos = next;
    }
}

/***********************************************************************
 * resolveSelectorFromExpr — определяет CSS-селектор из JS-выражения:
 * - Получает строку выражения и полный текст скрипта.
 * - Проверяет прямые обращения.
 * - Если выражение — имя переменной, ищет его присвоение через var/let/const.
 * - Возвращает CSS-селектор для использования в таблице событий.
 **********************************************************************/
function resolveSelectorFromExpr(expr, scriptText) {
    expr = expr.trim();

    const idRe = /^document\.getElementById\(\s*['"]([^'"]+)['"]\s*\)$/;
    const qsRe = /^document\.querySelector(All)?\(\s*['"]([^'"]+)['"]\s*\)$/;

    let m = idRe.exec(expr);
    if (m) return '#' + m[1];

    m = qsRe.exec(expr);
    if (m) return m[2];

    const varNameMatch = expr.match(/^[A-Za-z_$][A-Za-z0-9_$]*$/);
    if (!varNameMatch) return null;

    const varName = varNameMatch[0];

    const varAssignRe = new RegExp(
        '\\b(var|let|const)\\s+' + varName +
        '\\s*=\\s*document\\.(getElementById|querySelector(All)?)\\(\\s*[\'"]([^\'"]+)[\'"]\\s*\\)',
        'g'
    );

    let mm;
    while ((mm = varAssignRe.exec(scriptText)) !== null) {
        if (mm[2] === 'getElementById') return '#' + mm[4];
        return mm[4];
    }

    return null;
}




/* работа с текстом */
function updateSimpleFormats(el) {
    if (!el) return;
    const simple = document.getElementById('properties-simpleFormats');
    if (!simple) return;
    const btns = Array.from(simple.querySelectorAll('[simpleformats-button]'));

    btns.forEach(b => {
        const key = b.getAttribute('simpleformats-button');
        updateButtonActive(b, el, key);
        b.onclick = () => { 
            handleSimpleFormatClick(b, el, key);
            const blockId = getActiveBlockId();
            if (blockId) {
                syncHtmlFromView(blockId);
            }
        };
    });
}

function updateSelectProperties(el) {
    if (!el) return;
    const list = document.getElementById('properties-list');
    if (!list) return;
    const selects = Array.from(list.querySelectorAll('[property-item]'));

    selects.forEach(sel => {
        const prop = sel.getAttribute('property-item');

        // отдельная функция для вычисления текущего значения
        const value = getSelectValue(el, prop);

        const found = Array.from(sel.options).some(o => o.value === value);
        if (!found) {
            if (!Array.from(sel.options).some(o => o.value === '-')) {
                const dash = document.createElement('option');
                dash.value = '-';
                dash.textContent = '-';
                sel.insertBefore(dash, sel.firstChild);
            }
            sel.value = '-';
        } else sel.value = value;

        // отдельная функция для обработчика onchange
        sel.onchange = (e) => {
            const handler = createSelectChangeHandler(el, prop);
            if (handler) handler(e);
            const blockId = getActiveBlockId();
            if (blockId) {
                syncHtmlFromView(blockId);
            }
        };
    });
}

// --- вычисляет текущее значение свойства ---
function getSelectValue(el, prop) {
    switch (prop) {
        case 'font-size': return getComputedProp(el, 'fontSize');
        case 'font-family': return getComputedProp(el, 'fontFamily');
        case 'text-align': return getComputedProp(el, 'textAlign');
        case 'line-height': return getComputedProp(el, 'lineHeight');
        case 'padding': return getComputedProp(el, 'padding');
        case 'list': {
            const li = el.closest && el.closest('li');
            if (!li) return 'none';
            const parent = li.parentElement;
            if (!parent) return 'none';
            if (parent.tagName === 'OL') return 'decimal';
            if (parent.tagName === 'UL') {
                const cs = window.getComputedStyle(parent);
                return cs.listStyleType || 'disc';
            }
            return 'none';
        }
        default: return '';
    }
}

// --- вспомогательная функция: возвращает текущее значение свойства ---
function getComputedProp(el, prop) {
    if (!el && !window.getSelection) return '';

    // --- нормализация fontWeight ---
    function normalizeFontWeight(v) {
        if (!v && v !== 0) return '';
        const s = String(v).trim();
        const n = parseInt(s, 10);
        if (!isNaN(n)) return n >= 700 ? 'bold' : (n >= 400 ? 'normal' : s);
        return s === 'bolder' || s === 'bold' ? 'bold' : s;
    }

    // --- нормализация textDecoration в упорядоченную строку ---
    function normalizeTextDecorationStr(s) {
        if (!s) return '';
        const parts = String(s).split(/\s+/).map(p => p.trim()).filter(Boolean);
        const set = new Set();
        for (const p of parts) {
            if (/underline/i.test(p)) set.add('underline');
            if (/line-?through|strike|strikethrough/i.test(p)) set.add('line-through');
        }
        return Array.from(set).sort().join(' ');
    }

    // --- вычислить свойство для конкретного элемента-родителя текстового узла ---
    function computeForElement(target, propName) {
        if (!target) return '';
        const cs = window.getComputedStyle(target);

        switch (propName) {
            case 'fontWeight':
                if (target.style && target.style.fontWeight) return normalizeFontWeight(target.style.fontWeight);
                if (target.closest && target.closest('strong,b')) return 'bold';
                return normalizeFontWeight(cs.fontWeight || '');
            case 'fontStyle':
                if (target.style && target.style.fontStyle) return target.style.fontStyle;
                if (target.closest && target.closest('em,i')) return 'italic';
                return cs.fontStyle || '';
            case 'textDecoration':
                let td = (target.style && target.style.textDecoration) || cs.textDecorationLine || cs.textDecoration || '';
                if (target.closest && target.closest('u')) td = td ? td + ' underline' : 'underline';
                if (target.closest && target.closest('s, strike, del')) td = td ? td + ' line-through' : 'line-through';
                return normalizeTextDecorationStr(td);
            case 'verticalAlign':
                if (target.style && target.style.verticalAlign) return target.style.verticalAlign;
                if (target.closest && target.closest('sup')) return 'super';
                if (target.closest && target.closest('sub')) return 'sub';
                return cs.verticalAlign || '';
            case 'lineHeight': return (target.style && target.style.lineHeight) || cs.lineHeight || '';
            case 'fontSize': return (target.style && target.style.fontSize) || cs.fontSize || '';
            case 'fontFamily': return (target.style && target.style.fontFamily) || cs.fontFamily || '';
            case 'textAlign': return (target.style && target.style.textAlign) || cs.textAlign || '';
            case 'borderWidth': return (target.style && target.style.borderWidth) || cs.borderWidth || '';
            case 'padding': return (target.style && target.style.padding) || cs.padding || '';
            case 'borderColor': return (target.style && target.style.borderColor) || cs.borderColor || '';
            case 'backgroundColor': return (target.style && target.style.backgroundColor) || cs.backgroundColor || '';
            case 'color': return (target.style && target.style.color) || cs.color || '';
            case 'listStyleType': return (target.style && target.style.listStyleType) || cs.listStyleType || 'none';
            default: return '';
        }
    }

    // --- собрать текстовые узлы, которые реально входят в Range (если есть) ---
    function textNodesInRange(range) {
        const nodes = [];
        const root = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement || document.body;

        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                try {
                    if (range.intersectsNode(node)) return NodeFilter.FILTER_ACCEPT;
                } catch (e) {
                }
                return NodeFilter.FILTER_REJECT;
            }
        }, false);

        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    // --- собрать текстовые узлы внутри элемента целиком (fallback) ---
    function textNodesInElement(root) {
        const nodes = [];
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                if (!node.nodeValue) return NodeFilter.FILTER_REJECT;
                if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
                return NodeFilter.FILTER_ACCEPT;
            }
        }, false);
        while (walker.nextNode()) nodes.push(walker.currentNode);
        return nodes;
    }

    // --- определим набор текстовых узлов для проверки ---
    let nodes = [];

    // Если есть активное выделение и оно не пустое, используем его (обычно это то, что нужно при кликах на панели)
    const sel = window.getSelection && window.getSelection();
    let selRoot = null;
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        selRoot = range.commonAncestorContainer.nodeType === Node.ELEMENT_NODE
            ? range.commonAncestorContainer
            : range.commonAncestorContainer.parentElement || document.body;
        nodes = textNodesInRange(range);
    }

    // иначе если передан элемент — берём все текстовые узлы внутри него
    if (!nodes.length && el) {
        if (el.nodeType === Node.TEXT_NODE) {
            if (el.nodeValue && el.nodeValue.trim()) nodes = [el];
        } else if (el.nodeType === Node.ELEMENT_NODE || el.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            nodes = textNodesInElement(el);
        }
    }

    // Если всё ещё пусто — fallback: вычислить для самого элемента
    if (!nodes.length) {
        return computeForElement(el, prop);
    }

    // helper: map JS prop to property-item attribute in selects
    function propToSelectAttr(p) {
        switch (p) {
            case 'fontSize': return 'font-size';
            case 'fontFamily': return 'font-family';
            case 'lineHeight': return 'line-height';
            case 'padding': return 'padding';
            default: return '';
        }
    }

    // Для специальных свойств будем искать применимое значение, начиная с самого близкого к текстовому узлу
    const specialProps = new Set(['fontSize', 'fontFamily', 'lineHeight', 'padding']);

    const values = [];
    for (const tn of nodes) {
        let applied = '';
        const parent = tn.parentElement || tn.parentNode;

        if (specialProps.has(prop)) {
            // Идём по цепочке предков, начиная с ближайшего, и возвращаем первое найденное значение
            let cur = parent;
            while (cur) {
                try {
                    // сначала - inline стиль
                    if (cur.style) {
                        const v = cur.style[prop];
                        if (v && String(v).trim()) {
                            applied = String(v).trim();
                            break;
                        }
                    }

                    // затем - вычисленное значение для текущего элемента (это позволит учитывать классы и CSS)
                    const cs = window.getComputedStyle(cur);
                    const cv = cs && cs[prop];
                    if (cv && String(cv).trim() && String(cv).trim() !== 'normal') {
                        applied = String(cv).trim();
                        break;
                    }
                } catch (e) {
                }

                // не выходить за пределы выделения (если есть)
                if (selRoot && cur === selRoot) break;
                cur = cur.parentElement;
            }

            // fallback — как раньше для ближайшего элемента
            if (!applied) applied = computeForElement(parent, prop);
        } else {
            applied = computeForElement(parent, prop);
        }

        values.push((applied === null || applied === undefined) ? '' : String(applied).trim());
    }

    // Нормализуем набор значений: игнорируем пустые значения, если есть хотя бы одно непустое
    const all = values.map(v => (v === null || v === undefined) ? '' : String(v).trim());
    const nonEmpty = Array.from(new Set(all.filter(v => v !== '')));

    if (nonEmpty.length === 1) {
        const val = nonEmpty[0];
        // попытаться найти соответствующий select и добавить опцию, если нужно
        const attr = propToSelectAttr(prop);
        if (attr && typeof document !== 'undefined') {
            try {
                const selEl = document.querySelector('[property-item="' + attr + '"]');
                if (selEl && selEl.tagName === 'SELECT') {
                    let found = false;
                    for (let i = 0; i < selEl.options.length; i++) {
                        if (selEl.options[i].value === val) { found = true; break; }
                    }
                    if (!found) {
                        const opt = document.createElement('option');
                        opt.value = val;
                        opt.textContent = val;
                        selEl.appendChild(opt);
                    }
                    selEl.value = val;
                }
            } catch (e) {}
        }
        return val;
    }

    if (nonEmpty.length > 1) return '-';

    // Всё пусто — возвращаем пустую строку (По умолчанию)
    return '';
}





let savedRange = null;
let lastEditableElement = null; 

function saveSelection(editableEl) {
    if (!editableEl) return;

    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    
    const range = sel.getRangeAt(0);

    if (!editableEl.contains(range.commonAncestorContainer)) return;
    
    savedRange = range.cloneRange();
    lastEditableElement = editableEl; 
}

function restoreSelection() {
    if (!savedRange) return;
    
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(savedRange);
    
    if (lastEditableElement) {
        lastEditableElement.focus();
    }
}

function trySaveSelection() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;

    let node = sel.anchorNode;
    
    if (node && node.nodeType === Node.ELEMENT_NODE && node.closest('#rgb-picker')) {
        return;
    }
    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentElement;
    }

    const editableEl = node ? node.closest('[contenteditable="true"]') : null;

    if (editableEl) {
        saveSelection(editableEl);
    }
}

// Слушатели для сохранения позиции курсора
document.addEventListener('mouseup', trySaveSelection);
document.addEventListener('keyup', trySaveSelection);




document.getElementById('content').classList.add('editor');

document.getElementById('previewPage').addEventListener('click', () => {
    // 1. Поиск активного блока и вьюхи
    const blocks = Array.from(document.querySelectorAll('[id^="loadedBlock_"]'))
        .filter(b => /^loadedBlock_\d+$/.test(b.id));
    
    let activeBlock = null;
    for (const block of blocks) {
        if (getComputedStyle(block).display !== 'none') {
            activeBlock = block;
            break;
        }
    }

    if (!activeBlock) return;

    const view = activeBlock.querySelector('[id$="_view"]');
    const editorApp = document.getElementById('block-editor-app');
    const content = document.getElementById('content');

    if (!view || !editorApp || !content) return;

    // --- ПЕРЕХОД В ПРЕВЬЮ ---

    // Скрываем редактор, но НЕ удаляем его из DOM
    editorApp.style.display = 'none';
    content.classList.remove('editor');

    // Создаем временный контейнер для превью, чтобы не смешивать с editorApp
    const previewContainer = document.createElement('div');
    previewContainer.id = 'preview-render-area';
    
    // Переносим содержимое из view в контейнер превью
    while (view.firstChild) {
        previewContainer.appendChild(view.firstChild);
    }
    
    content.appendChild(previewContainer);

    // --- КНОПКА ВЫХОДА ---

    const backBtn = document.createElement('button');
    backBtn.innerHTML = '← Выйти из превью';
    Object.assign(backBtn.style, {
        position: 'fixed',
        top: '15px',
        right: '15px',
        zIndex: '10000',
        padding: '10px 15px',
        backgroundColor: 'rgb(255, 68, 68)',
        color: '#fff',
        fontWeight: 'bold',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        boxShadow: '0 4px 10px rgba(0,0,0,0.3)'
    });

    document.body.appendChild(backBtn);

    // --- ЛОГИКА ВОЗВРАТА ---

    backBtn.addEventListener('click', () => {
        // 1. Возвращаем элементы из превью-контейнера обратно в оригинальный view
        while (previewContainer.firstChild) {
            view.appendChild(previewContainer.firstChild);
        }

        // 2. Удаляем временный контейнер превью
        previewContainer.remove();

        // 3. Показываем редактор обратно
        editorApp.style.display = '';
        content.classList.add('editor');

        // 4. Удаляем кнопку
        backBtn.remove();
    });
});




/* работа с id элементов: синхронизация и проверка уникальности */
function syncElementId(newId, el, highlightElements) {
    if (!el) return { valid: false };

    const id = String(newId || '').trim();
    const oldId = el.id || '';

    const clearBg = () => {
        (highlightElements || []).forEach(n => {
            if (n) n.style.backgroundColor = '';
        });
    };

    const setErrorBg = () => {
        (highlightElements || []).forEach(n => {
            if (!n) return;
        
            // Ставим красный фон
            n.style.backgroundColor = '#fdd';
        
            // Добавляем разовый слушатель: как только пользователь уйдет из поля, цвет сбросится
            n.addEventListener('focusout', () => {
                n.style.backgroundColor = '';
            }, { once: true }); 
        });
    };

    // пустой id - просто удалить
    if (!id) {
        clearBg();
        if (oldId) el.removeAttribute('id');
        return { valid: true, reason: 'empty' };
    }

    // ИСПРАВЛЕНИЕ: проверка уникальности по всему document, игнорируя <style> и <script>
    let isDuplicate = false;
    try {
        // Ищем все элементы с таким ID (CSS.escape защищает от ошибок парсинга)
        const existingElements = document.querySelectorAll('[id="' + CSS.escape(id) + '"]');
        // Проверяем, есть ли среди них "настоящие" элементы (не скрипты и не стили)
        isDuplicate = Array.from(existingElements).some(
            node => node !== el && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE'
        );
    } catch(e) {
        // Запасной вариант на случай непредвиденных ошибок селектора
        const fallback = document.getElementById(id);
        isDuplicate = fallback && fallback !== el && fallback.tagName !== 'SCRIPT' && fallback.tagName !== 'STYLE';
    }

    if (isDuplicate) {
        setErrorBg();
        return { valid: false, reason: 'duplicate' };
    }

    clearBg();

    if (oldId === id) return { valid: true, reason: 'same' };

    const view = el.closest('[id^="loadedBlock_"][id$="_view"]');
    const viewId = view ? view.id : null;

    // обновить id элемента
    el.id = id;

    if (!oldId) return { valid: true, reason: 'updated' };
    if (!view) return { valid: true };

    const escOld = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // ИСПРАВЛЕНИЕ: Замена в скриптах ТОЛЬКО внутри кавычек ("oldId", 'oldId', `#oldId`)
    // Группа $1 - это кавычка, группа $2 - возможный символ решетки '#'
    const reScripts = new RegExp('([\'"`])(#?)' + escOld + '\\1', 'g');

    const dynamicScript = document.querySelector('script[data-dynamic-text="' + viewId + '"]');
    const scripts = [];
    if (dynamicScript) scripts.push(dynamicScript);

    view.querySelectorAll('script').forEach(s => {
        if (!scripts.includes(s)) scripts.push(s);
    });

    scripts.forEach(s => {
        try {
            // Подменяем, сохраняя оригинальные кавычки и решетку (если она была)
            s.textContent = s.textContent.replace(reScripts, '$1$2' + id + '$1');
        } catch (e) {}
    });

    // ИСПРАВЛЕНИЕ: Обновление атрибутов (строгие совпадения)
    // Группа $1 - начало строки или пробел, $2 - решетка, $3 - пробел или конец строки
    const reAttr = new RegExp('(^|\\s)(#?)' + escOld + '(\\s|$)', 'g');

    view.querySelectorAll('*').forEach(node => {
        // Пропускаем скрипты и стили внутри view, чтобы не повредить их логику
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
        if (!node.attributes) return;

        Array.from(node.attributes).forEach(attr => {
            if (!attr.value) return;
            // Проверяем, есть ли точное совпадение слова oldId или #oldId
            if (attr.value.match(reAttr)) {
                // Заменяем, сохраняя пробелы или решетку
                node.setAttribute(
                    attr.name,
                    attr.value.replace(reAttr, '$1$2' + id + '$3')
                );
            }
        });
    });

    return { valid: true, reason: 'updated' };
}




/* отмена и повтор действий для блоков */
const historyPanel = document.querySelector('.history-actions');
const centerPanel = document.getElementById('center-panel');
const undoBtn = historyPanel?.querySelector('[data-act="undo"]');
const redoBtn = historyPanel?.querySelector('[data-act="redo"]');

let historyData = {}; 
let currentEditor = null;
let isInternalChange = false;
let editorObserver = null;

/* Функции отмены действий */
function doUndo() {
    if (!currentEditor || isInternalChange) return;
    const id = currentEditor.id;
    const data = historyData[id];
    
    if (!data || data.index <= 0) return;

    const currentHTML = getPureHTML(currentEditor.innerHTML);
    const lastSavedHTML = getPureHTML(data.stack[data.index]);

    if (currentHTML !== lastSavedHTML) {
        saveState(currentEditor);
    }

    if (data.index > 0) {
        isInternalChange = true;
        data.index--;
        currentEditor.innerHTML = data.stack[data.index];
        setTimeout(() => { isInternalChange = false; }, 50);
    }
}

/* Функции повтора действий */
function doRedo() {
    if (!currentEditor) return;
    const data = historyData[currentEditor.id];
    if (!data || data.index >= data.stack.length - 1) return;

    isInternalChange = true;
    data.index++;
    currentEditor.innerHTML = data.stack[data.index];
    setTimeout(() => isInternalChange = false, 10);
}

/* Присвоение обработчиков событий */
undoBtn?.addEventListener('click', doUndo);
redoBtn?.addEventListener('click', doRedo);


function logStatus(id, action) {
    const data = historyData[id];
    if (!data) return;
    console.log(`[%c${action.toUpperCase()}%c] Шаг: ${data.index + 1}/${data.stack.length} | ID: ${id}`, 
        'color: #00ff00; font-weight: bold', '');
}

function saveState(editor) {
    if (!editor || isInternalChange) return;

    const id = editor.id;
    if (!id) return;
    if (!historyData[id]) historyData[id] = { stack: [], index: -1 };
    
    const data = historyData[id];
    
    // ВАЖНО: Сохраняем в стек только чистый HTML
    const currentState = getPureHTML(editor.innerHTML);

    // Если после чистки контент совпадает с верхушкой стека — ничего не делаем
    if (data.stack[data.index] === currentState) return;

    data.stack = data.stack.slice(0, data.index + 1);
    data.stack.push(currentState);
    data.index++;
    
    if (data.stack.length > 50) {
        data.stack.shift();
        data.index--;
    }
    /* logStatus(id, "Save"); */
}

// Фильтрация изменений: игнорируем только текст и outline
function setupEditorObserver(editor) {
    if (editorObserver) editorObserver.disconnect();
    
    editorObserver = new MutationObserver((mutations) => {
        if (isInternalChange) return;
        
        let shouldSave = false;
        for (const m of mutations) {
            // Если изменился атрибут style, проверяем, не outline ли это
            if (m.type === 'attributes' && m.attributeName === 'style') {
                // Если в стилях изменился только outline — игнорируем
                const oldStyle = m.oldValue || "";
                const newStyle = editor.getAttribute('style') || "";
                if (oldStyle.replace(/outline:[^;]+;?/, '') !== newStyle.replace(/outline:[^;]+;?/, '')) {
                    shouldSave = true;
                    break;
                }
            } 
            // Если добавились/удалились теги (<b>, <i>, <div> и т.д.)
            else if (m.type === 'childList') {
                shouldSave = true;
                break;
            }
        }
        
        if (shouldSave) {
            saveState(editor);
        }
    });

    editorObserver.observe(editor, {
        childList: true, subtree: true, attributes: true, attributeOldValue: true, characterData: false 
    });
}

function showHistoryPanel(editor) {
    const id = editor.id || "";
    const isValid = (id.startsWith('loadedBlock_') && id.endsWith('_view')) || 
                    ['center-tab-pre-html', 'center-tab-pre-js'].includes(id);

    if (!isValid || !historyPanel || !centerPanel) return;
    
    if (currentEditor !== editor) {
        currentEditor = editor;
        setupEditorObserver(editor);
    }

    /* if (historyPanel.parentNode !== centerPanel) centerPanel.appendChild(historyPanel);
    historyPanel.style.display = 'flex'; */

    if (!historyData[id]) {
        historyData[id] = { stack: [editor.innerHTML], index: 0 };
    }
}

const getPureHTML = (html) => {
    return html
        .replace(/&nbsp;/g, ' ') 
        // 1. Убираем только outline, не трогая остальные стили
        .replace(/outline:[^;]+;?/g, '')
        // 2. Убираем пробел перед закрывающей кавычкой стиля: "width: 10px; " -> "width: 10px;"
        .replace(/;\s+"/g, ';"')
        // 3. Убираем лишние пробелы ТОЛЬКО внутри тегов (между атрибутами)
        // Ищет пробелы, за которыми следует символ, но всё это внутри <>
        .replace(/(<[^>]+)\s{2,}([^>]*>)/g, '$1 $2')
        // 4. Убираем пробелы перед закрытием тега: <div > -> <div>
        .replace(/\s+>/g, '>')
        .trim();
};

// Логика записи текста: только по спецсимволам
document.addEventListener('input', (e) => {
    if (e.target !== currentEditor || isInternalChange) return;

    const data = historyData[currentEditor.id];
    if (data && data.index < data.stack.length - 1) {
        data.stack = data.stack.slice(0, data.index + 1);
    }

    const triggers = [' ', '.', ',', '!', '?', ';', ':', '(', ')', '"', "'", '/', '\\'];
    const isTrigger = e.data && triggers.includes(e.data);
    const isSpecialKey = e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak';

    if (isTrigger || isSpecialKey) {
        saveState(currentEditor);
    }
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && currentEditor && !isInternalChange) {
        saveState(currentEditor);
    }

    const isMod = e.ctrlKey || e.metaKey;
    if (isMod && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        e.shiftKey ? doRedo() : doUndo();
    }
    if (isMod && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        doRedo();
    }
});

document.addEventListener('mousedown', (e) => {
    const target = e.target.closest('[contenteditable="true"]');
    if (target) showHistoryPanel(target);
}, true);

document.addEventListener('focusin', (e) => {
    if (e.target.contentEditable === "true") showHistoryPanel(e.target);
}, true);

let lastCursorOffset = 0; 
let lastContentLen = 0;

document.addEventListener('selectionchange', () => {
    if (!currentEditor || isInternalChange) return;

    const selection = window.getSelection();
    if (selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const container = range.commonAncestorContainer;
        
        // Проверяем, что работаем внутри активного редактора
        if (currentEditor.contains(container)) {
            const id = currentEditor.id;
            const data = historyData[id];
            if (!data || !data.stack) return;

            const currentHTML = getPureHTML(currentEditor.innerHTML);
            const lastSavedHTML = data.stack[data.index] || "";
            
            // Считаем длину чистого текста (без тегов) и берем позицию курсора
            const currentLen = currentHTML.replace(/<[^>]*>/g, '').length;
            const currentOffset = range.startOffset;

            // 1. Если текущий контент реально отличается от последней записи в истории
            if (currentHTML !== lastSavedHTML) {
                
                // 2. Проверяем на "нормальный набор": 
                // Длина строки выросла на 1 И курсор сместился ровно на 1 вперед
                const isNormalTyping = (currentLen === lastContentLen + 1) && (currentOffset === lastCursorOffset + 1);
                
                // Если это прыжок курсора, вставка или удаление — сохраняем "хвост"
                if (!isNormalTyping) {
                    saveState(currentEditor);
                }
            }

            // Обновляем метки для следующей проверки
            lastContentLen = currentLen;
            lastCursorOffset = currentOffset;
        }
    }
});