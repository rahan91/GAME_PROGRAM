(function () {
  var W, H, vw, vh;
  var STRENGTH = 0.5;

  if (document.querySelector('#mazeCanvas')) return;

  var overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147482000;overflow:hidden;background:#0b0b0b;' +
    'pointer-events:auto;';
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  var captureCanvas = document.createElement('canvas');
  var captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
  var sourceImg = null;

  function collectStyles() {
    var parts = [];
    document.querySelectorAll('style').forEach(function (s) { parts.push(s.textContent); });
    return parts.join('\n');
  }

  function makeSvg() {
    var ns = 'http://www.w3.org/2000/svg';
    var xhtml = 'http://www.w3.org/1999/xhtml';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    var doc = document.createElementNS(ns, 'foreignObject');
    doc.setAttribute('width', W);
    doc.setAttribute('height', H);
    doc.setAttribute('x', '0');
    doc.setAttribute('y', '0');
    var wrapper = document.createElement('div');
    wrapper.setAttribute('xmlns', xhtml);
    var style = document.createElement('style');
    style.textContent = collectStyles();
    var bodyClone = document.body.cloneNode(true);
    ['.crt', '.bulge'].forEach(function (sel) {
      (bodyClone.querySelectorAll(sel) || []).forEach(function (el) { el.remove(); });
    });
    wrapper.appendChild(style);
    wrapper.appendChild(bodyClone);
    doc.appendChild(wrapper);
    svg.appendChild(doc);
    return svg;
  }

  function render() {
    var svg = makeSvg();
    var holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-20000px;top:-20000px;width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:#0b0b0b;';
    holder.appendChild(svg);
    document.body.appendChild(holder);
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    var img = new Image();
    img.onload = function () {
      captureCanvas.width = W;
      captureCanvas.height = H;
      captureCtx.clearRect(0, 0, W, H);
      captureCtx.drawImage(img, 0, 0, W, H);
      holder.remove();
      try {
        sourceImg = captureCtx.getImageData(0, 0, W, H);
      } catch (e) { sourceImg = null; }
      warp();
      canvas.style.visibility = 'visible';
    };
    img.onerror = function () {
      holder.remove();
      canvas.style.visibility = 'hidden';
    };
    img.src = url;
  }

  function warp() {
    if (!sourceImg) return;
    var out = canvas.getContext('2d');
    var target = out.createImageData(W, H);
    var t = target.data;
    var s = sourceImg.data;
    var cx = W / 2, cy = H / 2;
    var maxR = Math.sqrt(cx * cx + cy * cy);
    var i = 0;
    for (var y = 0; y < H; y++) {
      var dy = y - cy;
      for (var x = 0; x < W; x++) {
        var dx = x - cx;
        var r = Math.sqrt(dx * dx + dy * dy) / maxR;
        var k = 1 + STRENGTH * r * r;
        var sx = Math.min(W - 1, Math.max(0, Math.round(cx + dx / k)));
        var sy = Math.min(H - 1, Math.max(0, Math.round(cy + dy / k)));
        var si = (sy * W + sx) << 2;
        t[i++] = s[si];
        t[i++] = s[si + 1];
        t[i++] = s[si + 2];
        t[i++] = 255;
      }
    }
    out.putImageData(target, 0, 0);
  }

  function inverseWarp(px, py) {
    var cx = W / 2, cy = H / 2;
    var maxR = Math.sqrt(cx * cx + cy * cy);
    var dx = px - cx, dy = py - cy;
    var r = Math.sqrt(dx * dx + dy * dy);
    var rn = (r / maxR);
    var rInv = rn + STRENGTH * Math.pow(rn, 3);
    var scaleOut = (maxR * rInv) / (r || 1);
    return { x: cx + dx * scaleOut, y: cy + dy * scaleOut };
  }

  function toReal(coords) {
    return {
      x: coords.x * (vw / W),
      y: coords.y * (vh / H)
    };
  }

  canvas.addEventListener('pointerdown', function (e) {
    var rect = overlay.getBoundingClientRect();
    var ix = (e.clientX - rect.left) * (W / rect.width);
    var iy = (e.clientY - rect.top) * (H / rect.height);
    var s = inverseWarp(ix, iy);
    var real = toReal(s);
    var el = document.elementFromPoint(real.x, real.y);
    if (el && el !== canvas && el !== overlay) {
      el.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true, clientX: real.x, clientY: real.y, button: e.button
      }));
    }
    e.preventDefault();
  });

  canvas.addEventListener('click', function (e) {
    var rect = overlay.getBoundingClientRect();
    var ix = (e.clientX - rect.left) * (W / rect.width);
    var iy = (e.clientY - rect.top) * (H / rect.height);
    var s = inverseWarp(ix, iy);
    var real = toReal(s);
    var el = document.elementFromPoint(real.x, real.y);
    if (el && el !== canvas && el !== overlay) {
      el.click();
    }
    e.preventDefault();
    e.stopPropagation();
  });

  var schedule = null;
  var MAX_DIM = 1280;
  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    var m = Math.max(vw, vh);
    var scale = m > MAX_DIM ? MAX_DIM / m : 1;
    W = Math.max(2, Math.round(vw * scale));
    H = Math.max(2, Math.round(vh * scale));
    canvas.width = W;
    canvas.height = H;
    sourceImg = null;
    canvas.style.visibility = 'hidden';
    if (schedule) clearTimeout(schedule);
    schedule = setTimeout(render, 50);
  }

  window.addEventListener('resize', function () {
    if (schedule) clearTimeout(schedule);
    schedule = setTimeout(resize, 200);
  });

  resize();
})();
