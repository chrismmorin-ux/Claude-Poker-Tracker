/**
 * Tests for shared/protocol.js
 *
 * Covers: parseWsMessage, parseWsBatch, decodeCard, decodeAction, decodeBlindType,
 *         mapStreet, extractTableState, decodeShowAction, isGameWsUrl,
 *         isTournamentRelated, and exported constants.
 */

import { describe, it, expect } from 'vitest';
import {
  parseWsMessage,
  parseWsBatch,
  decodeCard,
  decodeAction,
  decodeBlindType,
  mapStreet,
  extractTableState,
  decodeShowAction,
  isGameWsUrl,
  isTournamentRelated,
  PID,
  FACE_DOWN,
  ACTION_BITS,
  TABLE_STATE_MAP,
  GAME_WS_URL,
} from '../protocol.js';
import {
  RAW_MESSAGES,
  CARDS,
  DECODED_CARDS,
  ACTION_PAYLOADS,
  BLIND_PAYLOADS,
  TABLE_STATES,
  SHOW_PAYLOAD,
  MUCK_PAYLOAD,
} from './fixtures/payloads.js';

// ===========================================================================
// CONSTANTS
// ===========================================================================

describe('exported constants', () => {
  it('FACE_DOWN equals 32896 (0x8080)', () => {
    expect(FACE_DOWN).toBe(32896);
  });

  it('GAME_WS_URL contains the expected hostname and path', () => {
    expect(GAME_WS_URL).toBe('pkscb.ignitioncasino.eu/poker-games/rgs');
  });

  it('ACTION_BITS has all five action values', () => {
    expect(ACTION_BITS.CHECK).toBe(64);
    expect(ACTION_BITS.BET).toBe(128);
    expect(ACTION_BITS.CALL).toBe(256);
    expect(ACTION_BITS.RAISE).toBe(512);
    expect(ACTION_BITS.FOLD).toBe(1024);
  });

  it('TABLE_STATE_MAP maps numeric states to street names', () => {
    expect(TABLE_STATE_MAP[8]).toBe('preflop');
    expect(TABLE_STATE_MAP[16]).toBe('flop');
    expect(TABLE_STATE_MAP[32]).toBe('turn');
    expect(TABLE_STATE_MAP[64]).toBe('river');
  });

  it('PID contains expected lifecycle keys', () => {
    expect(PID.PLAY_STAGE_INFO).toBe('PLAY_STAGE_INFO');
    expect(PID.CO_TABLE_STATE).toBe('CO_TABLE_STATE');
    expect(PID.CO_SELECT_INFO).toBe('CO_SELECT_INFO');
    expect(PID.CO_BLIND_INFO).toBe('CO_BLIND_INFO');
  });
});

// ===========================================================================
// parseWsMessage
// ===========================================================================

