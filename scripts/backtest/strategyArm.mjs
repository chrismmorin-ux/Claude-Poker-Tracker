/**
 * strategyArm.mjs — an EXTERNALLY-PUBLISHED strategy as a scoreable arm.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS AND WHY IT IS NOT `engineOverrides`
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * WS-404 threads configuration INTO the engine so an arm can vary the engine's search.
 * That is a different axis from this one. A published strategy is not a configuration of
 * our engine — it is a DIFFERENT FUNCTION from decision to action distribution, and the
 * only thing the estimator downstream of it needs is that distribution.
 *
 * `ipsEstimator.weightFor` reads exactly four fields off a scored decision: `piOurs`,
 * `piPool`, `observedAction`, `netBB`. `depthAblationReport.pairedDelta` reads
 * `piOursByArm[id]`. Neither knows or cares whether the distribution came from
 * `evaluateGameTree`, from a coach's chart, or from a constant. So the whole interface a
 * published strategy must satisfy is:
 *
 *     policyAt({ ctx, hand, geo, responses }) -> { covered: true, actions: {a: p} }
 *                                              | { covered: false }
 *
 * and everything else — the outcome, the propensity denominator, the pairing, the cluster
 * bootstrap, the Result Card — is already built and is shared with the engine arm.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE ABSTENTION RULE, WHICH IS THE PART THAT CAN QUIETLY LIE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Every published strategy is partial. A c-bet rule says nothing about a river check-raise;
 * a chart for dry boards says nothing about a monotone one. What happens at the decisions
 * the strategy does not cover is not a detail — IT IS WHAT THE NUMBER MEANS, and the three
 * available answers measure three different quantities:
 *
 *   FALLBACK_ENGINE  pi = the engine's own advice at uncovered decisions.
 *                    MEASURES: the marginal contribution of the published rule, dropped into
 *                    our engine. The delta against the pure engine arm is attributable
 *                    entirely to covered decisions. It is DILUTED by coverage, so the arm's
 *                    headline edge understates the rule wherever coverage is low — which is
 *                    why `coveredShare` is stamped and why the paired delta's
 *                    `discordantN` is the honest denominator (an uncovered decision produces
 *                    an identical weight in both arms and carries no information about the
 *                    difference).
 *
 *   FALLBACK_POOL    pi = the behaviour policy at uncovered decisions, so w = 1 exactly.
 *                    MEASURES: the published rule ALONE, playing population poker
 *                    everywhere else. This is the "how good is this strategy" reading, and
 *                    its edge is mechanically near coverage x (the covered-decision edge).
 *                    It is the right arm for ranking two publications against each other and
 *                    the WRONG arm for asking what a publication would add to our engine.
 *
 *   FALLBACK_REFUSE  the decision is dropped for EVERY arm.
 *                    MEASURES: the rule on its own turf — and silently changes the decision
 *                    set that the engine arm, the population control and the PBR ceiling are
 *                    all averaged over. The population term no longer cancels against the
 *                    same denominator as the other runs, and two publications with different
 *                    coverage become incomparable while looking comparable. It is REFUSED as
 *                    a headline and requires `allowSetChange: true` to run at all.
 *
 * The default is FALLBACK_ENGINE because it is the only one that preserves the pairing
 * property `heroEvRunner` is built around, and because the covered-only figure it is
 * sometimes wanted for is already available from the paired delta without changing the set.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE FREQUENCY PROBLEM
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A chart gives pi(a | s) directly. A frequency prescription — "c-bet 65% on dry boards" —
 * gives a MARGINAL over a class of decisions, not a distribution at one of them. Three
 * encodings recover a per-decision distribution and they are not the same object:
 *
 *   ENCODING_MARGINAL   pi(bet | s) = 0.65 at every decision in the class.
 *                       ASSUMES the strategy randomises independently of the holding. This
 *                       is the ONLY encoding that adds nothing the publication did not say.
 *                       It is therefore also the weakest, and that weakness is a measurement
 *                       of the publication's information content, not a defect of the
 *                       encoding.
 *
 *   ENCODING_ORDERED    bet the top 65% of hero's range by a strength ordering, check the
 *                       rest; pi(bet | s) = the range mass above the threshold, which varies
 *                       decision to decision.
 *                       ASSUMES an ordering the publication did not supply. The ordering IS
 *                       a strategy, so this arm measures "publication + our ordering" and a
 *                       win cannot be attributed between them from this arm alone. Run it
 *                       BESIDE the marginal arm: the gap between the two is the value of the
 *                       ordering and is its own finding.
 *
 *   ENCODING_TILT       take the engine's own pi and tilt it until the class marginal equals
 *                       the published frequency.
 *                       ASSUMES the engine's hand-SELECTION is right and only its FREQUENCY
 *                       is wrong. This is the most informative arm for improving the engine
 *                       because it varies one dimension — but it is the engine wearing the
 *                       publication's frequencies, not the publication.
 *
 * Only ENCODING_MARGINAL may be reported as "the published strategy". The other two are
 * HYBRIDS and this module records `encoding` on every arm so a reader cannot lose track.
 *
 * WHATEVER THE ENCODING, THE REALISED MARGINAL IS VERIFIED, NOT ASSUMED. `armCoverage`
 * accumulates the realised class marginal over the decisions actually scored. A publication
 * that says 65% and realises 41% on this decision set has not been encoded wrongly — the
 * decision set is not the population its author had in mind — and that gap must be visible
 * as DATA rather than discovered later by someone re-deriving it.
 */

