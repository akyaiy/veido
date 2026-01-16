let nameStringMod;
let fCodeMod;
let lastContent = code.innerHTML;
// универсальный обработчик (вставка, ввод, удаление, drag-drop)
function triggerUpdate() {
    // вставка иногда происходит позже — даём браузеру завершить операцию
    requestAnimationFrame(updateLineNumbers);
    detectAndHighlightChanges();
}

// ВСЕ события, которые могут менять текст
code.addEventListener("input", triggerUpdate);
code.addEventListener("change", triggerUpdate);
code.addEventListener("keyup", triggerUpdate);
code.addEventListener("paste", triggerUpdate);
code.addEventListener("cut", triggerUpdate);
code.addEventListener("drop", triggerUpdate);

code.addEventListener("scroll", () => {
    lineNumbers.scrollTop = code.scrollTop;
});
lineNumbers.addEventListener("scroll", () => {
    code.scrollTop = lineNumbers.scrollTop;
});
code.addEventListener('paste', (e) => {
    e.preventDefault();
    const text = (e.clipboardData || window.clipboardData).getData('text') || '';
    insertPlainLinesAtCaret(text);
});
code.addEventListener('drop', (e) => {
    e.preventDefault();
    const text = (e.dataTransfer && e.dataTransfer.getData && e.dataTransfer.getData('text')) ||
                 (e.clipboardData && e.clipboardData.getData && e.clipboardData.getData('text')) || '';
    insertPlainLinesAtCaret(text);
});
function insertPlainLinesAtCaret(text) {
    const lines = text.split(/\r?\n/);
    if (lines.length === 0) return;

    const sel = window.getSelection();
    let anchor = sel.rangeCount ? sel.getRangeAt(0).startContainer : null;

    // найти родительскую строку (div первого уровня)
    let targetLine = null;
    if (anchor) {
        let node = anchor;
        while (node && node.parentNode !== code) node = node.parentNode;
        if (node && node.parentNode === code) targetLine = node;
    }

    // если нет строки — добавляем/используем последнюю
    if (!targetLine) {
        if (code.children.length === 0) {
            const d0 = document.createElement('div');
            d0.appendChild(document.createElement('br'));
            code.appendChild(d0);
        }
        targetLine = code.lastElementChild;
    }

    // replace current line's content with first pasted line
    targetLine.textContent = lines[0] || "";
    let lastInserted = targetLine;

    // insert remaining lines after targetLine
    for (let i = 1; i < lines.length; i++) {
        const d = document.createElement('div');
        d.textContent = lines[i] || "";
        lastInserted.parentNode.insertBefore(d, lastInserted.nextSibling);
        lastInserted = d;
    }

    // поместить каретку в конец последней вставленной строки
    const range = document.createRange();
    range.setStart(lastInserted, lastInserted.textContent.length);
    range.collapse(true);
    sel.removeAllRanges();
    sel.addRange(range);

    // вызвать подсветку изменившихся строк
    detectAndHighlightChanges();
}

updateLineNumbers();

// ==================== ORIGINAL FUNCTIONS ====================
async function loadSource(name) {
    if (name != ""){
        const res = await fetch("/api/functions/source/" + name);
        if (!res.ok) {
            code.innerText = "// source not found or binary only";
            return;
        }

        const text = await res.text();
        code.innerText = text;
        } else {
            code.innerText = "";    
        }
    // ВАЖНО: обновляем нумерацию после программной вставки
    requestAnimationFrame(updateLineNumbers);

}

async function loadFunctions() {
    const list = await apiProtected('/api/functions/list');
    functionList.innerHTML = '<option value="">— select —</option>';
    list.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        functionList.appendChild(opt);
    });
}

function newf() {
    if (functionList.className == 'hidden'){
        functionList.classList.remove('hidden');
        newfunction.classList.add('hidden');
        selectFunction();
        bt_newFunc.innerText = 'Создать';
    } else {
        functionList.classList.add('hidden');
        newfunction.classList.remove('hidden');
        code.innerText = "";
        newfunction.value = "";
        bt_newFunc.innerText = 'Выбрать';
    }
    code.innerText = "";
    updateLineNumbers();
}

