export const SLOTS = ['maze', 'cursor', 'target'];

export const ITEMS = [
  { key: 'maze:default', default: true, slot: 'maze',   name: 'Default',    color: null, price: 0 },
  { key: 'maze:dark-green', slot: 'maze',   name: 'Dark Green', color: '#2f7a4d', price: 1000 },
  { key: 'maze:teal',       slot: 'maze',   name: 'Teal',       color: '#17a2a6', price: 1200 },
  { key: 'maze:aqua',       slot: 'maze',   name: 'Aqua',       color: '#26d0d6', price: 1500 },
  { key: 'maze:blue',       slot: 'maze',   name: 'Blue',       color: '#3b82f6', price: 1670 },
  { key: 'maze:indigo',     slot: 'maze',   name: 'Indigo',     color: '#6366f1', price: 1700 },
  { key: 'maze:violet',     slot: 'maze',   name: 'Violet',     color: '#8b5cf6', price: 1800 },
  { key: 'maze:red',        slot: 'maze',   name: 'Red',        color: '#e5484d', price: 2000 },
  { key: 'maze:orange',     slot: 'maze',   name: 'Orange',     color: '#f97316', price: 2200 },
  { key: 'maze:yellow',     slot: 'maze',   name: 'Yellow',     color: '#eab308', price: 2500 },

  { key: 'cursor:default', default: true, slot: 'cursor', name: 'Default',    color: null, price: 0 },
  { key: 'cursor:black',    slot: 'cursor', name: 'Black',      color: '#141414', price: 500 },
  { key: 'cursor:red',      slot: 'cursor', name: 'Red',        color: '#e5484d', price: 1000 },
  { key: 'cursor:orange',   slot: 'cursor', name: 'Orange',     color: '#f97316', price: 1100 },
  { key: 'cursor:yellow',   slot: 'cursor', name: 'Yellow',     color: '#eab308', price: 1200 },
  { key: 'cursor:lime',     slot: 'cursor', name: 'Lime',       color: '#84cc16', price: 1300 },
  { key: 'cursor:green',    slot: 'cursor', name: 'Green',      color: '#22c55e', price: 1400 },
  { key: 'cursor:teal',     slot: 'cursor', name: 'Teal',       color: '#14b8a6', price: 1500 },
  { key: 'cursor:aqua',     slot: 'cursor', name: 'Aqua',       color: '#06b6d4', price: 1600 },
  { key: 'cursor:blue',     slot: 'cursor', name: 'Blue',       color: '#3b82f6', price: 1700 },
  { key: 'cursor:indigo',   slot: 'cursor', name: 'Indigo',     color: '#6366f1', price: 1800 },
  { key: 'cursor:violet',   slot: 'cursor', name: 'Violet',     color: '#8b5cf6', price: 1900 },
  { key: 'cursor:pink',     slot: 'cursor', name: 'Pink',       color: '#ec4899', price: 2000 },

  { key: 'target:default', default: true, slot: 'target', name: 'Default',    color: null, price: 0 },
  { key: 'target:orange',   slot: 'target', name: 'Orange',     color: '#f97316', price: 2000 },
  { key: 'target:yellow',   slot: 'target', name: 'Yellow',     color: '#eab308', price: 2100 },
  { key: 'target:green',    slot: 'target', name: 'Green',      color: '#22c55e', price: 2300 },
  { key: 'target:aqua',     slot: 'target', name: 'Aqua',       color: '#06b6d4', price: 2500 },
  { key: 'target:blue',     slot: 'target', name: 'Blue',       color: '#3b82f6', price: 2700 },
  { key: 'target:purple',   slot: 'target', name: 'Purple',     color: '#8b5cf6', price: 3000 },
];

export const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

export function getItem(key) {
  return ITEM_BY_KEY[key] || null;
}