/**
 * rakeSensitivity.mjs — WS-429. Is `edgeBB` rake-invariant? Measured: NO.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE MECHANISM, VERIFIED AT SOURCE.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 *   edgeBB = wisValue(scored) − poolValue(scored)          (ipsEstimator.mjs:224-227)
 *
 * `poolValue` is the PLAIN mean of net_d; `wisValue` is the WEIGHT-AVERAGED mean of the
 * SAME net_d (w_d = piOurs/piPool). Both draw net_d from `resolveHandOutcome(hand,
 * {rakeConfig})`. Rake does NOT cancel in the subtraction, for a reason that is visible
 * in handOutcome.mjs:223-230: rake is taken off the AWARD, so only the WINNER of a pot
 * pays it — a folder's net is its commitment, rake-free. The per-decision rake burden is
 * therefore r_d·1[hero won]·(w_d/Σw − 1/n)-shaped, and it survives the subtraction
 * whenever the importance weights covary with winning pot size. They do: the cap makes
 * rake a concave function of pot, and the engine's disagreement with the pool (which is
 * what the weight measures) is not uniform across pot sizes.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS MATTERS NOW (fault register rank 3, FAULT-modelled-rake, P=0.90).
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The corpus records NO rake; every figure carries an assumed schedule. Live 1/2 rake is
 * roughly TWICE the online 2009 schedule. If edgeBB moves under a rake doubling, a
 * future live-rake calibration will move `overallEvBB100` by that amount × 100 ×
 * opportunitiesPerHand — and the founder would read the move as an engine change. This
 * module measures the movement, pins it in a test, and stamps it into every replication
 * manifest so each figure carries the size of its own rake exposure.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * WHAT THE FIXTURE MEASUREMENT IS, AND IS NOT.
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * The sweep runs over a CANONICAL FIXED FIXTURE (12 decisions, 6 players, deterministic
 * — same decisions under every schedule; only the nets move). That proves the
 * non-cancellation is real and mechanical, and pins its size ON THIS FIXTURE against
 * drift. It does NOT bound the corpus-level exposure: the size and even the sign of the
 * movement depend on how the run's actual weights covary with winning pot size, which
 * only a per-run sweep can measure. The stamp says `basis: 'fixture-sweep'` for exactly
 * this reason, and the named follow-up is a per-run three-schedule sweep in the runner
 * (heroEvRunner already computes raked+unraked per decision; the doubled arm is one more
 * `resolveHandOutcome` call in `outcomeFor` — deferred from WS-429 only because WS-433
 * is concurrently rewriting heroEvRunner.mjs and every line touched there is a merge
 * conflict).
 */

import { PRIMITIVE_ACTIONS } from '../../src/constants/primitiveActions.js';
import { resolveHandOutcome } from './handOutcome.mjs';
import { estimateEdge } from './ipsEstimator.mjs';

// ═════════════════════════════════════════════════════════════════════════════════════
// THE SCHEDULES
// ═════════════════════════════════════════════════════════════════════════════════════

/** No rake at all. `{pct:0, cap:0}` and `rakeConfig: null` are equivalent (tested). */
export const ZERO_RAKE = Object.freeze({ pct: 0, cap: 0, noFlopNoDrop: true });

/**
 * The online 2009 baseline — MUST equal `heroEvRunner.DEFAULT_RAKE_CONFIG`.
 *
 * Declared locally rather than imported because heroEvRunner pulls the whole engine
 * (rangeEngine, exploitEngine) and is loadable only through the Vite loader, while this
 * module must stay importable by `replicationStamp.collectConstants`. The test pins the
 * two byte-for-byte (`rakeSensitivity.test.js`), which is the same discipline
 * `knownDivergence` applies to the PRIOR_WEIGHT shadow: a transcription is legal only
 * with an executable equality check against the definition site.
 */
export const ONLINE_2009_RAKE = Object.freeze({ pct: 0.05, cap: 3, noFlopNoDrop: true });

