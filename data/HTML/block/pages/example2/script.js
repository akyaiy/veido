/* === Data === */
const pageSettings = {
    name: 'Complex test page',
    version: 1,
    options: {
        editable: true,
        theme: {
            color: 'blue',
            size: 'large'
        }
    },
    blocks: [
        {id: 1, type: 'text', content: 'Example'},
        {id: 2, type: 'card', content: 'Card'}
    ]
};

/* === Class === */
class TestBlock {
    constructor(element) {
        this.element = element;
        this.id = element.id;
        this.classes = [...element.classList];
    }
    updateStyle() {
        this.element.style.border = '2px solid red';
        this.element.style.padding = '10px';
    }
    getInfo() {
        return {
            id: this.id,
            classes: this.classes
        };
    }
}

/* === Init === */
document.addEventListener('DOMContentLoaded', () => {
    const page = document.querySelector('#page');
    const cards = page.querySelectorAll('.card');

    cards.forEach((card, index) => {
        const block = new TestBlock(card);
        if (index === 0) {
            block.updateStyle();
        }
    });

    initEvents();
});

/* === Events === */
function initEvents() {
    document.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', event => {
            const target = event.currentTarget;
            target.classList.toggle('active');
        });
    });
}

/* === Create === */
function createTestElement() {
    const wrapper = document.createElement('div');
    wrapper.className = 'dynamicBlock';
    wrapper.dataset.type = 'test';
    wrapper.innerHTML = '<div class="dynamicTitle">Новый блок</div><div class="dynamicContent"><span>Текст</span><b>Жирный</b></div>';
    document.querySelector('#page').append(wrapper);
}

/* === Observer === */
const page = document.querySelector('#page');

if (page) {
    const observer = new MutationObserver(records => {
        records.forEach(record => {
        });
    });

    observer.observe(page, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true
    });
}

/* === Style === */
function applyTextStyle(element) {
    element.style.fontWeight = 'bold';
    element.style.fontStyle = 'italic';
    element.style.textDecoration = 'underline';
    element.style.color = 'red';
}

function removeTextStyle(element) {
    element.style.removeProperty('font-weight');
    element.style.removeProperty('font-style');
    element.style.removeProperty('text-decoration');
    element.style.removeProperty('color');
}

/* === Parser === */
function parseBlocks(blocks) {
    return blocks.map(block => ({
        id: block.id,
        type: block.type,
        data: {
            content: block.content,
            active: true
        }
    }));
}