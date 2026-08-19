/**
 * buildChartSpecs — derive the preflop range-chart specs from the corpus, for one villain.
 *
 * WHY THIS FILE EXISTS. `buildRangeCharts.mjs` reads `.tmp-arch/chart-specs.json` and nothing
 * in the repo wrote it: the specs were hand-assembled in a session and the file was left
 * behind. So the charts could be re-rendered but never re-derived, and every k/n on them was
 * a number a person had typed. That is precisely the "doing it off the cuff" the procedure was
 * built to end — the charts sat outside the one command that runs the same steps every time.
 *
 * WHAT A SPEC IS. One entry type: the times he took it (k), the times he could have (n), the
 * equity ordering to fill the assumed composition with, a conventional chart to contrast
 * against, and every hand he was ever caught holding while taking it.
 *
 * THE DENOMINATOR IS THE WHOLE CLAIM AND IT IS EASY TO GET WRONG, so each is stated here in
 * words as well as code:
 *
 *   open-<POS>   n = he is first in at that seat and could raise. k = he raised.
 *   iso          n = at least one limper, no raise yet.        k = he raised.
 *   3bet         n = exactly one raise stands in front of him. k = he raised.
 *   call-raise   n = exactly one raise stands in front of him. k = he called.
 *   bb-free      n = he is the big blind and no raise came.    k = he checked.
 *
 * POSITION IS SPLIT BY TABLE SIZE. `open-UTG` at five-handed and at six-handed are different
 * spots — different fields behind — and pooling them is the collision `positionOf` was fixed
 * for. A spec that pools them would put the bug back one layer up, where no gate is watching.
 *
 * Run:  VILLAIN=<id> node scripts/villainArchetype/buildChartSpecs.mjs
 * Then: node scripts/villainArchetype/buildRangeCharts.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 2000);
const TARGET = process.env.VILLAIN || null;
const RANK = Number(process.env.RANK || 1);
const OUT = process.env.OUT || '.tmp-arch/chart-specs.json';

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

// Two passes, for the same reason profileVillain uses them: retaining the corpus is a 4GB OOM.
let pid = TARGET;
if (!pid) {
  const counts = new Map();
  for (const f of files) for await (const h of iterAppHands(f.path)) {
    for (const p of Object.values(h.seatPlayers || {})) counts.set(p, (counts.get(p) || 0) + 1);
  }
  pid = [...counts.entries()].sort((a, b) => b[1] - a[1])[RANK - 1][0];
}
const decisions = [];
for (const f of files) for await (const h of iterAppHands(f.path)) {
  const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
  if (seat) decisions.push(...labelDecisions(h, seat));
}
const preflop = decisions.filter((d) => d.street === 'preflop');

/** The equity ordering to fill with. Seat role, not distance — matches how ranges are built. */
const equityKeyFor = (position) => {
  if (position === 'SB') return 'SB';
  if (position === 'BB') return 'BB';
  if (position === 'BTN' || position === 'CO') return 'LATE';
  if (position === 'HJ') return 'MIDDLE';
  return 'EARLY';
};
/** The conventional chart to contrast against, or null when none is close enough to mean anything. */
const chartKeyFor = (position) => (
  ['UTG', 'HJ', 'CO', 'BTN', 'SB', 'BB'].includes(position) ? position : null);

const shownIn = (pool, isK) => pool
  .filter((d) => d.handKnown && isK(d))
  .map((d) => d.holeCards.join(''));

const spec = (id, title, pool, isK, position, note) => {
  const k = pool.filter(isK).length;
  return {
    id, title, k, n: pool.length,
    equityKey: equityKeyFor(position),
    chartKey: chartKeyFor(position),
    shown: shownIn(pool, isK),
    note,
  };
};

const specs = [];

