export const SLOTS = ['maze', 'cursor', 'target', 'accent', 'nameplate'];

export const ITEMS = [
  { key: 'maze:default', default: true, slot: 'maze',   name: 'Default',    color: null, price: 0 },
  { key: 'maze:dark-green', slot: 'maze',   name: 'Dark Green', color: '#2f7a4d', price: 10000 },
  { key: 'maze:teal',       slot: 'maze',   name: 'Teal',       color: '#17a2a6', price: 12000 },
  { key: 'maze:aqua',       slot: 'maze',   name: 'Aqua',       color: '#26d0d6', price: 15000 },
  { key: 'maze:blue',       slot: 'maze',   name: 'Blue',       color: '#3b82f6', price: 16700 },
  { key: 'maze:indigo',     slot: 'maze',   name: 'Indigo',     color: '#6366f1', price: 17000 },
  { key: 'maze:violet',     slot: 'maze',   name: 'Violet',     color: '#8b5cf6', price: 18000 },
  { key: 'maze:red',        slot: 'maze',   name: 'Red',        color: '#e5484d', price: 20000 },
  { key: 'maze:orange',     slot: 'maze',   name: 'Orange',     color: '#f97316', price: 22000 },
  { key: 'maze:yellow',     slot: 'maze',   name: 'Yellow',     color: '#eab308', price: 25000 },

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
  { key: 'target:orange',   slot: 'target', name: 'Orange',     color: '#f97316', price: 26000 },
  { key: 'target:yellow',   slot: 'target', name: 'Yellow',     color: '#eab308', price: 27300 },
  { key: 'target:green',    slot: 'target', name: 'Green',      color: '#22c55e', price: 29900 },
  { key: 'target:aqua',     slot: 'target', name: 'Aqua',       color: '#06b6d4', price: 32500 },
  { key: 'target:blue',     slot: 'target', name: 'Blue',       color: '#3b82f6', price: 35100 },
  { key: 'target:purple',   slot: 'target', name: 'Purple',     color: '#8b5cf6', price: 39000 },

  { key: 'accent:default', default: true, slot: 'accent', name: 'Default',   color: null, price: 0 },
  { key: 'accent:aqua',    slot: 'accent', name: 'Aqua',     color: '#0ecdf2', price: 30000 },
  { key: 'accent:teal',    slot: 'accent', name: 'Teal',     color: '#12b8a8', price: 33000 },
  { key: 'accent:blue',    slot: 'accent', name: 'Blue',     color: '#3d82f5', price: 36000 },
  { key: 'accent:indigo',  slot: 'accent', name: 'Indigo',   color: '#6c6cf5', price: 39000 },
  { key: 'accent:violet',  slot: 'accent', name: 'Violet',   color: '#9858f6', price: 40000 },
  { key: 'accent:red',     slot: 'accent', name: 'Red',      color: '#e5484d', price: 44000 },
  { key: 'accent:orange',  slot: 'accent', name: 'Orange',   color: '#f97316', price: 47000 },
  { key: 'accent:yellow',  slot: 'accent', name: 'Yellow',   color: '#eab308', price: 50000 },

  { key: 'nameplate:default', default: true, slot: 'nameplate', name: 'Default', color: null, price: 0 },
];

export const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

export function getItem(key) {
  return ITEM_BY_KEY[key] || null;
}