function selectFunction() {
    loadSource(functionList.value);
    requestAnimationFrame(updateLineNumbers);
}

async function compile() {
    if (functionList.value != ""){
    const res = await apiProtected('/api/functions/compile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            functionName: functionList.value,
            goCode: code.innerText
        })
    });
    output.textContent = res;
    }
}

async function savef() {
    if (newfunction.className == "hidden"){
        popup("old")
    } else {
        await popup("new");
        return;
        //console.log("test")
    }
    if (newfunction.value != ""){
    const res = await apiProtected('/api/functions/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            functionName: newfunction.value,
            goCode: code.innerText
        })
    });
    output.textContent = res;
    }
}

async function run() {
    const name = functionList.value;

    const res = await apiProtected('/api/functions/run/' + name, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: input.value })
    });

    output.textContent = res;
}

function updateLineNumbers() {
    if (!code) return;
    const lines = code.children.length;

    let html = "";
    for (let i = 1; i <= lines; i++) {
        html += i + "<br>";
    }

    lineNumbers.innerHTML = html;
}

function btLoc(){
    if (newfunction.value != ""){
        nameStringMod = true;
    } else {
        nameStringMod = false;
    }
}

function codLoc(){
        fCodeMod = true;
        fCodeMod = false;
}

functionList.addEventListener("change", selectFunction);
bt_newFunc.addEventListener("click", newf);
bt_compile.addEventListener("click", compile);
bt_run.addEventListener("click", run);
bt_save.addEventListener("click", savef);
newfunction.addEventListener("input", btLoc)
code.addEventListener("input", codLoc)

loadFunctions();



/* обновленгие подсвтеки синтаксиса */
// снятие снимка первых детей (предполагается, что `code` уже определён)
let lastChildrenText = Array.from(code.children).map(c => c.textContent);

// detectAndHighlightChanges — подсвечивает только изменённые div первого уровня
function detectAndHighlightChanges() {
    const children = Array.from(code.children);
    const newSnapshot = [];

    // минимальные логи для отладки

    for (let i = 0; i < children.length; i++) {
        const child = children[i];
        const text = child.textContent;
        newSnapshot[i] = text;

        if (lastChildrenText[i] !== text) {

            // проверяем — каретка внутри этой строки?
            const sel = window.getSelection();
            let caretInside = false;
            if (sel.rangeCount) {
                let node = sel.getRangeAt(0).startContainer;
                while (node && node !== child) node = node.parentNode;
                caretInside = !!node;
            }

            const offset = caretInside ? getCaretCharacterOffsetWithin(child) : 0;

            // подсветить только эту строку
            highlightGoCode(child);

            // восстановить каретку если нужно
            if (caretInside) {
                setCaretPosition(child, offset);
            }
        }
    }

    lastChildrenText = newSnapshot;
}

// highlightGo — подсветка строки с кареткой (не менять)
function highlightGo(html) {
    const sel = window.getSelection();
    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    let targetLine = range.startContainer;
    while (targetLine && targetLine.parentNode !== html) targetLine = targetLine.parentNode;
    if (!targetLine || targetLine.nodeType !== 1) return;

    const offset = getCaretCharacterOffsetWithin(targetLine);
    highlightGoCode(targetLine);
    html.focus();
    setCaretPosition(targetLine, offset);
}

const KEYWORDS = new Set([
    "break","case","chan","const","continue","default","defer","else",
    "fallthrough","for","func","go","goto","if","import","interface",
    "map","range","return","select","struct","switch","type","var"
]);

const PACKAGES = new Set(["package", "import"]); // Отдельно для .go-package
const TYPES = new Set([
    "int","int8","int16","int32","int64","uint","uint8","uint16","uint32","uint64",
    "uintptr","float32","float64","complex64","complex128","bool","string","rune","byte","error","any"
]);

const CONSTS = new Set(["true","false","nil","iota"]);

const BUILTINS = new Set([
    "append","cap","close","complex","copy","delete","imag","len","make","new",
    "panic","print","println","real","recover"
]);

