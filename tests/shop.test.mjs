import assert from 'node:assert/strict';
import { ITEMS } from '../functions/_lib/catalog.js';

const item = (key) => ITEMS.find((i) => i.key === key);
let checks = 0;
const check = (name, fn) => { fn(); checks++; };

const MAZE_PRICES = {
  'dark-green': 2000, teal: 2400, aqua: 3000, blue: 3340,
  indigo: 3400, violet: 3600, red: 4000, orange: 4400, yellow: 5000,
};
const CURSOR_PRICES = {
  black: 700, red: 1400, orange: 1540, yellow: 1680, lime: 1820,
  green: 1960, teal: 2100, aqua: 2240, blue: 2380, indigo: 2520,
  violet: 2660, pink: 2800,
};
const TARGET_PRICES = {
  orange: 5200, yellow: 5460, green: 5980, aqua: 6500, blue: 7020, purple: 7800,
};
const ACCENT_PRICES = {
  aqua: 6000, teal: 6600, blue: 7200, indigo: 7800, violet: 8000, red: 8800, orange: 9400, yellow: 10000,
};
const NAMEPLATE_PRICES = {
  white: 6000, blue: 12000, green: 20000, orange: 28000, 'light-red': 36000, pink: 40000,
  'light-purple': 50000, lime: 60000, yellow: 72000, cyan: 80000, red: 94000, purple: 100000,
  amber: 130000, rainbow: 160000, 'fiery-red': 200000,
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

for (const [color, price] of Object.entries(NAMEPLATE_PRICES)) {
  check(`nameplate ${color} = ${price}`, () => {
    const i = item(`nameplate:${color}`);
    assert.ok(i, `nameplate:${color} exists`);
    assert.equal(i.slot, 'nameplate');
    assert.equal(i.price, price);
    const hasSolid = /^#[0-9a-f]{6}$/i.test(i.color || '');
    if (['rainbow', 'fiery-red'].includes(color)) {
      assert.ok(Array.isArray(i.colors) && i.colors.length >= 3, `${color} has animated colors`);
      for (const c of i.colors) assert.match(c, /^#[0-9a-f]{6}$/i);
      if (i.color) assert.fail(`${color} should be animation-only`);
    } else {
      assert.match(i.color, /^#[0-9a-f]{6}$/i);
    }
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