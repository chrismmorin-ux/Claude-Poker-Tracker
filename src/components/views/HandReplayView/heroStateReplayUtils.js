/**
 * @file Helpers for HeroStateSection — derives the minimal gameState shape
 * that buildHeroState() needs from a HandReplay step, and a neutral
 * alignment detector for the side-by-side panel comparison.
 *
 * Per WS-143 plan-mode (SPR-029), HeroState is rederived per replay view
 * (no IDB cache for v1). These helpers are sync; buildHeroState itself
 * is async and runs from HeroStateSection's effect.
 *
 * First-principles guard: alignment label is neutral editor's-note tone
 * per chris-live-player.md autonomy red line #5. NEVER use 'wrong',
 * 'missed', score, streak, or grading copy.
 */

import { getPositionName } from '../../../utils/positionUtils.js';
import { effectiveStackAt } from '../../../utils/seatStacks/stackLedger';
import { committedSoFar } from '../../../utils/seatStacks/handSettlement';

/**
 * Derive a minimal HSP gameState from a HandReplay step. HSP soft-degrades
 * when fields are missing (per HSP-DESIGN.md §10.1 two-tier failure mode);
 * we provide what we can without inventing data.
 *
 * @param {object} args
 * @param {object} args.hand              - Full hand record from IDB.
 * @param {Array}  args.visibleActions    - actionSequence[0..currentActionIndex].
 * @param {object} args.currentActionEntry - { seat, action, amount, street, order }.
 * @param {number} args.heroSeat          - Hero's seat number.
 * @param {number} args.buttonSeat        - Dealer button seat for position derivation.
 * @returns {object} - HSP gameState (subset; HSP fills nulls for unspecified fields).
 */
export const reconstructGameStateAt = ({
  hand,
  visibleActions,
  currentActionEntry,
  heroSeat,
  buttonSeat,
}) => {
  if (!hand || !currentActionEntry) {
    throw new Error('reconstructGameStateAt: hand + currentActionEntry are required');
  }

  const street = currentActionEntry.street;
  const board = getBoardForStreet(hand, street);
  const heroPosition = heroSeat && buttonSeat
    ? getPositionName(heroSeat, buttonSeat)
    : null;

  const pot = sumPotAt(hand, visibleActions);
  const playersRemaining = countActivePlayersAt(hand, visibleActions);
  const effStack = deriveEffStackAt(hand, visibleActions, heroSeat);

  return {
    street,
    board: board || [],
    heroPosition,
    playersRemaining,
    pot,
    effStack,
    actionSequence: visibleActions || [],
    rake: hand.gameState?.rake ?? null,
    // inPosition: null preflop; postflop derivation skipped for v1 simplicity.
    // HSP classifier accepts inPosition: null/undefined and will route to
    // OOP/IP archetypes via the actionContext defaults.
    inPosition: street === 'preflop' ? null : true,
  };
};

const getBoardForStreet = (hand, street) => {
  const cc = hand?.cardState?.communityCards;
  if (!cc || !Array.isArray(cc)) return [];
  if (street === 'preflop') return [];
  if (street === 'flop') return cc.slice(0, 3);
  if (street === 'turn') return cc.slice(0, 4);
  if (street === 'river') return cc.slice(0, 5);
  return [];
};

const sumPotAt = (hand, visibleActions) => {
  const blinds = hand?.gameState?.blindsPosted;
  let total = 0;
  if (Array.isArray(blinds)) {
    for (const b of blinds) total += Number(b?.amount) || 0;
  }
  if (Array.isArray(visibleActions)) {
    for (const a of visibleActions) total += Number(a?.amount) || 0;
  }
  return total;
};

const countActivePlayersAt = (hand, visibleActions) => {
  // Start from the seats with cards or with stack; subtract folded seats.
  const totalSeats = Object.keys(hand?.gameState?.players || {}).length || 2;
  const folded = new Set();
  for (const a of visibleActions || []) {
    if (a?.action === 'fold') folded.add(Number(a.seat));
  }
  const active = Math.max(2, totalSeats - folded.size);
  return active;
};

