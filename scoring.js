(function (global) {
  'use strict';

  var MAX_RUN_SCORE = 5000;

  // clamp: bounded, and non-finite input yields `min` (never NaN/Infinity).
  function clamp(v, min, max) {
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }

  // safeScore: sanitize a raw value into a valid integer run score 0..5000.
  function safeScore(v) {
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(MAX_RUN_SCORE, Math.round(v)));
  }

  // ---------------- Maze ----------------
  // Difficulty multiplier is deliberately conservative: generation parameters
  // (candidates/bias/braid) are what genuinely make harder difficulties harder,
  // the multiplier only adds a modest reward on top. It still tilts enough that
  // very hard pays meaningfully more than easy (easy 1.10 -> very hard 2.25).
  var MAZE_DIFF_MULT = {
    'very easy': 1.00,
    'easy':      1.10,
    'medium':    1.45,
    'hard':      1.85,
    'very hard': 2.25,
    'insane':    2.45,
    'extreme':   2.65
  };
  var MAZE_BASE_SCORE = 200; // raw reference score for a nominal medium run
  var MAZE_REF_CELLS = 400;   // the default 20x20 maze
  var MAZE_EFF_MIN = 0.25;    // wandering costs up to 75%: accuracy dominates
  var MAZE_EFF_MAX = 1.0;     // perfect path keeps full value
  var MAZE_EFF_POWER = 1.5;   // sub-perfect routes decay non-linearly
  var MAZE_TIME_MIN = 0.75;   // slow finish: -25%
  var MAZE_TIME_MAX = 1.25;   // fast finish: +25%, never infinite

  function mazeScore(cells, diffMult, optimalMoves, actualMoves, elapsedSec) {
    if (!Number.isFinite(cells) || !Number.isFinite(optimalMoves) ||
        !Number.isFinite(actualMoves) || !Number.isFinite(elapsedSec)) return 0;
    var diff = Number.isFinite(diffMult) ? diffMult : MAZE_DIFF_MULT['medium'];
    actualMoves = Math.max(1, Math.round(actualMoves));
    optimalMoves = Math.round(clamp(optimalMoves, 1, actualMoves));

    var sizeMult = 2 / (1 + Math.pow(MAZE_REF_CELLS / Math.max(1, cells), 1.6));
    var effMult = clamp(Math.pow(optimalMoves / actualMoves, MAZE_EFF_POWER), MAZE_EFF_MIN, MAZE_EFF_MAX);
    var refTime = clamp(Math.sqrt(Math.max(1, cells)) * 0.75, 5, 45);
    var timeMult = clamp(refTime / Math.max(elapsedSec, 0.001), MAZE_TIME_MIN, MAZE_TIME_MAX);

    return safeScore(MAZE_BASE_SCORE * diff * sizeMult * effMult * timeMult);
  }

  // ---------------- Target ----------------
  // One run = RUN_TARGETS hits. Waiting is never rewarded: reaction time is
  // measured from a target's appearance to the hit, and accuracy only improves
  // by hitting more targets. Nothing in the formula depends on elapsed session
  // time, so simply keeping the page open cannot raise future scores.
  var RUN_TARGETS = 20;
  var TARGET_BASE_HIT = 20;       // nominal per-hit score at reference speed + perfect acc
  var TARGET_REF_REACTION = 400;  // reference reaction time in ms
  var TARGET_SPEED_MIN = 0.5;     // floor: too slow buys nothing extra
  var TARGET_SPEED_MAX = 1.5;     // ceiling: sub-~267ms reactions gain nothing more
  var TARGET_ACC_MIN = 0.5;       // accuracy factor floor; climbs toward 1.0 as you hit

  // Per-hit score. `hits` is the total hit count INCLUDING the current hit.
  function targetHitScore(reactionMs, hits, misses) {
    if (!Number.isFinite(reactionMs) || !Number.isFinite(hits) || !Number.isFinite(misses)) return 0;
    reactionMs = Math.max(reactionMs, 0);
    var speedMult = clamp(TARGET_REF_REACTION / Math.max(reactionMs, 0.5), TARGET_SPEED_MIN, TARGET_SPEED_MAX);
    var total = Math.max(0, hits) + Math.max(0, misses);
    var frac = total > 0 ? clamp(hits / total, 0, 1) : 0;
    var accMult = TARGET_ACC_MIN + (1 - TARGET_ACC_MIN) * frac; // 0.5..1.0
    var raw = TARGET_BASE_HIT * speedMult * accMult;
    return Number.isFinite(raw) ? raw : 0;
  }

  // Run total: the accumulated raw hit scores, sanitized to 0..5000.
  function targetRunScore(rawRunTotal) {
    return safeScore(rawRunTotal);
  }

  // ---------------- Button ----------------
  // Score grows with hold time on a single saturating curve:
  //   score(t) = 450 * (1 - e^(-0.0428 * t))^2.3     (t in seconds)
  // Fast early gains that taper off; never exceeds 450.
  var BUTTON_SCORE_MAX = 450;
  var BUTTON_SCORE_RATE = 0.0428;
  var BUTTON_SCORE_POWER = 2.3;

  function buttonScore(holdMs) {
    if (!Number.isFinite(holdMs)) return 0;
    var t = Math.max(0, holdMs) / 1000;
    var growth = 1 - Math.exp(-BUTTON_SCORE_RATE * t);
    var raw = BUTTON_SCORE_MAX * Math.pow(growth, BUTTON_SCORE_POWER);
    return Math.max(0, Math.round(raw));
  }

  // ---------------- Cut ----------------
  // You memorize a random closed outline, then reproduce it from memory with a
  // single mouse cut. Accuracy (pixel IoU vs the hidden outline) dominates the
  // score; difficulty adds only a small multiplier on top (how well you traced
  // the shape matters far more than which difficulty you picked); finishing
  // fast adds a small bonus.
  var CUT_ACC_PERFECT = 200;   // accuracy component at 100% IoU (before mult)
  var CUT_ACC_POWER = 2.0;      // accuracy is squared: sub-perfect cuts decay fast
  var CUT_TIME_MAX = 1.05;      // fast finish: +5% max, never more
  var CUT_DIFFS = {
    easy:   { color: '#3b82f6', radius: 90,  verts: 10, harmonics: 3, mult: 1.00 },
    normal: { color: '#22c55e', radius: 110, verts: 13, harmonics: 4, mult: 1.06 },
    hard:   { color: '#eab308', radius: 130, verts: 16, harmonics: 5, mult: 1.12 },
    harder: { color: '#f97316', radius: 150, verts: 20, harmonics: 6, mult: 1.20 },
    insane: { color: '#ec4899', radius: 170, verts: 27, harmonics: 7, mult: 1.30 }
  };
  var CUT_REF_TIME = { easy: 15, normal: 18, hard: 22, harder: 26, insane: 32 };

  // iou in [0,1]: intersection/union of the cut silhouette vs the target outline.
  function cutScore(accuracy, difficulty, elapsedSec) {
    if (!Number.isFinite(accuracy) || !Number.isFinite(elapsedSec)) return 0;
    var diff = CUT_DIFFS[difficulty] || CUT_DIFFS.easy;
    var iou = clamp(accuracy, 0, 1);
    var timeMult = clamp(CUT_REF_TIME[difficulty] / Math.max(elapsedSec, 0.001), 1, CUT_TIME_MAX);
    var accComp = CUT_ACC_PERFECT * Math.pow(iou, CUT_ACC_POWER);
    return safeScore(Math.round(accComp * diff.mult * timeMult));
  }

  // ---------------- Circle ----------------
  // Freehand "perfect circle" (inspired by neal.fun/perfect-circle): you draw a
  // circle from scratch and it finishes when the stroke returns to its start.
  // Accuracy (circularity) is the dominant term (cubed), coverage is the
  // fraction of a full loop actually drawn, and time is only a modest swing
  // between -15% and +15%. No hard errors in this game.
  var CIRCLE_ACC_PERFECT = 240;  // accuracy term at 100% (full coverage too)
  var CIRCLE_ACC_POWER = 3.0;    // accuracy is cubed: wobble hurts fast
  var CIRCLE_REF_TIME = 7.0;     // seconds that earn the neutral time mult
  var CIRCLE_TIME_MIN = 0.85;    // slowest acceptable finish: -15%
  var CIRCLE_TIME_MAX = 1.15;    // fastest finish: +15%

  // accuracy in [0,1] (circularity), coverage in [0,1] (fraction of a full loop
  // drawn), elapsedSec > 0.
  function circleScore(accuracy, coverage, elapsedSec) {
    if (!Number.isFinite(accuracy) || !Number.isFinite(coverage) || !Number.isFinite(elapsedSec)) return 0;
    var acc = clamp(accuracy, 0, 1);
    var cov = clamp(coverage, 0, 1);
    var timeMult = clamp(CIRCLE_REF_TIME / Math.max(elapsedSec, 0.001), CIRCLE_TIME_MIN, CIRCLE_TIME_MAX);
    var accComp = CIRCLE_ACC_PERFECT * Math.pow(acc, CIRCLE_ACC_POWER);
    return safeScore(Math.round(accComp * cov * timeMult));
  }

  function det3(m) {
    return m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
         - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
         + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
  }

  // Least-squares circle center via the Kasa algebraic fit (minimizes the
  // implicit equation sum((x-cx)^2+(y-cy)^2-R^2)^2) on mean-centred points.
  // The point-centroid (what naive fits use) is biased toward the densest part
  // of the stroke; the Kasa fit recovers the true center. Falls back to the
  // centroid if the system is degenerate (short arcs).
  function circleCenter(pts) {
    var n = pts.length;
    var rx = 0, ry = 0;
    for (var i = 0; i < n; i++) { rx += pts[i][0]; ry += pts[i][1]; }
    var mx = rx / n, my = ry / n;
    var sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0, sx3 = 0, sy3 = 0, sxy2 = 0, sx2y = 0;
    for (i = 0; i < n; i++) {
      var x = pts[i][0] - mx, y = pts[i][1] - my;
      sx += x; sy += y;
      sxx += x * x; syy += y * y; sxy += x * y;
      sx3 += x * x * x; sy3 += y * y * y; sxy2 += x * y * y; sx2y += x * x * y;
    }
    var M = [[sxx, sxy, sx], [sxy, syy, sy], [sx, sy, n]];
    var v = [sx3 + sxy2, sx2y + sy3, sxx + syy];
    var det = det3(M); // exact n is intended; centred point sums: sx=0, sy=0
    if (Math.abs(det) < 1e-9) return { cx: mx, cy: my };
    var a = det3([
      [v[0], M[0][1], M[0][2]],
      [v[1], M[1][1], M[1][2]],
      [v[2], M[2][1], M[2][2]]
    ]) / det;
    var b = det3([
      [M[0][0], v[0], M[0][2]],
      [M[1][0], v[1], M[1][2]],
      [M[2][0], v[2], M[2][2]]
    ]) / det;
    return { cx: mx + a / 2, cy: my + b / 2 };
  }

  // Fit a circle to the stroke and grade it:
//  - center: a fixed anchor ({cx,cy}) if provided, otherwise the Kasa
//    least-squares fit (robust to uneven point density)
//  - accuracy = 1 - RMS relative radial deviation measured per point around
//    that center (R = mean radius), harsh on wobble, ellipses and off-center
//    circles when an anchor is given
//  - coverage = 1 - longest run of empty angular bins / 360: measures the true
//    sweep of the loop around the center, independent of sample density
// points: array of [x, y], fixed: {cx, cy} | undefined. Returns null for
// degenerate inputs.
  function circleFit(points, fixed) {
    if (!Array.isArray(points) || points.length < 4) return null;
    var c = (fixed && Number.isFinite(fixed.cx) && Number.isFinite(fixed.cy))
      ? { cx: fixed.cx, cy: fixed.cy }
      : circleCenter(points);
    var BINS = 360;
    var bins = new Array(BINS).fill(0);
    var sumR = 0, sq = 0;
    for (var i = 0; i < points.length; i++) {
      var x = points[i][0], y = points[i][1];
      var th = Math.atan2(y - c.cy, x - c.cx);
      if (th < 0) th += 2 * Math.PI;
      bins[Math.min(BINS - 1, Math.floor(th * BINS / (2 * Math.PI)))] = 1;
      var d = Math.hypot(x - c.cx, y - c.cy);
      sumR += d;
    }
    var R = sumR / points.length;
    if (!(R > 1e-5)) return null;
    for (i = 0; i < points.length; i++) {
      var d = Math.hypot(points[i][0] - c.cx, points[i][1] - c.cy);
      var rel = (d - R) / R;
      sq += rel * rel;
    }
    var maxGap = 0, run = 0;
    for (var b = 0; b < BINS; b++) {
      if (bins[b]) { if (run > maxGap) maxGap = run; run = 0; }
      else run++;
    }
    if (run > maxGap) maxGap = run;
    var wrap = 0;
    for (b = 0; b < BINS; b++) {
      if (bins[b]) break;
      wrap++;
    }
    var tail = 0;
    for (b = BINS - 1; b >= 0; b--) {
      if (bins[b]) break;
      tail++;
    }
    if (wrap + tail > maxGap) maxGap = wrap + tail;
    return {
      cx: c.cx,
      cy: c.cy,
      R: R,
      accuracy: Math.max(0, Math.min(1, 1 - Math.sqrt(sq / points.length))),
      coverage: Math.max(0, Math.min(1, 1 - maxGap / BINS))
    };
  }

  global.Scoring = {
    MAX_RUN_SCORE: MAX_RUN_SCORE,
    clamp: clamp,
    safeScore: safeScore,
    mazeScore: mazeScore,
    MAZE_DIFF_MULT: MAZE_DIFF_MULT,
    targetHitScore: targetHitScore,
    targetRunScore: targetRunScore,
    RUN_TARGETS: RUN_TARGETS,
    TARGET_REF_REACTION: TARGET_REF_REACTION,
    TARGET_SPEED_MAX: TARGET_SPEED_MAX,
    buttonScore: buttonScore,
    cutScore: cutScore,
    CUT_DIFFS: CUT_DIFFS,
    CUT_REF_TIME: CUT_REF_TIME,
    CUT_ACC_PERFECT: CUT_ACC_PERFECT,
    CUT_ACC_POWER: CUT_ACC_POWER,
    circleScore: circleScore,
    circleFit: circleFit,
    CIRCLE_ACC_PERFECT: CIRCLE_ACC_PERFECT,
    CIRCLE_ACC_POWER: CIRCLE_ACC_POWER,
    CIRCLE_REF_TIME: CIRCLE_REF_TIME,
    CIRCLE_TIME_MIN: CIRCLE_TIME_MIN,
    CIRCLE_TIME_MAX: CIRCLE_TIME_MAX
  };
})(typeof window !== 'undefined' ? window : globalThis);