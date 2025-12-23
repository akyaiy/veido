const btn = document.getElementById('btn1');
const box = document.getElementById('box1');
const container = document.getElementById('container1');
const h3 = container.querySelector('h3');

function onBtnClick() {
    box.style.background =
        box.style.background === 'coral'
            ? 'lightblue'
            : 'coral';
}

function onParagraphClick(e) {
    const p = e.target;
    p.style.fontWeight =
        p.style.fontWeight === '700'
            ? '400'
            : '700';
}

function onContainerMouseOver(e) {
    if (e.target.tagName === 'H3') {
        e.target.style.color = 'darkcyan';
    }
}

function onH3MouseOut() {
    h3.style.color = 'teal';
}

function onBtnDblClick() {
    container.style.borderColor =
        container.style.borderColor === 'gray'
            ? '#ccc'
            : 'gray';
}

btn.onclick = onBtnClick;
btn.ondblclick = onBtnDblClick;

container.onmouseover = onContainerMouseOver;

container.querySelectorAll('p').forEach(p => {
    p.onclick = onParagraphClick;
});

h3.onmouseout = onH3MouseOut;
