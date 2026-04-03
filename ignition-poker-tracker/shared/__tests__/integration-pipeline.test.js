/**
 * Integration test — verifies message shapes survive all boundary transformations.
 *
 * Tests the full data flow without Chrome APIs:
 *   HSM → buildHandRecord → wire-schema builders → BRIDGE_MSG shapes
 *
 * If any layer renames/removes a field, these tests fail immediately.
 */

import { describe, it, expect } from 'vitest';
import { buildRecordFromState } from '../record-builder.js';
import { buildHandRecord, validateHandRecord } from '../hand-format.js';
import {
  buildHandForRelay, validateHandForRelay,
  buildExploitSeat, validateExploitSeat,
  buildActionAdvice, validateActionAdvice,
  buildLiveContext, validateLiveContext,
  buildStatus, validateStatus,
} from '../wire-schemas.js';
import { validateMessage } from '../message-schemas.js';
import { BRIDGE_MSG, PROTOCOL_VERSION } from '../constants.js';

// ============================================================================
// FIXTURES
// ============================================================================

const sampleHandInput = {
  currentStreet: 'river',
  dealerButtonSeat: 3,
  mySeat: 5,
  actionSequence: [
    { seat: 1, action: 'fold', street: 'preflop', order: 1 },
    { seat: 3, action: 'raise', street: 'preflop', order: 2, amount: 6 },
    { seat: 5, action: 'call', street: 'preflop', order: 3, amount: 6 },
    { seat: 3, action: 'bet', street: 'flop', order: 4, amount: 8 },
    { seat: 5, action: 'call', street: 'flop', order: 5, amount: 8 },
    { seat: 3, action: 'check', street: 'turn', order: 6 },
    { seat: 5, action: 'bet', street: 'turn', order: 7, amount: 15 },
    { seat: 3, action: 'call', street: 'turn', order: 8, amount: 15 },
  ],
  absentSeats: [2, 4, 6, 7, 8, 9],
  communityCards: ['A♥', 'K♦', 'Q♣', 'J♠', 'T♥'],
  holeCards: ['A♠', 'K♠'],
  allPlayerCards: { 3: ['9♥', '9♦'] },
  seatPlayers: { 1: 'seat_1', 3: 'seat_3', 5: 'hero' },
  tableId: 'table_conn_42',
  ignitionMeta: {
    handNumber: 'conn_42_seq_7',
    blinds: { sb: 0.5, bb: 1 },
    ante: 0,
    gameType: null,
    finalStacks: { 1: 95, 3: 72, 5: 133 },
    pot: 58,
    potDistribution: [],
    winners: [5],
  },
};

const sampleTendencyData = {
  style: 'LAG',
  sampleSize: 35,
  exploits: [
    { id: 'overbet_bluff', label: 'Overbet bluff spots', category: 'sizing', street: 'turn', statBasis: 'betSizing', scoring: { ev: 2.1 }, tier: 'confirmed' },
  ],
  weaknesses: [
    { id: 'fold_to_3bet', label: 'Folds to 3-bet too often', category: 'preflop', severity: 0.75, confidence: 0.8 },
  ],
  briefings: [
    { ruleId: 'brief_lag_adjust', label: 'LAG adjustment', scoring: { ev: 1.5 }, evidenceBreakdown: '3-bet fold 72%', handExamples: ['hand1'], riskAnalysis: 'low' },
  ],
  observations: [
    { id: 'obs_wide_open', heroContext: 'ip', heroContextLabel: 'In Position', signal: 'wide_open', severity: 0.6, confidence: 0.7, tier: 'confirmed', street: 'preflop', evidence: { vpip: 42 } },
  ],
  cbet: 70,
  foldToCbet: 45,
  threeBet: 12,
  villainProfile: { headline: 'Loose-Aggressive with sizing tells' },
};

