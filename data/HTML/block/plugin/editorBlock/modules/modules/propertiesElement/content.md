<div id="propertiesSelectorPanel">
    <select id="propertiesSelectorType">
        <option value="element">#{Selected element}</option>
        <option value="id">ID</option>
        <option value="class">#{Group}</option>
    </select>
    <input id="propertiesSelectorName" type="text" placeholder="#{Name}" style="display: none;">
    <select id="propertiesSelectorExisting" style="display: none;"></select>
</div>

<div class="propertiesElementTabsMain">
    <div class="propertiesElementTabMain active" data-properties-tab="main">#{Main}</div>
    <div class="propertiesElementTabMain" data-properties-tab="grid">#{Grid}</div>
    <div class="propertiesElementTabMain" data-properties-tab="text">#{Text}</div>
    <div class="propertiesElementTabMain" data-properties-tab="advanced">#{Advanced}</div>
    <div class="propertiesElementTabMain" data-properties-tab="special">#{Special}</div>
</div>



<div class="propertiesElementTabContent active" data-properties-tab-content="main">

<!-- !!!Основные -->

<div class="propertiesElementTab">

<div data-target="all">ID: <input type="text" data-prop="id"></div>

<div data-target="all">#{Width}: <input data-prop="widthValue"></div>
<div data-target="all">#{Height}: <input data-prop="heightValue"></div>

<div data-target="block">#{Display mode}: <select data-prop="display">
    <option value="">#{Default}</option>
    <option value="block">#{Block}</option>
    <option value="inline">#{Inline}</option>
    <option value="inline-block">#{Inline block}</option>
    <option value="flex">#{Flex layout}</option>
    <option value="grid">#{Grid}</option>
    <option value="none">#{Hide}</option>
</select></div>

<div data-target="div main section article">#{Block source}: <input type="text" data-prop="data-block-src"></div>

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

<div>#{Screen range}:
    <select data-prop="breakpointSelect">
        <option value="all" selected>#{All ranges}</option>
        <option value="preset-mobile">#{Mobile 0-640}</option>
        <option value="preset-tablet">#{Tablet 641-1024}</option>
        <option value="preset-desktop">#{Desktop 1025+}</option>
    </select>
    <button type="button" data-action="addBreakpoint">+</button>
</div>

<div data-breakpoint-edit>#{Range start}: <input data-prop="breakpointStart" type="number" min="0"></div>
<div data-breakpoint-edit>#{Range end}: <input data-prop="breakpointEnd" type="number" min="0"></div>
<div data-breakpoint-edit>#{Range name}: <input data-prop="breakpointName" type="text"></div>

<div data-breakpoint-edit>
    <button type="button" data-action="duplicateBreakpoint">#{Duplicate}</button>
    <button type="button" data-action="removeBreakpoint">#{Delete}</button>
</div>

<div>
    <span data-prop="breakpointStatus">#{Shared settings}</span>
    <button type="button" data-action="resetBreakpoint">#{Reset changes}</button>
</div>

</div>

<!-- Вкладки -->
<div class="propertiesElementTabs">
    <div class="propertiesElementTab active" data-tab="main">#{Basic}</div>
    <div class="propertiesElementTab" data-tab="advanced">#{Advanced}</div>
    <div class="propertiesElementTab" data-tab="selectedItem">#{Selected element}</div>
</div>

<!-- Главная -->
<div class="tabContent active" data-tab-content="main">

<div data-target="grid flex">#{Layout type}:
    <select data-prop="layoutType">
        <option value="grid">#{Grid layout}</option>
        <option value="flex">#{Flex row or column}</option>
    </select>
</div>

<div data-target="grid">#{Preset layout}:
    <select data-prop="gridPreset">
        <option value="cards">#{Cards with auto columns}</option>
        <option value="twoColumns">#{Two equal columns}</option>
        <option value="mainSidebar">#{Main content + right sidebar}</option>
        <option value="sidebarMain">#{Left sidebar + main content}</option>
        <option value="page">#{Header + content + footer}</option>
        <option value="dashboard">#{Dashboard}</option>
    </select>
</div>