import { RESPONSES_BY_FACING } from './behaviorPolicy.mjs';
import { evaluateCard } from '../../src/utils/standardOfRecord/strategyCard.js';
import { sampleCombos, DEFAULT_COMBO_SAMPLES } from './heroPolicy.mjs';
import { comboClass } from './decisionRecord.mjs';

/** Where a strategy arm's distribution comes from at a decision it does not cover. */
export const FALLBACK = Object.freeze({
  ENGINE: 'engine',
  POOL: 'pool',
  REFUSE: 'refuse',
});

/** How a published rule was turned into a per-decision distribution. See the header. */
export const ENCODING = Object.freeze({
  /** The publication already states a per-decision distribution (a chart). */
  DIRECT: 'direct',
  /** A published marginal frequency applied flat across the class. Adds nothing. */
  MARGINAL: 'marginal',
  /** A published frequency resolved through an ordering we supplied. HYBRID. */
  ORDERED: 'ordered',
  /** A published frequency imposed on the engine's own selection. HYBRID. */
  TILT: 'tilt',
});

/** Encodings that are hybrids and may never be reported as "the published strategy". */
export const HYBRID_ENCODINGS = Object.freeze([ENCODING.ORDERED, ENCODING.TILT]);

export const STRATEGY_SKIP_REASONS = Object.freeze({
  NO_FALLBACK_SOURCE: 'no-fallback-source',
  ABSTAINED_REFUSE: 'abstained-refuse',
  EMPTY_DISTRIBUTION: 'empty-distribution',
  BAD_DISTRIBUTION: 'bad-distribution',
});

const EPSILON = 1e-12;

/**
 * Validate a strategy descriptor at CONSTRUCTION, before any corpus is read.
 *
 * Same discipline as `runHeroEv`'s other guards: a run that cannot produce an interpretable
 * number must not be able to start. In particular a typo in `fallback` must not fall through
 * to a default, because the default silently decides what the arm measures.
 */
