// === Общие элементы ===
const tabsMenuContainer = document.getElementById("tabsMenuContainer");



// === Вкладки меню ===
const tabsIcon = document.getElementById("tabsIcon");
const tabsMenu = document.getElementById("tabsMenu");
const tabs = document.querySelectorAll(".tab");

// Открытие и закрытие меню
tabsIcon.addEventListener("click", () => {
    tabsMenu.classList.toggle("active");
});

document.addEventListener("click", (event) => {
    if (!tabsMenuContainer.contains(event.target) || !tabsIcon.contains(event.target)) {
        tabsMenu.classList.remove("active");
    }
});