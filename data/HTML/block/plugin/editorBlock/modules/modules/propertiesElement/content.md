<div class="propertiesElementTabsMain">
    <div class="propertiesElementTabMain active" data-properties-tab="main">Основные</div>
    <div class="propertiesElementTabMain" data-properties-tab="grid">Сетка</div>
    <div class="propertiesElementTabMain" data-properties-tab="text">Текст</div>
    <div class="propertiesElementTabMain" data-properties-tab="advanced">Дополнительные</div>
    <div class="propertiesElementTabMain" data-properties-tab="special">Особенные</div>
</div>



<div class="propertiesElementTabContent active" data-properties-tab-content="main">

<!-- !!!Основные -->

<div class="propertiesElementTab">

<div data-target="all">ID: <input type="text" data-prop="id"></div>

<div data-target="all">Ширина: <input data-prop="widthValue"></div>
<div data-target="all">Высота: <input data-prop="heightValue"></div>

<div data-target="block">Режим отображения: <select data-prop="display">
    <option value="">По умолчанию</option>
    <option value="block">Блок</option>
    <option value="inline">В строке</option>
    <option value="inline-block">Блок в строке</option>
    <option value="flex">Гибкое расположение</option>
    <option value="grid">Сетка</option>
    <option value="none">Скрыть</option>
</select></div>

<div data-target="div main section article">Подключение блока: <input type="text" data-prop="data-block-src"></div>

</div>

</div>



<div class="propertiesElementTabContent" data-properties-tab-content="grid">

<!-- !!!Сетка -->

<!-- <div data-target="grid">Изменение колонок:
    <select data-prop="gridMode">
        <option value="fixed">Не изменять</option>
        <option value="adaptive">Подстраивать под ширину</option>
    </select>
</div>
<div data-target="grid">Количество строк: <input data-prop="gridRows"></div>
<div data-target="grid">Количество колонок: <input data-prop="gridColumns"></div>
<div data-target="grid">Ширина ячейки: <input data-prop="gridCellWidth"></div>
<div data-target="grid">Высота ячейки: <input data-prop="gridCellHeight"></div>
<div data-target="grid">Минимальная ширина ячейки: <input data-prop="gridMinCellWidth"></div>
<div data-target="grid">Отступ между колонками: <input data-prop="gridColumnGap"></div>
<div data-target="grid">Отступ между строками: <input data-prop="gridRowGap"></div>
<div data-target="grid">Заполнение строки:
    <select data-prop="gridFillMode">
        <option value="auto-fit">Растягивать ячейки</option>
        <option value="auto-fill">Сохранять свободные места</option>
    </select>
</div>
<div data-target="grid">Расположение элементов:
    <select data-prop="gridFlow">
        <option value="row">По строкам</option>
        <option value="column">По колонкам</option>
        <option value="dense">Заполнять свободные места</option>
    </select>
</div>
<div data-target="grid">Выравнивание по горизонтали:
    <select data-prop="gridAlignHorizontal">
        <option value="start">Слева</option>
        <option value="center">По центру</option>
        <option value="end">Справа</option>
        <option value="stretch">Растянуть</option>
    </select>
</div>
<div data-target="grid">Выравнивание по вертикали:
    <select data-prop="gridAlignVertical">
        <option value="start">Сверху</option>
        <option value="center">По центру</option>
        <option value="end">Снизу</option>
        <option value="stretch">Растянуть</option>
    </select>
</div>
<div data-target="grid-item">Ширина в колонках: <input data-prop="gridColumnSpan"></div>
<div data-target="grid-item">Высота в строках: <input data-prop="gridRowSpan"></div> -->

<!-- Диапазон экрана -->
<div class="breakpointSettings" data-target="grid flex">

<div>Диапазон экрана:
    <select data-prop="breakpoint">
        <option value="all">Все диапазоны</option>
        <option value="preset-mobile">Телефон 0-640</option>
        <option value="preset-tablet">Планшет 641-1024</option>
        <option value="preset-desktop">Компьютер 1025+</option>
    </select>
    <button type="button" data-action="addBreakpoint">+</button>
