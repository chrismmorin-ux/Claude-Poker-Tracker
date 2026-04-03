/**
 * shared/hand-state-machine.js — Per-table hand state machine
 *
 * Pure FSM that consumes normalized domain events (from protocol-adapter.js)
 * and accumulates state into hand records (via record-builder.js).
 *
 * States: IDLE → DEALING → PREFLOP → FLOP → TURN → RIVER → SHOWDOWN → COMPLETE
 *
 * Reference: spike-data/SPIKE_REPORT.md
 */

import * as handFormat from './hand-format.js';
import { adaptPayload } from './protocol-adapter.js';
import { buildRecordFromState } from './record-builder.js';

// Monotonic fallback hand number (tournaments that don't send PLAY_STAGE_INFO)
let handSequenceCounter = 0;

export const STATES = {
  IDLE: 'IDLE',
  DEALING: 'DEALING',
  PREFLOP: 'PREFLOP',
  FLOP: 'FLOP',
  TURN: 'TURN',
  RIVER: 'RIVER',
  SHOWDOWN: 'SHOWDOWN',
  COMPLETE: 'COMPLETE',
};

// Map CO_TABLE_STATE values to our FSM states
const TABLE_STATE_TO_FSM = {
  8: STATES.PREFLOP,
  16: STATES.FLOP,
  32: STATES.TURN,
  64: STATES.RIVER,
  4096: STATES.SHOWDOWN,   // Tournament showdown
  8192: STATES.COMPLETE,   // Tournament results
  32768: STATES.SHOWDOWN,  // Cash game showdown
  65536: STATES.COMPLETE,  // Cash game results
};

// Valid state transitions — guards against out-of-order or garbled WS messages
const VALID_TRANSITIONS = {
  [STATES.IDLE]:      [STATES.DEALING],
  [STATES.DEALING]:   [STATES.PREFLOP, STATES.COMPLETE],
  [STATES.PREFLOP]:   [STATES.FLOP, STATES.SHOWDOWN, STATES.COMPLETE],
  [STATES.FLOP]:      [STATES.TURN, STATES.SHOWDOWN, STATES.COMPLETE],
  [STATES.TURN]:      [STATES.RIVER, STATES.SHOWDOWN, STATES.COMPLETE],
  [STATES.RIVER]:     [STATES.SHOWDOWN, STATES.COMPLETE],
  [STATES.SHOWDOWN]:  [STATES.COMPLETE],
  [STATES.COMPLETE]:  [STATES.IDLE, STATES.DEALING],
};

/**
 * All monetary values (pot, stacks, blinds, bet amounts) are stored in DOLLARS.
 * Conversion from cents happens in protocol-adapter.js.
 */
export class HandStateMachine {
  /**
   * @param {string|number} connId - WebSocket connection identifier
   * @param {function} onHandComplete - callback(handRecord) when a hand finishes
   * @param {function} onError - callback(error, context) for non-fatal errors
   */
  constructor(connId, onHandComplete, onError) {
    this.connId = connId;
    this.onHandComplete = onHandComplete;
    this.onError = onError || (() => {});
    this.heroSeat = null; // Sticky across hands
    this.completedHandCount = 0;

    // Tournament / table config (sticky, set by optionInfo)
    this.gameType = null;
    this.ante = 0;
    this.tableConfig = null;

    // Tournament seat display map: physical position (1-9) → regSeatNo
    this.seatDisplayMap = {};

    // Tournament level info (sticky)
    this.tournamentLevelInfo = null;

    // Unified event log — ring buffer for diagnostics, protocol, and validation events
    this.eventLog = [];

    this.reset();
  }

  // =========================================================================
  // STATE RESET
  // =========================================================================

  reset() {
    this.state = STATES.IDLE;
    this.handNumber = null;
    this.dealerSeat = null;
    this.currentStreet = null;

    // Cards
    this.holeCards = ['', ''];
    this.communityCards = [];
    this.allPlayerCards = {};

    // Actions
    this.actionSequence = [];
    this.actionOrder = 0;

    // Players
    this.seatPlayers = {};
    this.activeSeats = new Set();
    this.foldedSeats = new Set();

    // Pot & stacks
    this.pot = 0;
    this.stacks = {};
    this.blinds = { sb: 0, bb: 0 };

    // Result
    this.winners = [];
    this.potDistribution = [];

    // Tournament / table config (sticky across hands — NOT reset)

    // Metadata
    this.startTimestamp = null;
    this.lastMessageTimestamp = null;
  }

