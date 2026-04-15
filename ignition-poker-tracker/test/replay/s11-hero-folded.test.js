/**
 * @vitest-environment jsdom
 *
 * s11-hero-folded.test.js — SR-3 corpus S11: hero folded / observing mode.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS11HeroFolded } from './recorder.js';

describe('SR-3 corpus S11: hero folded / observing', () => {
  it('hero transitions to foldedSeats → Observing mode engages', async () => {
    const corpus = buildS11HeroFolded();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S11] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S11] snap t=${s.t} heroSeatFolded=${s.heroSeatFolded} betweenHandsVisible=${s.betweenHandsVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S11:${hash}]`);

    const s11 = signatures.S11(result);
    console.log('[SR-3/S11] S11 match:', s11);

    expect(s11.matched).toBe(true);
  });
});