const sampleAdvice = {
  villainSeat: 3,
  villainStyle: 'LAG',
  villainSampleSize: 35,
  heroAlreadyActed: false,
  confidence: 0.85,
  dataQuality: 'good',
  situation: 'facing_cbet',
  situationLabel: 'Facing C-Bet on Wet Board',
  heroEquity: 0.52,
  boardTexture: 'wet',
  segmentation: { draws: 3, madeHands: 2 },
  foldPct: 40,
  recommendations: [{ action: 'raise', ev: 3.2, sizing: '2.5x' }],
  currentStreet: 'flop',
  potSize: 14,
  villainBet: 8,
  playerStats: { vpip: 42, pfr: 30 },
};

const sampleLiveContext = {
  currentStreet: 'flop',
  communityCards: ['A♥', 'K♦', 'Q♣'],
  holeCards: ['A♠', 'K♠'],
  heroSeat: 5,
  dealerSeat: 3,
  pot: 14,
  foldedSeats: [1],
  activeSeatNumbers: [3, 5],
  actionSequence: [{ seat: 3, action: 'bet', street: 'flop', order: 1, amount: 8 }],
  blinds: { sb: 0.5, bb: 1 },
  ante: 0,
  gameType: null,
  pfAggressor: 3,
  handNumber: 'conn_42_seq_7',
  state: 'FLOP',
  stacks: { 3: 92, 5: 108 },
  seatDisplayMap: null,
  tournamentLevelInfo: null,
};

// ============================================================================
// TEST 1: Hand Complete — HSM → buildHandRecord → relay → BRIDGE_MSG.HANDS
// ============================================================================

describe('Integration: Hand Complete pipeline', () => {
  it('hand record survives all transformations', () => {
    // Step 1: HSM builds the hand record
    const record = buildHandRecord(sampleHandInput);

    // Step 2: Validate the record (HSM does this before emitting)
    const validation = validateHandRecord(record);
    expect(validation.valid).toBe(true);

    // Step 3: Hand is enqueued to chrome.storage.session (no Port needed)
    // Step 4: app-bridge picks up from storage.onChanged, builds relay shape
    const relayedHand = buildHandForRelay(record);
    expect(relayedHand).not.toBeNull();
    expect(validateHandForRelay(relayedHand).valid).toBe(true);

    // Step 5: app-bridge posts to window — simulate BRIDGE_MSG.HANDS
    const bridgeMsg = {
      type: BRIDGE_MSG.HANDS,
      hands: [relayedHand],
      _v: PROTOCOL_VERSION,
      meta: { extensionVersion: '0.9.0', timestamp: Date.now() },
    };

    // Step 6: Verify the shape that useSyncBridge.importHands expects
    expect(bridgeMsg.hands).toHaveLength(1);
    const hand = bridgeMsg.hands[0];
    expect(hand.gameState).toBeDefined();
    expect(hand.gameState.currentStreet).toBe('river');
    expect(hand.gameState.dealerButtonSeat).toBe(3);
    expect(hand.gameState.mySeat).toBe(5);
    expect(hand.gameState.actionSequence).toHaveLength(8);
    expect(hand.cardState).toBeDefined();
    expect(hand.cardState.communityCards).toHaveLength(5);
    expect(hand.cardState.holeCards).toHaveLength(2);
    expect(hand.tableId).toBe('table_conn_42');
    expect(hand.source).toBe('ignition');
    expect(hand.ignitionMeta.handNumber).toBe('conn_42_seq_7');
  });

  it('hand_saved notification validates', () => {
    const msg = { type: 'hand_saved', captureId: 'table_conn_42_conn_42_seq_7', queueLength: 1 };
    expect(validateMessage('hand_saved', msg)).toBeNull();
  });
});

// ============================================================================
// TEST 2: Exploit round-trip — tendency data → wire schema → port → cache
// ============================================================================

