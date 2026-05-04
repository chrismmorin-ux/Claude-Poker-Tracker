/**
 * @file Hero State Primitive — type schema (JSDoc typedefs + enum const arrays).
 *
 * HeroState is a hero-perspective synthesis primitive: "where I am, what's my
 * plan." It composes outputs from rangeEngine, villainProfileBuilder, and
 * gameTreeEvaluator into a single object that downstream consumers (live
 * advisor, PRF playbook cards, HandReplay review, SCF leak detector) can
 * render uniformly. See `docs/HERO_STATE_DESIGN.md` for full motivation and
 * worked examples.
 *
 * This file is **types only** — no runtime classification or builder logic.
 * It exists to validate the data shape and let downstream tickets (HSP-B1
 * classifyArchetype, HSP-B2 buildHeroState orchestrator) consume stable
 * typedefs.
 *
 * First-principles guard (POKER_THEORY.md §7, exploitEngine/CLAUDE.md):
 * `archetypeId` and `archetypeFamily` are OUTPUTS of classification, never
 * INPUTS to plan computation. Plan EVs come from equity / SPR / pot odds /
 * players remaining, computed in gameTreeEvaluator. Templates are
 * presentation; plans are computed.
 */

import { SPR_ZONES, getSPRZone } from '../exploitEngine/gameTreeConstants.js';

export { SPR_ZONES, getSPRZone };

// ─── Enums (exported as const arrays — accept criterion #2) ──────────────

/**
 * Archetype families — coarse grouping of archetype IDs. Authoring the
 * narrative template happens at archetype-ID granularity (e.g.,
 * `FLOP_SRP_HU_OOP_CBET`); the family groups archetypes that share the
 * same broad situation for routing. v1: preflop + flop only; turn/river
 * deferred per design doc §4.4–§4.5.
 */
export const ARCHETYPE_FAMILIES = [
  'PREFLOP_OPEN',
  'PREFLOP_VS_OPEN',
  'PREFLOP_3BET',
  'PREFLOP_VS_3BET',
  'PREFLOP_LIMP_NAV',
  'FLOP_SRP_HU_CBET',
  'FLOP_SRP_HU_VS_CBET',
  'FLOP_3BP_HU_CBET',
  'FLOP_3BP_HU_VS_CBET',
  'FLOP_MULTIWAY',
  'FLOP_VS_DONK',
];

/**
 * Stable archetype IDs — the 18 v1 catalog entries (8 preflop + 10 flop).
 * IDs are the binding surface for narrative templates (per design doc §3
 * open question: enum over hash). classifyArchetype() output is one of these.
 *
 * Turn/river IDs deferred to v2 (§4.4–§4.5).
 */
export const ARCHETYPE_IDS = [
  // Preflop (8) — see design doc §4.2
  'PF_OPEN_RFI',
  'PF_VS_OPEN_BB',
  'PF_VS_OPEN_SB',
  'PF_VS_OPEN_IP',
  'PF_3BET',
  'PF_SQUEEZE',
  'PF_VS_3BET',
  'PF_LIMP_NAV',
  // Flop (10) — see design doc §4.3
  'FLOP_SRP_HU_IP_CBET',
  'FLOP_SRP_HU_OOP_CBET',
  'FLOP_SRP_HU_IP_VS_CBET',
  'FLOP_SRP_HU_OOP_VS_CBET',
  'FLOP_3BP_HU_IP_CBET',
  'FLOP_3BP_HU_OOP_CBET',
  'FLOP_3BP_VS_CBET_IP',
  'FLOP_3BP_VS_CBET_OOP',
  'FLOP_MULTIWAY',
  'FLOP_VS_DONK',
];

/**
 * Action contexts. Identifies the structural decision the hero faces.
 * `LIMP_NAV` covers walking into a limped pot; `MULTIWAY` covers 3+ players
 * postflop where HU range-vs-range reasoning breaks down (design doc §7.4).
 */
export const ACTION_CONTEXTS = [
  'OPEN',
  'VS_OPEN',
  '3BET',
  'VS_3BET',
  'SQUEEZE',
  'VS_SQUEEZE',
  'LIMP_NAV',
  'CBET',
  'VS_CBET',
  'BARREL',
  'VS_BARREL',
  'PROBE',
  'DONK',
  'VS_DONK',
  'MULTIWAY',
];

/** Position class. */
export const POSITION_CLASSES = ['EP', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];

/** Streets. */
export const STREETS = ['preflop', 'flop', 'turn', 'river'];

