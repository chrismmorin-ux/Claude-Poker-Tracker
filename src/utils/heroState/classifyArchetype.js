/**
 * @file HSP archetype classifier — pure function mapping situation axes to
 * one of 18 archetype IDs (8 preflop + 10 flop). Turn/river throw
 * NotImplementedError per v1 scope (design doc §4.4–§4.5).
 *
 * First-principles guard (POKER_THEORY.md §7 + exploitEngine/CLAUDE.md):
 * archetypeId is an OUTPUT of classification, never an INPUT to plan
 * computation. This classifier is a pure routing function over situation
 * axes — it produces a label that downstream narrative templates bind to.
 * Plans, EVs, and sizings come from gameTreeEvaluator using equity / SPR /
 * pot odds / players remaining — NEVER from archetypeId.
 *
 * Spec resolutions (WS-141 plan-mode AskUserQuestion, 2026-05-03):
 *   Q1: potType is added to Situation typedef; classifier reads from axes.potType.
 *   Q2: 4BP pots map to 3BP archetypes for routing; lower-SPR adjustments come
 *       from sprZone in Plan, not from a separate archetype family.
 *
 * Closest-match fallbacks (documented to keep WS-138/139 narrative authors
 * informed):
 *   - VS_SQUEEZE → PF_VS_3BET (no dedicated VS_SQUEEZE archetype in v1)
 *   - SB/BB OPEN → PF_OPEN_RFI (rare, edge — single fallback)
 *   - Other postflop actionContexts on flop (BARREL, PROBE, DONK without
 *     VS_DONK prefix) → CBET-equivalent archetype for routing
 *   - Postflop multiway (playersRemaining ≥ 3) → FLOP_MULTIWAY overrides
 *     all other axes (per design doc §7.4: HU range-vs-range breaks multiway)
 */

const classifyPreflop = (axes) => {
  switch (axes.actionContext) {
    case 'OPEN':
      // Covers EP/MP/HJ/CO/BTN. SB opens fall here (rare); BB OPEN doesn't
      // happen in 9-handed but routes here defensively to satisfy
      // "Returns a valid archetypeId for any preflop state".
      return 'PF_OPEN_RFI';
    case 'VS_OPEN':
      if (axes.positionClass === 'BB') return 'PF_VS_OPEN_BB';
      if (axes.positionClass === 'SB') return 'PF_VS_OPEN_SB';
      // CO/BTN cold-call vs single open. EP/MP/HJ rare in v1 catalog;
      // closest match is the IP archetype.
      return 'PF_VS_OPEN_IP';
    case '3BET':
      return 'PF_3BET';
    case 'SQUEEZE':
      return 'PF_SQUEEZE';
    case 'VS_3BET':
      return 'PF_VS_3BET';
    case 'VS_SQUEEZE':
      // No dedicated VS_SQUEEZE archetype in v1; closest match is VS_3BET
      // (both are "hero opened, faces re-raise — must respond from a
      // capped opening range").
      return 'PF_VS_3BET';
    case 'LIMP_NAV':
      return 'PF_LIMP_NAV';
    default:
      // CBET/VS_CBET/BARREL/etc. should not appear preflop. Defensive
      // fallback to PF_OPEN_RFI to satisfy the "always return a valid id"
      // accept criterion. Surface as a callsite bug if it happens.
      return 'PF_OPEN_RFI';
  }
};

const classifyFlop = (axes) => {
  // Multiway dominates everything (design doc §7.4: HU range-vs-range
  // reasoning breaks multiway, so we have a dedicated archetype).
  if (axes.playersRemaining >= 3) return 'FLOP_MULTIWAY';

  // VS_DONK is its own structural axis — donk leads break HU CBET dynamics.
  if (axes.actionContext === 'VS_DONK') return 'FLOP_VS_DONK';

  // 4BP maps to 3BP per Q2 resolution. Lower-SPR adjustments come from
  // sprZone in Plan, not from a separate archetype family.
  const isThreeBetOrBigger =
    axes.potType === '3BP' || axes.potType === '4BP';

  if (axes.actionContext === 'CBET') {
    if (isThreeBetOrBigger) {
      return axes.inPosition ? 'FLOP_3BP_HU_IP_CBET' : 'FLOP_3BP_HU_OOP_CBET';
    }
    return axes.inPosition ? 'FLOP_SRP_HU_IP_CBET' : 'FLOP_SRP_HU_OOP_CBET';
  }

  if (axes.actionContext === 'VS_CBET') {
    if (isThreeBetOrBigger) {
      return axes.inPosition ? 'FLOP_3BP_VS_CBET_IP' : 'FLOP_3BP_VS_CBET_OOP';
    }
    return axes.inPosition ? 'FLOP_SRP_HU_IP_VS_CBET' : 'FLOP_SRP_HU_OOP_VS_CBET';
  }

  // Other postflop actionContexts on flop (BARREL is turn cbet — shouldn't
  // appear on flop; PROBE/DONK without VS_DONK prefix). Closest match:
  // treat as CBET for archetype routing.
  if (isThreeBetOrBigger) {
    return axes.inPosition ? 'FLOP_3BP_HU_IP_CBET' : 'FLOP_3BP_HU_OOP_CBET';
  }
  return axes.inPosition ? 'FLOP_SRP_HU_IP_CBET' : 'FLOP_SRP_HU_OOP_CBET';
};

/**
 * Classify a HeroState situation into one of 18 archetype IDs.
 * Pure function. Throws NotImplementedError for turn/river (v2 deferred).
 *
 * @param {object} axes - Subset of Situation needed for classification.
 * @param {('preflop'|'flop'|'turn'|'river')} axes.street
 * @param {string} axes.actionContext - One of ACTION_CONTEXTS.
 * @param {string} axes.positionClass - One of POSITION_CLASSES.
 * @param {boolean|null} axes.inPosition - Required postflop; null preflop.
 * @param {number} axes.playersRemaining - Active players who can still act.
 * @param {('SRP'|'3BP'|'4BP'|'LIMPED')|null} axes.potType - Postflop pot
 *   structure; null preflop.
 *
 * @returns {string} archetypeId from ARCHETYPE_IDS catalog.
 * @throws {Error} when street === 'turn' or 'river' (v2 deferred).
 */
export const classifyArchetype = (axes) => {
  if (axes.street === 'turn' || axes.street === 'river') {
    throw new Error(
      `classifyArchetype: ${axes.street} archetypes deferred to v2 ` +
      `(design doc §4.4–§4.5)`,
    );
  }

  if (axes.street === 'preflop') return classifyPreflop(axes);
  if (axes.street === 'flop') return classifyFlop(axes);

  // Unreachable given STREETS enum, but defensive throw to surface
  // unknown-street values rather than silently default.
  throw new Error(`classifyArchetype: unknown street "${axes.street}"`);
};