  /**
   * Set hero seat with priority — higher priority sources always win.
   * @param {number} seat
   * @param {boolean} definitive - true only for hole cards (most reliable signal)
   */
  setHeroSeat(seat, definitive = false) {
    if (typeof seat !== 'number' || seat < 1) return;
    const newConfidence = definitive ? 'high' : 'low';
    if (definitive || !this.heroSeat) {
      this.heroSeat = seat;
      this.heroSeatConfidence = newConfidence;
    }
  }

  // =========================================================================
  // STATE TRANSITION GUARD
  // =========================================================================

  /**
   * Attempt a state transition. Returns true if the transition was valid and applied.
   * Invalid transitions are logged to eventLog but do NOT throw.
   */
  _transitionTo(newState) {
    const allowed = VALID_TRANSITIONS[this.state];
    if (!allowed || !allowed.includes(newState)) {
      this._logEvent({
        kind: 'validation',
        type: 'invalid_transition',
        from: this.state,
        to: newState,
        timestamp: Date.now(),
        handNumber: this.handNumber,
      });
      return false;
    }
    this.state = newState;
    return true;
  }

  // =========================================================================
  // CORRUPTION DETECTOR — catches impossible accumulated state
  // =========================================================================

  /**
   * Check for impossible accumulated state after each event.
   * Returns true if corruption was detected and state was reset.
   */
  _checkCorruption() {
    // Skip checks when not in an active hand
    if (this.state === STATES.IDLE || this.state === STATES.COMPLETE) return false;

    const reasons = [];

    // Runaway action accumulation
    if (this.actionSequence.length > 100) {
      reasons.push(`runaway actions: ${this.actionSequence.length}`);
    }

    // More than 5 community cards
    if (this.communityCards.length > 5) {
      reasons.push(`community cards overflow: ${this.communityCards.length}`);
    }

    // Folded seats not in active seats (only check when activeSeats is populated)
    if (this.activeSeats.size > 0) {
      for (const seat of this.foldedSeats) {
        if (!this.activeSeats.has(seat)) {
          reasons.push(`folded seat ${seat} not in activeSeats`);
          break; // One example is enough
        }
      }
    }

    if (reasons.length === 0) return false;

    // Corruption detected — log, report, and force reset
    this._logEvent({
      kind: 'validation',
      type: 'corruption_detected',
      reasons,
      timestamp: Date.now(),
      handNumber: this.handNumber,
      state: this.state,
      actionCount: this.actionSequence.length,
      communityCardCount: this.communityCards.length,
    });

    this.onError(
      new Error(`State corruption detected: ${reasons.join('; ')}`),
      { handNumber: this.handNumber, state: this.state, reasons }
    );

    this.reset();
    return true;
  }

  // =========================================================================
  // MAIN DISPATCH — adapts raw payloads then applies domain events
  // =========================================================================

  /**
   * Process a parsed WebSocket message.
   * @param {string} pid - Message type identifier
   * @param {object} payload - Message payload (excludes pid)
   */
  processMessage(pid, payload) {
    this.lastMessageTimestamp = Date.now();

    // Log raw protocol for diagnostics (before adaptation)
    this._logProtocol(pid, payload);

    // Adapt raw payload into normalized domain events
    const events = adaptPayload(pid, payload);

    // Tournament fallback: if IDLE and we receive hand-lifecycle events,
    // auto-start a new hand. Tournaments don't always send PLAY_STAGE_INFO.
    if (this.state === STATES.IDLE) {
      const hasHandSignal = events.some(e =>
        e.kind === 'blind' ||
        e.kind === 'dealerSeat' ||
        (e.kind === 'streetChange' && e.streetName === 'preflop')
      );
      if (hasHandSignal) {
        this.reset();
        this._transitionTo(STATES.DEALING);
        this.handNumber = `${this.connId}_seq_${++handSequenceCounter}`;
        this.startTimestamp = Date.now();
      }
    }

    // Apply each domain event to accumulated state
    for (const event of events) {
      this._applyEvent(event);
      if (this._checkCorruption()) break; // Corrupted state — reset, stop processing
    }
  }

