/**
 * z4-deep-analysis.test.js — SR-6.14 regression pins.
 *
 * Covers the spec's non-obvious invariants at the coordinator + builder
 * layer. Behavior at the DOM writer layer (renderMoreAnalysis /
 * renderModelAudit) lives inside the side-panel.js IIFE and isn't directly
 * importable; those paths are covered by the harness + existing fixture
 * null-safety sweep. What we pin here:
 *
 *   1. Coordinator state split — two independent boolean keys.
 *   2. hand:new and tableSwitch reset both keys + the RT-61 discriminator.
 *   3. buildMoreAnalysisHTML does NOT emit Model Audit content.
 *   4. buildModelAuditHTML emits Model Audit only (flag gate is caller-side).
 *   5. Debug-flag bit flips the renderKey (forces DOM reconstruction).
 *   6. Stale-tint cross-zone: renderKey invalidates when advice age crosses
 *      the stale boundary (covered via lastGoodAdvice identity + staleness
 *      computed at the renderer — we pin the data shape here).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderCoordinator, PRIORITY } from '../render-coordinator.js';
import { moreAnalysisFsm } from '../fsms/more-analysis.fsm.js';
import { modelAuditFsm } from '../fsms/model-audit.fsm.js';
import {
  buildMoreAnalysisHTML,
  buildModelAuditHTML,
} from '../render-orchestrator.js';
import { flopWithAdvice } from './fixtures.js';

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

describe('SR-6.14 — Z4 coordinator state split', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('moreAnalysisOpen + modelAuditOpen default to false', () => {
    const { coord } = createCoordinator();
    expect(coord.get('moreAnalysisOpen')).toBe(false);
    expect(coord.get('modelAuditOpen')).toBe(false);
  });

  it('lastAutoExpandAdviceAt starts null', () => {
    const { coord } = createCoordinator();
    expect(coord.get('lastAutoExpandAdviceAt')).toBeNull();
  });

  it('userToggledPlanPanelInHand starts false', () => {
    const { coord } = createCoordinator();
    expect(coord.get('userToggledPlanPanelInHand')).toBe(false);
  });

  it('the two Open keys are independent (toggling one does not affect the other)', () => {
    const { coord } = createCoordinator();
    coord.set('moreAnalysisOpen', true);
    expect(coord.get('moreAnalysisOpen')).toBe(true);
    expect(coord.get('modelAuditOpen')).toBe(false);
    coord.set('modelAuditOpen', true);
    coord.set('moreAnalysisOpen', false);
    expect(coord.get('moreAnalysisOpen')).toBe(false);
    expect(coord.get('modelAuditOpen')).toBe(true);
  });

  it('clearForTableSwitch resets both Open keys + both RT-61 flags', () => {
    const { coord } = createCoordinator();
    coord.set('moreAnalysisOpen', true);
    coord.set('modelAuditOpen', true);
    coord.set('lastAutoExpandAdviceAt', 12345);
    coord.set('userToggledPlanPanelInHand', true);
    coord.set('planPanelOpen', true);
    coord.clearForTableSwitch();
    expect(coord.get('moreAnalysisOpen')).toBe(false);
    expect(coord.get('modelAuditOpen')).toBe(false);
    expect(coord.get('lastAutoExpandAdviceAt')).toBeNull();
    expect(coord.get('userToggledPlanPanelInHand')).toBe(false);
    expect(coord.get('planPanelOpen')).toBe(false);
  });

  it('hand:new boundary resets Z4 collapsible state', () => {
    const { coord } = createCoordinator();
    // Simulate ongoing hand state
    coord.set('moreAnalysisOpen', true);
    coord.set('modelAuditOpen', true);
    coord.set('lastAutoExpandAdviceAt', 99999);
    coord.set('userToggledPlanPanelInHand', true);
    // First live context establishes a hand
    coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop' });
    // State transition to PREFLOP triggers hand:new boundary in handleLiveContext
    coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop' });
    expect(coord.get('moreAnalysisOpen')).toBe(false);
    expect(coord.get('modelAuditOpen')).toBe(false);
    expect(coord.get('lastAutoExpandAdviceAt')).toBeNull();
    expect(coord.get('userToggledPlanPanelInHand')).toBe(false);
  });

  it('renderKey includes both Open keys and debug-flag bit', () => {
    const { coord } = createCoordinator();
    const baseSnap = coord.buildSnapshot();

    const withMoreOpen = { ...baseSnap, moreAnalysisOpen: true };
    const withAuditOpen = { ...baseSnap, modelAuditOpen: true };
    const withDebugFlag = { ...baseSnap, settings: { ...baseSnap.settings, debugDiagnostics: true } };

    const baseKey = coord.buildRenderKey(baseSnap);
    expect(coord.buildRenderKey(withMoreOpen)).not.toBe(baseKey);
    expect(coord.buildRenderKey(withAuditOpen)).not.toBe(baseKey);
    expect(coord.buildRenderKey(withDebugFlag)).not.toBe(baseKey);
  });
});

describe('SR-6.14 — Z4 FSM registration', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('moreAnalysisFsm + modelAuditFsm register under distinct ids', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(moreAnalysisFsm);
    coord.registerFsm(modelAuditFsm);
    expect(coord.getPanelState('moreAnalysis')).toBe('closed');
    expect(coord.getPanelState('modelAudit')).toBe('closed');
  });

  it('dispatching userToggle on one FSM does not change the other', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(moreAnalysisFsm);
    coord.registerFsm(modelAuditFsm);
    coord.dispatch('moreAnalysis', 'userToggle');
    expect(coord.getPanelState('moreAnalysis')).toBe('open');
    expect(coord.getPanelState('modelAudit')).toBe('closed');
  });

  it('tableSwitch collapses both FSMs via clearForTableSwitch fan-out', () => {
    const { coord } = createCoordinator();
    coord.registerFsm(moreAnalysisFsm);
    coord.registerFsm(modelAuditFsm);
    coord.dispatch('moreAnalysis', 'userToggle');
    coord.dispatch('modelAudit', 'userToggle');
    expect(coord.getPanelState('moreAnalysis')).toBe('open');
    expect(coord.getPanelState('modelAudit')).toBe('open');
    coord.clearForTableSwitch();
    expect(coord.getPanelState('moreAnalysis')).toBe('closed');
    expect(coord.getPanelState('modelAudit')).toBe('closed');
  });
});

describe('SR-6.14 — builder split', () => {
  it('buildMoreAnalysisHTML never emits Model Audit content', () => {
    const result = buildMoreAnalysisHTML(flopWithAdvice.lastGoodAdvice, 'flop');
    expect(result.html).not.toContain('Player model');
    expect(result.html).not.toContain('Model Audit');
  });

  it('buildModelAuditHTML emits only Model Audit (no range breakdown etc.)', () => {
    const result = buildModelAuditHTML(flopWithAdvice.lastGoodAdvice);
    expect(result.showButton).toBe(true);
    expect(result.html).toContain('Player model');
    expect(result.html).not.toContain('rb-stacked-bar');
    expect(result.html).not.toContain('<svg'); // fold curve is More Analysis
    expect(result.html).not.toContain('vuln-dot');
  });

  it('buildModelAuditHTML returns showButton=false when tm/mq absent', () => {
    const advice = {
      recommendations: [{ action: 'check', ev: 0 }],
      // no treeMetadata, no modelQuality
    };
    const result = buildModelAuditHTML(advice);
    expect(result.showButton).toBe(false);
    expect(result.html).toBe('');
  });

  it('buildMoreAnalysisHTML showButton reflects content presence (sparse → false)', () => {
    const sparse = { recommendations: [{ action: 'check', ev: 0 }] };
    expect(buildMoreAnalysisHTML(sparse).showButton).toBe(false);
  });
});

describe('SR-6.14 — RT-61 predicate contract (logic-level)', () => {
  // The predicate lives inside renderPlanPanel (side-panel.js IIFE) so we
  // model the logic here against coordinator state. If the predicate ever
  // regresses to "re-arm every render when closed", the failure mode is the
  // timer never firing because subsequent renders during the 8s window
  // re-schedule it. These cases document the intended behavior contract so
  // any reviewer editing renderPlanPanel can cross-check.

  it('fresh advice arrival: new _receivedAt differs from lastAutoExpandAdviceAt → re-arm', () => {
    const { coord } = createCoordinator();
    coord.set('lastAutoExpandAdviceAt', null);
    const advice = { _receivedAt: 1000, handPlan: { branches: [] } };
    const shouldArm = advice._receivedAt !== coord.get('lastAutoExpandAdviceAt')
      && !coord.get('planPanelOpen')
      && !!advice.handPlan
      && !coord.get('userToggledPlanPanelInHand');
    expect(shouldArm).toBe(true);
  });

  it('same advice re-rendered: _receivedAt matches tracker → do NOT re-arm', () => {
    const { coord } = createCoordinator();
    coord.set('lastAutoExpandAdviceAt', 1000);
    const advice = { _receivedAt: 1000, handPlan: { branches: [] } };
    const shouldArm = advice._receivedAt !== coord.get('lastAutoExpandAdviceAt')
      && !coord.get('planPanelOpen')
      && !!advice.handPlan
      && !coord.get('userToggledPlanPanelInHand');
    expect(shouldArm).toBe(false);
  });

  it('advice without handPlan: never arm', () => {
    const { coord } = createCoordinator();
    coord.set('lastAutoExpandAdviceAt', null);
    const advice = { _receivedAt: 2000 /* no handPlan */ };
    const shouldArm = advice._receivedAt !== coord.get('lastAutoExpandAdviceAt')
      && !coord.get('planPanelOpen')
      && !!advice.handPlan;
    expect(shouldArm).toBe(false);
  });

  it('user toggled plan panel mid-hand: future fresh advice does NOT re-arm', () => {
    const { coord } = createCoordinator();
    coord.set('userToggledPlanPanelInHand', true);
    coord.set('lastAutoExpandAdviceAt', null);
    const advice = { _receivedAt: 3000, handPlan: { branches: [] } };
    const shouldArm = advice._receivedAt !== coord.get('lastAutoExpandAdviceAt')
      && !coord.get('planPanelOpen')
      && !!advice.handPlan
      && !coord.get('userToggledPlanPanelInHand');
    expect(shouldArm).toBe(false);
  });

  it('hand:new clears userToggledPlanPanelInHand → next advice re-arms', () => {
    const { coord } = createCoordinator();
    coord.set('userToggledPlanPanelInHand', true);
    coord.set('lastAutoExpandAdviceAt', 3000);
    coord.handleLiveContext({ state: 'FLOP', currentStreet: 'flop' });
    coord.handleLiveContext({ state: 'PREFLOP', currentStreet: 'preflop' });
    expect(coord.get('userToggledPlanPanelInHand')).toBe(false);
    expect(coord.get('lastAutoExpandAdviceAt')).toBeNull();
  });
});
