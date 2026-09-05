import assert from 'node:assert/strict';
import { ITEMS } from '../functions/_lib/catalog.js';

const item = (key) => ITEMS.find((i) => i.key === key);
let checks = 0;
const check = (name, fn) => { fn(); checks++; };

const MAZE_PRICES = {
  'dark-green': 7000, teal: 8400, aqua: 10500, blue: 11690,
  indigo: 11900, violet: 12600, red: 14000, orange: 15400, yellow: 17500,
};
const CURSOR_PRICES = {
  black: 3500, red: 7000, orange: 7700, yellow: 8400, lime: 9100,
  green: 9800, teal: 10500, aqua: 11200, blue: 11900, indigo: 12600,
  violet: 13300, pink: 14000,
};
const TARGET_PRICES = {
  orange: 14000, yellow: 14700, green: 16100, aqua: 17500, blue: 18900, purple: 21000,
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

for (const slot of ['maze', 'cursor', 'target']) {
  check(`${slot} default item`, () => {
    const i = item(`${slot}:default`);
    assert.ok(i, `${slot}:default exists`);
    assert.equal(i.slot, slot);
    assert.equal(i.price, 0);
    assert.equal(i.default, true);
    assert.equal(i.color, null);
  });
}

console.log(`shop catalog: ${checks} checks passed`);