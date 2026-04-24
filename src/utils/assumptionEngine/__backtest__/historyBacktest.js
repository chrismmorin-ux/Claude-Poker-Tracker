/**
 * historyBacktest.js — Tier-2 activation-rate backtest harness (Commit 10 v1)
 *
 * Part of the assumptionEngine module. See `CLAUDE.md` + `calibration.md` for rules.
 *
 * v1 SCOPE — activation-rate measurement only per calibration.md §3.2 secondary
 * metric `activationRate[predicateKey]`. Walks stored hand history, matches each
 * assumption's `claim.scope` against extracted decision nodes, and reports the
 * fraction of eligible (same villain, same street) nodes that pass the full scope.
 *
 * Intentionally does NOT compute realized-vs-predicted dividend gaps (the primary
 * Tier-2 metric per §3.2). That requires branch EV counterfactuals per
 * calibration.md §10 open question 1; deferred until the game-tree integration in
 * DrillReveal lands.
 *
 * Scope matching (v1):
 *   - street        — exact match or 'any'
 *   - texture       — 'wet'/'dry' mapped from boardTexture.texture; 'medium' →
 *                     does not match specific wet/dry scopes (treated as neutral)
 *   - position      — deferred; scope.position='any' always matches, specific IP/OOP
 *                     requires line-history tracking (v1.1)
 *   - sprRange      — deferred; requires pot/stack reconstruction
 *   - betSizeRange  — deferred; requires bet-vs-pot sizing derivation
 *   - playersToAct  — deferred; requires seat-active count per street
 *
 * Output feeds the drill corpus planner (calibration.md §5): low-activation
 * predicates need ring-fencing until sample accrues. Pool-by-style metric
 * calibration.md §5.3 falls out of per-predicate rollup (see report.perPredicate).
 *
 * Pure module — no IndexedDB access; callers fetch hands via handsStorage.getAllHands.
 */

import { analyzeBoardFromStrings } from '../../pokerCore/boardTexture';

const STREET_BOARD_COUNT = { preflop: 0, flop: 3, turn: 4, river: 5 };

/**
 * Normalize boardTexture.texture ('wet' | 'medium' | 'dry') into a token a
 * schema scope can match. Only 'wet' and 'dry' are recognized by v1 recipes;
 * medium textures return null and will not match specific-texture scopes.
 */
const normalizeTextureToken = (raw) => {
  if (raw === 'wet' || raw === 'dry') return raw;
  return null;
};

/**
 * Extract villain decision nodes from a single hand record.
 *
 * A decision node = one postflop action taken by a non-hero seat. Nodes carry
 * enough context for scope matching: street, texture (computed from community
 * cards available at that street), villain seat, and raw action.
 *
 * @param {Object} hand  — record from handsStorage.getAllHands
 * @returns {Array<{handId, villainSeat, street, action, amount, texture, position}>}
 */
export const extractDecisionNodes = (hand) => {
  const out = [];
  const gs = hand?.gameState;
  if (!gs || !Array.isArray(gs.actionSequence)) return out;

  const heroSeat = gs.mySeat;
  const community = hand?.cardState?.communityCards ?? [];

  const textureByStreet = {};
  for (const street of ['flop', 'turn', 'river']) {
    const n = STREET_BOARD_COUNT[street];
    const cards = community.slice(0, n).filter(Boolean);
    if (cards.length === n) {
      const analysis = analyzeBoardFromStrings(cards);
      textureByStreet[street] = analysis ? normalizeTextureToken(analysis.texture) : null;
    } else {
      textureByStreet[street] = null;
    }
  }

  for (const entry of gs.actionSequence) {
    if (!entry || entry.street === 'preflop') continue;
    if (entry.seat === heroSeat) continue;
    if (!Number.isInteger(entry.seat)) continue;

    out.push({
      handId: hand.handId ?? hand.id ?? null,
      villainSeat: entry.seat,
      street: entry.street,
      action: entry.action,
      amount: entry.amount ?? null,
      texture: textureByStreet[entry.street] ?? null,
      position: 'any', // v1 — see module doc
    });
  }

  return out;
};

/**
 * Check whether an assumption scope matches a decision node.
 * See module doc for v1 matching rules + deferred dimensions.
 */
export const scopeMatches = (scope, node) => {
  if (!scope || !node) return false;

  if (scope.street && scope.street !== 'any' && scope.street !== node.street) return false;

  if (scope.texture && scope.texture !== 'any') {
    if (node.texture == null) return false;
    if (scope.texture !== node.texture) return false;
  }

  // position / spr / betSize / playersToAct — v1 defers to 'match-anything'.

  return true;
};

/**
 * Default villain-seat resolver: matches villainId against the hand's
 * seatPlayers map (seatPlayers is `{ [seat]: playerId }`). Callers that key
 * villains differently can override via `opts.getVillainSeat`.
 */
