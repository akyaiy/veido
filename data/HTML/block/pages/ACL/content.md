# Панель администратора ACL

## Создать роль

<input id="roleName" placeholder="имя роли" />
<button onclick="createRole()">Создавать</button>

## Создать разрешение

<input id="permKey" placeholder="ключ разрешения" />
<button onclick="createPerm()">Создавать</button>

## Назначить разрешение роли

<input id="roleIdPerm" placeholder="идентификатор роли" />
<input id="permIdRole" placeholder="идентификатор разрешения" />
<button onclick="assignPermission()">Назначать</button>

## Назначить роль пользователю

<input id="roleIdUser" placeholder="идентификатор роли" />
<input id="userIdRole" placeholder="идентификатор пользователя" />
<button onclick="assignRole()">Назначать</button>
