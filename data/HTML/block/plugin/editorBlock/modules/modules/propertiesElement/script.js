/* ===
 * Основная часть панели свойств
=== */

// Карта соответствия полей ввода (data-prop) и реальных CSS-свойств / атрибутов
const propertyMap = {
    // Общие стили
    widthValue: { type: 'style', cssName: 'width', isNumeric: true },
    heightValue: { type: 'style', cssName: 'height', isNumeric: true },
    backgroundColor: { type: 'style', cssName: 'backgroundColor', isColor: true },
    color: { type: 'style', cssName: 'color', isColor: true },
    fontSize: { type: 'style', cssName: 'fontSize', isNumeric: true },
    textAlign: { type: 'style', cssName: 'textAlign' },
    paddingTop: { type: 'style', cssName: 'paddingTop', isNumeric: true },
    paddingRight: { type: 'style', cssName: 'paddingRight', isNumeric: true },
    paddingBottom: { type: 'style', cssName: 'paddingBottom', isNumeric: true },
    paddingLeft: { type: 'style', cssName: 'paddingLeft', isNumeric: true },
    marginTop: { type: 'style', cssName: 'marginTop', isNumeric: true },
    marginRight: { type: 'style', cssName: 'marginRight', isNumeric: true },
    marginBottom: { type: 'style', cssName: 'marginBottom', isNumeric: true },
    marginLeft: { type: 'style', cssName: 'marginLeft', isNumeric: true },
    opacity: { type: 'style', cssName: 'opacity' },
    borderWidth: { type: 'style', cssName: 'borderWidth', isNumeric: true },
    borderStyle: { type: 'style', cssName: 'borderStyle' },
    borderColor: { type: 'style', cssName: 'borderColor', isColor: true },
    borderRadius: { type: 'style', cssName: 'borderRadius', isNumeric: true },
    cursor: { type: 'style', cssName: 'cursor' },
    zIndex: { type: 'style', cssName: 'zIndex' },
    display: { type: 'style', cssName: 'display' },
    gridDirection: { type: 'special', action: 'gridDirection' },
    gridTemplateCount: { type: 'special', action: 'gridTemplate', part: 'count' },
    gridTemplateSize: { type: 'special', action: 'gridTemplate', part: 'size' },
    gridColumn: { type: 'style', cssName: 'gridColumn' },
    gridRow: { type: 'style', cssName: 'gridRow' },
    resize: { type: 'style', cssName: 'resize' },

    // Атрибуты
    id: { type: 'attr', attrName: 'id' },
    'data-block-src': { type: 'attr', attrName: 'data-block-src' },
    link: { type: 'attr', attrName: 'universalLink' },
    inputPlaceholder: { type: 'attr', attrName: 'placeholder', tag: 'input' },
    inputType: { type: 'attr', attrName: 'type', tag: 'input' },
    inputRequired: { type: 'attr', attrName: 'required', tag: 'input', isBoolean: true },
    formMethod: { type: 'attr', attrName: 'method', tag: 'form' },
    formAction: { type: 'attr', attrName: 'action', tag: 'form' },
    videoPoster: { type: 'attr', attrName: 'poster', tag: 'video' },
    buttonType: { type: 'attr', attrName: 'type', tag: 'button' },
    detailsOpen: { type: 'attr', attrName: 'open', tag: 'details', isBoolean: true },
    rangeMin: { type: 'attr', attrName: 'min', tag: 'input' },
    rangeMax: { type: 'attr', attrName: 'max', tag: 'input' },
    rangeValue: { type: 'attr', attrName: 'value', tag: 'input' },
    progressValue: { type: 'attr', attrName: 'value', tag: 'progress' },
    fileAccept: { type: 'attr', attrName: 'accept', tag: 'input' },
    fileMultiple: { type: 'attr', attrName: 'multiple', tag: 'input', isBoolean: true },

    // Специальные обработчики
    tableRows: { type: 'special', action: 'tableDimensions' },
    tableCols: { type: 'special', action: 'tableDimensions' }
};

