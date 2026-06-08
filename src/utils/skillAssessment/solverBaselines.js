/**
 * @file Solver baseline lookup table for hero-leak detection.
 *
 * v1: Hardcoded entries for the IP cbet defense rule (~6 keys). Future rules
 * add entries here. Structure supports extension to computed baselines (via
 * gameTreeEvaluator) — the resolver path can branch on `source` field.
 *
 * Per CLAUDE.md anti-pattern: DO NOT compute solver baselines on-the-fly
 * per render. Hardcoded lookup is fast + deterministic. Computed path is
 * deferred to a future sprint with measured perf justification.
 *
 * Key format extended to 8 axes in WS-146 SPR-040 (2026-05-06):
 *   street:texture:posCategory:isAgg:isIP:facingAction:contextAction:preflopAggressor
 *
 * The 8th axis (`pfa`/`pfc`/`na`) distinguishes hero's preflop role on
 * postflop streets: cbet-defense uses `pfc` (hero called preflop), donk-
 * defense uses `pfa` (hero raised preflop). Preflop streets use `na`.
 */

const BASELINES = {
  // ─── hero-ip-cbet-overfold rule (SHIPPED v1, SPR-030 / WS-145; 8-axis SPR-040) ────
  // IP cbet defense fold-to-cbet rates by board texture × hero position.
  // Source: industry-standard solver outputs (Pio/GTOWizard); ~38% baseline
  // across textures, with minor texture-conditioning (wet boards justify
  // slightly higher fold rate due to draw equity capture; dry boards justify
  // tighter folding because villain has fewer bluffs).
  // SPR-040 narrowed to `pfc` only — donk-response cases (`pfa`) split off.
  'flop:dry:LATE:def:ip:bet:vsBet:pfc': { baseline: 0.36, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:medium:LATE:def:ip:bet:vsBet:pfc': { baseline: 0.38, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:wet:LATE:def:ip:bet:vsBet:pfc': { baseline: 0.42, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-03' },
  'flop:dry:BUTTON:def:ip:bet:vsBet:pfc': { baseline: 0.34, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:medium:BUTTON:def:ip:bet:vsBet:pfc': { baseline: 0.36, source: 'hardcoded', confidence: 0.85, lastValidatedAt: '2026-05-03' },
  'flop:wet:BUTTON:def:ip:bet:vsBet:pfc': { baseline: 0.40, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-03' },

  // ─── hero-bb-defense-width rule (SHIPPED v1, SPR-031 / WS-146 first claim; 8-axis SPR-040) ────
  // BB defense fold rate vs single open. Baselines derived from standard solver
  // outputs with the BB pot-odds discount factored in. Single texture key
  // (preflop has no board) — situation keys all share preflop:none:BIG_BLIND.
  // Not split by opener position in v1 (catalog notes v2 expansion candidate).
  // 8th axis is `na` on preflop (action IS the preflop decision).
  'preflop:none:BIG_BLIND:def:oop:raise:vsopen:na': { baseline: 0.45, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-03' },

  // ─── hero-oop-cbet-overfold rule (SHIPPED v1, SPR-040 / WS-146 second claim) ────
  // OOP cbet defense fold-to-cbet rates by board texture × hero position.
  // Mirror of v1 IP rule, structurally near-identical with adjusted baselines.
  // Source: industry-standard solver outputs (Pio/GTOWizard); OOP folds
  // ~10pp higher than IP (worse equity realization without position).
  // BB baselines slightly looser than SB — BB faces wider opens, so capped
  // wider, so fold more on dry textures.
  'flop:dry:SMALL_BLIND:def:oop:bet:vsBet:pfc': { baseline: 0.50, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-06' },
  'flop:medium:SMALL_BLIND:def:oop:bet:vsBet:pfc': { baseline: 0.48, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-06' },
  'flop:wet:SMALL_BLIND:def:oop:bet:vsBet:pfc': { baseline: 0.45, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-06' },
  'flop:dry:BIG_BLIND:def:oop:bet:vsBet:pfc': { baseline: 0.55, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-06' },
  'flop:medium:BIG_BLIND:def:oop:bet:vsBet:pfc': { baseline: 0.50, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-06' },
  'flop:wet:BIG_BLIND:def:oop:bet:vsBet:pfc': { baseline: 0.46, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-06' },

  // ─── hero-flop-vs-donk-misresponse rule (SHIPPED v1, SPR-040 / WS-146 second claim) ────
  // Hero responding to a flop donk lead (villain bets first when hero was
  // preflop aggressor). The donk signals a polarized villain range; hero's
  // call rate should track villain's bluff frequency.
  // v1 uses single baseline per (texture, position) — no donker-style split
  // (villainProfile.donkStyle not yet wired into the bucket; deferred to v2).
  // Baseline ~40% call rate represents an averaged response across donker
  // styles (passive donker → mostly call; aggressive donker → mostly fold/raise).
  // The rule fires on over-folding (hero folds too often vs donk).
  'flop:dry:LATE:def:ip:bet:vsBet:pfa': { baseline: 0.50, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-06' },
  'flop:medium:LATE:def:ip:bet:vsBet:pfa': { baseline: 0.48, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-06' },
  'flop:wet:LATE:def:ip:bet:vsBet:pfa': { baseline: 0.45, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-06' },
  'flop:dry:BUTTON:def:ip:bet:vsBet:pfa': { baseline: 0.48, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-06' },
  'flop:medium:BUTTON:def:ip:bet:vsBet:pfa': { baseline: 0.46, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-06' },
  'flop:wet:BUTTON:def:ip:bet:vsBet:pfa': { baseline: 0.43, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-06' },

  // ─── hero-pf-3bet-overfold rule (SHIPPED v1, SPR-046 / WS-146 third claim) ────
  // Hero opens preflop, faces a 3bet, fold-rate target. Single per-position
  // baseline; rule's solverBaselineKey() normalizes isIP axis to 'ip' so both
  // ip and oop bucket configurations resolve to the same lookup. Per-isIP
  // and per-3bettor-position splits are v2 expansion candidates.
  // Source: industry-standard solver outputs (Pio/GTOWizard) at 100bb, 9max
  // RFI ranges. EARLY/MIDDLE opens face 3bets with tightest opening range,
  // so fold rates are slightly lower than wider LATE/BUTTON opens (more
  // junk in late open ranges that should fold to 3bets).
  'preflop:none:EARLY:agg:ip:raise:vs3bet:na':  { baseline: 0.50, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-07' },
  'preflop:none:MIDDLE:agg:ip:raise:vs3bet:na': { baseline: 0.52, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-07' },
  'preflop:none:LATE:agg:ip:raise:vs3bet:na':   { baseline: 0.55, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-07' },
  'preflop:none:BUTTON:agg:ip:raise:vs3bet:na': { baseline: 0.55, source: 'hardcoded', confidence: 0.80, lastValidatedAt: '2026-05-07' },

  // ─── hero-oop-3bet-underfold rule (SHIPPED v1, SPR-046 / WS-146 third claim) ────
  // Hero in SB/BB called an open, then faces a 3bet (squeeze or re-isolation).
  // Solver wants high fold rate here — continuing OOP at high SPR without
  // initiative is the worst structural spot. Calling too wide bleeds chips
  // post-flop. BB baseline is slightly higher than SB because BB's flat-call
  // range is wider preflop (pot-odds discount), so a higher proportion of
  // that wider range should fold to a 3bet.
  // Confidence 0.75 (squeeze dynamics + 3bet sizing both modulate the right
  // defense width; baseline is averaged across typical sizings).
  'preflop:none:SMALL_BLIND:def:oop:raise:vs3bet:na': { baseline: 0.72, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-07' },
  'preflop:none:BIG_BLIND:def:oop:raise:vs3bet:na':   { baseline: 0.75, source: 'hardcoded', confidence: 0.75, lastValidatedAt: '2026-05-07' },

  // ─── hero-multiway-bluff-frequency rule (SHIPPED v1, SPR-108 / WS-146 fifth claim) ────
  // DECISION-bucket baseline (not an 8-axis action key). Multiway flop cbet
  // frequency: how often hero continuation-bets the flop as the preflop
  // aggressor in a 3+ way pot. Fold equity drops multiplicatively with each
  // extra player (∏ fold rates — see HERO_STATE_DESIGN.md §7.4), so the
  // profitable cbet frequency collapses from ~70% heads-up to ~10-25% multiway.
  // The rule fires on OVER-betting (cbet frequency too HIGH = bluffing too much).
  // v1 single coarse baseline (no texture/position/3way-vs-4way+ split — those
  // are v2 expansions). Conservative high-end baseline (0.25) + 5pp delta means
  // the rule only flags clear over-continuation (>30%), avoiding false positives
  // on the sparser multiway sample. Confidence 0.70 (lower than fold-rate
  // baselines — multiway solver data is sparser + the metric mixes value+bluff
  // cbets; a high observed frequency is dominated by over-bluffing because the
  // value fraction is small multiway).
  'flop:cbet-decision:mw': { baseline: 0.25, source: 'hardcoded', confidence: 0.70, lastValidatedAt: '2026-06-06' },
};

/**
 * Look up the solver baseline for a situation key.
 *
 * @param {string} situationKey
 * @returns {{baseline: number, source: 'hardcoded'|'computed', confidence: number, lastValidatedAt: string}|null}
 */
export const getSolverBaseline = (situationKey) => {
  return BASELINES[situationKey] || null;
};

/**
 * @returns {string[]} - All situation keys with baseline coverage.
 */
export const listCoveredSituationKeys = () => Object.keys(BASELINES).sort();

/**
 * Diagnostic: which categories of leak rules currently have baseline coverage?
 * Used by tests + the leak-catalog status updater.
 */
export const baselineCoverageByPrefix = () => {
  const counts = {};
  for (const key of Object.keys(BASELINES)) {
    const prefix = key.split(':').slice(0, 3).join(':'); // street:texture:posCategory
    counts[prefix] = (counts[prefix] || 0) + 1;
  }
  return counts;
};
