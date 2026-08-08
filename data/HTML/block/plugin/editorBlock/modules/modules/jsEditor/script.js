/* ===
 * Элементы DOM редактора кода
 === */

const codeWizardToggle = document.getElementById('codeWizardToggle');
const jsEditorContent = document.getElementById('jsEditorContent');



/* ===
 * Анализ и проверка структуры кода
 === */

/* ***
 * getBraceCounts - подсчет открывающих и закрывающих скобок
 * принимает строку
 * считает фигурные { }, квадратные [ ] и круглые ( ) скобки
 * возвращает объект с количеством opens и closes
*** */
function getBraceCounts(text) {
    let opens = 0;
    let closes = 0;
    let inString = false;
    let stringChar = '';

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        
        if (char === '\\') {
            i++;
            continue;
        }
        
        if (!inString && (char === '"' || char === "'" || char === '`')) {
            inString = true;
            stringChar = char;
            continue;
        }
        
        if (inString && char === stringChar) {
            inString = false;
            continue;
        }
        
        if (!inString) {
            if (char === '{' || char === '[' || char === '(') {
                opens++;
            }
            if (char === '}' || char === ']' || char === ')') {
                closes++;
            }
        }
    }
    
    return { 
        opens: opens, 
        closes: closes 
    };
}

/* ***
 * isPurpleBlock - проверка на фиолетовый C-блок
 * принимает строку кода
 * проверяет классы, методы, массивы и объекты
 * возвращает булево значение
*** */
function isPurpleBlock(text) {
    // Классы, встроенные методы массивов/DOM и структуры данных (= {, = [, : [, : {)
    return /\bclass\b/.test(text) || 
           /\b(map|forEach|observe|reduce|filter|find|addEventListener)\b/.test(text) ||
           /[:=]\s*[\{\[]/.test(text) ||
           /^[\w_]+\s*:\s*[\{\[]/.test(text);
}

/* ***
 * getBlockThemeClass - определение темы C-блока по содержимому
 * принимает строку кода
 * возвращает класс темы (wizardOrange, wizardYellow, wizardGreen, wizardPurple)
*** */
function getBlockThemeClass(text) {
    if (/\baddEventListener\b/.test(text)) {
        return 'wizardGreen';
    }

    if (/^(if|else|for|while|switch|catch)\b/.test(text)) {
        return 'wizardYellow';
    }

    if (/\bfunction\b/.test(text) || (/\([^)]*\)\s*=>/.test(text) && !/\b(map|forEach|reduce|filter|find)\b/.test(text))) {
        return 'wizardOrange';
    }

    return 'wizardPurple';
}

/* ***
 * isStructuralBlock - проверка на структурный блок
 * принимает строку кода
 * проверяет циклы, функции, события, классы, массивы и возвраты
 * возвращает булево значение
*** */
function isStructuralBlock(text) {
    return /^(if|else|for|while|switch|catch)\b/.test(text) ||
           /\bfunction\b/.test(text) ||
           /=>\s*[\{\[]/.test(text) ||
           /\b(class|return)\b/.test(text) ||
           /\b(map|forEach|observe|reduce|filter|find|addEventListener)\b/.test(text) ||
           /[:=]\s*[\{\[]/.test(text) ||
           /^[\w_]+\s*:\s*[\{\[]/.test(text) ||
           /[\{\[]\s*$/.test(text) ||
           /^(\w+\s+)*\w+\s*\([^)]*\)\s*[\{\[]/.test(text);
}



/* ===
 * Создание и рендеринг блоков
 === */

/* ***
 * createBlock - создание DOM-элемента блока
 * принимает тип, текст и отступ
 * создает элемент, делает его перетаскиваемым целиком и настраивает тему
 * возвращает DOM-элемент
*** */
function createBlock(type, text, indent = '') {
    const block = document.createElement('div');
    block.className = 'wizardBlock wizard' + type.charAt(0).toUpperCase() + type.slice(1);
    
    if (type === 'parent') {
        block.classList.add(getBlockThemeClass(text));
    }
    
    block.dataset.indent = indent;
    block.setAttribute('draggable', 'true');

    if (type !== 'empty') {
        const content = document.createElement('div');
        content.className = 'wizardContent';
        content.textContent = text;
        block.appendChild(content);
    }

    return block;
}



/* ===
 * Парсинг кода и сборка текста
 === */

/* ***
 * parseToBlocks - превращает текст кода в DOM-элементы блоков
 * принимает строку с текстом кода
 * разбирает строки на родительские, дочерние и закрывающие блоки
 * возвращает фрагмент DOM с блоками
*** */
function parseToBlocks(text) {
    const fragment = document.createDocumentFragment();
    let currentContainer = fragment;
    const stack = [];

    const lines = text.replace(/\r\n/g, '\n').split('\n');
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        const indentMatch = line.match(/^\s*/);
        const indent = indentMatch ? indentMatch[0] : '';

        // Пустые строки
        if (!trimmed) {
            const block = createBlock('empty', '', indent);
            currentContainer.appendChild(block);
            i++;
            continue;
        }

        // Многострочные комментарии
        if (trimmed.startsWith('/*')) {
            const commentBuffer = [line];
            
            while (i + 1 < lines.length && !commentBuffer[commentBuffer.length - 1].includes('*/')) {
                i++;
                commentBuffer.push(lines[i]);
            }
            
            const firstIndent = commentBuffer[0].match(/^\s*/)[0];
            commentBuffer[0] = commentBuffer[0].substring(firstIndent.length);
            
            const block = createBlock('comment', commentBuffer.join('\n'), firstIndent);
            currentContainer.appendChild(block);
            i++;
            continue;
        }

        // Однострочные комментарии
        if (trimmed.startsWith('//')) {
            const block = createBlock('comment', line.substring(indent.length), indent);
            currentContainer.appendChild(block);
            i++;
            continue;
        }

        const braceCounts = getBraceCounts(trimmed);
        const opens = braceCounts.opens;
        const closes = braceCounts.closes;
        const isStruct = isStructuralBlock(trimmed);

        // Открытие родительского блока
        if (isStruct && opens > closes) {
            const block = createBlock('parent', line.substring(indent.length), indent);
            currentContainer.appendChild(block);

            const body = document.createElement('div');
            body.className = 'wizardBody';
            block.appendChild(body);

            stack.push(currentContainer);
            currentContainer = body;
            i++;
            continue;
        }

        // Закрытие родительского блока (проверка }, ], }), ];)
        if (/^[\}\]\)]/.test(trimmed)) {
            const block = createBlock('close', line.substring(indent.length), indent);
            currentContainer.appendChild(block);

            if (stack.length > 0) {
                currentContainer = stack.pop();
            }
            i++;
            continue;
        }

        // Обычное выражение
        let stmtBuffer = [line];
        let currentOpens = opens;
        let currentCloses = closes;
        let stmtIndent = indent;
        stmtBuffer[0] = line.substring(stmtIndent.length);

        while (currentOpens > currentCloses && i + 1 < lines.length) {
            i++;
            const nextLine = lines[i];
            stmtBuffer.push(nextLine);
            
            const nextBraceCounts = getBraceCounts(nextLine);
            currentOpens += nextBraceCounts.opens;
            currentCloses += nextBraceCounts.closes;
        }

        const block = createBlock('statement', stmtBuffer.join('\n'), stmtIndent);
        currentContainer.appendChild(block);
        i++;
    }

    return fragment;
}
window.editorBlock.parseToBlocks = parseToBlocks;



/* ***
 * parseToText - собирает текст кода из DOM-блоков
 * принимает DOM-элемент контейнера блоков
 * возвращает строку с исходным кодом
*** */
function parseToText(container) {
    let text = '';
    const children = container.children;

    for (let i = 0; i < children.length; i++) {
        const child = children[i];

        if (child.classList.contains('wizardBlock')) {
            const indent = child.dataset.indent || '';

            if (child.classList.contains('wizardEmpty')) {
                text += indent + '\n';
                continue;
            }

            const contentNode = child.querySelector('.wizardContent');
            const content = contentNode ? contentNode.textContent : '';

            if (child.classList.contains('wizardParent')) {
                text += indent + content + '\n';
                const body = child.querySelector('.wizardBody');
                
                if (body) {
                    text += parseToText(body);
                }
            } else {
                text += indent + content + '\n';
            }
        }
    }

    return text;
}
window.editorBlock.parseToText = parseToText;



/* ===
 * Перемещение блоков методом Drag and Drop в реальном времени
 === */

let draggedBlock = null;

/* ***
 * handleDragStart - начало перетаскивания блока
 * - принимает объект события
 * - запоминает перетаскиваемый блок
*** */
function handleDragStart(event) {
    const block = event.target.closest('.wizardBlock');

    if (!block) {
        return;
    }

    draggedBlock = block;
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move';
}

/* ***
 * handleDragOver - наведение при перетаскивании
 * - принимает объект события
 * - позволяет перемещать блоки между ними и внутрь родительских тел
*** */
function handleDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';

    const target = event.target;

    // Если наводим на пустое тело родительского блока (.wizardBody)
    if (target.classList.contains('wizardBody')) {
        if (!draggedBlock.contains(target)) {
            target.appendChild(draggedBlock);
        }
        return;
    }

    const targetBlock = target.closest('.wizardBlock');

    if (!draggedBlock || !targetBlock || draggedBlock === targetBlock) {
        return;
    }

    // Если навели на родительский блок и курсор ближе к нижней его части — можно провалиться внутрь тела
    if (targetBlock.classList.contains('wizardParent')) {
        const body = targetBlock.querySelector('.wizardBody');
        const rect = targetBlock.getBoundingClientRect();
        
        if (body && event.clientY > rect.bottom - 20) {
            if (!draggedBlock.contains(body)) {
                body.appendChild(draggedBlock);
            }
            return;
        }
    }

    const targetContainer = targetBlock.parentNode;

    if (!targetContainer || !targetContainer.contains(draggedBlock)) {
        return;
    }

    const rect = targetBlock.getBoundingClientRect();
    const middleY = rect.top + rect.height / 2;

    if (event.clientY < middleY) {
        targetContainer.insertBefore(draggedBlock, targetBlock);
    } else {
        targetContainer.insertBefore(draggedBlock, targetBlock.nextSibling);
    }
}

/* ***
 * handleDrop - завершение перемещения блока
 * - принимает объект события
 * - предотвращает стандартное поведение браузера
*** */
function handleDrop(event) {
    event.preventDefault();
    event.stopPropagation();
}

/* ***
 * handleDragEnd - окончание переноса
 * - сбрасывает ссылку на перетаскиваемый элемент
*** */
function handleDragEnd() {
    draggedBlock = null;
}



/* ===
 * Управление режимами редактора
 === */

/* ***
 * setEditMode - установка режима редактора
 * принимает булево значение режима
 * обновляет состояние редактора и кнопки
*** */
function setEditMode(isWizardMode) {
    if (!jsEditorContent || !codeWizardToggle) {
        return;
    }

    if (isWizardMode) {
        const codeText = jsEditorContent.textContent || '';
        jsEditorContent.innerHTML = '';
        jsEditorContent.appendChild(parseToBlocks(codeText));
    } else {
        if (jsEditorContent.classList.contains('wizard')) {
            const codeText = parseToText(jsEditorContent);
            jsEditorContent.innerHTML = '';
            jsEditorContent.textContent = codeText;
        }
    }

    jsEditorContent.classList.toggle('wizard', isWizardMode);
    jsEditorContent.setAttribute('contenteditable', isWizardMode ? 'false' : 'plaintext-only');

    codeWizardToggle.classList.toggle('wizard', isWizardMode);
    codeWizardToggle.textContent = isWizardMode ? 'Текстовый режим' : 'Визуальный режим';
}

/* ***
 * toggleCodeWizardMode - переключение режима редактора
 * инвертирует текущий визуальный режим
*** */
function toggleCodeWizardMode() {
    if (!jsEditorContent) {
        return;
    }

    const isWizardMode = !jsEditorContent.classList.contains('wizard');
    setEditMode(isWizardMode);
}



/* ===
 * Инициализация работы скрипта
 === */

// Обработчики событий редактора
if (codeWizardToggle && jsEditorContent) {
    codeWizardToggle.addEventListener('click', toggleCodeWizardMode);
    
    jsEditorContent.addEventListener('dragstart', handleDragStart);
    jsEditorContent.addEventListener('dragover', handleDragOver);
    jsEditorContent.addEventListener('drop', handleDrop);
    jsEditorContent.addEventListener('dragend', handleDragEnd);

    setEditMode(false);
}