/** Hand class — coarse range-position descriptor. */
export const HAND_CLASSES = [
  'TOP_OF_RANGE',
  'MIDDLE_OF_RANGE',
  'BOTTOM',
  'DRAW',
  'AIR',
  'BLOCKER',
];

/** Hand strength — fine-grained absolute strength. */
export const HAND_STRENGTHS = [
  'PREMIUM',
  'OVERPAIR',
  'TPTK',
  'TP_WEAK_KICKER',
  'MIDDLE_PAIR',
  'UNDERPAIR',
  'DRAW_STRONG',
  'DRAW_WEAK',
  'AIR_BLOCKER',
  'AIR',
];

/**
 * Board texture. Preflop: null. Postflop: one or more (e.g., a board can be
 * both PAIRED and TWO_TONE). Consumers should treat this as a primary
 * texture descriptor; multi-axis classification lives in pokerCore/boardTexture.
 */
export const BOARD_TEXTURES = [
  'DRY',
  'DYNAMIC',
  'PAIRED',
  'MONOTONE',
  'TWO_TONE',
  'CONNECTED',
  'HIGH',
  'LOW',
  'ACE_HIGH',
];

/** Range / nut advantage values. */
export const ADVANTAGE_VALUES = ['hero', 'villain', 'neutral'];

/** Plan actions — what the hero recommends doing at this decision point. */
export const PLAN_ACTIONS = ['FOLD', 'CHECK', 'CALL', 'BET', 'RAISE'];

// ─── Typedefs ────────────────────────────────────────────────────────────

/**
 * Stable archetype identifier. Per design doc §3 open question: lean enum
 * over hash because narrative templates need stable IDs to bind to. Format
 * is `<STREET>_<CONTEXT>_<...modifiers>` (e.g., `FLOP_3BP_HU_OOP_CBET`).
 *
 * v1 catalog: 8 preflop + 10 flop = 18 IDs (see design doc §4.2–§4.3).
 *
 * @typedef {string} ArchetypeId
 */

/**
 * Coarse situation axes — derived from raw game state (street, action
 * sequence, pot, stacks, board, position). Computed in HSP-B2.
 *
 * @typedef {object} Situation
 * @property {('preflop'|'flop'|'turn'|'river')} street
 * @property {string} actionContext - One of {@link ACTION_CONTEXTS}.
 * @property {string} positionClass - One of {@link POSITION_CLASSES}.
 * @property {boolean|null} inPosition - Null preflop until closing action resolved.
 * @property {number} playersRemaining - Players who can still act in the hand.
 * @property {string|null} sprZone - One of {@link SPR_ZONES} values; null when SPR unknown.
 * @property {number} pot - Pot size in big blinds.
 * @property {number} effStack - Effective stack in big blinds.
 * @property {{pct: number, cap: number, noFlopNoDrop: boolean}|null} rake - Cash rake config; null for tournaments.
 * @property {('SRP'|'3BP'|'4BP'|'LIMPED')|null} potType - Postflop pot
 *   structure derived from preflop action history. null preflop. Used by
 *   classifyArchetype to disambiguate flop archetypes (SRP vs 3BP). 4BP
 *   maps to 3BP for archetype routing per design doc §4.3.1; lower-SPR
 *   adjustments come from sprZone, not archetype.
 */

/**
 * Fine hand-in-context axes — how this specific hero hand relates to its
 * own range, villain's range, and the board.
 *
 * @typedef {object} HandContext
 * @property {[string, string]} hand - Hero's two hole cards (e.g., ['As', 'Kh']).
 * @property {string} handClass - One of {@link HAND_CLASSES}.
 * @property {string} handStrength - One of {@link HAND_STRENGTHS}.
 * @property {('hero'|'villain'|'neutral')} rangeAdvantage
 * @property {('hero'|'villain'|'neutral')} nutAdvantage
 * @property {string|null} boardTexture - One of {@link BOARD_TEXTURES}; null preflop.
 */

/**
 * Equity decomposed against villain range parts. Requires the rangeEngine
 * to expose villain range partitioned by class — HSP-G1 (WS-137) audits
 * whether this exists or whether a `villainRangePartitioner.js` is
 * needed.
 *
 * @typedef {object} EquityVsRangeParts
 * @property {number} vsValue - Hero hand equity vs villain's value combos (0..1).
 * @property {number} vsBluff - vs bluffs / capped floats.
 * @property {number} vsDraw - vs draws.
 * @property {number} vsAir - vs air.
 */

