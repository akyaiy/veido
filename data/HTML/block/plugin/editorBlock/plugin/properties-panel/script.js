// --- новая функция для присвоения active ---
function updateButtonActive(button, el, key) {
    button.classList.remove('active');

    const textAlign = getComputedProp(el, 'textAlign') || 'left';

    switch (key) {
        case 'bold':
            if (getComputedProp(el, 'fontWeight') === 'bold') button.classList.add('active');
            break;
        case 'italic':
            if (getComputedProp(el, 'fontStyle') === 'italic') button.classList.add('active');
            break;
        case 'underline':
            if (getComputedProp(el, 'textDecoration').includes('underline')) button.classList.add('active');
            break;
        case 'strike':
            if (getComputedProp(el, 'textDecoration').includes('line-through')) button.classList.add('active');
            break;
        case 'sup':
            if (getComputedProp(el, 'verticalAlign') === 'super') button.classList.add('active');
            break;
        case 'sub':
            if (getComputedProp(el, 'verticalAlign') === 'sub') button.classList.add('active');
            break;
        case 'text-align-left':
            if (textAlign === 'left' || textAlign === 'start') button.classList.add('active');
            break;
        case 'text-align-center':
            if (textAlign === 'center') button.classList.add('active');
            break;
        case 'text-align-right':
            if (textAlign === 'right' || textAlign === 'end') button.classList.add('active');
            break;
        case 'text-align-justify':
            if (textAlign === 'justify') button.classList.add('active');
            break;
        case 'list-disc':
            if (getSelectionListType() === 'disc') button.classList.add('active');
            break;
        case 'list-circle':
            if (getSelectionListType() === 'circle') button.classList.add('active');
            break;
        case 'list-square':
            if (getSelectionListType() === 'square') button.classList.add('active');
            break;
        case 'list-decimal':
            if (getSelectionListType() === 'decimal') button.classList.add('active');
            break;
    }
}





// Конфигурация кнопок форматов (key, type, target, style)
const FORMAT_BUTTONS = [
    { key: 'bold', type: 'toggle', target: 'inline', style: { prop: 'fontWeight', value: 'bold' } },
    { key: 'italic', type: 'toggle', target: 'inline', style: { prop: 'fontStyle', value: 'italic' } },
    { key: 'underline', type: 'toggle', target: 'inline', style: { prop: 'textDecoration', value: 'underline' } },
    { key: 'strike', type: 'toggle', target: 'inline', style: { prop: 'textDecoration', value: 'line-through' } },
    { key: 'sup', type: 'toggle', target: 'inline', style: { prop: 'verticalAlign', value: 'super' } },
    { key: 'sub', type: 'toggle', target: 'inline', style: { prop: 'verticalAlign', value: 'sub' } },
    { key: 'text-color', type: 'color', target: 'inline', style: { prop: 'color' } },
    { key: 'bg-color', type: 'color', target: 'inline', style: { prop: 'backgroundColor' } },
    { key: 'delete', type: 'action', target: 'any', action: 'remove-all' }
];

// Конфигурация селектов (key, css, target)
const FORMAT_SELECTS = [
    { key: 'font-size', css: 'fontSize', target: 'inline' },
    { key: 'font-family', css: 'fontFamily', target: 'inline' },
    { key: 'text-align', css: 'textAlign', target: 'block' },
    { key: 'line-height', css: 'lineHeight', target: 'block' },
    { key: 'padding', css: 'padding', target: 'block' },
    { key: 'list', css: 'listStyleType', target: 'block' }
];

/* Utility: вернуть текущий Range, если выделение внутри el или на документе */
function getCurrentRange() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return range; // возвращаем коллапсный range для применения к элементу
    return range;
}

/* Utility: возвращает корневой element для range */
function getRangeRootElement(range) {
    return range.commonAncestorContainer.nodeType === 1
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
}

/* Utility: вернуть текстовые узлы, пересекающиеся с range */
function getTextNodesInRange(range) {
    const root = getRangeRootElement(range);
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
            if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
            try { return range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT; }
            catch (e) { return NodeFilter.FILTER_ACCEPT; }
        }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    return nodes;
}