// Добавлен захват операторов и знаков пунктуации
const regex = /(\/\/.*$)|("([^"\\]|\\.)*")|(`[^`]*`)|('(?:\\.|[^\\'])')|\b(0x[0-9a-fA-F]+|\d+\.\d+|\d+)\b|\b([A-Za-z_]\w*)\b|([+\-*/%&|^<>!=:=;.,(){}[\]])/gm;

function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function highlightGoCode(line) {
    if (!line) return line;
    const text = line.textContent || "";
    if (text.trim() === "") {
        line.innerHTML = "<br>";
        return line;
    }

    let highlighted = "";
    let lastIndex = 0;
    let match;
    regex.lastIndex = 0;

    while ((match = regex.exec(text)) !== null) {
        const idx = match.index;
        if (idx > lastIndex) highlighted += escapeHtml(text.slice(lastIndex, idx));

        if (match[1]) { // Комментарий
            highlighted += `<span class="go-comment">${escapeHtml(match[1])}</span>`;
        } else if (match[2] || match[4] || match[5]) { // Строки и руны
            highlighted += `<span class="go-string">${escapeHtml(match[0])}</span>`;
        } else if (match[6]) { // Число
            highlighted += `<span class="go-number">${escapeHtml(match[6])}</span>`;
        } else if (match[7]) { // Идентификатор
            const id = match[7];
            const nextChar = text.slice(regex.lastIndex).trim()[0];
            const prevChar = text.slice(0, idx).trim().slice(-1);

            if (PACKAGES.has(id)) {
                highlighted += `<span class="go-package">${escapeHtml(id)}</span>`;
            } else if (KEYWORDS.has(id)) {
                highlighted += `<span class="go-keyword">${escapeHtml(id)}</span>`;
            } else if (TYPES.has(id)) {
                highlighted += `<span class="go-type">${escapeHtml(id)}</span>`;
            } else if (CONSTS.has(id)) {
                highlighted += `<span class="go-const">${escapeHtml(id)}</span>`;
            } else if (BUILTINS.has(id)) {
                highlighted += `<span class="go-builtin">${escapeHtml(id)}</span>`;
            } else if (nextChar === '(') {
                // Если после слова идет скобка — это метод/функция
                highlighted += `<span class="go-method">${escapeHtml(id)}</span>`;
            } else if (prevChar === '.') {
                // Если перед словом точка — это обращение к полю или методу пакета
                highlighted += `<span class="go-field">${escapeHtml(id)}</span>`;
            } else {
                // Все остальное — переменные
                highlighted += `<span class="go-variable">${escapeHtml(id)}</span>`;
            }
        } else if (match[8]) { // Операторы
            highlighted += `<span class="go-operator">${escapeHtml(match[8])}</span>`;
        }

        lastIndex = regex.lastIndex;
    }

    if (lastIndex < text.length) highlighted += escapeHtml(text.slice(lastIndex));
    line.innerHTML = highlighted || "<br>";
    return line;
}

// восстановление каретки — оставлено почти без изменений (работает с вложенными span'ами)
function setCaretPosition(element, offset) {
    const range = document.createRange();
    const sel = window.getSelection();
    let charCount = 0;
    let nodeStack = [element];
    let node, found = false;
    if (element.textContent.length === 0) {
        range.setStart(element, 0);
        range.collapse(true);
        sel.removeAllRanges();
        sel.addRange(range);
        return;
    }
    while (!found && (node = nodeStack.pop())) {
        if (node.nodeType === 3) {
            const nextCharCount = charCount + node.length;
            if (offset <= nextCharCount) {
                range.setStart(node, offset - charCount);
                range.collapse(true);
                found = true;
            }
            charCount = nextCharCount;
        } else {
            let i = node.childNodes.length;
            while (i--) nodeStack.push(node.childNodes[i]);
        }
    }
    if (found) {
        sel.removeAllRanges();
        sel.addRange(range);
    }
}

// вычисление смещения каретки внутри элемента (в символах)
function getCaretCharacterOffsetWithin(element) {
    let caretOffset = 0;
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
}