/**
 * Equity decomposition.
 *
 * @typedef {object} Equity
 * @property {number} overall - Hero hand equity vs full villain range (0..1).
 * @property {EquityVsRangeParts} vsRangeParts - Equity broken down by villain range part.
 * @property {number} realization - R(equity) given position, SPR, hand class (typically 0.85..1.10).
 * @property {number} realizedEquity - overall × realization.
 */

/**
 * Primary plan — the recommended action at this decision point. EV is
 * computed in gameTreeEvaluator from equity / SPR / pot odds / players
 * remaining (NEVER from archetypeId — see first-principles guard at top
 * of this file).
 *
 * @typedef {object} PlanPrimary
 * @property {string} action - One of {@link PLAN_ACTIONS}.
 * @property {number|null} sizing - bb (preflop) or fraction-of-pot (postflop). Null for FOLD/CHECK.
 * @property {string} sizingRationale - Short human-readable rationale (e.g., "thin value vs capped range").
 * @property {number} ev - EV of primary action in big blinds.
 */

/**
 * Conditional branch — alternate plan that fires when a trigger condition
 * holds (e.g., "if villain raises >2.5x").
 *
 * @typedef {object} PlanBranch
 * @property {string} trigger - Plain-language condition.
 * @property {string} action - One of {@link PLAN_ACTIONS}.
 * @property {number|null} sizing - Same units as PlanPrimary.sizing.
 * @property {string} rationale
 * @property {number} ev
 */

/**
 * One row of a tight-vs-wide range configuration (e.g., for HJ open-raise:
 * tight=top-15%, wide=top-22%).
 *
 * @typedef {object} RangeConfigEntry
 * @property {string[]} hands - Hand combos / range notation.
 * @property {string} bias - Free-text descriptor (e.g., 'value-heavy' | 'balanced').
 * @property {string[]} triggers - Conditions under which this row applies.
 */

/**
 * Range configuration — present on archetypes where the recommended range
 * adapts to game-state conditions (e.g., open ranges by position, c-bet
 * ranges by board). Null when not applicable.
 *
 * @typedef {object} RangeConfig
 * @property {RangeConfigEntry} tight
 * @property {RangeConfigEntry} wide
 */

/**
 * Plan tree. The primary action plus branched alternatives plus optional
 * range configuration.
 *
 * @typedef {object} Plan
 * @property {PlanPrimary} primary
 * @property {PlanBranch[]} branches
 * @property {RangeConfig|null} rangeConfig
 */

/**
 * Adjustment delta — modifications applied on top of the primary plan when
 * a tendency condition fires. Stack via {@link Adjustment}; composition
 * rule (multiply / sum / precedence) is an open design question per
 * design doc §7.2 and is the responsibility of the consumer for v1.
 *
 * @typedef {object} AdjustmentDelta
 * @property {number} [sizingMultiplier] - Multiplier on PlanPrimary.sizing.
 * @property {boolean} [polarize] - Shift to a polarized betting mode.
 * @property {number} [bluffFreq] - Override bluff frequency (0..1).
 * @property {string} [actionOverride] - One of {@link PLAN_ACTIONS}; replaces PlanPrimary.action when present.
 */

/**
 * Tendency-triggered adjustment.
 *
 * @typedef {object} Adjustment
 * @property {string} condition - Plain-language villain-tendency trigger (e.g., 'villain is calling station').
 * @property {AdjustmentDelta} delta
 * @property {string} rationale
 */

/**
 * Rendered narrative — the human-readable presentation layer. Authored
 * once per archetype; interpolates computed values from the rest of the
 * HeroState at render time.
 *
 * @typedef {object} Narrative
 * @property {string} headline - One-line summary (e.g., "AJo on HJ — standard open").
 * @property {string} body - Multi-paragraph explanation referencing computed values.
 * @property {string} branchSummary - Short summary of branches ("If called from BTN, tighten on flop").
 */

/**
 * Hero State — the top-level synthesis primitive.
 *
 * @typedef {object} HeroState
 * @property {ArchetypeId} archetypeId - Stable identifier; v1 catalog has 18 (8 PF + 10 flop).
 * @property {string} archetypeFamily - One of {@link ARCHETYPE_FAMILIES}.
 * @property {Situation} situation - Coarse axes derived from game state.
 * @property {HandContext} handContext - Fine axes derived from hand vs range vs board.
 * @property {Equity} equity - Equity decomposition.
 * @property {Plan} plan - Recommended plan tree.
 * @property {Adjustment[]} adjustments - Tendency-triggered modifications stacked on top.
 * @property {Narrative} narrative - Rendered presentation layer.
 */
