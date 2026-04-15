/**
 * @vitest-environment jsdom
 *
 * determinism.test.js — S1 corpus replay (one corpus per file due to IIFE constraint).
 *
 * The side-panel.js IIFE runs exactly once per module import. vitest runs each
 * test FILE in its own worker, so one file = one fresh IIFE = one corpus.
 * Do NOT add a second runReplay() call to this file — it will fail because the
 * IIFE cannot re-register the port in the same module scope.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS1Partial } from './recorder.js';

describe('SR-1 corpus S1: partial fractional bet ($0 badge)', () => {
  it('side-panel renders seat-arc with $0 action badge for 0.4 bet amount', async () => {
    const corpus = buildS1Partial();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    const hash = hashReplay(result);
    console.log(`[HASH:S1:${hash}]`);
    console.log('[SR-1/S1] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    const lastSnap = result.snapshots[result.snapshots.length - 1];
    console.log('[SR-1/S1] seatArcHTML preview:', (lastSnap?.seatArcHTML || '').slice(0, 600));

    const s1 = signatures.S1(result);
    console.log('[SR-1/S1] S1 match:', s1);

    expect(s1.matched).toBe(true);
  });
});