/* Utility: вернуть все текстовые узлы под элементом */
function getTextNodesUnder(element) {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null);
    const res = [];
    while (walker.nextNode()) res.push(walker.currentNode);
    return res;
}

/* Utility: делит текстовый узел так, чтобы выбранная часть стала отдельным узлом */
function splitTextNodeByRange(textNode, range) {
    const isStart = textNode === range.startContainer;
    const isEnd = textNode === range.endContainer;
    const start = isStart ? range.startOffset : 0;
    const end = isEnd ? range.endOffset : textNode.length;
    if (start === 0 && end === textNode.length) return textNode;
    let node = textNode;
    if (end < node.length) node.splitText(end);
    if (start > 0) return node.splitText(start);
    return node;
}

/* Utility: обернуть текстовый узел в span, если нужно */
function ensureWrapperSpanForTextNode(textNode) {
    if (!textNode) return null;
    const parent = textNode.parentNode;
    if (!parent) return null;

    if (parent.tagName === 'SPAN' && parent.getAttribute('data-format') === 'true') {
        if (parent.childNodes.length === 1) return parent;

        const parentParent = parent.parentNode;
        if (!parentParent) return null;

        const before = parent.cloneNode(false);
        const middle = parent.cloneNode(false);
        const after = parent.cloneNode(false);

        let isAfterTarget = false;
        Array.from(parent.childNodes).forEach(child => {
            if (child === textNode) {
                middle.appendChild(child);
                isAfterTarget = true;
            } else if (!isAfterTarget) before.appendChild(child);
            else after.appendChild(child);
        });

        if (before.hasChildNodes()) parentParent.insertBefore(before, parent);
        parentParent.insertBefore(middle, parent);
        if (after.hasChildNodes()) parentParent.insertBefore(after, parent);

        parentParent.removeChild(parent);
        return middle;
    }

    const span = document.createElement('span');
    span.setAttribute('data-format', 'true');
    parent.insertBefore(span, textNode);
    span.appendChild(textNode);
    return span;
}


/* Utility: разворачивает span если у него нет стилей */
function cleanupSpanIfEmpty(span) {
    if (!span || span.nodeType !== 1 || span.tagName !== 'SPAN') return;
    const style = span.getAttribute('style');
    if (!style || style.trim() === '') {
        const parent = span.parentNode;
        while (span.firstChild) parent.insertBefore(span.firstChild, span);
        span.remove();
    }
}

/* Utility: сливает соседние span с одинаковым style */
function mergeAdjacentSpans(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, null);
    const toVisit = [];
    while (walker.nextNode()) toVisit.push(walker.currentNode);
    for (const el of toVisit) {
        if (el.tagName === 'SPAN') {
            let next = el.nextSibling;
            if (next && next.nodeType === 1 && next.tagName === 'SPAN' &&
                el.getAttribute('style') === next.getAttribute('style')) {
                while (next.firstChild) el.appendChild(next.firstChild);
                next.remove();
            }
        }
    }
}

/* Utility: находит блочные контейнеры (div, p, section...) для выделения */
function getBlockContainersForRange(range) {
    const root = getRangeRootElement(range);
    const textNodes = getTextNodesInRange(range);
    const containers = new Set();
    for (const tn of textNodes) {
        let el = tn.parentElement;
        while (el && el !== root && el !== document.body) {
            const cs = window.getComputedStyle(el);
            if (cs && cs.display && cs.display !== 'inline' && cs.display !== 'inline-block') {
                containers.add(el);
                break;
            }
            el = el.parentElement;
        }
        if (!el && tn.parentElement) containers.add(tn.parentElement);
    }
    return Array.from(containers);
}

