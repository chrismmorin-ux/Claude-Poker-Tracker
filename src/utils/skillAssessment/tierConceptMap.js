/**
 * @file SCF concept registry — single source of truth for which concepts
 * exist, what kind they are, what tier they live in, and how umbrella ↔
 * sub-concept relationships connect.
 *
 * Three concept kinds (per WS-148 / SPR-033):
 *
 *   1. `general-skill` — coarse, foundational, drill-backed concepts.
 *      Don't split per the granularity floor. Mastery comes from the
 *      drill scheduler + per-domain mastery test results.
 *      Examples: pot-odds, range-vs-range-thinking, board-texture.
 *
 *   2. `rule-anchored-umbrella` — one per leak rule (or rule cluster).
 *      The leak rule's `relatedConceptId` binds here. Lesson body lists
 *      the sub-concepts. Mastery is aggregated from children + parent-
 *      rule fire-state.
 *      Examples: cbet-defense-cluster, bb-defense-cluster.
 *
 *   3. `rule-anchored-specific` — leaf concept; one per baseline-distinct
 *      situation-key region (granularity floor). Has umbrella `parent`.
 *      Mastery = heroLeaks store entry for the matching situation key.
 *      Examples: ip-cbet-defense-dry-LATE, bb-defense-vs-EARLY.
 *
 * Per `feedback_scf_high_granularity.md` + `feedback_scf_learning_state_not_tier_rank.md`.
 *
 * Per `src/utils/skillAssessment/CLAUDE.md` source-util-policy whitelist.
 *
 * SPR-033 / WS-148 (2026-05-04).
 */

/**
 * @typedef {'general-skill' | 'rule-anchored-umbrella' | 'rule-anchored-specific'} ConceptKind
 */

/**
 * @typedef {Object} ConceptMeta
 * @property {ConceptKind} kind
 * @property {number} tier - 1..6 (authoring metadata, NEVER user-facing rank)
 * @property {string|null} parent - umbrella conceptId for sub-concepts; null otherwise
 * @property {string[]} children - sub-concept IDs for umbrellas; empty otherwise
 */

/**
 * Concept registry. Add new concepts here; everything else is derived.
 *
 * @type {Object<string, ConceptMeta>}
 */