describe('Integration: Exploit data pipeline', () => {
  it('exploit seat data survives all transformations', () => {
    // Step 1: App builds exploit seats via wire-schema builder
    const seat = buildExploitSeat('3', sampleTendencyData);
    expect(validateExploitSeat(seat).valid).toBe(true);

    // Step 2: App posts BRIDGE_MSG.EXPLOITS
    const bridgeMsg = {
      type: BRIDGE_MSG.EXPLOITS,
      seats: [seat],
      handCount: 35,
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    };

    // Step 3: app-bridge translates to port message
    const portMsg = {
      type: 'sync_exploits',
      seats: bridgeMsg.seats,
      handCount: bridgeMsg.handCount,
      timestamp: bridgeMsg.timestamp,
    };
    expect(validateMessage('sync_exploits', portMsg)).toBeNull();

    // Step 4: SW caches and pushes to side panel
    const sidePanelMsg = {
      type: 'push_exploits',
      seats: portMsg.seats,
      appConnected: true,
    };
    expect(validateMessage('push_exploits', sidePanelMsg)).toBeNull();

    // Step 5: Verify all fields survived
    const finalSeat = sidePanelMsg.seats[0];
    expect(finalSeat.seat).toBe('3');
    expect(finalSeat.style).toBe('LAG');
    expect(finalSeat.exploits).toHaveLength(1);
    expect(finalSeat.exploits[0].id).toBe('overbet_bluff');
    expect(finalSeat.weaknesses).toHaveLength(1);
    expect(finalSeat.briefings).toHaveLength(1);
    expect(finalSeat.observations).toHaveLength(1);
    expect(finalSeat.stats.cbet).toBe(70);
    expect(finalSeat.villainHeadline).toBe('Loose-Aggressive with sizing tells');
  });
});

// ============================================================================
// TEST 3: Action advice round-trip
// ============================================================================

describe('Integration: Action advice pipeline', () => {
  it('advice data survives all transformations', () => {
    // Step 1: App builds advice via wire-schema builder
    const advice = buildActionAdvice(sampleAdvice);
    expect(validateActionAdvice(advice).valid).toBe(true);

    // Step 2: App posts BRIDGE_MSG.ACTION_ADVICE
    const bridgeMsg = {
      type: BRIDGE_MSG.ACTION_ADVICE,
      advice,
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    };

    // Step 3: app-bridge translates to port message
    const portMsg = {
      type: 'sync_action_advice',
      advice: bridgeMsg.advice,
      timestamp: bridgeMsg.timestamp,
    };
    expect(validateMessage('sync_action_advice', portMsg)).toBeNull();

    // Step 4: SW pushes to side panel
    const sidePanelMsg = {
      type: 'push_action_advice',
      advice: portMsg.advice,
      timestamp: portMsg.timestamp,
    };
    expect(validateMessage('push_action_advice', sidePanelMsg)).toBeNull();

    // Step 5: Verify key fields survived
    expect(sidePanelMsg.advice.situation).toBe('facing_cbet');
    expect(sidePanelMsg.advice.recommendations).toHaveLength(1);
    expect(sidePanelMsg.advice.heroEquity).toBe(0.52);
    expect(sidePanelMsg.advice.villainSeat).toBe(3);
  });
});

// ============================================================================
// TEST 4: Status round-trip
// ============================================================================

describe('Integration: Status pipeline', () => {
  it('status request → response cycle has valid shapes', () => {
    // App sends status request
    const request = {
      type: BRIDGE_MSG.STATUS,
      request: true,
      _v: PROTOCOL_VERSION,
    };
    expect(request.type).toBe('POKER_SYNC_STATUS');

    // app-bridge responds with buildStatus
    const statusBody = buildStatus({ connected: true, protocolVersion: PROTOCOL_VERSION });
    expect(validateStatus(statusBody).valid).toBe(true);

    const response = {
      type: BRIDGE_MSG.STATUS,
      ...statusBody,
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    };

    // Validate the SW port-level status message
    const portStatus = { type: 'status', connected: true, protocolVersion: PROTOCOL_VERSION };
    expect(validateMessage('status', portStatus)).toBeNull();

    // Verify useSyncBridge can read the response
    expect(response.connected).toBe(true);
    expect(response.protocolVersion).toBe(PROTOCOL_VERSION);
    expect(response.request).toBeUndefined(); // Not a request
  });

  it('disconnect status has valid shape', () => {
    const status = buildStatus({ connected: false, contextDead: true });
    expect(validateStatus(status).valid).toBe(true);
    expect(status.connected).toBe(false);
    expect(status.contextDead).toBe(true);
  });
});

