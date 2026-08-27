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
    resize: { type: 'style', cssName: 'resize' },

    // Свойства Grid
    layoutType: { type: 'special', action: 'layoutType' },
    gridPreset: { type: 'special', action: 'gridPreset' },
    gridRows: { type: 'special', action: 'gridDimension', axis: 'rows' },
    gridColumns: { type: 'special', action: 'gridDimension', axis: 'columns' },
    gridGap: { type: 'special', action: 'gridGap' },
    gridAutoFit: { type: 'special', action: 'gridAutoFit' },
    gridMinWidth: { type: 'special', action: 'gridAutoFitSetting' },
    gridNormalWidth: { type: 'special', action: 'gridAutoFitSetting' },
    gridMaxWidth: { type: 'special', action: 'gridAutoFitSetting' },
    autoFitMode: { type: 'special', action: 'gridAutoFitSetting' },
    columnTracks: { type: 'special', action: 'gridTracks', axis: 'columns' },
    rowTracks: { type: 'special', action: 'gridTracks', axis: 'rows' },
    columnGap: { type: 'style', cssName: 'columnGap', isNumeric: true },
    rowGap: { type: 'style', cssName: 'rowGap', isNumeric: true },
    gridPadding: { type: 'style', cssName: 'padding', isNumeric: true },
    autoFlow: { type: 'style', cssName: 'gridAutoFlow' },
    fluidGapEnabled: { type: 'special', action: 'fluidGapEnabled' },
    fluidGapMin: { type: 'special', action: 'fluidGapRange' },
    fluidGapMax: { type: 'special', action: 'fluidGapRange' },
    gridColumnSpan: { type: 'special', action: 'gridItemSpan', axis: 'columns' },
    gridRowSpan: { type: 'special', action: 'gridItemSpan', axis: 'rows' },
    gridItemColumn: { type: 'special', action: 'gridItemStart', axis: 'columns' },
    gridItemRow: { type: 'special', action: 'gridItemStart', axis: 'rows' },
    gridItemColumns: { type: 'special', action: 'gridItemSpan', axis: 'columns' },
    gridItemRows: { type: 'special', action: 'gridItemSpan', axis: 'rows' },

    // Свойства Flex
    flexPreset: { type: 'special', action: 'flexPreset' },
    flexDirection: { type: 'style', cssName: 'flexDirection' },
    flexGap: { type: 'style', cssName: 'gap', isNumeric: true },
    flexWrap: { type: 'special', action: 'flexWrap' },
    flexJustify: { type: 'style', cssName: 'justifyContent' },
    flexAlign: { type: 'style', cssName: 'alignItems' },
    flexAdvancedDirection: { type: 'style', cssName: 'flexDirection' },
    flexAdvancedWrap: { type: 'style', cssName: 'flexWrap' },
    flexAdvancedGap: { type: 'style', cssName: 'gap', isNumeric: true },
    flexAlignContent: { type: 'style', cssName: 'alignContent' },
    flexAdvancedJustify: { type: 'style', cssName: 'justifyContent' },
    flexAdvancedAlign: { type: 'style', cssName: 'alignItems' },
    flexItemSize: { type: 'special', action: 'flexItemSize' },
    flexBasis: { type: 'special', action: 'flexBasis' },
    flexGrow: { type: 'style', cssName: 'flexGrow' },
    flexShrink: { type: 'style', cssName: 'flexShrink' },
    flexSelf: { type: 'style', cssName: 'alignSelf' },
    flexOrder: { type: 'style', cssName: 'order' },
    itemMinWidth: { type: 'style', cssName: 'minWidth', isNumeric: true },
    itemMaxWidth: { type: 'style', cssName: 'maxWidth', isNumeric: true },
    itemMinHeight: { type: 'style', cssName: 'minHeight', isNumeric: true },
    itemMaxHeight: { type: 'style', cssName: 'maxHeight', isNumeric: true },
    itemHidden: { type: 'special', action: 'itemHidden' },
    itemAspectRatio: { type: 'style', cssName: 'aspectRatio' },
    itemOverflow: { type: 'style', cssName: 'overflow' },
    textWrapMode: { type: 'special', action: 'textWrapMode' },
    textOverflowMode: { type: 'style', cssName: 'textOverflow' },

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

function getGridTemplateState(element, axis) {
    const gridProperty = axis === 'rows' ? 'grid-template-rows' : 'grid-template-columns';
    const inlineValue = element.style.getPropertyValue(gridProperty);
    const computedValue = element.ownerDocument.defaultView.getComputedStyle(element).getPropertyValue(gridProperty);
    const template = inlineValue || computedValue || '';
    const cleanTemplate = String(template).trim();

    if (!cleanTemplate || cleanTemplate === 'none') {
        return {
            count: 1,
            size: '1fr',
            template: ''
        };
    }

    const repeatMatch = cleanTemplate.match(
        /repeat\(\s*(\d+)\s*,\s*([^\)]+)\)/i
    );

    if (repeatMatch) {
        return {
            count: Number(repeatMatch[1]) || 1,
            size: repeatMatch[2].trim() || '1fr',
            template: cleanTemplate
        };
    }

    const adaptiveMatch = cleanTemplate.match(
        /repeat\(\s*(auto-fit|auto-fill)\s*,\s*minmax\s*\(([^\)]+)\)/i
    );

    if (adaptiveMatch) {
        const computedStyles = element.ownerDocument.defaultView.getComputedStyle(element);
        const gapValue = parseFloat(computedStyles.getPropertyValue(axis === 'rows' ? 'row-gap' : 'column-gap')) || 0;
        const width = element.getBoundingClientRect().width || 1;
        const minCellMatch = cleanTemplate.match(
            /minmax\(\s*([^,\)]+)\s*,/i
        );
        const minCellValue = minCellMatch ? parseFloat(minCellMatch[1]) : 0;

        if (minCellValue > 0) {
            const count = Math.max(1, Math.floor((width + gapValue) / (minCellValue + gapValue)));

            return {
                count,
                size: minCellMatch ? minCellMatch[1].trim() : '1fr',
                template: cleanTemplate
            };
        }

        const parts = cleanTemplate.match(/minmax\([^)]*\)/gi) || cleanTemplate.match(/\S+/g) || [];
        const count = Math.max(1, parts.length || 1);

        return {
            count,
            size: '1fr',
            template: cleanTemplate
        };
    }

    const parts = cleanTemplate.split(/\s+/).filter(Boolean);
    const count = parts.length || 1;
    const value = parts[0] || '1fr';

    return {
        count,
        size: (
            /px$/i.test(value) &&
            !inlineValue
        ) ? '1fr' : value,
        template: cleanTemplate
    };
}

/* ***
 * syncGridChildren - синхронизация количества ячеек Grid
 * - принимает элемент Grid, ось и старое и новое количество
 * - добавляет или удаляет ячейки по строкам или колонкам
 * - сохраняет существующий порядок ячеек
*** */
function syncGridChildren(element, axis, oldCount, newCount) {
    if (!element || element.tagName.toLowerCase() !== 'div') {
        return;
    }

    const currentCols = Math.max(1, Number(getGridTemplateState(element, 'columns').count) || 1);
    const currentRows = Math.max(1, Number(getGridTemplateState(element, 'rows').count) || 1);
    const divChildren = Array.from(element.children).filter(child => child.tagName === 'DIV');
    const flow = (element.style.getPropertyValue('grid-auto-flow') || element.ownerDocument.defaultView.getComputedStyle(element).getPropertyValue('grid-auto-flow') || '').toLowerCase();
    const denseMode = /dense/i.test(flow);

    const createGridCell = (isPlaceholder = false) => {
        const cell = document.createElement('div');

        cell.setAttribute('data-contenteditable', 'false');

        if (isPlaceholder) {
            cell.innerHTML = '<br>';

            if (denseMode) {
                cell.style.display = 'none';
            }
        }

        return cell;
    };

    if (axis === 'columns') {
        const newChildren = [];
        const oldCols = Math.max(1, Number(oldCount) || 1);
        const rows = Math.max(1, Math.ceil(divChildren.length / Math.max(1, newCount || oldCols)) || 1);

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < newCount; col++) {
                const oldIndex = row * oldCols + col;

                if (col < oldCols && divChildren[oldIndex]) {
                    newChildren.push(divChildren[oldIndex]);
                } else if (denseMode && !divChildren[oldIndex]) {
                    newChildren.push(createGridCell(true));
                } else {
                    newChildren.push(createGridCell());
                }
            }
        }

        while (newChildren.length < newCount * rows) {
            newChildren.push(createGridCell(true));
        }

        newChildren.forEach(child => {
            element.appendChild(child);
        });

        divChildren.forEach(child => {
            if (!newChildren.includes(child)) {
                child.remove();
            }
        });

        return;
    }

    const totalCells = Math.max(1, newCount * currentCols);

    while (divChildren.length > totalCells) {
        const lastChild = divChildren.pop();

        if (lastChild) {
            lastChild.remove();
        }
    }

    while (divChildren.length < totalCells) {
        const newCell = createGridCell(true);

        element.appendChild(newCell);
        divChildren.push(newCell);
    }

    if (currentRows !== newCount && newCount > currentRows) {
        const expectedCells = Math.max(1, newCount * currentCols);

        while (divChildren.length < expectedCells) {
            const newCell = createGridCell(true);

            element.appendChild(newCell);
            divChildren.push(newCell);
        }
    }
}



/* ===
 * Свойства Grid / Flex
=== */

// Grid / Flex-свойства с мгновенным применением
const layoutLiveProperties = new Set([
    'gridColumns',
    'gridRows',
    'gridGap',
    'gridMinWidth',
    'gridNormalWidth',
    'gridMaxWidth',
    'columnGap',
    'rowGap',
    'gridPadding',
    'gridColumnSpan',
    'gridRowSpan',
    'gridItemColumns',
    'gridItemRows',
    'flexGap',
    'flexBasis',
    'flexAdvancedGap',
    'flexGrow',
    'flexShrink',
    'flexOrder'
]);

/* ***
 * isLayoutLiveProperty - проверка мгновенного Grid / Flex-свойства
 * принимает имя свойства
 * возвращает true для полей, которые обновляются во время ввода
*** */
function isLayoutLiveProperty(propertyName) {
    return layoutLiveProperties.has(propertyName);
}

/* ***
 * getLayoutProperty - получение элемента управления свойством Grid / Flex
 * принимает название data-prop
 * возвращает найденный элемент или null
*** */
function getLayoutProperty(propertyName) {
    return document.querySelector(
        `[data-prop="${propertyName}"]`
    );
}

/* ***
 * getLayoutItems - получение дочерних элементов макета
 * принимает контейнер Grid / Flex
 * возвращает массив дочерних div
*** */
function getLayoutItems(element) {
    if (!element) {
        return [];
    }

    return Array.from(element.children || []).filter(child => child.tagName === 'DIV');
}

/* ***
 * createLayoutItem - создание дочернего элемента макета
 * принимает контейнер Grid / Flex
 * создаёт пустой div в документе контейнера
 * возвращает созданный элемент
*** */
function createLayoutItem(element) {
    const item = element.ownerDocument.createElement('div');

    item.setAttribute('data-contenteditable', 'false');
    item.innerHTML = '<br>';

    return item;
}

/* ***
 * updateLayoutItems - изменение количества дочерних элементов макета
 * принимает контейнер и требуемое количество
 * добавляет или удаляет дочерние div
*** */
function updateLayoutItems(element, count) {
    const items = getLayoutItems(element);
    const itemCount = Math.max(1, Number(count) || 1);

    while (items.length < itemCount) {
        const item = createLayoutItem(element);

        element.appendChild(item);
        items.push(item);
    }

    while (items.length > itemCount) {
        const item = items.pop();

        if (item) {
            item.remove();
        }
    }
}

/* ***
 * clearGridItemStyles - очистка Grid-свойств дочернего элемента
 * принимает дочерний элемент
 * очищает позицию и размер элемента в Grid
*** */
function clearGridItemStyles(item) {
    item.style.gridColumn = '';
    item.style.gridRow = '';
    item.style.gridColumnStart = '';
    item.style.gridColumnEnd = '';
    item.style.gridRowStart = '';
    item.style.gridRowEnd = '';
}

/* ***
 * clearFlexItemStyles - очистка Flex-свойств дочернего элемента
 * принимает дочерний элемент
 * очищает размер, выравнивание и порядок элемента
*** */
function clearFlexItemStyles(item) {
    item.style.flex = '';
    item.style.flexGrow = '';
    item.style.flexShrink = '';
    item.style.flexBasis = '';
    item.style.alignSelf = '';
    item.style.order = '';
}

/* ***
 * resetLayoutItems - очистка Grid / Flex-свойств дочерних элементов
 * принимает контейнер макета
 * очищает свойства всех дочерних элементов
*** */
function resetLayoutItems(element) {
    const items = getLayoutItems(element);

    for (const item of items) {
        clearGridItemStyles(item);
        clearFlexItemStyles(item);
    }
}

/* ***
 * setGridItem - установка позиции и размера дочернего Grid-элемента
 * принимает Grid-контейнер, индекс элемента и настройки
 * применяет начало и span по колонкам и строкам
*** */
function setGridItem(element, index, options = {}) {
    const item = getLayoutItems(element)[index];

    if (!item) {
        return;
    }

    if (options.columnStart) {
        item.style.gridColumnStart = options.columnStart;
    }

    if (options.rowStart) {
        item.style.gridRowStart = options.rowStart;
    }

    if (options.columnSpan) {
        item.style.gridColumnEnd = `span ${options.columnSpan}`;
    }

    if (options.rowSpan) {
        item.style.gridRowEnd = `span ${options.rowSpan}`;
    }
}

