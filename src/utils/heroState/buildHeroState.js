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
  FLOP_VS_DONK: 'FLOP_VS_DONK',
};

// ─── Situation derivations ───────────────────────────────────────────────

/**
 * Derive HSP actionContext from a flat game state (street + hero seat + last
 * action history). Maps to one of ACTION_CONTEXTS per types.js.
 *
 * v1 implementation is intentionally simple: caller may pass actionContext
 * directly via gameState.actionContext to bypass the heuristic.
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
  // Postflop default: VS_CBET when villain has bet on current street, otherwise CBET.
  const hasVillainBetThisStreet = (gameState.actionSequence || []).some(
    (a) => a.street === street && (a.action === 'bet' || a.action === 'raise'),
  );
  return hasVillainBetThisStreet ? 'VS_CBET' : 'CBET';
};

const countPreflopRaises = (actionSequence) => {
  if (!Array.isArray(actionSequence)) return 0;
  return actionSequence.filter(
    (a) => a.street === 'preflop' && (a.action === 'bet' || a.action === 'raise'),
  ).length;
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
    potType: derivePotType(gameState),
  };
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
  // v1 minimal — pull triggered vulnerabilities from the villain profile and
  // expose them as Adjustment[] for the consumer. Composition rule (multiply/
  // sum/precedence per HSP-DESIGN §7.2) is consumer's responsibility for v1.
  const vulnerabilities = villainProfile.vulnerabilities || [];
  return vulnerabilities.slice(0, 3).map((v) => ({
    condition: v.condition || v.label || 'unknown',
    delta: v.delta || {},
    rationale: v.rationale || v.description || '',
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
  if (hasVillainData && situation.street !== 'preflop' && situation.actionContext !== 'MULTIWAY') {
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

  // Render narrative against the assembled-so-far HeroState (everything except
  // narrative itself). interpolateTemplate leaves unresolved slots as `{{...}}`
  // so degraded states are visible to the reader rather than silently empty.
  const partial = { archetypeId, archetypeFamily, situation, handContext, equity, plan, adjustments };
  const narrative = renderNarrative(archetypeId, partial);

  return {
    archetypeId,
    archetypeFamily,
    situation,
    handContext,
    equity,
    plan,
    adjustments,
    narrative,
  };
};