<div data-target="grid">#{Number of columns}: <input data-prop="gridColumns" type="number" min="1" max="12"></div>
<div data-target="grid">#{Number of rows}: <input data-prop="gridRows" type="number" min="1" max="12"></div>
<div data-target="grid">#{Gap between items}: <input data-prop="gridGap" type="number" min="0"></div>

<div data-target="flex">#{Preset layout}:
    <select data-prop="flexPreset">
        <option value="row">#{Row}</option>
        <option value="column">#{Column}</option>
        <option value="between">#{Space between}</option>
        <option value="center">#{Center}</option>
        <option value="evenly">#{Even spacing}</option>
        <option value="wrap">#{Wrap}</option>
    </select>
</div>

<div data-target="flex">#{Direction}:
    <select data-prop="flexDirection">
        <option value="row">#{Left to right}</option>
        <option value="column">#{Top to bottom}</option>
        <option value="row-reverse">#{Right to left}</option>
        <option value="column-reverse">#{Bottom to top}</option>
    </select>
</div>

<div data-target="flex">#{Gap between items}: <input data-prop="flexGap" type="number" min="0"></div>
<div data-target="flex">#{Wrap items}: <input data-prop="flexWrap" type="checkbox"></div>

<div data-target="flex">#{Justify content}:
    <select data-prop="flexJustify">
        <option value="flex-start">#{Start}</option>
        <option value="center">#{Center}</option>
        <option value="flex-end">#{End}</option>
        <option value="space-between">#{Space between}</option>
        <option value="space-around">#{Space around}</option>
        <option value="space-evenly">#{Even spacing}</option>
    </select>
</div>

<div data-target="flex">#{Align items}:
    <select data-prop="flexAlign">
        <option value="stretch">#{Stretch}</option>
        <option value="flex-start">#{Start}</option>
        <option value="center">#{Center}</option>
        <option value="flex-end">#{End}</option>
    </select>
</div>

</div>

<!-- Дополнительные -->
<div class="tabContent" data-tab-content="advanced">

<div data-target="grid">#{Fit columns to width}: <input data-prop="gridAutoFit" type="checkbox"></div>
<div data-target="grid">#{Minimum column width}: <input data-prop="gridMinWidth" type="number" min="1"></div>
<div data-target="grid" style="display: none;">#{Default column width}: <input data-prop="gridNormalWidth" type="number" min="1"></div>
<div data-target="grid">#{Maximum column width}: <input data-prop="gridMaxWidth" type="number" min="1"></div>

<div data-target="grid">#{Fill available space}:
    <select data-prop="autoFitMode">
        <option value="auto-fit">#{Stretch columns}</option>
        <option value="auto-fill">#{Preserve column spaces}</option>
    </select>
</div>

<div data-target="grid">#{Column sizes}:
    <div data-prop="columnTracks"></div>
    <button type="button" data-action="addColumn">+ #{Add column}</button>
</div>

<div data-target="grid">#{Row sizes}:
    <div data-prop="rowTracks"></div>
    <button type="button" data-action="addRow">+ #{Add row}</button>
</div>

<div data-target="grid">#{Column gap}: <input data-prop="columnGap" type="number" min="0"></div>
<div data-target="grid">#{Row gap}: <input data-prop="rowGap" type="number" min="0"></div>
<div data-target="grid">#{Padding}: <input data-prop="gridPadding" type="number" min="0"></div>

<div data-target="grid">#{Auto-placement direction}:
    <select data-prop="autoFlow">
        <option value="row">#{Left to right}</option>
        <option value="column">#{Top to bottom}</option>
        <option value="row dense">#{Left to right, filling gaps}</option>
        <option value="column dense">#{Top to bottom, filling gaps}</option>
    </select>
</div>

<div data-target="flex">#{Item direction}:
    <select data-prop="flexAdvancedDirection">
        <option value="row">#{Left to right}</option>
        <option value="column">#{Top to bottom}</option>
        <option value="row-reverse">#{Right to left}</option>
        <option value="column-reverse">#{Bottom to top}</option>
    </select>
</div>

<div data-target="flex">#{Wrap items across rows}:
    <select data-prop="flexAdvancedWrap">
        <option value="nowrap">#{No wrap}</option>
        <option value="wrap">#{Wrap}</option>
        <option value="wrap-reverse">#{Wrap in reverse order}</option>
    </select>
