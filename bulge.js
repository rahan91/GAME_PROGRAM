(function () {
  var W, H;
  var STRENGTH = 0.5;

  if (document.querySelector('#mazeCanvas')) return;

  var overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147482000;pointer-events:none;overflow:hidden;background:#0b0b0b;';
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  var captureCanvas = document.createElement('canvas');
  var captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
  var sourceImg = null;

  function warpInto(outCtx) {
    if (!sourceImg) return;
    var target = outCtx.createImageData(W, H);
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
        var sx = (cx + dx / k) | 0;
        var sy = (cy + dy / k) | 0;
        if (sx < 0) sx = 0; else if (sx > W - 1) sx = W - 1;
        if (sy < 0) sy = 0; else if (sy > H - 1) sy = H - 1;
        var si = (sy * W + sx) << 2;
        t[i++] = s[si];
        t[i++] = s[si + 1];
        t[i++] = s[si + 2];
        t[i++] = 255;
      }
    }
    outCtx.putImageData(target, 0, 0);
  }

  function makeSvg(bodyClone) {
    var ns = 'http://www.w3.org/2000/svg';
    var xhtml = 'http://www.w3.org/1999/xhtml';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    var fobj = document.createElementNS(ns, 'foreignObject');
    fobj.setAttribute('width', W);
    fobj.setAttribute('height', H);
    fobj.setAttribute('x', '0');
    fobj.setAttribute('y', '0');
    var body = bodyClone;
    body.setAttribute('xmlns', xhtml);
    fobj.appendChild(body);
    svg.appendChild(fobj);
    return svg;
  }

  function render() {
    if (busy) {
      pending = true;
      return;
    }
    busy = true;
    pending = false;
    var body = document.body.cloneNode(true);
    ['.crt', '.bulge'].forEach(function (sel) {
      (body.querySelectorAll(sel) || []).forEach(function (el) { el.remove(); });
    });
    var svg = makeSvg(body);
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
      warpInto(canvas.getContext('2d'));
      busy = false;
    };
    img.onerror = function () {
      holder.remove();
      busy = false;
      canvas.getContext('2d').clearRect(0, 0, W, H);
      overlay.style.display = 'none';
    };
    img.src = url;
  }

  var schedule = null;
  var busy = false;
  var pending = false;
  var MAX_DIM = 1280;
  function resize() {
    var scale = 1;
    var vw = window.innerWidth, vh = window.innerHeight;
    var m = Math.max(vw, vh);
    if (m > MAX_DIM) scale = MAX_DIM / m;
    W = Math.max(2, Math.round(vw * scale));
    H = Math.max(2, Math.round(vh * scale));
    canvas.width = W;
    canvas.height = H;
    captureCanvas.width = 0;
    sourceImg = null;
    if (schedule) clearTimeout(schedule);
    schedule = setTimeout(render, 60);
  }

  window.addEventListener('resize', function () {
    if (schedule) clearTimeout(schedule);
    schedule = setTimeout(resize, 200);
  });

  setInterval(function () {
    if (!document.hidden) render();
  }, 900);

  resize();
})();
