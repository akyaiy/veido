/* ===
 * Настройки форматов
=== */

// Конфигурация кнопок форматирования
const formatButtons = [
    { key: 'bold', type: 'toggle', property: 'fontWeight', value: 'bold' },
    { key: 'italic', type: 'toggle', property: 'fontStyle', value: 'italic' },
    { key: 'underline', type: 'toggle', property: 'textDecoration', value: 'underline' },
    { key: 'strike', type: 'toggle', property: 'textDecoration', value: 'line-through' },
    { key: 'textColor', type: 'color', property: 'color', value: '' },
    { key: 'bgColor', type: 'color', property: 'backgroundColor', value: '' },
    { key: 'sup', type: 'toggle', property: 'verticalAlign', value: 'super' },
    { key: 'sub', type: 'toggle', property: 'verticalAlign', value: 'sub' },
    { key: 'delete', type: 'action', action: 'removeAll' },
    { key: 'textAlignLeft', type: 'align', property: 'textAlign', value: 'left' },
    { key: 'textAlignCenter', type: 'align', property: 'textAlign', value: 'center' },
    { key: 'textAlignRight', type: 'align', property: 'textAlign', value: 'right' },
    { key: 'textAlignJustify', type: 'align', property: 'textAlign', value: 'justify' },
    { key: 'listDisc', type: 'list', value: 'disc' },
    { key: 'listCircle', type: 'list', value: 'circle' },
    { key: 'listSquare', type: 'list', value: 'square' },
    { key: 'listDecimal', type: 'list', value: 'decimal' }
];

// Конфигурация выпадающих списков
const formatSelects = [
    { key: 'fontSize', property: 'fontSize', target: 'inline' },
    { key: 'fontFamily', property: 'fontFamily', target: 'inline' },
    { key: 'lineHeight', property: 'lineHeight', target: 'block' },
    { key: 'padding', property: 'padding', target: 'block' }
];



/* ===
 * Вспомогательные утилиты выделения
=== */

/* ***
 * getSelectedRange - получение текущего выделения
 * - не принимает параметров
 * - получает выделение пользователя на странице
 * - возвращает объект Range или null
*** */
function getSelectedRange() {
    const selection = window.getSelection();

    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    return selection.getRangeAt(0);
}

/* ***
 * getRootElement - получение корневого элемента
 * - принимает объект выделения Range
 * - определяет общего родителя выделения
 * - возвращает DOM элемент
*** */
function getRootElement(range) {
    const container = range.commonAncestorContainer;

    if (container.nodeType === Node.ELEMENT_NODE) {
        return container;
    }

    return container.parentElement;
}

/* ***
 * getTextNodes - поиск текстовых узлов
 * - принимает объект выделения Range
 * - проходит по DOM дереву выделенного участка
 * - возвращает массив текстовых узлов
*** */
function getTextNodes(range) {
    const rootElement = getRootElement(range);
    const textNodes = [];
    
    const treeWalker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) {
                return NodeFilter.FILTER_REJECT;
            }

            try {
                if (range.intersectsNode(node)) {
                    return NodeFilter.FILTER_ACCEPT;
                }
                
                return NodeFilter.FILTER_REJECT;
            } catch (error) {
                return NodeFilter.FILTER_ACCEPT;
            }
        }
    });

    while (treeWalker.nextNode()) {
        textNodes.push(treeWalker.currentNode);
    }

    return textNodes;
}

