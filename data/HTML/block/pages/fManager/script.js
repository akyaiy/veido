//loadBlock("plugin/fManager", "content");

showPopupBtn.addEventListener('click', () => {
    popup(messageInput.value || 'Пустое сообщение');});

showfManagerBtn.addEventListener('click', () => {
    const div = document.createElement("div");
    div.id = "testDiv";

    // Центрирование
    div.style.position = "fixed";
    div.style.top = "50%";
    div.style.left = "50%";
    div.style.transform = "translate(-50%, -50%)";

    // Стиль
    div.style.width = "1000px";
    div.style.height = "500px";
    div.style.padding = "20px";
    div.style.background = "#e6e6e6";
    div.style.textAlign = "center";
    div.style.borderRadius = "10px";
    div.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
    div.style.zIndex = 9999; // <-- важно, выводит поверх всего

    document.body.appendChild(div);

//     const testW = document.createElement('div');
//     testW.id = 'test_W'
//     testW.className = 'testWW';

    loadBlock("plugin/fManager", "testDiv");

 });

    /*
const overlay = document.createElement('div');

    */ 