// ============================================================================
// TEST 5: Live context round-trip
// ============================================================================

describe('Integration: Live context pipeline', () => {
  it('live context survives all transformations', () => {
    // Step 1: HSM produces live context (simulated)
    const ctx = buildLiveContext(sampleLiveContext);
    expect(validateLiveContext(ctx).valid).toBe(true);

    // Step 2: Content script sends to SW
    const portMsg = { type: 'live_context', context: ctx };
    expect(validateMessage('live_context', portMsg)).toBeNull();

    // Step 3: SW relays to app-bridge, which posts BRIDGE_MSG.HAND_STATE
    const bridgeMsg = {
      type: BRIDGE_MSG.HAND_STATE,
      ...ctx,
      _v: PROTOCOL_VERSION,
      timestamp: Date.now(),
    };

    // Step 4: Verify useSyncBridge can read key fields
    expect(bridgeMsg.currentStreet).toBe('flop');
    expect(bridgeMsg.heroSeat).toBe(5);
    expect(bridgeMsg.actionSequence).toHaveLength(1);
    expect(bridgeMsg.handNumber).toBe('conn_42_seq_7');

    // Step 5: SW also pushes to side panel
    const sidePanelMsg = { type: 'push_live_context', context: ctx };
    expect(validateMessage('push_live_context', sidePanelMsg)).toBeNull();
  });

  it('extra fields from HSM are stripped by builder', () => {
    const ctxWithExtra = { ...sampleLiveContext, debugInfo: 'should be dropped', internalId: 999 };
    const ctx = buildLiveContext(ctxWithExtra);
    expect(ctx.debugInfo).toBeUndefined();
    expect(ctx.internalId).toBeUndefined();
    expect(ctx.currentStreet).toBe('flop');
  });
});

// ============================================================================
// TEST 6: Hand relay whitelist — extra fields stripped, action entries sanitized
// ============================================================================

