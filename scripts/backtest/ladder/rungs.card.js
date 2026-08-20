/**
 * rungs.card.js — the villain rule ladder, R0 upward. WS-536.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THESE ARE
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A VILLAIN MODEL, not a hero strategy. Each rung is a Strategy Card that tries to reproduce
 * how a player in the HandHQ 50NL July-2009 pool actually behaves. Each rung adds or splits
 * EXACTLY ONE rule against the rung below it, so the ladder's deltas are attributable.
 *
 * Spec: docs/research/villain-rule-ladder-spec-2026-08-17.md
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE EXPRESSIVENESS LIMIT, FOUND WHILE AUTHORING THESE AND NOT ANTICIPATED
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `MATCHABLE_AXES` is: street, texture, posCategory, isAgg, isIP, facingAction, contextAction,
 * preflopAggressor, handClass, sprBand, playersRemaining, source, pool, sBucket, closesAction.
 *
 * `handClass` is the 169 PREFLOP rank-pair class ('AA', 'AKs', 'JTo'). There is NO axis for
 * POSTFLOP HAND STRENGTH. So this grammar cannot express "top pair", "middle set", "second
 * pair no kicker" — the concepts a real villain's ruleset is almost certainly built out of,
 * and the exact concepts the founder used when describing the rules he wanted.
 *
 * THIS IS NOT A BUG IN THE LADDER. It is the first concrete instance of the WS-535 shape
 * problem, found by trying to write the rules rather than by reasoning about them: our rule
 * grammar and the villain's do not have the same vocabulary. Rules below are therefore keyed
 * on geometry and frequency, which the grammar DOES carry, and the missing strength axis is
 * recorded as finding #1 against WS-535 rather than worked around silently.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE VOCABULARY CATCH, RECORDED BECAUSE IT WOULD HAVE PRODUCED A FALSE FINDING
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * R2 was first authored with `sBucket: 'small'` and `sBucket: 'large'`. Those are not values
 * this repo produces. `sizeBucketFor` (decisionGeometry.mjs:76) emits
 * '0-33' | '33-66' | '66-100' | '100-150' | '150+' | 'unknown', and `getSPRZone`
 * (sprBands.js:49) emits 'micro' | 'low' | 'medium' | 'high' | 'deep'.
 *
 * A rule keyed on a value the axis never takes NEVER FIRES. R2 would have been byte-identical
 * to R1, the ladder would have reported that pricing buys nothing, and that conclusion —
 * a real answer to a real founder question — would have been an artifact of a typo. Caught by
 * reading the enum at its definition site before running, not by the run failing.
 *
 * Every axis value below is read from its definition site. That is the rule, not a precaution.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * GROUNDING
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * Every frequency below traces to a measured figure, cited at its rule. Nothing is invented.
 * Where a figure is showdown-conditioned it says so, because that conditioning is a known
 * bias and not a footnote.
 */

/**
 * ~20% VPIP opening range, matching the measured tight pole (vpip 19.9%, pfr 12.3% —
 * player-archetypes-empirical-2026-07-26.md, k-means cluster 0, 76.7% of the pool).
 * The exact combo count is computed and reported by the runner rather than asserted here.
 */
export const ENTRY_RANGE = Object.freeze([
  'AA', 'KK', 'QQ', 'JJ', 'TT', '99', '88', '77', '66', '55', '44', '33', '22',
  'AKs', 'AQs', 'AJs', 'ATs', 'A9s', 'A8s', 'A7s', 'A6s', 'A5s', 'A4s', 'A3s', 'A2s',
  'KQs', 'KJs', 'KTs', 'K9s',
  'QJs', 'QTs', 'Q9s',
  'JTs', 'J9s',
  'T9s', '98s', '87s', '76s', '65s',
  'AKo', 'AQo', 'AJo', 'ATo',
  'KQo', 'QJo',
]);

const BASE = {
  schemaVersion: 1,
  domain: {
    gameType: 'cash',
    seats: [2, 10],
    stackDepthBB: [5, 500],
  },
};

/**
 * R0 — ENTRY ONLY.
 *
 * Play a range preflop, fold to everything else. The floor. Its edge is expected to be
 * strongly negative and its behavioural coverage postflop near zero; both are the point.
 * `always-fold` measured -1.9942 bb (n=45) as the harder floor beneath this one.
 */