/* ***
 * isolateNodes - изоляция узлов
 * - принимает объект выделения Range
 * - разрезает крайние текстовые узлы по краям выделения
 * - возвращает массив изолированных текстовых узлов
*** */
function isolateNodes(range) {
    let startNode = range.startContainer;
    const startOffset = range.startOffset;
    let endNode = range.endContainer;
    const endOffset = range.endOffset;

    if (endNode.nodeType === Node.TEXT_NODE && endOffset < endNode.length) {
        endNode.splitText(endOffset);
    }

    if (startNode.nodeType === Node.TEXT_NODE && startOffset > 0) {
        const newNode = startNode.splitText(startOffset);
        
        if (startNode === endNode) {
            endNode = newNode;
        }
        
        startNode = newNode;
    }

    const newRange = document.createRange();
    
    if (startNode.nodeType === Node.TEXT_NODE) {
        newRange.setStart(startNode, 0);
    } else {
        newRange.setStart(startNode, startOffset);
    }
    
    if (endNode.nodeType === Node.TEXT_NODE) {
        newRange.setEnd(endNode, endNode.length);
    } else {
        newRange.setEnd(endNode, endOffset);
    }

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(newRange);

    return getTextNodes(newRange);
}

/* ***
 * getSelectionParentElement - получение родительского элемента выделения
 * - не принимает параметров
 * - находит ближайший DOM-элемент для текущего выделения
 * - возвращает элемент или null
*** */
function getSelectionParentElement() {
    const range = getSelectedRange();

    if (!range) {
        return null;
    }

    let node = range.commonAncestorContainer;

    if (node.nodeType === Node.TEXT_NODE) {
        node = node.parentNode;
    }

    return node;
}

/* ***
 * getComputedProp - получение вычисленного свойства CSS
 * - принимает элемент и название свойства в camelCase
 * - вычисляет текущее значение стиля элемента
 * - возвращает строковое значение свойства
*** */
function getComputedProp(element, property) {
    if (!element) {
        return '';
    }

    const inlineStyle = element.style[property];

    if (inlineStyle) {
        return inlineStyle;
    }

    try {
        const computedStyle = window.getComputedStyle(element);
        return computedStyle[property] || '';
    } catch (error) {
        return '';
    }
}



/* ===
 * Работа с DOM элементами
=== */

/* ***
 * wrapTextNode - обертывание текста
 * - принимает текстовый узел
 * - создает span с атрибутом data-format при необходимости
 * - возвращает элемент-обертку
*** */
function wrapTextNode(textNode) {
    if (!textNode) {
        return null;
    }

    const parent = textNode.parentNode;

    if (!parent) {
        return null;
    }

    if (parent.tagName === 'SPAN' && parent.getAttribute('data-format') === 'true') {
        return parent;
    }

    const spanElement = document.createElement('span');
    spanElement.setAttribute('data-format', 'true');
    parent.insertBefore(spanElement, textNode);
    spanElement.appendChild(textNode);

    return spanElement;
}

/* ***
 * clearEmptySpan - удаление пустой обертки
 * - принимает DOM элемент span
 * - проверяет наличие стилей и удаляет тег с сохранением содержимого
 * - возвращает null
*** */
function clearEmptySpan(spanElement) {
    if (!spanElement || spanElement.tagName !== 'SPAN') {
        return null;
    }

    const elementStyle = spanElement.getAttribute('style');

    if (!elementStyle || elementStyle.trim() === '') {
        const parent = spanElement.parentNode;
        
        while (spanElement.firstChild) {
            parent.insertBefore(spanElement.firstChild, spanElement);
        }
        
        spanElement.remove();
    }

    return null;
}

/* ***
 * splitParents - разделение родителей
 * - принимает текстовый узел и направление разделения
 * - дублирует родительские span элементы на границах выделения
 * - возвращает null
*** */
function splitParents(textNode, isBefore) {
    let currentNode = textNode;
    
    while (currentNode.parentNode && currentNode.parentNode.tagName === 'SPAN') {
        const parent = currentNode.parentNode;
        const cloneElement = parent.cloneNode(false);
        
        if (isBefore) {
            let sibling = parent.firstChild;
            
            while (sibling !== currentNode) {
                const nextSibling = sibling.nextSibling;
                cloneElement.appendChild(sibling);
                sibling = nextSibling;
            }
            
            if (cloneElement.childNodes.length > 0) {
                parent.parentNode.insertBefore(cloneElement, parent);
            }
        } else {
            let sibling = currentNode.nextSibling;
            
            while (sibling) {
                const nextSibling = sibling.nextSibling;
                cloneElement.appendChild(sibling);
                sibling = nextSibling;
            }
            
            if (cloneElement.childNodes.length > 0) {
                parent.parentNode.insertBefore(cloneElement, parent.nextSibling);
            }
        }
        
        currentNode = parent;
    }

    return null;
}

