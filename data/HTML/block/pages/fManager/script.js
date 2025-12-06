//loadBlock("plugin/fManager", "content");

showPopupBtn.addEventListener('click', () => {
    popup(messageInput.value || 'Пустое сообщение');});

showfManagerBtn.addEventListener('click', () => {
    const div = document.createElement("div");
    div.id = "fManager";

    document.body.appendChild(div);

//     const testW = document.createElement('div');
//     testW.id = 'test_W'
//     testW.className = 'testWW';

    loadBlock("plugin/fManager", "fManager");

 });

    /*
const overlay = document.createElement('div');

    */ 