export const validateStrategy = (strategy, { armId }) => {
  if (!strategy || typeof strategy !== 'object') {
    throw new Error(`strategy arm "${armId}": strategy must be an object`);
  }
  if (typeof strategy.policyAt !== 'function') {
    throw new Error(`strategy arm "${armId}": strategy.policyAt must be a function`);
  }
  if (!strategy.id) throw new Error(`strategy arm "${armId}": strategy.id is required`);
  if (!Object.values(ENCODING).includes(strategy.encoding)) {
    throw new Error(
      `strategy arm "${armId}": encoding must be one of ${Object.values(ENCODING).join(', ')} `
      + '— it is what tells a reader whether the arm is the publication or a hybrid, and '
      + 'there is no defensible default.',
    );
  }
  if (!strategy.sourceRef) {
    throw new Error(
      `strategy arm "${armId}": sourceRef is required — a strategy arm with no citation is `
      + 'an unattributed number, and the whole point of this axis is that the number belongs '
      + 'to a named external claim.',
    );
  }
  return strategy;
};

/**
 * Validate a fallback mode.
 *
 * `REFUSE` changes the decision set for every other arm in the run, so it is gated behind an
 * explicit opt-in rather than being reachable by choosing a string.
 */
export const validateFallback = (mode, { armId, allowSetChange = false }) => {
  if (!Object.values(FALLBACK).includes(mode)) {
    throw new Error(
      `strategy arm "${armId}": fallback must be one of ${Object.values(FALLBACK).join(', ')}`,
    );
  }
  if (mode === FALLBACK.REFUSE && !allowSetChange) {
    throw new Error(
      `strategy arm "${armId}": fallback "refuse" drops every decision this strategy does not `
      + 'cover, which changes the decision set the engine arm, the population control and the '
      + 'PBR ceiling are all averaged over — the pairing property that makes the delta readable '
      + 'at low n. Pass allowSetChange: true to accept that, and do not quote the resulting '
      + 'absolute edges against any other run.',
    );
  }
  return mode;
};

/**
 * Normalise a raw action distribution onto the response set the corpus can express.
 *
 * NO SMOOTHING, for the reason `heroPolicy` gives: a zero here is a real statement — "this
 * strategy never takes this action at this node" — and smoothing it would fabricate
 * propensity mass the strategy does not have. A decision where the observed action has
 * pi_ours = 0 gets weight 0 and contributes nothing, which is correct rather than lossy.
 *
 * Mass placed on an action OUTSIDE the response set is dropped and reported, not folded in:
 * a strategy that recommends a bet at a node where the corpus vocabulary is {fold, call,
 * raise} has said something this decision cannot express, and quietly reassigning that mass
 * would invent a recommendation on its behalf.
 */
export const normalizeActions = (raw, responses) => {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, reason: STRATEGY_SKIP_REASONS.BAD_DISTRIBUTION };
  }
  let inSet = 0;
  let outOfSet = 0;
  for (const [a, p] of Object.entries(raw)) {
    if (!Number.isFinite(p) || p < 0) {
      return { ok: false, reason: STRATEGY_SKIP_REASONS.BAD_DISTRIBUTION };
    }
    if (responses.includes(a)) inSet += p;
    else outOfSet += p;
  }
  if (!(inSet > EPSILON)) return { ok: false, reason: STRATEGY_SKIP_REASONS.EMPTY_DISTRIBUTION };

  const actions = {};
  for (const a of responses) actions[a] = (raw[a] ?? 0) / inSet;
  return { ok: true, actions, outOfSetMass: outOfSet / (inSet + outOfSet) };
};

/**
 * Fresh per-arm coverage accumulator.
 *
 * `realisedMarginal` is the point of this object. Everything else here is bookkeeping; that
 * field is what catches an encoding whose class definition does not match the decision set.
 */