describe('parseWsMessage', () => {
  describe('valid game messages', () => {
    it('parses a standard byteLength|JSON game message', () => {
      const result = parseWsMessage(RAW_MESSAGES.gameMessage);
      expect(result).not.toBeNull();
      expect(result.pid).toBe('CO_DEALER_SEAT');
      expect(result.seq).toBe(1);
      expect(result.tDiff).toBe(50);
      expect(result.payload.seat).toBe(5);
    });

    it('does not include pid in the payload object', () => {
      const result = parseWsMessage(RAW_MESSAGES.gameMessage);
      expect(result.payload).not.toHaveProperty('pid');
    });

    it('defaults seq to 0 when missing from JSON', () => {
      const msg = '10|{"tDiff":5,"data":{"pid":"CO_BLIND_INFO","seat":3}}';
      const result = parseWsMessage(msg);
      expect(result.seq).toBe(0);
    });

    it('defaults tDiff to 0 when missing from JSON', () => {
      const msg = '10|{"seq":2,"data":{"pid":"CO_BLIND_INFO","seat":3}}';
      const result = parseWsMessage(msg);
      expect(result.tDiff).toBe(0);
    });

    it('carries all payload fields through', () => {
      const msg = '99|{"seq":7,"tDiff":10,"data":{"pid":"CO_SELECT_INFO","seat":5,"btn":128,"bet":200}}';
      const result = parseWsMessage(msg);
      expect(result.payload.seat).toBe(5);
      expect(result.payload.btn).toBe(128);
      expect(result.payload.bet).toBe(200);
    });
  });

  describe('lobby and tournament messages', () => {
    it('parses a lobby tournament message as __LOBBY__ pid', () => {
      const result = parseWsMessage(RAW_MESSAGES.lobbyMessage);
      expect(result).not.toBeNull();
      expect(result.pid).toBe('__LOBBY__');
      expect(result.lobby).toBe(true);
      expect(result.seq).toBe(0);
      expect(result.tDiff).toBe(0);
    });

    it('includes the parsed JSON as payload for lobby messages', () => {
      const result = parseWsMessage(RAW_MESSAGES.lobbyMessage);
      expect(result.payload.tournament).toBe('MTT');
      expect(result.payload.status).toBe('running');
      expect(result.payload.players).toBe(100);
    });
  });

  describe('pipe handling', () => {
    it('parses a message without a pipe (raw JSON)', () => {
      const result = parseWsMessage(RAW_MESSAGES.noPipe);
      expect(result).not.toBeNull();
      expect(result.pid).toBe('CO_DEALER_SEAT');
    });

    it('handles pipe at position 0 gracefully', () => {
      const msg = '|{"seq":1,"data":{"pid":"PING"}}';
      const result = parseWsMessage(msg);
      expect(result).not.toBeNull();
      expect(result.pid).toBe('PING');
    });

    it('handles byteLength prefix that differs from actual JSON length', () => {
      // Protocol only uses the pipe as a separator — byteLength value is ignored
      const msg = '9999|{"seq":1,"data":{"pid":"CO_TABLE_INFO","val":1}}';
      const result = parseWsMessage(msg);
      expect(result.pid).toBe('CO_TABLE_INFO');
    });
  });

  describe('returns null for bad input', () => {
    it('returns null for malformed JSON', () => {
      expect(parseWsMessage(RAW_MESSAGES.malformedJson)).toBeNull();
    });

    it('returns null for a message with no data field', () => {
      expect(parseWsMessage(RAW_MESSAGES.noData)).toBeNull();
    });

    it('returns null for a message with data but no pid', () => {
      expect(parseWsMessage(RAW_MESSAGES.noPid)).toBeNull();
    });

    it('returns null for null input', () => {
      expect(parseWsMessage(null)).toBeNull();
    });

    it('returns null for undefined input', () => {
      expect(parseWsMessage(undefined)).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(parseWsMessage('')).toBeNull();
    });

    it('returns null for non-string input (number)', () => {
      expect(parseWsMessage(42)).toBeNull();
    });

    it('returns null for non-string input (object)', () => {
      expect(parseWsMessage({ pid: 'CO_DEALER_SEAT' })).toBeNull();
    });

    it('returns null for a plain JSON object with no tournament keywords', () => {
      const msg = '10|{"foo":"bar","baz":123}';
      expect(parseWsMessage(msg)).toBeNull();
    });
  });
});

// ===========================================================================
// decodeCard
// ===========================================================================

