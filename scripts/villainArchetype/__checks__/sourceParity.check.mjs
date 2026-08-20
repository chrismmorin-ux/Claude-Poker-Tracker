/**
 * THREE SOURCES, ONE DECISION ROW — the gate WS-555 asked for.
 *
 * The founder, 2026-08-18: "we need to make sure the foundation is the same as a hand history
 * imported from ignition, or a player in the live app selected from tableview." The ticket then
 * recorded as ESTABLISHED that the labeller consumes "the APP's own hand shape ... so a live-app
 * player from tableview should already satisfy it by construction."
 *
 * THAT WAS FALSE, and this file is what makes it stay fixed. Handing a real captured hand to
 * `labelDecisions` with nothing but its `gameState` passed through produced five rows for one
 * seat, of which TWO were `mucked` and `won` — showdown results, not decisions — and all five
 * carried `potBB: null`, `spr: null`, `sizeBucket: null`, `boardCards: null`. It did not throw.
 * It did not warn. It produced a plausible-looking table of decisions that was 40% not
 * decisions and 100% blind to money, because `decisionGeometry` returns null without
 * `_backtest` and the labeller's fallback divides every chip amount by a big blind of ONE.
 *
 * The three arms, all end-to-end, none of them a mock of the pipeline:
 *
 *   CORPUS    fixtures/line-taxonomy-cases.phhs -> phhAdapter.toAppHand
 *   IGNITION  a real .jsonl capture -> TableManager.routeMessage (the production producer
 *             path) -> record-builder -> appRecordAdapter
 *   LIVE APP  a hand record in exactly the shape `usePersistence` hands to `saveHand`
 *             -> appRecordAdapter
 *
 * WHAT IS ASSERTED, and why each one is here rather than being obvious:
 *
 *  1. THE KEY SETS ARE IDENTICAL. Not "overlapping" — identical, both directions. A source
 *     that grows a field the others lack is a source whose rules cannot be induced beside
 *     theirs, and the divergence would first show up as an unexplained coverage gap.
 *  2. NO ROW IS A NON-DECISION. `mucked` and `won` ride inside a live actionSequence and are
 *     results, not choices. Counting them as decisions inflates every denominator.
 *  3. GEOMETRY IS PRESENT ON EVERY ROW OF EVERY ARM. This is the assertion that fails loudly
 *     where the old path failed silently — `potBB` non-null is the difference between a
 *     measured price and a number derived from a big blind of 1.
 *  4. A CONDUCT CARD BUILDS FROM EACH ARM. The row shape matching is necessary, not
 *     sufficient; the record form has its own required fields and its own validator.
 *
 * Run: node scripts/villainArchetype/__checks__/sourceParity.check.mjs
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { iterAppHands } from '../../backtest/phhAdapter.mjs';
import { adaptAppRecord, AMOUNT_CONVENTIONS, ADAPT_SKIPS } from '../../backtest/appRecordAdapter.mjs';
import { labelDecisions } from '../decisionLabeler.mjs';
import { emitConductCard } from '../emitConductCard.mjs';
import { conductCardProblems } from '../../../src/utils/standardOfRecord/conductCard.js';
import { validateHandRecord } from '../../../src/utils/persistence/validation.js';
import { liveHandProvenance } from '../../../src/utils/persistence/handProvenance.js';
import { TableManager } from '../../../ignition-poker-tracker/shared/table-manager.js';

const here = dirname(fileURLToPath(import.meta.url));
const REPO = join(here, '..', '..', '..');

let failed = 0;
const ok = (name, cond, detail = '') => {
  if (!cond) failed++;
  console.log(`  ${cond ? 'pass' : 'FAIL'}  ${name.padEnd(58)} ${detail}`);
};
const is = (name, got, want) => ok(name, Object.is(got, want), `got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// ─── ARM 1: the corpus ──────────────────────────────────────────────────────────────────────
const corpusHands = [];
for await (const h of iterAppHands(join(REPO, 'scripts/backtest/fixtures/line-taxonomy-cases.phhs'),
  { site: 'HandHQ', stakeLabel: '200NLH' })) corpusHands.push(h);

// ─── ARM 2: Ignition, through the real producer path ────────────────────────────────────────
const CAPTURE = join(REPO, 'ignition-poker-tracker/spike-data/captures',
  'ignition-frames-2026-06-19T06-48-05-980Z.jsonl');
const captured = [];
const tm = new TableManager((r) => captured.push(r), () => {});
for (const line of readFileSync(CAPTURE, 'utf8').split('\n')) {
  if (!line) continue;
  let frame;
  try { frame = JSON.parse(line); } catch { continue; }
  if (frame.kind !== 'msg') continue;
  try { tm.routeMessage(frame.connId, frame.data, frame.url); } catch { /* the producer swallows too */ }
}