</div>

<div data-target="flex">#{Gap between items}: <input data-prop="flexAdvancedGap" type="number" min="0"></div>

<div data-target="flex">#{Align content}:
    <select data-prop="flexAlignContent">
        <option value="stretch">#{Stretch}</option>
        <option value="flex-start">#{Start}</option>
        <option value="center">#{Center}</option>
        <option value="flex-end">#{End}</option>
        <option value="space-between">#{Space between}</option>
        <option value="space-around">#{Space around}</option>
        <option value="space-evenly">#{Even spacing}</option>
    </select>
</div>

<div data-target="flex">#{Justify content}:
    <select data-prop="flexAdvancedJustify">
        <option value="flex-start">#{Start}</option>
        <option value="center">#{Center}</option>
        <option value="flex-end">#{End}</option>
        <option value="space-between">#{Space between}</option>
        <option value="space-around">#{Space around}</option>
        <option value="space-evenly">#{Even spacing}</option>
    </select>
</div>

<div data-target="flex">#{Align items}:
    <select data-prop="flexAdvancedAlign">
        <option value="stretch">#{Stretch}</option>
        <option value="flex-start">#{Start}</option>
        <option value="center">#{Center}</option>
        <option value="flex-end">#{End}</option>
        <option value="baseline">#{Text baseline}</option>
    </select>
</div>

<div data-target="grid flex">#{Adjust gap automatically}: <input data-prop="fluidGapEnabled" type="checkbox"></div>
<div data-target="grid flex">#{Minimum gap}: <input data-prop="fluidGapMin" type="number" min="0"></div>
<div data-target="grid flex">#{Maximum gap}: <input data-prop="fluidGapMax" type="number" min="0"></div>

</div>

<!-- Выбранный элемент -->
<div class="tabContent" data-tab-content="selectedItem">

<div data-target="grid-item flex-item">#{Minimum width}: <input data-prop="itemMinWidth" type="number" min="0"></div>
<div data-target="grid-item flex-item">#{Maximum width}: <input data-prop="itemMaxWidth" type="number" min="0"></div>
<div data-target="grid-item flex-item">#{Minimum height}: <input data-prop="itemMinHeight" type="number" min="0"></div>
<div data-target="grid-item flex-item">#{Maximum height}: <input data-prop="itemMaxHeight" type="number" min="0"></div>
<div data-target="grid-item flex-item">#{Hide element}: <input data-prop="itemHidden" type="checkbox"></div>

<div data-target="grid-item">#{Columns to span}: <input data-prop="gridColumnSpan" type="number" min="1"></div>
<div data-target="grid-item">#{Rows to span}: <input data-prop="gridRowSpan" type="number" min="1"></div>

<div data-target="grid-item">#{Start at column}:
    <select data-prop="gridItemColumn">
        <option value="auto">#{Auto}</option>
    </select>
</div>

<div data-target="grid-item">#{Start at row}:
    <select data-prop="gridItemRow">
        <option value="auto">#{Auto}</option>
    </select>
</div>

<div data-target="grid-item">#{Columns}: <input data-prop="gridItemColumns" type="number" min="1"></div>
<div data-target="grid-item">#{Rows}: <input data-prop="gridItemRows" type="number" min="1"></div>

<div data-target="flex-item">#{Size}:
    <select data-prop="flexItemSize">
        <option value="auto">#{Fit content}</option>
        <option value="fill">#{Fill available space}</option>
        <option value="fixed">#{Fixed size}</option>
        <option value="equal">#{Equal share}</option>
    </select>
</div>

<div data-target="flex-item">#{Base size}: <input data-prop="flexBasis" type="number" min="0"></div>
<div data-target="flex-item">#{Grow factor}: <input data-prop="flexGrow" type="number" min="0"></div>
<div data-target="flex-item">#{Shrink factor}: <input data-prop="flexShrink" type="number" min="0"></div>

<div data-target="flex-item">#{Align self}:
    <select data-prop="flexSelf">
        <option value="auto">#{Auto}</option>
        <option value="stretch">#{Stretch}</option>
        <option value="flex-start">#{Start}</option>
        <option value="center">#{Center}</option>
        <option value="flex-end">#{End}</option>
    </select>