/* ***
 * clearGridStyles - очистка Grid-свойств контейнера
 * принимает элемент
 * очищает Grid-свойства контейнера и его дочерних элементов
*** */
function clearGridStyles(element) {
    element.style.gridTemplateColumns = '';
    element.style.gridTemplateRows = '';
    element.style.gridAutoRows = '';
    element.style.gridAutoFlow = '';

    const items = getLayoutItems(element);

    for (const item of items) {
        clearGridItemStyles(item);
    }
}

/* ***
 * clearFlexStyles - очистка Flex-свойств контейнера
 * принимает элемент
 * очищает Flex-свойства контейнера и его дочерних элементов
*** */
function clearFlexStyles(element) {
    element.style.flexDirection = '';
    element.style.flexWrap = '';
    element.style.justifyContent = '';
    element.style.alignItems = '';
    element.style.alignContent = '';

    const items = getLayoutItems(element);

    for (const item of items) {
        clearFlexItemStyles(item);
    }
}

/* ***
 * handleGridTrackInput - обработка изменения размера Grid-track
 * принимает событие input
 * обновляет Grid по текущему списку размеров
*** */
function handleGridTrackInput(event) {
    event.stopPropagation();
    updateGridFromTracks();
}

/* ***
 * handleGridTrackChange - обработка изменения единицы Grid-track
 * принимает событие change
 * обновляет Grid по текущему списку размеров
*** */
function handleGridTrackChange(event) {
    event.stopPropagation();
    updateGridFromTracks();
}

/* ***
 * handleGridTrackMoveUp - обработка перемещения Grid-track вверх
 * принимает событие клика
 * перемещает текущий track на одну позицию вверх
*** */
function handleGridTrackMoveUp(event) {
    event.preventDefault();
    event.stopPropagation();

    const track = event.currentTarget.closest('.track');

    moveGridTrack(track, -1);
}

/* ***
 * handleGridTrackMoveDown - обработка перемещения Grid-track вниз
 * принимает событие клика
 * перемещает текущий track на одну позицию вниз
*** */
function handleGridTrackMoveDown(event) {
    event.preventDefault();
    event.stopPropagation();

    const track = event.currentTarget.closest('.track');

    moveGridTrack(track, 1);
}

/* ***
 * handleGridTrackRemove - обработка удаления Grid-track
 * принимает событие клика
 * удаляет текущий track
*** */
function handleGridTrackRemove(event) {
    event.preventDefault();
    event.stopPropagation();

    const track = event.currentTarget.closest('.track');

    removeGridTrack(track);
}

/* ***
 * createGridTrack - создание строки настройки Grid-track
 * принимает индекс, тип, значение и единицу
 * создаёт элементы управления размером Grid-track
 * возвращает созданную строку
*** */
function createGridTrack(index, type, value = 1, unit = 'fr') {
    const track = document.createElement('div');
    track.className = 'track';

    const number = document.createElement('div');
    number.className = 'trackNumber';
    number.textContent = index + 1;

    const input = document.createElement('input');
    input.type = 'number';
    input.min = '0';
    input.value = value;

    const unitSelect = document.createElement('select');
    const units = type === 'column'
        ? [
            'fr',
            'px',
            '%',
            'rem',
            'vw',
            'auto'
        ]
        : [
            'fr',
            'px',
            '%',
            'rem',
            'vh',
            'auto'
        ];

    for (const unitValue of units) {
        const option = document.createElement('option');

        option.value = unitValue;
        option.textContent = unitValue;
        unitSelect.appendChild(option);
    }

    unitSelect.value = unit;

    const moveUp = document.createElement('button');
    moveUp.type = 'button';
    moveUp.textContent = '↑';

    const moveDown = document.createElement('button');
    moveDown.type = 'button';
    moveDown.textContent = '↓';

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';

    // Обработчики управления Grid-track
    input.addEventListener('input', handleGridTrackInput);
    unitSelect.addEventListener('change', handleGridTrackChange);
    moveUp.addEventListener('click', handleGridTrackMoveUp);
    moveDown.addEventListener('click', handleGridTrackMoveDown);
    remove.addEventListener('click', handleGridTrackRemove);

    track.appendChild(number);
    track.appendChild(input);
    track.appendChild(unitSelect);
    track.appendChild(moveUp);
    track.appendChild(moveDown);
    track.appendChild(remove);

    return track;
}

/* ***
 * renumberGridTracks - обновление номеров Grid-track
 * принимает контейнер списка
 * устанавливает последовательные номера строк
*** */
function renumberGridTracks(container) {
    if (!container) {
        return;
    }

    const tracks = Array.from(container.children);

    for (let index = 0; index < tracks.length; index++) {
        const number = tracks[index].querySelector('.trackNumber');

        if (number) {
            number.textContent = index + 1;
        }
    }
}

/* ***
 * moveGridTrack - перемещение Grid-track
 * принимает строку track и направление -1 / 1
 * изменяет порядок строк и обновляет Grid
*** */
function moveGridTrack(track, direction) {
    if (!track || !track.parentElement) {
        return;
    }

    const container = track.parentElement;

    if (direction < 0 && track.previousElementSibling) {
        container.insertBefore(track, track.previousElementSibling);
    }

    if (direction > 0 && track.nextElementSibling) {
        container.insertBefore(track.nextElementSibling, track);
    }

    renumberGridTracks(container);
    updateGridFromTracks();
}

/* ***
 * removeGridTrack - удаление Grid-track
 * принимает строку track
 * удаляет её, сохраняя минимум один track
*** */
function removeGridTrack(track) {
    if (!track || !track.parentElement) {
        return;
    }

    const container = track.parentElement;

    if (container.children.length <= 1) {
        return;
    }

    track.remove();

    renumberGridTracks(container);
    updateGridFromTracks();
}

/* ***
 * setGridTrackValues - заполнение списка Grid-track
 * принимает контейнер, массив размеров и тип track
 * пересоздаёт список размеров
*** */
function setGridTrackValues(container, values, type) {
    if (!container) {
        return;
    }

    container.innerHTML = '';

    for (let index = 0; index < values.length; index++) {
        const trackValue = values[index];

        container.appendChild(createGridTrack(index, type, trackValue.value, trackValue.unit));
    }
}

/* ***
 * updateGridTrackList - изменение количества Grid-track
 * принимает контейнер, количество и тип
 * добавляет или удаляет строки настроек
*** */
function updateGridTrackList(container, count, type) {
    if (!container) {
        return;
    }

    const trackCount = Math.max(1, Number(count) || 1);

    while (container.children.length < trackCount) {
        container.appendChild(createGridTrack(container.children.length, type));
    }

    while (container.children.length > trackCount) {
        container.lastElementChild.remove();
    }

    renumberGridTracks(container);
}

/* ***
 * getGridTrackListValue - получение CSS-значения списка Grid-track
 * принимает контейнер списка
 * собирает размеры в строку CSS
 * возвращает grid-template значение
*** */
function getGridTrackListValue(container) {
    if (!container) {
        return '1fr';
    }

    const values = [];
    const tracks = Array.from(container.children);

    for (const track of tracks) {
        const input = track.querySelector('input');
        const select = track.querySelector('select');

        if (!input || !select) {
            continue;
        }

        if (select.value === 'auto') {
            values.push('auto');
        } else {
            values.push(`${input.value}${select.value}`);
        }
    }

    return values.length ? values.join(' ') : '1fr';
}

/* ***
 * parseGridTrackValue - разбор CSS-размера Grid-track
 * принимает CSS-значение
 * возвращает объект значения и единицы
*** */
function parseGridTrackValue(value) {
    const cleanValue = String(value || '').trim();

    if (cleanValue === 'auto') {
        return {
            value: 1,
            unit: 'auto'
        };
    }

    const match = cleanValue.match(
        /^([\d.]+)(fr|px|%|rem|vw|vh)$/i
    );

    if (!match) {
        return {
            value: 1,
            unit: 'fr'
        };
    }

    return {
        value: match[1],
        unit: match[2]
    };
}

/* ***
 * parseGridTracks - разбор grid-template на отдельные track
 * принимает строку grid-template
 * разбирает repeat и обычные значения
 * возвращает массив размеров
*** */
function parseGridTracks(template) {
    const cleanTemplate = String(template || '').trim();
    const repeatMatch = cleanTemplate.match(
        /^repeat\(\s*(\d+)\s*,\s*([^)]+)\)$/i
    );

    if (repeatMatch) {
        const count = Math.max(1, parseInt(repeatMatch[1], 10) || 1);
        const track = parseGridTrackValue(repeatMatch[2]);
        const tracks = [];

        for (let index = 0; index < count; index++) {
            tracks.push({
                value: track.value,
                unit: track.unit
            });
        }

        return tracks;
    }

    if (!cleanTemplate || cleanTemplate === 'none' || /repeat\(\s*auto-(fit|fill)/i.test(cleanTemplate)) {
        return [{
            value: 1,
            unit: 'fr'
        }];
    }

    const values = cleanTemplate.split(/\s+/);
    const tracks = [];

    for (const value of values) {
        tracks.push(parseGridTrackValue(value));
    }

    return tracks;
}

