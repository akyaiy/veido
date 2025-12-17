
const panel = document.getElementById("regPanel");

panel.addEventListener("click", (e) => {
    // ищем ближайшую <a> с data-link="true"
    const link = e.target.closest("a[data-link='true']");
    if (!link || !panel.contains(link)) return; // если клик не по нужной ссылке — выходим

    e.preventDefault(); // отменяем переход по ссылке
    e.stopPropagation(); // предотвращаем всплытие события

    const urlStruct = urlStrBr(link.href);
    const targetId = link.dataset.target || "regDiv";

    if (urlStruct.action === "sPage") {
        // Меняем URL в браузере без перезагрузки
        const newUrl = `/${urlStruct.url}/?${urlStruct.action}=${urlStruct.data}`;
        history.pushState(null, "", newUrl);

        // Загружаем блок
        loadBlock(`pages/${urlStruct.url}/${urlStruct.data}`, targetId);
    }
});


function handleCurrentUrl() {
    const urlStruct = urlStrBr(window.location.href);
//    console.log("Текущий URL:", urlStruct);
    if (urlStruct.action === "sPage") {
        // пример вызова loadBlock для sPage
        loadBlock("pages/" + urlStruct.url + "/" + urlStruct.data, "regDiv");
    }
}

function urlStrBr(url){
    // Создаём объект URL
    const parsedUrl = new URL(url);
    // 1. firstPart — берём путь до "?" и удаляем "/"
    const firstPart = parsedUrl.pathname.replace(/^\/|\/$/g, "");
    // 2. secondPart — берём ключ последнего параметра
    const searchParams = parsedUrl.searchParams;
    const secondPart = Array.from(searchParams.keys()).pop(); // берём последний ключ
    // 3. thirdPart — берём значение последнего параметра
    const thirdPart = searchParams.get(secondPart);
    // Формируем структуру
    return {
        url: firstPart,
        action: secondPart,
        data: thirdPart
    };
}

// При загрузке страницы
handleCurrentUrl();

// При переходах по истории (назад/вперед)
window.addEventListener("popstate", handleCurrentUrl);


// document.addEventListener("click", (e) => {
//     if (!e.target.classList.contains("toggle-pass")) return;

//     const input = e.target.previousElementSibling;
//     if (!input) return;

//     if (input.type === "password") {
//         input.type = "text";
//         e.target.textContent = "🙈";
//     } else {
//         input.type = "password";
//         e.target.textContent = "👁";
//     }
// });