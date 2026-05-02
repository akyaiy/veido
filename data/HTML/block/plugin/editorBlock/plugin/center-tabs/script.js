const centerTabs = document.querySelectorAll('#center-tabs .center-tab');

/***********************************************************************
 * centerTabs tab click — переключение режимов просмотра блока:
 * - Обрабатывает клик по вкладкам view / html / js.
 * - Делает выбранную вкладку активной.
 * - Определяет текущий активный блок.
 * - Переключает отображение блока в соответствующий режим.
 **********************************************************************/
centerTabs.forEach(tab => {
    tab.onclick = () => {
        centerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const blockId = getActiveBlockId();
        if (!blockId) return;
        if (tab.dataset.tab === 'view') showView(blockId);
        if (tab.dataset.tab === 'html') showHtml(blockId);
        if (tab.dataset.tab === 'js') showJs(blockId);
    };
});




/***********************************************************************
 * updateCenterControls — управление кнопками центральной панели:
 * - Принимает текущий режим отображения (view / html / js).
 * - Показывает или скрывает кнопку применения JS.
 **********************************************************************/
function updateCenterControls(mode) {
    /* btnLoadFromView.style.display = mode === 'html' ? '' : 'none';
    btnApplyToView.style.display = mode === 'html' ? '' : 'none'; */
    const btnApplyJs = document.getElementById('btn-apply-js');
    if (btnApplyJs) btnApplyJs.style.display = mode === 'js' ? '' : 'none';

    const panel = document.getElementById('center-tab-controls');

    const buttons = panel.querySelectorAll('button');
    const visible = Array.from(buttons).some(btn => btn.style.display !== 'none');

    panel.style.display = visible ? 'flex' : 'none';
}

/***********************************************************************
 * showView — показ блока в режиме визуального просмотра:
 * - Принимает идентификатор блока, который нужно отобразить.
 * - Скрывает область редактирования HTML и JS.
 * - Обновляет состояние кнопок управления в центре.
 * - Отображает только активный блок, скрывая остальные.
 **********************************************************************/
function showView(blockId) {
    centerContent.style.display = 'none';
    updateCenterControls('view');
    const container = document.getElementById('loadedBlockMain');
    if (!container) return;
    Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = '';
    document.getElementById('left-panel').style.display = 'flex';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = '';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').click();
    ensureJsPanelSelection(blockId);
}

/***********************************************************************
 * showHtml — показ блока в режиме редактирования HTML:
 * - Принимает идентификатор блока.
 * - Показывает HTML-редактор и скрывает JS-редактор.
 * - Обновляет состояние кнопок управления.
 * - Скрывает визуальный режим и отображает только активный блок.
 * - Загружает HTML блока в редактор, если пользователь ещё не редактировал код.
 **********************************************************************/
function showHtml(blockId) {
    const centerPreHtml = document.getElementById('center-tab-pre-html');
    const centerPreJs = document.getElementById('center-tab-pre-js');
    centerContent.style.display = '';
    centerPreHtml.style.display = '';
    centerPreJs.style.display = 'none';
    updateCenterControls('html');

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = ch.id === blockId ? '' : 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';

    const htmlContainer = document.getElementById(blockId + '_html');
    centerPreHtml.textContent = htmlContainer.innerHTML;
    document.getElementById('left-panel').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="js"]').click();
}

/***********************************************************************
 * showJs — отображение и подготовка JS-кода блока:
 * - Переключает интерфейс в режим редактирования JS.
 * - Извлекает JS-код блока и очищает его от служебной обёртки.
 * - Показывает JS-редактор и скрывает визуальное представление блока.
 **********************************************************************/
function ensureHandlerFunctions(code) {
    const handlerNames = new Set();
    let m;

    // find .onX = handler;
    const onAssignRe = /\.on[a-zA-Z]+\s*=\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = onAssignRe.exec(code)) !== null) {
        handlerNames.add(m[1]);
    }

    // find addEventListener(..., handler)
    const addListenerRe = /\.addEventListener\(\s*['"][^'"]+['"]\s*,\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
    while ((m = addListenerRe.exec(code)) !== null) {
        handlerNames.add(m[1]);
    }

    // собрать уже определенные функции и переменные, присвоенные функциям/стрелочным функциям
    const defined = new Set();
    const funcDefRe = /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g;
    while ((m = funcDefRe.exec(code)) !== null) {
        defined.add(m[1]);
    }
    const varFuncRe = /(?:var|let|const)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:function\b|\()/g;
    while ((m = varFuncRe.exec(code)) !== null) {
        defined.add(m[1]);
    }

    handlerNames.forEach(name => {
        if (!defined.has(name)) {
            code += `\nfunction ${name}() {\n    // автоматически сгенерированный функция\n}\n`;
        }
    });

    return code;
}

function stripJsWrapper(code) {
    // Arrow IIFE with try/catch + optional pageInit
    let out = code
        .replace(/^\s*\(\(\)\s*=>\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*if\s*\(\s*typeof pageInit[\s\S]*?\)\s*pageInit\(\);\s*/s, '')
        .replace(/\s*}\s*catch[\s\S]*?}\s*\}\)\s*\(\s*\)\s*;?\s*$/s, '');

    // Legacy function IIFE wrapper (fallback)
    out = out
        .replace(/^\s*\(function\(\)\s*{\s*try\s*{\s*/s, '')
        .replace(/\s*}\s*catch\s*\(e\)\s*{\s*console\.error\(\"Block script error:\",\s*e\);\s*}\s*}\)\(\);?\s*$/s, '');

    return out;
}

function showJs(blockId, highlightSearch=null) {
    const centerPreHtml = document.getElementById('center-tab-pre-html');
    const centerPreJs = document.getElementById('center-tab-pre-js');
    centerContent.style.display = '';
    centerPreHtml.style.display = 'none';
    centerPreJs.style.display = '';
    updateCenterControls('js');

    const scriptEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    let code = scriptEl ? scriptEl.textContent : '';

    code = stripJsWrapper(code);

    code = ensureHandlerFunctions(code);

    centerPreJs.textContent = code;
    centerJsBlockId = blockId; // отслеживаем, какому блоку принадлежит centerPreJs

    if (highlightSearch) {
        setTimeout(() => {
            highlightInJsEditor(highlightSearch, code);
        }, 0);
    }

    const container = document.getElementById('loadedBlockMain');
    if (container) Array.from(container.children).forEach(ch => {
        if (ch !== document.querySelector('.small-handle')) ch.style.display = 'none';
    });
    document.getElementById('loadedBlock').style.display = 'none';
    document.getElementById('left-panel').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="properties"]').style.display = 'none';
    document.querySelector('#css-js-tabs .tab[data-tab="js"]').click();
}