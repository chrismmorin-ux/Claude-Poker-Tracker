/**
 * @vitest-environment jsdom
 *
 * s5-excessive-mutations.test.js — S5 corpus: excessive DOM mutations per render pass.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS5ExcessiveMutations } from './recorder.js';

describe('SR-1 corpus S5: excessive DOM mutations', () => {
  it('rapid repeated pushes produce mutation/snapshot ratio > 50', async () => {
    const corpus = buildS5ExcessiveMutations();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    const ratio = result.mutations.length / result.snapshots.length;
    console.log('[SR-1/S5] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length, 'ratio:', ratio.toFixed(1));

    const hash = hashReplay(result);
    console.log(`[HASH:S5:${hash}]`);

    const s5 = signatures.S5(result);
    console.log('[SR-1/S5] S5 match:', s5);

    expect(s5.matched).toBe(true);
  });
});