  // =========================================================================
  // EVENT APPLICATION — one case per domain event kind
  // =========================================================================

  _applyEvent(event) {
    switch (event.kind) {
      case 'newHand':
        return this._applyNewHand(event);

      case 'dealerSeat':
        this.dealerSeat = event.seat;
        return;

      case 'streetChange':
        return this._applyStreetChange(event);

      case 'blind': {
        const { seat, blindType, amount, stack } = event;
        this.activeSeats.add(seat);
        this.seatPlayers[seat] = this.seatPlayers[seat] || `seat_${seat}`;
        if (stack !== null) this.stacks[seat] = stack;
        if (blindType === 'sb') this.blinds.sb = amount;
        else if (blindType === 'bb') this.blinds.bb = amount;
        return;
      }

      case 'holeCards': {
        const { seat, cards, isHero } = event;
        this.activeSeats.add(seat);
        this.seatPlayers[seat] = this.seatPlayers[seat] || `seat_${seat}`;
        if (isHero) {
          this.setHeroSeat(seat, true);
          this.holeCards = cards;
          this.seatPlayers[seat] = 'hero';
        }
        return;
      }

      case 'communityCards': {
        if (event.position === 'flop' || event.position === 'tableInfo') {
          this.communityCards = event.cards;
        } else if (event.position === 'turn') {
          while (this.communityCards.length < 3) this.communityCards.push('');
          this.communityCards.push(event.cards[0]);
        } else if (event.position === 'river') {
          while (this.communityCards.length < 4) this.communityCards.push('');
          this.communityCards.push(event.cards[0]);
        }
        return;
      }

      case 'action': {
        this.actionOrder++;
        const entry = {
          seat: event.seat,
          action: event.action,
          street: this.currentStreet || 'preflop',
          order: this.actionOrder,
        };
        if (event.amount !== null) entry.amount = event.amount;
        this.actionSequence.push(entry);
        if (event.action === 'fold') this.foldedSeats.add(event.seat);
        if (event.stack !== null) this.stacks[event.seat] = event.stack;
        return;
      }

      case 'heroHint':
        this.setHeroSeat(event.seat, false);
        return;

      case 'potUpdate':
        this.pot = event.pot;
        return;

      case 'revealedCards':
        this.allPlayerCards[event.seat] = event.cards;
        return;

      case 'showMuck':
        this.actionOrder++;
        this.actionSequence.push({
          seat: event.seat,
          action: 'mucked',
          street: 'showdown',
          order: this.actionOrder,
        });
        return;

      case 'result': {
        for (const [seat, stack] of Object.entries(event.stacks)) {
          this.stacks[Number(seat)] = stack;
        }
        this.winners.push(...event.winners);
        return;
      }

      case 'potDistribution': {
        this.potDistribution.push(event.rawPayload);
        for (let i = 0; i < event.returnHi.length; i++) {
          if (event.returnHi[i] > 0) {
            this.actionOrder++;
            this.actionSequence.push({
              seat: i + 1,
              action: 'won',
              street: 'showdown',
              order: this.actionOrder,
            });
          }
        }
        return;
      }

      case 'seatInfo': {
        const { seat, regSeatNo, isActive, stack } = event;
        if (regSeatNo !== null) this.seatDisplayMap[seat] = regSeatNo;
        if (isActive) {
          this.activeSeats.add(seat);
          if (!this.seatPlayers[seat]) this.seatPlayers[seat] = `seat_${seat}`;
          if (stack !== null) this.stacks[seat] = stack;
        }
        return;
      }

      case 'optionInfo': {
        if (event.blinds.sb !== null) this.blinds.sb = event.blinds.sb;
        if (event.blinds.bb !== null) this.blinds.bb = event.blinds.bb;
        if (event.ante !== undefined) this.ante = event.ante;
        if (event.gameType !== null) this.gameType = event.gameType;
        // Preserve tableConfig for diagnostics
        const newConfig = JSON.stringify(event.rawPayload);
        if (newConfig !== this._lastOptionInfoJson) {
          this._lastOptionInfoJson = newConfig;
          this.tableConfig = { ...event.rawPayload };
          this._logDiagnosticEvent('CO_OPTION_INFO', event.rawPayload);
        }
        return;
      }

      case 'tournamentAntes': {
        for (const [seat, stack] of Object.entries(event.stacks)) {
          this.stacks[Number(seat)] = stack;
        }
        if (event.ante > 0) this.ante = event.ante;
        return;
      }

      case 'tournamentLevel':
        this.tournamentLevelInfo = event.payload;
        this._logDiagnosticEvent('PLAY_TOUR_LEVEL_INFO', event.payload);
        return;

      case 'handEnd':
        return this._applyHandEnd();

      case 'diagnostic':
        if (event.payload) this._logDiagnosticEvent(event.pid, event.payload);
        return;

      case 'ignored':
        return;
    }
  }

