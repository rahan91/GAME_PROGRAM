(function () {
  var ITEMS = [
    { key: 'maze:dark-green', slot: 'maze',   name: 'Dark Green', color: '#2f7a4d', price: 1000 },
    { key: 'maze:teal',       slot: 'maze',   name: 'Teal',       color: '#17a2a6', price: 1200 },
    { key: 'maze:aqua',       slot: 'maze',   name: 'Aqua',       color: '#26d0d6', price: 1500 },
    { key: 'maze:blue',       slot: 'maze',   name: 'Blue',       color: '#3b82f6', price: 1670 },
    { key: 'maze:indigo',     slot: 'maze',   name: 'Indigo',     color: '#6366f1', price: 1700 },
    { key: 'maze:violet',     slot: 'maze',   name: 'Violet',     color: '#8b5cf6', price: 1800 },
    { key: 'maze:red',        slot: 'maze',   name: 'Red',        color: '#e5484d', price: 2000 },
    { key: 'maze:orange',     slot: 'maze',   name: 'Orange',     color: '#f97316', price: 2200 },
    { key: 'maze:yellow',     slot: 'maze',   name: 'Yellow',     color: '#eab308', price: 2500 },

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

    { key: 'target:orange',   slot: 'target', name: 'Orange',     color: '#f97316', price: 2000 },
    { key: 'target:yellow',   slot: 'target', name: 'Yellow',     color: '#eab308', price: 2100 },
    { key: 'target:green',    slot: 'target', name: 'Green',      color: '#22c55e', price: 2300 },
    { key: 'target:aqua',     slot: 'target', name: 'Aqua',       color: '#06b6d4', price: 2500 },
    { key: 'target:blue',     slot: 'target', name: 'Blue',       color: '#3b82f6', price: 2700 },
    { key: 'target:purple',   slot: 'target', name: 'Purple',     color: '#8b5cf6', price: 3000 }
  ];

  var SLOT_NAMES = { maze: 'Maze', cursor: 'Cursor', target: 'Target' };
  var BY_KEY = {};
  var BY_SLOT = {};
  ITEMS.forEach(function (i) {
    BY_KEY[i.key] = i;
    (BY_SLOT[i.slot] = BY_SLOT[i.slot] || []).push(i);
  });

  window.ShopCatalog = {
    items: ITEMS,
    byKey: BY_KEY,
    bySlot: BY_SLOT,
    slotName: function (s) { return SLOT_NAMES[s] || s; },
    item: function (key) { return BY_KEY[key] || null; }
  };

  function hexToRgb(hex) {
    var m = /^#?([a-f0-9]{6})$/i.exec(String(hex || ''));
    if (!m) return { r: 180, g: 200, b: 140 };
    var n = parseInt(m[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      var d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0));
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
    }
    return { h: h, s: s, l: l };
  }

  function hexToRgba(hex, alpha) {
    var c = hexToRgb(hex);
    alpha = alpha == null ? 1 : alpha;
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  // White cursor sprites -> solid color: turn to black, invert to white, sepia,
  // oversaturate to a pure hue, then rotate to the target hue and scale lightness.
  function cursorFilterCss(hex) {
    var c = hexToRgb(hex);
    var hsl = rgbToHsl(c.r, c.g, c.b);
    var hue = Math.round(hsl.h);
    var sat = Math.round(400 + hsl.s * 800);
    var bright = Math.round(85 + hsl.l * 170);
    bright = Math.max(12, Math.min(260, bright));
    return 'brightness(0) invert(1) sepia(1) saturate(' + sat +
      '%) hue-rotate(' + hue + 'deg) brightness(' + bright + '%) contrast(1.05)';
  }

  var LOCAL_KEY = 'shopLocal';

  function localLoad() {
    try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function localSave(d) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(d)); } catch (e) {}
  }
  function localData() {
    var d = localLoad();
    d.spent = d.spent || 0;
    d.owned = d.owned || [];
    d.equipped = d.equipped || {};
    return d;
  }
  function localBalance() {
    var total = 0;
    try { total = (window.ScoreBoard && ScoreBoard.get('anonymous').total) || 0; } catch (e) {}
    return total - localData().spent;
  }
  function serverState() {
    return fetch('/api/shop/state', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) { return d.user ? d : null; })
      .catch(function () { return null; });
  }

  window.Shop = {
    MAZE: 'maze',
    CURSOR: 'cursor',
    TARGET: 'target',
    hexToRgba: hexToRgba,
    cursorFilterCss: cursorFilterCss,

    state: function () {
      return serverState().then(function (s) {
        if (s) {
          s.loggedIn = true;
          s.balance = s.user.balance;
          s.owned = s.owned || [];
          s.equipped = s.equipped || {};
          return s;
        }
        var d = localData();
        return {
          loggedIn: false,
          user: null,
          owned: d.owned,
          equipped: d.equipped,
          total: (window.ScoreBoard && ScoreBoard.get('anonymous').total) || 0,
          spent: d.spent,
          balance: localBalance()
        };
      });
    },

    buy: function (key) {
      var item = window.ShopCatalog.item(key);
      if (!item) return Promise.reject(new Error('Unknown item'));
      return serverState().then(function (s) {
        if (s) {
          return fetch('/api/shop/buy', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_key: key })
          }).then(function (r) { return r.json(); }).then(function (d) {
            if (d && d.error) throw new Error(d.error);
            d.loggedIn = true;
            return d;
          });
        }
        var d = localData();
        if (d.owned.indexOf(key) !== -1) throw new Error('Already owned');
        if (localBalance() < item.price) throw new Error('Not enough points');
        d.owned.push(key);
        d.spent += item.price;
        localSave(d);
        return { item: key, balance: localBalance(), owned: d.owned.slice() };
      });
    },

    equip: function (slot, key) {
      return serverState().then(function (s) {
        if (s) {
          return fetch('/api/shop/equip', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ slot: slot, item_key: key })
          }).then(function (r) { return r.json(); }).then(function (d) {
            if (d && d.error) throw new Error(d.error);
            return d;
          });
        }
        var d = localData();
        if (key) {
          var item = window.ShopCatalog.item(key);
          if (!item || item.slot !== slot) throw new Error('Invalid item');
          if (d.owned.indexOf(key) === -1) throw new Error('You do not own this item');
          d.equipped[slot] = key;
        } else {
          delete d.equipped[slot];
        }
        localSave(d);
        return { slot: slot, item_key: key };
      });
    },

    installed: function (equipped, slot) {
      var key = equipped && equipped[slot];
      return key ? window.ShopCatalog.item(key) : null;
    }
  };
})();