import { readFileSync } from 'fs';
import vm from 'vm';

const ctx = { console };
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../vendor/circle-fit.js', import.meta.url), 'utf8'), ctx);
vm.runInContext(readFileSync(new URL('../scoring.js', import.meta.url), 'utf8'), ctx);
const S = ctx.Scoring;

let failures = 0;
let checks = 0;
function assert(cond, msg) {
  checks++;
  if (cond) console.log('  ok  - ' + msg);
  else { failures++; console.log('  FAIL - ' + msg); }
}
function between(v, lo, hi, msg) {
  assert(typeof v === 'number' && v >= lo && v <= hi, msg + ' (got ' + v + ')');
}

const stickler = S.mazeScore;
const hit = S.targetHitScore;

console.log('\n=== Maze scoring ===');
const DIFFS = ['very easy', 'easy', 'medium', 'hard', 'very hard', 'insane', 'extreme'];
for (const d of DIFFS) {
  const sc = stickler(400, S.MAZE_DIFF_MULT[d], 28, 30, 15);
  between(sc, 0, 5000, 'maze @ ' + d + ' bounded 0..5000');
}
assert(stickler(400, S.MAZE_DIFF_MULT.extreme, 28, 30, 15) > stickler(400, S.MAZE_DIFF_MULT['very easy'], 28, 30, 15), 'extreme > very easy');
assert(S.MAZE_DIFF_MULT.extreme / S.MAZE_DIFF_MULT['very easy'] < 3, 'difficulty ratio not 10x');
assert(stickler(400, S.MAZE_DIFF_MULT.extreme, 28, 30, 15) < 5 * stickler(400, S.MAZE_DIFF_MULT['very easy'], 28, 30, 15) + 1, 'extreme does not 5x even very easy');
between(stickler(25, 1.2, 6, 20, 30), 0, 5000, 'small 5x5 maze bounded');
between(stickler(6400, 2.5, 160, 160, 45), 0, 5000, 'large 80x80 maze bounded');
assert(stickler(400, 1.45, 28, 28, 15) === 290, 'perfect 20x20 run unchanged (size=1, eff=1)');
assert(stickler(25, 1.45, 5, 5, 15) < 30, 'tiny 5x5 maze earns almost nothing');
assert(stickler(6400, 1.45, 160, 160, 120) > 400, 'large 80x80 pays well above a 20x20');
assert(stickler(6400, 1.45, 160, 160, 120) < 5000, 'large maze still bounded');
assert(stickler(400, 1.45, 28, 56, 15) < 0.6 * stickler(400, 1.45, 28, 28, 15), '50% accuracy costs more than 40% (big accuracy effect)');
assert(stickler(400, 1.45, 28, 100000, 15) === stickler(400, 1.45, 28, 280, 15), 'accuracy floor keeps lazy runs bounded');
assert(stickler(400, 1.45, 28, 28, 15) > stickler(400, 1.45, 28, 112, 15), 'perfect route beats wandering');
assert(stickler(400, 1.45, 28, 280, 15) >= stickler(400, 1.45, 28, 100000, 15), 'efficiency floor keeps lazy runs bounded');
assert(stickler(400, 1.45, 28, 30, 2) >= stickler(400, 1.45, 28, 30, 200), 'fast completion beats slow');
assert(stickler(400, 1.45, 28, 30, 0.000001) <= 5000, 'near-instant time cannot explode score');
assert(stickler(NaN, 1.45, 28, 30, 15) === 0, 'NaN cells -> 0');
assert(stickler(400, 1.45, 28, 30, NaN) === 0, 'NaN time -> 0');
assert(stickler(400, NaN, 28, 30, 15) > 0, 'NaN difficulty falls back to medium');
assert(stickler(400, 1.45, -5, 3, 15) >= 0, 'negative optimal handled safely');
assert(stickler(400, 1.45, 0, 0, 15) === 0 || stickler(400, 1.45, 0, 0, 15) >= 0, 'zero moves handled safely');
assert(stickler(Infinity, 1.45, 28, 30, 15) === 0, 'Infinity cells -> 0');

