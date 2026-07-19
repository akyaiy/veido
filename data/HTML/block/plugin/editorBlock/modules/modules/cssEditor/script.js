/* ===
 * Вспомогательный CSS парсер и сериализатор
=== */

/* ***
 * parseCss - разбирает текстовое содержимое стилей в массив объектов правил
 * - принимает строку с CSS-кодом
 * - возвращает массив объектов с селектором, медиа-запросом и свойствами
*** */
function parseCss(cssText) {
    const cleanText = cssText.replace(/\/\*[\s\S]*?\*\//g, '');
    const rules = [];
    let currentMedia = '';
    let buffer = '';
    let selector = '';
    let depth = 0;

    const parseProperties = (propsText) => {
        const props = {};
        for (const pair of propsText.split(';')) {
            if (pair.includes(':')) {
                const [key, val] = pair.split(':');
                if (key && key.trim()) {
                    props[key.trim()] = val ? val.trim() : '';
                }
            }
        }
        return props;
    };

    for (let i = 0; i < cleanText.length; i++) {
        const char = cleanText[i];

        if (char === '{') {
            depth++;
            if (depth === 1) {
                const trimmed = buffer.trim();
                if (trimmed.startsWith('@media')) {
                    currentMedia = trimmed;
                    buffer = '';
                } else {
                    selector = trimmed;
                    buffer = '';
                }
            } else if (depth === 2) {
                selector = buffer.trim();
                buffer = '';
            }
        } else if (char === '}') {
            depth--;
            if (depth === 0) {
                if (currentMedia && !selector) {
                    currentMedia = '';
                } else if (selector) {
                    rules.push({
                        media: currentMedia,
                        selector: selector,
                        properties: parseProperties(buffer)
                    });
                    selector = '';
                }
                buffer = '';
            } else if (depth === 1 && currentMedia) {
                rules.push({
                    media: currentMedia,
                    selector: selector,
                    properties: parseProperties(buffer)
                });
                selector = '';
                buffer = '';
            }
        } else {
            buffer += char;
        }
    }
    return rules;
}

/* ***
 * serializeCss - собирает массив CSS правил обратно в форматированную строку
 * - принимает массив объектов правил
 * - возвращает готовую строку стилей
*** */
function serializeCss(rules) {
    let css = '';
    const mediaGroups = {};

    for (const rule of rules) {
        const propKeys = Object.keys(rule.properties).filter(k => k.trim() && rule.properties[k].trim());
        if (propKeys.length === 0) {
            continue;
        }

        let ruleStr = `${rule.selector} {\n`;
        for (const key of propKeys) {
            ruleStr += `    ${key}: ${rule.properties[key]};\n`;
        }
        ruleStr += '}\n';

        if (rule.media) {
            if (!mediaGroups[rule.media]) {
                mediaGroups[rule.media] = [];
            }
            mediaGroups[rule.media].push(ruleStr);
        } else {
            css += ruleStr + '\n';
        }
    }

    for (const media in mediaGroups) {
        css += `${media} {\n`;
        for (const ruleStr of mediaGroups[media]) {
            css += ruleStr.split('\n').map(line => line ? '    ' + line : '').join('\n') + '\n';
        }
        css += '}\n\n';
    }

    return css.trim();
}



/* ===
 * Управление структурой и отрисовкой панели стилей
=== */

// хранилище уникальных выведенных на панель селекторов
let renderedSelectors = new Set();

/* ***
 * getBlockStyleElement - ищет или создает тег style внутри текущего блока редактирования
 * - принимает целевой элемент
 * - возвращает элемент style
*** */
function getBlockStyleElement(element) {
    if (!element) {
        return null;
    }

    let blockId = null;

    // пробуем найти блок по родителю элемента в DOM
    const blockContainer = element.closest('[id^="loadedBlock"]');
    if (blockContainer) {
        blockId = blockContainer.id;
    } else {
        // если элемент вынесен, ищем ID блока через активную вкладку редактора
        const activeTab = document.querySelector('#blocksTabs .blockTab.active, .blockTab.active');
        if (activeTab) {
            blockId = activeTab.getAttribute('data-block-id');
        }
    }

    if (!blockId) {
        return null;
    }

    // находим целевой контейнер стилей
    const cssContainer = document.getElementById(`${blockId}Css`);
    if (!cssContainer) {
        return null;
    }

    let style = cssContainer.querySelector('style');
    if (!style) {
        style = document.createElement('style');
        style.setAttribute('data-dynamic', `${blockId}Html`);
        cssContainer.appendChild(style);
    }
    return style;
}

/* ***
 * matchesElement - безопасно проверяет, подходит ли селектор к выбранному элементу
 * - принимает элемент и проверяемый селектор
 * - возвращает булево значение соответствия
*** */
function matchesElement(element, selector) {
    const parts = selector.split(',');
    for (const part of parts) {
        const cleanPart = part
            .replace(/::?[a-zA-Z-]+(\([^)]*\))?/g, '')
            .trim();
        if (!cleanPart) {
            continue;
        }
        try {
            if (element.matches(cleanPart)) {
                return true;
            }
        } catch (error) {
            // обходим некорректные или специфичные селекторы
        }
    }
    return false;
}

