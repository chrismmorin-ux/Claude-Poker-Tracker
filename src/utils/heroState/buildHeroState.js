/**
 * @file HSP-B2 buildHeroState() — orchestrator that composes the HSP primitives
 * (classifier, role-translator, types, templates) plus the existing engines
 * (gameTreeEvaluator, villainProfileBuilder, boardTexture, etc.) into a
 * complete HeroState object per src/utils/heroState/types.js.
 *
 * Failure mode (per WS-142 plan-mode resolution 2026-05-03):
 *   Two-tier — gameState + heroHand REQUIRED (throw if missing); villainProfile
 *   + villainRange + villainModel OPTIONAL (soft-degrade with null fields when
 *   missing). Caller knows what they got based on which fields are populated.
 *
 * Caching (per WS-142 plan-mode resolution): deferred for v1. Re-derives every
 * call. Caller can cache by decision-key hash if perf measurements warrant.
 *
 * Composition order (Step 4): equity + plan computed in parallel via Promise.all.
 * Both internally call segmentRange — minor duplicate work — but keeping the
 * primitives independent is the cleaner v1 contract.
 *
 * First-principles guard (POKER_THEORY.md §7 + exploitEngine/CLAUDE.md):
 * plans come from gameTreeEvaluator (equity / SPR / pot odds / players
 * remaining), NEVER from archetypeId lookup. Templates only render. The
 * orchestrator's job is composition, not decision-making.
 */

import { classifyArchetype } from './classifyArchetype.js';
import { computeEquityVsRangeParts } from './equityVsRangeParts.js';
import { loadTemplate } from './loadTemplates.js';
import { interpolateTemplate } from './interpolateTemplate.js';
import { composeAdjustments } from './composeAdjustments.js';
import { ARCHETYPE_FAMILIES, getSPRZone } from './types.js';
import { analyzeBoardTexture } from '../pokerCore/boardTexture.js';

// ─── archetypeId → family lookup ─────────────────────────────────────────

const ARCHETYPE_FAMILY_MAP = {
  PF_OPEN_RFI: 'PREFLOP_OPEN',
  PF_VS_OPEN_BB: 'PREFLOP_VS_OPEN',
  PF_VS_OPEN_SB: 'PREFLOP_VS_OPEN',
  PF_VS_OPEN_IP: 'PREFLOP_VS_OPEN',
  PF_3BET: 'PREFLOP_3BET',
  PF_SQUEEZE: 'PREFLOP_3BET',
  PF_VS_3BET: 'PREFLOP_VS_3BET',
  PF_LIMP_NAV: 'PREFLOP_LIMP_NAV',
  FLOP_SRP_HU_IP_CBET: 'FLOP_SRP_HU_CBET',
  FLOP_SRP_HU_OOP_CBET: 'FLOP_SRP_HU_CBET',
  FLOP_SRP_HU_IP_VS_CBET: 'FLOP_SRP_HU_VS_CBET',
  FLOP_SRP_HU_OOP_VS_CBET: 'FLOP_SRP_HU_VS_CBET',
  FLOP_3BP_HU_IP_CBET: 'FLOP_3BP_HU_CBET',
  FLOP_3BP_HU_OOP_CBET: 'FLOP_3BP_HU_CBET',
  FLOP_3BP_VS_CBET_IP: 'FLOP_3BP_HU_VS_CBET',
  FLOP_3BP_VS_CBET_OOP: 'FLOP_3BP_HU_VS_CBET',
  FLOP_MULTIWAY: 'FLOP_MULTIWAY',
  // WS-154 multiway potType split — all three sub-archetypes map to the
  // same FLOP_MULTIWAY family (no new ARCHETYPE_FAMILIES entry).
  FLOP_MULTIWAY_SRP: 'FLOP_MULTIWAY',
  FLOP_MULTIWAY_3BP: 'FLOP_MULTIWAY',
  FLOP_MULTIWAY_LIMPED: 'FLOP_MULTIWAY',
  FLOP_VS_DONK: 'FLOP_VS_DONK',
  // Turn (12) — WS-153
  TURN_SRP_BARREL_IP: 'TURN_SRP_BARREL',
  TURN_SRP_BARREL_OOP: 'TURN_SRP_BARREL',
  TURN_SRP_VS_BARREL_IP: 'TURN_SRP_VS_BARREL',
  TURN_SRP_VS_BARREL_OOP: 'TURN_SRP_VS_BARREL',
  TURN_3BP_BARREL_IP: 'TURN_3BP_BARREL',
  TURN_3BP_BARREL_OOP: 'TURN_3BP_BARREL',
  TURN_3BP_VS_BARREL_IP: 'TURN_3BP_VS_BARREL',
  TURN_3BP_VS_BARREL_OOP: 'TURN_3BP_VS_BARREL',
  TURN_PROBE: 'TURN_PROBE',
  TURN_DELAYED_CBET: 'TURN_DELAYED_CBET',
  TURN_MULTIWAY: 'TURN_MULTIWAY',
  TURN_VS_DONK: 'TURN_VS_DONK',
  // River (14) — WS-153
  RIVER_SRP_BET_IP: 'RIVER_SRP_BET',
  RIVER_SRP_BET_OOP: 'RIVER_SRP_BET',
  RIVER_SRP_VS_BET_IP: 'RIVER_SRP_VS_BET',
  RIVER_SRP_VS_BET_OOP: 'RIVER_SRP_VS_BET',
  RIVER_3BP_BET_IP: 'RIVER_3BP_BET',
  RIVER_3BP_BET_OOP: 'RIVER_3BP_BET',
  RIVER_3BP_VS_BET_IP: 'RIVER_3BP_VS_BET',
  RIVER_3BP_VS_BET_OOP: 'RIVER_3BP_VS_BET',
  RIVER_PROBE: 'RIVER_PROBE',
  RIVER_DELAYED_BET: 'RIVER_DELAYED_BET',
  RIVER_MULTIWAY: 'RIVER_MULTIWAY',
  RIVER_VS_DONK: 'RIVER_VS_DONK',
  RIVER_BLOCK_BET: 'RIVER_BLOCK_BET',
  RIVER_VS_BLOCK_BET: 'RIVER_VS_BLOCK_BET',
};

