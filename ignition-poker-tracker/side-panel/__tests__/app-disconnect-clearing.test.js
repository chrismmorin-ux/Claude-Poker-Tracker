/**
 * app-disconnect-clearing.test.js — V-status §I INV-STATUS-5 (Gate 5 PR-10).
 *
 * Closes FM-STATUS-5: when the main poker-tracker app crashes mid-session,
 * the SW continues sending pipeline-status pushes with appConnected=false,
 * but no new exploits push arrives to update lastGoodExploits — leaving
 * its cached `appConnected: true` to leak into buildSnapshot's appConnected
 * OR-derive and falsely show the app as synced.
 *
 * Coordinator's clearForAppDisconnect nulls the 4-field app-bridge cohort
 * (lastGoodExploits / lastGoodWeaknesses / lastGoodBriefings /
 * lastGoodObservations). Driver in side-panel.js handlePipelineStatus
 * detects the lastPipeline.appConnected `true → false` transition and
 * invokes the method.
 *
 * Spec: docs/design/surfaces/sidebar-shell-spec.md §I.9.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { RenderCoordinator } from '../render-coordinator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PANEL_DIR = resolve(__dirname, '..');

function createCoordinator() {
  const coord = new RenderCoordinator({
    renderFn: () => {},
    getTimestamp: () => Date.now(),
    requestFrame: (cb) => setTimeout(cb, 0),
    setTimeout: (cb, ms) => setTimeout(cb, ms),
    clearTimeout: (id) => clearTimeout(id),
  }, { coalesceMs: 80 });
  return coord;
}

describe('V-status §I INV-STATUS-5 — clearForAppDisconnect', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('nulls all 4 app-bridge cohort fields together', () => {
    const coord = createCoordinator();
    coord.set('lastGoodExploits', { seats: [{ seat: 1 }], appConnected: true });
    coord.set('lastGoodWeaknesses', [{ id: 'w1', seat: 1 }]);
    coord.set('lastGoodBriefings', [{ id: 'b1', seat: 1 }]);
    coord.set('lastGoodObservations', [{ id: 'o1', seat: 1 }]);

    coord.clearForAppDisconnect();

    expect(coord.get('lastGoodExploits')).toBeNull();
    expect(coord.get('lastGoodWeaknesses')).toBeNull();
    expect(coord.get('lastGoodBriefings')).toBeNull();
    expect(coord.get('lastGoodObservations')).toBeNull();
  });

  it('preserves hand-history state (out of cohort scope)', () => {
    // The app crashing doesn't invalidate the panel's own hand observations.
    const coord = createCoordinator();
    coord.set('lastHandCount', 42);
    coord.set('hasTableHands', true);
    coord.set('cachedSeatStats', { 1: { vpip: 22 } });
    coord.set('lastGoodExploits', { appConnected: true });

    coord.clearForAppDisconnect();

    expect(coord.get('lastHandCount')).toBe(42);
    expect(coord.get('hasTableHands')).toBe(true);
    expect(coord.get('cachedSeatStats')).toEqual({ 1: { vpip: 22 } });
  });

  it('snapshot.appConnected derive resolves false after clearForAppDisconnect when pipeline.appConnected=false', () => {
    // The bug being closed: OR-derive previously stayed true because
    // lastGoodExploits.appConnected was a stale cached `true`.
    const coord = createCoordinator();
    coord.set('lastPipeline', { appConnected: false, tables: {}, tableCount: 0 });
    coord.set('lastGoodExploits', { seats: [], appConnected: true });

    // Before clearing — buggy state showcasing the OR leak.
    expect(coord.buildSnapshot().appConnected).toBe(true);

    coord.clearForAppDisconnect();
    expect(coord.buildSnapshot().appConnected).toBe(false);
  });

  it('is idempotent — calling on already-null cohort is a no-op', () => {
    const coord = createCoordinator();
    coord.clearForAppDisconnect();
    coord.clearForAppDisconnect();
    expect(coord.get('lastGoodExploits')).toBeNull();
    expect(coord.get('lastGoodWeaknesses')).toBeNull();
  });
});

describe('V-status §I INV-STATUS-5 — STATE_FIELD_SCOPES declaration', () => {
  // Companion check per spec §I.9: lastGoodExploits has at least 2 declared
  // clearing events. The registry markdown is parsed by state-clear-symmetry
  // for scope membership; here we assert the two specific clearing methods
  // are named in the lastGoodExploits row.
  const md = readFileSync(resolve(PANEL_DIR, 'STATE_FIELD_SCOPES.md'), 'utf8');

  it('lastGoodExploits row cites both clearForTableSwitch and clearForAppDisconnect', () => {
    const lines = md.split('\n');
    const row = lines.find(l => l.includes('`lastGoodExploits`') && l.includes('`lastGoodWeaknesses`'));
    expect(row).toBeTruthy();
    expect(row).toMatch(/clearForTableSwitch/);
    expect(row).toMatch(/clearForAppDisconnect/);
  });
});

describe('V-status §I INV-STATUS-5 — handlePipelineStatus driver pattern', () => {
  // Source-grep regression pin: the driver MUST capture prevAppConnected
  // BEFORE writing the new pipeline value. Reordering would lose the
  // transition signal (the new value would mask the prev).
  const src = readFileSync(resolve(PANEL_DIR, 'side-panel.js'), 'utf8');

  it('handlePipelineStatus reads prevAppConnected before writing lastPipeline', () => {
    const handlerStart = src.indexOf('const handlePipelineStatus =');
    expect(handlerStart).toBeGreaterThan(0);
    // Slice ~600 chars of the handler — enough for prologue + the set call.
    const slice = src.slice(handlerStart, handlerStart + 600);
    const prevReadIdx = slice.search(/prevAppConnected\s*=/);
    const setIdx = slice.search(/coordinator\.set\(\s*'lastPipeline'/);
    expect(prevReadIdx).toBeGreaterThan(0);
    expect(setIdx).toBeGreaterThan(0);
    expect(prevReadIdx).toBeLessThan(setIdx);
  });

  it('handlePipelineStatus invokes clearForAppDisconnect on transition', () => {
    expect(src).toMatch(/coordinator\.clearForAppDisconnect\(\)/);
  });
});
