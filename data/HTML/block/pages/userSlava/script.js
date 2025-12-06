async function loadCurrentBlock(path, targetId) {
    try {
        await loadBlock(path, targetId);
    } catch (err) {
        console.error("Ошибка загрузки блока:", err);
    }
}

const panel = document.getElementById("regPanel");
const defaultTargetId = "regDiv";

panel.addEventListener("click", async (e) => {
    const a = e.target.closest("a[data-link='true']");
    if (!a) return;

    e.preventDefault();

    const urlParams = new URL(a.href).searchParams;
    const path = urlParams.get("block");
    const targetId = a.dataset.target || defaultTargetId;
    if (!path) return;

    history.pushState(null, "", `/userSlava/?block=${path}`);

    await loadCurrentBlock(path, targetId);
});

window.addEventListener("popstate", async () => {
    const params = new URLSearchParams(window.location.search);
    const path = params.get("block");
    if (!path) return;
    await loadCurrentBlock(path, defaultTargetId);
});

const params = new URLSearchParams(window.location.search);
const path = params.get("block");
if (path) {
    loadCurrentBlock(path, defaultTargetId);
}