// ─── Situation derivations ───────────────────────────────────────────────

/**
 * Normalize an action verb for comparison. Mirrors the convention in
 * skillAssessment/deriveSituationKey.js (NORMALIZE_ACTION) without importing
 * across the layer boundary (Path A — heroState-local per SPR-104 / WS-211).
 */
const normalizeActionVerb = (action) => {
  if (!action) return 'unknown';
  const a = String(action).toLowerCase();
  if (a.includes('fold')) return 'fold';
  if (a.includes('call')) return 'call';
  if (a.includes('raise')) return 'raise';
  if (a.includes('check')) return 'check';
  if (a.includes('bet')) return 'bet';
  return 'unknown';
};

const isAggressiveAction = (action) => {
  const v = normalizeActionVerb(action);
  return v === 'bet' || v === 'raise';
};

/**
 * Did hero raise/bet at any point on the preflop street? (pfa) vs called/limped (pfc).
 * Mirrors skillAssessment/deriveSituationKey.js DERIVE_PREFLOP_AGGRESSOR lines
 * 131-147; kept heroState-local for dependency-direction cleanliness.
 */
const wasHeroPreflopAggressor = (actionSequence, heroSeat) => {
  if (!Array.isArray(actionSequence) || heroSeat === null || heroSeat === undefined) {
    return false;
  }
  return actionSequence.some((a) => (
    a.street === 'preflop'
    && Number(a.seat) === Number(heroSeat)
    && isAggressiveAction(a.action)
  ));
};

/**
 * Did hero bet/raise on this street (any time so far in actionSequence)?
 */
const heroBetStreet = (actionSequence, street, heroSeat) => {
  if (!Array.isArray(actionSequence) || heroSeat === null || heroSeat === undefined) {
    return false;
  }
  return actionSequence.some((a) => (
    a.street === street
    && Number(a.seat) === Number(heroSeat)
    && isAggressiveAction(a.action)
  ));
};

/**
 * Did any non-hero seat bet/raise on this street?
 */
const villainBetStreet = (actionSequence, street, heroSeat) => {
  if (!Array.isArray(actionSequence)) return false;
  return actionSequence.some((a) => {
    if (a.street !== street) return false;
    if (heroSeat !== null && heroSeat !== undefined && Number(a.seat) === Number(heroSeat)) {
      return false;
    }
    return isAggressiveAction(a.action);
  });
};

