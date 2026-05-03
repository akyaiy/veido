/***********************************************************************
 * jsTable — таблица редактора JS-кода блока.
 **********************************************************************/
const jsTable = document.getElementById('editor-jsPanel');
const centerPreJs = document.getElementById('center-tab-pre-js');
jsTable.innerHTML = '';


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
controlsDiv.className = 'jsPanel-controls';
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
        const jsTab = document.querySelector('#modeSwitcherContent .center-tab[data-tab="js"]');
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


// reposition
window.addEventListener('scroll', () => {
    if (currentAutocompleteTarget && jsAutoBox.style.display !== 'none') {
        positionJsAutocomplete(currentAutocompleteTarget);
    }
});
window.addEventListener('resize', () => {
    if (currentAutocompleteTarget && jsAutoBox.style.display !== 'none') {
        positionJsAutocomplete(currentAutocompleteTarget);
    }
});

// hide outside
document.addEventListener('mousedown', e => {
    if (currentAutocompleteTarget && !jsAutoBox.contains(e.target) && e.target !== currentAutocompleteTarget) {
        hideJsAutocomplete();
    }
});

function hideJsAutocomplete() {
    jsAutoBox.style.display = 'none';
    currentAutocompleteTarget = null;
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