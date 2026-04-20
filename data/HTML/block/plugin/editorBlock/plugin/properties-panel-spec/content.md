<div class="table-title" style="padding-bottom: 5px;">Свойства элементов</div>
<label data-target="all">ID: <input type="text" data-prop="id"><br></label>
<label data-target="img a figure video audio iframe">Ссылка: <input type="text" data-prop="link"></label>
<label data-target="input textarea select">Подсказка: <input type="text" data-prop="input-placeholder"></label>
<label data-target="input textarea select">Тип: <select data-prop="input-type">
    <option value="text">текст</option>
    <option value="email">почта</option>
    <option value="password">пороль</option>
    <option value="number">число</option>
</select></label>
<label data-target="table">Строки: <input type="number" min="1" step="1" data-prop="table-rows" value="1"></label>
<label data-target="table">Столбцы: <input type="number" min="1" step="1" data-prop="table-cols" value="1"></label>
<label data-target="form">Метод формы: <select data-prop="form-method">
    <option value="">По умолчанию</option>
    <option value="get">get</option>
    <option value="post">post</option>
</select></label>
<label data-target="form">Действие формы: <input type="text" data-prop="form-action"></label>
<label data-target="video">Заставка" <input type="text" data-prop="video-poster"></label>
<label data-target="button">Тип действия: <select data-prop="button-type">
    <option value="">По умолчанию</option>
    <option value="button">button</option>
    <option value="submit">submit</option>
    <option value="reset">reset</option>
</select></label>
<label data-target="details">Открыть по умолчанию: <input type="checkbox" data-prop="details-open"></label>
<label data-target="input:range">Мин значение: <input type="number" step="any" data-prop="range-min"></label>
<label data-target="input:range">Макс значение: <input type="number" step="any" data-prop="range-max"></label>
<label data-target="input:range">Текущее значение: <input type="number" step="any" data-prop="range-value"></label>
<label data-target="progress">Текущее значение: <input type="number" step="any" data-prop="progress-value"></label>
<label data-target="input:file">Допустимые типы: <input type="text" data-prop="file-accept"></label>
<label data-target="input:file">Несколько файлов: <input type="checkbox" data-prop="file-multiple"></label>
<label data-target="all">Ширина: <input data-prop="width-value"></label>
<label data-target="all">Высота: <br><input data-prop="height-value"></label>
<label data-target="all">Внешние отступы: <div class="margin-grid">
    <div class="col left"><input data-prop="margin-left" placeholder="Слева"></div>
    <div class="col center"><input data-prop="margin-top" placeholder="Сверху"><input data-prop="margin-bottom" placeholder="Снизу"></div>
    <div class="col right"><input data-prop="margin-right" placeholder="Справа"></div>
</div></label>
<label data-target="all">Отступы от границ: <div class="padding-grid">
    <div class="col left"><input data-prop="padding-left" placeholder="Слева"></div>
    <div class="col center"><input data-prop="padding-top" placeholder="Сверху"><input data-prop="padding-bottom" placeholder="Снизу"></div>
    <div class="col right"><input data-prop="padding-right" placeholder="Справа"></div>
</div></label>
<label data-target="all">Фон: <input type="color" data-prop="background-color"><br></label>
<label data-target="all">Курсор: <select data-prop="cursor">
    <option value="">По умолчанию</option>
    <option value="pointer">Указатель</option>
    <option value="text">Текст</option>
    <option value="wait">Ожидание</option>
    <option value="not-allowed">Запрещено</option>
    <option value="help">Помощь</option>
</select></label>
<label data-target="text link input textarea select button code">Цвет текста: <input type="color" data-prop="color"><br></label>
<label data-target="text link input textarea select button code">Размер шрифта: <input data-prop="font-size"></label>
<label data-target="text link input textarea select button code">Выравнивание текста: <select data-prop="text-align">
    <option value="">По умолчанию</option>
    <option value="left">Слева</option>
    <option value="center">По центру</option>
    <option value="right">Справа</option>
</select></label>
<label data-target="all">Прозрачность: <input data-prop="opacity"></label>
<label data-target="all">Граница: <input type="color" data-prop="border-color">
    <select data-prop="border-width">
        <option value="">По умолчанию</option>
        <option value="1">1</option>
        <option value="2">2</option>
        <option value="3">3</option>
        <option value="4">4</option>
        <option value="5">5</option>
        <option value="6">6</option>
        <option value="7">7</option>
        <option value="8">8</option>
        <option value="9">9</option>
        <option value="10">10</option>
    </select>
    <select data-prop="border-style">
        <option value="">По умолчанию</option>
        <option value="solid">сплошной</option>
        <option value="dashed">пунктирный</option>
        <option value="dotted">точечный</option>
        <option value="double">двойной</option>
    </select>
</label>
<label data-target="all">Радиус скругления: <input data-prop="border-radius"></label>
<label data-target="block">Отображение элемента: <select data-prop="display">
    <option value="">По умолчанию</option>
    <option value="block">Блочный</option>
    <option value="inline">Строчный</option>
    <option value="inline-block">Инлайн блок</option>
    <option value="flex">Flex</option>
    <option value="none">Не отображать</option>
</select></label>
<label data-target="input textarea select">Изменение размера: <select data-prop="resize">
    <option value="">По умолчанию</option>
    <option value="none">Запретить изменение размера</option>
    <option value="both">Обе стороны</option>
    <option value="horizontal">По горизонтали</option>
    <option value="vertical">По вертикали</option>
    <option value="auto">Авто</option>
</select></label>
<hr style="margin: 6px 0px;">
<label>
    Показать CSS
    <input type="checkbox" id="toggle-css-panel" style="width: auto;">
</label>
<div id="css-panel" style="display: none">
    <div id="tag-label">TAG</div>
    <div class="table-wrap">
        <div class="table-title">Атрибуты</div>
        <table id="attributes-table"><tr><td contenteditable="true" data-placeholder="name"></td><td contenteditable="true" data-placeholder="value"></td></tr></table>
    </div>
    <div class="table-wrap">
        <div class="table-title">Свойства</div>
        <table id="properties-table"><tr><td contenteditable="true" data-placeholder="property"></td><td contenteditable="true" data-placeholder="value"></td></tr></table>
    </div>
</div>