/* ***
 * updatePropertiesPanel - синхронизирует значения полей ввода и видимость блоков с выбранным элементом
 * принимает выбранный HTML-элемент
*** */
function updatePropertiesPanel(element) {
    const controls = document.getElementById('editorBlock').querySelectorAll('[data-prop]');
    const targets = document.getElementById('editorBlock').querySelectorAll('[data-target]');

    // безопасный сброс полей при отсутствии элемента
    if (!element) {
        controls.forEach(ctrl => {
            if (ctrl.type === 'checkbox') {
                ctrl.checked = false;
            } else if (ctrl.type === 'color') {
                ctrl.value = '#000000'; // пишем черный цвет вместо пустоты
            } else {
                ctrl.value = '';
            }
        });
        targets.forEach(target => target.style.display = 'none');
        return;
    }

    const tagName = element.tagName.toLowerCase();
    const inputType = tagName === 'input' ? (element.getAttribute('type') || 'text').toLowerCase() : '';

    // получаем итоговые стили элемента из css правил
    const elementWindow = element && element.ownerDocument && element.ownerDocument.defaultView
        ? element.ownerDocument.defaultView
        : window;
    const computedStyles = elementWindow.getComputedStyle(element);
    const isGrid = computedStyles.display === 'grid';
    const parentElement = element.parentElement;
    const parentWindow = parentElement && parentElement.ownerDocument && parentElement.ownerDocument.defaultView
        ? parentElement.ownerDocument.defaultView
        : elementWindow;
    const isGridItem = !!(parentElement && parentWindow.getComputedStyle(parentElement).display === 'grid');

    // функция перевода rgb в hex
    const rgbToHex = (rgbStr) => {
        if (!rgbStr) return '';
        const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/i);
        if (!match) return rgbStr;
        
        const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
        return `#${r}${g}${b}`.toLowerCase();
    };

    // обновление значений контролов
    controls.forEach(ctrl => {
        const prop = ctrl.getAttribute('data-prop');
        const config = propertyMap[prop];

        if (!config) {
            return;
        }

        let finalValue = '';

        if (config.type === 'style') {
            // читаем стиль из тега или берем вычисленный из css
            let val = element.style[config.cssName] || '';
            if (!val) {
                val = computedStyles[config.cssName] || '';
            }

            finalValue = config.isNumeric ? val.replace('px', '') : val;
            
            // конвертируем цвет если нужно
            if (config.isColor) {
                finalValue = rgbToHex(finalValue);
            }
        } else if (config.type === 'attr') {
            let attrName = config.attrName;

            if (prop === 'link') {
                attrName = ['img', 'iframe', 'video', 'audio'].includes(tagName) ? 'src' : 'href';
            }

            if (config.isBoolean) {
                ctrl.checked = element.hasAttribute(attrName);
                return; // прерываем обработку чекбокса
            } else if (attrName === 'value') {
                finalValue = element.value || '';
            } else {
                finalValue = element.getAttribute(attrName) || '';
            }
        } else if (config.type === 'special' && config.action === 'gridDirection') {
            finalValue = element.style.getPropertyValue('grid-template-rows')
                ? 'grid-template-rows'
                : 'grid-template-columns';
        } else if (config.type === 'special' && config.action === 'gridTemplate') {
            const gridProperty = element.style.getPropertyValue('grid-template-rows')
                ? 'grid-template-rows'
                : 'grid-template-columns';
            const gridTemplate = element.style.getPropertyValue(gridProperty)
                || computedStyles.getPropertyValue(gridProperty)
                || '';
            const match = gridTemplate.match(/repeat\(\s*(\d+)\s*,\s*([^\)]+)\)/i);
            if (match) {
                finalValue = config.part === 'count' ? match[1] : match[2].trim();
            }
        } else if (config.type === 'special' && config.action === 'tableDimensions' && tagName === 'table') {
            if (prop === 'tableRows') {
                finalValue = element.querySelectorAll('tr').length;
            } else if (prop === 'tableCols') {
                const firstRow = element.querySelector('tr');
                finalValue = firstRow ? firstRow.children.length : 1;
            }
        }

        // проверка цвета перед записью в инпут
        if (ctrl.type === 'color') {
            const cleaned = String(finalValue).trim().toLowerCase();
            const isHexColor = /^#[0-9a-fA-F]{6}$/.test(cleaned);
            
            if (isHexColor) {
                ctrl.value = cleaned;
            } else {
                ctrl.value = '#000000'; // защита от падения браузера
            }
        } else {
            ctrl.value = finalValue;
        }
    });

    // фильтрация видимости контейнеров
    targets.forEach(container => {
        const targetValue = container.getAttribute('data-target');

        if (targetValue === 'all') {
            container.style.display = '';
            return;
        }

        const keys = targetValue.split(' ').map(k => k.trim().toLowerCase());
        let isVisible = false;

        for (const key of keys) {
            if (key === tagName) {
                isVisible = true;
                break;
            }
            if (key.startsWith('input:') && tagName === 'input' && key.split(':')[1] === inputType) {
                isVisible = true;
                break;
            }
            if (key === 'text' && ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'i', 'strong', 'em'].includes(tagName)) {
                isVisible = true;
                break;
            }
            // добавляем проверку для ссылок
            if (key === 'link' && tagName === 'a') {
                isVisible = true;
                break;
            }
            if (key === 'grid' && isGrid) {
                isVisible = true;
                break;
            }
            if (key === 'grid-item' && isGridItem) {
                isVisible = true;
                break;
            }
            if (key === 'block' && ['div', 'section', 'header', 'footer', 'aside', 'main', 'article', 'nav', 'form', 'table'].includes(tagName)) {
                isVisible = true;
                break;
            }
        }

        container.style.display = isVisible ? '' : 'none';
    });
}