function applyInlineStyleToSelection(styleProp, styleValue) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    const root = getRangeRootElement(range);
    
    // 1. изолируем текстовые узлы в выделении
    const textNodes = isolateTextNodes(range);
    if (!textNodes.length) return;

    // 2. режем родительские span перед первым и после последнего текста
    splitParentsAtNode(textNodes[0], true);  
    splitParentsAtNode(textNodes[textNodes.length - 1], false);

    // 3. применяем стиль к изолированным текстовым узлам
    for (const tn of textNodes) {
        if (!tn.textContent.trim() && tn.parentNode.tagName !== 'SPAN') continue;

        let parent = tn.parentNode;
        if (!parent || parent.tagName !== 'SPAN') {
            parent = ensureWrapperSpanForTextNode(tn);
        }

        const isTextDecoration = styleProp === 'textDecoration';
        const currentTd = parent.style.textDecoration || '';
        const parts = currentTd.split(/\s+/).filter(Boolean);
                    
        if (isTextDecoration) {
            if (!styleValue) {
                parent.style.textDecoration = '';
            } else {
                if (parts.includes(styleValue)) {
                    parent.style.textDecoration = parts.filter(v => v !== styleValue).join(' ');
                } else {
                    parts.push(styleValue);
                    parent.style.textDecoration = parts.join(' ');
                }
            }
        } else {
            parent.style[styleProp] = styleValue || '';
        }

        cleanupSpanIfEmpty(parent);
    }

    // 4. склеиваем соседние span с одинаковыми стилями
    mergeAdjacentSpans(root);
    const spans = root.querySelectorAll('span');
    spans.forEach(s => cleanupSpanIfEmpty(s));

    // 5. восстанавливаем выделение
    try {
        const newRange = document.createRange();
        newRange.setStartBefore(textNodes[0]);
        newRange.setEndAfter(textNodes[textNodes.length - 1]);
        sel.removeAllRanges();
        sel.addRange(newRange);
    } catch (e) {}
}

// --- вспомогательные функции ---

// изолирует текстовые узлы в выделении
function isolateTextNodes(range) {
    let startNode = range.startContainer;
    let startOffset = range.startOffset;
    let endNode = range.endContainer;
    let endOffset = range.endOffset;

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
    if (startNode.nodeType === Node.TEXT_NODE) newRange.setStart(startNode, 0);
    else newRange.setStart(startNode, startOffset);
    
    if (endNode.nodeType === Node.TEXT_NODE) newRange.setEnd(endNode, endNode.length);
    else newRange.setEnd(endNode, endOffset);

    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(newRange);

    return getTextNodesInRange(newRange);
}

// рекурсивно режет родительские span до contenteditable
function splitParentsAtNode(textNode, isBefore) {
    let current = textNode;
    
    while (current.parentNode && current.parentNode.tagName === 'SPAN') {
        const parent = current.parentNode;
        const clone = parent.cloneNode(false);
        
        if (isBefore) {
            let sibling = parent.firstChild;
            while (sibling !== current) {
                let next = sibling.nextSibling;
                clone.appendChild(sibling);
                sibling = next;
            }
            if (clone.childNodes.length > 0) {
                parent.parentNode.insertBefore(clone, parent);
            }
        } else {
            let sibling = current.nextSibling;
            while (sibling) {
                let next = sibling.nextSibling;
                clone.appendChild(sibling);
                sibling = next;
            }
            if (clone.childNodes.length > 0) {
                parent.parentNode.insertBefore(clone, parent.nextSibling);
            }
        }
        current = parent;
    }
}

/* Основная: применять/удалять блочный стиль к ближайшим блочным контейнерам */
function applyBlockStyleToSelection(cssProp, cssValue) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    // --- Вспомогательная функция: разворачивает div с заданным cssProp ---
    function unwrapDivWithProp(node) {
        if (!node) return;
        const divs = node.querySelectorAll(`div[style*="${cssProp}"]`);
        divs.forEach(d => {
            while (d.firstChild) d.parentNode.insertBefore(d.firstChild, d);
            d.remove();
        });
        if (node.nodeType === 1 && node.tagName === 'DIV') {
            const style = node.style[cssProp];
            if (style) {
                while (node.firstChild) node.parentNode.insertBefore(node.firstChild, node);
                node.remove();
            }
        }
    }

    // --- извлекаем содержимое временно ---
    const frag = range.extractContents();

    // --- разворачиваем старые div с тем же cssProp внутри фрагмента ---
    const tempContainer = document.createElement('div');
    tempContainer.appendChild(frag);
    unwrapDivWithProp(tempContainer);

    // --- создаём новый div и применяем стиль ---
    const div = document.createElement('div');
    if (cssValue) div.style[cssProp] = cssValue;

    // --- помещаем содержимое внутрь нового div ---
    while (tempContainer.firstChild) div.appendChild(tempContainer.firstChild);

    // --- вставляем div обратно в документ ---
    range.insertNode(div);

    // --- восстанавливаем выделение на новый div ---
    sel.removeAllRanges();
    const newRange = document.createRange();
    newRange.selectNodeContents(div);
    sel.addRange(newRange);
}


