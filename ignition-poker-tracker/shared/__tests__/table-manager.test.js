import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TableManager, RECONNECT_GRACE_MS } from '../table-manager.js';

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

      // The close is now REQUIRED to call this a reconnect. It used to be
      // omitted here, which made the test model a lifecycle that does not
      // happen — and made "same URL" alone sufficient to migrate a machine,
      // which is what let a second concurrent table steal the first's.
      tm.handleConnectionClosed('1');

      // Reconnect with new connId
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 7 }), GAME_URL);

      expect(tm.getTableCount()).toBe(1);
      expect(tm.getHSM('2')).toBeDefined();
      expect(tm.getHSM('1')).toBeUndefined();
    });

    it('preserves the in-flight hand when reconnecting mid-hand', () => {
      // Ignition re-sends CO_TABLE_INFO (dealerSeat, tableState, pcard*, bcard)
      // on reconnect, so the live hand can be resynchronised onto the surviving
      // machine. Destroying it and emitting a `reconnectInterrupted` partial —
      // the previous behaviour — discarded the action sequence for the hand
      // actually being played and made the panel treat the blip as a new table.
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 9, account: 9900, btn: 4, bet: 100 }), GAME_URL);
      const before = tm.getHSM('1');
      before.heroSeat = 5;
      before.state = 'PREFLOP';

      // Reconnect mid-hand — the close comes first, as it does on the wire.
      tm.handleConnectionClosed('1');
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);

      const after = tm.getHSM('2');
      expect(after).toBe(before);
      expect(after.heroSeat).toBe(5);
      expect(tm.getTableCount()).toBe(1);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('keeps a stable tableKey across a reconnect', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      const keyBefore = tm.getTableStates()['1'].tableKey;

      tm.handleConnectionClosed('1');
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);

      const keyAfter = tm.getTableStates()['2'].tableKey;
      expect(keyAfter).toBe(keyBefore);
    });

    it('gives genuinely different tables different tableKeys', () => {
      tm.registerConnection('1', GAME_URL + '?table=1');
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 1 }), GAME_URL + '?table=1');
      tm.registerConnection('2', GAME_URL + '?table=2');
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL + '?table=2');

      const states = tm.getTableStates();
      expect(states['1'].tableKey).not.toBe(states['2'].tableKey);
    });

    it('survives a close-then-reopen — the real socket lifecycle', () => {
      // Regression: the reconnect stitch required the old table to still be in
      // `tables`, but handleConnectionClosed had already deleted it, so the
      // stitch was unreachable on every real reconnect. The pre-existing tests
      // hid this by never firing a close event.
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      const before = tm.getHSM('1');
      before.state = 'IDLE';
      before.completedHandCount = 7;

      tm.handleConnectionClosed('1');
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 7 }), GAME_URL);

      const after = tm.getHSM('2');
      expect(after).toBe(before);
      expect(after.completedHandCount).toBe(7);
      expect(tm.getTableCount()).toBe(1);
    });

    it('never reports zero tables during a reconnect blip', () => {
      // This is the founder-visible symptom: an empty table map makes the side
      // panel render "No active table detected" in the middle of a hand.
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      expect(tm.getTableCount()).toBe(1);

      tm.handleConnectionClosed('1');
      expect(tm.getTableCount()).toBe(1);
      expect(tm.getTableStates()['1'].disconnected).toBe(true);

      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      expect(tm.getTableCount()).toBe(1);
      expect(tm.getTableStates()['2'].disconnected).toBe(false);
    });

    // -----------------------------------------------------------------------
    // MULTI-TABLING — the same URL is NOT the same table
    // -----------------------------------------------------------------------
    //
    // The game WS URL carries no table identifier. Measured across the four real
    // captures, one URL is shared by up to FIVE connIds, and no two same-URL
    // connections ever overlap in time (0 overlapping pairs) — which is exactly
    // why this was invisible: the founder was not multi-tabling. Two tables open
    // at once share the URL byte-for-byte.

    it('does NOT steal a LIVE table on the same URL — two tables are two tables', () => {
      // The regression this guards. Without the disconnectedAt check, table 2's
      // first message migrates table 1's machine and the two tables' hands merge
      // into one record stream.
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      const first = tm.getHSM('1');

      // Second table opens while the first is still LIVE — no close event.
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);

      expect(tm.getTableCount()).toBe(2);
      expect(tm.getHSM('1')).toBe(first);        // untouched
      expect(tm.getHSM('2')).not.toBe(first);    // its own machine
      expect(tm.getHSM('1').dealerSeat).toBe(5); // not clobbered by table 2
      expect(tm.getHSM('2').dealerSeat).toBe(3);
    });

    it('still stitches when the old socket DID close — a reconnect is preceded by a close', () => {
      // The discriminator: same URL + old socket closed = reconnect.
      //                    same URL + old socket live   = concurrent table.
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      const first = tm.getHSM('1');

      tm.handleConnectionClosed('1');
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);

      expect(tm.getTableCount()).toBe(1);
      expect(tm.getHSM('2')).toBe(first);
    });

    it('keeps two concurrent tables separate through a reconnect of one of them', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);
      const t1 = tm.getHSM('1');
      const t2 = tm.getHSM('2');
      expect(tm.getTableCount()).toBe(2);

      // Table 2's socket cycles. Table 1 must be untouched, and the reconnect
      // must land on table 2 — the most recent owner of that URL.
      tm.handleConnectionClosed('2');
      tm.registerConnection('3', GAME_URL);
      tm.routeMessage('3', wire('CO_DEALER_SEAT', { seat: 3 }), GAME_URL);

      expect(tm.getHSM('1')).toBe(t1);
      expect(tm.getHSM('1').dealerSeat).toBe(5);
      expect(tm.getHSM('3')).toBe(t2);
      expect(tm.getTableCount()).toBe(2);
    });
  });

  // =========================================================================
  // CONNECTION CLOSED
  // =========================================================================

  describe('handleConnectionClosed + reapDisconnected', () => {
    // A close is not proof the table is gone — Ignition cycles the game socket
    // routinely. The table enters a grace window; only when it expires without
    // a reconnect is the table closed out. Nothing is lost either way: the
    // partial that used to be emitted inline is emitted at reap time.

    it('holds an IDLE table through the grace window, then removes it', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.state = 'IDLE';

      const t0 = 1_000_000;
      tm.handleConnectionClosed('1', t0);
      expect(tm.getTableCount()).toBe(1);

      // Still inside the window — no reap.
      expect(tm.reapDisconnected(RECONNECT_GRACE_MS, t0 + RECONNECT_GRACE_MS - 1)).toBe(0);
      expect(tm.getTableCount()).toBe(1);

      // Window expired.
      expect(tm.reapDisconnected(RECONNECT_GRACE_MS, t0 + RECONNECT_GRACE_MS)).toBe(1);
      expect(tm.getTableCount()).toBe(0);
    });

    it('emits the partial record when a mid-hand close is never reconnected', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 9, account: 9900, btn: 4, bet: 100 }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.heroSeat = 5;
      hsm.state = 'PREFLOP';

      const t0 = 1_000_000;
      tm.handleConnectionClosed('1', t0);
      // Nothing emitted yet — the socket may still come back.
      expect(onComplete).not.toHaveBeenCalled();

      tm.reapDisconnected(RECONNECT_GRACE_MS, t0 + RECONNECT_GRACE_MS);

      expect(tm.getTableCount()).toBe(0);
      const partialCalls = onComplete.mock.calls.filter(
        c => c[0]?.ignitionMeta?.partial === true
      );
      expect(partialCalls.length).toBe(1);
      expect(partialCalls[0][0].ignitionMeta.reconnectInterrupted).toBe(true);
    });

    it('does NOT emit a partial when the socket reconnects inside the window', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 9, account: 9900, btn: 4, bet: 100 }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.heroSeat = 5;
      hsm.state = 'PREFLOP';

      tm.handleConnectionClosed('1');
      tm.registerConnection('2', GAME_URL);
      tm.routeMessage('2', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);

      expect(onComplete).not.toHaveBeenCalled();
      expect(tm.getHSM('2')).toBe(hsm);
    });

    it('reaps cleanly when buildRecord fails', () => {
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.state = 'PREFLOP';
      // heroSeat is null — buildRecord will return null

      const t0 = 1_000_000;
      tm.handleConnectionClosed('1', t0);
      tm.reapDisconnected(RECONNECT_GRACE_MS, t0 + RECONNECT_GRACE_MS);

      expect(tm.getTableCount()).toBe(0);
      expect(onComplete).not.toHaveBeenCalled();
    });

    it('flushDisconnected closes out immediately for teardown', () => {
      // On page unload there will be no reconnect, and an un-emitted partial
      // would die with the page.
      tm.registerConnection('1', GAME_URL);
      tm.routeMessage('1', wire('PLAY_STAGE_INFO', { stageNo: '100' }), GAME_URL);
      tm.routeMessage('1', wire('CO_DEALER_SEAT', { seat: 5 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 8, account: 9950, btn: 2, bet: 50 }), GAME_URL);
      tm.routeMessage('1', wire('CO_BLIND_INFO', { seat: 9, account: 9900, btn: 4, bet: 100 }), GAME_URL);
      const hsm = tm.getHSM('1');
      hsm.heroSeat = 5;
      hsm.state = 'PREFLOP';

      tm.handleConnectionClosed('1');
      expect(tm.flushDisconnected()).toBe(1);

      const partialCalls = onComplete.mock.calls.filter(
        c => c[0]?.ignitionMeta?.partial === true
      );
      expect(partialCalls.length).toBe(1);
      expect(tm.getTableCount()).toBe(0);
    });

    it('closing an unknown connection is a no-op', () => {
      expect(() => tm.handleConnectionClosed('999')).not.toThrow();
      expect(tm.getTableCount()).toBe(0);
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
      const t0 = 1_000_000;
      tm.handleConnectionClosed('2', t0);

      // Table 2 is in its reconnect grace window, not gone.
      expect(tm.getTableCount()).toBe(4);
      expect(tm.getTableStates()['2'].disconnected).toBe(true);
      expect(tm.getTableStates()['1'].disconnected).toBe(false);

      // Grace expires with no reconnect — only table 2 is reaped.
      tm.reapDisconnected(RECONNECT_GRACE_MS, t0 + RECONNECT_GRACE_MS);

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