/**
 * The live-1/2-like arm: {pct: 0.10, cap: 6} — EXACTLY DOUBLE the online schedule.
 *
 * WHY THIS CHOICE. Live 1/2 rooms typically take 10% to a $5-$8 cap (often plus a promo
 * drop), against the 2009 online 5%/$3. Doubling BOTH parameters has a property no
 * "realistic" live schedule has: min(2p·x, 2c) = 2·min(p·x, c), so the modelled rake is
 * exactly 2× the baseline at EVERY pot size, and the arm isolates "one rake doubling" as
 * a clean scalar treatment — which is what the stamped constant is denominated in. A
 * literal live schedule would also need a bb-relative cap conversion (the corpus spans
 * stakes; a $6 cap is 3bb at a $2 blind and 12bb at $0.50) and a promo-drop term, both
 * of which would blur the doubling without changing the conclusion. The percentage —
 * which dominates the small and mid pots where most decisions live — doubles exactly
 * (5% → 10%), which is the live-1/2 reality this arm exists to represent.
 */
export const LIVE_DOUBLE_RAKE = Object.freeze({ pct: 0.10, cap: 6, noFlopNoDrop: true });

export const RAKE_SCHEDULES = Object.freeze({
  zeroRake: ZERO_RAKE,
  online2009: ONLINE_2009_RAKE,
  liveDouble: LIVE_DOUBLE_RAKE,
});

/**
 * The invariance bar, in bb of edgeBB movement per rake doubling.
 *
 * NOT chosen to pass — the measured value FAILS it by ~18×, and that failure is the
 * finding (see RAKE_SENSITIVITY_STAMP.verdict). Justification for 0.01: the §3.3
 * headline is `overallEvBB100 = edgeBB × opportunitiesPerHand × 100`, and at the
 * censused ~0.7-1 opportunities/hand, 0.01 bb of edgeBB movement is ~1 bb/100 on the
 * headline — the smallest movement that could plausibly change a build/study decision.
 * Movement above this bar means the figure may not be quoted without naming its rake
 * schedule. WIDENING THIS CONSTANT TO ABSORB A LARGER MEASURED VALUE IS THE MOVE THIS
 * TICKET FORBIDS; if the measurement drifts, re-measure and re-document, never re-bar.
 */
export const RAKE_INVARIANCE_TOLERANCE_BB = 0.01;

// ═════════════════════════════════════════════════════════════════════════════════════
// THE CANONICAL FIXTURE — same decisions under every schedule, only the nets move
// ═════════════════════════════════════════════════════════════════════════════════════

const A = PRIMITIVE_ACTIONS;
const FIXTURE_BB = 2;

/**
 * 12 decisions, 6 players (the cluster bootstrap needs ≥2; 6 keeps it honest), fully
 * deterministic. Pot sizes straddle the online cap knee (pot 60 chips = 30bb, where
 * 0.05·60 = 3 = cap) so both the pct-binding and cap-binding regimes are exercised.
 *
 * `wRaw` is the importance weight piOurs/piPool for the observed action. The covariance
 * this table encodes — larger weights on larger-pot WINS — is the plausible direction
 * (the engine disagrees with pool play most in big pots), not a worst case: rows 5 and 9
 * put large weight on big-pot LOSSES (rake-free rows) and rows 0 and 6 put small weight
 * on wins, so the covariance is mixed, merely nonzero. Zero covariance would show zero
 * movement; the corpus's actual covariance is the follow-up measurement, not this one.
 *
 * outcome 'win': villain bets P/4, hero raises to 3P/4, villain folds — hero wins the
 * whole pot, pays the rake (net = P/4 − rake). outcome 'lose': hero folds P/4 to a
 * villain 3P/4 bet (net = −P/4, RAKE-FREE — the folder never pays rake, which is the
 * asymmetry the whole measurement turns on). All on the flop so `noFlopNoDrop` never
 * zeroes the schedule.
 */
const FIXTURE_ROWS = Object.freeze([
  { playerId: 'p0', potChips: 12, outcome: 'win', wRaw: 0.5 },
  { playerId: 'p0', potChips: 300, outcome: 'win', wRaw: 4.0 },
  { playerId: 'p1', potChips: 20, outcome: 'lose', wRaw: 2.0 },
  { playerId: 'p1', potChips: 240, outcome: 'win', wRaw: 3.5 },
  { playerId: 'p2', potChips: 32, outcome: 'win', wRaw: 1.0 },
  { playerId: 'p2', potChips: 160, outcome: 'lose', wRaw: 3.0 },
  { playerId: 'p3', potChips: 40, outcome: 'win', wRaw: 0.6 },
  { playerId: 'p3', potChips: 200, outcome: 'win', wRaw: 2.5 },
  { playerId: 'p4', potChips: 16, outcome: 'win', wRaw: 1.2 },
  { playerId: 'p4', potChips: 100, outcome: 'lose', wRaw: 0.8 },
  { playerId: 'p5', potChips: 60, outcome: 'win', wRaw: 1.5 },
  { playerId: 'p5', potChips: 24, outcome: 'lose', wRaw: 1.0 },
]);

