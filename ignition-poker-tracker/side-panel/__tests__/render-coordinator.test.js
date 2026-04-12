/**
 * render-coordinator.test.js — Integration tests for the unified render scheduler.
 *
 * Tests the RenderCoordinator class in isolation using fake timers and
 * injected dependencies. Covers: coalescing, priority bypass, snapshot
 * atomicity, stale advice rejection (RT-45), renderKey accuracy (RT-44),
 * message burst simulation, and visual continuity (RT-48).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderCoordinator, PRIORITY } from '../render-coordinator.js';

// =========================================================================
// HELPERS
// =========================================================================

/** Create a coordinator with fake timers and a render spy. */
function createCoordinator(opts = {}) {
  const renders = [];
  const coord = new RenderCoordinator({
    renderFn: (snap, reason) => renders.push({ snap: { ...snap }, reason, at: Date.now() }),
    getTimestamp: () => Date.now(),
    requestFrame: (cb) => setTimeout(cb, 0), // fake rAF via setTimeout(0)
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  }, { coalesceMs: opts.coalesceMs ?? 80 });
  return { coord, renders };
}

/** Build a minimal live context for testing. */
function liveCtx(overrides = {}) {
  return {
    state: 'FLOP',
    currentStreet: 'flop',
    heroSeat: 1,
    pot: 20,
    foldedSeats: [],
    actionSequence: [],
    activeSeatNumbers: [1, 3, 5],
    ...overrides,
  };
}

/** Build a minimal advice object for testing. */
function advice(overrides = {}) {
  return {
    currentStreet: 'flop',
    villainSeat: 3,
    recommendations: [{ action: 'bet', ev: 5.2 }],
    ...overrides,
  };
}

// =========================================================================
// TESTS
// =========================================================================