/* ***
 * mergeAdjacentSpans - слияние соседних span с одинаковыми стилями
 * - принимает корневой DOM-элемент
 * - находит соседние теги span и объединяет их при совпадении стилей
 * - возвращает null
*** */
function mergeAdjacentSpans(rootElement) {
    if (!rootElement) {
        return null;
    }

    const treeWalker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT, null);
    const elementsToVisit = [];

    while (treeWalker.nextNode()) {
        elementsToVisit.push(treeWalker.currentNode);
    }

    for (const element of elementsToVisit) {
        if (element.tagName === 'SPAN') {
            const nextSibling = element.nextSibling;
            const isMatchingSpan = nextSibling &&
                nextSibling.nodeType === Node.ELEMENT_NODE &&
                nextSibling.tagName === 'SPAN' &&
                element.getAttribute('style') === nextSibling.getAttribute('style');

            if (isMatchingSpan) {
                while (nextSibling.firstChild) {
                    element.appendChild(nextSibling.firstChild);
                }
                nextSibling.remove();
            }
        }
    }

    return null;
}



/* ===
 * Строчное форматирование (Inline)
=== */

/* ***
 * applyInlineStyle - применение строчного стиля
 * - принимает свойство и значение
 * - форматирует выделенный текст через тег span
 * - возвращает null
*** */
function applyInlineStyle(styleProperty, styleValue) {
    const range = getSelectedRange();

    if (!range || range.collapsed) {
        return null;
    }

    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const textNodes = isolateNodes(range);

    if (textNodes.length === 0) {
        return null;
    }

    splitParents(textNodes[0], true);  
    splitParents(textNodes[textNodes.length - 1], false);

    for (const textNode of textNodes) {
        if (!textNode.textContent.trim() && textNode.parentNode.tagName !== 'SPAN') {
            continue;
        }

        const parentElement = wrapTextNode(textNode);
        const isDecoration = styleProperty === 'textDecoration';
        const currentDecoration = parentElement.style.textDecoration || '';
        const decorationParts = currentDecoration.split(/\s+/).filter(Boolean);
                    
        if (isDecoration) {
            if (!styleValue) {
                parentElement.style.textDecoration = '';
            } else {
                if (decorationParts.includes(styleValue)) {
                    parentElement.style.textDecoration = decorationParts.filter(value => value !== styleValue).join(' ');
                } else {
                    decorationParts.push(styleValue);
                    parentElement.style.textDecoration = decorationParts.join(' ');
                }
            }
        } else {
            parentElement.style[styleProperty] = styleValue || '';
        }

        clearEmptySpan(parentElement);
    }

    const rootElement = getRootElement(range);
    mergeAdjacentSpans(rootElement);

    syncEditorsData();
    updateActiveStates();
    return null;
}

/* ***
 * toggleInlineStyle - переключение строчного стиля
 * - принимает ключ формата
 * - применяет стиль, а при повторном клике удаляет его
 * - возвращает null
*** */
function toggleInlineStyle(formatKey) {
    const formatConfig = formatButtons.find(item => item.key === formatKey);

    if (!formatConfig) {
        return null;
    }

    const range = getSelectedRange();

    if (!range || range.collapsed) {
        return null;
    }

    const textNodes = getTextNodes(range);

    if (textNodes.length === 0) {
        return null;
    }

    const propertyName = formatConfig.property;
    const expectedValue = formatConfig.value;
    let hasFullStyle = true;

    for (const textNode of textNodes) {
        const parent = textNode.parentNode;
        const isStyledSpan = parent && parent.tagName === 'SPAN' && parent.style[propertyName] === expectedValue;
        
        if (!isStyledSpan) { 
            hasFullStyle = false; 
            break; 
        }
    }

    applyInlineStyle(propertyName, hasFullStyle ? '' : expectedValue);
    return null;
}



