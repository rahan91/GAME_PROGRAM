window.ScoreBoard = (function () {
  var KEY = 'galleryPoints';
  var LEGACY = ['mazeGameScores', 'targetGameScores'];

  function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) || {}; }
    catch (e) { return {}; }
  }

  function save(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) {}
  }

  function migrate() {
    var s = load();
    for (var i = 0; i < LEGACY.length; i++) {
      var old = {};
      try { old = JSON.parse(localStorage.getItem(LEGACY[i])) || {}; } catch (e) { old = {}; }
      for (var name in old) {
        if (!Object.prototype.hasOwnProperty.call(old, name)) continue;
        var o = old[name] || {};
        if (!s[name]) s[name] = { total: 0, plays: 0 };
        s[name].total = (s[name].total || 0) + (o.total || 0);
        s[name].plays = (s[name].plays || 0) + (o.plays || 0);
      }
      localStorage.removeItem(LEGACY[i]);
    }
    save(s);
    return s;
  }

  function get(name) {
    var s = load();
    return s[name] || { total: 0, plays: 0 };
  }

  function add(name, points) {
    var s = load();
    if (!s[name]) s[name] = { total: 0, plays: 0 };
    var pts = Number.isFinite(points) ? Math.max(0, Math.round(points)) : 0;
    s[name].total += pts;
    s[name].plays += 1;
    save(s);
    return s[name];
  }

  function reset(name) {
    var s = load();
    s[name] = { total: 0, plays: 0 };
    save(s);
    return s[name];
  }

  migrate();
  return { KEY: KEY, load: load, save: save, migrate: migrate, get: get, add: add, reset: reset };
})();