/* Удаление формата: удаляет style у span и у других тегов внутри выделения */
function removeFormattingInSelection() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    // извлечь содержимое выделения
    const frag = range.extractContents();

    // рекурсивная очистка фрагмента
    (function clean(node) {
        // проходим детей сначала (depth-first)
        const children = Array.from(node.childNodes);
        for (const ch of children) {
            if (ch.nodeType === Node.ELEMENT_NODE) clean(ch);
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const tag = node.tagName;

        // 1) Развернуть <a> — удалить сам тег, оставить содержимое
        if (tag === 'A') {
            const parent = node.parentNode;
            while (node.firstChild) parent.insertBefore(node.firstChild, node);
            parent.removeChild(node);
            return;
        }

        // 2) Поменять <ul>/<ol> на последовательность li->content + <br>
        if (tag === 'UL' || tag === 'OL') {
            const wrapper = document.createDocumentFragment();
            const lis = Array.from(node.children).filter(n => n.tagName === 'LI');
            for (const li of lis) {
                // перенести содержимое li
                while (li.firstChild) wrapper.appendChild(li.firstChild);
                // добавить br для разделения пунктов
                wrapper.appendChild(document.createElement('br'));
            }
            // если нет li — просто разворачиваем(удаляем) сам список
            if (!lis.length) {
                while (node.firstChild) wrapper.appendChild(node.firstChild);
            }
            node.parentNode.replaceChild(wrapper, node);
            return;
        }

        // 3) Удалить стилевые и служебные атрибуты, влияющие на отображение
        // удаляем: style, class, align
        node.removeAttribute('style');
        node.removeAttribute('class');
        node.removeAttribute('align');

        // дополнительно: удалить inline-атрибуты, которые используются для размеров/границ
        // (если не нужны, можно расширить список)
        node.removeAttribute('width');
        node.removeAttribute('height');
        node.removeAttribute('cellpadding');
        node.removeAttribute('cellspacing');
        node.removeAttribute('border');
        node.removeAttribute('bgcolor');

        // 4) Если это <span> и после очистки он пустой от атрибутов — разворачиваем
        if (tag === 'SPAN') {
            if (!node.attributes.length) {
                const parent = node.parentNode;
                while (node.firstChild) parent.insertBefore(node.firstChild, node);
                parent.removeChild(node);
            }
        }
    })(frag);

    // дополнительная чистка: сливаем подряд идущие <br> (оставляем максимум один)
    (function collapseBrs(root) {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null);
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        for (const n of nodes) {
            if (n.nodeType === 1) {
                let child = n.firstChild;
                while (child) {
                    if (child.nodeType === 1 && child.tagName === 'BR') {
                        let next = child.nextSibling;
                        // удалить повторяющиеся BR подряд
                        while (next && next.nodeType === 1 && next.tagName === 'BR') {
                            const toRemove = next;
                            next = next.nextSibling;
                            toRemove.parentNode.removeChild(toRemove);
                        }
                        child = next;
                    } else child = child.nextSibling;
                }
            }
        }
    })(frag);

    // вставить очищённый фрагмент обратно и восстановить выделение на вставленное содержимое
    range.insertNode(frag);

    // опционально: поместить курсор в конец вставленного содержимого
    sel.removeAllRanges();
    const newRange = document.createRange();
    // пытаемся выбрать вставленный узел(ы) — выбираем следующий узел после range.startContainer
    try {
        // если вставлен фрагмент — не всегда есть простой way; попробуем выбрать после startContainer
        const after = range.startContainer.nodeType === 3 ? range.startContainer : range.startContainer;
        newRange.setStartAfter(after);
        newRange.collapse(true);
        sel.addRange(newRange);
    } catch (e) {
        // безопасный fallback — ничего не делать
    }
}