console.log('\n=== Target scoring ===');
assert(hit(400, 1, 0) > 0, 'first hit of a run scores points (no inconsistent free hit)');
assert(hit(300, 1, 0) > hit(400, 1, 0), 'faster reaction scores more');
assert(hit(1, 1, 0) === hit(0, 1, 0) && hit(1, 1, 0) <= 5000, 'instant/zero reaction bounded');
assert(hit(100000, 1, 0) === hit(800, 1, 0), 'slow reaction hits the floor (waiting buys nothing)');
assert(hit(100000, 1, 0) === hit(2000000, 1, 0), 'waiting longer produces identical score');
assert(hit(NaN, 1, 0) === 0, 'NaN reaction -> 0');
assert(hit(Infinity, 1, 0) === 0, 'Infinity reaction -> 0');
assert(hit(-5, 1, 0) > 0 && hit(-5, 1, 0) <= 5000, 'negative reaction clamped safe');
assert(hit(400, 20, 0) > hit(400, 20, 5) && hit(400, 20, 5) > hit(400, 20, 20), 'higher accuracy scores more');
assert(hit(400, 1, 1000) >= hit(400, 1, 0) * 0.5 - 0.001, 'accuracy floor does not wipe a run');
assert(hit(400, 20, 0) <= 5000, 'single hit bounded');
between(S.targetRunScore(999999999), 0, 5000, 'huge run total capped at 5000');
assert(S.targetRunScore(NaN) === 0, 'NaN run -> 0');
assert(S.targetRunScore(-50) === 0, 'negative run -> 0');

let perfectRun = 0;
for (let i = 1; i <= S.RUN_TARGETS; i++) perfectRun += hit(30, i, 0);
between(S.targetRunScore(perfectRun), 550, 700, 'perfect blazing 20-hit run scores well below 4 digits');
let slowRun = 0;
for (let i = 1; i <= S.RUN_TARGETS; i++) slowRun += hit(700, i, 4);
between(S.targetRunScore(slowRun), 0, 2500, 'slow/mediocre run stays moderate');

console.log('\n=== No waiting exploit ===');
// Identical performance, but the second profile waits 60s between hits.
// Because reaction time is measured from target appearance -> hit, all that
// changes is a slower reaction (which is already floored), never extra score.
function runWith(reactionMs, missesTotal) {
  let total = 0;
  for (let i = 1; i <= S.RUN_TARGETS; i++) total += hit(reactionMs, i, missesTotal);
  return S.targetRunScore(total);
}
assert(runWith(400, 2) === runWith(400, 2), 'baseline stable');
assert(runWith(100000, 2) === runWith(800, 2), 'waiting simply floors reaction speed - no extra score');
assert(S.targetRunScore(perfectRun + (1e9)) <= 5000, 'adding waiting time cannot raise a run');

console.log('\n=== Button scoring ===');
const btn = S.buttonScore;
// score(t) = 450 * (1 - e^(-0.0428t))^2.3   (t in seconds held)
assert(btn(0) === 0, 'zero hold scores nothing');
assert(btn(5000) === 10, '5s hold = 10');
assert(btn(10000) === 40, '10s hold = 40');
assert(btn(30000) === 213, '30s hold = 213');
assert(btn(60000) === 375, '60s hold = 375');
assert(btn(90000) === 428, '90s hold = 428');
assert(btn(120000) === 444, '120s hold = 444');
assert(btn(180000) === 450, '180s hold = 450 (asymptote)');
assert(btn(300000) === 450, '300s hold = 450 (never exceeds cap)');
assert(btn(600000) === 450, '600s hold still capped at 450');
assert(btn(20000) > btn(10000), 'longer hold scores more');
assert(btn(120000) < 450, 'still just below the cap at 2m');
assert(btn(NaN) === 0, 'NaN hold -> 0');
assert(btn(-50) === 0, 'negative hold -> 0');
assert(btn(Infinity) === 0, 'infinite hold -> 0 (non-finite sanitized)');

