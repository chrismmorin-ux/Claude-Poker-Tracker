/**
 * @vitest-environment jsdom
 *
 * s12-river-decision.test.js — SR-3 corpus S12: river hero-to-act.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS12RiverDecision } from './recorder.js';

describe('SR-3 corpus S12: river hero-to-act', () => {
  it('river context + 5-card board + river advice → street-progress marks river active', async () => {
    const corpus = buildS12RiverDecision();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S12] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S12] snap t=${s.t} contextStreet=${s.contextStreet} streetProgressHTML.len=${(s.streetProgressHTML || '').length}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S12:${hash}]`);

    const s12 = signatures.S12(result);
    console.log('[SR-3/S12] S12 match:', s12);

    expect(s12.matched).toBe(true);
  });
});