/**
 * All postflop streets prior to `street` had zero aggressive actions (both
 * hero and villain checked through). For PROBE detection per design doc §4.4/§4.5
 * (turn: flop checked through; river: flop AND turn both checked through).
 */
const allPriorPostflopStreetsCheckedThrough = (actionSequence, street, heroSeat) => {
  if (street === 'turn') {
    return !heroBetStreet(actionSequence, 'flop', heroSeat)
      && !villainBetStreet(actionSequence, 'flop', heroSeat);
  }
  if (street === 'river') {
    return !heroBetStreet(actionSequence, 'flop', heroSeat)
      && !villainBetStreet(actionSequence, 'flop', heroSeat)
      && !heroBetStreet(actionSequence, 'turn', heroSeat)
      && !villainBetStreet(actionSequence, 'turn', heroSeat);
  }
  return false;
};

const countPreflopRaises = (actionSequence) => {
  if (!Array.isArray(actionSequence)) return 0;
  return actionSequence.filter(
    (a) => a.street === 'preflop' && (a.action === 'bet' || a.action === 'raise'),
  ).length;
};

/**
 * Turn/river precise context derivation from action history. Requires
 * `heroSeat` to disambiguate hero from villain in actionSequence; callers
 * that omit heroSeat fall back to the v1 heuristic via the caller of this
 * helper. Returns one of: BARREL / VS_BARREL / PROBE / CBET / VS_DONK /
 * VS_CBET (closest-match fallback).
 *
 * Ordering matters: more specific patterns are tested before more general
 * fallbacks. All paths return a valid ACTION_CONTEXTS member so the
 * classifier's "always returns a valid archetypeId" contract holds.
 */
const deriveTurnRiverContext = (gameState) => {
  const street = gameState.street;
  const actionSequence = gameState.actionSequence || [];
  const heroSeat = gameState.heroSeat;
  const priorStreet = street === 'turn' ? 'flop' : 'turn';

  const heroWasPFA = wasHeroPreflopAggressor(actionSequence, heroSeat);
  const heroBetPrior = heroBetStreet(actionSequence, priorStreet, heroSeat);
  const villainBetPrior = villainBetStreet(actionSequence, priorStreet, heroSeat);
  const heroBetCurrent = heroBetStreet(actionSequence, street, heroSeat);
  const villainBetCurrent = villainBetStreet(actionSequence, street, heroSeat);
  const priorAllCheckedThrough = allPriorPostflopStreetsCheckedThrough(
    actionSequence, street, heroSeat,
  );

  // 1. VS_DONK — hero was PFA, villain takes betting lead on current street
  //    as first aggressor (no villain bet on immediately-prior street).
  //    Captures both (a) hero checked back IP → villain donks current, and
  //    (b) hero bet prior + villain called + villain leads current (donk-
  //    into-PFA on later street).
  if (heroWasPFA && !villainBetPrior && villainBetCurrent) return 'VS_DONK';

  // 2. VS_BARREL — villain bet immediately-prior + bets current street.
  //    Hero called (or will face) continued villain aggression. Independent
  //    of hero's PFA status (covers hero-PFA-but-villain-donked-then-barrels).
  if (villainBetPrior && villainBetCurrent) return 'VS_BARREL';

  // 3. BARREL — hero was PFA and bet immediately-prior street. Archetype
  //    labels the spot; current-street bet may or may not have happened yet.
  //    On river, "axis is just 'hero bets the [current] street'" per WS-211
  //    spec — i.e., hero bet immediately-prior. Triple-barrel reads as
  //    BARREL on river (not a separate axis).
  if (heroWasPFA && heroBetPrior) return 'BARREL';

  // 4. PROBE — hero was NOT PFA, all prior postflop streets checked through,
  //    hero leads current. Capped-villain-range probing spot.
  if (!heroWasPFA && priorAllCheckedThrough && heroBetCurrent) return 'PROBE';

  // 5. CBET (delayed) — hero was PFA, did NOT bet immediately-prior, no
  //    villain bet on current (else VS_DONK above would have fired). Maps
  //    to TURN_DELAYED_CBET / RIVER_DELAYED_BET per classifier §4.4/§4.5.
  if (heroWasPFA && !heroBetPrior && !villainBetCurrent) return 'CBET';

  // Closest-match fallbacks (always-valid-archetype contract):
  //   - villain bet current with no prior-villain-bet trail and hero non-PFA
  //     → VS_CBET (callsite-vocab; classifier routes to VS_BARREL family)
  //   - hero bet current as non-PFA with no clean PROBE setup → CBET
  if (villainBetCurrent) return 'VS_CBET';
  return 'CBET';
};