/* ***
 * categorizeRule - определяет тип CSS правила для его группировки в таблице
 * - принимает объект правила и выбранный элемент
 * - возвращает строку категории типа правила
*** */
function categorizeRule(rule, element) {
    if (rule.media) {
        return 'media';
    }

    const selector = rule.selector;

    // Псевдоклассы и псевдоэлементы
    if (selector.includes(':')) {
        return 'pseudo';
    }

    // Атрибуты
    if (selector.includes('[')) {
        return 'attribute';
    }

    // Разбиваем селектор, чтобы получить его конечную, самую значимую часть
    const parts = selector.split(',');
    const firstPart = parts[0].trim();
    const segments = firstPart.split(/\s+/);
    const lastSegment = segments[segments.length - 1];

    // Если в последнем сегменте есть решетка — это ID
    if (lastSegment.includes('#')) {
        return 'id';
    }

    // Если в последнем сегменте есть точка — это класс
    if (lastSegment.includes('.')) {
        return 'class';
    }

    // Если это просто буквы/цифры/дефисы без спецсимволов — это тег
    if (/^[a-zA-Z0-9-]+$/.test(lastSegment)) {
        return 'tag';
    }

    return 'attribute';
}

/* ***
 * getInlineStyles - получает текущие встроенные стили элемента в виде объекта
 * - принимает элемент
 * - возвращает объект со стилями
*** */
function getInlineStyles(element) {
    const styles = {};
    const styleAttr = element.getAttribute('style') || '';
    const pairs = styleAttr.split(';');
    for (const pair of pairs) {
        if (pair.includes(':')) {
            const [key, val] = pair.split(':');
            if (key && key.trim()) {
                styles[key.trim()] = val ? val.trim() : '';
            }
        }
    }
    return styles;
}

/* ***
 * createCssRow - добавляет строку со свойствами в определенную секцию таблицы
 * - принимает контейнер tbody, имя свойства и значение
*** */
function createCssRow(tbody, prop, value) {
    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');

    const propInput = document.createElement('input');
    propInput.placeholder = 'property';
    propInput.value = prop || '';

    const valInput = document.createElement('input');
    valInput.placeholder = 'value';
    valInput.value = value || '';

    td1.appendChild(propInput);
    td2.appendChild(valInput);
    tr.append(td1, td2);
    tbody.appendChild(tr);
}

