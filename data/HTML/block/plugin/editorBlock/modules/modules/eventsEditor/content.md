<!-- Заголовок -->
<div>События и функции</div>

<!-- Выбор селектора -->
<div id="selectorPanel">
    <select id="selectorType">
        <option value="id">id</option>
        <option value="class">class</option>
    </select>
    <input id="selectorName" type="text">
    <select id="selectorClass" style="display: none;"></select>
</div>

<!-- Таблица событий -->
<table id="eventsPanel">
    <tr>
        <td><input placeholder="event"></td>
        <td><input placeholder="function"></td>
    </tr>
</table>

<!-- Панель автодополнения JavaScript -->
<div id="jsAutocompleteBox"></div>