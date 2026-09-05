import assert from 'node:assert/strict';
import { ITEMS } from '../functions/_lib/catalog.js';

const item = (key) => ITEMS.find((i) => i.key === key);
let checks = 0;
const check = (name, fn) => { fn(); checks++; };

const MAZE_PRICES = {
  'dark-green': 1000, teal: 1200, aqua: 1500, blue: 1670,
  indigo: 1700, violet: 1800, red: 2000, orange: 2200, yellow: 2500,
};
const CURSOR_PRICES = {
  black: 500, red: 1000, orange: 1100, yellow: 1200, lime: 1300,
  green: 1400, teal: 1500, aqua: 1600, blue: 1700, indigo: 1800,
  violet: 1900, pink: 2000,
};
const TARGET_PRICES = {
  orange: 2000, yellow: 2100, green: 2300, aqua: 2500, blue: 2700, purple: 3000,
};

for (const [color, price] of Object.entries(MAZE_PRICES)) {
  check(`maze ${color} = ${price}`, () => {
    const i = item(`maze:${color}`);
    assert.ok(i, `maze:${color} exists`);
    assert.equal(i.slot, 'maze');
    assert.equal(i.price, price);
    assert.match(i.color, /^#[0-9a-f]{6}$/i);
  });
}

for (const [color, price] of Object.entries(CURSOR_PRICES)) {
  check(`cursor ${color} = ${price}`, () => {
    const i = item(`cursor:${color}`);
    assert.ok(i, `cursor:${color} exists`);
    assert.equal(i.slot, 'cursor');
    assert.equal(i.price, price);
    assert.match(i.color, /^#[0-9a-f]{6}$/i);
  });
}

for (const [color, price] of Object.entries(TARGET_PRICES)) {
  check(`target ${color} = ${price}`, () => {
    const i = item(`target:${color}`);
    assert.ok(i, `target:${color} exists`);
    assert.equal(i.slot, 'target');
    assert.equal(i.price, price);
    assert.match(i.color, /^#[0-9a-f]{6}$/i);
  });
}

console.log(`shop catalog: ${checks} checks passed`);