console.log('\n=== Calibration comparison ===');
function mazeRepr(label, cells, diff, optimal, actual, time) {
  const sc = stickler(cells, S.MAZE_DIFF_MULT[diff], optimal, actual, time);
  console.log('  ' + label.padEnd(14) + ' maze: ' + String(sc).padStart(5));
}
function tgtRepr(label, reaction, misses) {
  let total = 0;
  for (let i = 1; i <= S.RUN_TARGETS; i++) total += hit(reaction, i, misses);
  console.log('  ' + label.padEnd(14) + ' target: ' + String(S.targetRunScore(total)).padStart(5));
}
mazeRepr('poor', 100, 'easy', 10, 40, 120);
mazeRepr('average', 400, 'medium', 28, 34, 30);
mazeRepr('excellent', 400, 'hard', 28, 30, 18);
mazeRepr('exceptional', 400, 'extreme', 28, 28, 8);
tgtRepr('poor', 700, 8);
tgtRepr('average', 450, 3);
tgtRepr('excellent', 350, 1);
tgtRepr('exceptional', 220, 0);
function btnRepr(label, holdMs) {
  console.log('  ' + label.padEnd(14) + ' button: ' + String(S.buttonScore(holdMs)).padStart(5));
}
btnRepr('hold 10s', 10000);
btnRepr('hold 30s', 30000);
btnRepr('hold 60s', 60000);
btnRepr('hold 2m', 120000);
btnRepr('hold 5m', 300000);

console.log('\n=== Cut scoring ===');
const cut = S.cutScore;
const CUT_DIFFS = ['easy', 'normal', 'hard', 'harder', 'insane'];
assert(cut(1, 'easy', 10) === 210, 'perfect easy fast = accuracy weight + 5% time bonus');
assert(cut(1, 'easy', 999) === 200, 'perfect easy slow = exactly the accuracy weight (no time bonus)');
assert(cut(1, 'easy', 1000) === 200, 'perfect easy capped at the accuracy weight floor');
between(cut(1, 'easy', 10), 0, 5000, 'perfect easy bounded 0..5000');
assert(cut(1, 'insane', 10) === 273, 'perfect insane fast = 200 * 1.30 * 1.05 (no 5000 cap needed)');
assert(cut(1, 'insane', 999) === 260, 'perfect insane slow = 200 * 1.30');
assert(cut(0.9, 'easy', 10) > cut(0.5, 'easy', 10), 'higher accuracy scores more (easy)');
assert(cut(0.9, 'hard', 10) > cut(0.9, 'easy', 10), 'hard > easy at equal accuracy');
assert(cut(0.9, 'insane', 10) > cut(0.9, 'hard', 10), 'insane > hard at equal accuracy');
assert(cut(0.9, 'easy', 5) >= cut(0.9, 'easy', 30), 'fast cut >= slow cut (same difficulty)');
assert(cut(0.9, 'easy', 999) === Math.round(S.CUT_ACC_PERFECT * Math.pow(0.9, S.CUT_ACC_POWER)), 'slow cut never scored below the accuracy component');
assert(cut(2, 'easy', 999) === cut(1, 'easy', 999), 'accuracy above 1 clamps to perfect');
assert(cut(0, 'easy', 10) === 0, 'zero accuracy = 0');
assert(cut(-1, 'easy', 10) === 0, 'negative accuracy clamps to 0');
assert(cut(NaN, 'easy', 10) === 0, 'NaN accuracy -> 0');
assert(cut(0.5, 'bogus', 999) === cut(0.5, 'easy', 999), 'unknown difficulty falls back to easy');
assert(cut(0.5, 'easy', Infinity) === 0, 'infinite elapsed is non-finite -> 0 (sanitized)');
assert(cut(0.5, 'easy', -5) === cut(0.5, 'easy', 10), 'negative elapsed behaves like a fast time');
assert(S.CUT_DIFFS.hard.mult > S.CUT_DIFFS.normal.mult, 'mult increases with difficulty');
assert(S.CUT_DIFFS.insane.mult === 1.30, 'insane multiplier flattened to 1.30');
assert((cut(1, 'insane', 999) - cut(1, 'easy', 999)) < (cut(1, 'easy', 999) - cut(0.5, 'easy', 999)), 'accuracy affects score more than difficulty');
assert(S.CUT_DIFFS.insane.radius > S.CUT_DIFFS.easy.radius, 'insane fits the "more grand" rule');
assert(S.CUT_DIFFS.insane.harmonics > S.CUT_DIFFS.easy.harmonics, 'insane fits the "more complex" rule');
assert(S.CUT_DIFFS.easy.color === '#3b82f6' && S.CUT_DIFFS.normal.color === '#22c55e' && S.CUT_DIFFS.hard.color === '#eab308', 'easy/normal/hard colors (blue/green/yellow)');
assert(S.CUT_DIFFS.harder.color === '#f97316' && S.CUT_DIFFS.insane.color === '#ec4899', 'harder/insane colors (orange/pink)');