/* ===
 * Блочное форматирование (Block)
=== */

/* ***
 * getBlockNodes - поиск блочных контейнеров
 * - принимает объект выделения Range
 * - находит родительские блочные элементы для выделения
 * - возвращает массив элементов
*** */
function getBlockNodes(range) {
    const rootElement = getRootElement(range);
    const textNodes = getTextNodes(range);
    const blockContainers = new Set();

    for (const textNode of textNodes) {
        let currentElement = textNode.parentElement;

        while (currentElement && currentElement !== rootElement && currentElement !== document.body) {
            const computedStyle = window.getComputedStyle(currentElement);
            
            if (computedStyle && computedStyle.display && computedStyle.display !== 'inline' && computedStyle.display !== 'inline-block') {
                blockContainers.add(currentElement);
                break;
            }
            
            currentElement = currentElement.parentElement;
        }

        if (!currentElement && textNode.parentElement) {
            blockContainers.add(textNode.parentElement);
        }
    }

    return Array.from(blockContainers);
}

/* ***
 * applyBlockStyle - применение блочного стиля
 * - принимает свойство и значение
 * - форматирует выделенные блоки через div обертку
 * - возвращает null
*** */
function applyBlockStyle(styleProperty, styleValue) {
    const range = getSelectedRange();

    if (!range || range.collapsed) {
        return null;
    }

    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const fragmentNode = range.extractContents();
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(fragmentNode);

    const oldDivs = tempContainer.querySelectorAll(`div[style*="${styleProperty}"]`);
    
    for (const oldDiv of oldDivs) {
        while (oldDiv.firstChild) {
            oldDiv.parentNode.insertBefore(oldDiv.firstChild, oldDiv);
        }
        oldDiv.remove();
    }

    const newContainer = document.createElement('div');
    
    if (styleValue) {
        newContainer.style[styleProperty] = styleValue;
    }

    while (tempContainer.firstChild) {
        newContainer.appendChild(tempContainer.firstChild);
    }

    range.insertNode(newContainer);

    const selection = window.getSelection();
    selection.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(newContainer);
    selection.addRange(newRange);

    syncEditorsData();
    updateActiveStates();
    return null;
}



/* ===
 * Форматирование списков
=== */

/* ***
 * toggleListStyle - переключение списков
 * - принимает тип списка
 * - создает список выбранного типа или удаляет при значении 'none'
 * - возвращает null
*** */
function toggleListStyle(listType) {
    const range = getSelectedRange();

    if (!range || range.collapsed) {
        return null;
    }

    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    let blockNodes = getBlockNodes(range);

    if (blockNodes.length === 0) {
        const fragmentNode = range.extractContents();
        const wrapperElement = document.createElement('div');
        wrapperElement.appendChild(fragmentNode);
        range.insertNode(wrapperElement);

        const selection = window.getSelection();
        selection.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapperElement);
        selection.addRange(newRange);

        blockNodes = [wrapperElement];
    }

    if (listType === 'none') {
        removeLists(blockNodes);
    } else {
        createLists(blockNodes, listType);
    }

    syncEditorsData();
    updateActiveStates();
    return null;
}

/* ***
 * removeLists - удаление списков
 * - принимает массив блоков
 * - разворачивает содержимое тегов li во внешний контейнер
 * - возвращает null
*** */
function removeLists(blockNodes) {
    for (const block of blockNodes) {
        const listItem = block.closest('li');
        
        if (listItem) {
            const parentList = listItem.parentElement;
            const grandParent = parentList.parentElement;
            
            while (listItem.firstChild) {
                grandParent.insertBefore(listItem.firstChild, parentList);
            }
            
            listItem.remove();
            
            if (!parentList.querySelector('li')) {
                parentList.remove();
            }
        }
    }

    return null;
}