/**
 * Derive HSP actionContext from a flat game state (street + action history).
 * Maps to one of ACTION_CONTEXTS per types.js.
 *
 * Precedence:
 *   1. Caller-supplied gameState.actionContext wins (live-coach + tests).
 *   2. Preflop: count of preflop raises drives OPEN / VS_OPEN / VS_3BET.
 *   3. Flop: v1 heuristic (CBET when villain hasn't bet this street, else
 *      VS_CBET). WS-211 leaves flop alone — turn/river is the precision gap.
 *   4. Turn/river WITH gameState.heroSeat: precise reconstruction via
 *      deriveTurnRiverContext (BARREL / VS_BARREL / PROBE / CBET / VS_DONK).
 *   5. Turn/river WITHOUT heroSeat: v1 heuristic (CBET/VS_CBET) — preserves
 *      backward-compat for callers that haven't been migrated yet (e.g.,
 *      HandReplay's reconstructGameStateAt as of WS-211 ship).
 */
const deriveActionContext = (gameState) => {
  if (gameState.actionContext) return gameState.actionContext;

  const street = gameState.street;
  if (street === 'preflop') {
    const raises = countPreflopRaises(gameState.actionSequence);
    if (raises === 0) return 'OPEN';
    if (raises === 1) return 'VS_OPEN';
    if (raises === 2) return 'VS_3BET';
    return 'VS_3BET';
  }

  // Turn/river precision path: enabled only when heroSeat is present in
  // gameState (callers opt into precision by passing heroSeat). Without it
  // we cannot distinguish hero from villain in actionSequence; fall through
  // to the v1 heuristic so existing callers keep working.
  if ((street === 'turn' || street === 'river')
      && gameState.heroSeat !== null
      && gameState.heroSeat !== undefined) {
    return deriveTurnRiverContext(gameState);
  }

  // Flop default + turn/river fallback: VS_CBET when anyone has bet on
  // current street, otherwise CBET. Mirrors v1 semantics.
  const hasBetThisStreet = (gameState.actionSequence || []).some(
    (a) => a.street === street && (a.action === 'bet' || a.action === 'raise'),
  );
  return hasBetThisStreet ? 'VS_CBET' : 'CBET';
};

/**
 * Derive potType per HSP Situation typedef. SRP/3BP/4BP/LIMPED.
 *
 * Raise count semantics:
 *   0 raises = no preflop raise → LIMPED
 *   1 raise  = the open → SRP
 *   2 raises = open + 3bet → 3BP
 *   3 raises = open + 3bet + 4bet → 4BP
 *   4+ raises = 5bet+ → still '4BP' for routing (rare)
 */
const derivePotType = (gameState) => {
  if (gameState.potType) return gameState.potType;
  if (gameState.street === 'preflop') return null;
  const raises = countPreflopRaises(gameState.actionSequence);
  if (raises === 0) return 'LIMPED';
  if (raises === 1) return 'SRP';
  if (raises === 2) return '3BP';
  return '4BP';
};

/**
 * Multiway hero role descriptor (WS-154 / SPR-106).
 *
 * Returns one of MULTIWAY_HERO_ROLES (PFR_LEADING / CALLER_PFR_BEHIND /
 * CALLER_PFR_ACTED / LIMPER) when playersRemaining >= 3, else null (HU).
 *
 * OUTPUT of game-state derivation, never input to plan computation
 * (POKER_THEORY §7 first-principles guard). Templates consume the slot
 * `situation.multiwayHeroRole` to differentiate hero's structural
 * position within a multiway pot; the descriptor exists so the three
 * SRP sub-archetypes (FLOP_MULTIWAY_SRP body shared across hero roles)
 * can render hero-role-specific prose without splitting into separate
 * archetype IDs.
 *
 * Routing logic (see design doc §7.4.1):
 *   - HU (playersRemaining < 3) → null
 *   - LIMPED pot → LIMPER (no PFR to distinguish from)
 *   - Hero was preflop aggressor → PFR_LEADING
 *   - Hero was caller, no villain has bet on current street → CALLER_PFR_BEHIND
 *   - Hero was caller, a villain has bet on current street → CALLER_PFR_ACTED
 *
 * @param {object} gameState - Live game state (same shape as buildHeroState arg).
 * @param {string|null} potType - Already-derived potType from derivePotType().
 * @returns {string|null}
 */