// Подписываемся на событие выбора напрямую в документе
document.addEventListener('editorBlock:elementSelected', event => {
    updatePropertiesPanel(event.detail);
});

/* ***
 * initPropertiesTabs - инициализация вкладок панели свойств 
 * - добавляет обработчики клика на кнопки вкладок
 * - переключает активные классы и отображение контента
*** */
function initPropertiesTabs() {
    const buttons = document.querySelectorAll('.propertiesTabBtn');
    const contents = document.querySelectorAll('.propertiesTabContent');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            buttons.forEach(b => b.classList.remove('active'));
            contents.forEach(c => c.classList.remove('active'));

            btn.classList.add('active');
            const targetId = btn.getAttribute('data-tab');
            document.getElementById(targetId)?.classList.add('active');
        });
    });
}

// Вызов функции
initPropertiesTabs();



/* ===
 * Вспомогательные функции
=== */

/* ***
 * dashedToCamel - преобразование строки из kebab-case в camelCase
 * - принимает строку с дефисами
 * - возвращает строку в camelCase
*** */
function dashedToCamel(string) {
    if (!string) {
        return '';
    }

    return string.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

/* ***
 * normalizeColorString - нормализация цветовой строки в hex
 * - принимает строку цвета (hex, rgb, rgba)
 * - возвращает строку в формате #rrggbb
*** */
function normalizeColorString(colorValue) {
    if (!colorValue) {
        return '#000000';
    }

    const value = String(colorValue).trim();
    const hexMatch = value.match(/^#([0-9a-fA-F]{6})$/);
    if (hexMatch) {
        return '#' + hexMatch[1].toLowerCase();
    }

    const shortHexMatch = value.match(/^#([0-9a-fA-F]{3})$/);
    if (shortHexMatch) {
        return '#' + shortHexMatch[1].split('').map(ch => ch + ch).join('').toLowerCase();
    }

    const rgbMatch = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i);
    if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);

        if ([r, g, b].every(n => !Number.isNaN(n) && n >= 0 && n <= 255)) {
            return '#' + [r, g, b].map(n => n.toString(16).padStart(2, '0')).join('').toLowerCase();
        }
    }

    return '#000000';
}

/* ***
 * checkIsNumericString - проверка строки на числовой формат
 * - принимает строку
 * - возвращает true, если строка содержит только числа (и точку)
*** */
function checkIsNumericString(string) {
    if (!string) {
        return false;
    }

    return /^-?\d+(\.\d+)?$/.test(String(string).trim());
}

/* ***
 * markBlockDirty - пометка блока как измененного
 * - принимает элемент внутри блока
 * - устанавливает атрибут data-dirty для контейнера
*** */
function markBlockDirty(element) {
    if (!element) {
        return;
    }

    const view = element.closest('[id^="loadedBlock_"][id$="_view"]') ||
        (element.ownerDocument && element.ownerDocument.defaultView && element.ownerDocument.defaultView.frameElement
            ? element.ownerDocument.defaultView.frameElement.closest('[id^="loadedBlock_"][id$="_view"]')
            : null);

    if (view) {
        view.dataset.dirty = 'true';
    }
}



/* ===
 * Применение свойств элементов
=== */

