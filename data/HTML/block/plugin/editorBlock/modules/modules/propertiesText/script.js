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
 * - находит активную область выделенного текста в браузере
 * - отдает объект Range или null
*** */
function getSelectedRange() {
    const selection = window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function'
        ? window.editorBlock.getEditorSelection()
        : null;

    if (!selection || selection.rangeCount === 0) {
        return null;
    }

    return selection.getRangeAt(0);
}

/* ***
 * getRootElement - определение корневого элемента
 * - принимает объект выделения Range
 * - находит общий родительский тег для границ выделения
 * - отдает DOM-элемент
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
 * - собирает все заполненные текстом узлы внутри выделения
 * - отдает массив текстовых узлов
*** */
function getTextNodes(range) {
    const rootElement = getRootElement(range);
    const textNodes = [];
    const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
        ? window.editorBlock.getEditorDocument()
        : document;
    
    const treeWalker = (rootElement.ownerDocument || editorDoc).createTreeWalker(rootElement, NodeFilter.SHOW_TEXT, {
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
 * - разрезает текстовые узлы точно по индексам начала и конца выделения
 * - сбрасывает текущий фокус страницы и ставит новый диапазон по чистым краям
 * - отдает массив изолированных текстовых узлов
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

    const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
        ? window.editorBlock.getEditorDocument()
        : document;
    const newRange = editorDoc.createRange();
    
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

    const selection = window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function'
        ? window.editorBlock.getEditorSelection()
        : null;
    if (selection) {
        selection.removeAllRanges();
        selection.addRange(newRange);
    }

    return getTextNodes(newRange);
}

/* ***
 * getSelectionParentElement - получение родительского элемента выделения
 * - определяет ближайший тег-контейнер для текущего выделенного фрагмента
 * - отдает DOM-элемент или null
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
 * - принимает DOM-элемент и имя свойства в camelCase
 * - считывает инлайновый или вычисленный стиль элемента через window.getComputedStyle
 * - отдает строку со значением свойства
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
 * - оборачивает текстовый узел в тег span с атрибутом форматирования
 * - отдает элемент обертки span
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

    const spanElement = (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
        ? window.editorBlock.getEditorDocument()
        : document).createElement('span');
    spanElement.setAttribute('data-format', 'true');
    parent.insertBefore(spanElement, textNode);
    spanElement.appendChild(textNode);

    return spanElement;
}

/* ***
 * clearEmptySpan - удаление пустой обертки
 * - принимает DOM-элемент span
 * - удаляет тег span и выносит текст наружу, если у тега нет стилей
 * - отдает null
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
 * - принимает текстовый узел и логический флаг направления разделения
 * - разрезает родительские span на границах выделения во избежание расползания стилей
 * - отдает null
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
 * mergeAdjacentSpans - слияние соседних span
 * - принимает корневой DOM-элемент для поиска
 * - объединяет стоящие рядом элементы span, если их инлайн-стили полностью совпадают
 * - отдает null
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
 * - принимает имя CSS-свойства и его новое строковое значение
 * - изолирует текстовые узлы и определяет уровень их выделения (частично или полностью)
 * - применяет стиль к ближайшему родительскому блоку, если он выделен целиком
 * - оборачивает текст в span только при частичном выделении
 * - обрабатывает обратную логику (отключение унаследованного стиля на части текста)
 * - очищает дублирующиеся стили внутри родительских блоков
 * - сшивает соседние span элементы и синхронизирует состояние редактора
 * - отдает null
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

    const selectedTextNodes = new Set(textNodes);

    /* ***
     * isEditorRoot - проверка элемента на корневой контейнер
     * - принимает HTML элемент
     * - возвращает true, если элемент является корнем редактора
    *** */
    function isEditorRoot(element) {
        if (!element || !element.tagName) {
            return true;
        }

        const tag = element.tagName.toLowerCase();

        return (
            tag === 'body' || 
            tag === 'html' || 
            element.hasAttribute('contenteditable') || 
            element.id === 'viewEditor' || 
            element.classList.contains('viewEditor')
        );
    }

    /* ***
     * isElementFullySelected - проверка полного выделения элемента
     * - принимает HTML элемент
     * - проверяет, входят ли все его непустые текстовые узлы в наше выделение
     * - возвращает boolean
    *** */
    function isElementFullySelected(element) {
        const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
            ? window.editorBlock.getEditorDocument()
            : document;
        const walker = (element.ownerDocument || editorDoc).createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);
        let node;

        while ((node = walker.nextNode())) {
            if (node.nodeValue && node.nodeValue.trim() !== '' && !selectedTextNodes.has(node)) {
                return false;
            }
        }

        return true;
    }

    const targetElements = new Set();
    const partialTextNodes = new Set();

    for (const textNode of textNodes) {
        if (!textNode.nodeValue || (!textNode.nodeValue.trim() && textNode.parentNode.tagName !== 'SPAN')) {
            continue;
        }

        let currentElement = textNode.parentElement;
        let bestTargetElement = null;

        while (currentElement && !isEditorRoot(currentElement) && isElementFullySelected(currentElement)) {
            bestTargetElement = currentElement;
            currentElement = currentElement.parentElement;
        }

        if (bestTargetElement) {
            targetElements.add(bestTargetElement);
        } else {
            partialTextNodes.add(textNode);
        }
    }

    /* ***
     * toggleStyle - переключение или установка конкретного стиля
     * - принимает HTML элемент, свойство, значение и флаг частичного выделения
     * - обрабатывает логику textDecoration и стандартных стилей
     * - применяет обратную логику для снятия наследуемых стилей
     * - очищает дублирующиеся стили у дочерних элементов
    *** */
    function toggleStyle(element, prop, val, isPartial) {
        const isDecoration = prop === 'textDecoration';
        const currentDecoration = element.style.textDecoration || '';
        const decorationParts = currentDecoration.split(/\s+/).filter(Boolean);

        if (isDecoration) {
            if (!val) {
                element.style.textDecoration = isPartial ? 'none' : '';
            } else {
                if (decorationParts.includes(val)) {
                    element.style.textDecoration = decorationParts.filter((v) => v !== val).join(' ');
                    
                    if (element.style.textDecoration === '' && isPartial) {
                        const parentDeco = getComputedProp(element.parentElement, 'textDecorationLine') || getComputedProp(element.parentElement, 'textDecoration') || '';
                        
                        if (parentDeco && parentDeco !== 'none') {
                            element.style.textDecoration = 'none';
                        }
                    }
                } else {
                    decorationParts.push(val);
                    element.style.textDecoration = decorationParts.join(' ');
                }
            }
        } else {
            if (val) {
                element.style[prop] = val;
            } else {
                if (isPartial) {
                    const computed = getComputedProp(element.parentElement, prop);
                    const isInheritingBold = prop === 'fontWeight' && (computed === 'bold' || computed === '700' || parseInt(computed) >= 700);
                    const isInheritingItalic = prop === 'fontStyle' && computed === 'italic';
                    
                    if (isInheritingBold) {
                        element.style.fontWeight = 'normal';
                    } else if (isInheritingItalic) {
                        element.style.fontStyle = 'normal';
                    } else if (prop === 'verticalAlign') {
                        element.style.verticalAlign = 'baseline';
                    } else if (prop === 'color' || prop === 'backgroundColor') {
                        element.style[prop] = 'inherit';
                    } else {
                        element.style[prop] = '';
                    }
                } else {
                    element.style[prop] = '';
                }
            }
        }

        if (!isPartial) {
            const children = element.querySelectorAll('*');
            
            for (const child of children) {
                if (isDecoration) {
                    if (val && child.style.textDecoration.includes(val)) {
                        child.style.textDecoration = child.style.textDecoration.replace(val, '').trim();
                    }
                } else {
                    if (val && child.style[prop] === val) {
                        child.style[prop] = '';
                    }
                }

                if (typeof clearEmptySpan === 'function') {
                    clearEmptySpan(child);
                }
            }
        }
    }

    for (const targetElement of targetElements) {
        toggleStyle(targetElement, styleProperty, styleValue, false);
        
        if (typeof clearEmptySpan === 'function') {
            clearEmptySpan(targetElement);
        }
    }

    for (const textNode of partialTextNodes) {
        const parentElement = wrapTextNode(textNode);
        
        toggleStyle(parentElement, styleProperty, styleValue, true);
        
        if (typeof clearEmptySpan === 'function') {
            clearEmptySpan(parentElement);
        }
    }

    const rootElement = getRootElement(range);
    mergeAdjacentSpans(rootElement);

    syncEditorsData();
    updateActiveStates();
    
    return null;
}