/**
 * Effective stack at this point in the replay.
 *
 * STK-1 — WHAT THIS REPLACES. The previous implementation read
 * `hand.gameState.players[seat].stack`, a field nothing in the cash path has
 * ever written (`usePersistence` saves street, button, seat, actions and absent
 * seats). It therefore returned 0 on every cash hand, and because
 * `buildHeroState` gates on `gameState.effStack && …`, a falsy 0 silently
 * suppressed the SPR zone entirely. It failed invisibly rather than degrading.
 *
 * It was also the wrong quantity: it computed hero's REMAINING stack and called
 * it effective stack. Effective stack is min(hero, deepest live opponent) —
 * `effectiveStackAt` is now the single definition of it in the codebase.
 *
 * Returns `null` when stacks are unknown or inadmissible, NOT 0, so a consumer
 * can tell "no basis" from "hero is all in". Callers that still want a falsy
 * value get one either way; callers that care can now distinguish them.
 */
const deriveEffStackAt = (hand, visibleActions, heroSeat) => {
  const ledger = hand?.gameState?.seatStacks;
  if (!ledger || Object.keys(ledger).length === 0) return null;

  const blinds = hand?.gameState?.blinds ?? hand?.blinds ?? null;
  const committed = blinds
    ? committedSoFar(visibleActions, blinds, {
        smallBlindSeat: hand?.gameState?.smallBlindSeat,
        bigBlindSeat: hand?.gameState?.bigBlindSeat,
      })
    : {};

  const liveSeats = liveSeatsAt(hand, visibleActions);
  const { amount } = effectiveStackAt(ledger, {
    heroSeat,
    liveSeats,
    currentHand: Number(hand?.gameState?.handNumber) || 0,
    committed,
  });
  return amount;
};

/** Seats dealt in and not yet folded at this point. */
const liveSeatsAt = (hand, visibleActions) => {
  const folded = new Set(
    (visibleActions || []).filter((a) => a?.action === 'fold').map((a) => Number(a.seat)),
  );
  const dealt = Object.keys(hand?.gameState?.seatStacks || {}).map(Number);
  return dealt.filter((s) => !folded.has(s));
};

// ─── Alignment detection ─────────────────────────────────────────────────

/**
 * Compare hero's actual action against HeroState's canonical plan.primary.
 *
 * Returns a neutral alignment descriptor used by HeroStateSection's
 * ActualPanel. NEVER includes score / grading / engagement-pressure copy
 * per chris-live-player.md autonomy red line #5.
 *
 * @param {object} actualAction       - { action, amount, ... }
 * @param {object|null} planPrimary   - HeroState.plan.primary or null when degraded
 * @returns {{label: string, kind: 'aligned'|'deviation'|'unknown'}}
 */
export const detectAlignment = (actualAction, planPrimary) => {
  if (!actualAction || !planPrimary) {
    return { label: 'No canonical baseline available.', kind: 'unknown' };
  }

  const actualVerb = normalizeAction(actualAction.action);
  const canonicalVerb = normalizeAction(planPrimary.action);

  if (actualVerb === canonicalVerb) {
    // Same action verb. Optionally describe sizing alignment.
    if (planPrimary.sizing != null && actualAction.amount != null) {
      const ratio = Number(actualAction.amount) / Number(planPrimary.sizing);
      if (ratio >= 0.8 && ratio <= 1.25) {
        return { label: 'Aligned with canonical line + sizing.', kind: 'aligned' };
      }
      return {
        label: `Action aligned; sizing differs (canonical ${planPrimary.sizing}).`,
        kind: 'aligned',
      };
    }
    return { label: 'Aligned with canonical line.', kind: 'aligned' };
  }

  return {
    label: `Different line from canonical (canonical: ${canonicalVerb}).`,
    kind: 'deviation',
  };
};

const normalizeAction = (a) => {
  if (!a) return '';
  return String(a).toLowerCase().trim();
};
