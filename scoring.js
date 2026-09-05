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
  // the multiplier only adds a modest reward on top.
  var MAZE_DIFF_MULT = {
    'very easy': 1.00,
    'easy':      1.20,
    'medium':    1.45,
    'hard':      1.75,
    'very hard': 2.05,
    'insane':    2.30,
    'extreme':   2.50
  };
  var MAZE_BASE_SCORE = 2000; // raw reference score for a nominal medium run
  var MAZE_REF_CELLS = 400;   // the default 20x20 maze
  var MAZE_SIZE_MIN = 0.6;
  var MAZE_SIZE_MAX = 1.6;    // diminishing returns: sqrt(cells / 400)
  var MAZE_EFF_MIN = 0.5;     // wandering costs up to half
  var MAZE_EFF_MAX = 1.0;     // perfect path keeps full value
  var MAZE_TIME_MIN = 0.75;   // slow finish: -25%
  var MAZE_TIME_MAX = 1.25;   // fast finish: +25%, never infinite

  function mazeScore(cells, diffMult, optimalMoves, actualMoves, elapsedSec) {
    if (!Number.isFinite(cells) || !Number.isFinite(optimalMoves) ||
        !Number.isFinite(actualMoves) || !Number.isFinite(elapsedSec)) return 0;
    var diff = Number.isFinite(diffMult) ? diffMult : MAZE_DIFF_MULT['medium'];
    actualMoves = Math.max(1, Math.round(actualMoves));
    optimalMoves = Math.round(clamp(optimalMoves, 1, actualMoves));

    var sizeMult = clamp(Math.sqrt(Math.max(1, cells) / MAZE_REF_CELLS), MAZE_SIZE_MIN, MAZE_SIZE_MAX);
    var effMult = clamp(optimalMoves / actualMoves, MAZE_EFF_MIN, MAZE_EFF_MAX);
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
  var TARGET_BASE_HIT = 130;      // nominal per-hit score at reference speed + perfect acc
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
    TARGET_SPEED_MAX: TARGET_SPEED_MAX
  };
})(typeof window !== 'undefined' ? window : globalThis);