const ignitionSkips = {};
const ignitionHands = [];
for (const rec of captured) {
  const res = adaptAppRecord(rec, { site: 'ignition', stakeLabel: '25NLH' });
  if (res.skip) ignitionSkips[res.skip] = (ignitionSkips[res.skip] || 0) + 1;
  else ignitionHands.push(res.hand);
}

// ─── ARM 3: the live app ────────────────────────────────────────────────────────────────────
/**
 * A record in EXACTLY the shape `usePersistence.js` hands to `saveHand` — `gameState` with
 * `seatStacks` and `handNumber`, `cardState` with a five-long padded board, `seatPlayers`.
 * Written out rather than imported so that a change to that shape breaks this check, which is
 * the only warning anyone gets that the live path has drifted.
 *
 * Six-handed, button on 6, blinds 1/2. BTN opens to 6, SB folds, BB calls. Flop: BB checks,
 * BTN bets 8, BB check-raises to 24, BTN calls. Turn: BB bets 40, BTN folds.
 */
const liveRecord = {
  timestamp: 1_755_000_000_000,
  version: '1.3.0',
  source: 'live',
  gameState: {
    currentStreet: 'turn',
    dealerButtonSeat: 6,
    mySeat: 6,
    absentSeats: [7, 8, 9],
    handNumber: 12,
    seatStacks: Object.fromEntries([1, 2, 3, 4, 5, 6].map(
      (s) => [s, { amount: 200, source: 'entered', observedAtHand: 12 }],
    )),
    actionSequence: [
      { order: 0, seat: 3, action: 'fold', street: 'preflop' },
      { order: 1, seat: 4, action: 'fold', street: 'preflop' },
      { order: 2, seat: 5, action: 'fold', street: 'preflop' },
      { order: 3, seat: 6, action: 'raise', street: 'preflop', amount: 6 },
      { order: 4, seat: 1, action: 'fold', street: 'preflop' },
      { order: 5, seat: 2, action: 'call', street: 'preflop', amount: 4 },
      { order: 6, seat: 2, action: 'check', street: 'flop' },
      { order: 7, seat: 6, action: 'bet', street: 'flop', amount: 8 },
      { order: 8, seat: 2, action: 'raise', street: 'flop', amount: 24 },
      { order: 9, seat: 6, action: 'call', street: 'flop', amount: 16 },
      { order: 10, seat: 2, action: 'bet', street: 'turn', amount: 40 },
      { order: 11, seat: 6, action: 'fold', street: 'turn' },
      // Showdown rows ride inside a real actionSequence. They are results, not decisions.
      { order: 12, seat: 2, action: 'won', street: 'showdown' },
    ],
  },
  cardState: {
    communityCards: ['9♦', '7♣', '2♥', 'K♠', ''],
    holeCards: ['A♠', 'Q♠'],
    holeCardsVisible: true,
    allPlayerCards: {},
  },
  seatPlayers: { 1: 'p1', 2: 'villain', 3: 'p3', 4: 'p4', 5: 'p5', 6: 'hero' },
};

