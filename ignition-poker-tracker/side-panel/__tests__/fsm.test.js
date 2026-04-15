/**
 * fsm.test.js — unit tests for the 5 SR-6.5 panel FSM declarations +
 * the defineFsm helper itself.
 *
 * No DOM, no coordinator — pure transition coverage. The integration side
 * (dispatch → scheduleRender → DOM sync) lives in coordinator-dispatch.test.js.
 */

import { describe, it, expect } from 'vitest';
import { defineFsm } from '../fsm.js';
import { recoveryBannerFsm } from '../fsms/recovery-banner.fsm.js';
import { seatPopoverFsm } from '../fsms/seat-popover.fsm.js';
import { moreAnalysisFsm } from '../fsms/more-analysis.fsm.js';
import { modelAuditFsm } from '../fsms/model-audit.fsm.js';
import { betweenHandsFsm } from '../fsms/between-hands.fsm.js';
import { streetCardFsm } from '../fsms/street-card.fsm.js';

describe('defineFsm helper', () => {
  it('throws on missing id/initial/states', () => {
    expect(() => defineFsm({})).toThrow();
    expect(() => defineFsm({ id: 'x' })).toThrow();
    expect(() => defineFsm({ id: 'x', initial: 'a', states: {} })).toThrow();
  });

  it('returns { state, changed: false } for unknown event', () => {
    const fsm = defineFsm({
      id: 't',
      initial: 'a',
      states: { a: { on: { go: () => 'b' } }, b: {} },
    });
    const r = fsm.transition('a', 'unknown-event');
    expect(r).toEqual({ state: 'a', changed: false });
  });

  it('returns { state, changed: false } for unknown state', () => {
    const fsm = defineFsm({
      id: 't', initial: 'a',
      states: { a: {} },
    });
    expect(fsm.transition('nonexistent', 'any')).toEqual({ state: 'nonexistent', changed: false });
  });

  it('handler returning null stays in current state', () => {
    const fsm = defineFsm({
      id: 't', initial: 'a',
      states: { a: { on: { maybe: () => null } } },
    });
    expect(fsm.transition('a', 'maybe')).toEqual({ state: 'a', changed: false });
  });

  it('handler returning string transitions to that state', () => {
    const fsm = defineFsm({
      id: 't', initial: 'a',
      states: { a: { on: { go: () => 'b' } }, b: {} },
    });
    expect(fsm.transition('a', 'go')).toEqual({ state: 'b', changed: true });
  });

  it('handler returning object surfaces extra in result', () => {
    const fsm = defineFsm({
      id: 't', initial: 'a',
      states: { a: { on: { go: (p) => ({ state: 'b', meta: p }) } }, b: {} },
    });
    const r = fsm.transition('a', 'go', { n: 42 });
    expect(r.state).toBe('b');
    expect(r.changed).toBe(true);
    expect(r.extra).toEqual({ meta: { n: 42 } });
  });

  it('same-state transition reports changed: false', () => {
    const fsm = defineFsm({
      id: 't', initial: 'a',
      states: { a: { on: { stay: () => 'a' } } },
    });
    expect(fsm.transition('a', 'stay')).toEqual({ state: 'a', changed: false });
  });
});

describe('recoveryBannerFsm', () => {
  it('starts hidden', () => {
    expect(recoveryBannerFsm.initial).toBe('hidden');
  });
  it('connectionLost: hidden → showing', () => {
    expect(recoveryBannerFsm.transition('hidden', 'connectionLost').state).toBe('showing');
  });
  it('contextDead + versionMismatch also show banner', () => {
    expect(recoveryBannerFsm.transition('hidden', 'contextDead').state).toBe('showing');
    expect(recoveryBannerFsm.transition('hidden', 'versionMismatch').state).toBe('showing');
  });
  it('userReload: showing → reloadPending', () => {
    expect(recoveryBannerFsm.transition('showing', 'userReload').state).toBe('reloadPending');
  });
  it('reenableTimerFire: reloadPending → showing', () => {
    expect(recoveryBannerFsm.transition('reloadPending', 'reenableTimerFire').state).toBe('showing');
  });
  it('connectionRestored hides from showing or reloadPending', () => {
    expect(recoveryBannerFsm.transition('showing', 'connectionRestored').state).toBe('hidden');
    expect(recoveryBannerFsm.transition('reloadPending', 'connectionRestored').state).toBe('hidden');
  });
  it('tableSwitch resets to hidden from any state', () => {
    expect(recoveryBannerFsm.transition('showing', 'tableSwitch').state).toBe('hidden');
    expect(recoveryBannerFsm.transition('reloadPending', 'tableSwitch').state).toBe('hidden');
  });
  it('hidden ignores userReload/reenableTimerFire (no-op)', () => {
    expect(recoveryBannerFsm.transition('hidden', 'userReload').changed).toBe(false);
    expect(recoveryBannerFsm.transition('hidden', 'reenableTimerFire').changed).toBe(false);
  });
});

describe('seatPopoverFsm', () => {
  it('starts hidden', () => {
    expect(seatPopoverFsm.initial).toBe('hidden');
  });
  it('seatClick with seat: hidden → shown (with extra seat+coords)', () => {
    const r = seatPopoverFsm.transition('hidden', 'seatClick', { seat: 3, coords: { top: 1 } });
    expect(r.state).toBe('shown');
    expect(r.changed).toBe(true);
    expect(r.extra).toEqual({ seat: 3, coords: { top: 1 } });
  });
  it('seatClick without seat payload is no-op', () => {
    expect(seatPopoverFsm.transition('hidden', 'seatClick', {}).changed).toBe(false);
    expect(seatPopoverFsm.transition('hidden', 'seatClick', null).changed).toBe(false);
  });
  it('re-click while shown updates the extra seat+coords', () => {
    const r = seatPopoverFsm.transition('shown', 'seatClick', { seat: 5 });
    expect(r.state).toBe('shown');
    expect(r.extra).toEqual({ seat: 5, coords: null });
  });
  it('outsideClick / handNew / tableSwitch all hide', () => {
    expect(seatPopoverFsm.transition('shown', 'outsideClick').state).toBe('hidden');
    expect(seatPopoverFsm.transition('shown', 'handNew').state).toBe('hidden');
    expect(seatPopoverFsm.transition('shown', 'tableSwitch').state).toBe('hidden');
  });
});