</div>

<div data-breakpoint-edit>Начало диапазона: <input data-prop="breakpointStart" type="number" min="0"></div>
<div data-breakpoint-edit>Конец диапазона: <input data-prop="breakpointEnd" type="number" min="0"></div>
<div data-breakpoint-edit>Название диапазона: <input data-prop="breakpointName" type="text"></div>

<div data-breakpoint-edit>
    <button type="button" data-action="duplicateBreakpoint">Дублировать</button>
    <button type="button" data-action="removeBreakpoint">Удалить</button>
</div>

<div>
    <span data-prop="breakpointStatus">Общие настройки</span>
    <button type="button" data-action="resetBreakpoint">Сбросить изменения</button>
</div>

<!-- Вкладки -->
<div class="propertiesElementTabs">
    <div class="propertiesElementTab active" data-tab="main">Базовые</div>
    <div class="propertiesElementTab" data-tab="advanced">Расширенные</div>
    <div class="propertiesElementTab" data-tab="selectedItem">Выбранный элемент</div>
</div>

<!-- Главная -->
<div class="tabContent active" data-tab-content="main">

<div data-target="grid flex">Тип макета:
    <select data-prop="layoutType">
        <option value="grid">Grid - сетка</option>
        <option value="flex">Flex - ряд или столбец</option>
    </select>
</div>

<div data-target="grid">Готовая раскладка:
    <select data-prop="gridPreset">
        <option value="cards">Карточки с автоколонками</option>
        <option value="twoColumns">Две равные колонки</option>
        <option value="mainSidebar">Основное + панель справа</option>
        <option value="sidebarMain">Панель слева + основное</option>
        <option value="page">Верх + содержимое + низ</option>
        <option value="dashboard">Панель</option>
    </select>
</div>

<div data-target="grid">Количество колонок: <input data-prop="gridColumns" type="number" min="1" max="12"></div>
<div data-target="grid">Количество строк: <input data-prop="gridRows" type="number" min="1" max="12"></div>
<div data-target="grid">Отступ между элементами: <input data-prop="gridGap" type="number" min="0"></div>

<div data-target="flex">Готовая раскладка:
    <select data-prop="flexPreset">
        <option value="row">В ряд</option>
        <option value="column">В столбец</option>
        <option value="between">По краям</option>
        <option value="center">По центру</option>
        <option value="evenly">Равные промежутки</option>
        <option value="wrap">С переносом</option>
    </select>
</div>

<div data-target="flex">Направление:
    <select data-prop="flexDirection">
        <option value="row">Слева направо</option>
        <option value="column">Сверху вниз</option>
        <option value="row-reverse">Справа налево</option>
        <option value="column-reverse">Снизу вверх</option>
    </select>
</div>

<div data-target="flex">Отступ между элементами: <input data-prop="flexGap" type="number" min="0"></div>
<div data-target="flex">Переносить элементы: <input data-prop="flexWrap" type="checkbox"></div>

<div data-target="flex">Расположение по направлению:
    <select data-prop="flexJustify">
        <option value="flex-start">В начале</option>
        <option value="center">По центру</option>
        <option value="flex-end">В конце</option>
        <option value="space-between">По краям</option>
        <option value="space-around">Равномерно</option>
        <option value="space-evenly">Одинаковые промежутки</option>
    </select>
</div>

<div data-target="flex">Выравнивание элементов:
    <select data-prop="flexAlign">
        <option value="stretch">Растянуть</option>
        <option value="flex-start">В начале</option>
        <option value="center">По центру</option>
        <option value="flex-end">В конце</option>
    </select>
</div>

</div>

<!-- Дополнительные -->
<div class="tabContent" data-tab-content="advanced">

