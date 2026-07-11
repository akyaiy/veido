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

/*****************************************************************************
 * Асинхронный планировщик JS-скриптов
 *****************************************************************************/
window.jsBlockQueue = window.jsBlockQueue || {
    tasks: [],
    isRunning: false,
    onQueueEmpty: null,
    
    push(blockName, executeFn, sessionId = null) {
        this.tasks.push({ blockName, executeFn, sessionId });
        if (!this.isRunning) {
            this.runNextTask();
        }
    },
    
    runNextTask() {
        if (this.tasks.length === 0) {
            this.isRunning = false;
            if (typeof this.onQueueEmpty === 'function') {
                const resolve = this.onQueueEmpty;
                this.onQueueEmpty = null;
                resolve();
            }
            return;
        }
        
        this.isRunning = true;
        const current = this.tasks.shift();
        const scheduleFn = window.requestIdleCallback || ((cb) => setTimeout(cb, 1));
        
        scheduleFn(() => {
            setTimeout(() => {
                try {
                    /* Выполнение таски, только если сессия совпадает с текущей активной */
                    if (current.sessionId === null || current.sessionId === window.currentBlockLoadSession) {
                        current.executeFn();
                    }
                } catch (e) {
                    console.error(e);
                }
                setTimeout(() => this.runNextTask(), 200);
            }, 0);
        });
    },

    wait() {
        return new Promise((resolve) => {
            if (!this.isRunning && this.tasks.length === 0) {
                resolve();
            } else {
                this.onQueueEmpty = resolve;
            }
        });
    },

    clear() {
        this.tasks = [];
        this.isRunning = false;
        this.onQueueEmpty = null;
    }
};

/* Глобальный счетчик сессий для отслеживания быстрых переключений */
window.currentBlockLoadSession = window.currentBlockLoadSession || 0;

/**
 * Загрузка блоков
 * - Загрузка частей редактора из других файлов по id
 * - Вызов сигнала инициализации после загрузки всех блоков
 */