/* ***
 * applyPropertyToElement - применение значения из панели к элементу
 * - принимает целевой элемент, имя свойства, значение и (опционально) целевой CSS-атрибут (targetProperty)
 * - обновляет стили, атрибуты или вызывает специальные функции
*** */
function applyPropertyToElement(element, propertyName, rawValue, targetProperty = null) {
    if (!element || !propertyName) {
        return;
    }

    const value = rawValue === null || rawValue === undefined ? '' : String(rawValue);
    const config = propertyMap[propertyName];

    if (!config) {
        applyFallbackStyle(element, propertyName, value);
        markBlockDirty(element);
        return;
    }

    const tagName = element.tagName.toLowerCase();

    if (config.type === 'special' && config.action === 'gridDirection') {
        const oldValue = value === 'grid-template-rows'
            ? element.style.getPropertyValue('grid-template-columns')
            : element.style.getPropertyValue('grid-template-rows');
        const computedStyles = element.ownerDocument.defaultView.getComputedStyle(element);
        const rawTemplate = oldValue
            || (value === 'grid-template-rows'
                ? computedStyles.getPropertyValue('grid-template-columns')
                : computedStyles.getPropertyValue('grid-template-rows'))
            || 'repeat(1,1fr)';

        let gridTemplate = rawTemplate;
        const match = rawTemplate.match(/repeat\(\s*(\d+)\s*,\s*([^\)]+)\)/i);
        if (!match) {
            const parts = rawTemplate.trim().split(/\s+/).filter(Boolean);
            const count = parts.length || 1;
            let size = parts[0] || '1fr';
            if (/px$/i.test(size) && !oldValue) {
                size = '1fr';
            }
            gridTemplate = `repeat(${count},${size})`;
        }

        element.style.setProperty(value, gridTemplate);
        element.style.removeProperty(value === 'grid-template-rows'
            ? 'grid-template-columns'
            : 'grid-template-rows');
        element.style.setProperty('grid-auto-flow', value === 'grid-template-columns' ? 'row' : 'column');
        markBlockDirty(element);
        return;
    }

    if (config.type === 'special' && config.action === 'gridTemplate') {
        let gridProperty = targetProperty || config.cssName;

        if (!gridProperty) {
            if (propertyName.toLowerCase().includes('row')) {
                gridProperty = 'grid-template-rows';
            } else if (propertyName.toLowerCase().includes('column') || propertyName.toLowerCase().includes('col')) {
                gridProperty = 'grid-template-columns';
            } else {
                const autoFlow = element.style.getPropertyValue('grid-auto-flow') || 
                                 element.ownerDocument.defaultView.getComputedStyle(element).getPropertyValue('grid-auto-flow');
                
                if (autoFlow.includes('column')) {
                    gridProperty = 'grid-template-rows';
                } else if (element.style.getPropertyValue('grid-template-rows')) {
                    gridProperty = 'grid-template-rows';
                } else {
                    gridProperty = 'grid-template-columns';
                }
            }
        }

        const inlineTemplate = element.style.getPropertyValue(gridProperty);
        const rawTemplate = inlineTemplate
            || element.ownerDocument.defaultView.getComputedStyle(element).getPropertyValue(gridProperty)
            || '';

        let currentCount = '1';
        let currentSize = '1fr';

        // Разбираем текущее значение
        const match = rawTemplate.match(/repeat\(\s*(\d+)\s*,\s*([^\)]+)\)/i);
        if (match) {
            currentCount = match[1];
            currentSize = match[2].trim();
        } else if (rawTemplate) {
            const parts = rawTemplate.trim().split(/\s+/).filter(Boolean);
            if (parts.length > 0) {
                currentCount = String(parts.length);
                const firstPart = parts[0].trim();
                currentSize = (/px$/i.test(firstPart) && !inlineTemplate) ? '1fr' : firstPart;
            }
        }

        // Если изменяем количество (count), оно должно быть чистым числом
        const count = config.part === 'count' ? (value.trim() || '1') : currentCount;

        // Если изменяем размер (size) и введено простое число без единиц — автоматически добавляем 'px'
        let formattedSize = value.trim();
        if (config.part === 'size') {
            if (!formattedSize) {
                formattedSize = '1fr';
            } else if (/^\d+(\.\d+)?$/.test(formattedSize)) {
                formattedSize = `${formattedSize}px`; // '20' превращается в '20px'
            }
        }

        const size = config.part === 'size' ? formattedSize : currentSize;

        element.style.setProperty(gridProperty, `repeat(${count},${size})`);
        markBlockDirty(element);
        return;
    }

    // Обработка CSS стилей
    if (config.type === 'style') {
        const cssName = config.cssName || dashedToCamel(propertyName);
        let finalValue = value;

        if (value === '') {
            finalValue = '';
        } else if (config.isNumeric && checkIsNumericString(value)) {
            finalValue = `${Number(value)}px`;
        }

        if ((propertyName === 'gridColumn' || propertyName === 'gridRow') && /^\d+$/.test(value.trim())) {
            finalValue = `span ${value.trim()}`;
        }

        applyStyleToElement(element, tagName, cssName, finalValue);
        markBlockDirty(element);
        return;
    }

    // Обработка HTML атрибутов
    if (config.type === 'attr') {
        if (config.tag && tagName !== config.tag) {
            return;
        }

        applyAttributeToElement(element, tagName, config, value);
        markBlockDirty(element);
        return;
    }

    // Обработка специальных компонентов (например, таблиц)
    if (config.type === 'special' && config.action === 'tableDimensions' && tagName === 'table') {
        applyTableDimensions(element);
        markBlockDirty(element);
    }
}