const liveRes = adaptAppRecord(liveRecord, { blinds: { sb: 1, bb: 2 }, site: 'live', stakeLabel: '1/2' });
ok('live-app record adapts', !liveRes.skip, liveRes.skip ? `${liveRes.skip}: ${liveRes.detail}` : '');

/**
 * AND THE FIXTURE IS TIED TO THE APP'S OWN VALIDATOR, not to my transcription of the shape.
 *
 * Without this, the live arm proves only that the adapter handles a record I wrote. Running it
 * through `validateHandRecord` — the function `saveHand` calls before every write — means a
 * change to what the live path is allowed to store breaks this check, which is the only signal
 * anyone gets that the live arm has stopped representing the live path.
 *
 * NOT A SUBSTITUTE FOR REAL FOUNDER HANDS. Those live in IndexedDB on the phone and no node
 * process can reach them. This is the closest tie available from here, and the gap is named
 * rather than papered over.
 */
{
  const stamped = {
    ...liveRecord,
    ...liveHandProvenance({ sessionId: 1, venue: 'Card room', stakes: { sb: 1, bb: 2 } }, { stampedAt: liveRecord.timestamp }),
  };
  const v = validateHandRecord(stamped);
  ok('the live fixture is a record the app itself would accept', v.valid, v.errors.join('; '));
}

// ────────────────────────────────────────────────────────────────────────────────────────────
console.log('\n1. EVERY ARM PRODUCED HANDS');
ok('corpus hands', corpusHands.length > 0, `${corpusHands.length}`);
ok('ignition hands', ignitionHands.length > 0,
  `${ignitionHands.length} of ${captured.length} records; refused ${JSON.stringify(ignitionSkips)}`);
ok('live-app hand', !!liveRes.hand);

const rowsOf = (hands) => hands.flatMap(
  (h) => Object.keys(h.seatPlayers).flatMap((seat) => labelDecisions(h, seat)),
);
const arms = {
  corpus: rowsOf(corpusHands),
  ignition: rowsOf(ignitionHands),
  live: liveRes.hand ? rowsOf([liveRes.hand]) : [],
};

console.log('\n2. THE DECISION ROWS ARE THE SAME OBJECT IN ALL THREE');
for (const [name, rows] of Object.entries(arms)) ok(`${name} produced rows`, rows.length > 0, `${rows.length}`);

const keysOf = (rows) => new Set(Object.keys(rows[0] ?? {}));
const corpusKeys = keysOf(arms.corpus);
for (const name of ['ignition', 'live']) {
  const k = keysOf(arms[name]);
  const missing = [...corpusKeys].filter((x) => !k.has(x));
  const extra = [...k].filter((x) => !corpusKeys.has(x));
  ok(`${name} row keys == corpus row keys`, missing.length === 0 && extra.length === 0,
    missing.length || extra.length ? `missing ${JSON.stringify(missing)} extra ${JSON.stringify(extra)}` : `${k.size} keys`);
}
// Within an arm too: a row shape that varies by street is not one shape.
for (const [name, rows] of Object.entries(arms)) {
  const sizes = new Set(rows.map((r) => Object.keys(r).length));
  ok(`${name} rows all have the same arity`, sizes.size === 1, `${[...sizes].join(',')}`);
}

console.log('\n3. NO ROW IS A SHOWDOWN RESULT — the failure the naive path shipped');
const STREETS = new Set(['preflop', 'flop', 'turn', 'river']);
for (const [name, rows] of Object.entries(arms)) {
  const bad = rows.filter((r) => !STREETS.has(r.street) || r.action === 'won' || r.action === 'mucked');
  ok(`${name}: zero mucked/won/showdown rows`, bad.length === 0,
    bad.length ? JSON.stringify(bad.slice(0, 2).map((r) => `${r.street}/${r.action}`)) : `${rows.length} rows`);
}
// The live fixture carries a `won` row on purpose, so a pass above is evidence it was dropped.
is('live fixture really did contain a showdown row',
  liveRecord.gameState.actionSequence.filter((a) => a.street === 'showdown').length, 1);

