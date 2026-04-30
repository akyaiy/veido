const tabs = document.querySelectorAll('#css-js-tabs .tab');

/***********************************************************************
 * tabs tab click — переключение вкладок CSS и JS:
 * - Снимает активное состояние со всех вкладок.
 * - Активирует выбранную вкладку.
 * - Отображает соответствующую панель (CSS или JS).
 * - Скрывает неактивную панель.
 **********************************************************************/
tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        switchTabPanel(tab.dataset.tab);
    });
});