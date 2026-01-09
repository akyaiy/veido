let nameStringMod;
let fCodeMod;
// универсальный обработчик (вставка, ввод, удаление, drag-drop)
function triggerUpdate() {
    // вставка иногда происходит позже — даём браузеру завершить операцию
    requestAnimationFrame(updateLineNumbers);
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

updateLineNumbers();

// ==================== ORIGINAL FUNCTIONS ====================
async function loadSource(name) {
    if (name != ""){
        const res = await apiProtected("/api/functions/source/" + name);
        if (!res==="") {
            code.value = "// source not found or binary only";
            return;
        }

         code.value = res;
        } else {
            code.value = "";    
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
        code.value = "";
        newfunction.value = "";
        bt_newFunc.innerText = 'Выбрать';
    }
    code.value = "";
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
            goCode: code.value
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
            goCode: code.value
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
    const lines = code.value.split("\n").length;
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