/* ===
 * Выбор селектора для редактирования событий
=== */

/* ***
 * handleSelectorType - переключение поля выбора класса
 * - показывает список классов при выборе class
 * - скрывает список классов при выборе id
*** */
function handleSelectorType() {
    const selectorType = document.getElementById('selectorType');
    const selectorClass = document.getElementById('selectorClass');

    if (selectorType.value === 'class') {
        selectorClass.style.display = '';
    } else {
        selectorClass.style.display = 'none';
    }
}

// Добавление обработчика выбора типа селектора
document.getElementById('selectorType').addEventListener('change', handleSelectorType);