<div data-target="grid">Подстраивать колонки под ширину: <input data-prop="gridAutoFit" type="checkbox"></div>
<div data-target="grid">Минимальная ширина колонки: <input data-prop="gridMinWidth" type="number" min="1"></div>
<div data-target="grid" style="display: none;">Обычная ширина колонки: <input data-prop="gridNormalWidth" type="number" min="1"></div>
<div data-target="grid">Максимальная ширина колонки: <input data-prop="gridMaxWidth" type="number" min="1"></div>

<div data-target="grid">Заполнение свободного места:
    <select data-prop="autoFitMode">
        <option value="auto-fit">Растягивать колонки</option>
        <option value="auto-fill">Сохранять места колонок</option>
    </select>
</div>

<div data-target="grid">Размеры колонок:
    <div data-prop="columnTracks"></div>
    <button type="button" data-action="addColumn">+ Добавить колонку</button>
</div>

<div data-target="grid">Размеры строк:
    <div data-prop="rowTracks"></div>
    <button type="button" data-action="addRow">+ Добавить строку</button>
</div>

<div data-target="grid">Отступ между колонками: <input data-prop="columnGap" type="number" min="0"></div>
<div data-target="grid">Отступ между строками: <input data-prop="rowGap" type="number" min="0"></div>
<div data-target="grid">Отступ от краёв: <input data-prop="gridPadding" type="number" min="0"></div>

<div data-target="grid">Как добавлять элементы:
    <select data-prop="autoFlow">
        <option value="row">Слева направо</option>
        <option value="column">Сверху вниз</option>
        <option value="row dense">Слева направо без пустот</option>
        <option value="column dense">Сверху вниз без пустот</option>
    </select>
</div>

<div data-target="flex">Расположение элементов:
    <select data-prop="flexAdvancedDirection">
        <option value="row">Слева направо</option>
        <option value="column">Сверху вниз</option>
        <option value="row-reverse">Справа налево</option>
        <option value="column-reverse">Снизу вверх</option>
    </select>
</div>

<div data-target="flex">Перенос элементов по строкам:
    <select data-prop="flexAdvancedWrap">
        <option value="nowrap">Не переносить</option>
        <option value="wrap">Переносить</option>
        <option value="wrap-reverse">Переносить в обратную сторону</option>
    </select>
</div>

<div data-target="flex">Отступ между элементами: <input data-prop="flexAdvancedGap" type="number" min="0"></div>

<div data-target="flex">Расположение строк:
    <select data-prop="flexAlignContent">
        <option value="stretch">Растянуть</option>
        <option value="flex-start">В начале</option>
        <option value="center">По центру</option>
        <option value="flex-end">В конце</option>
        <option value="space-between">По краям</option>
        <option value="space-around">Равномерно</option>
        <option value="space-evenly">Одинаковые промежутки</option>
    </select>
</div>

<div data-target="flex">Расположение элементов:
    <select data-prop="flexAdvancedJustify">
        <option value="flex-start">В начале</option>
        <option value="center">По центру</option>
        <option value="flex-end">В конце</option>
        <option value="space-between">По краям</option>
        <option value="space-around">Равномерно</option>
        <option value="space-evenly">Одинаковые промежутки</option>
    </select>
</div>

<div data-target="flex">Выравнивание элементов:
    <select data-prop="flexAdvancedAlign">
        <option value="stretch">Растянуть</option>
        <option value="flex-start">В начале</option>
        <option value="center">По центру</option>
        <option value="flex-end">В конце</option>
        <option value="baseline">По строке текста</option>
    </select>
</div>

<div data-target="grid flex">Автоматически менять отступ: <input data-prop="fluidGapEnabled" type="checkbox"></div>
<div data-target="grid flex">Минимальный отступ: <input data-prop="fluidGapMin" type="number" min="0"></div>
<div data-target="grid flex">Максимальный отступ: <input data-prop="fluidGapMax" type="number" min="0"></div>

</div>

<!-- Выбранный элемент -->
<div class="tabContent" data-tab-content="selectedItem">