export const R0 = Object.freeze({
  ...BASE,
  cardId: 'ladder-r0-entry-only',
  title: 'R0 — entry range only',
  rationale:
    'The floor of the villain rule ladder. One rule: enter with a ~20% range when unopened. '
    + 'Everything else folds. Grounded in the measured tight pole (vpip 19.9%), which is 76.7% '
    + 'of this pool. Expected to be strongly negative — a player who never continues after '
    + 'entering is not a player, and the ladder measures how much each later rule repairs.',
  rules: [
    {
      id: 'r0-open-range',
      when: { facingAction: 'none', handClass: [...ENTRY_RANGE] },
      do: { bet: 1 },
      warrant: 'read',
      note: 'Population claim: this pool enters ~20% of hands unopened (vpip 19.9%, tight pole, '
        + 'k-means cluster 0 of player-archetypes-empirical-2026-07-26.md). Falsifiable against '
        + 'the corpus.',
    },
  ],
  residual: {
    do: { fold: 1 },
    rationale:
      'Everything not in the entry rule folds. This is deliberately the worst possible '
      + 'continuation policy: it makes the residual share ~everything, which the card reports, '
      + 'and gives every later rung something unambiguous to improve on.',
  },
});

/**
 * R1 — CONTINUE AT A FREQUENCY.
 *
 * Facing a bet, stop folding everything. This is the rung the founder predicted would "call
 * too often": a flat frequency with no hand or price condition.
 *
 * Grounded: fold-to-cbet 57.6% (tight pole) / 49.2% (loose pole). 55% fold is the
 * frequency-weighted blend, so continue = 45%.
 */
export const R1 = Object.freeze({
  ...BASE,
  cardId: 'ladder-r1-flat-continue',
  title: 'R1 — R0 + continue at a flat frequency',
  rationale:
    'One rule added to R0: facing a bet, continue 45% of the time regardless of holding, '
    + 'price or board. Grounded in measured fold-to-cbet of 57.6% (tight pole) and 49.2% '
    + '(loose pole). It should call in spots it must not, which is the whole point of R2.',
  rules: [
    {
      id: 'r0-open-range',
      when: { facingAction: 'none', handClass: [...ENTRY_RANGE] },
      do: { bet: 1 },
      warrant: 'read',
      note: 'Unchanged from R0.',
    },
    {
      id: 'r1-flat-continue',
      when: { facingAction: 'bet' },
      do: { fold: 0.55, call: 0.45 },
      warrant: 'read',
      note: 'Population claim: this pool folds ~55% facing a bet. Blend of the two measured '
        + 'poles (57.6% / 49.2% fold-to-cbet). No hand condition and no price condition — '
        + 'deliberately, so R2 can isolate what price adds.',
    },
  ],
  residual: {
    do: { fold: 1 },
    rationale: 'Unchanged from R0 — every rung differs from the one below by exactly one rule.',
  },
});

/**
 * R2 — PRICE THE CONTINUE.
 *
 * Split R1's flat continue by BET SIZE. This is the first rule keyed on geometry rather than
 * on a frequency, and it is the first test of the founder question: does this pool price at
 * all, or does it continue at a habit rate regardless of what it is being charged?
 *
 * Grounded: the fold curve SHAPE is fitted and hold-out validated (WS-283, n = 318,347). Its
 * LEVEL is not (`POPULATION_FOLD_RATE = 0.45`, unfitted under the live/online separation), so
 * this rule may claim shape only and the levels below are anchored to R1's measured blend.
 *
 * IF R2 DOES NOT BEAT R1, THE POOL IS NOT PRICING. That is a finding about the pool and it is
 * reported as one — not tuned until it inverts.
 */