describe('Integration: Hand relay whitelist enforcement', () => {
  it('strips unknown top-level fields from hand record', () => {
    const record = buildHandRecord(sampleHandInput);
    // Add extra fields that should NOT cross the wire
    record._internalId = 'debug_123';
    record.debugTimings = { parse: 5, validate: 2 };

    const relayed = buildHandForRelay(record);
    expect(relayed._internalId).toBeUndefined();
    expect(relayed.debugTimings).toBeUndefined();
    // Valid fields preserved
    expect(relayed.timestamp).toBe(record.timestamp);
    expect(relayed.source).toBe('ignition');
    expect(relayed.tableId).toBe('table_conn_42');
  });

  it('strips unknown fields from gameState', () => {
    const record = buildHandRecord(sampleHandInput);
    record.gameState._lastTransition = 'RIVER→SHOWDOWN';
    record.gameState.rawTableState = 64;

    const relayed = buildHandForRelay(record);
    expect(relayed.gameState._lastTransition).toBeUndefined();
    expect(relayed.gameState.rawTableState).toBeUndefined();
    expect(relayed.gameState.currentStreet).toBe('river');
    expect(relayed.gameState.actionSequence).toHaveLength(8);
  });

  it('strips unknown fields from action entries', () => {
    const record = buildHandRecord(sampleHandInput);
    record.gameState.actionSequence[0]._rawBtn = 1024;
    record.gameState.actionSequence[0].debugSource = 'CO_SELECT_INFO';

    const relayed = buildHandForRelay(record);
    expect(relayed.gameState.actionSequence[0]._rawBtn).toBeUndefined();
    expect(relayed.gameState.actionSequence[0].debugSource).toBeUndefined();
    expect(relayed.gameState.actionSequence[0].seat).toBe(1);
    expect(relayed.gameState.actionSequence[0].action).toBe('fold');
  });

  it('strips unknown fields from ignitionMeta', () => {
    const record = buildHandRecord(sampleHandInput);
    record.ignitionMeta._eventLogSnapshot = [1, 2, 3];
    record.ignitionMeta.rawPayloads = {};

    const relayed = buildHandForRelay(record);
    expect(relayed.ignitionMeta._eventLogSnapshot).toBeUndefined();
    expect(relayed.ignitionMeta.rawPayloads).toBeUndefined();
    expect(relayed.ignitionMeta.handNumber).toBe('conn_42_seq_7');
    expect(relayed.ignitionMeta.blinds).toEqual({ sb: 0.5, bb: 1 });
  });

  it('full round-trip: build → relay → validate wire → validate record', () => {
    const record = buildHandRecord(sampleHandInput);
    const relayed = buildHandForRelay(record);

    // Both validators must agree
    const wireV = validateHandForRelay(relayed);
    expect(wireV.valid).toBe(true);
    expect(wireV.errors).toEqual([]);

    const recordV = validateHandRecord(relayed);
    expect(recordV.valid).toBe(true);
    expect(recordV.errors).toEqual([]);
  });

  it('validator catches invalid action entries', () => {
    const record = buildHandRecord(sampleHandInput);
    const relayed = buildHandForRelay(record);
    // Corrupt an action entry
    relayed.gameState.actionSequence[0].seat = 0;  // Invalid: must be 1-9
    relayed.gameState.actionSequence[1].action = 'allin'; // Invalid action

    const v = validateHandForRelay(relayed);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes('action[0].seat'))).toBe(true);
    expect(v.errors.some(e => e.includes('action[1].action'))).toBe(true);
  });

  it('validator catches invalid card format', () => {
    const record = buildHandRecord(sampleHandInput);
    const relayed = buildHandForRelay(record);
    relayed.cardState.communityCards[0] = 'AH'; // Wrong format (should be A♥)

    const v = validateHandForRelay(relayed);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes('invalid card'))).toBe(true);
  });

  it('validator catches malformed ignitionMeta.blinds', () => {
    const record = buildHandRecord(sampleHandInput);
    const relayed = buildHandForRelay(record);
    relayed.ignitionMeta.blinds = { sb: 'half', bb: 'one' }; // Should be numbers

    const v = validateHandForRelay(relayed);
    expect(v.valid).toBe(false);
    expect(v.errors.some(e => e.includes('blinds'))).toBe(true);
  });
});

// ============================================================================
// TEST 7: Edge cases — preflop-only, partial, record-builder path
// ============================================================================

