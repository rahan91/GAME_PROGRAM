(function () {
  var INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"], [contenteditable], .card, .tab, .item';

  // Games ease the drawn cursor toward the pointer at 0.24/frame. Outside the
  // games (or on non-cursor games) the sluggishness is doubled, so the catch-up
  // rate is halved.
  var EASE = 0.12;

  function init() {
    if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;

    var el = document.createElement('div');
    el.id = 'siteCursor';
    el.className = 'arrow';
    el.style.cssText =
      'position:fixed;top:0;left:0;width:31px;height:40px;pointer-events:none;' +
      'z-index:2147483646;will-change:transform;image-rendering:pixelated;' +
      'transform:translate3d(-100px,-100px,0);' +
      'background:url("assets/cursor-arrow.png") no-repeat 0 0 / auto 30px;';
    document.body.appendChild(el);

    var TRAIL = 6;
    var trail = [];
    var trailX = [], trailY = [];
    for (var i = 0; i < TRAIL; i++) {
      var t = document.createElement('div');
      t.className = 'afterimage';
      t.style.cssText =
        'position:fixed;top:0;left:0;width:31px;height:40px;pointer-events:none;' +
        'z-index:2147483645;will-change:transform;image-rendering:pixelated;' +
        'transform:translate3d(-100px,-100px,0);opacity:' + (0.35 - i * 0.05).toFixed(2) + ';' +
        'background:url("assets/cursor-arrow.png") no-repeat 0 0 / auto 30px;' +
        'filter:brightness(' + (1 - i * 0.1).toFixed(1) + ');';
      document.body.appendChild(t);
      trail.push(t);
      trailX.push(window.innerWidth / 2);
      trailY.push(window.innerHeight / 2);
    }

    var style = document.createElement('style');
    style.textContent = 'html * { cursor: none !important; }';
    document.head.appendChild(style);

    var sprites = { arrow: null, finger: null, border: '' };
    var custom = false;
    var over = false;
    var hotX = 1;
    var realX = window.innerWidth / 2, realY = window.innerHeight / 2;
    var curX = realX, curY = realY;

    function paint() {
      var finger = el.className === 'finger';
      var url = custom
        ? (finger ? sprites.finger : sprites.arrow)
        : 'assets/' + (finger ? 'cursor-finger' : 'cursor-arrow') + '.png';
      var filter = custom ? (sprites.border || '') : '';
      if (custom) {
        el.style.backgroundImage = 'url("' + url + '")';
        el.style.filter = filter;
      } else {
        el.style.backgroundImage = 'url("' + url + '")';
        el.style.filter = '';
      }
      for (var i = 0; i < TRAIL; i++) {
        trail[i].style.backgroundImage = 'url("' + url + '")';
        trail[i].style.filter = custom ? filter : 'brightness(' + (1 - i * 0.1).toFixed(1) + ')';
      }
    }

    function tick() {
      curX += (realX - curX) * EASE;
      curY += (realY - curY) * EASE;
      el.style.transform = 'translate3d(' + (curX - hotX) + 'px,' + curY + 'px,0)';
      for (var i = TRAIL - 1; i > 0; i--) {
        trailX[i] += (trailX[i - 1] - trailX[i]) * 0.35;
        trailY[i] += (trailY[i - 1] - trailY[i]) * 0.35;
      }
      trailX[0] += (curX - trailX[0]) * 0.4;
      trailY[0] += (curY - trailY[0]) * 0.4;
      for (var j = 0; j < TRAIL; j++) {
        trail[j].style.transform = 'translate3d(' + (trailX[j] - hotX) + 'px,' + trailY[j] + 'px,0)';
      }
      requestAnimationFrame(tick);
    }

    function loadCustom() {
      if (!window.Shop || !Shop.state || !Shop.cursorSprites) return;
      Shop.state()
        .then(function (s) {
          var item = (s && Shop.installed(s.equipped, Shop.CURSOR)) || null;
          if (!item || !item.color) return;
          return Shop.cursorSprites(item.color).then(function (sp) {
            if (sp && sp.arrow) {
              sprites = sp;
              custom = true;
              paint();
            }
          });
        })
        .catch(function () {});
    }

    document.addEventListener('pointermove', function (e) {
      realX = e.clientX;
      realY = e.clientY;
      hotX = over ? 8 : 1;
    });

    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest(INTERACTIVE) : null;
      over = !!t;
      hotX = over ? 8 : 1;
      el.className = over ? 'finger' : 'arrow';
      paint();
    });

    paint();
    loadCustom();
    requestAnimationFrame(tick);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();