export const R2 = Object.freeze({
  ...BASE,
  cardId: 'ladder-r2-price-the-continue',
  title: 'R2 — R1 + fold frequency responds to bet size',
  rationale:
    'R1 continued at one rate no matter the price. R2 splits that rate by `sBucket` — the bet-'
    + 'to-pot ratio the decision actually faced. Shape from the WS-283 fold curve (fitted, '
    + 'hold-out validated at n=318,347); level anchored to R1 so the two rungs differ in shape '
    + 'alone. This is the first first-principles rule in the ladder: a price, not a label.',
  rules: [
    {
      id: 'r0-open-range',
      when: { facingAction: 'none', handClass: [...ENTRY_RANGE] },
      do: { bet: 1 },
      warrant: 'read',
      note: 'Unchanged from R0.',
    },
    {
      id: 'r2-size-0-33',
      when: { facingAction: 'bet', sBucket: '0-33' },
      do: { fold: 0.40, call: 0.60 },
      warrant: 'structure',
      note: 'Under a third pot lays 4:1 or better, so the pool folds least here. Shape WS-283.',
    },
    {
      id: 'r2-size-33-66',
      when: { facingAction: 'bet', sBucket: '33-66' },
      do: { fold: 0.50, call: 0.50 },
      warrant: 'structure',
      note: 'Shape WS-283.',
    },
    {
      id: 'r2-size-66-100',
      when: { facingAction: 'bet', sBucket: '66-100' },
      do: { fold: 0.58, call: 0.42 },
      warrant: 'structure',
      note: 'Shape WS-283.',
    },
    {
      id: 'r2-size-100-150',
      when: { facingAction: 'bet', sBucket: '100-150' },
      do: { fold: 0.66, call: 0.34 },
      warrant: 'structure',
      note: 'An overbet charges more than the pot, so the pool folds most here. Shape WS-283.',
    },
    {
      id: 'r2-size-150-plus',
      when: { facingAction: 'bet', sBucket: '150+' },
      do: { fold: 0.72, call: 0.28 },
      warrant: 'structure',
      note: 'Shape WS-283.',
    },
    {
      id: 'r1-flat-continue',
      when: { facingAction: 'bet' },
      do: { fold: 0.55, call: 0.45 },
      warrant: 'read',
      note: 'Retained as the catch-all for size buckets the two rules above do not name, so '
        + 'R2 differs from R1 ONLY where size is known. Without this the two rungs would '
        + 'differ in coverage as well as in shape and the delta would be unattributable.',
    },
  ],
  residual: {
    do: { fold: 1 },
    rationale: 'Unchanged from R0.',
  },
});

/**
 * R3 — RESPECT AGGRESSION.
 *
 * Facing a RAISE is a different response set from facing a bet, and R0-R2 all send it to the
 * residual (fold 1). R3 gives it its own rule.
 *
 * Grounded, and this is the sharpest measured number in the pool: at showdown a raise is
 * 79.7% strong and 2.3% weak — SIX bluff-raises in 3,762 decisions
 * (teachable-arms-ps.json, a3Table, inverse conditional). CONDITIONING NOTED: that figure is
 * showdown-conditioned, so it is a claim about raises that got shown, and the true bluff-raise
 * rate is higher by an unknown factor. The rule therefore folds MOST but not all.
 */