/* ***
 * applyStyleToElement - установка CSS стиля элементу
 * - принимает элемент, тег, имя CSS свойства и итоговое значение
 * - применяет стиль к элементу (или ячейкам, если это таблица)
*** */
function applyStyleToElement(element, tagName, cssName, value) {
    if (tagName === 'table' && cssName.startsWith('border')) {
        const cells = Array.from(element.querySelectorAll('td, th'));
        
        for (const cell of cells) {
            cell.style[cssName] = value;
        }
    } else {
        element.style[cssName] = value;
    }
}

/* ***
 * applyAttributeToElement - установка HTML атрибута элементу
 * - принимает элемент, тег, конфигурацию атрибута и значение
 * - обновляет соответствующий атрибут
*** */
function applyAttributeToElement(element, tagName, config, value) {
    let attributeName = config.attrName;

    // Особая обработка ссылок для разных элементов (включая ссылки a)
    if (attributeName === 'universalLink') {
        const mediaTags = ['img', 'iframe', 'video', 'audio'];
        if (tagName === 'a') {
            attributeName = 'href';
        } else {
            attributeName = mediaTags.includes(tagName) ? 'src' : 'href';
        }
    }

    // Обработка уникального идентификатора
    if (attributeName === 'id') {
        const inputElement = document.querySelector('[data-prop="id"]');
        syncElementId(value, element, inputElement ? [inputElement] : []);
        return;
    }
    
    // Булевые атрибуты (checked, disabled, required)
    if (config.isBoolean) {
        // приводим к реальному булеву значению перед проверкой
        const isTrue = value === true || value === 'true' || value === '';
        if (isTrue) {
            element.setAttribute(attributeName, '');
        } else {
            element.removeAttribute(attributeName);
        }
        return;
    } 
    
    // Атрибут value устанавливается напрямую как свойство
    if (attributeName === 'value') {
        try {
            element.value = value;
        } catch (error) {
            element.setAttribute(attributeName, value);
        }
        return;
    } 
    
    // Стандартные атрибуты
    if (value === '') {
        element.removeAttribute(attributeName);
    } else {
        element.setAttribute(attributeName, value);
    }
}

/* ***
 * applyFallbackStyle - запасной вариант установки стиля
 * - принимает элемент, имя свойства и значение
 * - пытается установить стиль, если его нет в propertyMap
*** */
function applyFallbackStyle(element, propertyName, value) {
    const cssNameFallback = dashedToCamel(propertyName);

    if (value === '') {
        element.style[cssNameFallback] = '';
    } else if (checkIsNumericString(value)) {
        element.style[cssNameFallback] = `${Number(value)}px`;
    } else {
        element.style[cssNameFallback] = value;
    }
}



/* ===
 * Работа с таблицами
=== */