/* ***
 * toggleInlineStyle - переключение строчного стиля
 * - принимает строковый ключ формата из массива конфигурации buttons
 * - проверяет вычисленные стили элементов выделения (включая унаследованные)
 * - включает или выключает инлайновый стиль в зависимости от его текущего наличия на узлах
 * - отдает null
*** */
function toggleInlineStyle(formatKey) {
    const formatConfig = formatButtons.find(item => item.key === formatKey);

    if (!formatConfig) {
        return false;
    }

    const range = getSelectedRange();

    if (!range || range.collapsed) {
        return false;
    }

    const textNodes = getTextNodes(range);

    if (textNodes.length === 0) {
        return false;
    }

    const propertyName = formatConfig.property;
    const expectedValue = formatConfig.value;
    let hasFullStyle = true;

    for (const textNode of textNodes) {
        const parent = textNode.parentElement;
        const computedStyle = getComputedProp(parent, propertyName);

        let isActive = false;

        if (propertyName === 'fontWeight') {
            isActive = (computedStyle === 'bold' || computedStyle === '700' || parseInt(computedStyle, 10) >= 700);
        } else if (propertyName === 'textDecoration') {
            isActive = computedStyle.includes(expectedValue);
        } else {
            isActive = (computedStyle === expectedValue);
        }

        if (!isActive) {
            hasFullStyle = false;
            break;
        }
    }

    applyInlineStyle(propertyName, hasFullStyle ? '' : expectedValue);

    return true;
}