/* ***
 * createLists - создание списков
 * - принимает массив блоков и тип
 * - группирует элементы и оборачивает их в ul/ol
 * - возвращает null
*** */
function createLists(blockNodes, listType) {
    let index = 0;
    
    while (index < blockNodes.length) {
        const block = blockNodes[index];
        const parentList = block.closest('ul, ol');

        if (parentList) {
            updateListType(parentList, listType);
            index++;
            continue;
        }

        const groupNodes = [block];
        let nextIndex = index + 1;
        
        while (nextIndex < blockNodes.length) {
            groupNodes.push(blockNodes[nextIndex]);
            nextIndex++;
        }

        const isDecimal = listType === 'decimal';
        const listElement = isDecimal ? document.createElement('ol') : document.createElement('ul');
        
        if (!isDecimal) {
            listElement.style.listStyleType = listType;
        }

        const firstNode = groupNodes[0];
        firstNode.parentNode.insertBefore(listElement, firstNode);

        for (const groupNode of groupNodes) {
            const listItem = document.createElement('li');
            
            while (groupNode.firstChild) {
                listItem.appendChild(groupNode.firstChild);
            }
            
            listElement.appendChild(listItem);
            groupNode.remove();
        }

        index = nextIndex;
    }

    return null;
}

/* ***
 * updateListType - обновление типа списка
 * - принимает список и новый тип
 * - заменяет тег (ul на ol) или меняет list-style-type
 * - возвращает null
*** */
function updateListType(parentList, listType) {
    if (listType === 'decimal' && parentList.tagName !== 'OL') {
        const orderedList = document.createElement('ol');
        
        if (parentList.parentNode) {
            while (parentList.firstChild) {
                orderedList.appendChild(parentList.firstChild);
            }
            parentList.parentNode.replaceChild(orderedList, parentList);
        }
    } else if (listType !== 'decimal') {
        if (parentList.tagName !== 'UL') {
            const unorderedList = document.createElement('ul');
            
            if (parentList.parentNode) {
                while (parentList.firstChild) {
                    unorderedList.appendChild(parentList.firstChild);
                }
                parentList.parentNode.replaceChild(unorderedList, parentList);
            }
        }
        parentList.style.listStyleType = listType;
    }
    
    return null;
}



/* ===
 * Очистка форматирования
=== */

/* ***
 * clearNodeFormat - рекурсивная очистка узла
 * - принимает DOM узел
 * - удаляет стили, классы, ссылки и списки с сохранением контента
 * - возвращает null
*** */
function clearNodeFormat(nodeElement) {
    const childNodes = Array.from(nodeElement.childNodes);

    for (const childNode of childNodes) {
        if (childNode.nodeType === Node.ELEMENT_NODE) {
            clearNodeFormat(childNode);
        }
    }

    if (nodeElement.nodeType !== Node.ELEMENT_NODE) {
        return null;
    }

    const tagName = nodeElement.tagName;
    const parentNode = nodeElement.parentNode;

    if (tagName === 'A') {
        while (nodeElement.firstChild) {
            parentNode.insertBefore(nodeElement.firstChild, nodeElement);
        }
        parentNode.removeChild(nodeElement);
        return null;
    }

    if (tagName === 'UL' || tagName === 'OL') {
        const fragment = document.createDocumentFragment();
        const listItems = Array.from(nodeElement.children).filter(item => item.tagName === 'LI');
        
        for (const listItem of listItems) {
            while (listItem.firstChild) {
                fragment.appendChild(listItem.firstChild);
            }
            
            const lineBreak = document.createElement('br');
            fragment.appendChild(lineBreak);
        }
        
        if (listItems.length === 0) {
            while (nodeElement.firstChild) {
                fragment.appendChild(nodeElement.firstChild);
            }
        }
        
        parentNode.replaceChild(fragment, nodeElement);
        return null;
    }

    nodeElement.removeAttribute('style');
    nodeElement.removeAttribute('class');
    nodeElement.removeAttribute('align');
    nodeElement.removeAttribute('width');
    nodeElement.removeAttribute('height');
    nodeElement.removeAttribute('cellpadding');
    nodeElement.removeAttribute('cellspacing');
    nodeElement.removeAttribute('border');
    nodeElement.removeAttribute('bgcolor');

    if (tagName === 'SPAN' && nodeElement.attributes.length === 0) {
        while (nodeElement.firstChild) {
            parentNode.insertBefore(nodeElement.firstChild, nodeElement);
        }
        parentNode.removeChild(nodeElement);
    }

    return null;
}

