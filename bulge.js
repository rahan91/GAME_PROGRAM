(function () {
  var W, H, vw, vh;
  var STRENGTH = 0.16;

  var overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed;inset:0;z-index:2147482000;pointer-events:none;overflow:hidden;background:#0b0b0b;';
  var canvas = document.createElement('canvas');
  canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
  overlay.appendChild(canvas);
  document.body.appendChild(overlay);

  var captureCanvas = document.createElement('canvas');
  var captureCtx = captureCanvas.getContext('2d', { willReadFrequently: true });
  var baseImg = null;
  var lut = null;

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

  // Forward barrel (convex bulge): r_out = r_in * (1 + k * r_in^2).
  // Sample each output pixel at the source radius that maps to it (inverse via Brent/approx).
  function buildLUT() {
    var cx = W / 2, cy = H / 2;
    var maxR = Math.sqrt(cx * cx + cy * cy);
    var sxL = new Uint32Array(W * H);
    var syL = new Uint32Array(W * H);
    var idx = 0;
    for (var y = 0; y < H; y++) {
      var dy = y - cy;
      for (var x = 0; x < W; x++) {
        var dx = x - cx;
        var span = Math.sqrt(dx * dx + dy * dy);
        var rhat = span / maxR;
        var factor = 1 + STRENGTH * rhat * rhat;
        var sxn = cx + dx * factor;
        var syn = cy + dy * factor;
        sxL[idx] = sxn < 0 ? 0 : sxn > W - 1 ? W - 1 : sxn;
        syL[idx] = syn < 0 ? 0 : syn > H - 1 ? H - 1 : syn;
        idx++;
      }
    }
    lut = { sxl: sxL, syl: syL };
  }

  function stampCanvases() {
    var cs = (document.querySelectorAll('canvas'));
    for (var n = 0; n < cs.length; n++) {
      var c = cs[n];
      if (c === canvas) continue;
      var r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      try {
        captureCtx.drawImage(c, r.left * (W / vw), r.top * (H / vh), r.width * (W / vw), r.height * (H / vh));
      } catch (e) {}
    }
  }

  function warp() {
    if (!baseImg || !lut) return;
    captureCanvas.width = W;
    captureCanvas.height = H;
    captureCtx.clearRect(0, 0, W, H);
    captureCtx.drawImage(baseImg, 0, 0, W, H);
    stampCanvases();

    var out = canvas.getContext('2d');
    var src = captureCtx.getImageData(0, 0, W, H).data;
    var target = out.createImageData(W, H);
    var t = target.data;
    var sxl = lut.sxl, syl = lut.syl;
    var i = 0, k = 0;
    for (var y = 0; y < H; y++) {
      for (var x = 0; x < W; x++) {
        var srcIdx = syl[k] * W + sxl[k];
        var si = srcIdx << 2;
        t[i++] = src[si];
        t[i++] = src[si + 1];
        t[i++] = src[si + 2];
        t[i++] = 255;
        k++;
      }
    }
    out.putImageData(target, 0, 0);
    canvas.style.visibility = 'visible';
  }

  function renderStatic() {
    var svg = makeSvg();
    var holder = document.createElement('div');
    holder.style.cssText = 'position:absolute;left:-20000px;top:-20000px;width:' + W + 'px;height:' + H + 'px;overflow:hidden;background:#0b0b0b;';
    holder.appendChild(svg);
    document.body.appendChild(holder);
    var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg));
    var img = new Image();
    img.onload = function () {
      baseImg = img;
      holder.remove();
      warp();
    };
    img.onerror = function () {
      holder.remove();
      canvas.style.visibility = 'hidden';
    };
    img.src = url;
  }

  var schedule = null;
  var MAX_DIM = 900;
  function resize() {
    vw = window.innerWidth;
    vh = window.innerHeight;
    var m = Math.max(vw, vh);
    var scale = m > MAX_DIM ? MAX_DIM / m : 1;
    W = Math.max(2, Math.round(vw * scale));
    H = Math.max(2, Math.round(vh * scale));
    canvas.width = W;
    canvas.height = H;
    baseImg = null;
    buildLUT();
    canvas.style.visibility = 'hidden';
    if (schedule) clearTimeout(schedule);
    schedule = setTimeout(renderStatic, 60);
  }

  window.addEventListener('resize', function () {
    if (schedule) clearTimeout(schedule);
    schedule = setTimeout(resize, 200);
  });

  // Maze moves via keyboard; refresh stamp + warp at a modest rate.
  setInterval(function () {
    if (!document.hidden && baseImg) warp();
  }, 400);

  canvas.style.visibility = 'hidden';
  resize();
})();