export const newCoverage = () => ({
  n: 0,
  covered: 0,
  fellBackToEngine: 0,
  fellBackToPool: 0,
  refusedDecisions: 0,
  outOfSetMassSum: 0,
  /**
   * Decisions the card answered from its RESIDUAL CLAUSE rather than a named rule.
   *
   * Counted separately from `covered` because they are covered in the sense that matters to
   * the loader (the card accounts for every state inside its domain) and NOT covered in the
   * sense that matters to a reader: the residual is "the part nobody designed", and its EV
   * share is a headline metric of the Standard of Record. An arm whose edge comes mostly from
   * its residual has been credited for a fold rule, not for the strategy it was citing.
   *
   * `residualMass` is summed range weight, not decisions, because a card matching on
   * `handClass` fires rules for some combos and the residual for others AT THE SAME DECISION.
   */
  residualDecisions: 0,
  residualMass: 0,
  ruleFires: {},
  /**
   * facingAction -> { n, mass: {action -> summed probability} } over COVERED decisions.
   *
   * KEYED BY FACING CLASS, not pooled, and the prototype run is what forced it. Pooled, a
   * uniform arm reported `{check: 0.35, bet: 0.35, fold: 0.1, call: 0.1, raise: 0.1}` — an
   * average across two DIFFERENT response sets, in which no cell is a frequency anything
   * could be checked against. A published "c-bet 65%" lives in the `none` class and must be
   * read against the `none` row alone; averaging it with the facing-a-bet decisions produces
   * a number that looks like a frequency and is not one.
   */
  realisedByFacing: {},
});

/** Read a coverage accumulator into the shape that goes in the artifact. */
export const summarizeCoverage = (c) => {
  if (!c || !c.n) return null;
  const realisedMarginal = {};
  for (const [facing, row] of Object.entries(c.realisedByFacing)) {
    if (!row.n) continue;
    realisedMarginal[facing] = { n: row.n };
    for (const [a, m] of Object.entries(row.mass)) {
      realisedMarginal[facing][a] = Number((m / row.n).toFixed(4));
    }
  }
  return {
    n: c.n,
    covered: c.covered,
    coveredShare: Number((c.covered / c.n).toFixed(4)),
    fellBackToEngine: c.fellBackToEngine,
    fellBackToPool: c.fellBackToPool,
    refusedDecisions: c.refusedDecisions,
    residualDecisions: c.residualDecisions,
    // The Standard of Record's headline: how much of this arm's answer came from the part
    // nobody designed. Range mass, not decisions — see `newCoverage`.
    residualMassShare: c.covered > 0 ? Number((c.residualMass / c.covered).toFixed(4)) : null,
    ruleFires: { ...c.ruleFires },
    meanOutOfSetMass: c.covered > 0 ? Number((c.outOfSetMassSum / c.covered).toFixed(4)) : null,
    // The REALISED class marginal over the decisions actually scored, against which the
    // publication's stated frequency must be read. See the header.
    realisedMarginal,
  };
};

/**
 * Evaluate one strategy arm at one decision.
 *
 * Deliberately synchronous and free of any clock, RNG or engine call: a strategy arm is a
 * pure function of the decision, which is what makes it usable as a determinism control for
 * the engine's own run-to-run floor (WS-411 — `gameTreeEvaluator` gates refinement on
 * `Date.now()`, so identical inputs can give different advice under machine load; a strategy
 * arm cannot).
 *
 * @param {Object} args
 * @param {Object} args.arm        - normalized arm: { id, strategy, fallback, fallbackArmId }
 * @param {Object} args.ctx        - decisionAccumulator seam payload
 * @param {Object} args.hand       - app-shaped corpus hand
 * @param {Object} args.geo        - decisionGeometry output for this node
 * @param {Object|null} args.engineActions - the fallback engine arm's distribution
 * @param {Object|null} args.poolActions   - pi_pool at this node
 * @param {Object} args.coverage   - accumulator from `newCoverage`, mutated in place
 */
