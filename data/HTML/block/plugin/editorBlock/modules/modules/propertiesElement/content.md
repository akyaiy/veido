<!-- Свойства -->

<div class="propertiesTabsHeader">
    <div type="button" class="propertiesTabBtn active" data-tab="propertiesMain">Основные</div>
    <div type="button" class="propertiesTabBtn" data-tab="propertiesStyles">Стили</div>
    <div type="button" class="propertiesTabBtn" data-tab="propertiesSpecial">Специальные</div>
</div>



<div class="propertiesTabContent active" id="propertiesMain">

<div data-target="all">ID: <input type="text" data-prop="id"></div>

<div data-target="all">Ширина: <input data-prop="widthValue"></div>
<div data-target="all">Высота: <input data-prop="heightValue"></div>

<div data-target="block">Отображение элемента: <select data-prop="display">
    <option value="">По умолчанию</option>
    <option value="block">Блок</option>
    <option value="inline">В строке</option>
    <option value="inline-block">Блок в строке</option>
    <option value="flex">Гибкое расположение</option>
    <option value="grid">Сетка</option>
    <option value="none">Скрыть</option>
</select></div>

<div data-target="grid">Направление Grid: <select data-prop="gridDirection">
    <option value="grid-template-columns">Колонки</option>
    <option value="grid-template-rows">Строки</option>
</select></div>
<div data-target="grid">Количество Grid: <input data-prop="gridTemplateCount" placeholder="Количество"></div>
<div data-target="grid">Размер Grid: <input data-prop="gridTemplateSize" placeholder="Размер"></div>
<div data-target="grid-item">Размер по колонкам: <input data-prop="gridColumn"></div>
<div data-target="grid-item">Размер по строкам: <input data-prop="gridRow"></div>

<div data-target="div main section article">Подключение блока: <input type="text" data-prop="data-block-src"></div>

</div>



<div class="propertiesTabContent" id="propertiesStyles">

<div data-target="all">Внешние отступы: <div class="marginGrid">
    <div class="col left"><input data-prop="marginLeft" placeholder="Слева"></div>
    <div class="col center"><input data-prop="marginTop" placeholder="Сверху"><input data-prop="marginBottom" placeholder="Снизу"></div>
    <div class="col right"><input data-prop="marginRight" placeholder="Справа"></div>
</div></div>
<div data-target="all">Внутренние отступы: <div class="paddingGrid">
    <div class="col left"><input data-prop="paddingLeft" placeholder="Слева"></div>
    <div class="col center"><input data-prop="paddingTop" placeholder="Сверху"><input data-prop="paddingBottom" placeholder="Снизу"></div>
    <div class="col right"><input data-prop="paddingRight" placeholder="Справа"></div>
</div></div>

<div data-target="all">Фон: <input type="color" data-prop="backgroundColor"></div>
<div data-target="all">Рамка: 
    <div class="borderSettings">
        <div>Цвет: <input type="color" data-prop="borderColor"></div>
        <div>Ширина: <input data-prop="borderWidth"></div>
        <div>Тип: <select data-prop="borderStyle">
            <option value="">По умолчанию</option>
            <option value="solid">сплошной</option>
            <option value="dashed">пунктирный</option>
            <option value="dotted">точечный</option>
            <option value="double">двойной</option>
        </select></div>
    </div>
</div>
<div data-target="all">Радиус скругления: <input data-prop="borderRadius"></div>


<!-- <div data-target="text link input textarea select button code">Размер шрифта: <input data-prop="fontSize"></div>
<div data-target="text link input textarea select button code">Цвет текста: <input type="color" data-prop="color"></div>
<div data-target="text link input textarea select button code">Выравнивание текста: <select data-prop="textAlign">
    <option value="">По умолчанию</option>
    <option value="left">Слева</option>
    <option value="center">По центру</option>
    <option value="right">Справа</option>
</select></div> -->

<div data-target="img a figure video audio iframe">Ссылка: <input type="text" data-prop="link"></div>
<div data-target="all">Прозрачность: <input data-prop="opacity"></div>
<div data-target="all">Курсор: <select data-prop="cursor">
    <option value="">По умолчанию</option>
    <option value="pointer">Указатель</option>
    <option value="text">Текст</option>
    <option value="wait">Ожидание</option>
    <option value="not-allowed">Запрещено</option>
    <option value="help">Помощь</option>
</select>

</div>
</div>



<div class="propertiesTabContent" id="propertiesSpecial">

<div data-target="input">Подсказка: <input type="text" data-prop="inputPlaceholder"></div>
<div data-target="input">Тип: <select data-prop="inputType">
    <option value="text">текст</option>
    <option value="email">почта</option>
    <option value="password">пароль</option>
    <option value="number">число</option>
</select></div>
<div data-target="button">Тип: <select data-prop="buttonType">
    <option value="">По умолчанию</option>
    <option value="button">button</option>
    <option value="submit">submit</option>
    <option value="reset">reset</option>
</select></div>
<div data-target="textarea">Изменение размера: <select data-prop="resize">
    <option value="">По умолчанию</option>
    <option value="none">Запретить</option>
    <option value="both">Обе стороны</option>
    <option value="horizontal">По горизонтали</option>
    <option value="vertical">По вертикали</option>
</select></div>

<div data-target="form">Метод формы: <select data-prop="formMethod">
    <option value="">По умолчанию</option>
    <option value="get">get</option>
    <option value="post">post</option>
</select></div>
<div data-target="form">Действие формы: <input type="text" data-prop="formAction"></div>

<div data-target="table">Строки: <input type="number" min="1" step="1" data-prop="tableRows" value="1"></div>
<div data-target="table">Столбцы: <input type="number" min="1" step="1" data-prop="tableCols" value="1"></div>

<div data-target="video">Заставка: <input type="text" data-prop="videoPoster"></div>
<div data-target="details">Открыть по умолчанию: <input type="checkbox" data-prop="detailsOpen"></div>

<div data-target="input:file">Допустимые типы: <input type="text" data-prop="fileAccept"></div>
<div data-target="input:file">Несколько файлов: <input type="checkbox" data-prop="fileMultiple"></div>
<div data-target="input:range">Мин значение: <input type="number" step="any" data-prop="rangeMin"></div>
<div data-target="input:range">Макс значение: <input type="number" step="any" data-prop="rangeMax"></div>
<div data-target="input:range">Текущее значение: <input type="number" step="any" data-prop="rangeValue"></div>
<div data-target="progress">Текущее значение: <input type="number" step="any" data-prop="progressValue"></div>

</div>