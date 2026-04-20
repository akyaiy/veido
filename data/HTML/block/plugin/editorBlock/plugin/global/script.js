/* авто создание иконок */
document.querySelectorAll('svg[use]').forEach(svg => {
    const id = svg.getAttribute('use');
    const color = svg.getAttribute('use-color');
    const background = svg.getAttribute('use-background');

    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', './static/img/icons.svg#' + id);

    if (color) svg.style.color = color;
    else svg.style.color = "#000000";
    if (background) svg.style.background = background;
    else svg.style.background = "";

    svg.appendChild(use);
});