  // =========================================================================
  // COMPOUND EVENT HANDLERS
  // =========================================================================

  _applyNewHand(event) {
    const newStageNo = event.handNumber
      || `${this.connId}_seq_${++handSequenceCounter}`;

    if (newStageNo === this.handNumber &&
        (this.state === STATES.COMPLETE || this.state === STATES.DEALING)) {
      return;
    }

    if (this.state !== STATES.IDLE && this.state !== STATES.COMPLETE &&
        this.actionSequence.length > 0) {
      try {
        const partialRecord = this.buildRecord();
        if (partialRecord) {
          partialRecord.ignitionMeta.partial = true;
          this.onHandComplete(partialRecord);
          this.completedHandCount++;
        }
      } catch (e) {
        // Couldn't save partial — not critical
      }
    }

    this.reset();
    this._transitionTo(STATES.DEALING);
    this.handNumber = newStageNo;
    this.startTimestamp = Date.now();
  }

  _applyStreetChange(event) {
    const newState = TABLE_STATE_TO_FSM[event.stateValue];
    if (!newState) return;
    if (!this._transitionTo(newState)) return;

    const streetName = event.streetName;
    if (streetName && streetName !== 'setup' && streetName !== 'blinds' &&
        streetName !== 'results' && streetName !== 'reset') {
      this.currentStreet = streetName;
    }
  }

  _applyHandEnd() {
    if (this.state === STATES.IDLE &&
        (this.actionSequence.length === 0 || !this.heroSeat)) return;

    try {
      const record = this.buildRecord();
      this.completedHandCount++;
      if (record) {
        this.onHandComplete(record);
      }
    } catch (e) {
      this.onError(e, {
        handNumber: this.handNumber,
        state: this.state,
      });
    }

    this.reset();
  }

  // =========================================================================
  // RECORD BUILDER — delegates to record-builder.js
  // =========================================================================

  buildRecord() {
    const { record, validation } = buildRecordFromState({
      currentStreet: this.currentStreet,
      dealerSeat: this.dealerSeat,
      heroSeat: this.heroSeat,
      heroSeatConfidence: this.heroSeatConfidence || 'unknown',
      actionSequence: this.actionSequence,
      communityCards: this.communityCards,
      holeCards: this.holeCards,
      allPlayerCards: this.allPlayerCards,
      activeSeats: this.activeSeats,
      seatPlayers: this.seatPlayers,
      connId: this.connId,
      handNumber: this.handNumber,
      blinds: this.blinds,
      ante: this.ante,
      gameType: this.gameType,
      stacks: this.stacks,
      pot: this.pot,
      potDistribution: this.potDistribution,
      winners: this.winners,
      seatDisplayMap: this.seatDisplayMap,
    });

    this._logEvent({
      kind: 'validation',
      timestamp: Date.now(),
      handNumber: this.handNumber,
      valid: validation.valid,
      errors: validation.errors,
      heroSeat: this.heroSeat,
      dealerSeat: this.dealerSeat,
      activeSeats: [...this.activeSeats],
      street: this.currentStreet || 'preflop',
      actionCount: this.actionSequence.length,
    });

    if (!validation.valid) {
      this.onError(
        new Error(`Validation failed: ${validation.errors.join(', ')}`),
        { handNumber: this.handNumber, errors: validation.errors }
      );
      return null;
    }

    return record;
  }

  // =========================================================================
  // EVENT LOGGING — unified ring buffer for diagnostics, protocol, validation
  // =========================================================================

  static MAX_EVENT_LOG = 200;

  _logEvent(entry) {
    if (this.eventLog.length >= HandStateMachine.MAX_EVENT_LOG) this.eventLog.shift();
    this.eventLog.push(entry);
  }

