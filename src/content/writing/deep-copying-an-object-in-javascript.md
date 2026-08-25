---
title: "Deep Copying an Object in JavaScript"
description: "The spread syntax and Object.assign() only copy one level deep — nested values are still shared with the source. What that breaks, and the two ways to get a real copy."
pubDate: 2018-08-16
updatedDate: 2024-06-07
tags: [javascript, data-structures]
---

Using the spread syntax or `Object.assign()` is a standard way of copying an object in JavaScript. Both methods can be used equivalently to copy the enumerable properties of an object to another object, with the spread syntax being the shorter of the two. They are also useful to merge objects, since both automatically overwrite the properties in the target object that have the same keys as those in the source object.

These two techniques were introduced in ECMAScript 2015 and are both standard JavaScript features. They are also suggested in the Redux documentation, since reducers in Redux return a copy of the state instead of mutating it directly.

However, neither of them can be used to make a *deep* copy of an object.

## The problem

The spread syntax and `Object.assign()` can only make **shallow** copies of objects. This means that the deeply nested values inside the copied object are put there just as a reference to the source object. If we modify a deeply nested value of the copied object, we will therefore end up modifying the value in the source object as well.

Let's take the object below as an example:

```js
const pizzas = {
  margherita: {
    toppings: ['tomato sauce', 'mozzarella cheese'],
    prices: {
      small: '5.00',
      medium: '6.00',
      large: '7.00'
    }
  },
  prosciutto: {
    toppings: ['tomato sauce', 'mozzarella cheese', 'ham'],
    prices: {
      small: '6.50',
      medium: '7.50',
      large: '8.50'
    }
  }
};
```

Now let's copy `pizzas` using the spread syntax and change the value of one of the prices in the copied object:

```js
let pizzasCopy = { ...pizzas };

// modify a value in the copy of pizzas
pizzasCopy.margherita.prices.small = '5.50';

// log the copied object to the console
console.log(pizzasCopy.margherita.prices.small); // 5.50, as expected

// log the source object to the console
console.log(pizzas.margherita.prices.small); // also 5.50 instead of 5.00!
```

As you can see, prices are deeply nested properties (more than one level deep) in our object. We only reassigned the value of one of the prices in the copied `pizzasCopy` object, but we actually changed the same price value in the source `pizzas` object.

This would not happen if we reassigned the value of a top-level property:

```js
// reassign the value of a top-level property in the copied object
pizzasCopy.margherita = {};

// log the copied object to the console
console.log(pizzasCopy.margherita); // an empty object, as expected

// log the source object to the console
console.log(pizzas.margherita); // still the original source object
```

The same happens with `Object.assign()`:

```js
let pizzasCopy = Object.assign({}, pizzas);

// modify a value in the copy of pizzas
pizzasCopy.margherita.prices.small = '5.50';

// log the copied object to the console
console.log(pizzasCopy.margherita.prices.small); // 5.50, as expected

// log the source object to the console
console.log(pizzas.margherita.prices.small); // also 5.50 instead of 5.00!
```

## A solution

[immutability-helper](https://github.com/kolodny/immutability-helper) is an easy-to-use, lightweight JavaScript library commonly used in React, which allows us to mutate a copy of an object without changing the original source.

We can get it via npm:

```sh
npm install immutability-helper --save
```

To deep copy our `pizzas` object, we can use the `update()` function it exports, passing the object we want to copy as the first argument and the actual data to change as the second one:

```js
import update from 'immutability-helper';

const pizzasCopy = update(pizzas, {
  margherita: { prices: { small: { $set: '5.50' } } }
});

// log the copied object to the console
console.log(pizzasCopy.margherita.prices.small); // 5.50, as expected

// log the source object to the console
console.log(pizzas.margherita.prices.small); // 5.00, the original price!
```

The library has a whole bunch of useful commands, and it can copy methods as well. Method definitions on objects cannot be copied, for example, using the "standard" deep-copying technique of stringifying and parsing an object as JSON:

```js
const copiedObj = JSON.parse(JSON.stringify(sourceObj)); // drops methods, Dates, undefined…
```

## Wrapping up

The spread syntax and `Object.assign()` only let us make shallow copies of objects in JavaScript. Deeply nested values are put there just as a reference to the source object.

immutability-helper is an easy-to-use, lightweight library that allows us to deep copy an object and easily manipulate it with dedicated commands.

## 2023 update 🗓️

[`structuredClone()`](https://developer.mozilla.org/en-US/docs/Web/API/Window/structuredClone) is now a built-in global (in browsers, Node.js and Deno) that creates a deep clone of a given value using the structured clone algorithm — no library needed:

```js
const pizzasCopy = structuredClone(pizzas);

// modify a value in the copy of pizzas
pizzasCopy.margherita.prices.small = '5.50';

// log the copied object to the console
console.log(pizzasCopy.margherita.prices.small); // 5.50, as expected

// log the source object to the console
console.log(pizzas.margherita.prices.small); // 5.00, the original price!
```
