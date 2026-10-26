/*************************************************************************
 * pageInit функция автозапуска скриптов, после подгрузки на страницу    *
 *************************************************************************/
function pageInit() {
//const burger = document.getElementById("burger");
 // Добавляем обработчик клика
 burger.addEventListener("click", toggleMenu);
 // Закрытие меню при выборе пункта
  const navLinks = nav.querySelectorAll("a[data-link]");
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      closeMenu();
    });
  });
 }
/*************************************************
 * toggleMenu функция открытия/закрытия меню
 *************************************************/
function toggleMenu() {
  //const burger = document.getElementById("burger");
  //const nav = document.getElementById("nav");
  burger.classList.toggle("active");
  nav.classList.toggle("open");
}
/*************************************************
 * closeMenu функция закрытия меню
 *************************************************/
function closeMenu() {
  document.getElementById("burger").classList.remove("active");
  document.getElementById("nav").classList.remove("open");
}

// function lngEdit(){
//   const iconId = accessToken ? '16x11' : '16x12';
//   console.log(accessToken);
//           document.getElementById("lng").innerHTML = `
//             <svg class="svg-icon" width="20" height="20">
//                 <use href="${spritePath}#${iconId}"></use>
//             </svg>
//         `;
// }
// window.lngEdit = lngEdit;
//PageReady.add(lngEdit);

// function lngEdit() {
//     const el = document.getElementById("lng");
//     if (!el) return;
//     const iconId = AuthStore.loggedIn ? '16x11' : '16x12';
//     el.innerHTML = `
//         <svg class="svg-icon" width="20" height="20">
//             <use href="${spritePath}#${iconId}"></use>
//         </svg>
//     `;
// }

// function lngEdit() {
//     const el = document.getElementById("lng");
//     if (!el) return;

//     console.log(auth.loggedIn);

//     const iconId = auth.loggedIn ? '16x11' : '16x12';

//     el.innerHTML = `
//         <svg class="svg-icon" width="20" height="20">
//             <use href="${spritePath}#${iconId}"></use>
//         </svg>
//     `;
// }

//document.addEventListener('auth:ready', lngEdit);
// подписка на событие
// document.addEventListener('authChange', (event) => {
//   console.log("event2:"+event.detail.loggedIn)
//     const el = document.getElementById("lng");
//     if (!el) return;
//     const iconId = event.detail.loggedIn ? '16x11' : '16x12';
//     el.innerHTML = `
//         <svg class="svg-icon" width="20" height="20">
//             <use href="${spritePath}#${iconId}"></use>
//         </svg>
//     `;
// });
const lng_btn = document.getElementById("lng_btn");
document.addEventListener('authChange', (event) => {
    //console.log("event2:" + event.detail.loggedIn);
    //const el = document.getElementById("lng_btn");
    if (!lng_btn) return;
    const iconId = event.detail.loggedIn ? '16x11' : '16x12';
//     lng_btn.setAttribute('loget', event.detail.loggedIn ? "true" : "false");
    lng_btn.dataset.loget = event.detail.loggedIn ? "true" : "false";
      lng_btn.innerHTML = `
        <svg class="svg-icon" width="20" height="20">
            <use href="${spritePath}#${iconId}"></use>
        </svg>
    `;
});

// После подписки сразу проверяем токен
initAuth();

/* ------------------- Кнопки ------------------- */
//

lng_btn.onclick = async () => {
  if (lng_btn.dataset.loget === "true") {
    await userLogout();   // вызываем существующую функцию
    await loadBlock("pages"+window.location.pathname, "content");
    //window.location.href = window.location.pathname; // перезагрузка текущей страницы
  } else {
    await loadBlock("pages/login", "content");
    //window.location.href = "/login"; // переход на страницу логина
  }
};