describe('RenderCoordinator', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  // =====================================================================
  // BASIC SCHEDULING
  // =====================================================================

  describe('coalescing', () => {
    it('coalesces 3 rapid NORMAL renders into 1', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('exploits', PRIORITY.NORMAL);
      coord.scheduleRender('live_context', PRIORITY.NORMAL);
      coord.scheduleRender('pipeline_diag', PRIORITY.NORMAL);

      // Before coalesce window expires — no renders yet
      vi.advanceTimersByTime(50);
      expect(renders).toHaveLength(0);

      // After coalesce window + rAF
      vi.advanceTimersByTime(50); // 80ms coalesce fires, queues rAF
      vi.advanceTimersByTime(1);  // rAF fires
      expect(renders).toHaveLength(1);
      expect(renders[0].reason).toBe('pipeline_diag'); // last reason wins
    });

    it('IMMEDIATE priority bypasses coalesce timer', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('exploits', PRIORITY.NORMAL);

      // Immediate bypasses
      coord.scheduleRender('advice', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1); // rAF fires immediately
      expect(renders).toHaveLength(1);
      expect(renders[0].reason).toBe('advice');
    });

    it('skips render when renderKey is unchanged', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Same state, schedule again
      coord.scheduleRender('second', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      // Skipped — renderKey unchanged
      expect(renders).toHaveLength(1);
    });

    it('renders when state changes between schedules', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Change state
      coord.set('currentLiveContext', liveCtx({ pot: 50 }));
      coord.scheduleRender('second', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
      expect(renders[1].snap.currentLiveContext.pot).toBe(50);
    });
  });

  // =====================================================================
  // SNAPSHOT ATOMICITY
  // =====================================================================

  describe('snapshot atomicity', () => {
    it('snapshot reflects state at render time, not schedule time', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ pot: 10 }));
      coord.scheduleRender('test', PRIORITY.NORMAL);

      // Mutate state during coalesce window
      coord.set('currentLiveContext', liveCtx({ pot: 99 }));

      vi.advanceTimersByTime(100);
      expect(renders).toHaveLength(1);
      // Snapshot taken at render time (after coalesce), not at schedule time
      expect(renders[0].snap.currentLiveContext.pot).toBe(99);
    });

    it('focusedVillainSeat is computed in snapshot (not stale)', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ pfAggressor: 5 }));
      coord.set('lastGoodAdvice', advice({ villainSeat: 3 }));

      coord.scheduleRender('test', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      // focusedVillain should be advice.villainSeat (3), not pfAggressor (5)
      // because advice villain has higher priority than pfAggressor
      expect(renders[0].snap.focusedVillainSeat).toBe(3);

      // Now clear advice — villain should fall to pfAggressor
      coord.set('lastGoodAdvice', null);
      coord.resetRenderKey();
      coord.scheduleRender('test2', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders[1].snap.focusedVillainSeat).toBe(5);
    });
  });

  // =====================================================================
  // RT-44: RENDER KEY FIX
  // =====================================================================

  describe('RT-44: renderKey detects exploit/appSeatData changes', () => {
    it('different exploitPushCount triggers re-render', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.set('lastGoodExploits', { seats: [], appConnected: true });
      coord.set('exploitPushCount', 1);

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Increment exploit push count (new exploit data arrived)
      coord.set('exploitPushCount', 2);
      coord.scheduleRender('exploits', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
    });

    it('different appSeatDataVersion triggers re-render', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.set('appSeatDataVersion', 1);

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      coord.set('appSeatDataVersion', 2);
      coord.scheduleRender('exploits', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
    });

    it('pinned villain change detected in renderKey', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('first', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      coord.set('pinnedVillainSeat', 5);
      coord.scheduleRender('pin', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
      expect(renders[1].snap.pinnedVillainSeat).toBe(5);
    });
  });

  // =====================================================================
  // RT-45: STALE ADVICE GUARD
  // =====================================================================

  describe('RT-45: stale advice rejection when liveContext is null', () => {
    it('holds advice when currentLiveContext is null', () => {
      const { coord } = createCoordinator();
      // No live context (e.g., after SW restart)
      coord.set('currentLiveContext', null);

      const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(accepted).toBe(false);
      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.getPendingAdvice()).not.toBeNull();
    });

    it('accepts advice when currentLiveContext is present', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ currentStreet: 'flop' }));

      const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(accepted).toBe(true);
      expect(coord.get('lastGoodAdvice')).not.toBeNull();
      expect(coord.getPendingAdvice()).toBeNull();
    });

    it('promotes pending advice when live context arrives', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', null);

      // Advice arrives first (held)
      coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(coord.get('lastGoodAdvice')).toBeNull();

      // Live context arrives — promotes pending advice
      coord.handleLiveContext(liveCtx({ state: 'FLOP', currentStreet: 'flop' }));
      expect(coord.get('lastGoodAdvice')).not.toBeNull();
      expect(coord.get('lastGoodAdvice').currentStreet).toBe('flop');
      expect(coord.getPendingAdvice()).toBeNull();
    });

    it('rejects held advice from earlier street than live context', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', null);

      // Stale preflop advice held
      coord.handleAdvice(advice({ currentStreet: 'preflop' }));

      // Live context arrives at turn (later street)
      coord.handleLiveContext(liveCtx({ state: 'TURN', currentStreet: 'turn' }));

      // Stale advice should NOT be promoted (turn > preflop)
      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.getPendingAdvice()).toBeNull(); // cleared regardless
    });

    it('rejects advice from earlier street than live context', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ currentStreet: 'turn' }));

      const accepted = coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(accepted).toBe(false);
      expect(coord.get('lastGoodAdvice')).toBeNull();
    });

    it('clears advicePendingForStreet when fresh advice accepted', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.set('advicePendingForStreet', 'flop');

      coord.handleAdvice(advice({ currentStreet: 'flop' }));
      expect(coord.get('advicePendingForStreet')).toBeNull();
    });
  });

  // =====================================================================
  // LIVE CONTEXT: HAND BOUNDARY
  // =====================================================================

  describe('live context hand boundaries', () => {
    it('clears advice on DEALING state transition', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'RIVER', currentStreet: 'river' }));
      coord.set('lastGoodAdvice', advice());

      coord.handleLiveContext({ state: 'DEALING', currentStreet: 'preflop', heroSeat: 1 });

      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.get('advicePendingForStreet')).toBe('DEALING');
    });

    it('clears advice on PREFLOP state transition', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'COMPLETE' }));
      coord.set('lastGoodAdvice', advice());

      coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop', heroSeat: 1 });

      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.get('advicePendingForStreet')).toBe('PREFLOP');
    });

    it('does not clear advice on same-state update', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'FLOP' }));
      coord.set('lastGoodAdvice', advice());

      coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop', heroSeat: 1, pot: 30 });

      expect(coord.get('lastGoodAdvice')).not.toBeNull();
    });

    it('clears pending advice on new hand boundary', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', null);

      // Hold stale advice
      coord.handleAdvice(advice({ currentStreet: 'river' }));
      expect(coord.getPendingAdvice()).not.toBeNull();

      // New hand starts — clears pending advice (not from this hand)
      coord.handleLiveContext({ state: 'DEALING', currentStreet: 'preflop', heroSeat: 1 });
      expect(coord.getPendingAdvice()).toBeNull();
      expect(coord.get('lastGoodAdvice')).toBeNull();
    });
  });

  // =====================================================================
  // TABLE SWITCH
  // =====================================================================

  describe('table switch', () => {
    it('clears all per-table state', () => {
      const { coord } = createCoordinator();
      coord.set('pinnedVillainSeat', 5);
      coord.set('lastGoodAdvice', advice());
      coord.set('lastGoodTournament', { heroMRatio: 10 });
      coord.set('currentLiveContext', liveCtx());
      coord.set('userCollapsedSections', new Set(['range', 'model']));

      coord.clearForTableSwitch();

      expect(coord.get('pinnedVillainSeat')).toBeNull();
      expect(coord.get('lastGoodAdvice')).toBeNull();
      expect(coord.get('lastGoodTournament')).toBeNull();
      expect(coord.get('currentLiveContext')).toBeNull();
      expect(coord.get('userCollapsedSections').size).toBe(0);
      expect(coord.getPendingAdvice()).toBeNull();
      expect(coord.getLastStreetCardHtml()).toBeNull();
    });
  });

  // =====================================================================
  // MESSAGE BURST SIMULATION
  // =====================================================================

  describe('message burst simulation', () => {
    it('50 identical live context pushes produce 1 render', () => {
      const { coord, renders } = createCoordinator();
      const ctx = liveCtx({ pot: 20 });

      for (let i = 0; i < 50; i++) {
        coord.handleLiveContext(ctx);
        coord.scheduleRender('live_context');
      }

      vi.advanceTimersByTime(200);
      // One render (coalesced) — renderKey same after first, so only 1 executes
      expect(renders).toHaveLength(1);
    });

    it('SW restart sequence: pipeline(null) + exploits + stale advice + live context', () => {
      const { coord, renders } = createCoordinator();

      // Step 1: push_pipeline_status with null liveContext (SW restart)
      coord.set('lastPipeline', { tables: {}, appConnected: true });
      coord.set('currentLiveContext', null);
      coord.scheduleRender('pipeline_status');

      // Step 2: push_exploits arrives
      coord.set('lastGoodExploits', { seats: [{ seat: 3 }], appConnected: true });
      coord.set('exploitPushCount', 1);
      coord.set('appSeatData', { 3: { style: 'LAG' } });
      coord.set('appSeatDataVersion', 1);
      coord.scheduleRender('exploits');

      // Step 3: push_action_advice with stale data (liveContext still null)
      const staleAccepted = coord.handleAdvice(advice({ currentStreet: 'preflop' }));
      expect(staleAccepted).toBe(false); // HELD, not accepted
      if (!staleAccepted) coord.scheduleRender('advice');

      // Coalesce fires — render WITHOUT stale advice
      vi.advanceTimersByTime(100);
      expect(renders).toHaveLength(1);
      expect(renders[0].snap.lastGoodAdvice).toBeNull(); // No stale advice shown

      // Step 4: push_live_context arrives (real data from capture script)
      coord.handleLiveContext(liveCtx({ state: 'PREFLOP', currentStreet: 'preflop' }));
      coord.scheduleRender('live_context', PRIORITY.IMMEDIATE);

      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(2);
      // Pending advice was promoted (preflop matches preflop)
      expect(renders[1].snap.lastGoodAdvice).not.toBeNull();
    });

    it('hand start sequence: live_context(DEALING) + exploits + advice(immediate)', () => {
      const { coord, renders } = createCoordinator();
      // Start from previous hand state
      coord.set('currentLiveContext', liveCtx({ state: 'COMPLETE' }));
      coord.set('lastGoodAdvice', advice({ currentStreet: 'river' }));
      coord.set('lastHandCount', 5);

      // DEALING arrives — clears old advice
      coord.handleLiveContext({ state: 'DEALING', currentStreet: 'preflop', heroSeat: 1 });
      coord.scheduleRender('live_context');

      // Exploits arrive during coalesce window
      coord.set('exploitPushCount', 2);
      coord.set('appSeatDataVersion', 2);
      coord.scheduleRender('exploits');

      // Advice arrives with IMMEDIATE priority
      coord.set('currentLiveContext', liveCtx({ state: 'PREFLOP', currentStreet: 'preflop' }));
      coord.handleAdvice(advice({ currentStreet: 'preflop' }));
      coord.scheduleRender('advice', PRIORITY.IMMEDIATE);

      vi.advanceTimersByTime(1); // rAF fires
      // Should have 1 render (IMMEDIATE cancelled the coalesce timer)
      expect(renders).toHaveLength(1);
      expect(renders[0].snap.lastGoodAdvice).not.toBeNull();
      expect(renders[0].snap.lastGoodAdvice.currentStreet).toBe('preflop');
      // Advice pending cleared
      expect(renders[0].snap.advicePendingForStreet).toBeNull();
    });

    it('staleness timer during active play with unchanged state produces no render', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      // Initial render
      coord.scheduleRender('init', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);
      expect(renders).toHaveLength(1);

      // Staleness timer fires (nothing changed)
      coord.scheduleRender('stale_timeout');
      vi.advanceTimersByTime(100);
      // No new render — renderKey unchanged
      expect(renders).toHaveLength(1);
    });
  });

  // =====================================================================
  // RT-48: VISUAL CONTINUITY
  // =====================================================================

  describe('RT-48: visual continuity', () => {
    it('snapshot includes lastStreetCardHtml for hold-previous logic', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.setLastStreetCardHtml('<div>previous advice content</div>');
      coord.set('advicePendingForStreet', 'flop');

      coord.scheduleRender('test', PRIORITY.IMMEDIATE);
      vi.advanceTimersByTime(1);

      expect(renders[0].snap.lastStreetCardHtml).toBe('<div>previous advice content</div>');
      expect(renders[0].snap.advicePendingForStreet).toBe('flop');
    });
  });

  // =====================================================================
  // FLUSH (test utility)
  // =====================================================================

  describe('flush', () => {
    it('force-executes pending render immediately', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('test', PRIORITY.NORMAL);
      // No timers advanced — force flush
      coord.flush();
      expect(renders).toHaveLength(1);
    });

    it('no-op when nothing is pending', () => {
      const { coord, renders } = createCoordinator();
      coord.flush();
      expect(renders).toHaveLength(0);
    });
  });

  // =====================================================================
  // DESTROY
  // =====================================================================

  describe('destroy', () => {
    it('cancels pending timers', () => {
      const { coord, renders } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());

      coord.scheduleRender('test', PRIORITY.NORMAL);
      coord.destroy();
      vi.advanceTimersByTime(200);
      expect(renders).toHaveLength(0);
    });
  });

  // =========================================================================
  // Fix 6c: Pipeline event log
  // =========================================================================

  describe('logPipelineEvent', () => {
    it('records events up to cap of 50', () => {
      const { coord } = createCoordinator();
      for (let i = 0; i < 55; i++) coord.logPipelineEvent('test', String(i));
      const events = coord.get('pipelineEvents');
      expect(events.length).toBe(50);
      expect(events[events.length - 1].detail).toBe('54');
    });

    it('pipelineEvents is NOT included in renderKey', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      const key1 = coord.buildRenderKey(coord.buildSnapshot());

      coord.logPipelineEvent('new_hand', 'PREFLOP');
      const key2 = coord.buildRenderKey(coord.buildSnapshot());
      expect(key1).toBe(key2);
    });

    it('logs hand boundary transitions from handleLiveContext', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx({ state: 'FLOP', currentStreet: 'flop' }));
      coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop' });
      const events = coord.get('pipelineEvents');
      expect(events.length).toBe(1);
      expect(events[0].event).toBe('new_hand');
    });

    it('logs advice acceptance from handleAdvice', () => {
      const { coord } = createCoordinator();
      coord.set('currentLiveContext', liveCtx());
      coord.handleAdvice(advice());
      const events = coord.get('pipelineEvents');
      expect(events.length).toBe(1);
      expect(events[0].event).toBe('advice_accepted');
      expect(events[0].detail).toBe('flop');
    });
  });
});