/* Toggle: простые форматы (bold/italic/underline/strike/sup/sub) */
function toggleInlineFormatting(key) {
    const map = {
        bold: { prop: 'fontWeight', value: 'bold' },
        italic: { prop: 'fontStyle', value: 'italic' },
        underline: { prop: 'textDecoration', value: 'underline' },
        strike: { prop: 'textDecoration', value: 'line-through' },
        sup: { prop: 'verticalAlign', value: 'super' },
        sub: { prop: 'verticalAlign', value: 'sub' }
    };
    if (!map[key]) return;
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const nodes = getTextNodesInRange(range);
    if (!nodes.length) return;
    const { prop, value } = map[key];
    let allHave = true;
    for (const tn of nodes) {
        const p = tn.parentNode;
        if (!(p && p.nodeType === 1 && p.tagName === 'SPAN' && p.style[prop] === value)) { allHave = false; break; }
    }
    applyInlineStyleToSelection(prop, allHave ? '' : value);
}

/* Обработчик кнопок: использует конфиг FORMAT_BUTTONS */
function handleSimpleFormatClick(button, el, key) {
    if (document.activeElement !== el) { /* el.focus(); */ }

    if (key.startsWith('text-align-')) {
        const value = key.slice('text-align-'.length);
        const current = getSelectValue(el, 'text-align');
        applyBlockStyleToSelection('textAlign', current === value ? '' : value);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }
    if (key.startsWith('list-')) {
        const listType = key.slice('list-'.length);
        const current = getSelectionListType() || getSelectValue(el, 'list');
        if (current === listType) toggleListForSelection('none');
        else toggleListForSelection(listType);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }

    const cfg = FORMAT_BUTTONS.find(x => x.key === key);
    if (!cfg) return;
    if (cfg.type === 'toggle' && cfg.target === 'inline') {
        toggleInlineFormatting(key);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }
    if (cfg.type === 'color' && cfg.target === 'inline' && cfg.style) {
        /* applyInlineStyleToSelection(cfg.style.prop, val === '' ? '' : val);
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el); */
        return;
    }
    if (cfg.type === 'action' && cfg.action === 'remove-all') {
        removeFormattingInSelection();
        if (typeof updateSimpleFormats === 'function') updateSimpleFormats(el);
        return;
    }
}

/* определние стиля списка у текста */
function getSelectionListType() {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return '';

    const range = sel.getRangeAt(0);

    // --- fallback: если курсор/выделение внутри одного li ---
    let node = range.commonAncestorContainer;
    if (node.nodeType === 3) node = node.parentElement;
    const singleLi = node.closest && node.closest('li');
    if (singleLi) {
        const list = singleLi.closest('ul,ol');
        if (list) {
            const type = (list.style.listStyleType || getComputedStyle(list).listStyleType || '').trim();
            if (type) return type;
            if (list.tagName === 'OL') return 'decimal';
            return 'disc';
        }
    }

    const root = getRangeRootElement(range);
    if (!root) return '';

    const lists = new Set();

    root.querySelectorAll('li').forEach(li => {
        try {
            if (range.intersectsNode(li)) {
                const list = li.closest('ul,ol');
                if (list) lists.add(list);
            }
        } catch (e) {}
    });

    if (!lists.size || lists.size > 1) return '';

    const list = [...lists][0];
    const type = (list.style.listStyleType || getComputedStyle(list).listStyleType || '').trim();

    if (type) return type;
    if (list.tagName === 'OL') return 'decimal';
    return 'disc';
}

/* Обработчик select: возвращает onchange-функцию (использует FORMAT_SELECTS) */
function createSelectChangeHandler(el, prop) {
    return e => {
        const v = e.target.value;
        const cfg = FORMAT_SELECTS.find(s => s.key === prop);
        const target = cfg ? cfg.target : 'inline';
        const css = cfg ? cfg.css : prop;
        if (v === '' || v === '-' || v === 'none') {
            if (target === 'block') {
                if (prop === 'list') toggleListForSelection('none');
                else applyBlockStyleToSelection(css, '');
            } else {
                applyInlineStyleToSelection(css === 'fontSize' ? 'fontSize' : css, '');
            }
            if (typeof updateSelectProperties === 'function') updateSelectProperties(el);
            return;
        }
        if (target === 'block') {
            if (prop === 'list') {
                if (v === 'decimal') toggleListForSelection('decimal');
                else toggleListForSelection(v);
            } else {
                applyBlockStyleToSelection(css, v);
                if (prop === 'border-width') applyBlockStyleToSelection('borderStyle', 'solid');
            }
        } else {
            applyInlineStyleToSelection(css === 'fontSize' ? 'fontSize' : css, v);
        }
        if (typeof updateSelectProperties === 'function') updateSelectProperties(el);
    };
}

