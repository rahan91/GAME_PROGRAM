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
  black: 350, red: 700, orange: 770, yellow: 840, lime: 910,
  green: 980, teal: 1050, aqua: 1120, blue: 1190, indigo: 1260,
  violet: 1330, pink: 1400,
};
const TARGET_PRICES = {
  orange: 2600, yellow: 2730, green: 2990, aqua: 3250, blue: 3510, purple: 3900,
};
const ACCENT_PRICES = {
  aqua: 3000, teal: 3300, blue: 3600, indigo: 3900, violet: 4000, red: 4400, orange: 4700, yellow: 5000,
};
const NAMEPLATE_PRICES = {
  white: 3000, blue: 6000, green: 10000, orange: 14000, 'light-red': 18000, pink: 20000,
  'light-purple': 25000, lime: 30000, yellow: 36000, cyan: 40000, red: 47000, purple: 50000,
  amber: 65000, rainbow: 80000, 'fiery-red': 100000,
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