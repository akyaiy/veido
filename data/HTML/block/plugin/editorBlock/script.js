/**
 * Система мониторинга событий (singleton)
 * - Перехват и учёт глобальных event listener'ов
 * - Очистка обработчиков при удалении редактора
 * - Предотвращение утечек событий при перезагрузке блоков
 */
(function() {
    if (window.blockEventMonitor) return;

    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    
    window.blockEventMonitor = {
        tracked: [],
        isCleaning: false
    };

    /* Перехват addEventListener */
    EventTarget.prototype.addEventListener = function(type, listener, options) {
        const editorExists = !!document.getElementById('blockEditor');
        
        /* Проверка: глобальный ли объект */
        const isGlobal = this === window || this === document || this === document.body;

        if (editorExists && isGlobal) {
            /* Проверка на дублирование записей */
            const isAlreadyTracked = window.blockEventMonitor.tracked.some(
                e => e.target === this && e.type === type && e.listener === listener
            );

            /* Добавление в список отслеживаемых */
            if (!isAlreadyTracked) {
                window.blockEventMonitor.tracked.push({ target: this, type, listener, options });
            }
        }
        
        return originalAdd.call(this, type, listener, options);
    };

    /* Очистка динамических обработчиков */
    window.clearBlockEvents = function() {
        const monitor = window.blockEventMonitor;
        /* Если очищать нечего или уже идёт очистка */
        if (monitor.tracked.length === 0 || monitor.isCleaning) return;

        monitor.isCleaning = true;

        /* Проход по всем зарегистрированным обработчикам */
        monitor.tracked.forEach(({ target, type, listener, options }) => {
            try {
                originalRemove.call(target, type, listener, options);
            } catch (e) {}
        });

        /* Полная очистка хранилища */
        monitor.tracked = [];
        monitor.isCleaning = false;
    };

    /* Отслеживание удаления редактора из DOM */
    const observer = new MutationObserver(() => {
        if (!document.getElementById('blockEditor')) {
            window.clearBlockEvents();
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();

/**
 * Загрузка блоков
 * - Загрузка частей редактора из других файлов по id
 * - Вызов сигнала инициализации после загрузки всех блоков
 */
async function initEditorBlocks() {
    /* Очистка событий перед новой инициализацией */
    if (typeof window.clearBlockEvents === 'function') window.clearBlockEvents();

    /* Список блоков редактора */
    const blocks = [
        /* Основной блок */
        { path: "plugin/editorBlock/plugin", id: "content" },
        /* Верхняя панель */
        { path: "plugin/editorBlock/plugin/topPanel", id: "topPanel" },
        /* Левая панель */
        { path: "plugin/editorBlock/plugin/htmlElementsInserter", id: "htmlElementsInserter" },
        /* Центральная панель */
        { path: "plugin/editorBlock/plugin/loadedBlocks", id: "loadedBlocks" },
        { path: "plugin/editorBlock/plugin/modeSwitcherContent", id: "modeSwitcherContent" },
        { path: "plugin/editorBlock/plugin/controllerContent", id: "controllerContent" },
        { path: "plugin/editorBlock/plugin/editorContent", id: "editorContent" },
        /* Правая панель */
        { path: "plugin/editorBlock/plugin/panelsSwitcher", id: "panelsSwitcher" },
        { path: "plugin/editorBlock/plugin/propertiesPanel", id: "propertiesPanel" },
        { path: "plugin/editorBlock/plugin/htmlTagsInserter", id: "htmlTagsInserter" },
        { path: "plugin/editorBlock/plugin/jsPanel", id: "jsPanel" },
        /* Глобальные блоки */
        { path: "plugin/editorBlock/plugin/rgbPicker", id: "rgbPicker" },
        { path: "plugin/editorBlock/plugin/contextMenu", id: "contextMenu" },
        { path: "plugin/editorBlock/plugin/modalWindows", id: "modalWindows" }
    ];

    /* Загрузка блоков редактора */
    for (const block of blocks) {
        await loadBlock(block.path, block.id, false, true);
    }

    /* Загрузка тестовых блоков */
    /* await testBlockLoading(); */

    /* Сигнал завершения инициализации редактора */
    document.dispatchEvent(new Event('initEditorBlocks:ready'));
}
initEditorBlocks();

/**
 * Тестовая загрузка блока
 * - Загружает тестовые блоки для проверки функционала редактора
 */
async function testBlockLoading() {
    /* Загрузка тестового блока */
    await window.tempStore.store(
        { data: { path: "/pages/example" } },
        { recipient: "newLoadedBlock", ttlMs: 5000, destroyOnRead: true }
    );
    await newLoadedBlock();

    /* Загрузка тестового блока */
    await window.tempStore.store(
        { data: { path: "/pages/test" } },
        { recipient: "newLoadedBlock", ttlMs: 5000, destroyOnRead: true }
    );
    await newLoadedBlock();
}