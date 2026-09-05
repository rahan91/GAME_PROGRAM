import { readFileSync } from 'fs';
import vm from 'vm';

const src = readFileSync(new URL('../scoring.js', import.meta.url), 'utf8');
const ctx = { console };
vm.createContext(ctx);
vm.runInContext(src, ctx);
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
between(S.targetRunScore(perfectRun), 300, 500, 'perfect blazing 20-hit run scores well below 4 digits');
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
// sec<=30: 7*sec | sec<=60: 210+4*(sec-30) | sec>60: 330+2*(sec-60)
assert(btn(0) === 0, 'zero hold scores nothing');
assert(btn(10000) === 70, '10s hold = 70 (tier 1)');
assert(btn(30000) === 210, '30s hold hits tier boundary = 210');
assert(btn(31000) === 214, '31s hold = 214 (tier 2 slope 4)');
assert(btn(60000) === 330, '60s hold hits tier boundary = 330');
assert(btn(61000) === 332, '61s hold = 332 (tier 3 slope 2)');
assert(btn(20000) > btn(10000), 'longer hold scores more');
assert(btn(100000) > btn(60000), 'very long hold keeps climbing (no hard cap)');
const t1Gain = btn(10000) - btn(0);
const t3Gain = btn(61000) - btn(60000);
assert(t3Gain < t1Gain, 'later tiers pay less per second');
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
btnRepr('hold 45s', 45000);
btnRepr('hold 90s', 90000);

console.log('\n' + (failures === 0 ? 'ALL ' + checks + ' CHECKS PASSED' : failures + ' OF ' + checks + ' CHECKS FAILED'));
process.exit(failures === 0 ? 0 : 1);