console.log('\n=== Circle scoring ===');
const circ = S.circleScore;
assert(circ(1, 1, 7) === 240, 'perfect full cover at ref time = accuracy weight (240)');
assert(circ(1, 1, 0.1) === 276, 'perfect full cover fastest = 240 * 1.15');
assert(circ(1, 1, 999) === 204, 'perfect full cover slowest = 240 * 0.85');
assert(circ(1, 0.5, 7) === 120, 'half coverage halves the score');
assert(circ(1, 0, 7) === 0, 'no coverage = 0');
assert(circ(1, -1, 7) === 0, 'negative coverage clamps to 0');
assert(circ(1, 2, 7) === 240, 'coverage above 1 clamps to perfect');
assert(circ(0.9, 1, 7) === Math.round(S.CIRCLE_ACC_PERFECT * Math.pow(0.9, S.CIRCLE_ACC_POWER)), 'slow 90% = accuracy component');
assert(circ(0.9, 1, 7) > circ(0.5, 1, 7), 'higher accuracy scores more');
assert(circ(0.95, 1, 7) > circ(1, 0.5, 7), 'accuracy dominates over coverage at the same score scale');
assert(circ(0, 1, 7) === 0, 'zero accuracy = 0');
assert(circ(-1, 1, 7) === 0, 'negative accuracy clamps to 0');
assert(circ(NaN, 1, 7) === 0, 'NaN accuracy -> 0');
assert(circ(1, 1, Infinity) === 0, 'infinite elapsed is non-finite -> 0 (sanitized)');
between(circ(1, 1, 0.1), 0, 5000, 'perfect circle bounded 0..5000');
assert(circ(0.9, 1, 7) > circ(0.85, 1, 7) * 1.18, 'cubed accuracy keeps 90% clearly worth more than 85%');

