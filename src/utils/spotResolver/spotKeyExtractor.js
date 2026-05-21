/**
 * spotKeyExtractor.js — Extract the 8-dim spot descriptor from a played
 * hand record + decision index. Pure function.
 *
 * Composes the descriptor from existing pokerCore + handAnalysis +
 * positionUtils helpers per the SPOT-KEY spike's "~70% of dimensions
 * extractable with zero new code" finding.
 *
 * Returns null for preflop decisions (v1 corpus is postflop-only) or
 * when essential fields (hero seat, villain action) can't be inferred.
 *
 * SLS Stream E — SPR-087 / WS-193.
 */

import { getPositionName, isInPosition } from '../positionUtils';
import { analyzeBoardFromStrings } from '../pokerCore/boardTexture';
import { buildTimeline } from '../handAnalysis/handTimeline';
import { inferPotType } from './potTypeInference';
import { toBoardShorthand } from './boardShorthand';
import { classifyNode } from './nodeClassifier';

// ─── SPR zones (deliberate duplication — see CLAUDE.md §Deliberate ────
// duplication note). Source: exploitEngine/gameTreeConstants.js:78-98.
// Cross-domain rule forbids importing from exploitEngine, so we
// duplicate. SPR zones are universal poker concepts; 5 constants + 1
// function. Future cleanup may move SPR_ZONES to pokerCore/.

export const SPR_ZONES = Object.freeze({
  MICRO: 'MICRO',
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  DEEP: 'DEEP',
});

const getSprBucket = (spr) => {
  if (typeof spr !== 'number' || !Number.isFinite(spr) || spr < 0) return null;
  if (spr < 2) return SPR_ZONES.MICRO;
  if (spr < 4) return SPR_ZONES.LOW;
  if (spr < 8) return SPR_ZONES.MEDIUM;
  if (spr < 13) return SPR_ZONES.HIGH;
  return SPR_ZONES.DEEP;
};

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Get cards revealed at a given street ('flop'→3, 'turn'→4, 'river'→5).
 */
const cardsForStreet = (communityCards, street) => {
  if (!Array.isArray(communityCards)) return [];
  if (street === 'flop') return communityCards.slice(0, 3);
  if (street === 'turn') return communityCards.slice(0, 4);
  if (street === 'river') return communityCards.slice(0, 5);
  return [];
};

/**
 * Find the most-recent same-street villain entry before the given index.
 */
const findVillainOnStreet = (timeline, decisionIndex, heroSeat) => {
  const decision = timeline[decisionIndex];
  if (!decision) return null;
  for (let j = decisionIndex - 1; j >= 0; j--) {
    const prev = timeline[j];
    if (!prev || prev.street !== decision.street) break;
    if (String(prev.seat) === String(heroSeat)) continue;
    return prev;
  }
  return null;
};

/**
 * Build the action prefix that nodeClassifier consumes: all timeline
 * entries on the current street + the prior street(s), normalized to
 * {actor, action, street} shape.
 */
const buildActionPrefix = (timeline, decisionIndex) => {
  if (!Array.isArray(timeline)) return [];
  return timeline.slice(0, decisionIndex).map((e) => ({
    actor: e?.seat,
    action: e?.action,
    street: e?.street,
  }));
};

/**
 * Generate the canonical spot-key string for SR-32 copy-paste.
 */
const buildSpotKey = (d) => {
  if (!d) return '';
  return [d.heroPos, 'vs', d.villainPos, d.potType, d.ipOop, d.texture, d.boardShorthand, d.nodeId]
    .filter((s) => s != null && s !== '')
    .join('-')
    .toLowerCase();
};

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Extract the 8-dim descriptor + spot-key string from a played hand.
 *
 * @param {Object} hand               — hand record from IDB / replay
 * @param {number} decisionIndex      — index into buildTimeline(hand)
 * @returns {{
 *   heroPos: string,
 *   villainPos: string,
 *   ipOop: 'ip'|'oop'|'mw',
 *   potType: string,
 *   texture: string,
 *   boardShorthand: string,
 *   sprBucket: string|null,
 *   street: 'flop'|'turn'|'river',
 *   nodeId: string|null,
 *   spotKey: string,
 * } | null}
 */
export const extractDescriptor = (hand, decisionIndex) => {
  if (!hand || typeof decisionIndex !== 'number') return null;

  const timeline = buildTimeline(hand);
  const decision = timeline[decisionIndex];
  if (!decision) return null;

  // v1 corpus is postflop-only. Preflop decisions return null and
  // cascade to no-analog in the orchestrator.
  if (decision.street === 'preflop') return null;

  const buttonSeat = hand?.gameState?.dealerButtonSeat ?? 1;
  const heroSeat = hand?.gameState?.mySeat ?? decision.seat;
  if (heroSeat == null) return null;

  const heroPos = getPositionName(heroSeat, buttonSeat);

  const villainEntry = findVillainOnStreet(timeline, decisionIndex, heroSeat);
  if (!villainEntry) return null; // no villain to anchor the descriptor
  const villainSeat = villainEntry.seat;
  const villainPos = getPositionName(Number(villainSeat), buttonSeat);

  const ipOop = isInPosition(heroSeat, Number(villainSeat), buttonSeat) ? 'ip' : 'oop';

  const potType = inferPotType(timeline);

  const communityCards = hand?.cardState?.communityCards
    || hand?.gameState?.communityCards
    || [];
  const streetCards = cardsForStreet(communityCards, decision.street);
  if (streetCards.length < 3) return null;

  const textureResult = analyzeBoardFromStrings(streetCards.slice(0, 3));
  const texture = textureResult?.texture || 'medium';

  const boardShorthand = toBoardShorthand(streetCards);

  // SPR computation — best-effort. Use effective stack + pot at decision
  // point if available; otherwise null (matcher tolerates null SPR).
  const effectiveStack = hand?.gameState?.effectiveStack;
  const potAtDecision = decision.amount ?? null; // simplification; precise pot would require accumulator
  let sprBucket = null;
  if (typeof effectiveStack === 'number' && typeof potAtDecision === 'number' && potAtDecision > 0) {
    sprBucket = getSprBucket(effectiveStack / potAtDecision);
  }

  const actionPrefix = buildActionPrefix(timeline, decisionIndex);
  const nodeId = classifyNode({
    street: decision.street,
    actionPrefix,
    heroSeat,
  });

  const descriptor = {
    heroPos,
    villainPos,
    ipOop,
    potType,
    texture,
    boardShorthand,
    sprBucket,
    street: decision.street,
    nodeId,
  };
  descriptor.spotKey = buildSpotKey(descriptor);
  return descriptor;
};