// =========================================================================
// TIMER REGISTRATION CONTRACT (RT-60)
// =========================================================================

describe('RT-60: timer registration contract', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  function makeTimedCoord() {
    const renders = [];
    const coord = new RenderCoordinator({
      renderFn: (snap, reason) => renders.push({ reason }),
      getTimestamp: () => Date.now(),
      requestFrame: (cb) => setTimeout(cb, 0),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (id) => clearTimeout(id),
      clearInterval: (id) => clearInterval(id),
    });
    return { coord, renders };
  }

  it('registerTimer replaces the prior handle under the same key', () => {
    const { coord } = makeTimedCoord();
    const callback1 = vi.fn();
    const callback2 = vi.fn();
    coord.registerTimer('k', setTimeout(callback1, 100), 'timeout');
    coord.registerTimer('k', setTimeout(callback2, 100), 'timeout');
    vi.advanceTimersByTime(200);
    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('clearTimer cancels a specific key', () => {
    const { coord } = makeTimedCoord();
    const callback = vi.fn();
    coord.registerTimer('x', setTimeout(callback, 100), 'timeout');
    coord.clearTimer('x');
    vi.advanceTimersByTime(200);
    expect(callback).not.toHaveBeenCalled();
  });

  it('clearAllTimers cancels every registered timer across kinds', () => {
    const { coord } = makeTimedCoord();
    const timeoutCb = vi.fn();
    const intervalCb = vi.fn();
    coord.registerTimer('t1', setTimeout(timeoutCb, 50), 'timeout');
    coord.registerTimer('i1', setInterval(intervalCb, 50), 'interval');
    coord.clearAllTimers();
    vi.advanceTimersByTime(500);
    expect(timeoutCb).not.toHaveBeenCalled();
    expect(intervalCb).not.toHaveBeenCalled();
  });

  it('clearForTableSwitch cancels registered timers (prevents orphan-fire)', () => {
    const { coord } = makeTimedCoord();
    const callback = vi.fn();
    coord.registerTimer('planPanelAutoExpand', setTimeout(callback, 8000), 'timeout');
    coord.clearForTableSwitch();
    vi.advanceTimersByTime(10_000);
    expect(callback).not.toHaveBeenCalled();
  });

  it('destroy cancels every registered timer', () => {
    const { coord } = makeTimedCoord();
    const a = vi.fn();
    const b = vi.fn();
    coord.registerTimer('a', setTimeout(a, 100), 'timeout');
    coord.registerTimer('b', setInterval(b, 100), 'interval');
    coord.destroy();
    vi.advanceTimersByTime(500);
    expect(a).not.toHaveBeenCalled();
    expect(b).not.toHaveBeenCalled();
  });

  it('onTableSwitch hooks fire on clearForTableSwitch', () => {
    const { coord } = makeTimedCoord();
    const hook = vi.fn();
    coord.onTableSwitch(hook);
    coord.clearForTableSwitch();
    expect(hook).toHaveBeenCalledTimes(1);
  });

  it('a bad onTableSwitch hook does not break lifecycle', () => {
    const { coord } = makeTimedCoord();
    const goodHook = vi.fn();
    coord.onTableSwitch(() => { throw new Error('boom'); });
    coord.onTableSwitch(goodHook);
    expect(() => coord.clearForTableSwitch()).not.toThrow();
    expect(goodHook).toHaveBeenCalledTimes(1);
  });
});

// =========================================================================
// RENDERKEY CONTENT COMPLETENESS (RT-43 / RT-44 / RT-54)
//
// Regression coverage for "sidebar shows wrong info for hand state": when
// fields the UI displays are absent from the fingerprint, renderAll skips
// the render and the DOM holds stale data. Each test changes one specific
// state field and asserts the key flips.
// =========================================================================

describe('buildRenderKey: state-drift invalidation coverage', () => {
  function emptySnap(overrides = {}) {
    return {
      currentLiveContext: null,
      lastGoodAdvice: null,
      lastGoodTournament: null,
      focusedVillainSeat: null,
      pinnedVillainSeat: null,
      lastHandCount: 0,
      exploitPushCount: 0,
      advicePushCount: 0,
      advicePendingForStreet: null,
      appSeatDataVersion: 0,
      cachedDiag: null,
      recoveryMessage: null,
      connState: { connected: true },
      staleContext: false,
      hasTableHands: false,
      ...overrides,
    };
  }

  const { coord } = createCoordinator();

  it('tournament blinds/M changes invalidate the key', () => {
    const base = emptySnap({
      lastGoodTournament: { heroMRatio: 12.0, currentLevelIndex: 3, levelEndTime: 100 },
    });
    const changed = emptySnap({
      lastGoodTournament: { heroMRatio: 6.5, currentLevelIndex: 4, levelEndTime: 100 },
    });
    expect(coord.buildRenderKey(base)).not.toBe(coord.buildRenderKey(changed));
  });

  it('tournament player count changes (bust) invalidate the key', () => {
    const a = emptySnap({ lastGoodTournament: { playersRemaining: 127 } });
    const b = emptySnap({ lastGoodTournament: { playersRemaining: 126 } });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('tournament ICM zone change (approaching bubble) invalidates the key', () => {
    const a = emptySnap({ lastGoodTournament: { icmPressure: { zone: 'standard' } } });
    const b = emptySnap({ lastGoodTournament: { icmPressure: { zone: 'bubble' } } });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('last-action amount change invalidates the key (raise-to-different-size)', () => {
    const base = emptySnap({
      currentLiveContext: {
        actionSequence: [{ seat: 3, action: 'raise', amount: 6 }],
      },
    });
    const resized = emptySnap({
      currentLiveContext: {
        actionSequence: [{ seat: 3, action: 'raise', amount: 20 }],
      },
    });
    expect(coord.buildRenderKey(base)).not.toBe(coord.buildRenderKey(resized));
  });

  it('advice sizing change invalidates the key (same action, different bet fraction)', () => {
    const a = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'bet', sizing: { betFraction: 0.5 } }] },
    });
    const b = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'bet', sizing: { betFraction: 0.75 } }] },
    });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('advice villainSeat change invalidates the key (pinned-villain override)', () => {
    const a = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'call' }], villainSeat: 3 },
    });
    const b = emptySnap({
      lastGoodAdvice: { recommendations: [{ action: 'call' }], villainSeat: 5 },
    });
    expect(coord.buildRenderKey(a)).not.toBe(coord.buildRenderKey(b));
  });

  it('identical snapshots produce identical keys (skip redundant renders)', () => {
    const a = emptySnap({
      lastGoodTournament: { heroMRatio: 12.0, currentLevelIndex: 3 },
      currentLiveContext: { actionSequence: [{ seat: 3, action: 'bet', amount: 10 }] },
    });
    // Manually mirror instead of re-using object so shallow copies can't mask bugs.
    const b = emptySnap({
      lastGoodTournament: { heroMRatio: 12.0, currentLevelIndex: 3 },
      currentLiveContext: { actionSequence: [{ seat: 3, action: 'bet', amount: 10 }] },
    });
    expect(coord.buildRenderKey(a)).toBe(coord.buildRenderKey(b));
  });
});