const deriveMultiwayHeroRole = (gameState, potType) => {
  const playersRemaining = gameState.playersRemaining ?? 2;
  if (playersRemaining < 3) return null;
  if (potType === 'LIMPED') return 'LIMPER';

  const heroSeat = gameState.heroSeat;
  const actionSequence = gameState.actionSequence || [];
  const street = gameState.street;

  const heroWasPFA = wasHeroPreflopAggressor(actionSequence, heroSeat);
  if (heroWasPFA) return 'PFR_LEADING';

  // Hero was a caller preflop. Distinguish whether the PFR (someone else)
  // has acted on the current street yet by checking if any villain has bet.
  const villainBetCurrent = villainBetStreet(actionSequence, street, heroSeat);
  return villainBetCurrent ? 'CALLER_PFR_ACTED' : 'CALLER_PFR_BEHIND';
};

const HSP_BOARD_TEXTURE_FROM_FLAGS = (texture) => {
  if (!texture) return null;
  if (texture.monotone) return 'MONOTONE';
  if (texture.isPaired) return 'PAIRED';
  if (texture.twoTone) return 'TWO_TONE';
  if (texture.connected >= 2) return 'CONNECTED';
  if (texture.texture === 'wet') return 'DYNAMIC';
  return 'DRY';
};

const buildSituation = (gameState) => {
  const sprZone = gameState.effStack && gameState.pot
    ? getSPRZone(gameState.effStack / gameState.pot)
    : null;
  const potType = derivePotType(gameState);
  return {
    street: gameState.street,
    actionContext: deriveActionContext(gameState),
    positionClass: gameState.heroPosition || 'BB',
    inPosition: gameState.street === 'preflop' ? null : !!gameState.inPosition,
    playersRemaining: gameState.playersRemaining ?? 2,
    sprZone,
    pot: gameState.pot ?? 0,
    effStack: gameState.effStack ?? 0,
    rake: gameState.rake ?? null,
    potType,
    // sizingFraction: caller-supplied wins (live-coach + tests). When the
    // caller omits it but pendingBetSize + pot are both present, derive
    // pendingBetSize / pot — closes the precision gap for RIVER_BLOCK_BET /
    // RIVER_VS_BLOCK_BET routing (design doc §4.5.1) when callers forget to
    // pass sizingFraction explicitly. WS-211 follow-up to SPR-103.
    sizingFraction: deriveSizingFraction(gameState),
    // Multiway hero role descriptor (WS-154 / SPR-106). null in HU; one of
    // MULTIWAY_HERO_ROLES otherwise. Output, never input — see design doc
    // §7.4.1 + deriveMultiwayHeroRole() above.
    multiwayHeroRole: deriveMultiwayHeroRole(gameState, potType),
  };
};

const deriveSizingFraction = (gameState) => {
  if (typeof gameState.sizingFraction === 'number') return gameState.sizingFraction;
  const bet = gameState.pendingBetSize;
  const pot = gameState.pot;
  if (typeof bet === 'number' && typeof pot === 'number' && pot > 0 && bet >= 0) {
    return bet / pot;
  }
  return null;
};

const buildHandContext = (gameState, heroHand, planResult) => ({
  hand: heroHand,
  // v1 minimal — handClass/handStrength derivation is intentionally simple.
  // Richer categorization can be wired in via handAnalysis/heroAnalysis.js
  // in a follow-up ticket without changing this contract.
  handClass: gameState.handClass || null,
  handStrength: gameState.handStrength || null,
  rangeAdvantage: planResult?.advantage?.rangeAdvantage || 'neutral',
  nutAdvantage: planResult?.advantage?.nutAdvantage || 'neutral',
  boardTexture: HSP_BOARD_TEXTURE_FROM_FLAGS(
    gameState.board && gameState.board.length > 0 ? analyzeBoardTexture(gameState.board) : null,
  ),
});

// ─── Plan + equity composition ───────────────────────────────────────────

/**
 * Map gameTreeEvaluator's recommendations[0] into HSP Plan typedef.
 */