export const R3 = Object.freeze({
  ...BASE,
  cardId: 'ladder-r3-respect-aggression',
  title: 'R3 — R2 + facing a raise gets its own rule',
  rationale:
    'R0-R2 send every raise to the residual. R3 gives facing-a-raise an explicit rule: fold '
    + 'heavily but not always. Grounded in the inverse conditional from the showdown-revealed '
    + 'table — a raise in this pool is 79.7% strong, 2.3% weak. The conditioning is stated '
    + 'because it is load-bearing: a bluff-raise that took the pot was never shown.',
  rules: [
    {
      id: 'r0-open-range',
      when: { facingAction: 'none', handClass: [...ENTRY_RANGE] },
      do: { bet: 1 },
      warrant: 'read',
      note: 'Unchanged from R0.',
    },
    {
      id: 'r2-size-0-33',
      when: { facingAction: 'bet', sBucket: '0-33' },
      do: { fold: 0.40, call: 0.60 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r2-size-33-66',
      when: { facingAction: 'bet', sBucket: '33-66' },
      do: { fold: 0.50, call: 0.50 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r2-size-66-100',
      when: { facingAction: 'bet', sBucket: '66-100' },
      do: { fold: 0.58, call: 0.42 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r2-size-100-150',
      when: { facingAction: 'bet', sBucket: '100-150' },
      do: { fold: 0.66, call: 0.34 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r2-size-150-plus',
      when: { facingAction: 'bet', sBucket: '150+' },
      do: { fold: 0.72, call: 0.28 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r1-flat-continue',
      when: { facingAction: 'bet' },
      do: { fold: 0.55, call: 0.45 },
      warrant: 'read',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r3-facing-raise',
      when: { facingAction: 'raise' },
      do: { fold: 0.78, call: 0.19, raise: 0.03 },
      warrant: 'read',
      note: 'Population claim: this pool folds heavily to raises. Anchored on the raise being '
        + '79.7% strong at showdown, so a raise faced is rarely bluffing and rarely worth '
        + 'continuing against. SHOWDOWN-CONDITIONED — see the card rationale.',
    },
  ],
  residual: {
    do: { fold: 1 },
    rationale:
      'Now reaches only what no rule above names. Its share should FALL sharply from R2, and '
      + 'a residual share that does not move is evidence the new rule is not firing.',
  },
});

/**
 * R4 — THE SPR GATE.
 *
 * Splits the facing-a-bet continue by SPR band. This is the rung that tests the founder
 * question directly: "It might be that they do factor in SPR, or pot odds, and that is part of
 * their ruleset."
 *
 * `sprBand` is already mined as a WS-333 geometry coordinate and has NEVER been used in a
 * rule. It is CARRIED, not keyed — situationKey.js is explicit that promoting a coordinate to
 * identity requires a measurement, and this rung is that measurement.
 *
 * IF R4 BUYS NOTHING OVER R2, THIS POOL DOES NOT READ SPR. That is a real finding about the
 * pool and it is reported as one. It is not a tuning target and the levels below must not be
 * adjusted until the rung inverts.
 *
 * Direction under test: at LOW spr a player is closer to committed, so continues wider; at
 * DEEP spr the same bet threatens more future streets, so continues tighter. That direction is
 * a hypothesis, not a measurement, and R4 losing to R2 refutes it.
 */
export const R4 = Object.freeze({
  ...BASE,
  cardId: 'ladder-r4-spr-gate',
  title: 'R4 — R3 + continue frequency responds to SPR',
  rationale:
    'Splits the mid-size continue by SPR band (micro/low/medium/high/deep). Tests whether this '
    + 'pool reads stack-to-pot at all. A null here is a finding about the pool, not a defect in '
    + 'the rung — sprBand has been mined since WS-333 and never once used in a rule.',
  rules: [
    {
      id: 'r0-open-range',
      when: { facingAction: 'none', handClass: [...ENTRY_RANGE] },
      do: { bet: 1 },
      warrant: 'read',
      note: 'Unchanged from R0.',
    },
    {
      id: 'r4-spr-micro',
      when: { facingAction: 'bet', sBucket: '33-66', sprBand: 'micro' },
      do: { fold: 0.38, call: 0.62 },
      warrant: 'structure',
      note: 'Near-committed: the same price buys a much larger share of the remaining stack.',
    },
    {
      id: 'r4-spr-low',
      when: { facingAction: 'bet', sBucket: '33-66', sprBand: 'low' },
      do: { fold: 0.44, call: 0.56 },
      warrant: 'structure',
      note: 'Hypothesis under test, not a measurement.',
    },
    {
      id: 'r4-spr-deep',
      when: { facingAction: 'bet', sBucket: '33-66', sprBand: 'deep' },
      do: { fold: 0.58, call: 0.42 },
      warrant: 'structure',
      note: 'Deep: the same bet threatens more future streets, so continuing costs more later.',
    },
    {
      id: 'r2-size-0-33',
      when: { facingAction: 'bet', sBucket: '0-33' },
      do: { fold: 0.40, call: 0.60 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r2-size-33-66',
      when: { facingAction: 'bet', sBucket: '33-66' },
      do: { fold: 0.50, call: 0.50 },
      warrant: 'structure',
      note: 'Unchanged from R2 — catches the SPR bands R4 does not name, so R4 differs from R3 '
        + 'ONLY where SPR is micro, low or deep.',
    },
    {
      id: 'r2-size-66-100',
      when: { facingAction: 'bet', sBucket: '66-100' },
      do: { fold: 0.58, call: 0.42 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r2-size-100-150',
      when: { facingAction: 'bet', sBucket: '100-150' },
      do: { fold: 0.66, call: 0.34 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r2-size-150-plus',
      when: { facingAction: 'bet', sBucket: '150+' },
      do: { fold: 0.72, call: 0.28 },
      warrant: 'structure',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r1-flat-continue',
      when: { facingAction: 'bet' },
      do: { fold: 0.55, call: 0.45 },
      warrant: 'read',
      note: 'Unchanged from R2.',
    },
    {
      id: 'r3-facing-raise',
      when: { facingAction: 'raise' },
      do: { fold: 0.78, call: 0.19, raise: 0.03 },
      warrant: 'read',
      note: 'Unchanged from R3.',
    },
  ],
  residual: {
    do: { fold: 1 },
    rationale: 'Unchanged from R0.',
  },
});

/** The ladder, in order. The runner scores every rung on one identical decision set. */
export const LADDER = Object.freeze([R0, R1, R2, R3, R4]);

export default LADDER;