describe('moreAnalysisFsm (SR-6.14, was deepExpanderFsm)', () => {
  it('starts closed', () => {
    expect(moreAnalysisFsm.initial).toBe('closed');
  });
  it('userToggle toggles closed ↔ open', () => {
    expect(moreAnalysisFsm.transition('closed', 'userToggle').state).toBe('open');
    expect(moreAnalysisFsm.transition('open', 'userToggle').state).toBe('closed');
  });
  it('tableSwitch collapses open', () => {
    expect(moreAnalysisFsm.transition('open', 'tableSwitch').state).toBe('closed');
  });
  it('handNew does NOT change open state (user intent sticky within hand)', () => {
    expect(moreAnalysisFsm.transition('open', 'handNew').changed).toBe(false);
    expect(moreAnalysisFsm.transition('closed', 'handNew').changed).toBe(false);
  });
});

describe('modelAuditFsm (SR-6.14)', () => {
  it('starts closed', () => {
    expect(modelAuditFsm.initial).toBe('closed');
  });
  it('userToggle toggles closed ↔ open', () => {
    expect(modelAuditFsm.transition('closed', 'userToggle').state).toBe('open');
    expect(modelAuditFsm.transition('open', 'userToggle').state).toBe('closed');
  });
  it('tableSwitch collapses open', () => {
    expect(modelAuditFsm.transition('open', 'tableSwitch').state).toBe('closed');
  });
  it('handNew does NOT change open state (user intent sticky within hand)', () => {
    expect(modelAuditFsm.transition('open', 'handNew').changed).toBe(false);
    expect(modelAuditFsm.transition('closed', 'handNew').changed).toBe(false);
  });
  it('has id "modelAudit" (distinct from moreAnalysis)', () => {
    expect(modelAuditFsm.id).toBe('modelAudit');
    expect(moreAnalysisFsm.id).toBe('moreAnalysis');
  });
});

describe('betweenHandsFsm', () => {
  it('starts inactive', () => {
    expect(betweenHandsFsm.initial).toBe('inactive');
  });
  it('liveContextArrived with betweenHandsOrIdle=true: inactive → active', () => {
    expect(betweenHandsFsm.transition('inactive', 'liveContextArrived', { betweenHandsOrIdle: true }).state).toBe('active');
  });
  it('liveContextArrived with betweenHandsOrIdle=false stays inactive', () => {
    expect(betweenHandsFsm.transition('inactive', 'liveContextArrived', { betweenHandsOrIdle: false }).changed).toBe(false);
  });
  it('liveContextArrived with betweenHandsOrIdle=false exits active', () => {
    expect(betweenHandsFsm.transition('active', 'liveContextArrived', { betweenHandsOrIdle: false }).state).toBe('inactive');
  });
  it('modeATimerFire: active → modeAExpired', () => {
    expect(betweenHandsFsm.transition('active', 'modeATimerFire').state).toBe('modeAExpired');
  });
  it('handNew resets active/modeAExpired to inactive', () => {
    expect(betweenHandsFsm.transition('active', 'handNew').state).toBe('inactive');
    expect(betweenHandsFsm.transition('modeAExpired', 'handNew').state).toBe('inactive');
  });
  it('adviceArrived also collapses to inactive', () => {
    expect(betweenHandsFsm.transition('active', 'adviceArrived').state).toBe('inactive');
    expect(betweenHandsFsm.transition('modeAExpired', 'adviceArrived').state).toBe('inactive');
  });
  it('tableSwitch resets from any state', () => {
    expect(betweenHandsFsm.transition('active', 'tableSwitch').state).toBe('inactive');
    expect(betweenHandsFsm.transition('modeAExpired', 'tableSwitch').state).toBe('inactive');
  });
});

describe('streetCardFsm', () => {
  it('starts empty', () => {
    expect(streetCardFsm.initial).toBe('empty');
  });
  it('streetChange or adviceArrive: empty → showing', () => {
    expect(streetCardFsm.transition('empty', 'streetChange').state).toBe('showing');
    expect(streetCardFsm.transition('empty', 'adviceArrive').state).toBe('showing');
  });
  it('streetChange in showing: → fadingOut', () => {
    expect(streetCardFsm.transition('showing', 'streetChange').state).toBe('fadingOut');
  });
  it('fadeTimerFire: fadingOut → fadingIn', () => {
    expect(streetCardFsm.transition('fadingOut', 'fadeTimerFire').state).toBe('fadingIn');
  });
  it('heightReleaseFire: fadingIn → showing', () => {
    expect(streetCardFsm.transition('fadingIn', 'heightReleaseFire').state).toBe('showing');
  });
  it('tableSwitch collapses to empty from any transition state', () => {
    expect(streetCardFsm.transition('showing', 'tableSwitch').state).toBe('empty');
    expect(streetCardFsm.transition('fadingOut', 'tableSwitch').state).toBe('empty');
    expect(streetCardFsm.transition('fadingIn', 'tableSwitch').state).toBe('empty');
  });
  it('mid-fade streetChange restarts the fade cycle', () => {
    expect(streetCardFsm.transition('fadingIn', 'streetChange').state).toBe('fadingOut');
  });
});
