import assert from 'node:assert/strict';
import { ITEMS } from '../functions/_lib/catalog.js';

const item = (key) => ITEMS.find((i) => i.key === key);
let checks = 0;
const check = (name, fn) => { fn(); checks++; };

const MAZE_PRICES = {
  'dark-green': 10000, teal: 12000, aqua: 15000, blue: 16700,
  indigo: 17000, violet: 18000, red: 20000, orange: 22000, yellow: 25000,
};
const CURSOR_PRICES = {
  black: 3500, red: 7000, orange: 7700, yellow: 8400, lime: 9100,
  green: 9800, teal: 10500, aqua: 11200, blue: 11900, indigo: 12600,
  violet: 13300, pink: 14000,
};
const TARGET_PRICES = {
  orange: 26000, yellow: 27300, green: 29900, aqua: 32500, blue: 35100, purple: 39000,
};
const ACCENT_PRICES = {
  aqua: 30000, teal: 33000, blue: 36000, indigo: 39000, violet: 40000, red: 44000, orange: 47000, yellow: 50000,
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

for (const [color, price] of Object.entries(ACCENT_PRICES)) {
  check(`accent ${color} = ${price}`, () => {
    const i = item(`accent:${color}`);
    assert.ok(i, `accent:${color} exists`);
    assert.equal(i.slot, 'accent');
    assert.equal(i.price, price);
    assert.match(i.color, /^#[0-9a-f]{6}$/i);
  });
}

for (const slot of ['maze', 'cursor', 'target', 'accent', 'nameplate']) {
  check(`${slot} default item`, () => {
    const i = item(`${slot}:default`);
    assert.ok(i, `${slot}:default exists`);
    assert.equal(i.slot, slot);
    assert.equal(i.price, 0);
    assert.equal(i.default, true);
    if (slot === 'nameplate') assert.match(i.color, /^#[0-9a-f]{6}$/i);
    else assert.equal(i.color, null);
  });
}

console.log(`shop catalog: ${checks} checks passed`);