  _logDiagnosticEvent(pid, payload) {
    const sampleValues = {};
    for (const [k, v] of Object.entries(payload || {})) {
      if (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean') {
        sampleValues[k] = v;
      } else if (Array.isArray(v)) {
        sampleValues[k] = `[${v.length} items]`;
      } else if (v && typeof v === 'object') {
        sampleValues[k] = `{${Object.keys(v).join(',')}}`;
      }
    }
    this._logEvent({
      kind: 'diagnostic',
      pid,
      keys: Object.keys(payload || {}),
      sampleValues,
      timestamp: Date.now(),
    });
  }

  _logProtocol(pid, payload) {
    const NOISE_PIDS = ['SYS_INFO', 'SYS_MSG_V2', 'PONG', 'LATENCY_REPORT', 'PLAY_TIME_INFO'];
    if (NOISE_PIDS.includes(pid)) return;

    const entry = { kind: 'protocol', pid, timestamp: Date.now(), state: this.state };
    if (payload.seat !== undefined) entry.seat = payload.seat;
    if (payload.dealerSeat !== undefined) entry.dealerSeat = payload.dealerSeat;
    if (payload.tableState !== undefined) entry.tableState = payload.tableState;
    if (payload.btn !== undefined) entry.btn = payload.btn;
    if (payload.bet !== undefined) entry.bet = payload.bet;
    if (payload.play !== undefined) entry.play = payload.play;
    if (payload.stageNo !== undefined) entry.stageNo = payload.stageNo;
    if (payload.stageNumber !== undefined) entry.stageNumber = payload.stageNumber;
    if (Array.isArray(payload.account)) entry.accountLen = payload.account.length;
    if (Array.isArray(payload.bcard)) entry.bcardLen = payload.bcard.length;
    const seatKeys = Object.keys(payload).filter(k => /^seat\d+$/.test(k));
    if (seatKeys.length > 0) entry.seatKeys = seatKeys;
    const pcardKeys = Object.keys(payload).filter(k => /^pcard\d+$/.test(k));
    if (pcardKeys.length > 0) entry.pcardKeys = pcardKeys;
    this._logEvent(entry);
  }

  /**
   * Get event log entries, optionally filtered by kind.
   * @param {string} [kind] - 'diagnostic', 'protocol', or 'validation'
   */
  getEventLog(kind) {
    if (!kind) return this.eventLog;
    return this.eventLog.filter(e => e.kind === kind);
  }

  // =========================================================================
  // ACCESSORS
  // =========================================================================

  getState() {
    const board = [...this.communityCards];
    while (board.length < 5) board.push('');

    return {
      state: this.state,
      handNumber: this.handNumber,
      heroSeat: this.heroSeat,
      currentStreet: this.currentStreet,
      dealerSeat: this.dealerSeat,
      pot: this.pot,
      activeSeats: [...this.activeSeats],
      activeSeatCount: this.activeSeats.size,
      actionCount: this.actionSequence.length,
      completedHands: this.completedHandCount,
      communityCards: board.map(handFormat.normalizeCard),
      holeCards: this.holeCards.map(handFormat.normalizeCard),
      seatDisplayMap: Object.keys(this.seatDisplayMap).length > 0
        ? { ...this.seatDisplayMap } : null,
    };
  }

  getLiveHandContext() {
    let pfAggressor = null;
    for (const a of this.actionSequence) {
      if (a.street === 'preflop' && a.action === 'raise') {
        pfAggressor = a.seat;
      }
    }

    return {
      currentStreet: this.currentStreet,
      communityCards: this.communityCards.map(handFormat.normalizeCard),
      holeCards: this.holeCards.map(handFormat.normalizeCard),
      heroSeat: this.heroSeat,
      dealerSeat: this.dealerSeat,
      pot: this.pot,
      foldedSeats: [...this.foldedSeats],
      activeSeatNumbers: [...this.activeSeats],
      actionSequence: this.actionSequence.map(a => ({ ...a })),
      blinds: { ...this.blinds },
      ante: this.ante,
      gameType: this.gameType,
      pfAggressor,
      handNumber: this.handNumber,
      state: this.state,
      stacks: { ...this.stacks },
      seatDisplayMap: Object.keys(this.seatDisplayMap).length > 0
        ? { ...this.seatDisplayMap } : null,
      tournamentLevelInfo: this.tournamentLevelInfo || null,
    };
  }
}
