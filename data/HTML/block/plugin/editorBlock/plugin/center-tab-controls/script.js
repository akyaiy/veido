const btnApplyJs = document.getElementById('btn-apply-js');


/* btnLoadFromView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;
    htmlDiv.innerHTML = view.innerHTML;
    centerPreHtml.textContent = htmlDiv.innerHTML;
};

btnApplyToView.onclick = () => {
    const blockId = getActiveBlockId();
    if (!blockId) return;
    const view = document.getElementById(blockId + '_view');
    const htmlDiv = document.getElementById(blockId + '_html');
    if (!view || !htmlDiv) return;

    const md = window.markdownit({ html: true, linkify: true, typographer: true });
    const rendered = centerPreHtml.textContent;

    htmlDiv.innerHTML = rendered;
    view.innerHTML = rendered;
}; */

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