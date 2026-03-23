/**
 * handSignificance.js - Score hands by learning value
 *
 * Pure synchronous function — no async, no React, no equity computation.
 * Fast enough to run over entire hand list in useMemo.
 *
 * Three weighted factor groups:
 * A. Hero Learning Value (0.40) — did hero face decisions?
 * B. Villain Intelligence Value (0.35) — did we learn about opponents?
 * C. Structural Factors (0.25) — hand complexity and pot size
 */

import { BETTING_STREETS } from '../constants/gameConstants';
import { PRIMITIVE_ACTIONS, LEGACY_TO_PRIMITIVE } from '../constants/primitiveActions';
import { getRangePositionCategory } from './positionUtils';

/**
 * Build approximate situationKeys from action sequence without full board texture.
 * Uses street + position category + primitive action.
 * @param {Object} hand
 * @param {number} seat - The seat to build keys for
 * @param {number} buttonSeat
 * @returns {string[]}
 */
const buildQuickSituationKeys = (hand, seat, buttonSeat) => {
  const seq = hand.gameState?.actionSequence;
  if (!Array.isArray(seq)) return [];

  const posCategory = getRangePositionCategory(Number(seat), buttonSeat);
  const keys = [];

  for (const entry of seq) {
    if (Number(entry.seat) !== Number(seat)) continue;
    if (entry.street === 'preflop') continue; // Preflop keys are less useful for weakness matching

    const primitive = LEGACY_TO_PRIMITIVE[entry.action] ?? entry.action;
    if (!primitive) continue;

    // Use 'unknown' texture since we don't compute board texture here
    keys.push(`${entry.street}:unknown:${posCategory}:${primitive}`);
  }

  return keys;
};

/**
 * Compute a 0-1 significance score for a hand.
 *
 * @param {Object} hand - The hand record
 * @param {string|number} heroPlayerId - Hero's player ID
 * @param {Object} tendencyMap - { [playerId]: { weaknesses, af, vpip, style, ... } }
 * @returns {{ score: number, factors: { heroLearning: number, villainIntel: number, structural: number } }}
 */
