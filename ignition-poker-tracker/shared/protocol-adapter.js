/**
 * shared/protocol-adapter.js — Maps raw Ignition payloads to normalized domain events
 *
 * Pure functions. No state, no side effects.
 * All cents-to-dollars conversion and protocol.decode*() calls happen here.
 * HSM consumes domain events, never raw payloads.
 */

import * as protocol from './protocol.js';

const { PID: P } = protocol;

// Noise PIDs — produce no domain events
const NOISE_PIDS = new Set([
  'SYS_INFO', 'SYS_MSG_V2', P.PONG, P.LATENCY_REPORT, P.PLAY_TIME_INFO,
  P.CO_SELECT_SPEED_BTN, P.CO_CARDHAND_INFO, P.CO_RABBITCARD_INFO,
  P.CO_LAST_HAND_NUMBER, P.PLAY_ACCOUNT_INFO, P.PLAY_CLEAR_INFO,
  P.CO_CURRENT_PLAYER,
  // App-bridge outbound PIDs that may appear
  'PLAY_ACCOUNT_CASH_RES', 'PLAY_SEAT_RESERVATION', 'CO_PRESELECT_BLINDS',
  'CO_SHOW_BTN', 'CO_SHOW_REQ', 'PLAY_BUYIN_INFO',
]);

/**
 * Adapt a raw Ignition WebSocket payload into normalized domain events.
 *
 * @param {string} pid - Message type identifier
 * @param {object} payload - Raw message payload
 * @returns {Array<object>} Array of domain events (may be empty)
 */
export const adaptPayload = (pid, payload) => {
  if (NOISE_PIDS.has(pid)) return [{ kind: 'ignored' }];

  switch (pid) {
    case P.PLAY_STAGE_INFO:
    case P.PLAY_TOUR_STAGENUMBER:
      return adaptNewHand(payload);

    case P.CO_DEALER_SEAT:
      return adaptDealerSeat(payload);

    case P.CO_TABLE_STATE:
      return adaptTableState(payload);

    case P.CO_BLIND_INFO:
      return adaptBlind(payload);

    case P.CO_CARDTABLE_INFO:
      return adaptHoleCards(payload);

    case P.CO_BCARD3_INFO:
      return adaptFlop(payload);

    case P.CO_BCARD1_INFO:
      return adaptBoardCard(payload);

    case P.CO_SELECT_REQ:
      return adaptSelectReq(payload);

    case P.CO_SELECT_INFO:
      return adaptAction(payload);

    case P.CO_CHIPTABLE_INFO:
      return adaptChipTable(payload);

    case P.CO_PCARD_INFO:
      return adaptRevealedCards(payload);

    case P.CO_SHOW_INFO:
      return adaptShowMuck(payload);

    case P.CO_RESULT_INFO:
      return adaptResult(payload);

    case P.CO_POT_INFO:
      return adaptPotDistribution(payload);

    case P.PLAY_STAGE_END_REQ:
      return [{ kind: 'handEnd' }];

    case P.CO_SIT_PLAY:
      return adaptSitPlay(payload);

    case P.PLAY_SEAT_INFO:
      return adaptSeatInfo(payload);

    case P.CO_TABLE_INFO:
      return adaptTableInfo(payload);

    case P.CO_OPTION_INFO:
      return adaptOptionInfo(payload);

    case P.TCO_ANTE_INFO_ALL:
      return adaptTournamentAntes(payload);

    case P.PLAY_TOUR_LEVEL_INFO:
      return [{ kind: 'tournamentLevel', payload: { ...payload } }];

    default:
      return [{ kind: 'diagnostic', pid, payload }];
  }
};

// ============================================================================
// ADAPTERS — one per domain concern
// ============================================================================

function adaptNewHand(payload) {
  const handNumber = payload.stageNo || payload.stageNumber || payload.stageNo2 || null;
  return [{ kind: 'newHand', handNumber }];
}

function adaptDealerSeat(payload) {
  if (typeof payload.seat !== 'number') return [];
  return [{ kind: 'dealerSeat', seat: payload.seat }];
}

function adaptTableState(payload) {
  const stateValue = protocol.extractTableState(payload);
  if (stateValue === null) return [];

  const streetName = protocol.mapStreet(stateValue);
  return [{ kind: 'streetChange', stateValue, streetName }];
}

function adaptBlind(payload) {
  const { seat, account, btn, bet } = payload;
  if (typeof seat !== 'number') return [];

  const blindType = protocol.decodeBlindType(btn);
  return [{
    kind: 'blind',
    seat,
    blindType,
    amount: (bet || 0) / 100,
    stack: typeof account === 'number' ? account / 100 : null,
  }];
}

