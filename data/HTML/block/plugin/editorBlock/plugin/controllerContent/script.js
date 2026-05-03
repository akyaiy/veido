const btnApplyJs = document.getElementById('jsApplyButton');

/***********************************************************************
 * btnApplyJs onclick — применение JS-кода:
 * - Определяет активный блок.
 * - Применяет JS-код из редактора к выбранному блоку.
 **********************************************************************/
btnApplyJs.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    runJs(blockId);
};

/***********************************************************************
 * applyJs — применение JavaScript-кода к блоку:
 * - Принимает идентификатор блока.
 * - Получает код из JS-редактора и привязывает его к блоку.
 * - Создаёт или обновляет динамический script-элемент блока.
 * - Оборачивает код в защитную IIFE с обработкой ошибок.
 * - Выполняет обновлённый скрипт для активного блока.
 **********************************************************************/
function runJs(blockId) {
    const textEl = document.querySelector('script[data-dynamic-text="' + blockId + '_view"]');
    if (!textEl) return;
    const content = textEl.textContent || '';
    if (!content.trim()) return;

    const prev = document.querySelector('script[data-dynamic="' + blockId + '_view"]');
    if (prev && prev.parentNode) prev.parentNode.removeChild(prev);

    const exec = document.createElement('script');
    exec.setAttribute('data-dynamic', blockId + '_view');
    exec.type = '';
    exec.textContent = `(function(){try{${content}\nif(typeof pageInit==='function')pageInit();}catch(e){console.error('Block script error:',e);}})();`;
    const wrap = document.getElementById(blockId + '_scripts') || document.getElementById('loadedBlockMain') || document.body;
    wrap.appendChild(exec);
    showMarkerModal('JS-код блока успешно применён!');
}