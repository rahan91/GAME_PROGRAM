(function () {
  var ITEMS = [
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

    { key: 'accent:default', default: true, slot: 'accent', name: 'Default',  color: null, price: 0 },
    { key: 'accent:aqua',    slot: 'accent', name: 'Aqua',    color: '#0ecdf2', price: 30000 },
    { key: 'accent:teal',    slot: 'accent', name: 'Teal',    color: '#12b8a8', price: 33000 },
    { key: 'accent:blue',    slot: 'accent', name: 'Blue',    color: '#3d82f5', price: 36000 },
    { key: 'accent:indigo',  slot: 'accent', name: 'Indigo',  color: '#6c6cf5', price: 39000 },
    { key: 'accent:violet',  slot: 'accent', name: 'Violet',  color: '#9858f6', price: 40000 },
    { key: 'accent:red',     slot: 'accent', name: 'Red',     color: '#e5484d', price: 44000 },
    { key: 'accent:orange',  slot: 'accent', name: 'Orange',  color: '#f97316', price: 47000 },
    { key: 'accent:yellow',  slot: 'accent', name: 'Yellow',  color: '#eab308', price: 50000 },

    { key: 'nameplate:default', default: true, slot: 'nameplate', name: 'Default', color: '#828282', price: 0 },
    { key: 'nameplate:white',        slot: 'nameplate', name: 'White',        color: '#FFFFFF', price: 30000 },
    { key: 'nameplate:blue',         slot: 'nameplate', name: 'Blue',         color: '#9696FF', price: 60000 },
    { key: 'nameplate:green',        slot: 'nameplate', name: 'Green',        color: '#96FF96', price: 100000 },
    { key: 'nameplate:orange',       slot: 'nameplate', name: 'Orange',       color: '#FFC896', price: 140000 },
    { key: 'nameplate:light-red',    slot: 'nameplate', name: 'Light Red',    color: '#FF9696', price: 180000 },
    { key: 'nameplate:pink',         slot: 'nameplate', name: 'Pink',         color: '#FF96FF', price: 200000 },
    { key: 'nameplate:light-purple', slot: 'nameplate', name: 'Light Purple', color: '#D2A0FF', price: 250000 },
    { key: 'nameplate:lime',         slot: 'nameplate', name: 'Lime',         color: '#96FF0A', price: 300000 },
    { key: 'nameplate:yellow',       slot: 'nameplate', name: 'Yellow',       color: '#FFFF0A', price: 360000 },
    { key: 'nameplate:cyan',         slot: 'nameplate', name: 'Cyan',         color: '#05C8FF', price: 400000 },
    { key: 'nameplate:red',          slot: 'nameplate', name: 'Red',          color: '#FF2864', price: 470000 },
    { key: 'nameplate:purple',       slot: 'nameplate', name: 'Purple',       color: '#B428FF', price: 500000 },
    { key: 'nameplate:amber',        slot: 'nameplate', name: 'Amber',        color: '#FFAF00', price: 650000 },
    { key: 'nameplate:rainbow',      slot: 'nameplate', name: 'Rainbow',      color: null, price: 800000,
      colors: ['#FF2864', '#FFAF00', '#FFFF0A', '#96FF96', '#05C8FF', '#9696FF', '#B428FF', '#FF96FF'] },
    { key: 'nameplate:fiery-red',    slot: 'nameplate', name: 'Fiery Red',    color: null, price: 1000000,
      colors: ['#FF2864', '#FFAF00', '#FFFF0A'] }
  ];

  var SLOT_NAMES = { maze: 'Maze', cursor: 'Cursor', target: 'Target', accent: 'Accent', nameplate: 'Nameplate' };
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

  function hexToRgba(hex, alpha) {
    var c = hexToRgb(hex);
    alpha = alpha == null ? 1 : alpha;
    return 'rgba(' + c.r + ',' + c.g + ',' + c.b + ',' + alpha + ')';
  }

  var LOCAL_KEY = 'shopLocal';

  var RECOLOR_CACHE = {};
  var CURSOR_PAIR_CACHE = {};
  var WHITE_BORDER_FILTER =
    'drop-shadow(-1px 0 0 #fff) drop-shadow(1px 0 0 #fff) ' +
    'drop-shadow(0 -1px 0 #fff) drop-shadow(0 1px 0 #fff)';
  function luma(r, g, b) { return 0.299 * r + 0.587 * g + 0.114 * b; }

  function isBlackColor(hex) {
    var c = hexToRgb(hex);
    return luma(c.r, c.g, c.b) < 45;
  }

  // Recolor a sprite's opaque pixels to `hex`. When keepWhite is true, bright
  // pixels (the target's white rings) are left untouched so the result is a
  // vivid colored target with white highlights. When false, shading is
  // preserved so the result looks like the original design tinted to `hex`.
  function recolorSprite(path, hex, keepWhite) {
    var cacheKey = path + '|' + (hex || '') + '|' + (keepWhite ? 'w' : 's');
    if (RECOLOR_CACHE[cacheKey]) return RECOLOR_CACHE[cacheKey];
    var p;
    if (!hex) {
      p = Promise.resolve(null);
    } else {
      p = new Promise(function (resolve, reject) {
        var img = new Image();
        img.onload = function () {
          try {
            var cv = document.createElement('canvas');
            cv.width = img.naturalWidth || img.width;
            cv.height = img.naturalHeight || img.height;
            var ctx = cv.getContext('2d');
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(img, 0, 0);
            var data = ctx.getImageData(0, 0, cv.width, cv.height).data;
            var c = hexToRgb(hex);
            for (var i = 0; i < data.length; i += 4) {
              if (data[i + 3] === 0) continue;
              var L = luma(data[i], data[i + 1], data[i + 2]);
              if (keepWhite && L > 200) continue;
              var f = keepWhite ? (0.5 + 0.5 * (L / 255)) : (0.15 + 0.85 * (L / 255));
              data[i] = Math.min(255, Math.round(c.r * f));
              data[i + 1] = Math.min(255, Math.round(c.g * f));
              data[i + 2] = Math.min(255, Math.round(c.b * f));
            }
            ctx.putImageData(new ImageData(data, cv.width, cv.height), 0, 0);
            resolve(cv.toDataURL('image/png'));
          } catch (e) { reject(e); }
        };
        img.onerror = function () { reject(new Error('sprite load failed: ' + path)); };
        img.src = path;
      });
    }
    RECOLOR_CACHE[cacheKey] = p;
    return p;
  }

  // Both cursor sprites shaded with the equip color. Very dark colors get a
  // white border so they stay visible against dark backgrounds.
  function cursorSprites(color) {
    var key = color || '';
    if (CURSOR_PAIR_CACHE[key]) return CURSOR_PAIR_CACHE[key];
    var p;
    if (!color) {
      p = Promise.resolve({ arrow: null, finger: null, border: '' });
    } else {
      p = Promise.all([
        recolorSprite('assets/cursor-arrow.png', color, false),
        recolorSprite('assets/cursor-finger.png', color, false)
      ]).then(function (urls) {
        return {
          arrow: urls[0],
          finger: urls[1],
          border: isBlackColor(color) ? WHITE_BORDER_FILTER : ''
        };
      }).catch(function () { return { arrow: null, finger: null, border: '' }; });
    }
    CURSOR_PAIR_CACHE[key] = p;
    return p;
  }

  function targetSprite(color) {
    return recolorSprite('assets/target.png', color, true);
  }

  var DEFAULT_TONES = {
    main: [140, 180, 150],
    dim: [80, 100, 90],
    bright: [160, 220, 180],
    text: [200, 220, 205],
    texthi: [220, 240, 225],
    btn: [100, 180, 120],
    panel: [30, 38, 34],
    orb: [70, 95, 80]
  };
  var currentTones = null;

  function clamp255(v) { return v < 0 ? 0 : v > 255 ? 255 : Math.round(v); }

  function accentTones(hex) {
    var c = hexToRgb(hex || '#8cb496');
    function scale(f) {
      return [clamp255(c.r * f), clamp255(c.g * f), clamp255(c.b * f)];
    }
    function lighten(f) {
      return [clamp255(c.r + (255 - c.r) * f), clamp255(c.g + (255 - c.g) * f), clamp255(c.b + (255 - c.b) * f)];
    }
    return {
      main: [c.r, c.g, c.b],
      dim: scale(0.57),
      bright: scale(1.2),
      text: lighten(0.45),
      texthi: lighten(0.72),
      btn: scale(1.15),
      panel: scale(0.2),
      orb: scale(0.5)
    };
  }

  function applyAccent(hex) {
    var root = document.documentElement;
    var n = ['--acc-main', '--acc-dim', '--acc-bright', '--acc-text', '--acc-texthi', '--acc-btn', '--acc-panel', '--acc-orb'];
    if (!hex) {
      currentTones = null;
      for (var i = 0; i < n.length; i++) root.style.removeProperty(n[i]);
      return;
    }
    var t = accentTones(hex);
    currentTones = t;
    root.style.setProperty('--acc-main', t.main.join(','));
    root.style.setProperty('--acc-dim', t.dim.join(','));
    root.style.setProperty('--acc-bright', t.bright.join(','));
    root.style.setProperty('--acc-text', t.text.join(','));
    root.style.setProperty('--acc-texthi', t.texthi.join(','));
    root.style.setProperty('--acc-btn', t.btn.join(','));
    root.style.setProperty('--acc-panel', t.panel.join(','));
    root.style.setProperty('--acc-orb', t.orb.join(','));
    try {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('pa-theme', { detail: { hex: hex } }));
    } catch (e) {}
  }

  function applyAccentFromState(s) {
    var k = s && s.equipped ? s.equipped.accent : null;
    var item = k ? window.ShopCatalog.item(k) : null;
    applyAccent((item && item.color) || null);
  }

  function accentRgba(alpha, tone) {
    var t = currentTones || DEFAULT_TONES;
    var arr = t[tone || 'main'] || t.main;
    return 'rgba(' + arr.join(',') + ',' + alpha + ')';
  }

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

  var _npSheet = null;
  var _npDefined = {};
  var _npAnimIds = {};
  var _npAnimId = 0;
  function npAnimId(colors) {
    var key = colors.join('');
    if (!(key in _npAnimIds)) _npAnimIds[key] = 'npkf' + (++_npAnimId);
    return _npAnimIds[key];
  }
  function npKeyframes(id, colors) {
    if (_npDefined[id]) return;
    _npDefined[id] = true;
    if (!_npSheet) {
      _npSheet = document.createElement('style');
      _npSheet.id = 'np-keyframes';
      document.head.appendChild(_npSheet);
    }
    var kfs = colors.map(function (c, i) {
      return ((i / colors.length) * 100).toFixed(2) + '% { color:' + c + '; }';
    }).join(' ');
    kfs += ' 100% { color:' + colors[0] + '; }';
    _npSheet.textContent += '@keyframes ' + id + ' { ' + kfs + ' } ';
  }
  function npDuration(colors) {
    return (colors.length * 0.5) + 's';
  }

  window.Shop = {
    MAZE: 'maze',
    CURSOR: 'cursor',
    TARGET: 'target',
    ACCENT: 'accent',
    NAMEPLATE: 'nameplate',
    hexToRgba: hexToRgba,
    cursorSprites: cursorSprites,
    targetSprite: targetSprite,
    applyAccent: applyAccent,
    applyAccentFromState: applyAccentFromState,
    accentRgba: accentRgba,
    npStyle: function (item) {
      var first = item && (item.color || (item.colors && item.colors[0]));
      if (item && item.colors && item.colors.length) {
        var aid = npAnimId(item.colors);
        npKeyframes(aid, item.colors);
        return 'color:' + (first || '#828282') + ';animation:' + aid + ' ' + npDuration(item.colors) + ' linear infinite';
      }
      return 'color:' + (first || '#828282');
    },
    npHTML: function (row) {
      var uname = (row && row.username) || '';
      if (row && row.nameplateColors && row.nameplateColors.length) {
        var aid = npAnimId(row.nameplateColors);
        npKeyframes(aid, row.nameplateColors);
        return '<span class="nm" style="animation:' + aid + ' ' + npDuration(row.nameplateColors) + ' linear infinite">' + uname + '</span>';
      }
      return '<span class="nm" style="color:' + ((row && row.nameplate) || '#828282') + '">' + uname + '</span>';
    },

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
      if (item.default) return Promise.reject(new Error('Default items are free'));
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
      return fetch('/api/shop/equip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slot: slot, item_key: key })
      }).then(function (r) { return r.json(); }).then(function (d) {
        if (d && d.error) {
          if (d.error === 'Not logged in') {
            var dd = localData();
            if (key) {
              var item = window.ShopCatalog.item(key);
              if (!item || item.slot !== slot) throw new Error('Invalid item');
              if (!item.default && dd.owned.indexOf(key) === -1) throw new Error('You do not own this item');
              dd.equipped[slot] = key;
            } else {
              delete dd.equipped[slot];
            }
            localSave(dd);
            return { slot: slot, item_key: key };
          }
          throw new Error(d.error);
        }
        return d;
      }).catch(function (e) {
        if (e.message === 'Invalid item' || e.message === 'You do not own this item') throw e;
        var dd = localData();
        if (key) {
          var item = window.ShopCatalog.item(key);
          if (!item || item.slot !== slot) throw new Error('Invalid item');
          if (!item.default && dd.owned.indexOf(key) === -1) throw new Error('You do not own this item');
          dd.equipped[slot] = key;
        } else {
          delete dd.equipped[slot];
        }
        localSave(dd);
        return { slot: slot, item_key: key };
      });
    },

    installed: function (equipped, slot) {
      var key = equipped && equipped[slot];
      return key ? window.ShopCatalog.item(key) : null;
    }
  };

  if (typeof document !== 'undefined') {
    try {
      applyAccentFromState(localData());
    } catch (e) {}
    document.addEventListener('DOMContentLoaded', function () {
      try {
        serverState().then(function (s) {
          if (s) applyAccentFromState(s);
          else applyAccentFromState(localData());
        }).catch(function () {});
      } catch (e) {}
    });
  }
})();