<div data-target="grid-item flex-item">Минимальная ширина: <input data-prop="itemMinWidth" type="number" min="0"></div>
<div data-target="grid-item flex-item">Максимальная ширина: <input data-prop="itemMaxWidth" type="number" min="0"></div>
<div data-target="grid-item flex-item">Минимальная высота: <input data-prop="itemMinHeight" type="number" min="0"></div>
<div data-target="grid-item flex-item">Максимальная высота: <input data-prop="itemMaxHeight" type="number" min="0"></div>
<div data-target="grid-item flex-item">Скрыть элемент: <input data-prop="itemHidden" type="checkbox"></div>

<div data-target="grid-item">Занять колонок: <input data-prop="gridColumnSpan" type="number" min="1"></div>
<div data-target="grid-item">Занять строк: <input data-prop="gridRowSpan" type="number" min="1"></div>

<div data-target="grid-item">Начать с колонки:
    <select data-prop="gridItemColumn">
        <option value="auto">Автоматически</option>
    </select>
</div>

<div data-target="grid-item">Начать со строки:
    <select data-prop="gridItemRow">
        <option value="auto">Автоматически</option>
    </select>
</div>

<div data-target="grid-item">Колонки: <input data-prop="gridItemColumns" type="number" min="1"></div>
<div data-target="grid-item">Строки: <input data-prop="gridItemRows" type="number" min="1"></div>

<div data-target="flex-item">Размер:
    <select data-prop="flexItemSize">
        <option value="auto">По содержимому</option>
        <option value="fill">Занять свободное место</option>
        <option value="fixed">Заданный размер</option>
        <option value="equal">Равная доля</option>
    </select>
</div>

<div data-target="flex-item">Базовый размер: <input data-prop="flexBasis" type="number" min="0"></div>
<div data-target="flex-item">Насколько увеличивать: <input data-prop="flexGrow" type="number" min="0"></div>
<div data-target="flex-item">Насколько уменьшать: <input data-prop="flexShrink" type="number" min="0"></div>

<div data-target="flex-item">Выравнивание элемента:
    <select data-prop="flexSelf">
        <option value="auto">Автоматически</option>
        <option value="stretch">Растянуть</option>
        <option value="flex-start">В начале</option>
        <option value="center">По центру</option>
        <option value="flex-end">В конце</option>
    </select>
</div>

<div data-target="flex-item">Позиция элемента: <input data-prop="flexOrder" type="number"></div>

<div data-target="grid-item flex-item">Соотношение сторон:
    <select data-prop="itemAspectRatio">
        <option value="">Авто</option>
        <option value="1 / 1">1:1</option>
        <option value="4 / 3">4:3</option>
        <option value="16 / 9">16:9</option>
    </select>
</div>

<div data-target="grid-item flex-item">Если содержимое не помещается:
    <select data-prop="itemOverflow">
        <option value="">По умолчанию</option>
        <option value="visible">Показывать</option>
        <option value="hidden">Скрыть</option>
        <option value="auto">Прокрутка</option>
    </select>
</div>

<div data-target="grid-item flex-item">Перенос текста:
    <select data-prop="textWrapMode">
        <option value="">По умолчанию</option>
        <option value="anywhere">Разрывать слова</option>
        <option value="nowrap">Не переносить</option>
    </select>
</div>

<div data-target="grid-item flex-item">Если текст не помещается:
    <select data-prop="textOverflowMode">
        <option value="">По умолчанию</option>
        <option value="ellipsis">Многоточие</option>
        <option value="hidden">Скрыть</option>
        <option value="auto">Прокрутка</option>
    </select>
</div>

<div data-target="grid-item flex-item">Максимальное количество строк: <input data-prop="textLineClamp" type="number" min="0"></div>

<div data-target="grid-item flex-item">Путь к файлу: <input data-prop="mediaSrc" type="text"></div>

<div data-target="grid-item flex-item">Отображение файла:
    <select data-prop="mediaFit">
        <option value="">Авто</option>
        <option value="cover">Заполнить с обрезкой</option>
        <option value="contain">Показать целиком</option>
        <option value="fill">Растянуть</option>
        <option value="none">Исходный размер</option>
    </select>
</div>