const buildPlanFromGameTreeResult = (planResult) => {
  if (!planResult || !Array.isArray(planResult.recommendations) || planResult.recommendations.length === 0) {
    return { primary: null, branches: [], rangeConfig: null };
  }
  const top = planResult.recommendations[0];
  const primary = {
    action: top.action,
    sizing: top.sizing?.betSize ?? null,
    sizingRationale: top.reasoning || '',
    ev: typeof top.ev === 'number' ? top.ev : 0,
  };
  const branches = [];
  const vr = top.villainResponse || {};
  for (const [trigger, branch] of Object.entries(vr)) {
    if (!branch || typeof branch !== 'object') continue;
    branches.push({
      trigger,
      action: branch.heroResponse || trigger,
      sizing: null,
      rationale: '',
      ev: typeof branch.ev === 'number' ? branch.ev : 0,
    });
  }
  return { primary, branches, rangeConfig: null };
};

const deriveVillainStyle = (villainProfile) => {
  if (!villainProfile) return null;
  return {
    style: villainProfile.style || null,
    polarization: villainProfile.rangeShape?.polarization ?? 0,
    capped: !!villainProfile.rangeShape?.capped,
  };
};

const buildEquity = (planResult, vsRangePartsResult) => {
  const overall = planResult?.heroEquity ?? null;
  const vsRangeParts = vsRangePartsResult ? {
    vsValue: vsRangePartsResult.vsValue,
    vsBluff: vsRangePartsResult.vsBluff,
    vsDraw: vsRangePartsResult.vsDraw,
    vsAir: vsRangePartsResult.vsAir,
  } : null;
  // Realization is computed by gameTreeEvaluator and bundled into recommendations
  // for the v1 surface; we expose a simple pass-through here. Realization can be
  // refined in a follow-up using gameTreeEquity.adjustedRealization() directly.
  const realization = planResult?.realization ?? 1.0;
  const realizedEquity = overall !== null ? overall * realization : null;
  return { overall, vsRangeParts, realization, realizedEquity };
};

const buildAdjustments = (villainProfile) => {
  if (!villainProfile) return [];
  // Pull triggered vulnerabilities from the villain profile and expose them
  // as Adjustment[]. WS-155 / SPR-105: vulnerabilities now carry per-axis
  // `delta` populated by translateWeaknesses() via WEAKNESS_TO_DELTA map.
  // Composition into a single ComposedDelta happens in composeAdjustments
  // per HERO_STATE_DESIGN.md §7.2 resolution.
  const vulnerabilities = villainProfile.vulnerabilities || [];
  return vulnerabilities.slice(0, 3).map((v) => ({
    condition: v.condition || v.label || 'unknown',
    delta: v.delta || {},
    rationale: v.rationale || v.description || '',
    // Severity/confidence pass through so composeActionOverride can rank.
    severity: typeof v.severity === 'number' ? v.severity : 0,
    confidence: typeof v.confidence === 'number' ? v.confidence : 0,
  }));
};

// ─── Narrative rendering ─────────────────────────────────────────────────

const renderNarrative = (archetypeId, heroState) => {
  const template = loadTemplate(archetypeId);
  return {
    headline: interpolateTemplate(template.sections.headline, heroState),
    body: interpolateTemplate(template.sections.body, heroState),
    branchSummary: interpolateTemplate(template.sections.branchSummary, heroState),
  };
};

// ─── Main orchestrator ──────────────────────────────────────────────────

/**
 * Compose a HeroState from game state + hero hand + villain context.
 *
 * @param {object} args
 * @param {object} args.gameState           - Live game state (REQUIRED).
 * @param {[number, number]|string} args.heroHand - Encoded hero cards (REQUIRED).
 * @param {object|null} [args.villainProfile] - villainProfileBuilder output (optional).
 * @param {Float64Array|null} [args.villainRange] - 169-cell range (optional).
 * @param {object|null} [args.villainModel] - Bayesian villain decision model (optional).
 * @param {object} [args.options]
 * @param {number} [args.options.trials]    - MC trials for equity (default 2000).
 * @param {function} [args.options.equityFn] - Override equity function (test injection).
 * @param {function} [args.options.evaluateGameTree] - Override gameTreeEvaluator (test injection).
 * @param {function} [args.options.computeEquityVsRangeParts] - Override (test injection).
 *
 * @returns {Promise<HeroState>} Per src/utils/heroState/types.js.
 *
 * @throws {Error} when gameState or heroHand is missing/invalid.
 */
