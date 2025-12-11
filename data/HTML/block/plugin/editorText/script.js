const container = document.createElement('div');
container.id = 'body-container';
while (document.body.firstChild) {
    container.appendChild(document.body.firstChild);
}
document.body.appendChild(container);
function copyBodyStyles() {
    for (let sheet of document.styleSheets) {
        try {
            for (let rule of sheet.cssRules) {
                if (rule.selectorText === 'body') {
                    container.style.cssText += rule.style.cssText;
                }
            }
        } catch (e) {
            continue; 
        }
    }
}
copyBodyStyles();

const resizer = document.createElement('div');
resizer.id = 'resizer-top-left';
container.appendChild(resizer);
let isResizing = false;
resizer.addEventListener('mousedown', e => {
    isResizing = true;
    e.preventDefault();
});
document.addEventListener('mouseup', () => isResizing = false);
document.addEventListener('mousemove', e => {
    if (!isResizing) return;
    const minW = 100;
    const minH = 100;
    const newW = Math.max(minW, window.innerWidth - e.clientX);
    const newH = Math.max(minH, window.innerHeight - e.clientY);
    container.style.width = newW + 'px';
    container.style.height = newH + 'px';
});


const contentElement = document.getElementById('content');
const content = contentElement ? contentElement.innerHTML : '';
const tabs = Array.from(document.querySelectorAll('.tab'));
const taHtml = document.getElementById('editor-html');
const taCss = document.getElementById('editor-css');
const taJs = document.getElementById('editor-js');
const btnApply = document.getElementById('btn-apply');
const btnClone = document.getElementById('btn-clone');

taHtml.value = content;
taCss.value = (function(){
    const el = document.querySelector('style[data-dynamic="content"]');
    return el ? el.textContent : '';
})();
taJs.value = (function(){
    const el = document.querySelector('script[data-dynamic="content"]');
    return el ? el.textContent : '';
})();

function setActive(tabName){
    tabs.forEach(t => {
        const name = t.dataset.tab;
        if(name === tabName){
            t.classList.add('active');
        } else {
            t.classList.remove('active');
        }
    });
    taHtml.classList.toggle('hidden', tabName !== 'html');
    taCss.classList.toggle('hidden', tabName !== 'css');
    taJs.classList.toggle('hidden', tabName !== 'js');
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => setActive(tab.dataset.tab));
});

btnApply.addEventListener('click', () => {
    const activeTab = document.querySelector('.tab.active').dataset.tab;
    if(activeTab === 'html'){
        if(!contentElement) return;
        contentElement.innerHTML = taHtml.value;
    } else if(activeTab === 'css'){
        let styleEl = document.querySelector('style[data-dynamic="content"]');
        if(!styleEl){
            styleEl = document.createElement('style');
            styleEl.setAttribute('data-dynamic', 'content');
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = taCss.value;
    } else if(activeTab === 'js'){
        const old = document.querySelector('script[data-dynamic="content"]');
        if(old) old.remove();
        const script = document.createElement('script');
        script.setAttribute('data-dynamic', 'content');
        script.type = 'text/javascript';
        script.textContent = taJs.value;
        document.body.appendChild(script);
    }
});

btnClone.addEventListener('click', () => {
    if(!contentElement) return;
    const clone = contentElement.cloneNode(true);
    clone.removeAttribute('id');
    taHtml.value = clone.outerHTML;
    setActive('html');
});