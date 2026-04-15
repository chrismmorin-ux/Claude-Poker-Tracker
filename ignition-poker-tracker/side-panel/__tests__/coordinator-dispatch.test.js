/**
 * coordinator-dispatch.test.js — integration of SR-6.5 FSM registry with
 * the RenderCoordinator. Verifies registerFsm, dispatch, panels snapshot,
 * renderKey integration, handNew/tableSwitch fan-out, and seatPopover extra
 * surfacing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderCoordinator, PRIORITY } from '../render-coordinator.js';
import { recoveryBannerFsm } from '../fsms/recovery-banner.fsm.js';
import { seatPopoverFsm } from '../fsms/seat-popover.fsm.js';
import { moreAnalysisFsm } from '../fsms/more-analysis.fsm.js';

function createCoordinator() {
  const renders = [];
  const coord = new RenderCoordinator({
    renderFn: (snap, reason) => renders.push({ snap: { ...snap, panels: { ...snap.panels } }, reason }),
    getTimestamp: () => Date.now(),
    requestFrame: (cb) => setTimeout(cb, 0),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  });
  return { coord, renders };
}

describe('RenderCoordinator FSM registry (SR-6.5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('registerFsm initializes panel state to FSM.initial', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(recoveryBannerFsm);
    expect(coord.getPanelState('recoveryBanner')).toBe('hidden');
    expect(coord.buildSnapshot().panels.recoveryBanner).toBe('hidden');
  });

  it('registerFsm is idempotent', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(moreAnalysisFsm);
    coord.dispatch('moreAnalysis', 'userToggle');
    coord.registerFsm(moreAnalysisFsm); // re-register
    // state preserved — not reset to initial
    expect(coord.getPanelState('moreAnalysis')).toBe('open');
  });

  it('dispatch with unknown fsm id is a no-op', () => {
    const { coord, renders } = createCoordinator();
    const result = coord.dispatch('no-such-fsm', 'anyEvent');
    expect(result).toEqual({ state: null, changed: false });
    vi.advanceTimersByTime(100);
    expect(renders).toHaveLength(0);
  });

  it('dispatch transitions state + schedules IMMEDIATE render', () => {
    const { coord, renders } = createCoordinator();
    coord.registerFsm(recoveryBannerFsm);

    coord.dispatch('recoveryBanner', 'connectionLost');
    expect(coord.getPanelState('recoveryBanner')).toBe('showing');

    vi.advanceTimersByTime(1); // IMMEDIATE fires on next frame
    expect(renders).toHaveLength(1);
    expect(renders[0].reason).toBe('fsm:recoveryBanner:connectionLost');
    expect(renders[0].snap.panels.recoveryBanner).toBe('showing');
  });

  it('same-state dispatch does not schedule a render', () => {
    const { coord, renders } = createCoordinator();
    coord.registerFsm(moreAnalysisFsm);
    // unknown event in initial state → no transition, no render
    coord.dispatch('moreAnalysis', 'connectionLost');
    vi.advanceTimersByTime(100);
    expect(renders).toHaveLength(0);
  });

  it('seatPopover extra (seat + coords) lands in seatPopoverDetail', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(seatPopoverFsm);

    coord.dispatch('seatPopover', 'seatClick', { seat: 5, coords: { bottom: 100, left: 20 } });
    expect(coord.getPanelState('seatPopover')).toBe('shown');
    expect(coord.buildSnapshot().seatPopoverDetail).toEqual({ seat: 5, coords: { bottom: 100, left: 20 } });

    coord.dispatch('seatPopover', 'outsideClick');
    expect(coord.getPanelState('seatPopover')).toBe('hidden');
    expect(coord.buildSnapshot().seatPopoverDetail).toBeNull();
  });

  it('re-click same FSM while already in same state still re-renders via extra change', () => {
    const { coord, renders } = createCoordinator();
    coord.registerFsm(seatPopoverFsm);

    coord.dispatch('seatPopover', 'seatClick', { seat: 3, coords: { bottom: 10, left: 10 } });
    vi.advanceTimersByTime(1);
    const n1 = renders.length;

    // Re-click a different seat: FSM stays in `shown` but extra changes —
    // renderKey includes seatPopoverDetail.seat so renderKey flips.
    coord.resetRenderKey(); // clear cache to allow same-string test
    coord.dispatch('seatPopover', 'seatClick', { seat: 7, coords: { bottom: 20, left: 20 } });
    vi.advanceTimersByTime(1);
    expect(renders.length).toBeGreaterThan(n1);
    expect(coord.buildSnapshot().seatPopoverDetail.seat).toBe(7);
  });

  it('renderKey reflects panel state — transition forces re-render', () => {
    const { coord, renders } = createCoordinator();
    coord.registerFsm(moreAnalysisFsm);
    coord.set('currentLiveContext', { state: 'FLOP', currentStreet: 'flop' });

    coord.scheduleRender('boot', PRIORITY.IMMEDIATE);
    vi.advanceTimersByTime(1);
    const n1 = renders.length;

    coord.dispatch('moreAnalysis', 'userToggle');
    vi.advanceTimersByTime(1);
    expect(renders.length).toBe(n1 + 1);
  });

  it('clearForTableSwitch fans tableSwitch to every FSM', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(recoveryBannerFsm);
    coord.registerFsm(seatPopoverFsm);
    coord.registerFsm(moreAnalysisFsm);

    coord.dispatch('recoveryBanner', 'connectionLost');
    coord.dispatch('seatPopover', 'seatClick', { seat: 4 });
    coord.dispatch('moreAnalysis', 'userToggle');

    coord.clearForTableSwitch();

    expect(coord.getPanelState('recoveryBanner')).toBe('hidden');
    expect(coord.getPanelState('seatPopover')).toBe('hidden');
    expect(coord.getPanelState('moreAnalysis')).toBe('closed');
    expect(coord.buildSnapshot().seatPopoverDetail).toBeNull();
  });

  it('handleLiveContext on new-hand boundary fans handNew to FSMs + hooks', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(seatPopoverFsm);
    coord.dispatch('seatPopover', 'seatClick', { seat: 2 });

    let hookFired = 0;
    coord.onHandNew(() => { hookFired++; });

    // Simulate a new hand
    coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop', handNumber: 42, heroSeat: 1, dealerSeat: 3 });

    expect(coord.getPanelState('seatPopover')).toBe('hidden');
    expect(hookFired).toBe(1);
  });
});