export const buildHeroState = async (args) => {
  if (!args || typeof args !== 'object') {
    throw new Error('buildHeroState: args object is required');
  }
  const { gameState, heroHand, villainProfile, villainRange, villainModel, options = {} } = args;

  if (!gameState || typeof gameState !== 'object') {
    throw new Error('buildHeroState: gameState is required');
  }
  if (!heroHand) {
    throw new Error('buildHeroState: heroHand is required');
  }

  const hasVillainData = !!(villainRange && villainProfile);

  const situation = buildSituation(gameState);
  const archetypeId = classifyArchetype({
    street: situation.street,
    actionContext: situation.actionContext,
    positionClass: situation.positionClass,
    inPosition: situation.inPosition,
    playersRemaining: situation.playersRemaining,
    potType: situation.potType,
    sizingFraction: situation.sizingFraction,
  });
  const archetypeFamily = ARCHETYPE_FAMILY_MAP[archetypeId] || ARCHETYPE_FAMILIES[0];

  // Step 4: parallel composition of plan + vsRangeParts equity.
  const evaluateGameTreeFn = options.evaluateGameTree;
  const computeEquityVsRangePartsFn = options.computeEquityVsRangeParts || computeEquityVsRangeParts;

  let planPromise;
  if (hasVillainData && evaluateGameTreeFn) {
    planPromise = evaluateGameTreeFn({
      villainRange,
      board: gameState.board || [],
      heroCards: heroHand,
      potSize: gameState.pot ?? 0,
      effectiveStack: gameState.effStack ?? 0,
      villainModel,
      trials: options.trials ?? 2000,
      equityFn: options.equityFn,
      numOpponents: Math.max(1, (situation.playersRemaining ?? 2) - 1),
    });
  } else {
    // Soft-degrade: no plan computation when villain data is missing or no
    // evaluator injected. Caller gets a stub plan.
    planPromise = Promise.resolve(null);
  }

  let vsRangePartsPromise;
  // Role partition (vsValue/vsBluff/vsDraw/vsAir) is HU-defined — the labels
  // assume ONE villain's range shape. Skip role-partition computation when
  // multiway (playersRemaining >= 3) per design doc §7.4.3. equity.overall
  // remains populated via gameTreeEvaluator's multiway-aware EV math
  // (numOpponents threads through adjustedRealization + multiwayFoldPct).
  // Pre-WS-154 this gate checked `actionContext !== 'MULTIWAY'`, but the
  // classifier never emits 'MULTIWAY' as actionContext — that was dead code.
  if (hasVillainData && situation.street !== 'preflop' && situation.playersRemaining < 3) {
    vsRangePartsPromise = computeEquityVsRangePartsFn({
      heroCards: heroHand,
      villainRange,
      board: gameState.board || [],
      street: situation.street,
      actionContext: situation.actionContext,
      villainStyle: deriveVillainStyle(villainProfile),
      options,
    });
  } else {
    vsRangePartsPromise = Promise.resolve(null);
  }

  const [planResult, vsRangePartsResult] = await Promise.all([planPromise, vsRangePartsPromise]);

  const handContext = buildHandContext(gameState, heroHand, planResult);
  const plan = buildPlanFromGameTreeResult(planResult);
  const equity = buildEquity(planResult, vsRangePartsResult);
  const adjustments = buildAdjustments(villainProfile);
  // WS-155 / SPR-105: compose per-axis deltas into a single ComposedDelta.
  // See HERO_STATE_DESIGN.md §7.2 resolution + composeAdjustments.js header
  // for poker-theory rationale per axis.
  const composedDelta = composeAdjustments(adjustments);

  // Render narrative against the assembled-so-far HeroState (everything except
  // narrative itself). interpolateTemplate leaves unresolved slots as `{{...}}`
  // so degraded states are visible to the reader rather than silently empty.
  const partial = { archetypeId, archetypeFamily, situation, handContext, equity, plan, adjustments, composedDelta };
  const narrative = renderNarrative(archetypeId, partial);

  return {
    archetypeId,
    archetypeFamily,
    situation,
    handContext,
    equity,
    plan,
    adjustments,
    composedDelta,
    narrative,
  };
};