/* ***
 * collapseDuplicateBrs - удаление дублирующихся тегов переноса строк
 * - принимает корневой узел
 * - находит и удаляет идущие подряд теги br
 * - возвращает null
*** */
function collapseDuplicateBrs(rootElement) {
    const treeWalker = document.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT, null);
    const elements = [];

    while (treeWalker.nextNode()) {
        elements.push(treeWalker.currentNode);
    }

    for (const element of elements) {
        let childNode = element.firstChild;

        while (childNode) {
            const isBreakElement = childNode.nodeType === Node.ELEMENT_NODE && childNode.tagName === 'BR';

            if (isBreakElement) {
                let nextSibling = childNode.nextSibling;

                while (nextSibling && nextSibling.nodeType === Node.ELEMENT_NODE && nextSibling.tagName === 'BR') {
                    const elementToRemove = nextSibling;
                    nextSibling = nextSibling.nextSibling;
                    elementToRemove.remove();
                }

                childNode = nextSibling;
            } else {
                childNode = childNode.nextSibling;
            }
        }
    }

    return null;
}

/* ***
 * removeFormatting - удаление форматов в выделении
 * - не принимает параметров
 * - запускает полную чистку стилей и тегов для выделенного текста
 * - возвращает null
*** */
function removeFormatting() {
    const range = getSelectedRange();

    if (!range || range.collapsed) {
        return null;
    }

    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const fragmentNode = range.extractContents();
    
    clearNodeFormat(fragmentNode);
    collapseDuplicateBrs(fragmentNode);
    
    range.insertNode(fragmentNode);

    const selection = window.getSelection();
    selection.removeAllRanges();

    const newRange = document.createRange();

    try {
        const startNode = range.startContainer;
        newRange.setStartAfter(startNode);
        newRange.collapse(true);
        selection.addRange(newRange);
    } catch (error) {
        // Безопасный fallback при потере фокуса
    }

    syncEditorsData();
    updateActiveStates();
    return null;
}



/* ===
 * Синхронизация интерфейса
=== */

/* ***
 * syncEditorsData - запуск обновления редакторов
 * - не принимает параметров
 * - обращается к общему менеджеру синхронизации проекта
 * - возвращает null
*** */
function syncEditorsData() {
    try {
        if (window.editorBlock && window.editorBlock.syncEditors) {
            window.editorBlock.syncEditors();
            window.editorBlock.saveHistoryState();
        }
    } catch (error) {
        console.error('Ошибка при синхронизации редактора:', error);
    }

    return null;
}

/* ***
 * getListPropertyValue - получение типа текущего списка
 * - не принимает параметров
 * - определяет активный тип маркера у выделения
 * - возвращает строку типа или пустую строку
*** */
function getListPropertyValue() {
    const range = getSelectedRange();

    if (!range) {
        return '';
    }

    let nodeElement = range.commonAncestorContainer;
    
    if (nodeElement.nodeType === Node.TEXT_NODE) {
        nodeElement = nodeElement.parentElement;
    }
    
    const listItem = nodeElement.closest ? nodeElement.closest('li') : null;
    
    if (listItem) {
        const parentList = listItem.closest('ul,ol');
        
        if (parentList) {
            const listType = (parentList.style.listStyleType || window.getComputedStyle(parentList).listStyleType || '').trim();
            
            if (listType) {
                return listType;
            }
            
            if (parentList.tagName === 'OL') {
                return 'decimal';
            }
            
            return 'disc';
        }
    }

    return '';
}

