/***********************************************************************
 * Элементы интерфейса управления загруженным блоком.
 **********************************************************************/
const handle = document.querySelector('.small-handle');
const loadedBlock = document.getElementById('loadedBlock');

/***********************************************************************
 * Переменные состояния перетаскивания и изменения размера блока.
 **********************************************************************/
let active = false;
let sx, sy, sw, sh;

/***********************************************************************
 * Обновление позиции handle при скролле или изменении размера блока
 **********************************************************************/
function updateHandlePosition() {
    handle.style.display = '';
    handle.style.top = loadedBlock.scrollTop + loadedBlock.clientHeight - handle.offsetHeight - 8 + 'px';
    handle.style.left = loadedBlock.scrollLeft + loadedBlock.clientWidth - handle.offsetWidth - 8 + 'px';
}

/***********************************************************************
 * handle mousedown — начало изменения размера блока
 **********************************************************************/
handle.onmousedown = e => {
    e.preventDefault();
    active = true;
    sx = e.clientX;
    sy = e.clientY;
    sw = loadedBlock.offsetWidth;
    sh = loadedBlock.offsetHeight;

    document.onmousemove = move;
    document.onmouseup = () => {
        active = false;
        document.onmousemove = null;
        updateHandlePosition(); // после отпускания мыши корректируем позицию
    };
};

/***********************************************************************
 * move — обработчик изменения размеров блока
 **********************************************************************/
function move(e) {
    if (!active) return;

    let deltaX = e.clientX - sx;
    let deltaY = e.clientY - sy;

    loadedBlock.style.width = sw + deltaX + 'px';
    loadedBlock.style.height = sh + deltaY + 'px';

    updateHandlePosition(); // handle двигается вместе с прокруткой видимой области
}

/***********************************************************************
 * Обновление позиции при скролле блока
 **********************************************************************/
loadedBlock.addEventListener('click', updateHandlePosition);
loadedBlock.addEventListener('scroll', () => {
    handle.style.display = 'none';
});