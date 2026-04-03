import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TableManager } from '../table-manager.js';

const GAME_URL = 'wss://pkscb.ignitioncasino.eu/poker-games/rgs';
const LOBBY_URL = 'wss://pkscb.ignitioncasino.eu/ws-gateway/lobby';
const NON_GAME_URL = 'wss://lobby.ignitioncasino.eu/lobby';

// Helper: wrap a payload in Ignition wire format
const wire = (pid, payload = {}) => {
  const json = JSON.stringify({ seq: 1, tDiff: 0, data: { pid, ...payload } });
  return `${json.length}|${json}`;
};

const lobbyWire = (obj) => {
  const json = JSON.stringify(obj);
  return `${json.length}|${json}`;
};

describe('TableManager', () => {
  let tm, onComplete, onError;

  beforeEach(() => {
    onComplete = vi.fn();
    onError = vi.fn();
    tm = new TableManager(onComplete, onError);
  });

  // =========================================================================
  // BASIC ROUTING
  // =========================================================================

  describe('routeMessage', () => {
    it('creates an HSM for a new game connection', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      expect(tm.getTableCount()).toBe(1);
      expect(tm.getHSM('1')).toBeDefined();
    });

    it('routes messages to existing HSM', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);
      const hsm = tm.getHSM('1');
      expect(hsm.dealerSeat).toBe(3);
    });

    it('routes game messages on lobby gateway URL', () => {
      tm.registerConnection('1', LOBBY_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), LOBBY_URL);
      expect(tm.getTableCount()).toBe(1);
    });

    it('filters non-game URLs', () => {
      tm.registerConnection('1', NON_GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), NON_GAME_URL);
      expect(tm.getTableCount()).toBe(0);
    });

    it('ignores unparseable messages', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', 'garbage', GAME_URL);
      expect(tm.getTableCount()).toBe(0);
    });

    it('captures lobby/tournament messages to lobbyLog', () => {
      const msg = lobbyWire({ tournament: 'MTT', players: 100 });
      tm.routeMessage('2', msg, LOBBY_URL);
      expect(tm.lobbyLog.length).toBe(1);
      expect(tm.lobbyLog[0].keys).toContain('tournament');
    });

    it('does not route lobby messages to HSM', () => {
      const msg = lobbyWire({ tournament: 'MTT', players: 100 });
      tm.routeMessage('1', msg, GAME_URL);
      expect(tm.getTableCount()).toBe(0);
    });
  });

  // =========================================================================
  // MULTI-TABLE
  // =========================================================================

  describe('multi-table support', () => {
    it('tracks multiple tables by connId', () => {
      tm.registerConnection('1', GAME_URL + '?table=1');
      tm.registerConnection('2', GAME_URL + '?table=2');
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 1 }), GAME_URL + '?table=1');
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL + '?table=2');
      expect(tm.getTableCount()).toBe(2);
      expect(tm.getHSM('1').dealerSeat).toBe(1);
      expect(tm.getHSM('2').dealerSeat).toBe(5);
    });
  });

  // =========================================================================
  // RECONNECTION
  // =========================================================================

  describe('reconnection', () => {
    it('reuses IDLE HSM when same URL reconnects with new connId', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      // Complete hand (reset to IDLE)
      const hsm = tm.getHSM('1');
      hsm.state = 'IDLE';

      // Reconnect with new connId
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 7 }), GAME_URL);

      expect(tm.getTableCount()).toBe(1);
      expect(tm.getHSM('2')).toBeDefined();
      expect(tm.getHSM('1')).toBeUndefined();
    });

    it('saves partial when reconnecting mid-hand', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 9, account: 9900, btn: 4, bet: 100 }), GAME_URL);
      // Set hero so buildRecord succeeds
      const hsm = tm.getHSM('1');
      hsm.heroSeat = 5;
      hsm.state = 'PREFLOP';

      // Reconnect mid-hand
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);

      // Should have called onComplete with partial
      const partialCalls = onComplete.mock.calls.filter(
        c => c[0]?.ignitionMeta?.partial === true
      );
      expect(partialCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // CONNECTION CLOSED
  // =========================================================================

  describe('handleConnectionClosed', () => {
    it('removes IDLE table on close', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.state = 'IDLE';

      tm.handleConnectionClosed('1');
      expect(tm.getTableCount()).toBe(0);
    });

    it('emits partial record and removes table when closed mid-hand', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 9, account: 9900, btn: 4, bet: 100 }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.heroSeat = 5;
      hsm.state = 'PREFLOP';

      tm.handleConnectionClosed('1');

      // Table should be removed (no orphan)
      expect(tm.getTableCount()).toBe(0);

      // Partial record should have been emitted
      const partialCalls = onComplete.mock.calls.filter(
        c => c[0]?.ignitionMeta?.partial === true
      );
      expect(partialCalls.length).toBe(1);
      expect(partialCalls[0][0].ignitionMeta.reconnectInterrupted).toBe(true);
    });

    it('handles mid-hand close when buildRecord fails gracefully', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.state = 'PREFLOP';
      // heroSeat is null — buildRecord will return null

      tm.handleConnectionClosed('1');

      // Table should still be cleaned up even if partial emission fails
      expect(tm.getTableCount()).toBe(0);
      // onComplete should not have been called (no valid record)
      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // PRUNE STALE
  // =========================================================================

  describe('pruneStale', () => {
    it('removes tables idle beyond threshold', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.state = 'IDLE';
      hsm.lastMessageTimestamp = Date.now() - 999999;

      const pruned = tm.pruneStale(1000);
      expect(pruned).toBe(1);
      expect(tm.getTableCount()).toBe(0);
    });

    it('does not prune active tables', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.state = 'PREFLOP';
      hsm.lastMessageTimestamp = Date.now() - 999999;

      const pruned = tm.pruneStale(1000);
      expect(pruned).toBe(0);
    });
  });

  // =========================================================================
  // MULTI-TABLE STRESS
  // =========================================================================

  describe('multi-table stress', () => {
    it('handles 4 concurrent tables with interleaved messages', () => {
      const urls = [1, 2, 3, 4].map(i => GAME_URL + `?table=${i}`);

      // Register all 4 tables
      urls.forEach((url, i) => {
        tm.registerConnection(String(i + 1), url);
        tm.routeMessage(String(i + 1), wire('PLAY_STAGE_INFO', { stageNo: `${100 + i}` }), url);
        tm.routeMessage(String(i + 1), wire('CO_DEALER_SEAT', { seat: i + 1 }), url);
      });

      expect(tm.getTableCount()).toBe(4);

      // Interleaved messages across tables
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), urls[0]);
      tm.routeMessage('3', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), urls[2]);
      tm.routeMessage('2', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), urls[1]);
      tm.routeMessage('4', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), urls[3]);

      // Each table should have its own dealer seat
      expect(tm.getHSM('1').dealerSeat).toBe(1);
      expect(tm.getHSM('2').dealerSeat).toBe(2);
      expect(tm.getHSM('3').dealerSeat).toBe(3);
      expect(tm.getHSM('4').dealerSeat).toBe(4);

      // Close one mid-hand — should not affect others
      const hsm2 = tm.getHSM('2');
      hsm2.heroSeat = 5;
      hsm2.state = 'PREFLOP';
      tm.handleConnectionClosed('2');

      expect(tm.getTableCount()).toBe(3);
      expect(tm.getHSM('2')).toBeUndefined();
      expect(tm.getHSM('1')).toBeDefined();
      expect(tm.getHSM('3')).toBeDefined();
      expect(tm.getHSM('4')).toBeDefined();
    });
  });

  // =========================================================================
  // ACCESSORS
  // =========================================================================

  describe('accessors', () => {
    it('getTableStates returns state for each table', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      const states = tm.getTableStates();
      expect(states['1']).toBeDefined();
      expect(states['1'].dealerSeat).toBe(5);
    });

    it('getCompletedHandCount tracks total', () => {
      expect(tm.getCompletedHandCount()).toBe(0);
    });

    it('getDiagnosticData returns structured data', () => {
      const diag = tm.getDiagnosticData();
      expect(diag).toHaveProperty('eventLogs');
      expect(diag).toHaveProperty('lobbyMessages');
      expect(diag).toHaveProperty('tableConfigs');
      expect(diag).toHaveProperty('pidCounts');
      expect(diag).toHaveProperty('batchedFrameCount');
      expect(diag).toHaveProperty('totalParsedMessages');
    });
  });

  // =========================================================================
  // ATMOSPHERE BATCHED FRAMES
  // =========================================================================

  describe('batched frame routing', () => {
    it('routes all messages from a batched frame', () => {
      tm.registerConnection('1', GAME_URL);
      const json1 = JSON.stringify({ seq: 1, tDiff: 0, data: { pid: 'PLAY_STAGE_INFO', stageNo: '100' } });
      const json2 = JSON.stringify({ seq: 2, tDiff: 5, data: { pid: 'CO_DEALER_SEAT', seat: 3 } });
      const json3 = JSON.stringify({ seq: 3, tDiff: 10, data: { pid: 'CO_BLIND_INFO', seat: 8, btn: 2, bet: 50 } });
      const batched = `${json1.length}|${json1}${json2.length}|${json2}${json3.length}|${json3}`;
      tm.routeMessage('1', batched, GAME_URL);
      expect(tm.getTableCount()).toBe(1);
      const hsm = tm.getHSM('1');
      expect(hsm.dealerSeat).toBe(3);
      expect(hsm.blinds.sb).toBe(0.50);
    });

    it('increments batchedFrameCount for multi-message frames', () => {
      tm.registerConnection('1', GAME_URL);
      const json1 = JSON.stringify({ seq: 1, tDiff: 0, data: { pid: 'CO_DEALER_SEAT', seat: 3 } });
      const json2 = JSON.stringify({ seq: 2, tDiff: 5, data: { pid: 'CO_BLIND_INFO', seat: 8, btn: 2, bet: 50 } });
      const batched = `${json1.length}|${json1}${json2.length}|${json2}`;
      tm.routeMessage('1', batched, GAME_URL);
      expect(tm.batchedFrameCount).toBe(1);
      expect(tm.totalParsedMessages).toBe(2);
    });

    it('does not increment batchedFrameCount for single-message frames', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);
      expect(tm.batchedFrameCount).toBe(0);
      expect(tm.totalParsedMessages).toBe(1);
    });

    it('tracks pidCounts across batched and single frames', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);
      const json1 = JSON.stringify({ seq: 2, tDiff: 5, data: { pid: 'CO_BLIND_INFO', seat: 8, btn: 2, bet: 50 } });
      const json2 = JSON.stringify({ seq: 3, tDiff: 10, data: { pid: 'CO_BLIND_INFO', seat: 9, btn: 4, bet: 100 } });
      tm.routeMessage('1', `${json1.length}|${json1}${json2.length}|${json2}`, GAME_URL);
      expect(tm.pidCounts['CO_DEALER_SEAT']).toBe(1);
      expect(tm.pidCounts['CO_BLIND_INFO']).toBe(2);
    });

    it('routes mixed game + lobby in one batch', () => {
      tm.registerConnection('1', GAME_URL);
      const game = JSON.stringify({ seq: 1, tDiff: 0, data: { pid: 'CO_DEALER_SEAT', seat: 5 } });
      const lobby = JSON.stringify({ tournament: 'MTT', status: 'running', players: 100 });
      const batched = `${game.length}|${game}${lobby.length}|${lobby}`;
      tm.routeMessage('1', batched, GAME_URL);
      expect(tm.getTableCount()).toBe(1);
      expect(tm.lobbyLog.length).toBe(1);
    });
  });

});