/* ***
 * applyTableDimensions - применение новых размеров таблицы
 * - принимает элемент таблицы
 * - считывает значения строк и столбцов из полей ввода
 * - вызывает функцию перестроения
*** */
function applyTableDimensions(tableElement) {
    // ищем инпуты напрямую в документе по атрибутам data-prop
    const rowsInput = document.querySelector('[data-prop="tableRows"]');
    const colsInput = document.querySelector('[data-prop="tableCols"]');

    const rows = parseInt(rowsInput ? rowsInput.value : '1', 10) || 1;
    const cols = parseInt(colsInput ? colsInput.value : '1', 10) || 1;

    rebuildTable(tableElement, Math.max(1, rows), Math.max(1, cols));
}

/* ***
 * rebuildTable - перестроение структуры таблицы
 * - принимает таблицу, количество строк и столбцов
 * - создает новую структуру tbody, сохраняя старые данные
*** */
function rebuildTable(table, rows, cols) {
    const oldRows = Array.from(table.querySelectorAll('tr'));
    const tableBody = document.createElement('tbody');

    for (let r = 0; r < rows; r++) {
        const tableRow = document.createElement('tr');
        const oldCells = oldRows[r] ? Array.from(oldRows[r].children) : [];

        for (let c = 0; c < cols; c++) {
            let tableCell;

            if (oldCells[c]) {
                tableCell = oldCells[c];
            } else {
                tableCell = document.createElement('td');
                tableCell.innerHTML = '<br>';
            }

            tableRow.appendChild(tableCell);
        }

        tableBody.appendChild(tableRow);
    }

    // Очистка таблицы и вставка нового тела
    while (table.firstChild) {
        table.removeChild(table.firstChild);
    }

    table.appendChild(tableBody);
}



/* ===
 * Идентификаторы и уникальность (ID)
=== */

// Хранилище введенных ID без data-атрибутов
const activeIdByElement = new WeakMap();

/* ***
 * getActiveId - получение текущего ID элемента
 * - принимает элемент
 * - возвращает сохраненный ID или реальный ID из DOM
*** */
function getActiveId(element) {
    if (!element) {
        return '';
    }

    if (activeIdByElement.has(element)) {
        return activeIdByElement.get(element) || '';
    }

    return element.id || '';
}

/* ***
 * syncElementId - синхронизация ID элемента и проверка уникальности
 * - принимает новый ID, элемент и массив инпутов для подсветки ошибки
 * - проверяет ID на дубликаты в документе
 * - обновляет ID и связанные динамические скрипты/атрибуты
*** */
function syncElementId(newId, element, highlightElements) {
    if (!element) {
        return { valid: false };
    }

    const id = String(newId || '').trim();
    const oldId = element.id || '';

    const clearErrorBackground = () => {
        for (const node of highlightElements || []) {
            if (node) {
                node.style.backgroundColor = '';
            }
        }
    };

    const setErrorBackground = () => {
        for (const node of highlightElements || []) {
            if (!node) {
                continue;
            }
        
            node.style.backgroundColor = '#fdd';
        
            node.addEventListener('focusout', () => {
                node.style.backgroundColor = '';
            }, { once: true }); 
        }
    };

    // Если ID очистили
    if (!id) {
        clearErrorBackground();

        if (oldId) {
            element.removeAttribute('id');
        }

        return { valid: true, reason: 'empty' };
    }

    // Проверка уникальности
    let isDuplicate = false;
    const checkDocument = element.ownerDocument || document;

    try {
        const existingElements = checkDocument.querySelectorAll(`[id="${CSS.escape(id)}"]`);
        
        isDuplicate = Array.from(existingElements).some(
            node => node !== element && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE'
        );
    } catch (error) {
        const fallbackElement = checkDocument.getElementById(id);

        isDuplicate = fallbackElement && fallbackElement !== element && 
                      fallbackElement.tagName !== 'SCRIPT' && fallbackElement.tagName !== 'STYLE';
    }

    if (isDuplicate) {
        setErrorBackground();
        return { valid: false, reason: 'duplicate' };
    }

    clearErrorBackground();

    if (oldId === id) {
        return { valid: true, reason: 'same' };
    }

    // Обновляем ID
    element.id = id;

    if (!oldId) {
        return { valid: true, reason: 'updated' };
    }

    // Обновление ссылок на старый ID в скриптах блока
    const view = element.closest('[id^="loadedBlock_"][id$="_view"]');

    if (!view) {
        return { valid: true };
    }

    const viewId = view.id;
    const escapedOldId = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexScripts = new RegExp(`(['"\`])(#?)${escapedOldId}\\1`, 'g');
    const scripts = [];

    const dynamicScript = document.querySelector(`script[data-dynamic-text="${viewId}"]`);
    
    if (dynamicScript) {
        scripts.push(dynamicScript);
    }

    for (const scriptNode of view.querySelectorAll('script')) {
        if (!scripts.includes(scriptNode)) {
            scripts.push(scriptNode);
        }
    }

    for (const script of scripts) {
        try {
            script.textContent = script.textContent.replace(regexScripts, `$1$2${id}$1`);
        } catch (error) {
            console.error('Ошибка обновления ID в скриптах:', error);
        }
    }

    // Обновление атрибутов, ссылающихся на старый ID
    const regexAttribute = new RegExp(`(^|\\s)(#?)${escapedOldId}(\\s|$)`, 'g');

    for (const node of view.querySelectorAll('*')) {
        if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || !node.attributes) {
            continue;
        }

        for (const attribute of Array.from(node.attributes)) {
            if (!attribute.value) {
                continue;
            }

            if (attribute.value.match(regexAttribute)) {
                node.setAttribute(
                    attribute.name,
                    attribute.value.replace(regexAttribute, `$1$2${id}$3`)
                );
            }
        }
    }

    return { valid: true, reason: 'updated' };
}