function adaptHoleCards(payload) {
  const events = [];
  for (const key of Object.keys(payload)) {
    const match = key.match(/^seat(\d+)$/);
    if (!match) continue;
    const seat = parseInt(match[1], 10);
    const cards = payload[key];
    if (!cards || !Array.isArray(cards)) continue;

    const decoded = cards.map(c => protocol.decodeCard(c));
    const hasRealCards = decoded.some(c => c !== '');

    events.push({
      kind: 'holeCards',
      seat,
      cards: decoded,
      isHero: hasRealCards,
    });
  }
  return events;
}

function adaptFlop(payload) {
  if (!Array.isArray(payload.bcard)) return [];
  return [{
    kind: 'communityCards',
    cards: payload.bcard.map(c => protocol.decodeCard(c)),
    position: 'flop',
  }];
}

function adaptBoardCard(payload) {
  const { pos, card } = payload;
  const decoded = protocol.decodeCard(card);
  if (!decoded) return [];

  const position = pos === 4 ? 'turn' : pos === 5 ? 'river' : null;
  if (!position) return [];

  return [{ kind: 'communityCards', cards: [decoded], position, slotIndex: pos }];
}

function adaptSelectReq(payload) {
  if (typeof payload.seat !== 'number') return [];
  return [{ kind: 'heroHint', seat: payload.seat, source: 'selectReq' }];
}

/**
 * ON A RAISE, `bet` IS NOT THE RAISE. It is the amount that was OWED before the raise.
 *
 * CO_SELECT_INFO carries two money fields and they do different jobs:
 *   - `bet`   — chips this seat is putting in now, for CHECK / BET / CALL.
 *   - `raise` — chips this seat is putting in now, for RAISE. `bet` on the same frame is
 *               the call portion of it, i.e. what was owed a moment ago.
 *
 * This function read `bet` for every action, so every raise in every captured hand recorded
 * THE CALL PRICE instead of the raise. Measured on the four real captures in
 * `spike-data/captures/` by reconciling each frame against the seat's own stack movement
 * (`account` is the stack AFTER the action): using `raise` on a raise, 119 of 119 raises
 * reconcile exactly; using `bet`, none of the raises that were more than a call do. The
 * remaining mismatches are all frames where the stack went UP between observations, i.e. the
 * seat won a pot in between — not action frames at all.
 *
 * What that corrupted, concretely: an open to 3bb over a 1bb blind was recorded as an amount
 * of 1bb. The sidebar's "faced bet" (render-orchestrator) read that number, and any villain
 * measurement keyed on raise SIZE would have pooled a min-open with a pot-sized open — which
 * is the exact defect `scripts/villainArchetype/__checks__/sizeConditioning.check.mjs` exists
 * to catch on the corpus side.
 *
 * BOTH FIELDS ARE INCREMENTS — chips in now, not "raise to". The record layer converts to the
 * app's total-street-commitment convention; see `hand-state-machine.js` `_recordAction`.
 */
function adaptAction(payload) {
  const { seat, btn, bet, raise, account } = payload;
  const action = protocol.decodeAction(btn);
  if (!action || typeof seat !== 'number') return [];

  const chips = action === 'raise' ? raise : bet;

  return [{
    kind: 'action',
    seat,
    action,
    amount: (action === 'bet' || action === 'call' || action === 'raise') &&
            typeof chips === 'number' && chips > 0 ? chips / 100 : null,
    stack: typeof account === 'number' ? account / 100 : null,
  }];
}

function adaptChipTable(payload) {
  if (!Array.isArray(payload.curPot) || payload.curPot.length === 0) return [];
  const pot = payload.curPot.reduce((sum, p) => sum + (p || 0), 0) / 100;
  return [{ kind: 'potUpdate', pot }];
}

function adaptRevealedCards(payload) {
  const { seat, card } = payload;
  if (typeof seat !== 'number' || !Array.isArray(card)) return [];
  const decoded = card.map(c => protocol.decodeCard(c));
  if (!decoded.some(c => c !== '')) return [];
  return [{ kind: 'revealedCards', seat, cards: decoded }];
}

function adaptShowMuck(payload) {
  const { seat, btn } = payload;
  const action = protocol.decodeShowAction(btn);
  if (action !== 'muck' || typeof seat !== 'number') return [];
  return [{ kind: 'showMuck', seat }];
}

function adaptResult(payload) {
  const stacks = {};
  if (Array.isArray(payload.account)) {
    for (let i = 0; i < payload.account.length; i++) {
      if (typeof payload.account[i] === 'number') {
        stacks[i + 1] = payload.account[i] / 100;
      }
    }
  }

  const winners = [];
  for (const key of Object.keys(payload)) {
    const match = key.match(/^handHi(\d+)$/);
    if (match) winners.push(parseInt(match[1], 10));
  }

  return [{ kind: 'result', stacks, winners }];
}