<div data-target="grid-item flex-item">Менять при уменьшении родителя: <input data-prop="containerRuleEnabled" type="checkbox"></div>
<div data-target="grid-item flex-item">Ширина родителя меньше: <input data-prop="containerRuleWidth" type="number" min="1"></div>
<div data-target="grid-item flex-item">Изменение:
    <select data-prop="containerRuleAction">
        <option value="column">Расположить вертикально</option>
        <option value="wrap">Переносить элементы</option>
        <option value="hide">Скрыть элемент</option>
    </select>
</div>

<div data-target="grid-item flex-item">
    Шаблоны:
    <div data-prop="variantList"></div>
    <button type="button" data-action="addVariant">+ Сохранить шаблон</button>
</div>

</div>

</div>

</div>



<div class="propertiesElementTabContent" data-properties-tab-content="advanced">

<!-- !!!Дополнительные -->

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
        <div>Стиль: <select data-prop="borderStyle">
            <option value="">По умолчанию</option>
            <option value="solid">Сплошная</option>
            <option value="dashed">Пунктирная</option>
            <option value="dotted">Точечная</option>
            <option value="double">Двойная</option>
        </select></div>
    </div>
</div>
<div data-target="all">Скругление углов: <input data-prop="borderRadius"></div>

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
<div data-target="all">Вид курсора: <select data-prop="cursor">
    <option value="">По умолчанию</option>
    <option value="pointer">Указатель</option>
    <option value="text">Текст</option>
    <option value="wait">Ожидание</option>
    <option value="not-allowed">Запрещено</option>
    <option value="help">Помощь</option>
</select>

</div>

</div>



<div class="propertiesElementTabContent" data-properties-tab-content="special">

<!-- !!!Особенные -->

<div data-target="input">Текст подсказки: <input type="text" data-prop="inputPlaceholder"></div>
<div data-target="input">Тип поля: <select data-prop="inputType">
    <option value="text">Текст</option>
    <option value="email">Почта</option>
    <option value="password">Пароль</option>
    <option value="number">Число</option>
</select></div>
<div data-target="button">Тип кнопки: <select data-prop="buttonType">
    <option value="">По умолчанию</option>
    <option value="button">Обычная кнопка</option>
    <option value="submit">Отправить форму</option>
    <option value="reset">Сбросить форму</option>
</select></div>
<div data-target="textarea">Изменение размера: <select data-prop="resize">
    <option value="">По умолчанию</option>
    <option value="none">Запретить</option>
    <option value="both">Обе стороны</option>
    <option value="horizontal">По горизонтали</option>
    <option value="vertical">По вертикали</option>
</select></div>

<div data-target="form">Метод отправки формы: <select data-prop="formMethod">
    <option value="">По умолчанию</option>
    <option value="get">GET</option>
    <option value="post">POST</option>
</select></div>
<div data-target="form">Адрес отправки формы: <input type="text" data-prop="formAction"></div>

<div data-target="table">Количество строк: <input type="number" min="1" step="1" data-prop="tableRows" value="1"></div>
<div data-target="table">Количество столбцов: <input type="number" min="1" step="1" data-prop="tableCols" value="1"></div>

<div data-target="video">Заставка: <input type="text" data-prop="videoPoster"></div>
<div data-target="details">Открывать автоматически: <input type="checkbox" data-prop="detailsOpen"></div>

<div data-target="input:file">Допустимые типы файлов: <input type="text" data-prop="fileAccept"></div>
<div data-target="input:file">Разрешить несколько файлов: <input type="checkbox" data-prop="fileMultiple"></div>
<div data-target="input:range">Минимальное значение: <input type="number" step="any" data-prop="rangeMin"></div>
<div data-target="input:range">Максимальное значение: <input type="number" step="any" data-prop="rangeMax"></div>
<div data-target="input:range">Текущее значение: <input type="number" step="any" data-prop="rangeValue"></div>
<div data-target="progress">Текущее значение: <input type="number" step="any" data-prop="progressValue"></div>

</div>

</div>

</div>