async function initEditorBlocks() {
    const currentSession = ++window.currentBlockLoadSession;

    /* Очистка событий перед новой инициализацией */
    if (typeof window.clearBlockEvents === 'function') window.clearBlockEvents();
    
    /* Сброс очереди старых тасок планировщика */
    window.jsBlockQueue.clear();

    /* Основной блок */
    const mainBlock = [
        { path: "plugin/editorBlockOld/plugin", id: "content" }
    ];

    /* Список блоков редактора */
    const blocks = [
        /* Верхняя панель */
        { path: "plugin/editorBlockOld/plugin/topPanel", id: "topPanel" },
        /* Левая панель */
        { path: "plugin/editorBlockOld/plugin/htmlElementsInserter", id: "htmlElementsInserter" },
        /* Центральная панель */
        { path: "plugin/editorBlockOld/plugin/loadedBlocks", id: "loadedBlocks" },
        { path: "plugin/editorBlockOld/plugin/modeSwitcherContent", id: "modeSwitcherContent" },
        { path: "plugin/editorBlockOld/plugin/controllerContent", id: "controllerContent" },
        { path: "plugin/editorBlockOld/plugin/editorContent", id: "editorContent" },
        /* Правая панель */
        { path: "plugin/editorBlockOld/plugin/panelsSwitcher", id: "panelsSwitcher" },
        { path: "plugin/editorBlockOld/plugin/propertiesPanel", id: "propertiesPanel" },
        { path: "plugin/editorBlockOld/plugin/htmlTagsInserter", id: "htmlTagsInserter" },
        { path: "plugin/editorBlockOld/plugin/jsPanel", id: "jsPanel" },
        /* Глобальные блоки */
        { path: "plugin/editorBlockOld/plugin/rgbPicker", id: "rgbPicker" },
        { path: "plugin/editorBlockOld/plugin/contextMenu", id: "contextMenu" },
        { path: "plugin/editorBlockOld/plugin/modalWindows", id: "modalWindows" }
    ];

    /* Загрузка блоков редактора с контролем сессий */
    const mainSuccess = await loadBlockAllOnce(mainBlock, false, true, currentSession);
    if (!mainSuccess) return;

    const blocksSuccess = await loadBlockAllOnce(blocks, false, true, currentSession);
    if (!blocksSuccess) return;

    /* Загрузка тестовых блоков */
    await testBlockLoading();

    if (currentSession !== window.currentBlockLoadSession) return;

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

async function loadBlockAllOnce(blocksArray, itemsHowText = false, jsCommunication = true, allowedSession = null) {
    if (!window.markdownit) {
        await loadMdScript('/js/markdown-it.min.js');
    }

    if (allowedSession !== null && allowedSession !== window.currentBlockLoadSession) {
        return false;
    }

    const responsesData = [];

    // Получение блока с сервера
    const fetchPromises = blocksArray.map(async (block) => {
        const container = document.getElementById(block.id);
        if (!container) {
            return null;
        }

        const cleanPath = block.path.replace(/\/$/, "");
        const blockName = cleanPath === "pages" ? "pages/home" : cleanPath;

        try {
            // Очистка контейнера и старых динамических стилей/скриптов
            container.innerHTML = '';
            document.querySelectorAll(`style[data-dynamic="${block.id}"], script[data-dynamic="${block.id}"]`).forEach(el => el.remove());

            const response = await apiProtected(`/api/HTML/${blockName}`, { method: "GET" });
            return { block, blockName, container, response };
        } catch (err) {
            console.error(err);
            container.innerHTML = "<h2>блок не найден</h2>";
            return null;
        }
    });

    const resolvedFetches = await Promise.all(fetchPromises);
    
    if (allowedSession !== null && allowedSession !== window.currentBlockLoadSession) {
        return false;
    }

    for (const item of resolvedFetches) {
        if (item && item.response) responsesData.push(item);
    }

    // Добавление CSS блока
    responsesData.forEach(({ block, response }) => {
        if (response.css) {
            const style = document.createElement('style');
            style.dataset.dynamic = block.id;
            style.textContent = response.css;
            document.head.appendChild(style);
        }
    });

    // Преобразуем markdown в HTML
    const md = window.markdownit({ html: true, linkify: true, typographer: true });
    responsesData.forEach(({ block, container, response }) => {
        if (response.content) {
            container.innerHTML = md.render(response.content);
            if (container.id?.match(/^loadedBlock_\d+_view$/)) {
                const htmlContainer = document.getElementById(container.id.replace('_view', '_html'));
                if (htmlContainer) htmlContainer.innerHTML = response.content;
            }
        }
    });

    // Сборка всего JS в один атомарный блок кода
    let combinedJsContent = "";
    let validJsBlocksCount = 0;

    responsesData.forEach(({ block, blockName, response }) => {
        if (response.js) {
            validJsBlocksCount++;
            if (jsCommunication === false) {
                combinedJsContent += `
                    /* Block: ${blockName} */
                    (() => {
                        try {
                            ${response.js}
                            if (typeof pageInit === "function") pageInit();
                        } catch (e) {
                            console.error("Block script error in ${blockName}:", e);
                        }
                    })();
                `;
            } else {
                combinedJsContent += `
                    /* Block: ${blockName} */
                    try {
                        (function(scope){
                            const exports = scope;
                            ${response.js}
                            if (typeof exports.pageInit === "function") exports.pageInit();
                        })((window.__blocks ||= {})["${blockName}"] ||= {});
                    } catch (e) {
                        console.error("Block execution error in ${blockName}:", e);
                    }
                `;
            }
        }
    });

    // Если есть JS контент, пушим выполнение одной объединенной строки в планировщик
    if (validJsBlocksCount > 0) {
        const batchGroupName = blocksArray.length > 1 ? `batch_${blocksArray[0].id}` : blocksArray[0].path;

        window.jsBlockQueue.push(batchGroupName, () => {
            if (allowedSession !== null && allowedSession !== window.currentBlockLoadSession) {
                return;
            }

            const script = document.createElement('script');
            if (itemsHowText !== false) script.type = 'text/plain';
            
            /* Маркируем тег идентификатором первого блока пачки или общей группы */
            script.dataset.dynamic = blocksArray[0].id;
            script.textContent = combinedJsContent;
            
            document.body.appendChild(script);
        }, allowedSession);
    }

    await window.jsBlockQueue.wait();
    return allowedSession === null || allowedSession === window.currentBlockLoadSession;
}