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




/***********************************************************************
 * Элементы вкладок view / html / js центрального редактора.
 **********************************************************************/
const centerContent = document.getElementById('center-tab-content');
const centerPreHtml = document.getElementById('center-tab-pre-html');
const centerPreJs = document.getElementById('center-tab-pre-js');
/* const btnLoadFromView = document.getElementById('btn-load-from-view');
const btnApplyToView = document.getElementById('btn-apply-to-view'); */


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
        view;
    selectElementForPanels(el);
});