/*************************************************************************
 * pageInit функция автозапуска скриптов, после подгрузки на страницу    *
 *************************************************************************/
function pageInit() {
 const burger = document.getElementById("burger");
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
  const burger = document.getElementById("burger");
  const nav = document.getElementById("nav");
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