/* Переключатель списков: использует блочные контейнеры */
function toggleListForSelection(listType) {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;

    // получаем блочные контейнеры для выделения
    let blocks = getBlockContainersForRange(range);

    // если блочных контейнеров нет — оборачиваем выделение в div и используем его
    if (!blocks.length) {
        // Вырезаем содержимое range во фрагмент
        const frag = range.extractContents();
        const wrapper = document.createElement('div');
        // вставляем содержимое внутрь wrapper
        wrapper.appendChild(frag);
        // вставляем wrapper на место range
        range.insertNode(wrapper);

        // обновляем selection — теперь wrapper покрывает вставленное содержимое
        sel.removeAllRanges();
        const newRange = document.createRange();
        newRange.selectNodeContents(wrapper);
        sel.addRange(newRange);

        blocks = [wrapper];
    }

    // helper: удалить list (unwrap li -> содержимое, убрать пустой список)
    if (listType === 'none') {
        blocks.forEach(block => {
            const li = block.closest('li');
            if (li) {
                const parentList = li.parentElement;        // ul/ol
                const grandParent = parentList.parentElement; // куда вернуть содержимое li
                // вставляем содержимое li перед списком
                while (li.firstChild) grandParent.insertBefore(li.firstChild, parentList);
                li.remove();
                // если список пуст - удаляем
                if (!parentList.querySelector('li')) parentList.remove();
            } else {
                // если блок сам внутри списка (например wrapper внутри ul/ol), попробуем распаковать его
                const parentList = block.closest('ul,ol');
                if (parentList) {
                    // для каждого li внутри parentList: если li содержит наш block, разворачиваем
                    const lis = Array.from(parentList.querySelectorAll('li'));
                    lis.forEach(liItem => {
                        if (liItem.contains(block)) {
                            while (liItem.firstChild) parentList.parentNode.insertBefore(liItem.firstChild, parentList);
                            liItem.remove();
                        }
                    });
                    if (!parentList.querySelector('li')) parentList.remove();
                }
            }
        });
        return;
    }

    // otherwise — создать/изменить список
    let i = 0;
    while (i < blocks.length) {
        const block = blocks[i];
        const parentList = block.closest('ul, ol');

        // если уже в списке — изменить тип/стиль списка
        if (parentList) {
            if (listType === 'decimal') {
                if (parentList.tagName !== 'OL') {
                    const ol = document.createElement('ol');
                    if (parentList.parentNode) {
                        while (parentList.firstChild) {
                            ol.appendChild(parentList.firstChild);
                        }
                        parentList.parentNode.replaceChild(ol, parentList);
                    }
                }
            } else {
                if (parentList.tagName !== 'UL') {
                    const ul = document.createElement('ul');
                    if (parentList.parentNode) {
                        while (parentList.firstChild) {
                            ul.appendChild(parentList.firstChild);
                        } 
                        parentList.parentNode.replaceChild(ul, parentList);
                    }
                }
                parentList.style.listStyleType = listType;
            }
            i++;
            continue;
        }

        // группируем последовательные блоки (если есть) в одну группу
        const group = [block];
        let j = i + 1;
        while (j < blocks.length) { group.push(blocks[j]); j++; }

        // создаём список нужного типа
        const listEl = listType === 'decimal' ? document.createElement('ol') : document.createElement('ul');
        if (listType !== 'decimal') listEl.style.listStyleType = listType;

        const first = group[0];
        first.parentNode.insertBefore(listEl, first);

        // переносим содержимое каждого блока в <li>
        for (const b of group) {
            const li = document.createElement('li');
            // переносим все дочерние узлы блока в li
            while (b.firstChild) li.appendChild(b.firstChild);
            listEl.appendChild(li);
            b.remove();
        }

        i = j;
    }
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