describe('decodeCard', () => {
  describe('all four aces (ranks at index 0 of each suit group)', () => {
    it('decodes 0 as Ac (Ace of clubs)', () => {
      expect(decodeCard(CARDS.aceClubs)).toBe(DECODED_CARDS[0]);
      expect(decodeCard(0)).toBe('Ac');
    });

    it('decodes 13 as Ad (Ace of diamonds)', () => {
      expect(decodeCard(CARDS.aceDiamonds)).toBe(DECODED_CARDS[13]);
      expect(decodeCard(13)).toBe('Ad');
    });

    it('decodes 26 as Ah (Ace of hearts)', () => {
      expect(decodeCard(26)).toBe(DECODED_CARDS[26]);
      expect(decodeCard(26)).toBe('Ah');
    });

    it('decodes 39 as As (Ace of spades)', () => {
      expect(decodeCard(CARDS.aceSpades)).toBe(DECODED_CARDS[39]);
      expect(decodeCard(39)).toBe('As');
    });
  });

  describe('all four kings (ranks at index 12 of each suit group)', () => {
    it('decodes 12 as Kc (King of clubs)', () => {
      expect(decodeCard(CARDS.kingClubs)).toBe(DECODED_CARDS[12]);
      expect(decodeCard(12)).toBe('Kc');
    });

    it('decodes 25 as Kd (King of diamonds)', () => {
      expect(decodeCard(25)).toBe('Kd');
    });

    it('decodes 38 as Kh (King of hearts)', () => {
      expect(decodeCard(CARDS.kingHearts)).toBe(DECODED_CARDS[38]);
      expect(decodeCard(38)).toBe('Kh');
    });

    it('decodes 51 as Ks (King of spades)', () => {
      expect(decodeCard(CARDS.kingSpades)).toBe(DECODED_CARDS[51]);
      expect(decodeCard(51)).toBe('Ks');
    });
  });

  describe('mid-deck spot checks using fixture DECODED_CARDS', () => {
    it('decodes 1 as 2c', () => {
      expect(decodeCard(CARDS.twoClubs)).toBe(DECODED_CARDS[1]);
    });

    it('decodes 20 as 8d', () => {
      expect(decodeCard(CARDS.eightDiamonds)).toBe(DECODED_CARDS[20]);
    });

    it('decodes 21 as 9d', () => {
      expect(decodeCard(CARDS.nineDiamonds)).toBe(DECODED_CARDS[21]);
    });
  });

  describe('face-down card', () => {
    it('returns empty string for FACE_DOWN constant (32896)', () => {
      expect(decodeCard(FACE_DOWN)).toBe('');
    });

    it('returns empty string for CARDS.faceDown fixture value', () => {
      expect(decodeCard(CARDS.faceDown)).toBe('');
    });
  });

  describe('out-of-range values', () => {
    it('returns empty string for 52 (one above valid range)', () => {
      expect(decodeCard(52)).toBe('');
    });

    it('returns empty string for -1 (below valid range)', () => {
      expect(decodeCard(-1)).toBe('');
    });

    it('returns empty string for 100', () => {
      expect(decodeCard(100)).toBe('');
    });
  });

  describe('invalid input types', () => {
    it('returns empty string for null', () => {
      expect(decodeCard(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(decodeCard(undefined)).toBe('');
    });

    it('returns empty string for a non-integer float (3.5)', () => {
      expect(decodeCard(3.5)).toBe('');
    });

    it('returns empty string for a string', () => {
      expect(decodeCard('0')).toBe('');
    });

    it('returns empty string for NaN', () => {
      expect(decodeCard(NaN)).toBe('');
    });
  });
});

// ===========================================================================
// decodeAction
// ===========================================================================

describe('decodeAction', () => {
  describe('single bitmask per action', () => {
    it('decodes 64 (CHECK bit) as check', () => {
      expect(decodeAction(ACTION_PAYLOADS.check.btn)).toBe('check');
      expect(decodeAction(64)).toBe('check');
    });

    it('decodes 128 (BET bit) as bet', () => {
      expect(decodeAction(ACTION_PAYLOADS.bet.btn)).toBe('bet');
      expect(decodeAction(128)).toBe('bet');
    });

    it('decodes 256 (CALL bit) as call', () => {
      expect(decodeAction(ACTION_PAYLOADS.call.btn)).toBe('call');
      expect(decodeAction(256)).toBe('call');
    });

    it('decodes 512 (RAISE bit) as raise', () => {
      expect(decodeAction(ACTION_PAYLOADS.raise.btn)).toBe('raise');
      expect(decodeAction(512)).toBe('raise');
    });

    it('decodes 1024 (FOLD bit) as fold', () => {
      expect(decodeAction(ACTION_PAYLOADS.fold.btn)).toBe('fold');
      expect(decodeAction(1024)).toBe('fold');
    });
  });

  describe('priority: fold beats all other bits', () => {
    it('fold wins over raise when both bits set (1024 | 512 = 1536)', () => {
      expect(decodeAction(1024 | 512)).toBe('fold');
    });

    it('fold wins over call when both bits set (1024 | 256 = 1280)', () => {
      expect(decodeAction(1024 | 256)).toBe('fold');
    });

    it('fold wins over bet when both bits set (1024 | 128 = 1152)', () => {
      expect(decodeAction(1024 | 128)).toBe('fold');
    });

    it('fold wins over check when both bits set (1024 | 64 = 1088)', () => {
      expect(decodeAction(1024 | 64)).toBe('fold');
    });

    it('raise wins over call when both bits set (512 | 256 = 768)', () => {
      expect(decodeAction(512 | 256)).toBe('raise');
    });

    it('call wins over bet when both bits set (256 | 128 = 384)', () => {
      expect(decodeAction(256 | 128)).toBe('call');
    });

    it('bet wins over check when both bits set (128 | 64 = 192)', () => {
      expect(decodeAction(128 | 64)).toBe('bet');
    });
  });

  describe('returns null for unrecognised or invalid input', () => {
    it('returns null for 0 (no bits set)', () => {
      expect(decodeAction(0)).toBeNull();
    });

    it('returns null for null', () => {
      expect(decodeAction(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(decodeAction(undefined)).toBeNull();
    });

    it('returns null for a string', () => {
      expect(decodeAction('64')).toBeNull();
    });

    it('returns null for a non-matching positive integer (32)', () => {
      expect(decodeAction(32)).toBeNull();
    });
  });
});

// ===========================================================================
// decodeBlindType
// ===========================================================================

describe('decodeBlindType', () => {
  describe('individual blind types', () => {
    it('decodes 2 as sb', () => {
      expect(decodeBlindType(BLIND_PAYLOADS.sb.btn)).toBe('sb');
      expect(decodeBlindType(2)).toBe('sb');
    });

    it('decodes 4 as bb', () => {
      expect(decodeBlindType(BLIND_PAYLOADS.bb.btn)).toBe('bb');
      expect(decodeBlindType(4)).toBe('bb');
    });

    it('decodes 8 as posted', () => {
      expect(decodeBlindType(BLIND_PAYLOADS.posted.btn)).toBe('posted');
      expect(decodeBlindType(8)).toBe('posted');
    });
  });

  describe('priority: posted beats bb and sb', () => {
    it('posted wins over bb when both bits set (8 | 4 = 12)', () => {
      expect(decodeBlindType(8 | 4)).toBe('posted');
    });

    it('posted wins over sb when both bits set (8 | 2 = 10)', () => {
      expect(decodeBlindType(8 | 2)).toBe('posted');
    });

    it('bb wins over sb when both bits set (4 | 2 = 6)', () => {
      expect(decodeBlindType(4 | 2)).toBe('bb');
    });
  });

  describe('returns null for unrecognised or invalid input', () => {
    it('returns null for 0', () => {
      expect(decodeBlindType(0)).toBeNull();
    });

    it('returns null for null', () => {
      expect(decodeBlindType(null)).toBeNull();
    });

    it('returns null for undefined', () => {
      expect(decodeBlindType(undefined)).toBeNull();
    });

    it('returns null for a string', () => {
      expect(decodeBlindType('2')).toBeNull();
    });

    it('returns null for an unrelated bit (1)', () => {
      expect(decodeBlindType(1)).toBeNull();
    });
  });
});

// ===========================================================================
// mapStreet
// ===========================================================================

describe('mapStreet', () => {
  it('maps 8 to preflop', () => {
    expect(mapStreet(TABLE_STATES.preflop)).toBe('preflop');
    expect(mapStreet(8)).toBe('preflop');
  });

  it('maps 16 to flop', () => {
    expect(mapStreet(TABLE_STATES.flop)).toBe('flop');
    expect(mapStreet(16)).toBe('flop');
  });

  it('maps 32 to turn', () => {
    expect(mapStreet(TABLE_STATES.turn)).toBe('turn');
    expect(mapStreet(32)).toBe('turn');
  });

  it('maps 64 to river', () => {
    expect(mapStreet(TABLE_STATES.river)).toBe('river');
    expect(mapStreet(64)).toBe('river');
  });

  it('maps 32768 to showdown (cash game)', () => {
    expect(mapStreet(TABLE_STATES.showdownCash)).toBe('showdown');
    expect(mapStreet(32768)).toBe('showdown');
  });

  it('maps 65536 to results (cash game)', () => {
    expect(mapStreet(TABLE_STATES.resultsCash)).toBe('results');
    expect(mapStreet(65536)).toBe('results');
  });

  it('maps 4096 to showdown (tournament)', () => {
    expect(mapStreet(TABLE_STATES.showdownTourney)).toBe('showdown');
    expect(mapStreet(4096)).toBe('showdown');
  });

  it('maps 8192 to results (tournament)', () => {
    expect(mapStreet(TABLE_STATES.resultsTourney)).toBe('results');
    expect(mapStreet(8192)).toBe('results');
  });

  it('maps 0 to reset', () => {
    expect(mapStreet(TABLE_STATES.reset)).toBe('reset');
    expect(mapStreet(0)).toBe('reset');
  });

  it('maps 2 to setup', () => {
    expect(mapStreet(TABLE_STATES.setup)).toBe('setup');
  });

  it('maps 4 to blinds', () => {
    expect(mapStreet(TABLE_STATES.blinds)).toBe('blinds');
  });

  it('returns null for an unknown state value', () => {
    expect(mapStreet(999)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(mapStreet(undefined)).toBeNull();
  });

  it('returns null for null', () => {
    expect(mapStreet(null)).toBeNull();
  });
});

// ===========================================================================
// extractTableState
// ===========================================================================

describe('extractTableState', () => {
  it('reads from payload.state when present', () => {
    expect(extractTableState({ state: 8 })).toBe(8);
  });

  it('reads from payload.tableState when state is absent', () => {
    expect(extractTableState({ tableState: 16 })).toBe(16);
  });

  it('reads from payload.status when state and tableState are absent', () => {
    expect(extractTableState({ status: 32 })).toBe(32);
  });

  it('reads from payload.value as tertiary fallback', () => {
    expect(extractTableState({ value: 64 })).toBe(64);
  });

  it('reads from payload.s as last named fallback', () => {
    expect(extractTableState({ s: 8 })).toBe(8);
  });

  it('prefers payload.state over payload.tableState', () => {
    expect(extractTableState({ state: 8, tableState: 16 })).toBe(8);
  });

  it('converts a numeric string in payload.state', () => {
    expect(extractTableState({ state: '16' })).toBe(16);
  });

  it('falls back to scanning payload values when no named key matches', () => {
    expect(extractTableState({ irrelevantKey: 8, otherKey: 'nope' })).toBe(8);
  });

  it('returns first matching scanned value when multiple known states present', () => {
    // Object.values order is insertion order in V8 — first value wins
    const result = extractTableState({ a: 8, b: 16 });
    expect([8, 16]).toContain(result);
  });

  it('returns null when no value matches a known table state', () => {
    expect(extractTableState({ state: 999 })).toBeNull();
  });

  it('returns null when payload is empty', () => {
    expect(extractTableState({})).toBeNull();
  });

  it('returns null when named candidate is undefined', () => {
    expect(extractTableState({ tableState: undefined })).toBeNull();
  });

  it('returns null when state is a non-numeric string that maps to NaN', () => {
    expect(extractTableState({ state: 'notanumber' })).toBeNull();
  });

  it('returns null when no values are known states (all noise)', () => {
    expect(extractTableState({ x: 1000, y: 2000 })).toBeNull();
  });
});

// ===========================================================================
// decodeShowAction
// ===========================================================================

describe('decodeShowAction', () => {
  it('decodes 8192 (SHOW bit) as show', () => {
    expect(decodeShowAction(SHOW_PAYLOAD.btn)).toBe('show');
    expect(decodeShowAction(8192)).toBe('show');
  });

  it('decodes 32768 (MUCK bit) as muck', () => {
    expect(decodeShowAction(MUCK_PAYLOAD.btn)).toBe('muck');
    expect(decodeShowAction(32768)).toBe('muck');
  });

  it('decodes 0 as muck (no bits set)', () => {
    expect(decodeShowAction(0)).toBe('muck');
  });

  it('decodes a combined SHOW+MUCK bitmask as show (SHOW bit wins)', () => {
    expect(decodeShowAction(8192 | 32768)).toBe('show');
  });

  it('decodes null as muck (default)', () => {
    expect(decodeShowAction(null)).toBe('muck');
  });

  it('decodes undefined as muck (default)', () => {
    expect(decodeShowAction(undefined)).toBe('muck');
  });

  it('decodes a string as muck (non-number, default)', () => {
    expect(decodeShowAction('8192')).toBe('muck');
  });

  it('decodes an unrelated positive integer as muck', () => {
    expect(decodeShowAction(1)).toBe('muck');
  });
});

// ===========================================================================
// parseWsBatch — Atmosphere batched frame parsing
// ===========================================================================

describe('parseWsBatch', () => {
  // Helper: build a single Atmosphere segment
  const seg = (json) => `${json.length}|${json}`;

  it('parses a single non-batched message', () => {
    const json = '{"seq":1,"tDiff":50,"data":{"pid":"CO_DEALER_SEAT","seat":5}}';
    const result = parseWsBatch(seg(json));
    expect(result).toHaveLength(1);
    expect(result[0].pid).toBe('CO_DEALER_SEAT');
    expect(result[0].payload.seat).toBe(5);
  });

  it('parses two batched messages', () => {
    const json1 = '{"seq":1,"tDiff":0,"data":{"pid":"CO_DEALER_SEAT","seat":3}}';
    const json2 = '{"seq":2,"tDiff":10,"data":{"pid":"CO_BLIND_INFO","seat":8,"btn":2,"bet":50}}';
    const raw = seg(json1) + seg(json2);
    const result = parseWsBatch(raw);
    expect(result).toHaveLength(2);
    expect(result[0].pid).toBe('CO_DEALER_SEAT');
    expect(result[1].pid).toBe('CO_BLIND_INFO');
    expect(result[1].payload.seat).toBe(8);
    expect(result[1].payload.bet).toBe(50);
  });

  it('parses three batched messages', () => {
    const json1 = '{"seq":1,"tDiff":0,"data":{"pid":"CO_TABLE_STATE","state":8}}';
    const json2 = '{"seq":2,"tDiff":5,"data":{"pid":"CO_BLIND_INFO","seat":8,"btn":2,"bet":50}}';
    const json3 = '{"seq":3,"tDiff":10,"data":{"pid":"CO_BLIND_INFO","seat":9,"btn":4,"bet":100}}';
    const raw = seg(json1) + seg(json2) + seg(json3);
    const result = parseWsBatch(raw);
    expect(result).toHaveLength(3);
    expect(result[0].pid).toBe('CO_TABLE_STATE');
    expect(result[1].pid).toBe('CO_BLIND_INFO');
    expect(result[2].pid).toBe('CO_BLIND_INFO');
  });

  it('handles truncated batch — first message still parses', () => {
    const json1 = '{"seq":1,"tDiff":0,"data":{"pid":"CO_DEALER_SEAT","seat":3}}';
    const json2 = '{"seq":2,"tDiff":10,"data":{"pid":"CO_BLIND_INFO","seat":8';
    // Truncate: byteLength says full length but string is cut short
    const raw = seg(json1) + `${json2.length + 20}|${json2}`;
    const result = parseWsBatch(raw);
    expect(result).toHaveLength(1);
    expect(result[0].pid).toBe('CO_DEALER_SEAT');
  });

  it('skips malformed middle message, parses first and third', () => {
    const json1 = '{"seq":1,"tDiff":0,"data":{"pid":"CO_DEALER_SEAT","seat":3}}';
    const bad = '{broken json!!!}';
    const json3 = '{"seq":3,"tDiff":20,"data":{"pid":"CO_CHIPTABLE_INFO","curPot":[150]}}';
    const raw = seg(json1) + seg(bad) + seg(json3);
    const result = parseWsBatch(raw);
    expect(result).toHaveLength(2);
    expect(result[0].pid).toBe('CO_DEALER_SEAT');
    expect(result[1].pid).toBe('CO_CHIPTABLE_INFO');
  });

  it('handles bare JSON with no pipe prefix', () => {
    const raw = '{"seq":1,"tDiff":0,"data":{"pid":"CO_DEALER_SEAT","seat":5}}';
    const result = parseWsBatch(raw);
    expect(result).toHaveLength(1);
    expect(result[0].pid).toBe('CO_DEALER_SEAT');
  });

  it('returns empty array for null', () => {
    expect(parseWsBatch(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseWsBatch(undefined)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parseWsBatch('')).toEqual([]);
  });

  it('returns empty array for whitespace-only string', () => {
    expect(parseWsBatch('   ')).toEqual([]);
  });

  it('returns empty array for Atmosphere heartbeat "0|"', () => {
    expect(parseWsBatch('0|')).toEqual([]);
  });

  it('handles mixed game + lobby messages in one batch', () => {
    const game = '{"seq":1,"tDiff":0,"data":{"pid":"CO_DEALER_SEAT","seat":3}}';
    const lobby = '{"tournament":"MTT","status":"running","players":100}';
    const raw = seg(game) + seg(lobby);
    const result = parseWsBatch(raw);
    expect(result).toHaveLength(2);
    expect(result[0].pid).toBe('CO_DEALER_SEAT');
    expect(result[1].pid).toBe('__LOBBY__');
    expect(result[1].lobby).toBe(true);
  });

  it('parseWsMessage returns first message from a batch (backwards compat)', () => {
    const json1 = '{"seq":1,"tDiff":0,"data":{"pid":"CO_DEALER_SEAT","seat":3}}';
    const json2 = '{"seq":2,"tDiff":10,"data":{"pid":"CO_BLIND_INFO","seat":8,"btn":2,"bet":50}}';
    const raw = seg(json1) + seg(json2);
    const result = parseWsMessage(raw);
    expect(result).not.toBeNull();
    expect(result.pid).toBe('CO_DEALER_SEAT');
  });
});

// ===========================================================================
// isGameWsUrl
// ===========================================================================

describe('isGameWsUrl', () => {
  it('returns true for the primary URL containing GAME_WS_URL', () => {
    expect(isGameWsUrl(`wss://${GAME_WS_URL}`)).toBe(true);
  });

  it('returns true for the full canonical game URL', () => {
    expect(isGameWsUrl('wss://pkscb.ignitioncasino.eu/poker-games/rgs')).toBe(true);
  });

  it('returns true for a URL containing /poker-games/ path segment', () => {
    expect(isGameWsUrl('wss://example.com/poker-games/other')).toBe(true);
  });

  it('returns true for a URL containing /rgs path segment', () => {
    expect(isGameWsUrl('wss://example.com/rgs')).toBe(true);
  });

  it('returns true for a URL with /rgs as a sub-path', () => {
    expect(isGameWsUrl('wss://something.ignitioncasino.eu/somepath/rgs/endpoint')).toBe(true);
  });

  it('returns true for the lobby gateway URL on ignition domain', () => {
    expect(isGameWsUrl('wss://pkscb.ignitioncasino.eu/ws-gateway/lobby?X-Atmosphere-tracking-id=0&X-Atmosphere-Transport=websocket')).toBe(true);
  });

  it('returns true for lobby gateway on .net domain', () => {
    expect(isGameWsUrl('wss://pkscb.ignitioncasino.net/ws-gateway/lobby')).toBe(true);
  });

  it('returns false for lobby gateway on non-ignition domain', () => {
    expect(isGameWsUrl('wss://example.com/ws-gateway/lobby')).toBe(false);
  });

  it('returns false for a non-gateway lobby URL', () => {
    expect(isGameWsUrl('wss://lobby.ignitioncasino.eu/lobby')).toBe(false);
  });

  it('returns false for an empty string', () => {
    expect(isGameWsUrl('')).toBe(false);
  });

  it('returns false for null', () => {
    expect(isGameWsUrl(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isGameWsUrl(undefined)).toBe(false);
  });

  it('returns false for a non-string value', () => {
    expect(isGameWsUrl(42)).toBe(false);
  });

  it('returns false for a URL that merely mentions poker but not the game paths', () => {
    expect(isGameWsUrl('wss://poker.ignitioncasino.eu/cashier')).toBe(false);
  });
});

// ===========================================================================
// isTournamentRelated
// ===========================================================================

describe('isTournamentRelated', () => {
  it('returns true for an object with a "tournament" key', () => {
    expect(isTournamentRelated({ tournament: 'MTT' })).toBe(true);
  });

  it('returns true for an object with a "blind" key', () => {
    expect(isTournamentRelated({ blind: 100 })).toBe(true);
  });

  it('returns true for an object with a "level" key', () => {
    expect(isTournamentRelated({ level: 3 })).toBe(true);
  });

  it('returns true for an object with a "player" key', () => {
    expect(isTournamentRelated({ player: 'Hero' })).toBe(true);
  });

  it('returns true for an object with a "prize" key', () => {
    expect(isTournamentRelated({ prize: 500 })).toBe(true);
  });

  it('returns true for an object with a "stack" key', () => {
    expect(isTournamentRelated({ stack: 5000 })).toBe(true);
  });

  it('returns true for an object with a "bounty" key', () => {
    expect(isTournamentRelated({ bounty: 10 })).toBe(true);
  });

  it('returns true for a mixed key object where one key matches', () => {
    expect(isTournamentRelated({ status: 'running', players: 100, tournament: 'MTT' })).toBe(true);
  });

  it('returns true for the fixture lobbyMessage parsed object', () => {
    const parsed = JSON.parse('{"tournament":"MTT","status":"running","players":100}');
    expect(isTournamentRelated(parsed)).toBe(true);
  });

  it('returns false for an object with no tournament-related keys', () => {
    expect(isTournamentRelated({ foo: 1, bar: 2 })).toBe(false);
  });

  it('returns false for an empty object', () => {
    expect(isTournamentRelated({})).toBe(false);
  });

  it('returns false for null', () => {
    expect(isTournamentRelated(null)).toBe(false);
  });

  it('returns false for undefined', () => {
    expect(isTournamentRelated(undefined)).toBe(false);
  });

  it('returns false for a string (not an object)', () => {
    expect(isTournamentRelated('tournament')).toBe(false);
  });

  it('returns false for an array (typeof === object but keys are indices)', () => {
    // Arrays are objects — check that numeric index keys don't accidentally match
    const arr = ['tournament', 'blind'];
    // Numeric keys '0', '1' won't contain 'tournament'/'blind' — should be false
    expect(isTournamentRelated(arr)).toBe(false);
  });
});
