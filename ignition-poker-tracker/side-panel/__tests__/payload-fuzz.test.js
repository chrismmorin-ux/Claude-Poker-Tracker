/**
 * payload-fuzz.test.js — STP-1 Stage 4d / doctrine R-10.1.
 *
 * Adversarial corpus for incoming `push_live_context` payloads. Each entry
 * encodes a known-bad shape the production pipeline has been observed to
 * emit (or can plausibly emit under capture-probe failure). Every entry
 * must be either (a) rejected at ingress by `validateLiveContext`, or
 * (b) caught by coordinator invariants R11/R12 after the push.
 *
 * Defense-in-depth layout:
 *   Layer 1 — wire-schema validator rejects malformed payload.
 *   Layer 2 — if somehow accepted (internal construction path), the
 *             state-invariant checker fires R11/R12 on the next render.
 *
 * This test was the missing counterpart to Bug 4 in the STP-1 audit gap
 * analysis. Pre-STP-1, `activeSeatNumbers ∩ foldedSeats ≠ ∅` with hero
 * in neither set slipped through both layers silently.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { validateLiveContext } from '../../shared/wire-schemas.js';
import { HarnessRunner } from './message-harness.js';

const CORPUS = [
  {
    name: 'activeSeatNumbers ∩ foldedSeats overlap at one seat',
    ctx: { currentStreet: 'flop', heroSeat: 5, activeSeatNumbers: [3, 5, 7], foldedSeats: [1, 5, 9] },
    expect: { wireValid: false, rule: 'R11' },
  },
  {
    name: 'activeSeatNumbers ∩ foldedSeats overlap at multiple seats',
    ctx: { currentStreet: 'turn', heroSeat: 3, activeSeatNumbers: [3, 5, 7], foldedSeats: [3, 5, 7] },
    expect: { wireValid: false, rule: 'R11' },
  },
  {
    name: 'heroSeat not in activeSeatNumbers or foldedSeats',
    ctx: { currentStreet: 'flop', heroSeat: 9, activeSeatNumbers: [3, 5, 7], foldedSeats: [1, 2] },
    expect: { wireValid: false, rule: 'R12' },
  },
  {
    name: 'heroSeat=0 (out of range low)',
    ctx: { currentStreet: 'preflop', heroSeat: 0, activeSeatNumbers: [1, 2], foldedSeats: [] },
    expect: { wireValid: false, rule: 'R8' },
  },
  {
    name: 'heroSeat=10 (out of range high)',
    ctx: { currentStreet: 'preflop', heroSeat: 10, activeSeatNumbers: [1, 2], foldedSeats: [] },
    expect: { wireValid: false, rule: 'R8' },
  },
  {
    name: 'heroSeat=2.5 (non-integer)',
    ctx: { currentStreet: 'preflop', heroSeat: 2.5, activeSeatNumbers: [2], foldedSeats: [] },
    expect: { wireValid: false, rule: 'R8' },
  },
  {
    name: 'duplicate seats in activeSeatNumbers',
    ctx: { currentStreet: 'flop', heroSeat: 3, activeSeatNumbers: [3, 3, 5], foldedSeats: [1] },
    expect: { wireValid: false, rule: null },  // duplicates caught at wire layer only
  },
  {
    name: 'activeSeatNumbers contains seat 0',
    ctx: { currentStreet: 'flop', heroSeat: 5, activeSeatNumbers: [0, 3, 5], foldedSeats: [1] },
    expect: { wireValid: false, rule: null },
  },
  {
    name: 'foldedSeats contains seat 11',
    ctx: { currentStreet: 'turn', heroSeat: 5, activeSeatNumbers: [3, 5], foldedSeats: [1, 11] },
    expect: { wireValid: false, rule: null },
  },
  {
    name: 'both sets empty with heroSeat set (coverage edge — no R11/R12 without both arrays)',
    ctx: { currentStreet: 'preflop', heroSeat: 5 },
    expect: { wireValid: true, rule: null },  // wire accepts (old-pipeline tolerance), R12 needs both arrays
  },
  {
    name: 'all three fields null (pre-deal)',
    ctx: { currentStreet: 'preflop', heroSeat: null, activeSeatNumbers: null, foldedSeats: null },
    expect: { wireValid: true, rule: null },
  },
];

describe('STP-1 R-10.1 — payload fuzz corpus', () => {
  describe('Layer 1 — wire-schema validator', () => {
    for (const entry of CORPUS) {
      it(`${entry.name}: wire ${entry.expect.wireValid ? 'accepts' : 'rejects'}`, () => {
        const r = validateLiveContext(entry.ctx);
        expect(r.valid).toBe(entry.expect.wireValid);
        if (!entry.expect.wireValid) {
          expect(r.errors.length).toBeGreaterThan(0);
        }
      });
    }
  });

  describe('Layer 2 — coordinator invariants (for payloads that would bypass ingress)', () => {
    let harness;
    beforeEach(() => {
      vi.useFakeTimers();
      harness = new HarnessRunner();
    });
    afterEach(() => {
      harness.destroy();
      vi.useRealTimers();
    });

    for (const entry of CORPUS) {
      if (!entry.expect.rule) continue;  // skip entries not covered by any R-rule

      it(`${entry.name}: R${entry.expect.rule.replace('R', '')} fires when set directly on coordinator`, () => {
        // Bypass the wire layer by setting state directly. This simulates
        // an internal code path constructing a liveContext locally. R11/R12
        // should catch it even when the wire didn't.
        harness.coord.set('currentLiveContext', { ...entry.ctx, state: 'FLOP' });
        harness.coord.set('lastHandCount', 5);
        harness.coord.set('currentActiveTableId', 'table_test');
        harness.coord.set('hasTableHands', true);
        harness.coord.scheduleRender('fuzz');
        vi.advanceTimersByTime(200);
        harness.flush();

        const events = (harness.coord.get('pipelineEvents') || [])
          .filter(e => e.event === 'INVARIANT_VIOLATION')
          .map(e => e.detail);
        const matched = events.some(d => d.startsWith(`${entry.expect.rule}:`));
        expect(matched, `expected ${entry.expect.rule} to fire, got: ${events.join(' | ')}`).toBe(true);
      });
    }
  });

  describe('Valid payload sanity', () => {
    it('clean 6-handed flop payload passes both layers', () => {
      const ctx = {
        currentStreet: 'flop',
        heroSeat: 5,
        activeSeatNumbers: [3, 5, 7],
        foldedSeats: [1, 2, 9],
      };
      expect(validateLiveContext(ctx).valid).toBe(true);

      vi.useFakeTimers();
      const harness = new HarnessRunner();
      harness.coord.set('currentLiveContext', { ...ctx, state: 'FLOP' });
      harness.coord.set('lastHandCount', 5);
      harness.coord.set('currentActiveTableId', 'table_clean');
      harness.coord.set('hasTableHands', true);
      harness.coord.scheduleRender('clean');
      vi.advanceTimersByTime(200);
      harness.flush();
      const violationCount = harness.coord.get('violationCountLifetime') || 0;
      harness.destroy();
      vi.useRealTimers();
      expect(violationCount).toBe(0);
    });
  });
});