export const strategyPolicyAt = ({
  arm, ctx, hand, geo, engineActions = null, poolActions = null, coverage,
}) => {
  const responses = RESPONSES_BY_FACING[ctx.facingAction] || RESPONSES_BY_FACING.none;
  coverage.n++;

  let out;
  try {
    out = arm.strategy.policyAt({ ctx, hand, geo, responses });
  } catch {
    out = { covered: false };
  }

  if (out?.covered) {
    const norm = normalizeActions(out.actions, responses);
    if (!norm.ok) return { ok: false, reason: norm.reason };
    coverage.covered++;
    coverage.outOfSetMassSum += norm.outOfSetMass;
    if (out.residualMass > 0) {
      coverage.residualMass += out.residualMass;
      if (out.residualMass > 0.5) coverage.residualDecisions++;
    }
    for (const [rid, w] of Object.entries(out.ruleFires ?? {})) {
      coverage.ruleFires[rid] = (coverage.ruleFires[rid] || 0) + w;
    }
    const facing = ctx.facingAction ?? 'none';
    const row = coverage.realisedByFacing[facing]
      || (coverage.realisedByFacing[facing] = { n: 0, mass: {} });
    row.n++;
    for (const [a, p] of Object.entries(norm.actions)) {
      row.mass[a] = (row.mass[a] || 0) + p;
    }
    return { ok: true, actions: norm.actions, covered: true };
  }

  // ── Uncovered. What happens here is what the number means. ──
  if (arm.fallback === FALLBACK.REFUSE) {
    coverage.refusedDecisions++;
    return { ok: false, reason: STRATEGY_SKIP_REASONS.ABSTAINED_REFUSE };
  }
  if (arm.fallback === FALLBACK.POOL) {
    if (!poolActions) return { ok: false, reason: STRATEGY_SKIP_REASONS.NO_FALLBACK_SOURCE };
    coverage.fellBackToPool++;
    // Copied, not referenced: the row keeps `piPool` separately and an aliased object would
    // make a later edit to one silently edit the other.
    return { ok: true, actions: { ...poolActions }, covered: false };
  }
  if (!engineActions) return { ok: false, reason: STRATEGY_SKIP_REASONS.NO_FALLBACK_SOURCE };
  coverage.fellBackToEngine++;
  return { ok: true, actions: { ...engineActions }, covered: false };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// TRIVIALLY-ENCODABLE ARMS — the plumbing proof, not poker content
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * "Always fold." The simplest strategy that is a real strategy.
 *
 * It ABSTAINS where folding is not an option (facing no bet, where the response set is
 * {check, bet}), which is not a special case bolted on — it is the ordinary condition of
 * every published strategy, and having it in the trivial arm means the abstention path is
 * exercised by the cheapest possible run rather than first meeting reality on an expensive
 * one.
 *
 * Its expected edge is strongly NEGATIVE and that is the point: an arm whose sign is known
 * in advance is how you tell that the plumbing is carrying the arm's opinion rather than the
 * engine's.
 */
export const ALWAYS_FOLD = Object.freeze({
  id: 'always-fold',
  version: '1.0.0',
  encoding: ENCODING.DIRECT,
  sourceRef: 'internal:trivial-control — not a published strategy; a plumbing proof',
  policyAt: ({ responses }) => (
    responses.includes('fold')
      ? { covered: true, actions: { fold: 1 } }
      : { covered: false }
  ),
});

/**
 * Uniform over the legal response set. Covers every decision, so it isolates the estimator
 * path from the abstention path when the two are being debugged separately.
 */
export const UNIFORM = Object.freeze({
  id: 'uniform',
  version: '1.0.0',
  encoding: ENCODING.DIRECT,
  sourceRef: 'internal:trivial-control — maximum-entropy reference, not a published strategy',
  policyAt: ({ responses }) => ({
    covered: true,
    actions: Object.fromEntries(responses.map((a) => [a, 1 / responses.length])),
  }),
});

// ═══════════════════════════════════════════════════════════════════════════════════════
// THE STRATEGY CARD ADAPTER — the bridge that did not exist
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Turn a loaded Strategy Card (`src/utils/standardOfRecord/strategyCard.js`) into an arm.
 *
 * THE CARD IS THE ENCODING FORMAT AND THIS MODULE DOES NOT INVENT A SECOND ONE. A Strategy
 * Card is ADR-009's `Declared` surface: a rule list matching only on `MATCHABLE_AXES`, action
 * distributions rather than bare actions, a REQUIRED residual clause so the card accounts for
 * every state inside its declared domain, a warrant per rule, and a content hash. That is
 * precisely the shape an externally-published strategy needs, it is already validated on
 * load, and it is already the object a Result Card's `Match` is defined over
 * (Strategy Card x Deal Book x Field -> Result Card).
 *
 * What did not exist is this function. `evaluateCard` had NO CALLER anywhere in
 * `scripts/backtest/` — the Declared surface could be authored and loaded but never scored,
 * which is the shipped-but-inert pattern exactly: the capability existed behind an interface
 * no measurement site called.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE ONE AXIS THE CORPUS CANNOT SUPPLY, AND WHAT FOLLOWS FROM IT
 * ─────────────────────────────────────────────────────────────────────────────────────
 *
 * Of the axes a card may match on, every one is present on a scored decision — `street`,
 * `texture`, `posCategory`, `isAgg`, `isIP`, `facingAction`, `contextAction` off `ctx`;
 * `sprBand`, `closesAction`, `sBucket` off the geometry — EXCEPT `handClass`. The corpus
 * masks hole cards pre-showdown, so a decision does not have a hand. It has a RANGE.
 *
 * A card matching on `handClass` is therefore evaluated ONCE PER SAMPLED COMBO and mixed by
 * range weight, which is the identical construction `heroPolicy` uses for engine advice:
 *
 *     pi_card(a | s) = sum over combos h  P(h | s) * card(a | s, handClass(h))
 *
 * Two consequences worth stating plainly.
 *
 *   1. THE FREQUENCY-VS-DECISION PROBLEM DISSOLVES FOR ANY PUBLICATION THAT NAMES HANDS.
 *      A chart says which holdings do what; the range mixes them into a per-decision
 *      distribution and no ordering has to be supplied by us. The problem is real only for
 *      publications that state a frequency WITHOUT saying which hands carry it — and that is
 *      a property of the publication, not of this harness.
 *   2. THE SAME COMBO SAMPLE IS USED AS THE ENGINE ARM'S. `sampleCombos` is systematic and
 *      weight-proportional, so it is exactly reproducible, and sharing it means the card arm
 *      and the engine arm marginalize over the SAME holdings — the comparison isolates the
 *      decision rule instead of quietly re-measuring two different range samples.
 *
 * Note that the card path costs no engine call: it is 169-class lookups against a rule list.
 *
 * @param {Object} card - a card from `loadStrategyCard`/`loadStrategyCardSync`
 * @param {Object} [opts]
 * @param {string} opts.sourceRef - the citation. Required; see `validateStrategy`.
 * @param {string} [opts.encoding] - defaults to DIRECT, which is right for a card whose rules
 *   came from the publication. Pass MARGINAL/ORDERED/TILT when the card's authoring involved
 *   a step the publication did not state.
 */
export const fromStrategyCard = (card, { sourceRef, encoding = ENCODING.DIRECT, comboSamples = DEFAULT_COMBO_SAMPLES } = {}) => {
  // Decided ONCE, at construction: whether any rule keys on hero's holding. A card that does
  // not need the combo loop must not pay for it, and a card that does must never be evaluated
  // without it — silently dropping the axis would make every hand-specific rule unreachable
  // and the card would answer entirely from its residual while looking like it had run.
  const needsHand = card.rules.some((r) => r.when && r.when.handClass !== undefined);

  // Every MATCHABLE axis the corpus can supply, plus the three fields cards conventionally
  // constrain their DOMAIN on. The domain fields matter as much as the axes: `inDomain`
  // returns DOMAIN_UNKNOWN — an abstention — for any constrained field the situation does not
  // carry, so a card declaring `stackDepthBB: [80, 200]` would abstain on 100% of decisions
  // and report as "out of domain" when the truth is that the harness failed to say.
  const situationOf = (ctx, hand, geo) => ({
    street: ctx.street,
    texture: ctx.texture,
    posCategory: ctx.posCategory,
    isAgg: ctx.isAgg,
    isIP: ctx.isIP,
    facingAction: ctx.facingAction,
    contextAction: ctx.contextAction ?? null,
    preflopAggressor: ctx.isAgg === 'agg',
    sprBand: geo?.sprBand ?? null,
    closesAction: geo?.closesAction ?? null,
    sBucket: geo?.sBucket ?? null,
    // ── domain fields ──
    gameType: 'cash',
    seats: hand?.seatPlayers ? Object.keys(hand.seatPlayers).length : null,
    stackDepthBB: geo?.stackBB ?? null,
  });

  return Object.freeze({
    id: card.cardId,
    version: `schema${card.schemaVersion}+${(card.contentHash ?? 'nohash').slice(0, 12)}`,
    encoding,
    sourceRef,
    cardTitle: card.title,
    needsHand,
    policyAt: ({ ctx, hand, geo }) => {
      const base = situationOf(ctx, hand, geo);

      if (!needsHand) {
        const r = evaluateCard(card, base);
        if (r.abstained) return { covered: false };
        return {
          covered: true,
          actions: r.action,
          residualMass: r.residual ? 1 : 0,
          ruleFires: r.ruleId ? { [r.ruleId]: 1 } : {},
        };
      }

      // ── The range marginalization. See the docblock. ──
      const range = ctx.rangeBefore;
      const board = ctx.board;
      if (!range || !board) return { covered: false };
      const combos = sampleCombos(range, board, comboSamples);
      if (combos.length === 0) return { covered: false };

      const actions = {};
      const ruleFires = {};
      let residualMass = 0;
      let used = 0;
      for (const c of combos) {
        const r = evaluateCard(card, { ...base, handClass: comboClass(c.card1, c.card2) });
        // Abstention is a property of the DOMAIN, which no card constrains on `handClass`
        // (it is not an identity axis), so this is combo-independent in practice — but it is
        // checked per combo rather than probed once, because assuming that would silently
        // break the first card that finds a way around it.
        if (r.abstained) continue;
        for (const [a, p] of Object.entries(r.action)) {
          actions[a] = (actions[a] || 0) + c.sampleWeight * p;
        }
        if (r.residual) residualMass += c.sampleWeight;
        else ruleFires[r.ruleId] = (ruleFires[r.ruleId] || 0) + c.sampleWeight;
        used += c.sampleWeight;
      }
      if (!(used > 0)) return { covered: false };
      return { covered: true, actions, residualMass: residualMass / used, ruleFires };
    },
  });
};

/**
 * A published MARGINAL FREQUENCY, encoded the only way that adds nothing to it.
 *
 * `spec` is `{ id, version, sourceRef, applies(ctx, geo) -> boolean, frequencies: {a: p} }`.
 * `applies` is the class the publication scoped its number to; outside it the arm abstains,
 * which is honest — the publication said nothing there.
 *
 * This is the factory that real c-bet / barrel / check-raise frequency tables land in, and
 * it is deliberately the boring one. `ENCODING.ORDERED` and `ENCODING.TILT` need hero's
 * range and the engine's per-combo output respectively, so they belong beside the engine
 * call rather than here; both are named in the header and neither is built yet.
 */
export const fromMarginalFrequency = (spec) => Object.freeze({
  id: spec.id,
  version: spec.version ?? '1.0.0',
  encoding: ENCODING.MARGINAL,
  sourceRef: spec.sourceRef,
  policyAt: ({ ctx, geo, responses }) => {
    if (!spec.applies({ ctx, geo, responses })) return { covered: false };
    return { covered: true, actions: { ...spec.frequencies } };
  },
});
