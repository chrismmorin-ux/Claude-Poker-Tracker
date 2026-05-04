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

  // ─── Tier 4 — preflop blocker effects ─────────────────────────────────
  'blocker-effects-preflop': { kind: 'general-skill', tier: 4, parent: null, children: [] },

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
  'flop:dry:LATE:def:ip:bet:cbet':       'ip-cbet-defense-dry-LATE',
  'flop:dry:BUTTON:def:ip:bet:cbet':     'ip-cbet-defense-dry-BUTTON',
  'flop:medium:LATE:def:ip:bet:cbet':    'ip-cbet-defense-medium-LATE',
  'flop:medium:BUTTON:def:ip:bet:cbet':  'ip-cbet-defense-medium-BUTTON',
  'flop:wet:LATE:def:ip:bet:cbet':       'ip-cbet-defense-wet-LATE',
  'flop:wet:BUTTON:def:ip:bet:cbet':     'ip-cbet-defense-wet-BUTTON',

  // hero-bb-defense-width rule (single aggregated key today; per-opener split = WS-146 v2)
  // No sub-concept resolution yet — leak fires on the umbrella until rule splits.
  // 'preflop:none:BIG_BLIND:def:oop:raise:vsopen' intentionally absent.
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
