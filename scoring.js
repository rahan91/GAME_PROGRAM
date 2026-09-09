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
  // Freehand "perfect circle" (inspired by neal.fun/perfect-circle) against the
  // on-screen guide ring: you trace the ring, center it on the dot, and the run
  // finishes when the stroke returns to its start.
  //  - accuracy is the dominant term (cubed) and is the PRODUCT of two parts:
  //      * circularity — how constant the radius is (mean absolute radial
  //        deviation around the center), amplified so quality spreads out
  //      * size      — how well the mean radius matches the guide ring radius
  //  - coverage is the fraction of the loop actually drawn
  //  - time is only a modest swing between -15% and +15%. No hard errors.
  var CIRCLE_ACC_PERFECT = 240;  // accuracy term at 100% (full coverage too)
  var CIRCLE_ACC_POWER = 3.0;    // accuracy is cubed: wobble hurts fast
  var CIRCLE_ACC_K = 2.5;        // circularity calibration: score drops 2.5x
                                 // faster than the raw radial error, matching
                                 // how an eye judges a hand-drawn circle
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

  // Fit a circle to the stroke and grade it:
//  - center: a fixed anchor ({cx,cy}) if provided (the on-screen dot), otherwise
//    the vendored circle-fit module's least-squares fit
//  - accuracy = circularity in [0,1]:
//      circularity = 1 - CIRCLE_ACC_K * mean(|d_i - R| / R): average radial
//      error about the center, amplified by CIRCLE_ACC_K so a slightly wobbly
//      or off-center stroke reads visibly worse than a clean one
//  - coverage = 1 - longest run of empty angular bins / 360: measures the true
//    sweep of the loop around the center, independent of sample density
// points: array of [x, y], anchor: {cx, cy} | undefined. Returns null for
// degenerate inputs.
  function circleFit(points, anchor) {
    if (!Array.isArray(points) || points.length < 4) return null;
    var n = points.length;
    var cx, cy, R, errs;
    var anchored = !!(anchor && Number.isFinite(anchor.cx) && Number.isFinite(anchor.cy));
    if (anchored) {
      cx = anchor.cx; cy = anchor.cy;
      R = 0;
      errs = new Array(n);
      for (var i = 0; i < n; i++) {
        var d0 = Math.hypot(points[i][0] - cx, points[i][1] - cy);
        R += d0;
        errs[i] = d0;
      }
      R /= n;
      for (i = 0; i < n; i++) errs[i] = errs[i] - R;   // deviations d_i - R
    } else {
      var fit = (typeof Circlefit !== 'undefined' && Circlefit.compute) ? Circlefit.compute(points) : null;
      if (!fit || !fit.success) return null;
      cx = fit.center.x; cy = fit.center.y; R = fit.radius;
      errs = fit.distances;
    }
    if (!(R > 1e-5)) return null;
    var arre = 0;
    for (i = 0; i < n; i++) arre += Math.abs(errs[i] / R);
    arre /= n;
    var accuracy = clamp(1 - CIRCLE_ACC_K * arre, 0, 1);
    var BINS = 360;
    var bins = new Array(BINS).fill(0);
    for (i = 0; i < n; i++) {
      var th = Math.atan2(points[i][1] - cy, points[i][0] - cx);
      if (th < 0) th += 2 * Math.PI;
      bins[Math.min(BINS - 1, Math.floor(th * BINS / (2 * Math.PI)))] = 1;
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
      cx: cx,
      cy: cy,
      R: R,
      accuracy: accuracy,
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
    CIRCLE_ACC_K: CIRCLE_ACC_K,
    CIRCLE_REF_TIME: CIRCLE_REF_TIME,
    CIRCLE_TIME_MIN: CIRCLE_TIME_MIN,
    CIRCLE_TIME_MAX: CIRCLE_TIME_MAX
  };
})(typeof window !== 'undefined' ? window : globalThis);