/* ***
 * createCssSection - создает и наполняет секцию tbody для конкретного типа правил
 * - принимает панель, элемент, тип, заголовок, селектор, медиа-запрос и объект свойств
*** */
function createCssSection(panel, element, type, title, selector, media, properties = {}) {
    const key = `${selector}||${media}`;
    if (type !== 'element') {
        if (renderedSelectors.has(key)) {
            return;
        }
        renderedSelectors.add(key);
    }

    const tbody = document.createElement('tbody');
    tbody.dataset.type = type;
    tbody.dataset.selector = selector;
    tbody.dataset.media = media;

    const trHeader = document.createElement('tr');
    const tdHeader = document.createElement('td');
    tdHeader.colSpan = 2;
    tdHeader.textContent = title;
    trHeader.appendChild(tdHeader);
    tbody.appendChild(trHeader);

    let propsToRender = properties;
    if (type === 'element') {
        propsToRender = getInlineStyles(element);
    }

    for (const prop in propsToRender) {
        createCssRow(tbody, prop, propsToRender[prop]);
    }

    createCssRow(tbody, '', '');
    panel.appendChild(tbody);
}

/* ***
 * ensureEmptyRow - проверяет наличие пустого поля ввода в конце секции tbody
 * - принимает конкретный tbody элемент
*** */
function ensureEmptyRow(tbody) {
    const lastTr = tbody.lastElementChild;
    if (!lastTr) {
        return;
    }

    const propInput = lastTr.querySelector('input[placeholder="property"]');
    const valInput = lastTr.querySelector('input[placeholder="value"]');

    if (!propInput || !valInput) {
        return;
    }

    if (propInput.value.trim() !== '' || valInput.value.trim() !== '') {
        createCssRow(tbody, '', '');
    }
}