/* ===
 * Автозаполнение классов (Autocomplete)
=== */

// Контейнер автозаполнения и текущая цель
const classAutocompleteBox = document.getElementById('classAutocompleteBox'); // Предполагается наличие этого элемента в DOM
let currentClassAutocompleteTarget = null;

/* ***
 * gatherBlockClasses - сбор всех используемых классов в блоке
 * - принимает ID блока
 * - возвращает отсортированный массив уникальных классов
*** */
function gatherBlockClasses(blockId) {
    const view = document.getElementById(`${blockId}_view`);

    if (!view) {
        return [];
    }

    const classSet = new Set();

    for (const element of view.querySelectorAll('[class]')) {
        for (const className of element.classList) {
            classSet.add(className);
        }
    }

    return Array.from(classSet).sort();
}

/* ***
 * showClassAutocomplete - отображение окна автозаполнения классов
 * - принимает ячейку ввода и введенный префикс
 * - рендерит список совпадений
*** */
function showClassAutocomplete(targetCell, prefix) {
    if (!classAutocompleteBox) {
        return;
    }

    const classList = JSON.parse(targetCell.dataset.classNames || '[]');
    const filteredList = prefix ? classList.filter(name => name.startsWith(prefix)) : classList;

    if (!filteredList.length) {
        hideClassAutocomplete();
        return;
    }

    classAutocompleteBox.innerHTML = '';

    for (const className of filteredList) {
        const option = document.createElement('div');
        option.textContent = className;
        option.style.padding = '2px 4px';
        option.style.cursor = 'pointer';

        option.addEventListener('mousedown', event => {
            event.preventDefault();

            if (currentClassAutocompleteTarget) {
                if (currentClassAutocompleteTarget.value !== undefined) {
                    currentClassAutocompleteTarget.value = className;
                } else {
                    currentClassAutocompleteTarget.textContent = className;
                }

                currentClassAutocompleteTarget.focus();
            }

            hideClassAutocomplete();
        });

        classAutocompleteBox.appendChild(option);
    }

    positionClassAutocomplete(targetCell);
    classAutocompleteBox.style.display = '';
}

/* ***
 * positionClassAutocomplete - позиционирование окна автозаполнения
 * - принимает целевую ячейку
 * - рассчитывает координаты и применяет их к окну
*** */
function positionClassAutocomplete(targetCell) {
    if (!classAutocompleteBox) {
        return;
    }

    const rect = targetCell.getBoundingClientRect();
    let leftPosition = rect.left + window.scrollX;
    const topPosition = rect.bottom + window.scrollY;
    
    const boxWidth = classAutocompleteBox.offsetWidth || 0;
    const availableWidth = window.innerWidth - 10;

    if (leftPosition + boxWidth > availableWidth) {
        leftPosition = Math.max(10, availableWidth - boxWidth);
    }

    classAutocompleteBox.style.top = `${topPosition}px`;
    classAutocompleteBox.style.left = `${leftPosition}px`;

    // Защита от выхода за нижний край экрана
    if (topPosition + classAutocompleteBox.offsetHeight > window.innerHeight + window.scrollY) {
        classAutocompleteBox.style.top = `${rect.top + window.scrollY - classAutocompleteBox.offsetHeight - 2}px`;
    }
}