/** App-shaped hand (phhAdapter shape), same construction the heroEv tests use. */
const mkFixtureHand = ({ potChips, outcome }, handId) => {
  const heroCommit = potChips / 4;
  const villainCommit = potChips - heroCommit;
  const committed = outcome === 'win'
    ? { 1: villainCommit, 2: heroCommit } // hero seat 1 raised to 3P/4, villain folds P/4
    : { 1: heroCommit, 2: villainCommit }; // hero seat 1 folds P/4 to a 3P/4 bet
  const actions = outcome === 'win'
    ? [
      { seat: '2', action: A.BET, street: 'flop', amount: heroCommit },
      { seat: '1', action: A.RAISE, street: 'flop', amount: villainCommit },
      { seat: '2', action: A.FOLD, street: 'flop' },
    ]
    : [
      { seat: '2', action: A.BET, street: 'flop', amount: villainCommit },
      { seat: '1', action: A.FOLD, street: 'flop' },
    ];
  return {
    handId,
    seatPlayers: { 1: 'hero', 2: 'villain' },
    gameState: {
      actionSequence: actions.map((a, i) => ({ order: i, ...a })),
      dealerButtonSeat: 9,
      mySeat: null,
      communityCards: [],
      showdownCards: {},
      currentStreet: 'flop',
      potSize: potChips,
      blinds: { sb: FIXTURE_BB / 2, bb: FIXTURE_BB },
    },
    _backtest: { bb: FIXTURE_BB, committedBySeat: committed, site: 'FIX', stakeLabel: 'fixture' },
  };
};

/**
 * The fixed decision set. Hands and specs are rebuilt on every call (cheap, and no
 * shared mutable state); the CONTENT is a constant of this module.
 *
 * The weight is realized through the propensities exactly as the estimator will read
 * them: piPool gives the observed action 0.2, piOurs gives it 0.2·wRaw, so
 * weightFor(d).raw === wRaw and no row approaches DEFAULT_WEIGHT_CAP (max here is 4 →
 * pOurs 0.8; clipping never fires and the sweep never depends on the cap).
 */
export const buildRakeSweepFixture = () => {
  const hands = FIXTURE_ROWS.map((row, i) => mkFixtureHand(row, i + 1));
  const decisionSpecs = FIXTURE_ROWS.map((row, i) => {
    const observedAction = row.outcome === 'win' ? 'raise' : 'fold';
    const pObs = 0.2;
    const pOurs = pObs * row.wRaw;
    const rest = (1 - pOurs) / 2;
    const others = ['raise', 'call', 'fold'].filter((a) => a !== observedAction);
    return {
      handIdx: i,
      playerId: row.playerId,
      heroSeat: '1',
      observedAction,
      piPool: { [observedAction]: pObs, [others[0]]: 0.4, [others[1]]: 0.4 },
      piOurs: { [observedAction]: pOurs, [others[0]]: rest, [others[1]]: rest },
    };
  });
  return { hands, decisionSpecs };
};

// ═════════════════════════════════════════════════════════════════════════════════════
// THE MEASUREMENT
// ═════════════════════════════════════════════════════════════════════════════════════

/**
 * Score the fixed decision set under one rake schedule.
 *
 * The SAME decisions every time — same weights, same players, same observed actions.
 * The only thing the schedule can touch is net_d, through the same
 * `resolveHandOutcome(hand, {rakeConfig})` the production runner uses
 * (heroEvRunner.mjs:238). A fixture hand that fails to resolve throws rather than
 * shrinking the set silently.
 */
export const edgeUnderRakeSchedule = ({ hands, decisionSpecs, rakeConfig }) => {
  const decisions = decisionSpecs.map((spec) => {
    const outcome = resolveHandOutcome(hands[spec.handIdx], { rakeConfig });
    if (!outcome.resolved) {
      throw new Error(
        `rakeSensitivity: fixture hand ${spec.handIdx} failed to resolve (${outcome.reason}) — `
        + 'the sweep may not silently shrink its decision set',
      );
    }
    return {
      piOurs: spec.piOurs,
      piPool: spec.piPool,
      observedAction: spec.observedAction,
      netBB: outcome.netBySeat[spec.heroSeat],
      playerId: spec.playerId,
    };
  });
  return estimateEdge(decisions, { label: `rake-sweep pct=${rakeConfig?.pct ?? 0} cap=${rakeConfig?.cap ?? 0}` });
};