describe('Integration: Edge case hand records', () => {
  it('preflop-only hand (everyone folds) survives full pipeline', () => {
    const preflopInput = {
      currentStreet: 'preflop',
      dealerButtonSeat: 1,
      mySeat: 5,
      actionSequence: [
        { seat: 3, action: 'raise', street: 'preflop', order: 1, amount: 3 },
        { seat: 5, action: 'fold', street: 'preflop', order: 2 },
        { seat: 1, action: 'fold', street: 'preflop', order: 3 },
      ],
      absentSeats: [2, 4, 6, 7, 8, 9],
      communityCards: ['', '', '', '', ''],
      holeCards: ['7♣', '2♦'],
      allPlayerCards: {},
      seatPlayers: { 1: 'seat_1', 3: 'seat_3', 5: 'hero' },
      tableId: 'table_conn_99',
      ignitionMeta: {
        handNumber: 'conn_99_seq_1',
        blinds: { sb: 0.25, bb: 0.50 },
        ante: 0,
        gameType: null,
        finalStacks: { 1: 99.75, 3: 101.50, 5: 98.75 },
        pot: 1.25,
        potDistribution: [],
        winners: [3],
      },
    };

    const record = buildHandRecord(preflopInput);
    const validation = validateHandRecord(record);
    expect(validation.valid).toBe(true);

    const relayed = buildHandForRelay(record);
    expect(relayed).not.toBeNull();
    expect(validateHandForRelay(relayed).valid).toBe(true);
    expect(validateHandRecord(relayed).valid).toBe(true);

    expect(relayed.gameState.currentStreet).toBe('preflop');
    expect(relayed.cardState.communityCards).toEqual(['', '', '', '', '']);
    expect(relayed.cardState.holeCards).toEqual(['7♣', '2♦']);
  });

  it('partial hand (reconnect-interrupted) with metadata survives pipeline', () => {
    const partialInput = {
      ...sampleHandInput,
      currentStreet: 'flop',
      communityCards: ['A♥', 'K♦', 'Q♣', '', ''],
      actionSequence: sampleHandInput.actionSequence.slice(0, 4),
      ignitionMeta: {
        ...sampleHandInput.ignitionMeta,
        partial: true,
        reconnectInterrupted: true,
        heroSeatConfidence: 'low',
      },
    };

    const record = buildHandRecord(partialInput);
    const validation = validateHandRecord(record);
    expect(validation.valid).toBe(true);

    const relayed = buildHandForRelay(record);
    expect(relayed).not.toBeNull();
    expect(validateHandForRelay(relayed).valid).toBe(true);

    // Verify partial/reconnect metadata survived relay whitelist
    expect(relayed.ignitionMeta.partial).toBe(true);
    expect(relayed.ignitionMeta.reconnectInterrupted).toBe(true);
    expect(relayed.gameState.currentStreet).toBe('flop');
  });

  it('record-builder → hand-format → wire-schemas full path', () => {
    // Simulate HSM accumulated state
    const hsmState = {
      currentStreet: 'turn',
      dealerSeat: 2,
      heroSeat: 5,
      actionSequence: [
        { seat: 5, action: 'raise', street: 'preflop', order: 1, amount: 3 },
        { seat: 2, action: 'call', street: 'preflop', order: 2, amount: 3 },
        { seat: 5, action: 'bet', street: 'flop', order: 3, amount: 4 },
        { seat: 2, action: 'call', street: 'flop', order: 4, amount: 4 },
      ],
      communityCards: ['T♠', '8♦', '3♣', 'J♥'],
      holeCards: ['A♠', 'K♠'],
      allPlayerCards: {},
      activeSeats: new Set([2, 5]),
      seatPlayers: { 2: 'seat_2' },
      connId: 'conn_77',
      handNumber: 'conn_77_seq_3',
      blinds: { sb: 0.5, bb: 1 },
      ante: 0,
      gameType: null,
      stacks: { 2: 88, 5: 112 },
      pot: 15,
      potDistribution: [],
      winners: [],
      seatDisplayMap: null,
      heroSeatConfidence: 'high',
    };

    // Step 1: record-builder produces a validated record
    const { record, validation } = buildRecordFromState(hsmState);
    expect(validation.valid).toBe(true);
    expect(record).not.toBeNull();

    // Step 2: wire-schemas can relay it
    const relayed = buildHandForRelay(record);
    expect(relayed).not.toBeNull();
    expect(validateHandForRelay(relayed).valid).toBe(true);

    // Step 3: app-side validation also passes
    expect(validateHandRecord(relayed).valid).toBe(true);

    // Verify key fields
    expect(relayed.gameState.mySeat).toBe(5);
    expect(relayed.gameState.dealerButtonSeat).toBe(2);
    expect(relayed.tableId).toBe('table_conn_77');
    expect(relayed.seatPlayers['5']).toBe('hero');
  });

  it('record-builder rejects null heroSeat', () => {
    const noHeroState = {
      currentStreet: 'preflop',
      dealerSeat: 1,
      heroSeat: null,
      actionSequence: [],
      communityCards: [],
      holeCards: [],
      allPlayerCards: {},
      activeSeats: new Set([1, 3]),
      seatPlayers: {},
      connId: 'conn_88',
      handNumber: 'conn_88_seq_1',
      blinds: { sb: 0.5, bb: 1 },
      ante: 0,
      gameType: null,
      stacks: {},
      pot: 0,
      potDistribution: [],
      winners: [],
      seatDisplayMap: null,
    };

    const { record, validation } = buildRecordFromState(noHeroState);
    expect(record).toBeNull();
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toContain('heroSeat');
  });
});
