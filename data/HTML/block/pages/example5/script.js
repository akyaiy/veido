let age = 25;

const value = 'test';
typeof value;

if (age >= 18) {
    for (let i = 0; i < 5; i++) {
        const currentNumber = i;
    }
}

function getName(user) {
    return user.name;
}

const getData = async () => {
    return {
        status: 'success'
    };
};

const loadData = async () => {
    const data = await getData();

    return data;
};

const button = document.createElement('button');

button.addEventListener('click', () => {
    const clicked = true;

    return clicked;
});

const user = {
    name: 'Alex',
    age: 25
};

const numbers = [1, 2, 3];
numbers.push(4);

const doubled = numbers.map(number => number * 2);

const nameLength = user.name.length;
const newName = user.name.replace('Alex', 'John');

const element = document.createElement('div');
element.remove();

age += 1;

const isAdult = age >= 18 && age < 100;

const active = true;
const empty = null;
const message = 'Hello';
const number = 123;

// Comments example
/*
 * Test
 */