</div>

<div data-target="flex-item">#{Item order}: <input data-prop="flexOrder" type="number"></div>

<div data-target="grid-item flex-item">#{Aspect ratio}:
    <select data-prop="itemAspectRatio">
        <option value="">#{Auto}</option>
        <option value="1 / 1">1:1</option>
        <option value="4 / 3">4:3</option>
        <option value="16 / 9">16:9</option>
    </select>
</div>

<div data-target="grid-item flex-item">#{If content overflows}:
    <select data-prop="itemOverflow">
        <option value="">#{Default}</option>
        <option value="visible">#{Show}</option>
        <option value="hidden">#{Hide}</option>
        <option value="auto">#{Scroll}</option>
    </select>
</div>

<div data-target="grid-item flex-item">#{Text wrapping}:
    <select data-prop="textWrapMode">
        <option value="">#{Default}</option>
        <option value="anywhere">#{Break words}</option>
        <option value="nowrap">#{No wrap}</option>
    </select>
</div>

<div data-target="grid-item flex-item">#{If text overflows}:
    <select data-prop="textOverflowMode">
        <option value="">#{Default}</option>
        <option value="ellipsis">#{Ellipsis}</option>
        <option value="hidden">#{Hide}</option>
        <option value="auto">#{Scroll}</option>
    </select>
</div>

<div data-target="grid-item flex-item">#{Maximum number of lines}: <input data-prop="textLineClamp" type="number" min="0"></div>

<div data-target="grid-item flex-item">#{File path}: <input data-prop="mediaSrc" type="text"></div>

<div data-target="grid-item flex-item">#{File display}:
    <select data-prop="mediaFit">
        <option value="">#{Auto}</option>
        <option value="cover">#{Cover and crop}</option>
        <option value="contain">#{Contain}</option>
        <option value="fill">#{Stretch}</option>
        <option value="none">#{Original size}</option>
    </select>
</div>

<div data-target="grid-item flex-item">#{Adjust when parent shrinks}: <input data-prop="containerRuleEnabled" type="checkbox"></div>
<div data-target="grid-item flex-item">#{Parent width below}: <input data-prop="containerRuleWidth" type="number" min="1"></div>
<div data-target="grid-item flex-item">#{Action}:
    <select data-prop="containerRuleAction">
        <option value="column">#{Stack vertically}</option>
        <option value="wrap">#{Wrap items}</option>
        <option value="hide">#{Hide element}</option>
    </select>
</div>

<div data-target="grid-item flex-item">
    #{Presets}:
    <div data-prop="variantList"></div>
    <button type="button" data-action="addVariant">+ #{Save preset}</button>
</div>

</div>

</div>

</div>



<div class="propertiesElementTabContent" data-properties-tab-content="advanced">

<!-- !!!Дополнительные -->

<div data-target="all">#{Margin}: <div class="marginGrid">
    <div class="col left"><input data-prop="marginLeft" placeholder="#{Left}"></div>
    <div class="col center"><input data-prop="marginTop" placeholder="#{Top}"><input data-prop="marginBottom" placeholder="#{Bottom}"></div>
    <div class="col right"><input data-prop="marginRight" placeholder="#{Right}"></div>
</div></div>
<div data-target="all">#{Padding}: <div class="paddingGrid">
    <div class="col left"><input data-prop="paddingLeft" placeholder="#{Left}"></div>
    <div class="col center"><input data-prop="paddingTop" placeholder="#{Top}"><input data-prop="paddingBottom" placeholder="#{Bottom}"></div>
    <div class="col right"><input data-prop="paddingRight" placeholder="#{Right}"></div>
</div></div>

<div data-target="all">#{Background}: <input type="color" data-prop="backgroundColor"></div>
<div data-target="all">#{Border}:
    <div class="borderSettings">
        <div>#{Color}: <input type="color" data-prop="borderColor"></div>
        <div>#{Width}: <input data-prop="borderWidth"></div>
        <div>#{Style}: <select data-prop="borderStyle">
            <option value="">#{Default}</option>
            <option value="solid">#{Solid}</option>
            <option value="dashed">#{Dashed}</option>
            <option value="dotted">#{Dotted}</option>
            <option value="double">#{Double}</option>
        </select></div>
    </div>
