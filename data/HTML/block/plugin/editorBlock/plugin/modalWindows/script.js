// --- функция показа модального окна и ожидания ввода ---
window.showMarkerModal = showMarkerModal;
function showMarkerModal(marker, type = 'message') {
    return new Promise(resolve => {
        const template = document.querySelector('.marker-modal-backdrop');
        if (!template) { console.error('Шаблон .marker-modal-backdrop не найден'); resolve(null); return; }

        const clone = template.cloneNode(true);
        document.body.appendChild(clone);

        const modal = clone.querySelector('.marker-modal');
        const nameEl = clone.querySelector('.marker-name');
        const textEl = clone.querySelector('.marker-text');
        const input = clone.querySelector('.marker-input');
        const okBtn = clone.querySelector('.marker-ok');
        const cancelBtn = clone.querySelector('.marker-cancel');

        okBtn.onclick = cancelBtn.onclick = input.onkeydown = null;
        clone.classList.remove('toast');
        modal.classList.remove('message');
        textEl.style.display = input.style.display = 'none';
        cancelBtn.style.display = '';

        if (type === 'input') {
            clone.style.display = 'flex';
            nameEl.textContent = 'Введите значение:';
            input.style.display = '';
            input.value = '';
            input.placeholder = marker || '';
            setTimeout(() => input.focus(), 0);

            okBtn.onclick = () => closeModal(input.value);
            cancelBtn.onclick = () => closeModal(null);
            input.onkeydown = e => { if (e.key==='Enter') closeModal(input.value); if (e.key==='Escape') closeModal(null); };
        } else {
            clone.classList.add('toast');
            clone.style.display = 'block';
            modal.classList.add('message');
            nameEl.textContent = 'Сообщение:';
            textEl.style.display = 'block';
            textEl.innerHTML = '<hr>' + marker || '';
            cancelBtn.style.display = 'none';

            okBtn.onclick = () => closeModal(true);
            const t = setTimeout(() => closeModal(true), 3000);

            function closeModal(value) {
                clearTimeout(t);
                if (clone.parentNode) document.body.removeChild(clone);
                resolve(value);
            }
            return;
        }

        function closeModal(value) {
            if (clone.parentNode) document.body.removeChild(clone);
            resolve(value);
        }
    });
}