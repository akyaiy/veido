/* ===
 * Вспомогательные функции работы с атрибутами
=== */

/* ***
 * markBlockDirty - безопасный вызов функции пометки изменения блока
 * - принимает элемент внутри измененного блока
*** */
function markBlockDirty(element) {
    if (!element) {
        return;
    }

    const view = element.closest('[id^="loadedBlock_"][id$="_view"]');

    if (view) {
        view.dataset.dirty = 'true';
    }
}



/* ===
 * Управление структурой таблицы атрибутов
=== */

/* ***
 * createAttributeRow - создает новую строку в таблице с полями ввода для имени и значения атрибута
 * - принимает имя атрибута и значение атрибута
*** */
function createAttributeRow(name, value) {
    const panel = document.getElementById('attributesPanel');
    if (!panel) {
        return;
    }

    const tr = document.createElement('tr');
    const td1 = document.createElement('td');
    const td2 = document.createElement('td');

    const attrInput = document.createElement('input');
    attrInput.placeholder = 'attribute';
    attrInput.value = name || '';
    attrInput.dataset.prev = name || '';

    const valInput = document.createElement('input');
    valInput.placeholder = 'value';
    valInput.value = value || '';

    td1.appendChild(attrInput);
    td2.appendChild(valInput);
    tr.append(td1, td2);
    panel.appendChild(tr);
}

/* ***
 * ensureEmptyRow - проверяет последнюю строку таблицы и при необходимости добавляет пустую
*** */
function ensureEmptyRow() {
    const panel = document.getElementById('attributesPanel');
    if (!panel) {
        return;
    }

    const lastTr = panel.lastElementChild;

    if (!lastTr) {
        createAttributeRow('', '');
        return;
    }

    const attrInput = lastTr.querySelector('input[placeholder="attribute"]');
    const valInput = lastTr.querySelector('input[placeholder="value"]');

    if (!attrInput || !valInput) {
        createAttributeRow('', '');
        return;
    }

    if (attrInput.value.trim() !== '' || valInput.value.trim() !== '') {
        createAttributeRow('', '');
    }
}

/* ***
 * updateAttributesPanel - очищает таблицу и заполняет ее всеми атрибутами выбранного элемента
 * - принимает выбранный элемент
*** */
function updateAttributesPanel(element) {
    const panel = document.getElementById('attributesPanel');
    if (!panel) {
        return;
    }

    panel.innerHTML = '';

    if (!element) {
        ensureEmptyRow();
        return;
    }

    const attributeNames = element.getAttributeNames();

    for (const name of attributeNames) {
        const value = element.getAttribute(name) || '';
        createAttributeRow(name, value);
    }

    ensureEmptyRow();
}



/* ===
 * Обработчики событий панели свойств и выбор элементов
=== */

const panel = document.getElementById('attributesPanel');

// обработчик ввода значений
panel.addEventListener('input', event => {
    const input = event.target;
    const tr = input.closest('tr');
    if (!tr) {
        return;
    }

    const attrInput = tr.querySelector('input[placeholder="attribute"]');
    const valInput = tr.querySelector('input[placeholder="value"]');
    if (!attrInput || !valInput) {
        return;
    }

    const el = window.editorBlock ? window.editorBlock.selectedElement : null;
    const prevName = attrInput.dataset.prev || '';
    const nameNow = attrInput.value.trim();
    const valNow = valInput.value;

    if (input === attrInput) {
        if (prevName && prevName !== nameNow && el) {
            el.removeAttribute(prevName);
        }
        if (nameNow && el) {
            el.setAttribute(nameNow, valNow);
            markBlockDirty(el);
        }
        attrInput.dataset.prev = nameNow;
    } else if (input === valInput) {
        if (nameNow && el) {
            el.setAttribute(nameNow, valNow);
            markBlockDirty(el);
        }
    }

    ensureEmptyRow();
});

// обработчик потери фокуса для удаления пустых или неполных строк
panel.addEventListener('focusout', event => {
    const input = event.target;
    const tr = input.closest('tr');
    if (!tr) {
        return;
    }

    const attrInput = tr.querySelector('input[placeholder="attribute"]');
    const valInput = tr.querySelector('input[placeholder="value"]');
    if (!attrInput || !valInput) {
        return;
    }

    const nameNow = attrInput.value.trim();
    const prevName = attrInput.dataset.prev || '';
    const el = window.editorBlock ? window.editorBlock.selectedElement : null;

    // удаляем атрибут и строку если имя пустое
    if (!nameNow) {
        if (prevName && el) {
            el.removeAttribute(prevName);
            markBlockDirty(el);
        }
        if (tr !== panel.lastElementChild) {
            tr.remove();
        } else {
            attrInput.dataset.prev = '';
        }
        ensureEmptyRow();
    }
});

// слушатель выбора нового элемента в редакторе
document.addEventListener('elementSelected', event => {
    const selectedElement = event.detail;
    updateAttributesPanel(selectedElement);
});