export const SLOTS = ['maze', 'cursor', 'target'];

export const ITEMS = [
  { key: 'maze:default', default: true, slot: 'maze',   name: 'Default',    color: null, price: 0 },
  { key: 'maze:dark-green', slot: 'maze',   name: 'Dark Green', color: '#2f7a4d', price: 7000 },
  { key: 'maze:teal',       slot: 'maze',   name: 'Teal',       color: '#17a2a6', price: 8400 },
  { key: 'maze:aqua',       slot: 'maze',   name: 'Aqua',       color: '#26d0d6', price: 10500 },
  { key: 'maze:blue',       slot: 'maze',   name: 'Blue',       color: '#3b82f6', price: 11690 },
  { key: 'maze:indigo',     slot: 'maze',   name: 'Indigo',     color: '#6366f1', price: 11900 },
  { key: 'maze:violet',     slot: 'maze',   name: 'Violet',     color: '#8b5cf6', price: 12600 },
  { key: 'maze:red',        slot: 'maze',   name: 'Red',        color: '#e5484d', price: 14000 },
  { key: 'maze:orange',     slot: 'maze',   name: 'Orange',     color: '#f97316', price: 15400 },
  { key: 'maze:yellow',     slot: 'maze',   name: 'Yellow',     color: '#eab308', price: 17500 },

  { key: 'cursor:default', default: true, slot: 'cursor', name: 'Default',    color: null, price: 0 },
  { key: 'cursor:black',    slot: 'cursor', name: 'Black',      color: '#141414', price: 3500 },
  { key: 'cursor:red',      slot: 'cursor', name: 'Red',        color: '#e5484d', price: 7000 },
  { key: 'cursor:orange',   slot: 'cursor', name: 'Orange',     color: '#f97316', price: 7700 },
  { key: 'cursor:yellow',   slot: 'cursor', name: 'Yellow',     color: '#eab308', price: 8400 },
  { key: 'cursor:lime',     slot: 'cursor', name: 'Lime',       color: '#84cc16', price: 9100 },
  { key: 'cursor:green',    slot: 'cursor', name: 'Green',      color: '#22c55e', price: 9800 },
  { key: 'cursor:teal',     slot: 'cursor', name: 'Teal',       color: '#14b8a6', price: 10500 },
  { key: 'cursor:aqua',     slot: 'cursor', name: 'Aqua',       color: '#06b6d4', price: 11200 },
  { key: 'cursor:blue',     slot: 'cursor', name: 'Blue',       color: '#3b82f6', price: 11900 },
  { key: 'cursor:indigo',   slot: 'cursor', name: 'Indigo',     color: '#6366f1', price: 12600 },
  { key: 'cursor:violet',   slot: 'cursor', name: 'Violet',     color: '#8b5cf6', price: 13300 },
  { key: 'cursor:pink',     slot: 'cursor', name: 'Pink',       color: '#ec4899', price: 14000 },

  { key: 'target:default', default: true, slot: 'target', name: 'Default',    color: null, price: 0 },
  { key: 'target:orange',   slot: 'target', name: 'Orange',     color: '#f97316', price: 14000 },
  { key: 'target:yellow',   slot: 'target', name: 'Yellow',     color: '#eab308', price: 14700 },
  { key: 'target:green',    slot: 'target', name: 'Green',      color: '#22c55e', price: 16100 },
  { key: 'target:aqua',     slot: 'target', name: 'Aqua',       color: '#06b6d4', price: 17500 },
  { key: 'target:blue',     slot: 'target', name: 'Blue',       color: '#3b82f6', price: 18900 },
  { key: 'target:purple',   slot: 'target', name: 'Purple',     color: '#8b5cf6', price: 21000 },
];

export const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

export function getItem(key) {
  return ITEM_BY_KEY[key] || null;
}