export const computeHandSignificance = (hand, heroPlayerId, tendencyMap) => {
  const seq = hand.gameState?.actionSequence || [];
  const seatPlayers = hand.seatPlayers || {};
  const buttonSeat = hand.gameState?.dealerButtonSeat ?? 1;
  const showdownCards = hand.cardState?.allPlayerCards || {};

  // Find hero seat and player ID
  let heroSeat = hand.gameState?.mySeat ?? null;
  let resolvedHeroPlayerId = heroPlayerId || null;
  if (!heroSeat && heroPlayerId) {
    for (const [seat, pid] of Object.entries(seatPlayers)) {
      if (String(pid) === String(heroPlayerId)) {
        heroSeat = Number(seat);
        break;
      }
    }
  }
  // Derive heroPlayerId from seatPlayers if not provided
  if (heroSeat && !resolvedHeroPlayerId) {
    resolvedHeroPlayerId = seatPlayers[heroSeat] || seatPlayers[String(heroSeat)] || null;
  }

  // ─── A. Hero Learning Value (weight 0.40) ───

  let heroActedPostflop = 0;
  let heroFacedAggression = 0;
  let heroCommittedMoney = 0;
  let heroWeaknessMatch = 0;

  if (heroSeat) {
    const heroActions = seq.filter(e => Number(e.seat) === Number(heroSeat));
    const postflopActions = heroActions.filter(e => e.street !== 'preflop');

    // Did hero take non-fold actions past preflop?
    heroActedPostflop = postflopActions.some(e => {
      const p = LEGACY_TO_PRIMITIVE[e.action] ?? e.action;
      return p && p !== PRIMITIVE_ACTIONS.FOLD;
    }) ? 1 : 0;

    // Did hero face a bet/raise?
    for (let i = 0; i < seq.length; i++) {
      const entry = seq[i];
      const primitive = LEGACY_TO_PRIMITIVE[entry.action] ?? entry.action;
      if (Number(entry.seat) !== Number(heroSeat) &&
          (primitive === PRIMITIVE_ACTIONS.BET || primitive === PRIMITIVE_ACTIONS.RAISE)) {
        // Check if hero acted after this
        const heroAfter = seq.slice(i + 1).some(e => Number(e.seat) === Number(heroSeat));
        if (heroAfter) {
          heroFacedAggression = 1;
          break;
        }
      }
    }

    // Did hero call or raise (commit money)?
    heroCommittedMoney = heroActions.some(e => {
      const p = LEGACY_TO_PRIMITIVE[e.action] ?? e.action;
      return p === PRIMITIVE_ACTIONS.CALL || p === PRIMITIVE_ACTIONS.RAISE || p === PRIMITIVE_ACTIONS.BET;
    }) ? 1 : 0;

    // Do any hero actions match a known weakness situationKey?
    const heroTendency = tendencyMap?.[resolvedHeroPlayerId];
    const heroWeaknesses = heroTendency?.weaknesses;
    if (heroWeaknesses && heroWeaknesses.length > 0) {
      const heroKeys = buildQuickSituationKeys(hand, heroSeat, buttonSeat);
      // Check if any weakness situationKey matches (partial: same street + action)
      heroWeaknessMatch = heroKeys.some(hk => {
        const [hStreet, , , hAction] = hk.split(':');
        return heroWeaknesses.some(w =>
          w.situationKeys?.some(sk => {
            const [wStreet, , , wAction] = sk.split(':');
            return wStreet === hStreet && wAction === hAction;
          })
        );
      }) ? 1 : 0;
    }
  }

  const heroLearning = (heroActedPostflop + heroFacedAggression + heroCommittedMoney + heroWeaknessMatch) / 4;

  // ─── B. Villain Intelligence Value (weight 0.35) ───

  const hasShowdown = Object.keys(showdownCards).length > 0 ? 1 : 0;

  let villainWeaknessRevealed = 0;
  let villainProfileDeviation = 0;
  let lowSampleVillain = 0;

  const villainSeats = Object.entries(seatPlayers)
    .filter(([seat]) => Number(seat) !== Number(heroSeat))
    .map(([seat, pid]) => ({ seat: Number(seat), playerId: pid }));

  for (const { seat, playerId } of villainSeats) {
    const tendency = tendencyMap?.[playerId];

    // Weakness match
    if (!villainWeaknessRevealed && tendency?.weaknesses?.length > 0) {
      const villainKeys = buildQuickSituationKeys(hand, seat, buttonSeat);
      if (villainKeys.some(vk => {
        const [vStreet, , , vAction] = vk.split(':');
        return tendency.weaknesses.some(w =>
          w.situationKeys?.some(sk => {
            const [wStreet, , , wAction] = sk.split(':');
            return wStreet === vStreet && wAction === vAction;
          })
        );
      })) {
        villainWeaknessRevealed = 1;
      }
    }

    // Profile deviation: passive player raised, or tight player called postflop
    if (!villainProfileDeviation && tendency) {
      const villainActions = seq.filter(e => Number(e.seat) === seat);
      const af = tendency.af ?? 0;
      const vpip = tendency.vpip ?? 50;

      // Passive player (AF<1) raised postflop
      if (af < 1) {
        const raised = villainActions.some(e => {
          const p = LEGACY_TO_PRIMITIVE[e.action] ?? e.action;
          return e.street !== 'preflop' && p === PRIMITIVE_ACTIONS.RAISE;
        });
        if (raised) villainProfileDeviation = 1;
      }

      // Tight player (VPIP<20) called postflop
      if (vpip < 20) {
        const called = villainActions.some(e => {
          const p = LEGACY_TO_PRIMITIVE[e.action] ?? e.action;
          return e.street !== 'preflop' && p === PRIMITIVE_ACTIONS.CALL;
        });
        if (called) villainProfileDeviation = 1;
      }
    }

    // Low sample villain (< 5 hands)
    if (tendency && (tendency.sampleSize ?? Infinity) < 5) {
      lowSampleVillain = 0.5;
    }
  }

  const villainIntel = (hasShowdown + villainWeaknessRevealed + villainProfileDeviation + lowSampleVillain) / 4;

  // ─── C. Structural Factors (weight 0.25) ───

  const bettingStreets = new Set(seq.map(e => e.street).filter(s => s !== 'showdown'));
  const streetsPlayed = Math.min(Math.max(0, bettingStreets.size - 1) / 3, 1); // 0-1

  // Non-trivial actions: exclude preflop folds
  const nonTrivialCount = seq.filter(e => {
    if (e.street === 'preflop') {
      const p = LEGACY_TO_PRIMITIVE[e.action] ?? e.action;
      return p !== PRIMITIVE_ACTIONS.FOLD;
    }
    return true;
  }).length;
  const nonTrivialActions = Math.min(nonTrivialCount, 12) / 12;

  // Pot to blind ratio
  let pot = 0;
  const blinds = hand.gameState?.blindsPosted;
  if (blinds) pot = (blinds.sb || 1) + (blinds.bb || 2);
  else pot = 3;
  for (const entry of seq) {
    if (entry.amount) pot += entry.amount;
  }
  const potToBlindRatio = Math.min(pot / 20, 1);

  // Multiway: 3+ players saw flop
  const flopActions = seq.filter(e => e.street === 'flop');
  const flopSeats = new Set(flopActions.map(e => Number(e.seat)));
  const multiWay = flopSeats.size >= 3 ? 0.5 : 0;

  const structural = (streetsPlayed + nonTrivialActions + potToBlindRatio + multiWay) / 4;

  // ─── Final Score ───

  const score = 0.40 * heroLearning + 0.35 * villainIntel + 0.25 * structural;

  return {
    score,
    factors: { heroLearning, villainIntel, structural },
  };
};