function adaptPotDistribution(payload) {
  const returnHi = Array.isArray(payload.returnHi) ? payload.returnHi : [];
  return [{ kind: 'potDistribution', rawPayload: payload, returnHi }];
}

function adaptSitPlay(payload) {
  if (payload.play !== 1 || typeof payload.seat !== 'number') return [];
  return [{ kind: 'heroHint', seat: payload.seat, source: 'sitPlay' }];
}

function adaptSeatInfo(payload) {
  const { seat, regSeatNo, type, account } = payload;
  if (typeof seat !== 'number') return [];
  return [{
    kind: 'seatInfo',
    seat,
    regSeatNo: typeof regSeatNo === 'number' ? regSeatNo : null,
    isActive: type === 1 || type === undefined,
    stack: typeof account === 'number' && account > 0 ? account / 100 : null,
  }];
}

function adaptOptionInfo(payload) {
  return [{
    kind: 'optionInfo',
    blinds: {
      sb: typeof payload.sblind === 'number' ? payload.sblind / 100 : null,
      bb: typeof payload.bblind === 'number' ? payload.bblind / 100 : null,
    },
    ante: typeof payload.ante === 'number' ? payload.ante / 100 : 0,
    gameType: payload.gameType !== undefined ? payload.gameType : null,
    rawPayload: payload,
  }];
}

function adaptTournamentAntes(payload) {
  const stacks = {};
  if (Array.isArray(payload.account)) {
    for (let i = 0; i < payload.account.length; i++) {
      if (typeof payload.account[i] === 'number' && payload.account[i] > 0) {
        stacks[i + 1] = payload.account[i] / 100;
      }
    }
  }
  return [{
    kind: 'tournamentAntes',
    stacks,
    ante: typeof payload.ante === 'number' && payload.ante > 0 ? payload.ante / 100 : 0,
  }];
}

/**
 * CO_TABLE_INFO is a composite message — it can carry dealer seat, player cards,
 * seat states, stacks, board cards, and table state all in one payload.
 * We decompose it into multiple sequential domain events.
 */
function adaptTableInfo(payload) {
  const events = [];

  // Dealer seat
  if (typeof payload.dealerSeat === 'number') {
    events.push({ kind: 'dealerSeat', seat: payload.dealerSeat });
  }

  // Determine which seats are present
  const tableSeats = new Set();
  for (const key of Object.keys(payload)) {
    const match = key.match(/^pcard(\d+)$/);
    if (!match) continue;
    const s = parseInt(match[1], 10);
    tableSeats.add(s);
    const cards = payload[key];
    if (Array.isArray(cards)) {
      const decoded = cards.map(c => protocol.decodeCard(c));
      if (decoded.some(c => c !== '')) {
        events.push({ kind: 'holeCards', seat: s, cards: decoded, isHero: true });
      }
    }
  }

  if (tableSeats.size === 0 && Array.isArray(payload.seatState)) {
    for (let i = 0; i < payload.seatState.length; i++) {
      if (payload.seatState[i] > 0) tableSeats.add(i + 1);
    }
  }

  // Stacks + seat presence
  if (Array.isArray(payload.account)) {
    for (let i = 0; i < payload.account.length; i++) {
      const seat = i + 1;
      if (payload.account[i] > 0) {
        const isRelevant = tableSeats.size === 0 || tableSeats.has(seat);
        events.push({
          kind: 'seatInfo',
          seat,
          regSeatNo: null,
          isActive: isRelevant,
          stack: payload.account[i] / 100,
        });
      }
    }
  } else if (tableSeats.size > 0) {
    for (const s of tableSeats) {
      events.push({ kind: 'seatInfo', seat: s, regSeatNo: null, isActive: true, stack: null });
    }
  }

  // Board cards
  if (Array.isArray(payload.bcard)) {
    const boardCards = payload.bcard.map(c => protocol.decodeCard(c)).filter(c => c !== '');
    if (boardCards.length > 0) {
      events.push({ kind: 'communityCards', cards: boardCards, position: 'tableInfo' });
    }
  }

  // Table state (must be last — may trigger street transition)
  if (typeof payload.tableState === 'number') {
    const stateValue = payload.tableState;
    const streetName = protocol.mapStreet(stateValue);
    if (streetName) {
      events.push({ kind: 'streetChange', stateValue, streetName });
    }
  }

  // If nothing was extracted, return a diagnostic
  if (events.length === 0) {
    return [{ kind: 'diagnostic', pid: 'CO_TABLE_INFO', payload }];
  }

  return events;
}