const r4 = (x) => Number(x.toFixed(4));

/**
 * The full sweep: edgeBB at each schedule, the deltas, and the headline scalar.
 *
 * `bbPerRakeDoubling` = edgeBB(liveDouble) − edgeBB(online2009): how far the figure
 * moves when the modelled rake doubles from the corpus assumption toward live 1/2.
 * Deterministic — estimateEdge is seeded, the fixture is constant — so two calls agree
 * exactly, which is what lets the manifest stamp be DERIVED from this function rather
 * than transcribed (the hand-transcribed-literal defect, seen tonight and standing in
 * run-hero-ev.mjs:71, is the pattern this refuses).
 */
export const measureRakeSensitivity = () => {
  const { hands, decisionSpecs } = buildRakeSweepFixture();
  const reports = {};
  for (const [id, rakeConfig] of Object.entries(RAKE_SCHEDULES)) {
    reports[id] = edgeUnderRakeSchedule({ hands, decisionSpecs, rakeConfig });
  }
  const edge = Object.fromEntries(Object.entries(reports).map(([id, r]) => [id, r.edgeBB]));
  return Object.freeze({
    n: reports.online2009.n,
    players: reports.online2009.players,
    edgeBBBySchedule: Object.freeze(edge),
    deltaZeroToOnlineBB: r4(edge.online2009 - edge.zeroRake),
    deltaOnlineToLiveBB: r4(edge.liveDouble - edge.online2009),
    bbPerRakeDoubling: r4(edge.liveDouble - edge.online2009),
    reports: Object.freeze(reports),
  });
};

// ═════════════════════════════════════════════════════════════════════════════════════
// THE STAMP — derived at load from the measurement above, never transcribed
// ═════════════════════════════════════════════════════════════════════════════════════

const measured = measureRakeSensitivity();

/**
 * What `replicationStamp.collectConstants` puts on every manifest (WS-429 AC3).
 *
 * SINGLE SOURCE: these numbers are the return of `measureRakeSensitivity()`, computed at
 * module load — the same call the test makes and pins against its documented literals.
 * If the estimator, the outcome derivation, or the fixture changes, the stamp moves WITH
 * the measurement and the test fails until the documented values are consciously
 * re-measured. Nothing here is typed by hand.
 *
 * THE FINDING, PLAINLY (AC2/AC4): edgeBB is NOT rake-invariant. On this fixture it
 * moves ~-0.18 bb per rake doubling — ~18× the tolerance — which at ~0.7-1 censused
 * opportunities/hand is roughly -13 to -18 bb/100 on `overallEvBB100`. A live-rake
 * calibration would move the headline by an amount of this order while changing NOTHING
 * about the engine. Follow-up (named in the header): per-run three-schedule sweep in
 * heroEvRunner's `outcomeFor`, so every Result Card reports edgeBB at the canonical
 * online schedule ALONGSIDE a live-doubled arm, corpus-native — blocked tonight only by
 * the WS-433 concurrent rewrite of that file.
 */
export const RAKE_SENSITIVITY_STAMP = Object.freeze({
  faultId: 'FAULT-modelled-rake',
  basis: 'fixture-sweep',
  basisNote:
    'Measured on the canonical 12-decision / 6-player fixture in rakeSensitivity.mjs, NOT on '
    + 'the corpus of the run this manifest describes. It proves the non-cancellation mechanism '
    + 'and calibrates its order of magnitude under a mixed weight/pot-size covariance; the '
    + 'run-level exposure depends on the run\'s own covariance and needs the per-run sweep '
    + '(named follow-up in rakeSensitivity.mjs).',
  schedules: RAKE_SCHEDULES,
  toleranceBB: RAKE_INVARIANCE_TOLERANCE_BB,
  verdict: Math.abs(measured.bbPerRakeDoubling) > RAKE_INVARIANCE_TOLERANCE_BB
    ? 'not-rake-invariant'
    : 'rake-invariant-at-tolerance',
  n: measured.n,
  players: measured.players,
  edgeBBBySchedule: measured.edgeBBBySchedule,
  deltaZeroToOnlineBB: measured.deltaZeroToOnlineBB,
  bbPerRakeDoubling: measured.bbPerRakeDoubling,
});
