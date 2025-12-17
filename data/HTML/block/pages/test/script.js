const btn = document.getElementById('btn1');
const box = document.getElementById('box1');
const container = document.getElementById('container1');

// 1. Событие через отдельную функцию
function toggleBoxColor() {
    box.style.background = box.style.background === 'coral' ? 'lightblue' : 'coral';
}
btn.addEventListener('click', toggleBoxColor);

// 2. Событие через анонимную функцию
container.querySelectorAll('p').forEach(p => {
    p.addEventListener('click', function() {
        this.style.fontWeight = this.style.fontWeight === '700' ? '400' : '700';
    });
});

// 3. Событие через стрелочную функцию
container.addEventListener('mouseover', e => {
    if (e.target.tagName === 'H3') e.target.style.color = 'darkcyan';
});

// 4. Событие через прямой вызов свойства
const h3 = container.querySelector('h3');
h3.onmouseout = () => h3.style.color = 'teal';

// 5. Событие через отдельную переменную функции
const toggleBorder = () => {
    container.style.borderColor = container.style.borderColor === 'gray' ? '#ccc' : 'gray';
};
btn.addEventListener('dblclick', toggleBorder);