console.log('\n4. THE MONEY IS REAL ON EVERY ROW — not a big blind defaulted to 1');
for (const [name, rows] of Object.entries(arms)) {
  ok(`${name}: potBB non-null everywhere`, rows.every((r) => Number.isFinite(r.potBB)),
    `${rows.filter((r) => !Number.isFinite(r.potBB)).length} null`);
  ok(`${name}: spr non-null everywhere`, rows.every((r) => Number.isFinite(r.spr)),
    `${rows.filter((r) => !Number.isFinite(r.spr)).length} null`);
  ok(`${name}: position never 'unknown'`, rows.every((r) => r.position !== 'unknown'),
    `${rows.filter((r) => r.position === 'unknown').length} unknown`);
}

console.log('\n5. THE KNOWN-ANSWER HAND — the live arm, countable on your fingers');
{
  // 12 betting actions, 13 sequence entries; the thirteenth is the `won` row.
  is('live arm row count', arms.live.length, 12);
  is('every live row is a betting street', new Set(arms.live.map((r) => STREETS.has(r.street))).size, 1);

  // Preflop pot when BTN opens: SB 1 + BB 2 = 3 chips = 1.5bb.
  const open = arms.live.find((r) => r.street === 'preflop' && r.action === 'raise');
  is('BTN open sees a 1.5bb pot', open?.potBB, 1.5);
  is('BTN open is on the button', open?.position, 'BTN');

  // Flop: preflop pot is 6 + 6 + 1 dead SB = 13 chips. BTN bets 8 -> the check-raiser faces a
  // pot of 21 chips = 10.5bb and owes 8 chips = 4bb.
  const cr = arms.live.find((r) => r.street === 'flop' && r.action === 'raise');
  is('flop check-raise sees a pot of 10.5bb', cr?.potBB, 10.5);
  is('flop check-raise price is the 8-chip bet in bb', cr?.toCallBB, 4);
  is('flop check-raiser was in the big blind', cr?.position, 'BB');
  is('flop check-raiser had already bet this street', cr?.iBetThisStreet, false);
  is('flop check-raise happened in a single-raised pot', cr?.preflopPotType, 'single-raised pot');

  // 200-chip stacks at 1/2 = 100bb. The opener has put in nothing before acting.
  is('BTN stack at the open is 100bb', open?.myStackBB, 100);
}

console.log('\n6. THE CONVENTION GATE ACTUALLY FIRES');
{
  /**
   * A BLIND THAT RAISES is the only place the two conventions disagree, because it is the only
   * seat with money in front of it that no action put there. This variant makes the BB
   * three-bet, so reading its `amount: 20` as an increment yields a raise TO 22 instead of 20.
   * A source speaking the wrong convention must be REFUSED or visibly re-priced — never
   * silently accepted, which is what an unchecked adapter would do.
   */
  const bbThreeBet = {
    ...liveRecord,
    gameState: {
      ...liveRecord.gameState,
      currentStreet: 'preflop',
      actionSequence: [
        ...liveRecord.gameState.actionSequence.slice(0, 5),
        { order: 5, seat: 2, action: 'raise', street: 'preflop', amount: 20 },
        { order: 6, seat: 6, action: 'fold', street: 'preflop' },
      ],
    },
  };
  const asTotal = adaptAppRecord(bbThreeBet, { blinds: { sb: 1, bb: 2 } });
  const asIncrement = adaptAppRecord(bbThreeBet, {
    blinds: { sb: 1, bb: 2 }, amountConvention: AMOUNT_CONVENTIONS.INCREMENT,
  });
  const amountOf = (res) => res.hand?.gameState.actionSequence.find((a) => a.seat === 2 && a.action === 'raise')?.amount;
  is('street-total reading: BB three-bets TO 20', amountOf(asTotal), 20);
  is('increment reading: the same row means 22 — its own blind on top', amountOf(asIncrement), 22);

  /**
   * And the gate that catches the real defect: a source emitting the wire's increments where
   * street totals are declared. This is the exact shape `protocol-adapter.js` produced when it
   * read `bet` on a raise — a "raise" no larger than what was already owed.
   */
  const impossible = {
    ...liveRecord,
    gameState: {
      ...liveRecord.gameState,
      actionSequence: [
        ...liveRecord.gameState.actionSequence.slice(0, 3),
        { order: 3, seat: 6, action: 'raise', street: 'preflop', amount: 2 },
      ],
    },
  };
  const res = adaptAppRecord(impossible, { blinds: { sb: 1, bb: 2 } });
  is('a raise that does not exceed the standing bet is refused', res.skip, ADAPT_SKIPS.INCONSISTENT_AMOUNTS);

  const noBlinds = adaptAppRecord(liveRecord, { blinds: null });
  is('a hand with no blinds is refused, never defaulted to bb=1', noBlinds.skip, ADAPT_SKIPS.NO_BLINDS);
}

