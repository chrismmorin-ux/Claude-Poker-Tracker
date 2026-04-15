/**
 * @vitest-environment jsdom
 *
 * s4-between-hands.test.js — S4 corpus: between-hands modeAExpired overlap.
 * One corpus per file — see determinism.test.js for rationale.
 *
 * This is the HIGHEST-VALUE corpus: reveals that modeAExpired timer is never
 * reset on new push_live_context, causing between-hands to remain visible when
 * a new hand starts.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS4BetweenHandsOverlap } from './recorder.js';

describe('SR-1 corpus S4: between-hands modeAExpired overlap', () => {
  it('between-hands panel visible at same snapshot as new handNumber', async () => {
    const corpus = buildS4BetweenHandsOverlap();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-1/S4] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-1/S4] snap t=${s.t} handNumber=${s.handNumber} betweenHandsVisible=${s.betweenHandsVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S4:${hash}]`);

    const s4 = signatures.S4(result);
    console.log('[SR-1/S4] S4 match:', s4);

    expect(s4.matched).toBe(true);
  });
});
