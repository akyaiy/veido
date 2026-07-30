/* ===
 * Модуль структуры дерева (treeElements)
=== */

// Хранилище связей между реальным DOM-элементом и его строкой в дереве
const elementToTreeNodeMap = new WeakMap();
let currentSelectedTreeNode = null;
let iframeDOMObserver = null;



/* ===
 * Инициализация и построение дерева
=== */

/* ***
 * initTreeElements - инициализация дерева элементов из iframe
 * - принимает элемент iframe
 * - очищает контейнер, запускает построение и подписывается на изменения DOM
*** */
function initTreeElements(iframeElement) {
    const treeContainer = document.getElementById('treeElementsBody');
    
    if (!treeContainer || !iframeElement) {
        return;
    }

    const iframeDoc = iframeElement.contentDocument || iframeElement.contentWindow.document;
    const bodyElement = iframeDoc.body;

    // Отключаем предыдущий наблюдатель перед пересозданием
    if (iframeDOMObserver) {
        iframeDOMObserver.disconnect();
        iframeDOMObserver = null;
    }

    treeContainer.innerHTML = '';
    
    if (bodyElement) {
        Array.from(bodyElement.children).forEach(child => {
            buildTreeNode(child, treeContainer);
        });

        // Отслеживаем изменение структуры DOM внутри body
        iframeDOMObserver = new MutationObserver(() => {
            initTreeElements(iframeElement);
        });

        iframeDOMObserver.observe(bodyElement, {
            childList: true,
            subtree: true
        });
    }
}
window.editorBlock.initTreeElements = initTreeElements; 

/* ***
 * buildTreeNode - рекурсивное построение вложенных элементов дерева
 * - принимает DOM-элемент и контейнер
 * - формирует структурированные списки с отступами
*** */
function buildTreeNode(element, container) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) {
        return;
    }

    const tagName = element.tagName.toLowerCase();

    // Игнорируем служебные элементы, не влияющие на визуальную верстку
    if (tagName === 'script' || tagName === 'style' || tagName === 'link' || tagName === 'meta') {
        return;
    }

    // Создаем элемент строки дерева
    const nodeItem = document.createElement('div');
    nodeItem.className = 'treeElementsItem';
    nodeItem.textContent = tagName;
    
    elementToTreeNodeMap.set(element, nodeItem);

    // Обработка клика по элементу в дереве
    nodeItem.addEventListener('click', (event) => {
        event.stopPropagation();
        selectElementInIframe(element);
    });

    container.appendChild(nodeItem);

    // Отбор только видимых HTML-узлов (без текста и комментариев)
    const children = Array.from(element.children).filter(child => {
        const tag = child.tagName.toLowerCase();
        return tag !== 'script' && tag !== 'style' && tag !== 'link' && tag !== 'meta';
    });

    if (children.length > 0) {
        const childrenContainer = document.createElement('div');
        childrenContainer.className = 'treeElementsChildren';

        children.forEach(child => {
            buildTreeNode(child, childrenContainer);
        });

        container.appendChild(childrenContainer);
    }
}



/* ===
 * Синхронизация и выбор элементов
=== */

/* ***
 * selectElementInIframe - эмуляция выбора элемента в редакторе
 * - принимает целевой HTML-элемент
 * - закликает элемент и отправляет событие для панели свойств
*** */
function selectElementInIframe(element) {
    if (!element) {
        return;
    }

    element.click();

    const selectionEvent = new CustomEvent('editorBlock:elementSelected', { detail: element });
    document.dispatchEvent(selectionEvent);
}

/* ***
 * syncTreeSelection - визуальное выделение узла в дереве
 * - принимает выбранный HTML-элемент (приходит из события)
 * - снимает старое выделение, подсвечивает новое и скроллит к нему
*** */
function syncTreeSelection(element) {
    if (currentSelectedTreeNode) {
        currentSelectedTreeNode.classList.remove('active');
        currentSelectedTreeNode = null;
    }

    if (!element) {
        return;
    }

    const treeNode = elementToTreeNodeMap.get(element);
    
    if (treeNode) {
        treeNode.classList.add('active');
        currentSelectedTreeNode = treeNode;
        
        // Плавная прокрутка контейнера дерева к выбранному элементу
        treeNode.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

// Подписка на глобальное событие выбора для двусторонней синхронизации
document.addEventListener('editorBlock:elementSelected', event => {
    syncTreeSelection(event.detail);
});