/* ===
 * Блочное форматирование (Block)
=== */

/* ***
 * getBlockNodes - поиск блочных контейнеров
 * - принимает объект выделения Range
 * - ищет и собирает уникальные родительские элементы выделения с display отличным от inline
 * - отдает массив блочных DOM-элементов
*** */
function getBlockNodes(range) {
    const rootElement = getRootElement(range);
    const textNodes = getTextNodes(range);
    const blockContainers = new Set();
    const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
        ? window.editorBlock.getEditorDocument()
        : document;
    const editorBody = editorDoc.body || editorDoc.documentElement;

    for (const textNode of textNodes) {
        let currentElement = textNode.parentElement;

        while (currentElement && currentElement !== rootElement && currentElement !== editorBody) {
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
 * - принимает имя CSS-свойства и новое значение для блочного элемента
 * - вырезает выделенный контент и помещает его в новый контейнер div с заданным стилем
 * - удаляет старые вложенные div контейнеры, чтобы избежать дублирования стилей
 * - отдает null
*** */
function applyBlockStyle(styleProperty, styleValue) {
    const range = getSelectedRange();

    if (!range || range.collapsed) {
        return null;
    }

    if (window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
        ? window.editorBlock.getEditorDocument()
        : document;
    const fragmentNode = range.extractContents();
    const tempContainer = editorDoc.createElement('div');
    tempContainer.appendChild(fragmentNode);

    const oldDivs = tempContainer.querySelectorAll(`div[style*="${styleProperty}"]`);
    
    for (const oldDiv of oldDivs) {
        while (oldDiv.firstChild) {
            oldDiv.parentNode.insertBefore(oldDiv.firstChild, oldDiv);
        }
        oldDiv.remove();
    }

    const newContainer = editorDoc.createElement('div');
    
    if (styleValue) {
        newContainer.style[styleProperty] = styleValue;
    }

    while (tempContainer.firstChild) {
        newContainer.appendChild(tempContainer.firstChild);
    }

    range.insertNode(newContainer);

    const selection = window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function'
        ? window.editorBlock.getEditorSelection()
        : null;
    if (selection) {
        selection.removeAllRanges();
        const newRange = editorDoc.createRange();
        newRange.selectNodeContents(newContainer);
        selection.addRange(newRange);
    }

    syncEditorsData();
    updateActiveStates();
    return null;
}



/* ===
 * Форматирование списков
=== */

/* ***
 * toggleListStyle - переключение списков
 * - принимает строковый тип создаваемого списка или команду 'none'
 * - управляет созданием или полной очисткой структуры списков для выделенных блоков
 * - отдает null
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
        const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
            ? window.editorBlock.getEditorDocument()
            : document;
        const fragmentNode = range.extractContents();
        const wrapperElement = editorDoc.createElement('div');
        wrapperElement.appendChild(fragmentNode);
        range.insertNode(wrapperElement);

        const selection = window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function'
            ? window.editorBlock.getEditorSelection()
            : null;
        if (selection) {
            selection.removeAllRanges();
            const newRange = editorDoc.createRange();
            newRange.selectNodeContents(wrapperElement);
            selection.addRange(newRange);
        }

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
 * - принимает массив блочных узлов, входящих в списки
 * - извлекает содержимое элементов li наружу с сохранением стилей и удаляет пустые теги ul/ol
 * - отдает null
*** */
function removeLists(blockNodes) {
    for (const block of blockNodes) {
        const listItem = block.closest('li');
        
        if (listItem) {
            const parentList = listItem.parentElement;
            const grandParent = parentList.parentElement;
            
            const editorDoc = listItem.ownerDocument ||
                (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
                    ? window.editorBlock.getEditorDocument()
                    : document);
            const newBlock = editorDoc.createElement('div');

            // Сохранение стилей и классов из li при возврате в блочный элемент
            if (listItem.hasAttribute('style') && listItem.getAttribute('style').trim()) {
                newBlock.setAttribute('style', listItem.getAttribute('style'));
            }
            if (listItem.className) {
                newBlock.className = listItem.className;
            }
            
            while (listItem.firstChild) {
                newBlock.appendChild(listItem.firstChild);
            }
            
            grandParent.insertBefore(newBlock, parentList);
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
 * - принимает массив блоков и строку с типом генерируемого списка
 * - группирует выбранные блоки и переносит их контент внутрь нового списка ul или ol с сохранением стилей
 * - если блок уже находится внутри списка, то вызывает функцию обновления типа маркера
 * - отдает null
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
        const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
            ? window.editorBlock.getEditorDocument()
            : document;
        const listElement = isDecimal ? editorDoc.createElement('ol') : editorDoc.createElement('ul');
        
        if (!isDecimal) {
            listElement.style.listStyleType = listType;
        }

        const firstNode = groupNodes[0];
        firstNode.parentNode.insertBefore(listElement, firstNode);

        for (const groupNode of groupNodes) {
            const listItem = editorDoc.createElement('li');
            
            // Сохранение стилей и классов исходного блока внутри списка для предотвращения потери форматирования
            if (groupNode.hasAttribute('style') && groupNode.getAttribute('style').trim()) {
                listItem.setAttribute('style', groupNode.getAttribute('style'));
            }
            if (groupNode.className) {
                listItem.className = groupNode.className;
            }

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
 * - принимает DOM-элемент текущего списка и строку с новым типом маркера
 * - меняет сам тег списка с ul на ol (и наоборот) либо обновляет CSS-вид маркеров li
 * - отдает null
*** */
function updateListType(parentList, listType) {
    if (listType === 'decimal' && parentList.tagName !== 'OL') {
        const editorDoc = parentList.ownerDocument ||
            (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
                ? window.editorBlock.getEditorDocument()
                : document);
        const orderedList = editorDoc.createElement('ol');
        
        if (parentList.parentNode) {
            while (parentList.firstChild) {
                orderedList.appendChild(parentList.firstChild);
            }
            parentList.parentNode.replaceChild(orderedList, parentList);
        }
    } else if (listType !== 'decimal') {
        if (parentList.tagName !== 'UL') {
            const editorDoc = parentList.ownerDocument ||
                (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
                    ? window.editorBlock.getEditorDocument()
                    : document);
            const unorderedList = editorDoc.createElement('ul');
            
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
 * - рекурсивно обходит всё дерево дочерних элементов
 * - удаляет HTML-ссылки и разворачивает списки ul/ol с заменой элементов li на переносы br
 * - очищает у узлов стили, классы и устаревшие атрибуты разметки вроде bgcolor и border
 * - отдает null
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
        const doc = nodeElement.ownerDocument ||
            (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
                ? window.editorBlock.getEditorDocument()
                : document);
        const fragment = doc.createDocumentFragment();
        const listItems = Array.from(nodeElement.children).filter(item => item.tagName === 'LI');
        
        for (const listItem of listItems) {
            while (listItem.firstChild) {
                fragment.appendChild(listItem.firstChild);
            }
            
            const lineBreak = doc.createElement('br');
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
 * - сканирует элементы с помощью TreeWalker и находит идущие подряд теги br
 * - удаляет лишние повторения br, схлопывая их до одного элемента
 * - отдает null
*** */
function collapseDuplicateBrs(rootElement) {
    const doc = rootElement.ownerDocument ||
        (window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
            ? window.editorBlock.getEditorDocument()
            : document);
    const treeWalker = doc.createTreeWalker(rootElement, NodeFilter.SHOW_ELEMENT, null);
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
 * - извлекает контент из области выделения и полностью стирает с него разметку и стили
 * - безопасно возвращает каретку на место и запускает синхронизацию данных редактора
 * - отдает null
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

    const selection = window.editorBlock && typeof window.editorBlock.getEditorSelection === 'function'
        ? window.editorBlock.getEditorSelection()
        : null;
    if (selection) {
        selection.removeAllRanges();
    }

    const editorDoc = window.editorBlock && typeof window.editorBlock.getEditorDocument === 'function'
        ? window.editorBlock.getEditorDocument()
        : document;
    const newRange = editorDoc.createRange();

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
 * - обращается к внешнему объекту управления для обновления контента и сохранения истории изменений
 * - отдает null
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
 * - ищет ближайший элемент списка li относительно текущей позиции курсора
 * - проверяет теги ul/ol и CSS-стили, чтобы распознать точный тип маркера строки
 * - отдает строку типа или пустую строку
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
 * - опрашивает все текстовые узлы в области выделения и их унаследованные стили
 * - перебирает все кнопки и списки на панели, переключая класс active и выставляя нужные значения
 * - отдает null
*** */
function updateActiveStates() {
    const range = getSelectedRange();
    const hasSelection = Boolean(range && !range.collapsed);

    const buttons = document.getElementById('editorBlock').querySelectorAll('[data-simpleformats-button]');
    const selectWrappers = document.getElementById('editorBlock').querySelectorAll('.propertiesList');

    buttons.forEach(button => {
        button.style.display = hasSelection ? '' : 'none';
    });

    selectWrappers.forEach(wrapper => {
        wrapper.style.display = hasSelection ? '' : 'none';
    });

    if (!hasSelection) {
        return null;
    }

    const textNodes = getTextNodes(range);
    const element = getSelectionParentElement();

    if (!element) {
        return null;
    }

    for (const button of buttons) {
        const key = button.getAttribute('data-simpleformats-button');
        button.classList.remove('active');

        let propertyName = '';
        let expectedValue = '';
        let isToggle = false;

        if (key === 'bold') { propertyName = 'fontWeight'; expectedValue = 'bold'; isToggle = true; }
        else if (key === 'italic') { propertyName = 'fontStyle'; expectedValue = 'italic'; isToggle = true; }
        else if (key === 'underline') { propertyName = 'textDecoration'; expectedValue = 'underline'; isToggle = true; }
        else if (key === 'strike') { propertyName = 'textDecoration'; expectedValue = 'line-through'; isToggle = true; }
        else if (key === 'sup') { propertyName = 'verticalAlign'; expectedValue = 'super'; isToggle = true; }
        else if (key === 'sub') { propertyName = 'verticalAlign'; expectedValue = 'sub'; isToggle = true; }

        if (isToggle) {
            let allHaveStyle = textNodes.length > 0;
            for (const textNode of textNodes) {
                const parent = textNode.parentElement;
                const computedStyle = getComputedProp(parent, propertyName);
                let isActive = false;

                if (propertyName === 'fontWeight') {
                    isActive = (computedStyle === 'bold' || computedStyle === '700' || parseInt(computedStyle, 10) >= 700);
                } else if (propertyName === 'textDecoration') {
                    isActive = computedStyle.includes(expectedValue);
                } else {
                    isActive = (computedStyle === expectedValue);
                }

                if (!isActive) {
                    allHaveStyle = false;
                    break;
                }
            }
            if (allHaveStyle) {
                button.classList.add('active');
            }
        } else if (key.startsWith('textAlign')) {
            const textAlign = getComputedProp(element, 'textAlign') || 'left';
            const alignVal = key === 'textAlignLeft' ? 'left' : key === 'textAlignCenter' ? 'center' : key === 'textAlignRight' ? 'right' : 'justify';
            
            if ((alignVal === 'left' && (textAlign === 'left' || textAlign === 'start')) || textAlign === alignVal) {
                button.classList.add('active');
            }
        } else if (key.startsWith('list')) {
            const listVal = key === 'listDisc' ? 'disc' : key === 'listCircle' ? 'circle' : key === 'listSquare' ? 'square' : 'decimal';
            if (getListPropertyValue() === listVal) {
                button.classList.add('active');
            }
        }
    }

    const selects = document.getElementById('editorBlock').querySelectorAll('[data-property-item]');

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

        const control = select.querySelector('select');

        if (!control || !control.options) {
            continue;
        }

        for (const option of control.options) {
            const optionValue = option.value.replace(/['"]/g, '');
            
            if (optionValue === propertyValue) {
                control.value = option.value;
                isFound = true;
                break;
            }
        }

        if (!isFound) {
            control.value = '';
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
 * - считывает тип нажатой кнопки и перенаправляет вызов на инлайн-стили, выравнивание или списки
 * - при выборе цвета открывает встроенный палитру-пикер или вызывает стандартное окно ввода текста
 * - отдает null
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

        if (window.editorBlock && typeof window.editorBlock.openColorPicker === 'function') {
            window.editorBlock.saveHistoryState();

            window.editorBlock.openColorPicker({
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
 * - считывает выбранное значение селекта и определяет целевую зону изменения контента
 * - применяет стиль к блочным элементам или строчным текстовым узлам и возвращает фокус
 * - отдает null
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
 * - инициирует перерасчет и обновление визуального состояния элементов панели
 * - отдает null
*** */
function handleSelectionChange(event) {
    updateActiveStates();
    return null;
}

/* ===
 * Горячие клавиши форматирования текста
=== */

/* ***
 * handleTextFormatShortcuts - обработка горячих клавиш форматирования текста
 * - перехватывает комбинации Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Shift+X, Ctrl+. и Ctrl+,
 * - отдает null
*** */
function handleTextFormatShortcuts(event) {
    if (!event || !event.ctrlKey || event.altKey) {
        return null;
    }

    const key = event.key ? event.key.toLowerCase() : '';
    let formatKey = '';

    if (key === 'b') {
        formatKey = 'bold';
    } else if (key === 'i') {
        formatKey = 'italic';
    } else if (key === 'u') {
        formatKey = 'underline';
    } else if (event.shiftKey && key === 'x') {
        formatKey = 'strike';
    } else if (key === '.') {
        formatKey = 'sup';
    } else if (key === ',') {
        formatKey = 'sub';
    }

    if (formatKey) {
        event.preventDefault();
        toggleInlineStyle(formatKey);
    }

    return null;
}

/* ***
 * attachTextFormatShortcutHandlers - добавление обработчика горячих клавиш форматирования
 * - принимает документ редактора
 * - добавляет обработчик keydown только один раз
 * - отдает null
*** */
function attachTextFormatShortcutHandlers(targetDocument) {
    if (!targetDocument || targetDocument.textFormatShortcutsBound) {
        return null;
    }

    targetDocument.addEventListener('keydown', handleTextFormatShortcuts);
    targetDocument.textFormatShortcutsBound = true;

    return null;
}

// Инициализация обработчиков горячих клавиш форматирования для текущего документа
attachTextFormatShortcutHandlers(document);
window.editorBlock.attachTextFormatShortcutHandlers = attachTextFormatShortcutHandlers;

// Поиск кнопок на панели форматирования
const actionButtons = document.getElementById('editorBlock').querySelectorAll('[data-simpleformats-button]');

// Навешивание обработчиков событий для кнопок
for (const actionButton of actionButtons) {
    actionButton.addEventListener('click', handleFormatClick);
}

// Поиск выпадающих списков на панели форматирования
const actionSelects = document.getElementById('editorBlock').querySelectorAll('[data-property-item]');

// Навешивание обработчиков событий для выпадающих списков
for (const actionSelect of actionSelects) {
    actionSelect.addEventListener('click', handleSelectChange);
}

// Навешивание обработчика на изменение выделения в документе
document.addEventListener('selectionchange', handleSelectionChange);