console.log('\n7. A CONDUCT CARD BUILDS FROM EACH ARM');
/**
 * THE REAL EMITTER, not a hand-rolled `buildConductCard` call. Reimplementing the card
 * construction here would make this check pass on a card the production path cannot produce —
 * the manifest, the register stamp, the ruleset hash and the content hash are all things
 * `emitConductCard` does and a local copy would drift out of.
 *
 * Induction is NOT under test: it needs hundreds of decisions per leaf and these fixtures have
 * tens. One enclosing rule per arm is enough to exercise the step that would actually break on
 * a source whose rows are shaped differently — the card reads `handId`, `handKnown`,
 * `holeCards`, `street`, `facing` and `action` off every row.
 */
const wilson = (k, n) => {
  if (!n) return [0, 1];
  const p = k / n;
  const half = 1.96 * Math.sqrt((p * (1 - p)) / n);
  return [Math.max(0, p - half), Math.min(1, p + half)];
};

const enclosingRule = (rows) => {
  const tally = rows.reduce((m, r) => m.set(r.action, (m.get(r.action) || 0) + 1), new Map());
  return {
    predicate: [],
    conds: [],
    n: rows.length,
    verdict: 'mix',
    pool: rows,
    mix: { dist: [...tally].sort((a, b) => b[1] - a[1]), separators: [], family: 1 },
  };
};

for (const [name, rows] of Object.entries(arms)) {
  if (!rows.length) { ok(`${name}: conduct card builds`, false, 'no rows'); continue; }
  let card = null;
  let problems = null;
  try {
    card = await emitConductCard({
      subjectId: `ws555-${name}`,
      rules: [enclosingRule(rows)],
      decisions: rows,
      files: [`fixture:${name}`],
      gates: [{ name: 'source-parity fixture', ok: true, detail: `${rows.length} decisions` }],
      induction: { minRule: rows.length, maxDepth: 0, alpha: 0.05, requireSignificance: false },
      wilson,
      sourcePaths: [`fixture:${name}`],
      population: `WS-555 source-parity fixture (${name}). Not a measurement of any real pool.`,
    });
    problems = conductCardProblems(card);
  } catch (e) { problems = [`threw: ${e.message}`]; }
  ok(`${name}: conduct card is valid`, problems && problems.length === 0,
    problems && problems.length ? JSON.stringify(problems.slice(0, 3)) : card?.cardId ?? '');
  if (card) ok(`${name}: card carries a content hash`, /^sha256:[0-9a-f]{64}$/.test(card.contentHash), card.contentHash ?? 'none');
}

console.log(`\n${failed ? `${failed} ASSERTION(S) FAILED` : 'all assertions passed'}`);
process.exit(failed ? 1 : 0);