// ── OPEN, by seat AND table size ─────────────────────────────────────────────
const firstIn = preflop.filter((d) => d.firstIn === true && d.canRaise);
const seatSizes = new Map();
for (const d of firstIn) {
  const key = `${d.position}@${d.seatsDealt}`;
  if (!seatSizes.has(key)) seatSizes.set(key, []);
  seatSizes.get(key).push(d);
}
for (const [key, pool] of [...seatSizes].sort()) {
  const [position, size] = key.split('@');
  if (pool.length < 25) continue;                 // same floor the induction uses for a rule
  specs.push(spec(`open-${key}`, `Opens first in from ${position} at ${size}-handed`,
    pool, (d) => d.action === 'raise', position,
    'nobody had entered the pot when he acted'));
}

// ── ISO-RAISE over limpers ───────────────────────────────────────────────────
const iso = preflop.filter((d) => d.canRaise && d.raisesFaced === 0 && (d.limpersAhead ?? 0) > 0);
if (iso.length >= 25) {
  specs.push(spec('iso', 'Raises over limpers', iso, (d) => d.action === 'raise', 'CO',
    'at least one limper ahead, no raise yet'));
}

// ── FACING EXACTLY ONE RAISE: 3-bet, and call ────────────────────────────────
const vsRaise = preflop.filter((d) => d.raisesFaced === 1);
if (vsRaise.length >= 25) {
  specs.push(spec('3bet', 'Re-raises against a single raise', vsRaise,
    (d) => d.action === 'raise', 'CO', 'exactly one raise stands in front of him'));
  specs.push(spec('call-raise', 'Calls a single raise', vsRaise,
    (d) => d.action === 'call', 'CO', 'exactly one raise stands in front of him'));
}

/**
 * BIG BLIND, UNRAISED — and the action charted here is the RAISE, never the check.
 *
 * FOUNDER, 2026-08-19: *"every two cards survive here since he literally would have to fold at
 * zero cost to continue."*
 *
 * Correct, and charting the check was a modelling error, not a thin measurement. Continuing is
 * FREE in the big blind with no raise in front, so no hand folds — measured on villain 1:
 * 107 checks, 7 raises, ZERO folds out of 114. The "check range" is therefore 1,326 combos
 * minus whatever he raises, by the rules of the game and not by anything he decided.
 *
 * Charting it did something worse than measure nothing. `fillToWidth` fills from the TOP of the
 * equity ordering, so a 93.9% check rate was drawn as "the best 1,245 combos check" — which is
 * backwards, since the hands he checks are precisely the ones he declined to raise. It then
 * printed `32o` as REFUTING the ordering. A hand that cannot fold profitably appearing in a
 * free-check range refutes nothing; it is the only thing that could have happened.
 *
 * The raise is the real decision, and its complement needs no inference: whatever is not raised
 * is checked, exactly and by definition. So one chart, on the choice that exists.
 */
const bbUnraised = preflop.filter((d) => d.position === 'BB' && d.raisesFaced === 0);
if (bbUnraised.length >= 25) {
  specs.push(spec('bb-raise', 'Raises from the big blind when nobody raised', bbUnraised,
    (d) => d.action === 'raise', 'BB',
    'he is the big blind and no raise came; continuing is free, so the rest is checked '
    + 'by definition and needs no range inference'));
}

mkdirSync('.tmp-arch', { recursive: true });
writeFileSync(OUT, JSON.stringify(specs, null, 1));
console.log(`villain ${pid} — ${decisions.length} decisions, ${preflop.length} preflop`);
console.log(`wrote ${specs.length} chart specs to ${OUT}\n`);
for (const s of specs) {
  console.log(`  ${s.id.padEnd(16)} k/n ${String(s.k).padStart(4)}/${String(s.n).padStart(4)}`
    + `  ${(100 * s.k / s.n).toFixed(1).padStart(5)}%  ordering ${s.equityKey.padEnd(6)}`
    + `  shown ${s.shown.length}${s.shown.length ? ' [' + s.shown.join(' ') + ']' : ''}`);
}