const defaultGetVillainSeat = (villainId, hand) => {
  const sp = hand?.seatPlayers;
  if (!sp || typeof sp !== 'object') return null;
  for (const [seat, playerId] of Object.entries(sp)) {
    if (playerId === villainId) return Number(seat);
  }
  return null;
};

/**
 * Flatten assumptions into a single array. Accepts either:
 *   - flat array of VillainAssumption (each record carries villainId)
 *   - map { [villainId]: VillainAssumption[] }
 */
const flattenAssumptions = (assumptions) => {
  if (Array.isArray(assumptions)) return assumptions.filter(Boolean);
  if (assumptions && typeof assumptions === 'object') {
    return Object.values(assumptions).flat().filter(Boolean);
  }
  return [];
};

/**
 * Run an activation-rate backtest across a set of assumptions and hands.
 *
 * @param {Object} opts
 * @param {Array|Object} opts.assumptions   — flat array or map-by-villainId
 * @param {Array<Object>} opts.hands        — hand records from getAllHands
 * @param {Function} [opts.getVillainSeat]  — (villainId, hand) → seat | null
 *
 * @returns {{
 *   runAt: string,
 *   handsScanned: number,
 *   decisionNodesScanned: number,
 *   perAssumption: Array<PerAssumptionRow>,
 *   perPredicate: Object<string, PerPredicateRow>,
 *   warnings: string[],
 * }}
 */
export const runActivationBacktest = ({
  assumptions,
  hands,
  getVillainSeat = defaultGetVillainSeat,
} = {}) => {
  const report = {
    runAt: new Date().toISOString(),
    handsScanned: 0,
    decisionNodesScanned: 0,
    perAssumption: [],
    perPredicate: {},
    warnings: [],
  };

  const handList = Array.isArray(hands) ? hands : [];
  if (handList.length === 0) {
    report.warnings.push('No hands to scan');
    return report;
  }

  const flatAssumptions = flattenAssumptions(assumptions);
  if (flatAssumptions.length === 0) {
    report.warnings.push('No assumptions to evaluate');
    return report;
  }

  // Pre-compute decision nodes once per hand.
  const nodesByHand = handList.map((hand) => ({ hand, nodes: extractDecisionNodes(hand) }));
  report.handsScanned = handList.length;
  report.decisionNodesScanned = nodesByHand.reduce((s, h) => s + h.nodes.length, 0);

  for (const a of flatAssumptions) {
    const scope = a?.claim?.scope;
    const villainId = a?.villainId;
    if (!scope || !villainId) continue;

    let eligibleNodes = 0;
    let matchedNodes = 0;
    let handsWithVillain = 0;

    for (const { hand, nodes } of nodesByHand) {
      const seat = getVillainSeat(villainId, hand);
      if (seat == null) continue;
      handsWithVillain += 1;

      for (const node of nodes) {
        if (node.villainSeat !== seat) continue;
        if (scope.street && scope.street !== 'any' && node.street !== scope.street) continue;
        eligibleNodes += 1;
        if (scopeMatches(scope, node)) matchedNodes += 1;
      }
    }

    const activationRate = eligibleNodes > 0 ? matchedNodes / eligibleNodes : null;

    report.perAssumption.push({
      assumptionId: a.id ?? null,
      villainId,
      predicateKey: a.claim?.predicate ?? null,
      style: a.prior?.style ?? 'Unknown',
      scope: {
        street: scope.street ?? null,
        texture: scope.texture ?? null,
        position: scope.position ?? null,
      },
      handsWithVillain,
      eligibleNodes,
      matchedNodes,
      activationRate,
    });
  }

  // Per-predicate rollup — informs drill corpus planner when sample accrual
  // becomes meaningful per calibration.md §5.3.
  for (const row of report.perAssumption) {
    const key = row.predicateKey;
    if (!key) continue;
    const agg = report.perPredicate[key] ?? {
      totalEligible: 0,
      totalMatched: 0,
      assumptions: 0,
      byStyle: {},
      byStreet: {},
      activationRate: null,
    };
    agg.totalEligible += row.eligibleNodes;
    agg.totalMatched += row.matchedNodes;
    agg.assumptions += 1;
    agg.byStyle[row.style] = (agg.byStyle[row.style] ?? 0) + row.matchedNodes;
    const streetKey = row.scope.street || 'any';
    agg.byStreet[streetKey] = (agg.byStreet[streetKey] ?? 0) + row.matchedNodes;
    report.perPredicate[key] = agg;
  }
  for (const key of Object.keys(report.perPredicate)) {
    const agg = report.perPredicate[key];
    agg.activationRate = agg.totalEligible > 0 ? agg.totalMatched / agg.totalEligible : null;
  }

  return report;
};