/* ***
 * syncGridTracks - синхронизация списков Grid-track с выбранным элементом
 * принимает Grid-контейнер
 * читает текущие grid-template и заполняет поля track
*** */
function syncGridTracks(element) {
    const columnTracks = getLayoutProperty('columnTracks');
    const rowTracks = getLayoutProperty('rowTracks');
    const computedStyles = element.ownerDocument.defaultView.getComputedStyle(element);
    const columns = element.style.gridTemplateColumns || computedStyles.gridTemplateColumns;
    const rows = element.style.gridTemplateRows || computedStyles.gridTemplateRows;

    if (columnTracks && !/repeat\(\s*auto-(fit|fill)/i.test(columns)) {
        setGridTrackValues(columnTracks, parseGridTracks(columns), 'column');
    }

    if (rowTracks) {
        if (element.dataset.gridAutoRows === 'true') {
            rowTracks.innerHTML = '';
        } else {
            setGridTrackValues(rowTracks, parseGridTracks(rows), 'row');
        }
    }
}

/* ***
 * getGridAutoFitState - получение текущих настроек auto-fit Grid
 * принимает Grid-контейнер
 * разбирает grid-template-columns
 * возвращает состояние auto-fit
*** */
function getGridAutoFitState(element) {
    const computedStyles = element.ownerDocument.defaultView.getComputedStyle(element);
    const template = element.style.gridTemplateColumns || computedStyles.gridTemplateColumns || '';
    const modeMatch = template.match(/repeat\(\s*(auto-fit|auto-fill)/i);
    const minMatch = template.match(
        /minmax\(\s*min\(\s*100%\s*,\s*([\d.]+)px\s*\)/i
    ) || template.match(
        /minmax\(\s*([\d.]+)px\s*,/i
    );
    const maxMatch = template.match(
        /,\s*([\d.]+)px\s*\)\s*\)$/i
    );

    return {
        enabled: !!modeMatch,
        mode: modeMatch ? modeMatch[1] : 'auto-fit',
        min: minMatch ? minMatch[1] : '220',
        normal: element.dataset.gridNormalWidth || '280',
        max: maxMatch ? maxMatch[1] : '400'
    };
}

/* ***
 * updateGrid - применение дополнительных свойств Grid
 * принимает Grid-контейнер
 * применяет auto-fit, track, отступы и порядок заполнения
*** */
function updateGrid(element) {
    const gridAutoFit = getLayoutProperty('gridAutoFit');
    const gridMinWidth = getLayoutProperty('gridMinWidth');
    const gridNormalWidth = getLayoutProperty('gridNormalWidth');
    const gridMaxWidth = getLayoutProperty('gridMaxWidth');
    const autoFitMode = getLayoutProperty('autoFitMode');
    const columnTracks = getLayoutProperty('columnTracks');
    const rowTracks = getLayoutProperty('rowTracks');
    const columnGap = getLayoutProperty('columnGap');
    const rowGap = getLayoutProperty('rowGap');
    const gridPadding = getLayoutProperty('gridPadding');
    const autoFlow = getLayoutProperty('autoFlow');

    if (gridAutoFit && gridAutoFit.checked && gridMinWidth && gridMaxWidth && autoFitMode) {
        const minWidth = Math.max(1, parseInt(gridMinWidth.value, 10) || 1);
        const maxWidth = Math.max(minWidth, parseInt(gridMaxWidth.value, 10) || minWidth);

        element.style.gridTemplateColumns = `repeat(${autoFitMode.value}, minmax(min(100%, ${minWidth}px), ${maxWidth}px))`;
    } else if (columnTracks && columnTracks.children.length) {
        element.style.gridTemplateColumns = getGridTrackListValue(columnTracks);
    }

    if (element.dataset.gridAutoRows === 'true') {
        element.style.gridTemplateRows = 'none';
        element.style.gridAutoRows = '1fr';
    } else if (rowTracks && rowTracks.children.length) {
        element.style.gridTemplateRows = getGridTrackListValue(rowTracks);
        element.style.gridAutoRows = '';
    }

    if (columnGap) {
        element.style.columnGap = `${Math.max(0, parseInt(columnGap.value, 10) || 0)}px`;
    }

    if (rowGap) {
        element.style.rowGap = `${Math.max(0, parseInt(rowGap.value, 10) || 0)}px`;
    }

    if (gridPadding) {
        element.style.padding = `${Math.max(0, parseInt(gridPadding.value, 10) || 0)}px`;
    }

    if (autoFlow) {
        element.style.gridAutoFlow = autoFlow.value;
    }

    if (gridNormalWidth) {
        element.dataset.gridNormalWidth = gridNormalWidth.value;
    }

    refreshRelevantControlVisibility(element);
}

/* ***
 * updateGridFromTracks - применение Grid после изменения track
 * получает выбранный элемент editorBlock
 * синхронизирует количество строк и колонок и сохраняет изменение
*** */
function updateGridFromTracks() {
    const element = window.editorBlock ? window.editorBlock.selectedElement : null;

    if (!element) {
        return;
    }

    const columnTracks = getLayoutProperty('columnTracks');
    const rowTracks = getLayoutProperty('rowTracks');
    const gridColumns = getLayoutProperty('gridColumns');
    const gridRows = getLayoutProperty('gridRows');
    const gridAutoFit = getLayoutProperty('gridAutoFit');

    if (gridColumns && columnTracks) {
        gridColumns.value = Math.max(1, columnTracks.children.length);
    }

    if (gridRows && rowTracks && element.dataset.gridAutoRows !== 'true') {
        gridRows.value = Math.max(1, rowTracks.children.length);
    }

    if (gridAutoFit) {
        gridAutoFit.checked = false;
    }

    updateGrid(element);
    saveCurrentBreakpointState();
    refreshRelevantControlVisibility(element);
    markBlockDirty(element);

    if (window.editorBlock && typeof window.editorBlock.syncEditors === 'function') {
        window.editorBlock.syncEditors();
    }

    if (window.editorBlock && typeof window.editorBlock.saveHistoryState === 'function') {
        window.editorBlock.saveHistoryState();
    }
}

/* ***
 * applyGridPreset - применение готовой Grid-раскладки
 * принимает Grid-контейнер и название пресета
 * изменяет track и дочерние элементы по логике page.html
*** */
function applyGridPreset(element, preset) {
    const gridColumns = getLayoutProperty('gridColumns');
    const gridRows = getLayoutProperty('gridRows');
    const gridAutoFit = getLayoutProperty('gridAutoFit');
    const gridMinWidth = getLayoutProperty('gridMinWidth');
    const gridNormalWidth = getLayoutProperty('gridNormalWidth');
    const gridMaxWidth = getLayoutProperty('gridMaxWidth');
    const autoFitMode = getLayoutProperty('autoFitMode');
    const columnTracks = getLayoutProperty('columnTracks');
    const rowTracks = getLayoutProperty('rowTracks');

    if (!gridColumns || !gridRows || !gridAutoFit || !gridMinWidth || !gridNormalWidth || !gridMaxWidth || !autoFitMode || !columnTracks || !rowTracks) {
        return;
    }

    element.style.display = 'grid';
    element.dataset.gridPreset = preset;
    element.dataset.gridAutoRows = 'false';
    element.style.gridAutoRows = '';

    gridAutoFit.checked = false;

    if (preset === 'cards') {
        element.dataset.gridAutoRows = 'true';

        gridColumns.value = 3;
        gridAutoFit.checked = true;
        gridMinWidth.value = 220;
        gridNormalWidth.value = 280;
        gridMaxWidth.value = 1;
        autoFitMode.value = 'auto-fit';

        setGridTrackValues(
            columnTracks,
            [
                {
                    value: 1,
                    unit: 'fr'
                },
                {
                    value: 1,
                    unit: 'fr'
                },
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'column'
        );

        rowTracks.innerHTML = '';

        updateLayoutItems(element, 6);
        resetLayoutItems(element);
    }

    if (preset === 'twoColumns') {
        gridColumns.value = 2;
        gridRows.value = 1;

        setGridTrackValues(
            columnTracks,
            [
                {
                    value: 1,
                    unit: 'fr'
                },
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'column'
        );

        setGridTrackValues(
            rowTracks,
            [
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'row'
        );

        updateLayoutItems(element, 2);
        resetLayoutItems(element);
    }

    if (preset === 'mainSidebar') {
        gridColumns.value = 2;
        gridRows.value = 1;

        setGridTrackValues(
            columnTracks,
            [
                {
                    value: 1,
                    unit: 'fr'
                },
                {
                    value: 320,
                    unit: 'px'
                }
            ],
            'column'
        );

        setGridTrackValues(
            rowTracks,
            [
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'row'
        );

        updateLayoutItems(element, 2);
        resetLayoutItems(element);

        setGridItem(
            element,
            0,
            {
                columnStart: 1
            }
        );

        setGridItem(
            element,
            1,
            {
                columnStart: 2
            }
        );
    }

    if (preset === 'sidebarMain') {
        gridColumns.value = 2;
        gridRows.value = 1;

        setGridTrackValues(
            columnTracks,
            [
                {
                    value: 320,
                    unit: 'px'
                },
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'column'
        );

        setGridTrackValues(
            rowTracks,
            [
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'row'
        );

        updateLayoutItems(element, 2);
        resetLayoutItems(element);

        setGridItem(
            element,
            0,
            {
                columnStart: 1
            }
        );

        setGridItem(
            element,
            1,
            {
                columnStart: 2
            }
        );
    }

    if (preset === 'page') {
        gridColumns.value = 1;
        gridRows.value = 3;

        setGridTrackValues(
            columnTracks,
            [
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'column'
        );

        setGridTrackValues(
            rowTracks,
            [
                {
                    value: 72,
                    unit: 'px'
                },
                {
                    value: 1,
                    unit: 'fr'
                },
                {
                    value: 64,
                    unit: 'px'
                }
            ],
            'row'
        );

        updateLayoutItems(element, 3);
        resetLayoutItems(element);

        setGridItem(
            element,
            0,
            {
                rowStart: 1
            }
        );

        setGridItem(
            element,
            1,
            {
                rowStart: 2
            }
        );

        setGridItem(
            element,
            2,
            {
                rowStart: 3
            }
        );
    }

    if (preset === 'dashboard') {
        gridColumns.value = 2;
        gridRows.value = 2;

        setGridTrackValues(
            columnTracks,
            [
                {
                    value: 240,
                    unit: 'px'
                },
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'column'
        );

        setGridTrackValues(
            rowTracks,
            [
                {
                    value: 64,
                    unit: 'px'
                },
                {
                    value: 1,
                    unit: 'fr'
                }
            ],
            'row'
        );

        updateLayoutItems(element, 3);
        resetLayoutItems(element);

        setGridItem(
            element,
            0,
            {
                columnStart: 1,
                rowStart: 1,
                rowSpan: 2
            }
        );

        setGridItem(
            element,
            1,
            {
                columnStart: 2,
                rowStart: 1
            }
        );

        setGridItem(
            element,
            2,
            {
                columnStart: 2,
                rowStart: 2
            }
        );
    }

    updateGrid(element);
}

/* ***
 * applyFlexPreset - применение готовой Flex-раскладки
 * принимает Flex-контейнер и название пресета
 * изменяет свойства и дочерние элементы по логике page.html
*** */
function applyFlexPreset(element, preset) {
    const flexDirection = getLayoutProperty('flexDirection');
    const flexGap = getLayoutProperty('flexGap');
    const flexWrap = getLayoutProperty('flexWrap');
    const flexJustify = getLayoutProperty('flexJustify');
    const flexAlign = getLayoutProperty('flexAlign');

    if (!flexDirection || !flexGap || !flexWrap || !flexJustify || !flexAlign) {
        return;
    }

    let itemCount = 4;
    let direction = 'row';
    let wrap = 'nowrap';
    let gap = 10;
    let justify = 'flex-start';
    let align = 'stretch';
    let itemFlex = '1 1 0';

    element.style.display = 'flex';
    element.dataset.flexPreset = preset;

    if (preset === 'column') {
        direction = 'column';
    }

    if (preset === 'between') {
        itemCount = 3;
        justify = 'space-between';
        align = 'center';
        itemFlex = '0 1 auto';
    }

    if (preset === 'center') {
        itemCount = 3;
        justify = 'center';
        align = 'center';
        itemFlex = '0 1 140px';
    }

    if (preset === 'evenly') {
        justify = 'space-evenly';
        align = 'center';
        itemFlex = '0 1 auto';
    }

    if (preset === 'wrap') {
        itemCount = 6;
        wrap = 'wrap';
        itemFlex = '1 1 180px';
    }

    flexDirection.value = direction;
    flexGap.value = gap;
    flexWrap.checked = wrap !== 'nowrap';
    flexJustify.value = justify;
    flexAlign.value = align;

    element.style.flexDirection = direction;
    element.style.flexWrap = wrap;
    element.style.gap = `${gap}px`;
    element.style.justifyContent = justify;
    element.style.alignItems = align;

    updateLayoutItems(element, itemCount);

    const items = getLayoutItems(element);

    for (const item of items) {
        clearGridItemStyles(item);
        item.style.flex = itemFlex;
    }

    syncFlexControls(element);
}

/* ***
 * applyLayoutType - переключение типа макета Grid / Flex
 * принимает элемент и новый тип
 * очищает свойства предыдущего типа и применяет базовый пресет
*** */
function applyLayoutType(element, type) {
    if (type === 'grid') {
        element.style.display = 'grid';

        clearFlexStyles(element);
        applyGridPreset(element, 'page');

        return;
    }

    element.style.display = 'flex';

    clearGridStyles(element);
    applyFlexPreset(element, 'row');
}

/* ***
 * getFlexItemSize - определение режима размера Flex-элемента
 * принимает элемент и его вычисленные стили
 * возвращает auto, fill, fixed или equal
*** */
function getFlexItemSize(element, computedStyles) {
    if (element.dataset.flexItemSize) {
        return element.dataset.flexItemSize;
    }

    const grow = parseFloat(computedStyles.flexGrow) || 0;
    const shrink = parseFloat(computedStyles.flexShrink) || 0;
    const basis = element.style.flexBasis || computedStyles.flexBasis || 'auto';

    if (grow === 1 && /^0(?:px|%)?$/.test(String(basis))) {
        return 'fill';
    }

    if (grow === 0 && shrink === 0 && basis !== 'auto') {
        return 'fixed';
    }

    return 'auto';
}

/* ***
 * applyFlexItemSize - применение режима размера Flex-элемента
 * принимает элемент и режим размера
 * изменяет flex по выбранному режиму
*** */
function applyFlexItemSize(element, mode) {
    const flexBasis = getLayoutProperty('flexBasis');
    const basis = Math.max(0, parseInt(flexBasis ? flexBasis.value : '0', 10) || 0);

    element.dataset.flexItemSize = mode;

    if (mode === 'auto') {
        element.style.flex = '0 1 auto';
    }

    if (mode === 'fill' || mode === 'equal') {
        element.style.flex = '1 1 0';
    }

    if (mode === 'fixed') {
        element.style.flex = `0 0 ${basis}px`;
    }
}

/* ***
 * syncFlexControls - синхронизация основных и дополнительных Flex-полей
 * принимает Flex-контейнер
 * обновляет связанные элементы управления
*** */
function syncFlexControls(element) {
    const computedStyles = element.ownerDocument.defaultView.getComputedStyle(element);
    const controls = {
        flexDirection: computedStyles.flexDirection,
        flexAdvancedDirection: computedStyles.flexDirection,
        flexGap: parseFloat(computedStyles.gap) || 0,
        flexAdvancedGap: parseFloat(computedStyles.gap) || 0,
        flexJustify: computedStyles.justifyContent,
        flexAdvancedJustify: computedStyles.justifyContent,
        flexAlign: computedStyles.alignItems,
        flexAdvancedAlign: computedStyles.alignItems,
        flexAlignContent: computedStyles.alignContent
    };

    for (const propertyName in controls) {
        const control = getLayoutProperty(propertyName);

        if (control) {
            control.value = controls[propertyName];
        }
    }

    const flexWrap = getLayoutProperty('flexWrap');
    const flexAdvancedWrap = getLayoutProperty('flexAdvancedWrap');

    if (flexWrap) {
        flexWrap.checked = computedStyles.flexWrap !== 'nowrap';
    }

    if (flexAdvancedWrap) {
        flexAdvancedWrap.value = computedStyles.flexWrap;
    }
}

/* ***
 * updateGridPositionOptions - обновление доступных позиций Grid-item
 * принимает дочерний Grid-элемент
 * формирует варианты начала колонки и строки
*** */
function updateGridPositionOptions(element) {
    const parentElement = element.parentElement;
    const gridItemColumn = getLayoutProperty('gridItemColumn');
    const gridItemRow = getLayoutProperty('gridItemRow');

    if (!parentElement || !gridItemColumn || !gridItemRow) {
        return;
    }

    const parentStyles = parentElement.ownerDocument.defaultView.getComputedStyle(parentElement);

    if (parentStyles.display !== 'grid') {
        return;
    }

    const columns = Math.max(1, getGridTemplateState(parentElement, 'columns').count || 1);
    const rows = parentElement.dataset.gridAutoRows === 'true' ? Math.max(1, Math.ceil(getLayoutItems(parentElement).length / columns)) : Math.max(1, getGridTemplateState(parentElement, 'rows').count || 1);

    const columnValue = element.style.gridColumnStart || 'auto';
    const rowValue = element.style.gridRowStart || 'auto';

    gridItemColumn.innerHTML = '<option value="auto">Автоматически</option>';
    gridItemRow.innerHTML = '<option value="auto">Автоматически</option>';

    for (let index = 1; index <= columns; index++) {
        const option = document.createElement('option');

        option.value = index;
        option.textContent = index;

        gridItemColumn.appendChild(option);
    }

    for (let index = 1; index <= rows; index++) {
        const option = document.createElement('option');

        option.value = index;
        option.textContent = index;

        gridItemRow.appendChild(option);
    }

    gridItemColumn.value = columnValue;
    gridItemRow.value = rowValue;
}

/* ***
 * handleGridTrackAdd - обработка добавления Grid-track
 * принимает событие клика
 * добавляет колонку или строку и обновляет Grid
*** */
function handleGridTrackAdd(event) {
    const button = event.target.closest(
        '[data-action="addColumn"], [data-action="addRow"]'
    );

    if (!button) {
        return;
    }

    const element = window.editorBlock ? window.editorBlock.selectedElement : null;

    if (!element) {
        return;
    }

    const isRow = button.getAttribute('data-action') === 'addRow';
    const container = getLayoutProperty(isRow ? 'rowTracks' : 'columnTracks');

    if (!container) {
        return;
    }

    event.preventDefault();

    container.appendChild(createGridTrack(container.children.length, isRow ? 'row' : 'column'));

    updateGridFromTracks();
}

// Обработчик добавления колонок и строк Grid
document.addEventListener('click', handleGridTrackAdd);



/* ***
 * getPropertyRow - получение строки свойства
 * принимает имя data-prop
 * возвращает ближайший контейнер свойства
*** */
function getPropertyRow(propertyName) {
    const control = getLayoutProperty(propertyName);

    if (!control) {
        return null;
    }

    const groupIds = {
        gridRows: 'gridRowsProperty',
        rowTracks: 'rowTracksGroup',
        gridAutoFit: 'gridAutoFitProperties',
        gridMinWidth: 'gridAutoFitProperties',
        gridNormalWidth: 'gridAutoFitProperties',
        gridMaxWidth: 'gridAutoFitProperties',
        autoFitMode: 'gridAutoFitProperties',
        autoFlow: 'gridAutoFlowProperty',
        fluidGapEnabled: 'fluidGapProperties',
        fluidGapMin: 'fluidGapProperties',
        fluidGapMax: 'fluidGapProperties',
        flexAlignContent: 'flexAlignContentProperty',
        flexBasis: 'flexBasisProperty',
        flexShrink: 'flexShrinkProperty'
    };
    const groupId = groupIds[propertyName];

    if (groupId) {
        const group = document.getElementById(groupId);

        if (group) {
            return group;
        }
    }

    return control.closest('.property') || control.closest('[data-target]') || control.parentElement;
}

/* ***
 * setPropertyRowVisible - изменение видимости строки свойства
 * принимает имя свойства и состояние видимости
 * показывает или скрывает строку
*** */
function setPropertyRowVisible(propertyName, isVisible) {
    const row = getPropertyRow(propertyName);

    if (!row) {
        return;
    }

    row.style.display = isVisible ? '' : 'none';
}

/* ***
 * refreshRelevantControlVisibility - обновление зависимых настроек Grid / Flex
 * принимает выбранный элемент
 * показывает только настройки, которые имеют смысл в текущем состоянии
*** */
function refreshRelevantControlVisibility(element) {
    if (!element) {
        return;
    }

    const elementWindow = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView : window;
    const computedStyles = elementWindow.getComputedStyle(element);
    const isGrid = computedStyles.display === 'grid';
    const isFlex = computedStyles.display === 'flex';
    const parentElement = element.parentElement;
    const parentWindow = parentElement && parentElement.ownerDocument && parentElement.ownerDocument.defaultView ? parentElement.ownerDocument.defaultView : elementWindow;
    const parentStyles = parentElement ? parentWindow.getComputedStyle(parentElement) : null;
    const isGridItem = !!(parentElement && parentStyles && parentStyles.display === 'grid');
    const isFlexItem = !!(parentElement && parentStyles && parentStyles.display === 'flex');

    const gridAutoFit = getLayoutProperty('gridAutoFit');
    const columnTracks = getLayoutProperty('columnTracks');
    const rowTracks = getLayoutProperty('rowTracks');
    const flexWrap = getLayoutProperty('flexWrap');
    const flexItemSize = getLayoutProperty('flexItemSize');
    const fluidGapEnabled = getLayoutProperty('fluidGapEnabled');

    const hasGridItems = isGrid && element.children.length > 1;
    const hasGridTracks = !!((columnTracks && columnTracks.children.length > 1) || (rowTracks && rowTracks.children.length > 1));
    const isAutoRows = isGrid && element.dataset.gridAutoRows === 'true';
    const isAutoFit = isGrid && !!(gridAutoFit && gridAutoFit.checked);
    const hasFlexItems = isFlex && element.children.length > 1;
    const isFlexWrapped = isFlex && (computedStyles.flexWrap !== 'nowrap' || !!(flexWrap && flexWrap.checked));
    const parentHasItems = isFlexItem && parentElement ? parentElement.children.length > 1 : false;
    const parentIsWrapped = isFlexItem && parentStyles ? parentStyles.flexWrap !== 'nowrap' : false;
    const flexSizeMode = isFlexItem && flexItemSize ? flexItemSize.value : '';

    setPropertyRowVisible('gridRows', isGrid && !isAutoRows);
    setPropertyRowVisible('rowTracks', isGrid && !isAutoRows);

    setPropertyRowVisible('gridMinWidth', isAutoFit);
    setPropertyRowVisible('gridNormalWidth', isAutoFit);
    setPropertyRowVisible('gridMaxWidth', isAutoFit);
    setPropertyRowVisible('autoFitMode', isAutoFit);

    setPropertyRowVisible('autoFlow', isGrid && hasGridItems && hasGridTracks);

    setPropertyRowVisible('flexAlignContent', isFlex && hasFlexItems && isFlexWrapped);

    const isFixedFlexItem = isFlexItem && flexSizeMode === 'fixed';

    setPropertyRowVisible('flexBasis', isFixedFlexItem);

    setPropertyRowVisible('fluidGapMin', !!(fluidGapEnabled && fluidGapEnabled.checked));
    setPropertyRowVisible('fluidGapMax', !!(fluidGapEnabled && fluidGapEnabled.checked));

    setPropertyRowVisible('flexShrink', isFlexItem && parentHasItems && !parentIsWrapped);

    const canUsePreset = isBaseBreakpoint();

    setPropertyRowVisible('gridPreset', isGrid && canUsePreset);

    setPropertyRowVisible('flexPreset', isFlex && canUsePreset);
}

/* ***
 * removeUnusedLayoutControls - удаление лишних настроек из панели
 * удаляет mediaSrcset, mediaSizes и блок шаблонов
*** */
function removeUnusedLayoutControls() {
    const removedProperties = [
        'mediaSrcset',
        'mediaSizes'
    ];

    for (const propertyName of removedProperties) {
        const controls = document.querySelectorAll(`[data-prop="${propertyName}"], #${propertyName}`);

        for (const control of controls) {
            const property = control.closest('.property');
            const target = control.closest('[data-target]');

            if (property) {
                property.remove();
            } else if (target && target.querySelectorAll('input, select, textarea').length <= 1) {
                target.remove();
            } else {
                control.remove();
            }
        }
    }

    const variantList = document.getElementById('variantList');
    const addVariant = document.getElementById('addVariant');

    if (variantList || addVariant) {
        const variantGroup = variantList ? variantList.closest('.advancedGroup, .section') : addVariant.closest('.advancedGroup, .section');

        if (variantGroup) {
            variantGroup.remove();
        } else {
            if (variantList) {
                variantList.remove();
            }

            if (addVariant) {
                addVariant.remove();
            }
        }
    }
}



/* ===
 * Размеры экрана
=== */

// Состояния размеров экрана для Grid / Flex-контейнеров
const breakpointStates = new WeakMap();

// Текущий контейнер размеров экрана
let breakpointOwnerElement = null;

// Текущий выбранный элемент внутри контейнера
let breakpointSelectedElement = null;

// Состояние восстановления размера экрана
let isRestoringBreakpoint = false;

/* ***
 * cloneBreakpointValue - копирование состояния размера экрана
 * принимает объект состояния
 * создаёт независимую копию
 * возвращает скопированное значение
*** */
function cloneBreakpointValue(value) {
    return JSON.parse(JSON.stringify(value || {}));
}

/* ***
 * getBreakpointControl - получение элемента управления размером экрана
 * принимает id элемента
 * ищет элемент в текущем документе
 * возвращает найденный элемент или null
*** */
function getBreakpointControl(controlId) {
    return document.getElementById(controlId) || document.querySelector(`[data-prop="${controlId}"]`);
}

/* ***
 * getBreakpointOwner - получение Grid / Flex-контейнера для выбранного элемента
 * принимает выбранный элемент
 * проверяет сам элемент и его непосредственного родителя
 * возвращает контейнер или null
*** */
function getBreakpointOwner(element) {
    if (!element) {
        return null;
    }

    const elementWindow = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView : window;
    const elementStyles = elementWindow.getComputedStyle(element);

    if (elementStyles.display === 'grid' || elementStyles.display === 'flex') {
        return element;
    }

    const parentElement = element.parentElement;

    if (!parentElement) {
        return null;
    }

    const parentWindow = parentElement.ownerDocument && parentElement.ownerDocument.defaultView ? parentElement.ownerDocument.defaultView : elementWindow;
    const parentStyles = parentWindow.getComputedStyle(parentElement);

    if (parentStyles.display === 'grid' || parentStyles.display === 'flex') {
        return parentElement;
    }

    return null;
}

/* ***
 * getBreakpointPreview - получение области просмотра редактора
 * ищет контейнер размера экрана
 * возвращает элемент области просмотра или null
*** */
function getBreakpointPreview() {
    return document.getElementById('viewEditorContent');
}

/* ***
 * getBreakpointLayoutStyles - получение CSS-свойств Grid / Flex-контейнера
 * принимает контейнер
 * читает только свойства раскладки
 * возвращает объект CSS-свойств
*** */
function getBreakpointLayoutStyles(element) {
    return {
        display: element.style.display || '',
        gridTemplateColumns: element.style.gridTemplateColumns || '',
        gridTemplateRows: element.style.gridTemplateRows || '',
        gridAutoRows: element.style.gridAutoRows || '',
        gridAutoFlow: element.style.gridAutoFlow || '',
        columnGap: element.style.columnGap || '',
        rowGap: element.style.rowGap || '',
        padding: element.style.padding || '',
        gap: element.style.gap || '',
        flexDirection: element.style.flexDirection || '',
        flexWrap: element.style.flexWrap || '',
        justifyContent: element.style.justifyContent || '',
        alignItems: element.style.alignItems || '',
        alignContent: element.style.alignContent || ''
    };
}

/* ***
 * getBreakpointItemStyles - получение CSS-свойств элемента Grid / Flex
 * принимает дочерний элемент
 * читает только свойства положения внутри раскладки
 * возвращает объект CSS-свойств
*** */
function getBreakpointItemStyles(element) {
    return {
        gridColumnStart: element.style.gridColumnStart || '',
        gridColumnEnd: element.style.gridColumnEnd || '',
        gridRowStart: element.style.gridRowStart || '',
        gridRowEnd: element.style.gridRowEnd || '',
        flex: element.style.flex || '',
        flexGrow: element.style.flexGrow || '',
        flexShrink: element.style.flexShrink || '',
        flexBasis: element.style.flexBasis || '',
        alignSelf: element.style.alignSelf || '',
        order: element.style.order || ''
    };
}

/* ***
 * captureBreakpointState - получение текущего состояния Grid / Flex
 * принимает контейнер
 * сохраняет свойства контейнера и элементов первого уровня
 * возвращает снимок состояния
*** */
function captureBreakpointState(element) {
    if (!element) {
        return null;
    }

    const elementWindow = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView : window;
    const computedStyles = elementWindow.getComputedStyle(element);

    return {
        layoutType: computedStyles.display === 'flex' ? 'flex' : 'grid',
        css: getBreakpointLayoutStyles(element),
        data: {
            gridAutoRows: element.dataset.gridAutoRows || '',
            gridNormalWidth: element.dataset.gridNormalWidth || '',
            gridPreset: element.dataset.gridPreset || '',
            flexPreset: element.dataset.flexPreset || ''
        },
        items: Array.from(element.children).map(child => ({
            css: getBreakpointItemStyles(child),
            data: {
                columnStart: child.dataset.columnStart || '',
                rowStart: child.dataset.rowStart || '',
                columnSpan: child.dataset.columnSpan || '',
                rowSpan: child.dataset.rowSpan || '',
                flexItemSize: child.dataset.flexItemSize || ''
            }
        }))
    };
}

/* ***
 * createBreakpointOverrides - получение отличий размера экрана от базового состояния
 * принимает базовое и текущее состояния
 * сравнивает свойства контейнера и элементов
 * возвращает объект переопределений
*** */
function createBreakpointOverrides(baseState, currentState) {
    const overrides = {
        css: {},
        data: {},
        items: []
    };

    if (!baseState || !currentState) {
        return overrides;
    }

    if (currentState.layoutType !== baseState.layoutType) {
        overrides.layoutType = currentState.layoutType;
    }

    Object.entries(currentState.css || {}).forEach(([propertyName, value]) => {
        if ((baseState.css || {})[propertyName] !== value) {
            overrides.css[propertyName] = value;
        }
    });

    Object.entries(currentState.data || {}).forEach(([propertyName, value]) => {
        if ((baseState.data || {})[propertyName] !== value) {
            overrides.data[propertyName] = value;
        }
    });

    const itemCount = Math.max((baseState.items || []).length, (currentState.items || []).length);

    for (let index = 0; index < itemCount; index++) {
        const baseItem = (baseState.items || [])[index] || {
            css: {},
            data: {}
        };
        const currentItem = (currentState.items || [])[index] || {
            css: {},
            data: {}
        };
        const itemOverride = {
            css: {},
            data: {}
        };

        Object.entries(currentItem.css || {}).forEach(([propertyName, value]) => {
            if ((baseItem.css || {})[propertyName] !== value) {
                itemOverride.css[propertyName] = value;
            }
        });

        Object.entries(currentItem.data || {}).forEach(([propertyName, value]) => {
            if ((baseItem.data || {})[propertyName] !== value) {
                itemOverride.data[propertyName] = value;
            }
        });

        if (Object.keys(itemOverride.css).length || Object.keys(itemOverride.data).length) {
            overrides.items[index] = itemOverride;
        } else {
            overrides.items[index] = null;
        }
    }

    return overrides;
}

/* ***
 * mergeBreakpointState - объединение базового состояния и переопределений
 * принимает базовое состояние и переопределения размера экрана
 * формирует итоговое состояние
 * возвращает объединённый снимок
*** */
function mergeBreakpointState(baseState, overrides) {
    const mergedState = cloneBreakpointValue(baseState);

    if (!overrides) {
        return mergedState;
    }

    if (overrides.layoutType) {
        mergedState.layoutType = overrides.layoutType;
    }

    mergedState.css = {
        ...(mergedState.css || {}),
        ...(overrides.css || {})
    };

    mergedState.data = {
        ...(mergedState.data || {}),
        ...(overrides.data || {})
    };

    if (overrides.items) {
        mergedState.items = mergedState.items || [];

        overrides.items.forEach((itemOverride, index) => {
            if (!itemOverride) {
                return;
            }

            const currentItem = mergedState.items[index] || {
                css: {},
                data: {}
            };

            mergedState.items[index] = {
                css: {
                    ...(currentItem.css || {}),
                    ...(itemOverride.css || {})
                },
                data: {
                    ...(currentItem.data || {}),
                    ...(itemOverride.data || {})
                }
            };
        });
    }

    return mergedState;
}

/* ***
 * setBreakpointData - установка dataset значения
 * принимает элемент, имя свойства и значение
 * удаляет пустое значение или записывает новое
*** */
function setBreakpointData(element, propertyName, value) {
    if (!element) {
        return;
    }

    if (value === '') {
        delete element.dataset[propertyName];
        return;
    }

    element.dataset[propertyName] = value;
}

/* ***
 * restoreBreakpointState - восстановление состояния размера экрана
 * принимает Grid / Flex-контейнер и снимок
 * применяет свойства без изменения HTML-структуры
*** */
function restoreBreakpointState(element, snapshot) {
    if (!element || !snapshot) {
        return;
    }

    isRestoringBreakpoint = true;

    const layoutType = snapshot.layoutType === 'flex' ? 'flex' : 'grid';

    element.style.display = layoutType;

    Object.entries(snapshot.css || {}).forEach(([propertyName, value]) => {
        element.style[propertyName] = value || '';
    });

    Object.entries(snapshot.data || {}).forEach(([propertyName, value]) => {
        setBreakpointData(element, propertyName, value || '');
    });

    (snapshot.items || []).forEach((itemState, index) => {
        const item = element.children[index];

        if (!item) {
            return;
        }

        Object.entries(itemState.css || {}).forEach(([propertyName, value]) => {
            item.style[propertyName] = value || '';
        });

        Object.entries(itemState.data || {}).forEach(([propertyName, value]) => {
            setBreakpointData(item, propertyName, value || '');
        });
    });

    isRestoringBreakpoint = false;
}

/* ***
 * createBreakpointStore - создание состояния размеров экрана
 * принимает Grid / Flex-контейнер
 * создаёт базовое состояние без дополнительных диапазонов
 * возвращает объект состояния
*** */
function createBreakpointStore(element) {
    return {
        activeId: 'all',
        counter: 0,
        ranges: [
            {
                id: 'all',
                name: 'Все размеры',
                min: null,
                max: null,
                isBase: true,
                overrides: null
            }
        ],
        baseState: captureBreakpointState(element)
    };
}

/* ***
 * getBreakpointStore - получение состояния размеров текущего контейнера
 * создаёт состояние при первом обращении
 * возвращает объект состояния или null
*** */
function getBreakpointStore() {
    if (!breakpointOwnerElement) {
        return null;
    }

    if (!breakpointStates.has(breakpointOwnerElement)) {
        breakpointStates.set(breakpointOwnerElement, createBreakpointStore(breakpointOwnerElement));
    }

    return breakpointStates.get(breakpointOwnerElement);
}

/* ***
 * getActiveBreakpoint - получение активного диапазона
 * получает состояние текущего контейнера
 * возвращает диапазон или null
*** */
function getActiveBreakpoint() {
    const store = getBreakpointStore();

    if (!store) {
        return null;
    }

    return store.ranges.find(range => range.id === store.activeId) || store.ranges[0];
}

/* ***
 * isBaseBreakpoint - проверка базового размера экрана
 * возвращает true для режима всех размеров
*** */
function isBaseBreakpoint() {
    const range = getActiveBreakpoint();

    return !range || range.isBase;
}

/* ***
 * formatBreakpointLabel - формирование названия диапазона
 * принимает диапазон
 * возвращает название для списка
*** */
function formatBreakpointLabel(range) {
    if (range.isBase) {
        return 'Все размеры';
    }

    if (range.name) {
        return range.name;
    }

    if (range.max === null) {
        return `${range.min}+`;
    }

    return `${range.min}-${range.max}`;
}

/* ***
 * formatBreakpointRange - формирование границ диапазона
 * принимает диапазон
 * возвращает строку границ
*** */
function formatBreakpointRange(range) {
    if (!range || range.isBase) {
        return 'все размеры';
    }

    if (range.max === null) {
        return `${range.min}+`;
    }

    return `${range.min}-${range.max}`;
}

/* ***
 * countBreakpointOverrides - подсчёт изменений диапазона
 * принимает диапазон
 * считает CSS и свойства элементов
 * возвращает количество изменений
*** */
function countBreakpointOverrides(range) {
    if (!range || !range.overrides) {
        return 0;
    }

    let count = Object.keys(range.overrides.css || {}).length + Object.keys(range.overrides.data || {}).length;

    if (range.overrides.layoutType) {
        count += 1;
    }

    for (const item of range.overrides.items || []) {
        if (!item) {
            continue;
        }

        count += Object.keys(item.css || {}).length;
        count += Object.keys(item.data || {}).length;
    }

    return count;
}

/* ***
 * renderBreakpointTabs - обновление списка размеров экрана
 * создаёт базовый пункт, пользовательские диапазоны и быстрые варианты
*** */
function renderBreakpointTabs() {
    const breakpointSelect = getBreakpointControl('breakpointSelect');
    const store = getBreakpointStore();

    if (!breakpointSelect || !store) {
        return;
    }

    breakpointSelect.innerHTML = '';

    for (const range of store.ranges) {
        const option = document.createElement('option');

        option.value = range.id;
        option.textContent = formatBreakpointLabel(range);

        breakpointSelect.appendChild(option);
    }

    if (store.ranges.length === 1) {
        const presets = [
            {
                value: 'preset-mobile',
                label: 'Телефон 0-640'
            },
            {
                value: 'preset-tablet',
                label: 'Планшет 641-1024'
            },
            {
                value: 'preset-desktop',
                label: 'Компьютер 1025+'
            }
        ];

        for (const preset of presets) {
            const option = document.createElement('option');

            option.value = preset.value;
            option.textContent = preset.label;

            breakpointSelect.appendChild(option);
        }
    }

    breakpointSelect.value = store.activeId;
}

/* ***
 * updateBreakpointHint - обновление подсказки размера экрана
 * показывает назначение базового или выбранного диапазона
*** */
function updateBreakpointHint() {
    const breakpointHint = getBreakpointControl('breakpointHint');
    const range = getActiveBreakpoint();

    if (!breakpointHint || !range) {
        return;
    }

    breakpointHint.textContent = range.isBase ? 'Базовые настройки применяются ко всем размерам экрана.' : `Изменения применяются только при ширине ${formatBreakpointRange(range)}px.`;
}

/* ***
 * updateBreakpointStatus - обновление состояния диапазона
 * показывает количество переопределённых свойств
*** */
function updateBreakpointStatus() {
    const breakpointStatus = getBreakpointControl('breakpointStatus');
    const resetBreakpoint = getBreakpointControl('resetBreakpoint');
    const range = getActiveBreakpoint();

    if (!range) {
        return;
    }

    if (range.isBase) {
        if (breakpointStatus) {
            breakpointStatus.textContent = 'Базовые свойства';
        }

        if (resetBreakpoint) {
            resetBreakpoint.style.display = 'none';
        }

        return;
    }

    const changeCount = countBreakpointOverrides(range);

    if (breakpointStatus) {
        breakpointStatus.textContent = changeCount ? `Изменено свойств: ${changeCount}` : 'Используются базовые свойства';
    }

    if (resetBreakpoint) {
        resetBreakpoint.style.display = changeCount ? '' : 'none';
    }
}

/* ***
 * updateBreakpointInputs - обновление полей выбранного диапазона
 * показывает редактор границ только для отдельного диапазона
*** */
function updateBreakpointInputs() {
    const breakpointRangeEditor = getBreakpointControl('breakpointRangeEditor');
    const breakpointStartInput = getBreakpointControl('breakpointStartInput');
    const breakpointEndInput = getBreakpointControl('breakpointEndInput');
    const breakpointNameInput = getBreakpointControl('breakpointNameInput');
    const range = getActiveBreakpoint();

    if (!range) {
        return;
    }

    if (range.isBase) {
        if (breakpointRangeEditor) {
            breakpointRangeEditor.classList.remove('visible');
            breakpointRangeEditor.style.display = 'none';
        }

        updateBreakpointHint();
        updateBreakpointStatus();

        return;
    }

    if (breakpointStartInput) {
        breakpointStartInput.value = range.min;
    }

    if (breakpointEndInput) {
        breakpointEndInput.value = range.max === null ? '' : range.max;
    }

    if (breakpointNameInput) {
        breakpointNameInput.value = range.name || '';
    }

    if (breakpointRangeEditor) {
        breakpointRangeEditor.classList.add('visible');
        breakpointRangeEditor.style.display = '';
    }

    updateBreakpointHint();
    updateBreakpointStatus();
}

/* ***
 * getBreakpointMergedState - получение итогового состояния диапазона
 * принимает диапазон
 * объединяет базовые свойства и изменения диапазона
 * возвращает снимок состояния
*** */
function getBreakpointMergedState(range) {
    const store = getBreakpointStore();

    if (!store) {
        return null;
    }

    if (!range || range.isBase) {
        return cloneBreakpointValue(store.baseState);
    }

    return mergeBreakpointState(store.baseState, range.overrides);
}

/* ***
 * saveCurrentBreakpointState - сохранение изменений текущего диапазона
 * сохраняет базовое состояние или только отличия выбранного диапазона
*** */
function saveCurrentBreakpointState() {
    if (isRestoringBreakpoint || !breakpointOwnerElement) {
        return;
    }

    const store = getBreakpointStore();
    const range = getActiveBreakpoint();
    const currentState = captureBreakpointState(breakpointOwnerElement);

    if (!store || !range || !currentState) {
        return;
    }

    if (range.isBase) {
        store.baseState = currentState;
    } else {
        range.overrides = createBreakpointOverrides(store.baseState, currentState);
    }

    updateBreakpointStatus();
}

/* ***
 * applyBreakpointPreviewWidth - применение ширины выбранного диапазона
 * ограничивает текущую область просмотра границами диапазона
*** */
function applyBreakpointPreviewWidth() {
    const range = getActiveBreakpoint();
    const preview = getBreakpointPreview();

    if (!range || range.isBase || !preview) {
        return;
    }

    const currentWidth = preview.getBoundingClientRect().width;
    let nextWidth = Math.max(range.min, currentWidth);

    if (range.max !== null) {
        nextWidth = Math.min(range.max, nextWidth);
    }

    if (!Number.isFinite(nextWidth) || nextWidth <= 0 || Math.abs(nextWidth - currentWidth) <= 1) {
        return;
    }

    preview.style.width = `${Math.round(nextWidth)}px`;

    if (window.editorBlock && typeof window.editorBlock.syncViewEditorSizeInputs === 'function') {
        window.editorBlock.syncViewEditorSizeInputs('manual');
    }
}

/* ***
 * applyBreakpointState - применение выбранного размера экрана
 * восстанавливает базовое или объединённое состояние
 * не изменяет HTML-структуру Grid / Flex
*** */
function applyBreakpointState() {
    const range = getActiveBreakpoint();

    if (!breakpointOwnerElement || !range) {
        return;
    }

    restoreBreakpointState(breakpointOwnerElement, getBreakpointMergedState(range));

    applyBreakpointPreviewWidth();

    if (breakpointSelectedElement) {
        updatePropertiesPanel(breakpointSelectedElement);
    }
}

/* ***
 * setActiveBreakpoint - переключение размера экрана
 * принимает id диапазона
 * сохраняет текущие изменения и применяет новый диапазон
*** */
function setActiveBreakpoint(breakpointId) {
    const store = getBreakpointStore();

    if (!store) {
        return;
    }

    saveCurrentBreakpointState();

    const hasRange = store.ranges.some(range => range.id === breakpointId);

    if (!hasRange) {
        return;
    }

    store.activeId = breakpointId;

    updateBreakpointInputs();
    applyBreakpointState();
    renderBreakpointTabs();
    refreshRelevantControlVisibility(breakpointSelectedElement);
}

/* ***
 * createPresetBreakpoint - создание диапазона из готового размера
 * принимает id готового диапазона
 * создаёт диапазон и возвращает его
*** */
function createPresetBreakpoint(presetId) {
    const store = getBreakpointStore();

    if (!store) {
        return null;
    }

    const presets = {
        'preset-mobile': {
            name: 'Телефон',
            min: 0,
            max: 640
        },
        'preset-tablet': {
            name: 'Планшет',
            min: 641,
            max: 1024
        },
        'preset-desktop': {
            name: 'Компьютер',
            min: 1025,
            max: null
        }
    };
    const preset = presets[presetId];

    if (!preset) {
        return null;
    }

    store.counter += 1;

    const range = {
        id: `bp-${store.counter}`,
        name: preset.name,
        min: preset.min,
        max: preset.max,
        isBase: false,
        overrides: null
    };

    store.ranges.push(range);

    return range;
}

/* ***
 * addBreakpointRange - добавление нового диапазона
 * создаёт диапазон после последнего существующего
 * активирует созданный диапазон
*** */
function addBreakpointRange() {
    const store = getBreakpointStore();

    if (!store) {
        return;
    }

    saveCurrentBreakpointState();

    const ranges = store.ranges.filter(range => !range.isBase).sort((firstRange, secondRange) => firstRange.min - secondRange.min);

    let minWidth = 0;
    let maxWidth = 640;

    if (ranges.length) {
        const lastRange = ranges[ranges.length - 1];

        minWidth = lastRange.max === null ? lastRange.min + 1 : lastRange.max + 1;
        maxWidth = minWidth + 639;
    }

    store.counter += 1;

    const range = {
        id: `bp-${store.counter}`,
        name: '',
        min: minWidth,
        max: maxWidth,
        isBase: false,
        overrides: null
    };

    store.ranges.push(range);
    store.activeId = range.id;

    updateBreakpointInputs();
    applyBreakpointState();
    renderBreakpointTabs();
    refreshRelevantControlVisibility(breakpointSelectedElement);
}

/* ***
 * updateSelectedBreakpoint - изменение границ активного диапазона
 * читает поля границ и названия
 * обновляет выбранный диапазон
*** */
function updateSelectedBreakpoint() {
    const range = getActiveBreakpoint();

    if (!range || range.isBase) {
        return;
    }

    const breakpointStartInput = getBreakpointControl('breakpointStartInput');
    const breakpointEndInput = getBreakpointControl('breakpointEndInput');
    const breakpointNameInput = getBreakpointControl('breakpointNameInput');

    if (!breakpointStartInput || !breakpointEndInput) {
        return;
    }

    const minWidth = Math.max(0, parseInt(breakpointStartInput.value, 10) || 0);
    const maxValue = breakpointEndInput.value.trim();
    const maxWidth = maxValue === '' ? null : Math.max(minWidth, parseInt(maxValue, 10) || minWidth);

    range.min = minWidth;
    range.max = maxWidth;
    range.name = breakpointNameInput ? breakpointNameInput.value.trim() : '';

    applyBreakpointPreviewWidth();
    renderBreakpointTabs();
    updateBreakpointStatus();
    updateBreakpointHint();
}

/* ***
 * duplicateActiveBreakpoint - дублирование выбранного диапазона
 * копирует границы и изменения
 * активирует созданную копию
*** */
function duplicateActiveBreakpoint() {
    const store = getBreakpointStore();
    const range = getActiveBreakpoint();

    if (!store || !range || range.isBase) {
        return;
    }

    saveCurrentBreakpointState();

    store.counter += 1;

    const copy = cloneBreakpointValue(range);

    copy.id = `bp-${store.counter}`;
    copy.name = range.name ? `${range.name} копия` : '';

    store.ranges.push(copy);
    store.activeId = copy.id;

    updateBreakpointInputs();
    applyBreakpointState();
    renderBreakpointTabs();
}

/* ***
 * removeActiveBreakpoint - удаление выбранного диапазона
 * удаляет только отдельный диапазон
 * возвращает редактор к базовым свойствам
*** */
function removeActiveBreakpoint() {
    const store = getBreakpointStore();
    const range = getActiveBreakpoint();

    if (!store || !range || range.isBase) {
        return;
    }

    const rangeIndex = store.ranges.findIndex(item => item.id === range.id);

    if (rangeIndex !== -1) {
        store.ranges.splice(rangeIndex, 1);
    }

    store.activeId = 'all';

    updateBreakpointInputs();
    applyBreakpointState();
    renderBreakpointTabs();
    refreshRelevantControlVisibility(breakpointSelectedElement);
}

/* ***
 * resetActiveBreakpoint - сброс изменений выбранного диапазона
 * удаляет переопределения диапазона
 * восстанавливает базовые свойства
*** */
function resetActiveBreakpoint() {
    const range = getActiveBreakpoint();

    if (!range || range.isBase) {
        return;
    }

    range.overrides = null;

    applyBreakpointState();
    updateBreakpointStatus();
}

/* ***
 * updateBreakpointSectionVisibility - изменение видимости блока размеров экрана
 * показывает размеры только для Grid / Flex-контекста
*** */
function updateBreakpointSectionVisibility(isVisible) {
    const breakpointSelect = getBreakpointControl('breakpointSelect');

    if (!breakpointSelect) {
        return;
    }

    const breakpointSection = breakpointSelect.closest('.breakpointSection') || breakpointSelect.parentElement;

    if (breakpointSection) {
        breakpointSection.style.display = isVisible ? '' : 'none';
    }
}

/* ***
 * updateBreakpointContext - обновление контейнера размеров экрана
 * принимает текущий выбранный элемент
 * сохраняет старый контейнер и подключает новый
*** */
function updateBreakpointContext(element) {
    const nextOwner = getBreakpointOwner(element);

    if (breakpointOwnerElement && breakpointOwnerElement !== nextOwner) {
        saveCurrentBreakpointState();

        const currentStore = getBreakpointStore();

        if (currentStore && currentStore.activeId !== 'all') {
            restoreBreakpointState(breakpointOwnerElement, currentStore.baseState);

            currentStore.activeId = 'all';
        }
    }

    breakpointSelectedElement = element || null;

    if (!nextOwner) {
        breakpointOwnerElement = null;
        updateBreakpointSectionVisibility(false);

        return;
    }

    const isNewOwner = breakpointOwnerElement !== nextOwner;

    breakpointOwnerElement = nextOwner;

    const store = getBreakpointStore();

    if (!store) {
        return;
    }

    updateBreakpointSectionVisibility(true);

    if (isNewOwner) {
        renderBreakpointTabs();
        updateBreakpointInputs();
    }
}

/* ***
 * handleBreakpointSelect - обработка выбора размера экрана
 * принимает событие change
 * создаёт готовый диапазон или переключает существующий
*** */
function handleBreakpointSelect(event) {
    const breakpointId = event.currentTarget.value;

    if (breakpointId.startsWith('preset-')) {
        saveCurrentBreakpointState();

        const range = createPresetBreakpoint(breakpointId);
        const store = getBreakpointStore();

        if (!range || !store) {
            return;
        }

        store.activeId = range.id;

        updateBreakpointInputs();
        applyBreakpointState();
        renderBreakpointTabs();
        refreshRelevantControlVisibility(breakpointSelectedElement);

        return;
    }

    setActiveBreakpoint(breakpointId);
}

/* ***
 * handleBreakpointAdd - обработка добавления диапазона
 * добавляет новый размер экрана
*** */
function handleBreakpointAdd() {
    addBreakpointRange();
}

/* ***
 * handleBreakpointRangeChange - обработка изменения границ диапазона
 * обновляет активный размер экрана
*** */
function handleBreakpointRangeChange() {
    updateSelectedBreakpoint();
}

/* ***
 * handleBreakpointDuplicate - обработка дублирования диапазона
 * создаёт копию активного размера экрана
*** */
function handleBreakpointDuplicate() {
    duplicateActiveBreakpoint();
}

/* ***
 * handleBreakpointRemove - обработка удаления диапазона
 * удаляет активный размер экрана
*** */
function handleBreakpointRemove() {
    removeActiveBreakpoint();
}

/* ***
 * handleBreakpointReset - обработка сброса диапазона
 * удаляет изменения активного размера экрана
*** */
function handleBreakpointReset() {
    resetActiveBreakpoint();
}

/* ***
 * initBreakpointSystem - инициализация размеров экрана
 * подключает существующие элементы интерфейса
 * скрывает блок до выбора Grid / Flex-контекста
*** */
function initBreakpointSystem() {
    const breakpointSelect = getBreakpointControl('breakpointSelect');
    const breakpointStartInput = getBreakpointControl('breakpointStartInput');
    const breakpointEndInput = getBreakpointControl('breakpointEndInput');
    const breakpointNameInput = getBreakpointControl('breakpointNameInput');
    const addBreakpoint = getBreakpointControl('addBreakpoint');
    const duplicateBreakpoint = getBreakpointControl('duplicateBreakpoint');
    const removeBreakpoint = getBreakpointControl('removeBreakpoint');
    const resetBreakpoint = getBreakpointControl('resetBreakpoint');
    const breakpointRangeEditor = getBreakpointControl('breakpointRangeEditor');

    if (breakpointRangeEditor) {
        breakpointRangeEditor.classList.remove('visible');
        breakpointRangeEditor.style.display = 'none';
    }

    if (resetBreakpoint) {
        resetBreakpoint.style.display = 'none';
    }

    updateBreakpointSectionVisibility(false);

    // Обработчики размеров экрана
    if (breakpointSelect) {
        breakpointSelect.addEventListener('change', handleBreakpointSelect);
    }

    if (breakpointStartInput) {
        breakpointStartInput.addEventListener('change', handleBreakpointRangeChange);
    }

    if (breakpointEndInput) {
        breakpointEndInput.addEventListener('change', handleBreakpointRangeChange);
    }

    if (breakpointNameInput) {
        breakpointNameInput.addEventListener('input', handleBreakpointRangeChange);
    }

    if (addBreakpoint) {
        addBreakpoint.addEventListener('click', handleBreakpointAdd);
    }

    if (duplicateBreakpoint) {
        duplicateBreakpoint.addEventListener('click', handleBreakpointDuplicate);
    }

    if (removeBreakpoint) {
        removeBreakpoint.addEventListener('click', handleBreakpointRemove);
    }

    if (resetBreakpoint) {
        resetBreakpoint.addEventListener('click', handleBreakpointReset);
    }
}



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

        updateBreakpointContext(null);
        updatePropertiesTabs(null);

        return;
    }

    const tagName = element.tagName.toLowerCase();
    const inputType = tagName === 'input' ? (element.getAttribute('type') || 'text').toLowerCase() : '';

    // получаем итоговые стили элемента из css правил
    const elementWindow = element && element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView : window;
    const computedStyles = elementWindow.getComputedStyle(element);
    const isGrid = computedStyles.display === 'grid';
    const isFlex = computedStyles.display === 'flex';
    const parentElement = element.parentElement;
    const parentWindow = parentElement && parentElement.ownerDocument && parentElement.ownerDocument.defaultView ? parentElement.ownerDocument.defaultView : elementWindow;
    const isGridItem = !!(parentElement && parentWindow.getComputedStyle(parentElement).display === 'grid');
    const isFlexItem = !!(parentElement && parentWindow.getComputedStyle(parentElement).display === 'flex');

    updateBreakpointContext(element);

    // функция перевода rgb в hex
    const rgbToHex = rgbStr => {
        if (!rgbStr) {
            return '';
        }

        const match = rgbStr.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*(\d+(?:\.\d+)?))?\)$/i);

        if (!match) {
            return rgbStr;
        }

        const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
        const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
        const b = parseInt(match[3], 10).toString(16).padStart(2, '0');

        return `#${r}${g}${b}`.toLowerCase();
    };

    if (isGrid) {
        syncGridTracks(element);
    }

    if (isGridItem) {
        updateGridPositionOptions(element);
    }

    if (isFlex) {
        syncFlexControls(element);
    }

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
        } else if (config.type === 'special' && config.action === 'layoutType') {
            finalValue = isFlex ? 'flex' : 'grid';
        } else if (config.type === 'special' && config.action === 'gridPreset') {
            finalValue = element.dataset.gridPreset || '';
        } else if (config.type === 'special' && config.action === 'flexPreset') {
            finalValue = element.dataset.flexPreset || '';
        } else if (config.type === 'special' && config.action === 'gridDimension') {
            finalValue = getGridTemplateState(element, config.axis).count;
        } else if (config.type === 'special' && config.action === 'gridGap') {
            finalValue = parseFloat(computedStyles.gap) || 0;
        } else if (config.type === 'special' && config.action === 'gridAutoFit') {
            const autoFitState = getGridAutoFitState(element);

            ctrl.checked = autoFitState.enabled;

            return;
        } else if (config.type === 'special' && config.action === 'gridAutoFitSetting') {
            const autoFitState = getGridAutoFitState(element);

            if (prop === 'gridMinWidth') {
                finalValue = autoFitState.min;
            }

            if (prop === 'gridNormalWidth') {
                finalValue = autoFitState.normal;
            }

            if (prop === 'gridMaxWidth') {
                finalValue = autoFitState.max;
            }

            if (prop === 'autoFitMode') {
                finalValue = autoFitState.mode;
            }
        } else if (config.type === 'special' && config.action === 'gridTracks') {
            return;
        } else if (config.type === 'special' && config.action === 'gridItemSpan') {
            const cssName = config.axis === 'rows' ? 'gridRowEnd' : 'gridColumnEnd';
            const spanValue = element.style[cssName] || computedStyles[cssName] || '';
            const match = String(spanValue).match(/span\s*(\d+)/i);

            finalValue = match ? match[1] : 1;
        } else if (config.type === 'special' && config.action === 'gridItemStart') {
            const cssName = config.axis === 'rows' ? 'gridRowStart' : 'gridColumnStart';
            const startValue = element.style[cssName] || computedStyles[cssName] || 'auto';

            finalValue = startValue === 'auto' || startValue === '' ? 'auto' : startValue;
        } else if (config.type === 'special' && config.action === 'fluidGapEnabled') {
            ctrl.checked = element.dataset.fluidGapEnabled === 'true';

            return;
        } else if (config.type === 'special' && config.action === 'fluidGapRange') {
            finalValue = prop === 'fluidGapMin' ? (element.dataset.fluidGapMin || '') : (element.dataset.fluidGapMax || '');
        } else if (config.type === 'special' && config.action === 'itemHidden') {
            ctrl.checked = element.style.display === 'none' || computedStyles.display === 'none';

            return;
        } else if (config.type === 'special' && config.action === 'textWrapMode') {
            finalValue = element.style.whiteSpace === 'nowrap' ? 'nowrap' : (element.style.overflowWrap === 'anywhere' ? 'anywhere' : '');
        } else if (config.type === 'special' && config.action === 'flexWrap') {
            ctrl.checked = computedStyles.flexWrap !== 'nowrap';

            return;
        } else if (config.type === 'special' && config.action === 'flexItemSize') {
            finalValue = getFlexItemSize(element, computedStyles);
        } else if (config.type === 'special' && config.action === 'flexBasis') {
            finalValue = parseFloat(computedStyles.flexBasis) || 0;
        } else if (config.type === 'special' && config.action === 'tableDimensions' && tagName === 'table') {
            if (prop === 'tableRows') {
                finalValue = element.querySelectorAll('tr').length;
            } else if (prop === 'tableCols') {
                const firstRow = element.querySelector('tr');

                finalValue = firstRow ? firstRow.children.length : 1;
            }
        }

        // специальная обработка для gridColumnSpan/gridRowSpan — извлекаем число из 'span N' если нужно
        if (prop === 'gridColumnSpan' || prop === 'gridRowSpan') {
            const match = String(finalValue).match(/span\s*(\d+)/i);

            finalValue = match ? match[1] : (finalValue || '');
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

        const keys = targetValue.split(' ').map(key => key.trim().toLowerCase());
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

            if (key === 'flex' && isFlex) {
                isVisible = true;
                break;
            }

            if (key === 'flex-item' && isFlexItem) {
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

    refreshRelevantControlVisibility(element);
    updatePropertiesTabs(element);
}

// Подписываемся на событие выбора напрямую в документе
document.addEventListener('editorBlock:elementSelected', event => {
    updatePropertiesPanel(event.detail);
});



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

    return string.replace(
        /-([a-z])/g,
        (_, letter) => letter.toUpperCase()
    );
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
        return '#' + shortHexMatch[1].split('').map(char => char + char).join('').toLowerCase();
    }

    const rgbMatch = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*[\d.]+)?\s*\)$/i);

    if (rgbMatch) {
        const r = Number(rgbMatch[1]);
        const g = Number(rgbMatch[2]);
        const b = Number(rgbMatch[3]);

        if ([r, g, b].every(number => !Number.isNaN(number) && number >= 0 && number <= 255)) {
            return '#' + [r, g, b].map(number => number.toString(16).padStart(2, '0')).join('').toLowerCase();
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

    const view =
        element.closest(
            '[id^="loadedBlock_"][id$="_view"]'
        ) ||
        (
            element.ownerDocument &&
            element.ownerDocument.defaultView &&
            element.ownerDocument.defaultView.frameElement
                ? element.ownerDocument.defaultView.frameElement.closest('[id^="loadedBlock_"][id$="_view"]')
                : null
        );

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

    if (config.type === 'special' && config.action === 'layoutType') {
        if (isBaseBreakpoint()) {
            applyLayoutType(element, value);
        } else {
            element.style.display = value === 'flex' ? 'flex' : 'grid';
        }

        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridPreset') {
        if (!isBaseBreakpoint()) {
            return;
        }

        applyGridPreset(element, value);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'flexPreset') {
        if (!isBaseBreakpoint()) {
            return;
        }

        applyFlexPreset(element, value);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridDimension') {
        const columnTracks = getLayoutProperty('columnTracks');
        const rowTracks = getLayoutProperty('rowTracks');
        const currentState = getGridTemplateState(element, config.axis);
        const count = Math.max(1, parseInt(value, 10) || 1);

        if (config.axis === 'columns') {
            updateGridTrackList(columnTracks, count, 'column');
        } else {
            element.dataset.gridAutoRows = 'false';

            updateGridTrackList(rowTracks, count, 'row');
        }

        if (isBaseBreakpoint()) {
            syncGridChildren(element, config.axis, currentState.count, count);
        }

        updateGrid(element);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridGap') {
        const gap = Math.max(0, parseInt(value, 10) || 0);
        const columnGap = getLayoutProperty('columnGap');
        const rowGap = getLayoutProperty('rowGap');

        if (columnGap) {
            columnGap.value = gap;
        }

        if (rowGap) {
            rowGap.value = gap;
        }

        element.style.columnGap = `${gap}px`;
        element.style.rowGap = `${gap}px`;

        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridAutoFit') {
        const gridAutoFit = getLayoutProperty('gridAutoFit');

        if (gridAutoFit) {
            gridAutoFit.checked = rawValue === true || value === 'true';
        }

        updateGrid(element);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridAutoFitSetting') {
        if (propertyName === 'gridNormalWidth') {
            element.dataset.gridNormalWidth = value;
        }

        updateGrid(element);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridTracks') {
        return;
    }

    if (config.type === 'special' && config.action === 'fluidGapEnabled') {
        const enabled = rawValue === true || value === 'true';

        element.dataset.fluidGapEnabled = enabled ? 'true' : 'false';

        if (!enabled) {
            delete element.dataset.fluidGapMin;
            delete element.dataset.fluidGapMax;
        }

        refreshRelevantControlVisibility(element);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'fluidGapRange') {
        const targetName = propertyName === 'fluidGapMin' ? 'fluidGapMin' : 'fluidGapMax';

        if (!value) {
            delete element.dataset[targetName];
        } else {
            element.dataset[targetName] = String(value).trim();
        }

        refreshRelevantControlVisibility(element);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'itemHidden') {
        const shouldHide = rawValue === true || value === 'true';

        element.style.display = shouldHide ? 'none' : '';

        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'textWrapMode') {
        if (value === 'nowrap') {
            element.style.whiteSpace = 'nowrap';
            element.style.overflowWrap = '';
        } else if (value === 'anywhere') {
            element.style.overflowWrap = 'anywhere';
            element.style.whiteSpace = '';
        } else {
            element.style.overflowWrap = '';
            element.style.whiteSpace = '';
        }

        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridItemStart') {
        const cssName = config.axis === 'rows' ? 'gridRowStart' : 'gridColumnStart';

        element.style[cssName] = value === 'auto' ? '' : value;

        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'gridItemSpan') {
        const cssName = config.axis === 'rows' ? 'gridRowEnd' : 'gridColumnEnd';
        const span = Math.max(1, parseInt(value, 10) || 1);
        const basicControl = getLayoutProperty(config.axis === 'rows' ? 'gridRowSpan' : 'gridColumnSpan');
        const advancedControl = getLayoutProperty(config.axis === 'rows' ? 'gridItemRows' : 'gridItemColumns');

        element.style[cssName] = `span ${span}`;

        if (basicControl) {
            basicControl.value = span;
        }

        if (advancedControl) {
            advancedControl.value = span;
        }

        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'flexWrap') {
        element.style.flexWrap = rawValue === true || value === 'true' ? 'wrap' : 'nowrap';

        syncFlexControls(element);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'flexItemSize') {
        applyFlexItemSize(element, value);
        markBlockDirty(element);

        return;
    }

    if (config.type === 'special' && config.action === 'flexBasis') {
        const basis = Math.max(0, parseInt(value, 10) || 0);

        if (element.dataset.flexItemSize === 'fixed') {
            element.style.flex = `0 0 ${basis}px`;
        } else {
            element.style.flexBasis = `${basis}px`;
        }

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

        if ((propertyName === 'gridColumn' || propertyName === 'gridRow' || propertyName === 'gridColumnSpan' || propertyName === 'gridRowSpan') && /^\d+$/.test(value.trim())) {
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
        const mediaTags = [
            'img',
            'iframe',
            'video',
            'audio'
        ];

        if (tagName === 'a') {
            attributeName = 'href';
        } else {
            attributeName = mediaTags.includes(tagName) ? 'src' : 'href';
        }
    }

    // Обработка уникального идентификатора
    if (attributeName === 'id') {
        const inputElement = document.querySelector('[data-prop="id"]');

        syncElementId(
            value,
            element,
            inputElement ? [inputElement] : []
        );

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

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
        const tableRow = document.createElement('tr');
        const oldCells = oldRows[rowIndex] ? Array.from(oldRows[rowIndex].children) : [];

        for (let columnIndex = 0; columnIndex < cols; columnIndex++) {
            let tableCell;

            if (oldCells[columnIndex]) {
                tableCell = oldCells[columnIndex];
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
        return {
            valid: false
        };
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
            }, {
                once: true
            });
        }
    };

    // Если ID очистили
    if (!id) {
        clearErrorBackground();

        if (oldId) {
            element.removeAttribute('id');
        }

        return {
            valid: true,
            reason: 'empty'
        };
    }

    // Проверка уникальности
    let isDuplicate = false;
    const checkDocument = element.ownerDocument || document;

    try {
        const existingElements = checkDocument.querySelectorAll(`[id="${CSS.escape(id)}"]`);

        isDuplicate = Array.from(existingElements).some(node => node !== element && node.tagName !== 'SCRIPT' && node.tagName !== 'STYLE');
    } catch (error) {
        const fallbackElement = checkDocument.getElementById(id);

        isDuplicate = fallbackElement && fallbackElement !== element && fallbackElement.tagName !== 'SCRIPT' && fallbackElement.tagName !== 'STYLE';
    }

    if (isDuplicate) {
        setErrorBackground();

        return {
            valid: false,
            reason: 'duplicate'
        };
    }

    clearErrorBackground();

    if (oldId === id) {
        return {
            valid: true,
            reason: 'same'
        };
    }

    // Обновляем ID
    element.id = id;

    if (!oldId) {
        return {
            valid: true,
            reason: 'updated'
        };
    }

    // Обновление ссылок на старый ID в скриптах блока
    const view = element.closest('[id^="loadedBlock_"][id$="_view"]');

    if (!view) {
        return {
            valid: true
        };
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
                node.setAttribute(attribute.name, attribute.value.replace(regexAttribute, `$1$2${id}$3`));
            }
        }
    }

    return {
        valid: true,
        reason: 'updated'
    };
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
 * Переключение вкладок свойств элемента
=== */

// Переменные для вкладок свойств элемента
const propertyTabButtons = document.querySelectorAll('.propertiesElementTab[data-tab]');
const propertyTabContents = document.querySelectorAll('[data-tab-content]');

/* ***
 * getPropertyTabAvailability - получение доступных вкладок свойств
 * принимает выбранный элемент
 * проверяет Grid / Flex-контейнер и элемент первого уровня
 * возвращает доступность вкладок
*** */
function getPropertyTabAvailability(element) {
    if (!element) {
        return {
            main: false,
            advanced: false,
            selectedItem: false
        };
    }

    const elementWindow = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView : window;
    const elementStyles = elementWindow.getComputedStyle(element);
    const isLayout = elementStyles.display === 'grid' || elementStyles.display === 'flex';

    const parentElement = element.parentElement;

    if (!parentElement) {
        return {
            main: isLayout,
            advanced: isLayout,
            selectedItem: false
        };
    }

    const parentWindow = parentElement.ownerDocument && parentElement.ownerDocument.defaultView ? parentElement.ownerDocument.defaultView : elementWindow;
    const parentStyles = parentWindow.getComputedStyle(parentElement);

    // считаем элемент элементом первого уровня только если непосредственный родитель является контейнером Grid/Flex
    const parentTagName = parentElement.tagName.toLowerCase();

    const isImmediateParentLayout = parentTagName !== 'body' && parentTagName !== 'html' && (parentStyles.display === 'grid' || parentStyles.display === 'flex');

    const breakpointOwner = getBreakpointOwner(element);

    const isFirstLevelItem = !!(isImmediateParentLayout && (breakpointOwner === parentElement || isLayout));

    return {
        main: isLayout,
        advanced: isLayout,
        selectedItem: isFirstLevelItem
    };
}

/* ***
 * updatePropertiesTabs - обновление доступных вкладок панели
 * принимает выбранный элемент
 * показывает Главную и Дополнительные только для Grid / Flex
 * показывает Выбранный элемент только для элемента первого уровня
*** */
function updatePropertiesTabs(element) {
    const availability = getPropertyTabAvailability(element);
    const availableTabs = [];
    const propertiesPanel = document.querySelector('.properties');

    if (propertiesPanel) {
        propertiesPanel.classList.toggle('hasSelectedItem', availability.selectedItem);
    }

    propertyTabButtons.forEach(tabButton => {
        const tabName = tabButton.dataset.tab;
        const isVisible = Boolean(availability[tabName]);

        tabButton.style.display = isVisible ? '' : 'none';

        if (isVisible) {
            availableTabs.push(tabName);
        }
    });

    const activeButton = Array.from(propertyTabButtons).find(tabButton => tabButton.classList.contains('active') && tabButton.style.display !== 'none');

    if (activeButton) {
        handlePropertiesTabChange(activeButton.dataset.tab);

        return;
    }

    if (availableTabs.length) {
        handlePropertiesTabChange(availableTabs[0]);

        return;
    }

    handlePropertiesTabChange('');
}

/* ***
 * handlePropertiesTabChange - переключение активной вкладки свойств элемента
 * - принимает имя вкладки
 * - обновляет классы активной вкладки и блока содержимого
*** */
function handlePropertiesTabChange(tabName) {
    const requestedTab = String(tabName || '').trim();
    const availableButton = Array.from(propertyTabButtons).find(tabButton => tabButton.dataset.tab === requestedTab && tabButton.style.display !== 'none');
    const activeTabName = availableButton ? requestedTab : '';

    propertyTabButtons.forEach(tabButton => {
        const isActive = activeTabName && tabButton.dataset.tab === activeTabName;

        tabButton.classList.toggle('active', Boolean(isActive));
    });

    propertyTabContents.forEach(tabContent => {
        const isActive = activeTabName && tabContent.dataset.tabContent === activeTabName;

        tabContent.classList.toggle('active', Boolean(isActive));
    });

    const propertiesPanel = document.querySelector('.properties');

    if (propertiesPanel) {
        propertiesPanel.dataset.view = activeTabName || 'none';
    }

    const basicContent = document.getElementById('basic');
    const selectedItemContent = document.querySelector('.selectedItemContent');
    const advancedDetails = document.querySelector('.advancedDetails');

    if (basicContent) {
        basicContent.style.display = activeTabName === 'main' ? '' : 'none';
    }

    if (selectedItemContent) {
        selectedItemContent.style.display = activeTabName === 'selectedItem' ? '' : 'none';
    }

    if (advancedDetails) {
        advancedDetails.style.display = activeTabName === 'advanced' ? '' : 'none';

        if (activeTabName !== 'advanced') {
            advancedDetails.open = false;
        }
    }
}

/* ***
 * handlePropertiesTabClick - обработчик клика по вкладке свойств элемента
 * - принимает событие клика
 * - активирует требуемую вкладку и скрывает остальные
*** */
function handlePropertiesTabClick(event) {
    const nextTab = event.currentTarget;

    if (!nextTab || !nextTab.dataset.tab || nextTab.style.display === 'none') {
        return;
    }

    handlePropertiesTabChange(nextTab.dataset.tab);
}

// Обработчики вкладок свойств
propertyTabButtons.forEach(tabButton => {
    tabButton.addEventListener('click', handlePropertiesTabClick);
});

updatePropertiesTabs(null);

// Элементы основных вкладок свойств и их содержимое
const propertiesElementTabsMain = document.querySelectorAll('.propertiesElementTabMain');
const propertiesElementTabContents = document.querySelectorAll('.propertiesElementTabContent');
const propertiesElementTabsMainContainer = document.querySelector('.propertiesElementTabsMain');

// Текущая открытая вкладка свойств
let activePropertiesElementTab = '';

/* ***
 * getPropertiesElementMainAvailability - получение доступности основных вкладок свойств
 * получает текущий выбранный элемент
 * проверяет свойства внутри каждой вкладки по data-target
 * возвращает объект доступности вкладок
*** */
function getPropertiesElementMainAvailability() {
    const element = window.editorBlock ? window.editorBlock.selectedElement : null;

    if (!element) return {};

    const availability = {};
    const tagName = element.tagName.toLowerCase();
    const inputType = tagName === 'input' ? (element.getAttribute('type') || 'text').toLowerCase() : '';
    const elementWindow = element.ownerDocument && element.ownerDocument.defaultView ? element.ownerDocument.defaultView : window;
    const styles = elementWindow.getComputedStyle(element);
    const parentElement = element.parentElement;
    const parentWindow = parentElement && parentElement.ownerDocument && parentElement.ownerDocument.defaultView ? parentElement.ownerDocument.defaultView : elementWindow;
    const isGrid = styles.display === 'grid';
    const isFlex = styles.display === 'flex';
    const isGridItem = !!(parentElement && parentWindow.getComputedStyle(parentElement).display === 'grid');
    const isFlexItem = !!(parentElement && parentWindow.getComputedStyle(parentElement).display === 'flex');

    const selection = element.ownerDocument.getSelection();
    const hasTextSelection = !!(selection && !selection.isCollapsed && selection.toString().trim());

    propertiesElementTabContents.forEach(content => {
        const tabName = content.dataset.propertiesTabContent;

        if (!tabName) return;

        availability[tabName] = Array.from(content.querySelectorAll('[data-target]')).some(target => {
            const targetValue = target.getAttribute('data-target');

            if (!targetValue) return false;
            if (targetValue === 'all') return true;

            const keys = targetValue.split(' ').map(key => key.trim().toLowerCase());

            for (const key of keys) {
                if (key === tagName) return true;
                if (key.startsWith('input:') && tagName === 'input' && key.split(':')[1] === inputType) return true;
                if (key === 'grid' && isGrid) return true;
                if (key === 'grid-item' && isGridItem) return true;
                if (key === 'flex' && isFlex) return true;
                if (key === 'flex-item' && isFlexItem) return true;
                if (key === 'block' && ['div', 'section', 'header', 'footer', 'aside', 'main', 'article', 'nav', 'form', 'table'].includes(tagName)) return true;
                if (key === 'text' && ['span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'b', 'i', 'strong', 'em'].includes(tagName)) return true;
                if (key === 'link' && tagName === 'a') return true;
            }

            return false;
        });
    });

    if (hasTextSelection) {
        Object.keys(availability).forEach(tabName => {
            availability[tabName] = false;
        });

        availability.text = true;
    } else {
        availability.text = false;
    }

    return availability;
}

/* ***
 * refreshPropertiesElementTabs - обновление основных вкладок свойств
 * получает доступность вкладок для текущего элемента
 * скрывает недоступные вкладки
 * показывает содержимое активной вкладки
*** */
function refreshPropertiesElementTabs() {
    const availability = getPropertiesElementMainAvailability();
    const hasActiveTab = !!activePropertiesElementTab && availability[activePropertiesElementTab];

    if (!hasActiveTab) activePropertiesElementTab = '';

    propertiesElementTabsMain.forEach(tab => {
        const tabName = tab.dataset.propertiesTab;
        const isAvailable = !!availability[tabName];

        tab.style.display = activePropertiesElementTab ? 'none' : (isAvailable ? '' : 'none');
        tab.classList.toggle('active', tabName === activePropertiesElementTab);
    });

    propertiesElementTabContents.forEach(content => {
        const tabName = content.dataset.propertiesTabContent;
        const isActive = tabName === activePropertiesElementTab;

        content.style.display = isActive ? 'block' : 'none';
        content.classList.toggle('active', isActive);
    });

    // Если выбрана вкладка "text" — показываем существующий внешний блок #propertiesText
    if (activePropertiesElementTab === 'text') {
        // Скрыть все панели правой панели кроме заголовка
        document.querySelectorAll('#rightPanel > div:not(#rightPanelTabs)').forEach(panel => {
            panel.style.display = 'none';
        });

        const textPanel = document.getElementById('propertiesText');
        if (textPanel) {
            textPanel.style.display = '';
        }

        // Спрячем сам контейнер propertiesElement чтобы не дублировать
        const selfPanel = document.getElementById('propertiesElement');
        if (selfPanel) {
            selfPanel.style.display = 'none';
        }
    } else {
        // По умолчанию показываем панель свойств элемента и скрываем propertiesText
        const selfPanel = document.getElementById('propertiesElement');
        if (selfPanel) {
            selfPanel.style.display = '';
        }

        const textPanel = document.getElementById('propertiesText');
        if (textPanel) {
            textPanel.style.display = 'none';
        }
    }

    propertiesElementTabsBack.style.display = activePropertiesElementTab ? 'block' : 'none';
}
window.editorBlock.refreshPropertiesElementTabs = refreshPropertiesElementTabs;

/* ***
 * handlePropertiesElementTabClick - обработка нажатия на основную вкладку свойств
 * принимает объект события
 * открывает выбранную доступную вкладку
*** */
function handlePropertiesElementTabClick(event) {
    const tab = event.currentTarget;
    const tabName = tab.dataset.propertiesTab;
    const availability = getPropertiesElementMainAvailability();

    if (!tabName || !availability[tabName]) return;

    activePropertiesElementTab = tabName;
    refreshPropertiesElementTabs();
}

/* ***
 * handlePropertiesElementTabsBack - обработка возврата к списку вкладок
 * закрывает текущую вкладку
 * показывает доступные вкладки текущего элемента
*** */
function handlePropertiesElementTabsBack() {
    activePropertiesElementTab = '';
    refreshPropertiesElementTabs();
}

/* ***
 * handlePropertiesElementSelected - обработка выбора элемента
 * проверяет доступность текущей вкладки для нового элемента
 * обновляет основные вкладки свойств
*** */
function handlePropertiesElementSelected() {
    const availability = getPropertiesElementMainAvailability();

    if (activePropertiesElementTab && !availability[activePropertiesElementTab]) activePropertiesElementTab = '';

    refreshPropertiesElementTabs();
}

// Кнопка возврата к списку основных вкладок
const propertiesElementTabsBack = document.createElement('button');

propertiesElementTabsBack.className = 'propertiesElementTabsBack';
propertiesElementTabsBack.textContent = '<';
propertiesElementTabsBack.style.display = 'none';

if (propertiesElementTabsMainContainer) propertiesElementTabsMainContainer.before(propertiesElementTabsBack);

// Обработчики основных вкладок свойств
propertiesElementTabsMain.forEach(tab => {
    tab.addEventListener('click', handlePropertiesElementTabClick);
});

propertiesElementTabsBack.addEventListener('click', handlePropertiesElementTabsBack);
document.addEventListener('editorBlock:elementSelected', handlePropertiesElementSelected);

// Инициализация основных вкладок свойств
refreshPropertiesElementTabs();



/* ===
 * Обработчики событий панели свойств
=== */

// разделяем события input и change чтобы не терять фокус при вводе текста
let isApplyingColorFromPicker = false;

function commitPropertiesChange(selectedElement) {
    if (!selectedElement) {
        return;
    }

    saveCurrentBreakpointState();

    if (!isBaseBreakpoint()) {
        updatePropertiesPanel(selectedElement);

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
        const selectedWindow = selectedElement.ownerDocument && selectedElement.ownerDocument.defaultView ? selectedElement.ownerDocument.defaultView : window;
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

// Обработчик мгновенного изменения свойств
document.addEventListener('input', event => {
    const control = event.target.closest('[data-prop]');

    if (!control) {
        return;
    }

    if (control.type === 'color' && isApplyingColorFromPicker) {
        return;
    }

    // мгновенно применяем только интерактивные элементы (ползунки, чекбоксы, цвета, селекты)
    const instantTypes = [
        'checkbox',
        'color',
        'range',
        'select-one'
    ];
    const propertyName = control.getAttribute('data-prop');
    const isLayoutLive = isLayoutLiveProperty(propertyName);

    if (!instantTypes.includes(control.type) && control.tagName !== 'SELECT' && !isLayoutLive) {
        return; // обычный текст обрабатываем только по событию change
    }

    if (isBaseBreakpoint() && window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;

    if (!selectedElement) {
        return;
    }

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

    const propertyName = control.getAttribute('data-prop');

    if (isLayoutLiveProperty(propertyName)) {
        return;
    }

    if (isBaseBreakpoint() && window.editorBlock && window.editorBlock.saveHistoryState) {
        window.editorBlock.saveHistoryState();
    }

    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;

    if (!selectedElement) {
        return;
    }

    const value = control.type === 'checkbox' ? control.checked : control.value;

    applyPropertyToElement(selectedElement, propertyName, value);

    commitPropertiesChange(selectedElement);
});

// Скрытие автозаполнения при клике вне элемента
document.addEventListener('mousedown', event => {
    if (currentClassAutocompleteTarget && classAutocompleteBox && !classAutocompleteBox.contains(event.target) && event.target !== currentClassAutocompleteTarget) {
        hideClassAutocomplete();
    }
});

// Обновление позиции автозаполнения при ресайзе
window.addEventListener('resize', () => {
    if (currentClassAutocompleteTarget && classAutocompleteBox && classAutocompleteBox.style.display !== 'none') {
        positionClassAutocomplete(currentClassAutocompleteTarget);
    }
});

/* ***
 * initLayoutProperties - инициализация Grid / Flex-панели
 * удаляет лишние настройки
 * подключает размеры экрана
 * скрывает вкладки до выбора подходящего элемента
*** */
function initLayoutProperties() {
    removeUnusedLayoutControls();
    initBreakpointSystem();

    const selectedElement = window.editorBlock ? window.editorBlock.selectedElement : null;

    if (selectedElement) {
        updatePropertiesPanel(selectedElement);
    } else {
        updatePropertiesPanel(null);
    }
}

// Инициализация Grid / Flex-панели
initLayoutProperties();

// Блокировка вызова стандартного окна выбора цвета
document.querySelectorAll('input[type="color"]').forEach(input => {
    input.addEventListener('click', event => {
        event.preventDefault();
    });
});