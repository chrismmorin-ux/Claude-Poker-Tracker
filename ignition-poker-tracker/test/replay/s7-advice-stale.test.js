/**
 * @vitest-environment jsdom
 *
 * s7-advice-stale.test.js — SR-3 corpus S7: advice stale tint + badge (RT-48).
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS7AdviceStale } from './recorder.js';

describe('SR-3 corpus S7: advice goes stale after 10s', () => {
  it('action-bar gains .stale class + "Stale Ns" badge after 10s idle', async () => {
    const corpus = buildS7AdviceStale();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S7] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S7] snap t=${s.t} stale=${s.actionBarStale} barHTML.len=${(s.actionBarHTML || '').length}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S7:${hash}]`);

    const s7 = signatures.S7(result);
    console.log('[SR-3/S7] S7 match:', s7);

    expect(s7.matched).toBe(true);
  });
});