/* ***
 * hideClassAutocomplete - скрытие окна автозаполнения
 * - прячет окно и сбрасывает текущую цель
*** */
function hideClassAutocomplete() {
    if (classAutocompleteBox) {
        classAutocompleteBox.style.display = 'none';
    }

    currentClassAutocompleteTarget = null;
}



/* ===
 * Обработчики событий панели свойств
=== */

// разделяем события input и change чтобы не терять фокус при вводе текста
let isApplyingColorFromPicker = false;

function commitPropertiesChange(selectedElement) {
    if (!selectedElement) {
        return;
    }

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }

    if (window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
        window.editorBlock.saveHistoryState();
    }

    updatePropertiesPanel(selectedElement);
}

// Обработчик клика по полю выбора цвета, чтобы открыть кастомный Color Picker
document.addEventListener('mousedown', event => {
    const control = event.target.closest('input[type="color"][data-prop]');
    if (!control) {
        return;
    }

    if (!window.editorBlock || typeof window.editorBlock.openColorPicker !== 'function') {
        return;
    }

    event.preventDefault();
    event.stopPropagation();

    const propertyName = control.getAttribute('data-prop');
    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;
    let initialColor = normalizeColorString(control.value || '#000000');

    if (selectedElement) {
        const selectedWindow = selectedElement.ownerDocument && selectedElement.ownerDocument.defaultView
            ? selectedElement.ownerDocument.defaultView
            : window;
        const computedColor = selectedWindow.getComputedStyle(selectedElement)[propertyName];
        if (computedColor) {
            initialColor = normalizeColorString(computedColor);
        }
    }

    if (window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
        window.editorBlock.saveHistoryState();
    }

    window.editorBlock.openColorPicker({
        initialColor,
        callback: color => {
            if (!selectedElement) {
                return;
            }

            isApplyingColorFromPicker = true;
            applyPropertyToElement(selectedElement, propertyName, color);
            control.value = color;
            commitPropertiesChange(selectedElement);
            setTimeout(() => {
                isApplyingColorFromPicker = false;
            }, 0);
        },
        anchor: control
    });
});

document.addEventListener('input', event => {
    const control = event.target.closest('[data-prop]');
    if (!control) {
        return;
    }

    if (control.type === 'color' && isApplyingColorFromPicker) {
        return;
    }

    // мгновенно применяем только интерактивные элементы (ползунки, чекбоксы, цвета, селекты)
    const instantTypes = ['checkbox', 'color', 'range', 'select-one'];
    if (!instantTypes.includes(control.type) && control.tagName !== 'SELECT') {
        return; // обычный текст обрабатываем только по событию change
    }

    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;
    if (!selectedElement) {
        return;
    }

    const propertyName = control.getAttribute('data-prop');
    const value = control.type === 'checkbox' ? control.checked : control.value;

    applyPropertyToElement(selectedElement, propertyName, value);

    commitPropertiesChange(selectedElement);
});

// отслеживаем финальное изменение для текстовых полей ввода
document.addEventListener('change', event => {
    const control = event.target.closest('[data-prop]');
    if (!control) {
        return;
    }

    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;
    if (!selectedElement) {
        return;
    }

    const propertyName = control.getAttribute('data-prop');
    const value = control.type === 'checkbox' ? control.checked : control.value;

    applyPropertyToElement(selectedElement, propertyName, value);

    window.editorBlock.syncEditors();
    window.editorBlock.saveHistoryState();
});

// Скрытие автозаполнения при клике вне элемента
document.addEventListener('mousedown', event => {
    if (
        currentClassAutocompleteTarget && 
        classAutocompleteBox && 
        !classAutocompleteBox.contains(event.target) && 
        event.target !== currentClassAutocompleteTarget
    ) {
        hideClassAutocomplete();
    }
});

// Обновление позиции автозаполнения при ресайзе
window.addEventListener('resize', () => {
    if (currentClassAutocompleteTarget && classAutocompleteBox && classAutocompleteBox.style.display !== 'none') {
        positionClassAutocomplete(currentClassAutocompleteTarget);
    }
});

// Блокировка вызова стандартного окна выбора цвета
document.querySelectorAll('input[type="color"]').forEach(input => {
    input.addEventListener('click', event => {
        event.preventDefault();
    });
});