export const CONCEPT_REGISTRY = {
  // ─── Tier 1 — fundamentals ────────────────────────────────────────────
  'pot-odds': { kind: 'general-skill', tier: 1, parent: null, children: [] },

  // ─── Tier 2 — BB defense umbrella ─────────────────────────────────────
  'bb-defense-cluster': {
    kind: 'rule-anchored-umbrella',
    tier: 2,
    parent: null,
    children: [
      'bb-defense-vs-EARLY',
      'bb-defense-vs-MIDDLE',
      'bb-defense-vs-LATE',
      'bb-defense-vs-BUTTON',
      'bb-defense-vs-SMALL_BLIND',
    ],
  },
  'bb-defense-vs-EARLY':       { kind: 'rule-anchored-specific', tier: 2, parent: 'bb-defense-cluster', children: [] },
  'bb-defense-vs-MIDDLE':      { kind: 'rule-anchored-specific', tier: 2, parent: 'bb-defense-cluster', children: [] },
  'bb-defense-vs-LATE':        { kind: 'rule-anchored-specific', tier: 2, parent: 'bb-defense-cluster', children: [] },
  'bb-defense-vs-BUTTON':      { kind: 'rule-anchored-specific', tier: 2, parent: 'bb-defense-cluster', children: [] },
  'bb-defense-vs-SMALL_BLIND': { kind: 'rule-anchored-specific', tier: 2, parent: 'bb-defense-cluster', children: [] },

  // ─── Tier 3 — postflop foundations + cbet defense umbrella ────────────
  'range-vs-range-thinking': { kind: 'general-skill', tier: 3, parent: null, children: [] },
  'board-texture':           { kind: 'general-skill', tier: 3, parent: null, children: [] },
  'cbet-defense-cluster': {
    kind: 'rule-anchored-umbrella',
    tier: 3,
    parent: null,
    children: [
      'ip-cbet-defense-dry-LATE',
      'ip-cbet-defense-dry-BUTTON',
      'ip-cbet-defense-medium-LATE',
      'ip-cbet-defense-medium-BUTTON',
      'ip-cbet-defense-wet-LATE',
      'ip-cbet-defense-wet-BUTTON',
    ],
  },
  'ip-cbet-defense-dry-LATE':      { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster', children: [] },
  'ip-cbet-defense-dry-BUTTON':    { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster', children: [] },
  'ip-cbet-defense-medium-LATE':   { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster', children: [] },
  'ip-cbet-defense-medium-BUTTON': { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster', children: [] },
  'ip-cbet-defense-wet-LATE':      { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster', children: [] },
  'ip-cbet-defense-wet-BUTTON':    { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster', children: [] },

  // ─── Tier 3 (cont.) — OOP cbet defense umbrella (SPR-040 / WS-146 second claim) ────
  'oop-cbet-defense-cluster': {
    kind: 'rule-anchored-umbrella',
    tier: 3,
    parent: null,
    children: [
      'oop-cbet-defense-dry-SB',
      'oop-cbet-defense-dry-BB',
      'oop-cbet-defense-medium-SB',
      'oop-cbet-defense-medium-BB',
      'oop-cbet-defense-wet-SB',
      'oop-cbet-defense-wet-BB',
    ],
  },
  'oop-cbet-defense-dry-SB':    { kind: 'rule-anchored-specific', tier: 3, parent: 'oop-cbet-defense-cluster', children: [] },
  'oop-cbet-defense-dry-BB':    { kind: 'rule-anchored-specific', tier: 3, parent: 'oop-cbet-defense-cluster', children: [] },
  'oop-cbet-defense-medium-SB': { kind: 'rule-anchored-specific', tier: 3, parent: 'oop-cbet-defense-cluster', children: [] },
  'oop-cbet-defense-medium-BB': { kind: 'rule-anchored-specific', tier: 3, parent: 'oop-cbet-defense-cluster', children: [] },
  'oop-cbet-defense-wet-SB':    { kind: 'rule-anchored-specific', tier: 3, parent: 'oop-cbet-defense-cluster', children: [] },
  'oop-cbet-defense-wet-BB':    { kind: 'rule-anchored-specific', tier: 3, parent: 'oop-cbet-defense-cluster', children: [] },

  // ─── Tier 4 — preflop blocker effects ─────────────────────────────────
  'blocker-effects-preflop': { kind: 'general-skill', tier: 4, parent: null, children: [] },

  // ─── Tier 4 (cont.) — flop-vs-donk defense umbrella (SPR-040 / WS-146 second claim) ────
  // Tier 4 because donk-response requires range/donker-style read on top of
  // cbet-defense fundamentals. Single baseline per (texture × position) for v1.
  'flop-vs-donk-defense-cluster': {
    kind: 'rule-anchored-umbrella',
    tier: 4,
    parent: null,
    children: [
      'flop-vs-donk-defense-dry-LATE',
      'flop-vs-donk-defense-dry-BUTTON',
      'flop-vs-donk-defense-medium-LATE',
      'flop-vs-donk-defense-medium-BUTTON',
      'flop-vs-donk-defense-wet-LATE',
      'flop-vs-donk-defense-wet-BUTTON',
    ],
  },
  'flop-vs-donk-defense-dry-LATE':      { kind: 'rule-anchored-specific', tier: 4, parent: 'flop-vs-donk-defense-cluster', children: [] },
  'flop-vs-donk-defense-dry-BUTTON':    { kind: 'rule-anchored-specific', tier: 4, parent: 'flop-vs-donk-defense-cluster', children: [] },
  'flop-vs-donk-defense-medium-LATE':   { kind: 'rule-anchored-specific', tier: 4, parent: 'flop-vs-donk-defense-cluster', children: [] },
  'flop-vs-donk-defense-medium-BUTTON': { kind: 'rule-anchored-specific', tier: 4, parent: 'flop-vs-donk-defense-cluster', children: [] },
  'flop-vs-donk-defense-wet-LATE':      { kind: 'rule-anchored-specific', tier: 4, parent: 'flop-vs-donk-defense-cluster', children: [] },
  'flop-vs-donk-defense-wet-BUTTON':    { kind: 'rule-anchored-specific', tier: 4, parent: 'flop-vs-donk-defense-cluster', children: [] },

  // ─── Tier 4 (cont.) — preflop 3bet defense umbrellas (SPR-046 / WS-146 third claim) ────
  // hero-pf-3bet-overfold: hero opens preflop, faces 3bet, over-folds.
  // 4 sub-concepts (one per opener position). Both isIP variants resolve to
  // the same sub-concept since the v1 baseline is position-only (the rule's
  // solverBaselineKey normalizes isIP for lookup).
  'pf-3bet-defense-cluster': {
    kind: 'rule-anchored-umbrella',
    tier: 4,
    parent: null,
    children: [
      'pf-3bet-defense-EARLY',
      'pf-3bet-defense-MIDDLE',
      'pf-3bet-defense-LATE',
      'pf-3bet-defense-BUTTON',
    ],
  },
  'pf-3bet-defense-EARLY':  { kind: 'rule-anchored-specific', tier: 4, parent: 'pf-3bet-defense-cluster', children: [] },
  'pf-3bet-defense-MIDDLE': { kind: 'rule-anchored-specific', tier: 4, parent: 'pf-3bet-defense-cluster', children: [] },
  'pf-3bet-defense-LATE':   { kind: 'rule-anchored-specific', tier: 4, parent: 'pf-3bet-defense-cluster', children: [] },
  'pf-3bet-defense-BUTTON': { kind: 'rule-anchored-specific', tier: 4, parent: 'pf-3bet-defense-cluster', children: [] },

  // hero-oop-3bet-underfold: hero in SB/BB called open, faces 3bet, under-folds.
  // First UNDER-fold rule in the catalog; mirror direction of all over-fold
  // rules. 2 sub-concepts (SB + BB).
  'oop-3bet-defense-cluster': {
    kind: 'rule-anchored-umbrella',
    tier: 4,
    parent: null,
    children: [
      'oop-3bet-defense-SB',
      'oop-3bet-defense-BB',
    ],
  },
  'oop-3bet-defense-SB': { kind: 'rule-anchored-specific', tier: 4, parent: 'oop-3bet-defense-cluster', children: [] },
  'oop-3bet-defense-BB': { kind: 'rule-anchored-specific', tier: 4, parent: 'oop-3bet-defense-cluster', children: [] },

  // ─── Tier 5 — capped vs uncapped range awareness ──────────────────────
  'capped-vs-uncapped-ranges': { kind: 'general-skill', tier: 5, parent: null, children: [] },
};

// ─── Reverse map: situation-key → most-specific conceptId ───────────────
//
// Drives `conceptMastery.computeConceptMastery` for rule-anchored-specific
// concepts. When a leak fires on a bucket whose situation key appears here,
// the resolved sub-concept is the value. If no entry matches, the parent
// umbrella absorbs the fire-state (e.g., bb-defense rule fires on a single
// key today; per-opener-position rule splits in WS-146 will populate more
// entries).

/**
 * @type {Object<string, string>}
 */
export const SITUATION_KEY_TO_CONCEPT = {
  // hero-ip-cbet-overfold rule (6 keys, fully resolved)
  // SPR-040: keys migrated to 8-axis format with `:vsBet:pfc` (was `:bet:cbet`,
  // which was a stale bug — rule emits `:bet:vsBet`, not `:bet:cbet`).
  // 8th axis `:pfc` matches the rule's narrowed scope (hero called preflop).
  'flop:dry:LATE:def:ip:bet:vsBet:pfc':       'ip-cbet-defense-dry-LATE',
  'flop:dry:BUTTON:def:ip:bet:vsBet:pfc':     'ip-cbet-defense-dry-BUTTON',
  'flop:medium:LATE:def:ip:bet:vsBet:pfc':    'ip-cbet-defense-medium-LATE',
  'flop:medium:BUTTON:def:ip:bet:vsBet:pfc':  'ip-cbet-defense-medium-BUTTON',
  'flop:wet:LATE:def:ip:bet:vsBet:pfc':       'ip-cbet-defense-wet-LATE',
  'flop:wet:BUTTON:def:ip:bet:vsBet:pfc':     'ip-cbet-defense-wet-BUTTON',

  // hero-oop-cbet-overfold rule (6 keys, fully resolved; SPR-040 / WS-146 second claim)
  'flop:dry:SMALL_BLIND:def:oop:bet:vsBet:pfc':       'oop-cbet-defense-dry-SB',
  'flop:medium:SMALL_BLIND:def:oop:bet:vsBet:pfc':    'oop-cbet-defense-medium-SB',
  'flop:wet:SMALL_BLIND:def:oop:bet:vsBet:pfc':       'oop-cbet-defense-wet-SB',
  'flop:dry:BIG_BLIND:def:oop:bet:vsBet:pfc':         'oop-cbet-defense-dry-BB',
  'flop:medium:BIG_BLIND:def:oop:bet:vsBet:pfc':      'oop-cbet-defense-medium-BB',
  'flop:wet:BIG_BLIND:def:oop:bet:vsBet:pfc':         'oop-cbet-defense-wet-BB',

  // hero-flop-vs-donk-misresponse rule (6 keys, fully resolved; SPR-040 / WS-146 second claim)
  // The 8th axis `:pfa` distinguishes from the IP cbet-defense bucket above.
  'flop:dry:LATE:def:ip:bet:vsBet:pfa':       'flop-vs-donk-defense-dry-LATE',
  'flop:medium:LATE:def:ip:bet:vsBet:pfa':    'flop-vs-donk-defense-medium-LATE',
  'flop:wet:LATE:def:ip:bet:vsBet:pfa':       'flop-vs-donk-defense-wet-LATE',
  'flop:dry:BUTTON:def:ip:bet:vsBet:pfa':     'flop-vs-donk-defense-dry-BUTTON',
  'flop:medium:BUTTON:def:ip:bet:vsBet:pfa':  'flop-vs-donk-defense-medium-BUTTON',
  'flop:wet:BUTTON:def:ip:bet:vsBet:pfa':     'flop-vs-donk-defense-wet-BUTTON',

  // hero-bb-defense-width rule (single aggregated key today; per-opener split = WS-146 v2)
  // No sub-concept resolution yet — leak fires on the umbrella until rule splits.
  // 'preflop:none:BIG_BLIND:def:oop:raise:vsopen:na' intentionally absent.

  // hero-pf-3bet-overfold rule (SPR-046 / WS-146 third claim)
  // 8 entries (4 positions × 2 isIP variants); both isIP variants per position
  // resolve to the same sub-concept since v1 baselines don't split on isIP.
  // Per-isIP sub-concept split is a v2 expansion candidate.
  'preflop:none:EARLY:agg:ip:raise:vs3bet:na':   'pf-3bet-defense-EARLY',
  'preflop:none:EARLY:agg:oop:raise:vs3bet:na':  'pf-3bet-defense-EARLY',
  'preflop:none:MIDDLE:agg:ip:raise:vs3bet:na':  'pf-3bet-defense-MIDDLE',
  'preflop:none:MIDDLE:agg:oop:raise:vs3bet:na': 'pf-3bet-defense-MIDDLE',
  'preflop:none:LATE:agg:ip:raise:vs3bet:na':    'pf-3bet-defense-LATE',
  'preflop:none:LATE:agg:oop:raise:vs3bet:na':   'pf-3bet-defense-LATE',
  'preflop:none:BUTTON:agg:ip:raise:vs3bet:na':  'pf-3bet-defense-BUTTON',
  'preflop:none:BUTTON:agg:oop:raise:vs3bet:na': 'pf-3bet-defense-BUTTON',

  // hero-oop-3bet-underfold rule (SPR-046 / WS-146 third claim)
  // 2 entries (SB + BB).
  'preflop:none:SMALL_BLIND:def:oop:raise:vs3bet:na': 'oop-3bet-defense-SB',
  'preflop:none:BIG_BLIND:def:oop:raise:vs3bet:na':   'oop-3bet-defense-BB',
};

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * @param {string} conceptId
 * @returns {ConceptKind | null}
 */
export const getConceptKind = (conceptId) => CONCEPT_REGISTRY[conceptId]?.kind || null;

/**
 * @param {string} conceptId
 * @returns {number | null}
 */
export const getTierForConcept = (conceptId) => CONCEPT_REGISTRY[conceptId]?.tier || null;

/**
 * @param {number} tier
 * @returns {string[]}
 */
export const listConceptsForTier = (tier) =>
  Object.entries(CONCEPT_REGISTRY)
    .filter(([, meta]) => meta.tier === tier)
    .map(([id]) => id);

/**
 * @param {string} conceptId
 * @returns {string[]}
 */
export const getChildrenOf = (conceptId) => CONCEPT_REGISTRY[conceptId]?.children || [];

/**
 * @param {string} conceptId
 * @returns {string | null}
 */
export const getParentOf = (conceptId) => CONCEPT_REGISTRY[conceptId]?.parent || null;

/**
 * @returns {string[]} - all registered concept IDs (sorted)
 */
export const getAllConceptIds = () => Object.keys(CONCEPT_REGISTRY).sort();

/**
 * @returns {string[]} - umbrella concept IDs only
 */
export const getAllUmbrellaIds = () =>
  Object.entries(CONCEPT_REGISTRY)
    .filter(([, meta]) => meta.kind === 'rule-anchored-umbrella')
    .map(([id]) => id)
    .sort();

/**
 * Resolve a fired-leak's situation key to its most-specific concept.
 * Falls back to the rule's static relatedConceptId if no entry matches.
 *
 * @param {string} situationKey
 * @returns {string | null}
 */
export const resolveSituationKeyToConcept = (situationKey) =>
  SITUATION_KEY_TO_CONCEPT[situationKey] || null;
