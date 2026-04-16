/**
 * zx-overrides.test.js — SR-6.15 enforcement.
 *
 * A) betweenHands FSM dispatches are wired into handleLiveContextPush and
 *    handleAdvicePush in side-panel.js (source-level pin — the SR-6.5 FSM
 *    was registered but never dispatched; SR-6.15 wires it).
 * B) FSM state transitions as expected through liveContextArrived + adviceArrived.
 * C) X.4c re-enable timer is registered via coordinator.scheduleTimer (verified
 *    in SR-6.3; re-pinned here so a revert would fail the Zx PR gate).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { RenderCoordinator } from '../render-coordinator.js';
import { betweenHandsFsm } from '../fsms/between-hands.fsm.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const JS_PATH = resolve(__dirname, '..', 'side-panel.js');
const js = readFileSync(JS_PATH, 'utf8');

describe('SR-6.15 Zx §X.1 — betweenHands FSM wiring (source-level)', () => {
  it('handleLiveContextPush dispatches liveContextArrived with betweenHandsOrIdle payload', () => {
    expect(js).toMatch(/dispatch\('betweenHands', 'liveContextArrived'/);
    expect(js).toMatch(/betweenHandsOrIdle = state === 'IDLE' \|\| state === 'COMPLETE'/);
  });

  it('handleAdvicePush dispatches adviceArrived on accepted advice', () => {
    expect(js).toMatch(/dispatch\('betweenHands', 'adviceArrived'\)/);
  });

  it('X.4c recovery button re-enable uses coordinator.scheduleTimer (RT-60)', () => {
    expect(js).toMatch(/scheduleTimer\('recoveryBtn_reEnable'/);
  });
});

describe('SR-6.15 Zx §X.1 — betweenHands FSM end-to-end (coordinator)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function createCoordinator() {
    return new RenderCoordinator({
      renderFn: () => {},
      getTimestamp: () => Date.now(),
      requestFrame: (cb) => setTimeout(cb, 0),
      setTimeout: (cb, ms) => setTimeout(cb, ms),
      clearTimeout: (id) => clearTimeout(id),
    });
  }

  it('initial state is inactive (no banner at boot)', () => {
    const coord = createCoordinator();
    coord.registerFsm(betweenHandsFsm);
    expect(coord.getPanelState('betweenHands')).toBe('inactive');
  });

  it('COMPLETE state dispatches active (banner mounts between hands)', () => {
    const coord = createCoordinator();
    coord.registerFsm(betweenHandsFsm);
    coord.dispatch('betweenHands', 'liveContextArrived', { betweenHandsOrIdle: true });
    expect(coord.getPanelState('betweenHands')).toBe('active');
  });

  it('PREFLOP state keeps FSM inactive (no mid-hand banner)', () => {
    const coord = createCoordinator();
    coord.registerFsm(betweenHandsFsm);
    coord.dispatch('betweenHands', 'liveContextArrived', { betweenHandsOrIdle: false });
    expect(coord.getPanelState('betweenHands')).toBe('inactive');
  });

  it('adviceArrived clears the banner immediately (even from active)', () => {
    const coord = createCoordinator();
    coord.registerFsm(betweenHandsFsm);
    coord.dispatch('betweenHands', 'liveContextArrived', { betweenHandsOrIdle: true });
    expect(coord.getPanelState('betweenHands')).toBe('active');
    coord.dispatch('betweenHands', 'adviceArrived');
    expect(coord.getPanelState('betweenHands')).toBe('inactive');
  });

  it('active → inactive on next live context with betweenHandsOrIdle=false', () => {
    const coord = createCoordinator();
    coord.registerFsm(betweenHandsFsm);
    coord.dispatch('betweenHands', 'liveContextArrived', { betweenHandsOrIdle: true });
    coord.dispatch('betweenHands', 'liveContextArrived', { betweenHandsOrIdle: false });
    expect(coord.getPanelState('betweenHands')).toBe('inactive');
  });

  it('tableSwitch cancels active banner', () => {
    const coord = createCoordinator();
    coord.registerFsm(betweenHandsFsm);
    coord.dispatch('betweenHands', 'liveContextArrived', { betweenHandsOrIdle: true });
    coord.clearForTableSwitch();
    expect(coord.getPanelState('betweenHands')).toBe('inactive');
  });
});

// RT-72 — source-level pins that renderBetweenHands reads the FSM as the
// slot authority and does NOT reach across the zone boundary into the
// street-card slot. The old implementation read `snap.modeAExpired` +
// `snap.currentLiveContext.state` (FSM was decorative) and wrote
// `showEl(streetCard)` / `hideEl(streetCard)` (R-5.2 dual-owner with
// streetCardFsm). Both sins must stay gone.
describe('RT-72 — renderBetweenHands FSM authority (source-level)', () => {
  const renderBetweenHandsSrc = (() => {
    const match = js.match(/const renderBetweenHands = \(snap\) => \{[\s\S]*?\n\s{2}\};/);
    if (!match) throw new Error('renderBetweenHands not found in side-panel.js');
    // Strip comments (block + line) so text references inside doc comments
    // don't register as executable reads.
    return match[0]
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  })();

  it('reads snap.panels.betweenHands as the slot-ownership signal', () => {
    expect(renderBetweenHandsSrc).toMatch(/snap\.panels\??\.betweenHands/);
  });

  it('does not call showEl or hideEl on street-card slot', () => {
    expect(renderBetweenHandsSrc).not.toMatch(/showEl\s*\(\s*streetCard/);
    expect(renderBetweenHandsSrc).not.toMatch(/hideEl\s*\(\s*streetCard/);
  });

  it('does not read raw snap.modeAExpired (FSM is the authority)', () => {
    expect(renderBetweenHandsSrc).not.toMatch(/snap\.modeAExpired/);
  });

  it('toggles data-between-hands on #hud-content wrapper instead of mutating sibling zone', () => {
    expect(renderBetweenHandsSrc).toMatch(/data-between-hands/);
  });
});

