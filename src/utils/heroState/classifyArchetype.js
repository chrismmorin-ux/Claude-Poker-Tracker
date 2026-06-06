/**
 * @file HSP archetype classifier — pure function mapping situation axes to
 * one of 47 archetype IDs (8 preflop + 13 flop + 12 turn + 14 river). All
 * four streets covered per v3 catalog (design doc §4.2–§4.5 + §7.4 multiway
 * potType split — WS-154 / SPR-106, 2026-06-04).
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
 * Spec resolutions (WS-153, 2026-05-30):
 *   - Action-history reconstruction is NOT in scope here. The classifier
 *     consumes axes.actionContext (an opaque string the orchestrator derived
 *     from action history). buildHeroState.deriveActionContext() v1 heuristic
 *     only distinguishes CBET / VS_CBET — extending it to also distinguish
 *     BARREL / PROBE / DELAYED-CBET / VS_DONK on turn/river is a follow-up
 *     orchestrator ticket. Callers wanting accurate turn/river archetype
 *     routing should pass gameState.actionContext explicitly until that lands.
 *   - axes.sizingFraction (optional) drives river block-bet routing per
 *     design doc §4.5.1 (sizingFraction <= 0.40 → BLOCK_BET / VS_BLOCK_BET).
 *     When undefined, standard SRP/3BP routing applies.
 *
 * Closest-match fallbacks (documented to keep template authors informed):
 *   - VS_SQUEEZE preflop → PF_VS_3BET (no dedicated VS_SQUEEZE archetype in v1)
 *   - SB/BB OPEN → PF_OPEN_RFI (rare, edge — single fallback)
 *   - Other postflop actionContexts on flop (BARREL, PROBE, DONK without
 *     VS_DONK prefix) → CBET-equivalent archetype for routing
 *   - Turn VS_CBET → VS_BARREL family (callsite-vocab mismatch; closest match
 *     is "facing a turn bet" regardless of which street villain first bet on)
 *   - River VS_CBET → VS_BET family (same rationale, river-side)
 *   - 4BP postflop → 3BP archetype IDs (inherited from §4.3.1 across all
 *     postflop streets; lower-SPR adjustments come from sprZone)
 *   - Postflop multiway (playersRemaining ≥ 3) overrides all other axes per
 *     design doc §7.4 (HU range-vs-range breaks multiway):
 *       - flop: routed by potType into FLOP_MULTIWAY_SRP / _3BP / _LIMPED
 *         (WS-154 v3); FLOP_MULTIWAY catch-all for null/unknown potType
 *       - turn/river: TURN_MULTIWAY / RIVER_MULTIWAY single archetypes
 *         (v3_TODO: pot-type split if usage demands)
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
  // reasoning breaks multiway). v3 splits FLOP_MULTIWAY into 3 sub-archetypes
  // by potType (WS-154 / SPR-106, 2026-06-04 — see design doc §7.4.1):
  //   SRP    → FLOP_MULTIWAY_SRP     (single-raised, 3+ players)
  //   3BP/4BP → FLOP_MULTIWAY_3BP    (3-bet+ pot, 3+ players — rare)
  //   LIMPED → FLOP_MULTIWAY_LIMPED  (no preflop raise, 3+ players)
  //   null/unknown potType → FLOP_MULTIWAY catch-all (defensive default)
  //
  // 4BP inherits 3BP archetype per §4.3.1 (matches HU 4BP→3BP routing).
  if (axes.playersRemaining >= 3) {
    if (axes.potType === 'LIMPED') return 'FLOP_MULTIWAY_LIMPED';
    if (axes.potType === '3BP' || axes.potType === '4BP') return 'FLOP_MULTIWAY_3BP';
    if (axes.potType === 'SRP') return 'FLOP_MULTIWAY_SRP';
    return 'FLOP_MULTIWAY';
  }

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

const classifyTurn = (axes) => {
  // Multiway dominates (design doc §7.4: HU range-vs-range breaks multiway).
  // v3_TODO (WS-154 follow-up): TURN_MULTIWAY single archetype is retained
  // in v3 because multiway turn/river hands are uncommon (~70% are bet-out
  // by turn). Split mirroring FLOP_MULTIWAY_SRP/_3BP/_LIMPED only if usage
  // demands; see design doc §7.4.1.
  if (axes.playersRemaining >= 3) return 'TURN_MULTIWAY';

  // VS_DONK is its own structural axis.
  if (axes.actionContext === 'VS_DONK') return 'TURN_VS_DONK';

  // PROBE — hero leads after flop checked through (capped villain range).
  if (axes.actionContext === 'PROBE') return 'TURN_PROBE';

  // CBET on turn = delayed cbet (hero checked back flop, bets turn). The
  // orchestrator's v1 deriveActionContext heuristic emits CBET when villain
  // hasn't bet this street — which on turn is the delayed-cbet scenario;
  // accurate BARREL routing requires callers to pass actionContext='BARREL'
  // explicitly (documented in module header).
  if (axes.actionContext === 'CBET') return 'TURN_DELAYED_CBET';

  // 4BP maps to 3BP per §4.3.1 (inherited).
  const isThreeBetOrBigger = axes.potType === '3BP' || axes.potType === '4BP';

  // VS_BARREL = canonical facing-turn-bet; VS_CBET is callsite-vocab mismatch
  // (closest match: VS_BARREL family).
  const isFacingBet = axes.actionContext === 'VS_BARREL' || axes.actionContext === 'VS_CBET';

  if (isThreeBetOrBigger) {
    if (isFacingBet) {
      return axes.inPosition ? 'TURN_3BP_VS_BARREL_IP' : 'TURN_3BP_VS_BARREL_OOP';
    }
    return axes.inPosition ? 'TURN_3BP_BARREL_IP' : 'TURN_3BP_BARREL_OOP';
  }
  if (isFacingBet) {
    return axes.inPosition ? 'TURN_SRP_VS_BARREL_IP' : 'TURN_SRP_VS_BARREL_OOP';
  }
  // Default: BARREL or other-bet actionContexts on turn → BARREL family.
  return axes.inPosition ? 'TURN_SRP_BARREL_IP' : 'TURN_SRP_BARREL_OOP';
};

const classifyRiver = (axes) => {
  // Multiway dominates (design doc §7.4). v3_TODO (WS-154 follow-up): see
  // classifyTurn for same v3_TODO note.
  if (axes.playersRemaining >= 3) return 'RIVER_MULTIWAY';

  // VS_DONK structural axis.
  if (axes.actionContext === 'VS_DONK') return 'RIVER_VS_DONK';

  // PROBE — hero leads after flop+turn both checked through.
  if (axes.actionContext === 'PROBE') return 'RIVER_PROBE';

  // CBET on river = delayed bet (hero checked back turn, bets river). Same
  // heuristic-disambiguation note as classifyTurn.
  if (axes.actionContext === 'CBET') return 'RIVER_DELAYED_BET';

  // River VS_CBET → VS_BET family (callsite-vocab mismatch closest match).
  const isFacingBet = axes.actionContext === 'VS_BARREL' || axes.actionContext === 'VS_CBET';

  // Block-bet routing (design doc §4.5.1): sizingFraction <= 0.40 routes to
  // BLOCK_BET / VS_BLOCK_BET. Position-agnostic on the facing side per §4.5.1
  // ("the sizing-response math is dominated by the small-bet pot-odds regime
  // rather than position"). Hero own block-bet is OOP by definition (small-
  // lead is OOP); IP with sub-40% sizing is anomalous and routes to standard.
  if (typeof axes.sizingFraction === 'number' && axes.sizingFraction <= 0.40) {
    if (isFacingBet) return 'RIVER_VS_BLOCK_BET';
    if (axes.inPosition === false) return 'RIVER_BLOCK_BET';
    // IP hero bet at <= 40% sizing on river — anomalous; fall through to
    // standard BET routing.
  }

  // 4BP maps to 3BP per §4.3.1 (inherited).
  const isThreeBetOrBigger = axes.potType === '3BP' || axes.potType === '4BP';

  if (isThreeBetOrBigger) {
    if (isFacingBet) {
      return axes.inPosition ? 'RIVER_3BP_VS_BET_IP' : 'RIVER_3BP_VS_BET_OOP';
    }
    return axes.inPosition ? 'RIVER_3BP_BET_IP' : 'RIVER_3BP_BET_OOP';
  }
  if (isFacingBet) {
    return axes.inPosition ? 'RIVER_SRP_VS_BET_IP' : 'RIVER_SRP_VS_BET_OOP';
  }
  // Default: BARREL or other-bet actionContexts on river → BET family.
  return axes.inPosition ? 'RIVER_SRP_BET_IP' : 'RIVER_SRP_BET_OOP';
};

/**
 * Classify a HeroState situation into one of 47 archetype IDs.
 * Pure function. Routes preflop / flop / turn / river per the design-doc
 * §4.2–§4.5 catalog + §7.4 multiway potType split (WS-154). Block-bet
 * routing on river uses sizingFraction.
 *
 * @param {object} axes - Subset of Situation needed for classification.
 * @param {('preflop'|'flop'|'turn'|'river')} axes.street
 * @param {string} axes.actionContext - One of ACTION_CONTEXTS.
 * @param {string} axes.positionClass - One of POSITION_CLASSES.
 * @param {boolean|null} axes.inPosition - Required postflop; null preflop.
 * @param {number} axes.playersRemaining - Active players who can still act.
 * @param {('SRP'|'3BP'|'4BP'|'LIMPED')|null} axes.potType - Postflop pot
 *   structure; null preflop.
 * @param {number} [axes.sizingFraction] - River-only optional axis. Bet
 *   size as fraction of pot (0..N). When <= 0.40, routes to RIVER_BLOCK_BET
 *   (hero OOP bet) or RIVER_VS_BLOCK_BET (facing small bet). Otherwise
 *   ignored. See design doc §4.5.1.
 *
 * @returns {string} archetypeId from ARCHETYPE_IDS catalog (44 entries).
 */
export const classifyArchetype = (axes) => {
  if (axes.street === 'preflop') return classifyPreflop(axes);
  if (axes.street === 'flop') return classifyFlop(axes);
  if (axes.street === 'turn') return classifyTurn(axes);
  if (axes.street === 'river') return classifyRiver(axes);

  // Unreachable given STREETS enum, but defensive throw to surface
  // unknown-street values rather than silently default.
  throw new Error(`classifyArchetype: unknown street "${axes.street}"`);
};