console.log('\n=== Circle geometry ===');
function sampleCircle(cx, cy, r, n, jitter) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI;
    const jx = (Math.random() * 2 - 1) * jitter;
    const jy = (Math.random() * 2 - 1) * jitter;
    pts.push([cx + (r + jx) * Math.cos(a), cy + (r + jy) * Math.sin(a)]);
  }
  return pts;
}
// a human-style trace of the ring at (320,320): radial wobble + slight offset
function traceRing(r, n, jitter, offX, offY) {
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI;
    const jx = (Math.random() * 2 - 1) * jitter;
    const jy = (Math.random() * 2 - 1) * jitter;
    pts.push([320 + offX + (r + jx) * Math.cos(a), 320 + offY + (r + jy) * Math.sin(a)]);
  }
  return pts;
}
const cf = S.circleFit;
{
  const pts = sampleCircle(200, 150, 100, 400, 0);
  const fit = cf(pts);
  assert(!!fit, 'circleFit returns a fit for a valid circle');
  assert(Math.abs(fit.cx - 200) < 0.5 && Math.abs(fit.cy - 150) < 0.5, 'Kasa fit recovers the true center (within 0.5px)');
  assert(Math.abs(fit.R - 100) < 1, 'radius recovered within 1px');
  assert(fit.accuracy > 0.995, 'perfect circle scores ~100% circularity');
  assert(fit.coverage > 0.99, 'perfect circle covers the full loop');
}
{
  // density bias: tons of points in one quadrant must not drag the center
  const pts = sampleCircle(320, 320, 180, 60, 0);
  for (let i = 0; i < 320; i++) {
    const a = Math.PI / 2 * Math.random() * 0.9; // dense first quadrant
    pts.push([320 + 180 * Math.cos(a), 320 + 180 * Math.sin(a)]);
  }
  const fit = cf(pts);
  assert(Math.abs(fit.cx - 320) < 4 && Math.abs(fit.cy - 320) < 4, 'center still found despite 5x density in one quadrant');
}
{
  const ellipse = [];
  for (let i = 0; i < 400; i++) {
    const a = i / 400 * 2 * Math.PI;
    ellipse.push([0 + 200 * Math.cos(a), 0 + 90 * Math.sin(a)]);
  }
  const fit = cf(ellipse);
  assert(fit.accuracy < 0.6 && fit.accuracy > 0.3, 'a 2.2:1 ellipse is graded harshly (well below a circle)');
}
{
  const wobble18 = sampleCircle(100, 100, 120, 300, 18);
  const f18 = cf(wobble18);
  assert(f18.accuracy < 0.95 && f18.coverage > 0.9, '18px radial wobble drops accuracy yet keeps full-loop coverage');
  const wobble30 = sampleCircle(100, 100, 120, 300, 30);
  const f30 = cf(wobble30);
  assert(f30.accuracy < 0.9, 'bigger wobble drops accuracy further');
}
{
  const half = [];
  for (let i = 0; i < 200; i++) {
    const a = i / 199 * Math.PI; // exactly 180deg arc
    half.push([0 + 150 * Math.cos(a), 0 + 150 * Math.sin(a)]);
  }
  const fit = cf(half);
  assert(fit.coverage >= 0.48 && fit.coverage <= 0.53, 'a half-loop reports ~50% coverage');
}
{
  // fixed anchor center: a perfect circle centered on the dot is perfect
  const anchor = { cx: 320, cy: 320 };
  const ok = sampleCircle(320, 320, 150, 360, 0);
  const f0 = cf(ok, anchor);
  assert(f0.accuracy > 0.995 && f0.coverage > 0.99, 'anchored perfect circle scores ~100%');
  // same circle drawn off the dot is punished
  const off = sampleCircle(320 + 25, 320 + 25, 150, 360, 0);
  const f1 = cf(off, anchor);
  assert(f1.accuracy < 0.75, 'anchored circle offset 25px from the dot drops accuracy hard');
  assert(f1.accuracy > 0.5, 'a 25px offset is bad but not perfectly-doomed');
  const okOff = sampleCircle(320 + 8, 320 + 8, 150, 360, 0);
  assert(cf(okOff, anchor).accuracy > 0.8, 'a small 8px offset stays in the 80s');
  // a loop that does not enclose the dot cannot cover the full sweep
  const tangent = sampleCircle(320 + 150, 320, 150, 360, 0);
  const f2 = cf(tangent, anchor);
  assert(f2.coverage <= 0.55, 'a loop that misses the dot reports low coverage around it');
  // the Kasa path still works when no anchor is given
  const free = sampleCircle(200, 150, 100, 400, 0);
  const f3 = cf(free);
  assert(f3.accuracy > 0.995, 'unanchored fit still recovers a perfect circle');
}
{
  // guide-ring accuracy: only circularity around the dot matters; size is free
  const guide = { cx: 320, cy: 320 };
  const big = sampleCircle(320, 320, 220, 400, 0);
  const fB = cf(big, guide);
  assert(fB.accuracy > 0.995, 'perfect circle on the guide ring is ~100%');
  const tiny = sampleCircle(320, 320, 120, 400, 0);
  const fT = cf(tiny, guide);
  assert(fT.accuracy > 0.995, 'a perfectly round tiny circle is ~100%');
  const huge = sampleCircle(320, 320, 330, 400, 0);
  const fH = cf(huge, guide);
  assert(fH.accuracy > 0.995, 'a perfectly round huge circle is ~100%');
  const good = traceRing(220, 400, 7, 8, 12);
  const fG = cf(good, guide);
  assert(fG.accuracy > 0.8 && fG.accuracy < 0.96, 'clean trace on the ring sits in the high 80s-90s');
  const sloppy = traceRing(220, 400, 22, 25, 18);
  const fS = cf(sloppy, guide);
  assert(fS.accuracy < 0.8, 'sloppy wobble + off-center reads clearly worse than good');
}

console.log('\n' + (failures === 0 ? 'ALL ' + checks + ' CHECKS PASSED' : failures + ' OF ' + checks + ' CHECKS FAILED'));
process.exit(failures === 0 ? 0 : 1);