/* ***
 * updateActiveStates - синхронизация состояния панели форматирования
 * - не принимает параметров
 * - анализирует выделенный фрагмент текста и обновляет кнопки/селекты
 * - возвращает null
*** */
function updateActiveStates() {
    const element = getSelectionParentElement();

    if (!element) {
        return null;
    }

    const buttons = document.querySelectorAll('[data-simpleformats-button]');

    for (const button of buttons) {
        const key = button.getAttribute('data-simpleformats-button');
        button.classList.remove('active');

        const textAlign = getComputedProp(element, 'textAlign') || 'left';

        switch (key) {
            case 'bold':
                if (getComputedProp(element, 'fontWeight') === 'bold' || getComputedProp(element, 'fontWeight') === '700') {
                    button.classList.add('active');
                }
                break;
            case 'italic':
                if (getComputedProp(element, 'fontStyle') === 'italic') {
                    button.classList.add('active');
                }
                break;
            case 'underline':
                if (getComputedProp(element, 'textDecoration').includes('underline')) {
                    button.classList.add('active');
                }
                break;
            case 'strike':
                if (getComputedProp(element, 'textDecoration').includes('line-through')) {
                    button.classList.add('active');
                }
                break;
            case 'sup':
                if (getComputedProp(element, 'verticalAlign') === 'super') {
                    button.classList.add('active');
                }
                break;
            case 'sub':
                if (getComputedProp(element, 'verticalAlign') === 'sub') {
                    button.classList.add('active');
                }
                break;
            case 'textAlignLeft':
                if (textAlign === 'left' || textAlign === 'start') {
                    button.classList.add('active');
                }
                break;
            case 'textAlignCenter':
                if (textAlign === 'center') {
                    button.classList.add('active');
                }
                break;
            case 'textAlignRight':
                if (textAlign === 'right' || textAlign === 'end') {
                    button.classList.add('active');
                }
                break;
            case 'textAlignJustify':
                if (textAlign === 'justify') {
                    button.classList.add('active');
                }
                break;
            case 'listDisc':
                if (getListPropertyValue() === 'disc') {
                    button.classList.add('active');
                }
                break;
            case 'listCircle':
                if (getListPropertyValue() === 'circle') {
                    button.classList.add('active');
                }
                break;
            case 'listSquare':
                if (getListPropertyValue() === 'square') {
                    button.classList.add('active');
                }
                break;
            case 'listDecimal':
                if (getListPropertyValue() === 'decimal') {
                    button.classList.add('active');
                }
                break;
        }
    }

    const selects = document.querySelectorAll('[data-property-item]');

    for (const select of selects) {
        const propertyName = select.getAttribute('data-property-item');
        let propertyValue = '';

        if (propertyName === 'fontSize') {
            propertyValue = getComputedProp(element, 'fontSize');
        } else if (propertyName === 'fontFamily') {
            propertyValue = getComputedProp(element, 'fontFamily');
            propertyValue = propertyValue.replace(/['"]/g, '');
        } else if (propertyName === 'lineHeight') {
            propertyValue = getComputedProp(element, 'lineHeight');
        } else if (propertyName === 'padding') {
            propertyValue = getComputedProp(element, 'padding');
        }

        let isFound = false;

        for (const option of select.options) {
            const optionValue = option.value.replace(/['"]/g, '');
            
            if (optionValue === propertyValue) {
                select.value = option.value;
                isFound = true;
                break;
            }
        }

        if (!isFound) {
            select.value = '';
        }
    }

    return null;
}



/* ===
 * Обработчики событий
=== */

/* ***
 * handleFormatClick - обработка клика по кнопке
 * - принимает объект события event
 * - вызывает нужное форматирование на основе атрибута
 * - возвращает null
*** */
async function handleFormatClick(event) {
    window.editorBlock.restoreSelection();

    const buttonElement = event.currentTarget;
    const formatKey = buttonElement.getAttribute('data-simpleformats-button');
    const formatConfig = formatButtons.find(item => item.key === formatKey);

    if (!formatConfig) {
        return null;
    }

    if (formatConfig.type === 'toggle') {
        toggleInlineStyle(formatKey);
    }

    if (formatConfig.type === 'color') {
        const activeElement = getSelectionParentElement();
        const currentColor = activeElement ? getComputedProp(activeElement, formatConfig.property) : '';
        const initialColor = currentColor || (formatConfig.key === 'textColor' ? '#000000' : '#ffffff');

        if (window.editorBlock && typeof window.colorPicker.openColorPicker === 'function') {
            window.editorBlock.saveHistoryState();

            window.colorPicker.openColorPicker({
                initialColor,
                callback: color => applyInlineStyle(formatConfig.property, color),
                anchor: buttonElement
            });
        } else {
            const colorValue = await window.editorBlock.prompt('Введите цвет (например, #516ed7 или red):', initialColor);
            if (colorValue !== null) {
                applyInlineStyle(formatConfig.property, colorValue);
            }
        }
    }

    if (formatConfig.type === 'align') {
        applyBlockStyle('textAlign', formatConfig.value);
    }

    if (formatConfig.type === 'list') {
        const currentListType = getListPropertyValue();
        
        if (currentListType === formatConfig.value) {
            toggleListStyle('none');
        } else {
            toggleListStyle(formatConfig.value);
        }
    }

    if (formatConfig.action === 'removeAll') {
        removeFormatting();
    }

    window.editorBlock.restoreSelection();

    return null;
}

/* ***
 * handleSelectChange - обработка выбора из выпадающего списка
 * - принимает объект события event
 * - применяет выбранный инлайновый или блочный стиль
 * - возвращает null
*** */
function handleSelectChange(event) {
    window.editorBlock.restoreSelection();
    
    const selectElement = event.currentTarget;
    const formatKey = selectElement.getAttribute('data-property-item');
    const formatConfig = formatSelects.find(item => item.key === formatKey);
    const selectedValue = selectElement.value;

    if (!formatConfig) {
        return null;
    }

    const isEmptyValue = selectedValue === '' || selectedValue === '-' || selectedValue === 'none';

    if (formatConfig.target === 'block') {
        applyBlockStyle(formatConfig.property, isEmptyValue ? '' : selectedValue);
    } else {
        applyInlineStyle(formatConfig.property, isEmptyValue ? '' : selectedValue);
    }

    window.editorBlock.restoreSelection();

    return null;
}

/* ***
 * handleSelectionChange - обработка изменения выделения на странице
 * - принимает объект события event
 * - обновляет состояние активных элементов панели форматирования
 * - возвращает null
*** */
function handleSelectionChange(event) {
    updateActiveStates();
    return null;
}

// Поиск кнопок на панели форматирования
const actionButtons = document.querySelectorAll('[data-simpleformats-button]');

// Навешивание обработчиков событий для кнопок
for (const actionButton of actionButtons) {
    actionButton.addEventListener('click', handleFormatClick);
}

// Поиск выпадающих списков на панели форматирования
const actionSelects = document.querySelectorAll('[data-property-item]');

// Навешивание обработчиков событий для выпадающих списков
for (const actionSelect of actionSelects) {
    actionSelect.addEventListener('click', handleSelectChange);
}

// Навешивание обработчика на изменение выделения в документе
document.addEventListener('selectionchange', handleSelectionChange);