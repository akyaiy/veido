//loadBlock("plugin/fManager", "content");

showPopupBtn.addEventListener('click', () => {
    popup(messageInput.value || 'Пустое сообщение');});

showfManagerBtn.addEventListener('click', () => {
    loadBlock("plugin/fManager", "content");;});
