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
      'background:url("assets/cursor-arrow.png") no-repeat 0 0;';
    document.body.appendChild(el);

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
      if (custom) {
        el.style.backgroundImage = 'url("' + (finger ? sprites.finger : sprites.arrow) + '")';
        el.style.filter = sprites.border || '';
      } else {
        el.style.backgroundImage =
          'url("assets/' + (finger ? 'cursor-finger' : 'cursor-arrow') + '.png")';
        el.style.filter = '';
      }
    }

    function tick() {
      curX += (realX - curX) * EASE;
      curY += (realY - curY) * EASE;
      el.style.transform = 'translate3d(' + (curX - hotX) + 'px,' + curY + 'px,0)';
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
      hotX = over ? 11 : 1;
    });

    document.addEventListener('mouseover', function (e) {
      var t = e.target.closest ? e.target.closest(INTERACTIVE) : null;
      over = !!t;
      hotX = over ? 11 : 1;
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