/* ***
 * updateCssPanel - полностью перестраивает CSS панель на основе текущего элемента
 * - принимает выбранный элемент
*** */
function updateCssPanel(element) {
    const panel = document.getElementById('cssPanel');
    if (!panel) {
        return;
    }

    panel.innerHTML = '';
    renderedSelectors.clear();

    if (!element) {
        return;
    }

    // по умолчанию выводим inline стиль
    createCssSection(panel, element, 'element', 'Inline стиль (style="")', '', '');

    const styleElement = getBlockStyleElement(element);
    const cssRules = styleElement ? parseCss(styleElement.textContent) : [];

    const matchedRules = [];
    for (const rule of cssRules) {
        if (matchesElement(element, rule.selector)) {
            matchedRules.push(rule);
        }
    }

    // если класс уже стилизован через сложный селектор (например "#testBlock2 .box")
    const isBaseCovered = (baseStr, type) => {
        return matchedRules.some(r => {
            if (r.media || r.selector.includes(':') || r.selector.includes('[')) return false;
            
            const parts = r.selector.split(',');
            return parts.some(p => {
                const segments = p.trim().split(/\s+/);
                const last = segments[segments.length - 1];
                
                if (type === 'tag') return last.toLowerCase() === baseStr.toLowerCase();
                if (type === 'id') return last.includes(baseStr);
                if (type === 'class') {
                    // разбиваем сложный конец (например div.box.active) на массив классов
                    const classList = last.split(/[.#]/);
                    return classList.includes(baseStr.replace('.', ''));
                }
                return false;
            });
        });
    };

    const tagName = element.tagName.toLowerCase();
    if (!isBaseCovered(tagName, 'tag')) {
        createCssSection(panel, element, 'tag', `Тег (${tagName})`, tagName, '');
    }

    if (element.id) {
        const idSelector = `#${element.id}`;
        if (!isBaseCovered(idSelector, 'id')) {
            createCssSection(panel, element, 'id', `ID (#${element.id})`, idSelector, '');
        }
    }

    for (const className of Array.from(element.classList)) {
        const classSelector = `.${className}`;
        if (!isBaseCovered(classSelector, 'class')) {
            createCssSection(panel, element, 'class', `Класс (.${className})`, classSelector, '');
        }
    }

    for (const rule of matchedRules) {
        const category = categorizeRule(rule, element);
        let title = '';

        if (category === 'media') {
            title = `Media query (${rule.media}) - ${rule.selector}`;
        } else if (category === 'pseudo') {
            title = `Псевдокласс (${rule.selector})`;
        } else if (category === 'attribute') {
            title = `Атрибут (${rule.selector})`;
        } else if (category === 'id') {
            title = `ID (${rule.selector})`;
        } else if (category === 'class') {
            title = `Класс (${rule.selector})`;
        } else if (category === 'tag') {
            title = `Тег (${rule.selector})`;
        }

        createCssSection(panel, element, category, title, rule.selector, rule.media, rule.properties);
    }
}

/* ***
 * markBlockDirty - отмечает весь родительский блок макета измененным
 * - принимает дочерний измененный элемент
*** */
function markBlockDirty(element) {
    if (!element) {
        return;
    }

    const view = element.closest('[id^="loadedBlock"]');

    if (view) {
        view.dataset.dirty = 'true';
    }
}



/* ===
 * Обработчики событий панели CSS
=== */

const cssPanel = document.getElementById('cssPanel');

// отслеживание ввода в поля свойств и значений
cssPanel.addEventListener('input', event => {
    const input = event.target;
    const tbody = input.closest('tbody');
    if (!tbody) {
        return;
    }

    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;
    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }
    if (!selectedElement) {
        return;
    }

    const type = tbody.dataset.type;
    const selector = tbody.dataset.selector;
    const media = tbody.dataset.media;

    const properties = {};
    const rows = tbody.querySelectorAll('tr');
    
    // пропускаем первую строку с заголовком
    for (let i = 1; i < rows.length; i++) {
        const propInput = rows[i].querySelector('input[placeholder="property"]');
        const valInput = rows[i].querySelector('input[placeholder="value"]');
        if (propInput && valInput) {
            const key = propInput.value.trim();
            const val = valInput.value.trim();
            if (key) {
                properties[key] = val;
            }
        }
    }

    if (type === 'element') {
        let styleText = '';
        for (const key in properties) {
            styleText += `${key}: ${properties[key]}; `;
        }
        selectedElement.style.cssText = styleText;
        markBlockDirty(selectedElement);
    } else {
        const styleElement = getBlockStyleElement(selectedElement);
        if (styleElement) {
            let rules = parseCss(styleElement.textContent);
            let found = false;

            for (const r of rules) {
                if (r.selector === selector && r.media === media) {
                    r.properties = properties;
                    found = true;
                    break;
                }
            }

            if (!found && Object.keys(properties).length > 0) {
                rules.push({
                    selector: selector,
                    media: media,
                    properties: properties
                });
            }

            // отфильтровываем пустые правила
            rules = rules.filter(r => Object.keys(r.properties).length > 0);
            styleElement.textContent = serializeCss(rules);
            markBlockDirty(selectedElement);
        }
    }

    ensureEmptyRow(tbody);

    window.editorBlock.syncEditors();
    window.editorBlock.saveHistoryState();
});

// очистка пустых или недописанных строчек при потере фокуса
cssPanel.addEventListener('focusout', event => {
    const input = event.target;
    const tr = input.closest('tr');
    const tbody = input.closest('tbody');
    if (!tr || !tbody) {
        return;
    }

    const propInput = tr.querySelector('input[placeholder="property"]');
    const valInput = tr.querySelector('input[placeholder="value"]');
    if (!propInput || !valInput) {
        return;
    }

    const propNow = propInput.value.trim();
    const valNow = valInput.value.trim();

    if (!propNow && !valNow && tr !== tbody.lastElementChild) {
        if (window.editorBlock && window.editorBlock.saveHistoryState) {
            window.editorBlock.saveHistoryState();
        }
        tr.remove();
        ensureEmptyRow(tbody);

        window.editorBlock.syncEditors();
        window.editorBlock.saveHistoryState();
    }
});

// подписка на событие выбора элемента в основном редакторе
document.addEventListener('editorBlock:elementSelected', event => {
    updateCssPanel(event.detail);
});