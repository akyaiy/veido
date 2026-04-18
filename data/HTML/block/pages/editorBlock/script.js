/**
 * СИСТЕМА МОНИТОРИНГА СОБЫТИЙ (SINGLETON)
 */
(function() {
    if (window.__BlockEventMonitor) return;

    const originalAdd = EventTarget.prototype.addEventListener;
    const originalRemove = EventTarget.prototype.removeEventListener;
    
    window.__BlockEventMonitor = {
        tracked: [],
        isCleaning: false
    };

    EventTarget.prototype.addEventListener = function(type, listener, options) {
        const editorExists = !!document.getElementById('block-editor-app');
        
        // Отслеживаем только события на глобальных объектах (они сами не удаляются)
        const isGlobal = this === window || this === document || this === document.body;

        if (editorExists && isGlobal) {
            // Проверяем, не сохранили ли мы это событие уже (защита от дублей)
            const isAlreadyTracked = window.__BlockEventMonitor.tracked.some(
                e => e.target === this && e.type === type && e.listener === listener
            );

            if (!isAlreadyTracked) {
                window.__BlockEventMonitor.tracked.push({ target: this, type, listener, options });
            }
        }
        
        return originalAdd.call(this, type, listener, options);
    };

    window.clearDynamicEvents = function() {
        const monitor = window.__BlockEventMonitor;
        if (monitor.tracked.length === 0 || monitor.isCleaning) return;

        monitor.isCleaning = true;
        /* console.log(`Очистка: удаляем ${monitor.tracked.length} обработчиков...`); */

        monitor.tracked.forEach(({ target, type, listener, options }) => {
            try {
                originalRemove.call(target, type, listener, options);
            } catch (e) {}
        });

        monitor.tracked = [];
        monitor.isCleaning = false;
        /* console.log("Глобальные события очищены."); */
    };

    // Следим за удалением редактора из DOM
    const observer = new MutationObserver(() => {
        if (!document.getElementById('block-editor-app')) {
            window.clearDynamicEvents();
        }
    });

    observer.observe(document.documentElement, { childList: true, subtree: true });
})();

/**
 * ЗАГРУЗКА БЛОКОВ
 */
async function initBlocks() {
    // На всякий случай чистим перед новой инициализацией
    if (typeof window.clearDynamicEvents === 'function') window.clearDynamicEvents();

    await loadBlockWindow("plugin/editorBlock", "content");

    // Загружаем остальные блоки параллельно
    await Promise.allSettled([
        loadBlockWindow("plugin/editorBlock/plugin/rgb-picker", "rgb-picker-container"),
        loadBlockWindow("plugin/editorBlock/plugin/ed-properties", "ed-properties-container"),
        loadBlockWindow("plugin/editorBlock/plugin/marker-modal", "marker-modal-container")
    ]);
}

async function loadBlockWindow(path, block_Name, itemsHowText = null) {
    const container = document.getElementById(block_Name);
    if (!container) return;

    try {
        // Очистка ресурсов старого блока с таким же именем
        document.querySelectorAll(`[data-dynamic="${block_Name}"]`).forEach(el => el.remove());
        container.innerHTML = '';

        const cleanPath = path.replace(/\/$/, "");
        const apiPath = cleanPath === "pages" ? "pages/home" : cleanPath;

        const response = await apiProtected(`/api/HTML/${apiPath}`, { method: "GET" });

        if (!window.markdownit) {
            await loadMdScript('/js/markdown-it.min.js');
        }

        const { content: mdContent, css, js } = response;

        // Рендер HTML
        if (mdContent) {
            const md = window.markdownit({ html: true, linkify: true, typographer: true });
            container.innerHTML = md.render(mdContent);

            const syncEl = document.getElementById(container.id.replace('_view', '_html'));
            if (container.id.includes('_view') && syncEl) {
                syncEl.innerHTML = mdContent;
            }
        }

        // Рендер CSS
        if (css) {
            const style = document.createElement('style');
            style.dataset.dynamic = block_Name;
            style.textContent = css;
            document.head.appendChild(style);
        }

        // Рендер JS (БЕЗ анонимной обертки, чтобы функции были глобальными)
        if (js) {
            const script = document.createElement('script');
            if (itemsHowText?.includes('js')) script.type = 'text/plain';
            script.dataset.dynamic = block_Name;
            
            script.textContent = `
                try {
                    ${js}
                    if (typeof pageInit === "function") pageInit();
                } catch (e) {
                    console.error("Ошибка в блоке [${block_Name}]:", e);
                }
            `;
            document.body.appendChild(script);
        }

    } catch (err) {
        console.error(err);
        container.innerHTML = "<h2>Ошибка загрузки блока</h2>";
    }
}

initBlocks();