</div>
<div data-target="all">#{Border radius}: <input data-prop="borderRadius"></div>

<!-- <div data-target="text link input textarea select button code">Размер шрифта: <input data-prop="fontSize"></div>
<div data-target="text link input textarea select button code">Цвет текста: <input type="color" data-prop="color"></div>
<div data-target="text link input textarea select button code">Выравнивание текста: <select data-prop="textAlign">
    <option value="">По умолчанию</option>
    <option value="left">Слева</option>
    <option value="center">По центру</option>
    <option value="right">Справа</option>
</select></div> -->

<div data-target="img a figure video audio iframe">#{Link}: <input type="text" data-prop="link"></div>
<div data-target="all">#{Opacity}: <input data-prop="opacity"></div>
<div data-target="all">#{Cursor}: <select data-prop="cursor">
    <option value="">#{Default}</option>
    <option value="pointer">#{Pointer}</option>
    <option value="text">#{Text}</option>
    <option value="wait">#{Wait}</option>
    <option value="not-allowed">#{Not allowed}</option>
    <option value="help">#{Help}</option>
</select>

</div>

</div>



<div class="propertiesElementTabContent" data-properties-tab-content="special">

<!-- !!!Особенные -->

<div data-target="input">#{Placeholder}: <input type="text" data-prop="inputPlaceholder"></div>
<div data-target="input">#{Input type}: <select data-prop="inputType">
    <option value="text">#{Text}</option>
    <option value="email">#{Email}</option>
    <option value="password">#{Password}</option>
    <option value="number">#{Number}</option>
</select></div>
<div data-target="button">#{Button type}: <select data-prop="buttonType">
    <option value="">#{Default}</option>
    <option value="button">#{Button}</option>
    <option value="submit">#{Submit form}</option>
    <option value="reset">#{Reset form}</option>
</select></div>
<div data-target="textarea">#{Resize}: <select data-prop="resize">
    <option value="">#{Default}</option>
    <option value="none">#{Disable}</option>
    <option value="both">#{Both}</option>
    <option value="horizontal">#{Horizontal}</option>
    <option value="vertical">#{Vertical}</option>
</select></div>

<div data-target="form">#{Form method}: <select data-prop="formMethod">
    <option value="">#{Default}</option>
    <option value="get">GET</option>
    <option value="post">POST</option>
</select></div>
<div data-target="form">#{Form action}: <input type="text" data-prop="formAction"></div>

<div data-target="table">#{Number of rows}: <input type="number" min="1" step="1" data-prop="tableRows" value="1"></div>
<div data-target="table">#{Number of columns}: <input type="number" min="1" step="1" data-prop="tableCols" value="1"></div>

<div data-target="video">#{Poster}: <input type="text" data-prop="videoPoster"></div>
<div data-target="details">#{Open by default}: <input type="checkbox" data-prop="detailsOpen"></div>

<div data-target="input:file">#{Accepted file types}: <input type="text" data-prop="fileAccept"></div>
<div data-target="input:file">#{Allow multiple files}: <input type="checkbox" data-prop="fileMultiple"></div>
<div data-target="input:range">#{Minimum value}: <input type="number" step="any" data-prop="rangeMin"></div>
<div data-target="input:range">#{Maximum value}: <input type="number" step="any" data-prop="rangeMax"></div>
<div data-target="input:range">#{Current value}: <input type="number" step="any" data-prop="rangeValue"></div>
<div data-target="progress">#{Current value}: <input type="number" step="any" data-prop="progressValue"></div>

</div>

</div>

</div>



<!-- !!!ID и группы -->

<!-- <div class="propertiesElementTabContent" data-properties-tab-content="groups">

<div id="propertiesSelectorPanel">
    <select id="propertiesSelectorType">
        <option value="id">ID</option>
        <option value="class">Группа</option>
    </select>
    <input id="propertiesSelectorName" type="text">
    <select id="propertiesSelectorExisting">
    </select>
</div>

<table id="propertiesSelectorProperties">
    <tr>
        <td><input placeholder="Свойство"></td>
        <td><input placeholder="Значение"></td>
    </tr>
</table>

</div>

</div> -->