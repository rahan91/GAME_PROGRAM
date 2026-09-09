export const SLOTS = ['maze', 'cursor', 'target', 'accent', 'nameplate'];

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
  { key: 'cursor:black',    slot: 'cursor', name: 'Black',      color: '#141414', price: 350 },
  { key: 'cursor:red',      slot: 'cursor', name: 'Red',        color: '#e5484d', price: 700 },
  { key: 'cursor:orange',   slot: 'cursor', name: 'Orange',     color: '#f97316', price: 770 },
  { key: 'cursor:yellow',   slot: 'cursor', name: 'Yellow',     color: '#eab308', price: 840 },
  { key: 'cursor:lime',     slot: 'cursor', name: 'Lime',       color: '#84cc16', price: 910 },
  { key: 'cursor:green',    slot: 'cursor', name: 'Green',      color: '#22c55e', price: 980 },
  { key: 'cursor:teal',     slot: 'cursor', name: 'Teal',       color: '#14b8a6', price: 1050 },
  { key: 'cursor:aqua',     slot: 'cursor', name: 'Aqua',       color: '#06b6d4', price: 1120 },
  { key: 'cursor:blue',     slot: 'cursor', name: 'Blue',       color: '#3b82f6', price: 1190 },
  { key: 'cursor:indigo',   slot: 'cursor', name: 'Indigo',     color: '#6366f1', price: 1260 },
  { key: 'cursor:violet',   slot: 'cursor', name: 'Violet',     color: '#8b5cf6', price: 1330 },
  { key: 'cursor:pink',     slot: 'cursor', name: 'Pink',       color: '#ec4899', price: 1400 },

  { key: 'target:default', default: true, slot: 'target', name: 'Default',    color: null, price: 0 },
  { key: 'target:orange',   slot: 'target', name: 'Orange',     color: '#f97316', price: 2600 },
  { key: 'target:yellow',   slot: 'target', name: 'Yellow',     color: '#eab308', price: 2730 },
  { key: 'target:green',    slot: 'target', name: 'Green',      color: '#22c55e', price: 2990 },
  { key: 'target:aqua',     slot: 'target', name: 'Aqua',       color: '#06b6d4', price: 3250 },
  { key: 'target:blue',     slot: 'target', name: 'Blue',       color: '#3b82f6', price: 3510 },
  { key: 'target:purple',   slot: 'target', name: 'Purple',     color: '#8b5cf6', price: 3900 },

  { key: 'accent:default', default: true, slot: 'accent', name: 'Default',   color: null, price: 0 },
  { key: 'accent:aqua',    slot: 'accent', name: 'Aqua',     color: '#0ecdf2', price: 3000 },
  { key: 'accent:teal',    slot: 'accent', name: 'Teal',     color: '#12b8a8', price: 3300 },
  { key: 'accent:blue',    slot: 'accent', name: 'Blue',     color: '#3d82f5', price: 3600 },
  { key: 'accent:indigo',  slot: 'accent', name: 'Indigo',   color: '#6c6cf5', price: 3900 },
  { key: 'accent:violet',  slot: 'accent', name: 'Violet',   color: '#9858f6', price: 4000 },
  { key: 'accent:red',     slot: 'accent', name: 'Red',      color: '#e5484d', price: 4400 },
  { key: 'accent:orange',  slot: 'accent', name: 'Orange',   color: '#f97316', price: 4700 },
  { key: 'accent:yellow',  slot: 'accent', name: 'Yellow',   color: '#eab308', price: 5000 },

  { key: 'nameplate:default', default: true, slot: 'nameplate', name: 'Default', color: '#828282', price: 0 },
  { key: 'nameplate:white',        slot: 'nameplate', name: 'White',        color: '#FFFFFF', price: 3000 },
  { key: 'nameplate:blue',         slot: 'nameplate', name: 'Blue',         color: '#9696FF', price: 6000 },
  { key: 'nameplate:green',        slot: 'nameplate', name: 'Green',        color: '#96FF96', price: 10000 },
  { key: 'nameplate:orange',       slot: 'nameplate', name: 'Orange',       color: '#FFC896', price: 14000 },
  { key: 'nameplate:light-red',    slot: 'nameplate', name: 'Light Red',    color: '#FF9696', price: 18000 },
  { key: 'nameplate:pink',         slot: 'nameplate', name: 'Pink',         color: '#FF96FF', price: 20000 },
  { key: 'nameplate:light-purple', slot: 'nameplate', name: 'Light Purple', color: '#D2A0FF', price: 25000 },
  { key: 'nameplate:lime',         slot: 'nameplate', name: 'Lime',         color: '#96FF0A', price: 30000 },
  { key: 'nameplate:yellow',       slot: 'nameplate', name: 'Yellow',       color: '#FFFF0A', price: 36000 },
  { key: 'nameplate:cyan',         slot: 'nameplate', name: 'Cyan',         color: '#05C8FF', price: 40000 },
  { key: 'nameplate:red',          slot: 'nameplate', name: 'Red',          color: '#FF2864', price: 47000 },
  { key: 'nameplate:purple',       slot: 'nameplate', name: 'Purple',       color: '#B428FF', price: 50000 },
  { key: 'nameplate:amber',        slot: 'nameplate', name: 'Amber',        color: '#FFAF00', price: 65000 },
  { key: 'nameplate:rainbow',      slot: 'nameplate', name: 'Rainbow',      color: null, price: 80000,
    colors: ['#FF2864', '#FFAF00', '#FFFF0A', '#96FF96', '#05C8FF', '#9696FF', '#B428FF'] },
  { key: 'nameplate:fiery-red',    slot: 'nameplate', name: 'Fiery Red',    color: null, price: 100000,
    colors: ['#FF2864', '#FFAF00', '#FFFF0A'], speed: 0.24 },
];

export const ITEM_BY_KEY = Object.fromEntries(ITEMS.map((i) => [i.key, i]));

export function getItem(key) {
  return ITEM_BY_KEY[key] || null;
}