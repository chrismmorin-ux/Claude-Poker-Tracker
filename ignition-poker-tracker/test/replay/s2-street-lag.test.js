/**
 * @vitest-environment jsdom
 *
 * s2-street-lag.test.js — S2 corpus replay: advice.street lag behind liveContext.street.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS2StreetMismatch } from './recorder.js';

describe('SR-1 corpus S2: advice-street lag', () => {
  it('plan-panel visible with advice.street=flop while liveContext.street=turn', async () => {
    const corpus = buildS2StreetMismatch();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-1/S2] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    const lastSnap = result.snapshots[result.snapshots.length - 1];
    console.log('[SR-1/S2] planPanelVisible:', lastSnap?.planPanelVisible);
    console.log('[SR-1/S2] adviceStreet:', lastSnap?.adviceStreet, 'contextStreet:', lastSnap?.contextStreet);

    const hash = hashReplay(result);
    console.log(`[HASH:S2:${hash}]`);

    const s2 = signatures.S2(result);
    console.log('[SR-1/S2] S2 match:', s2);

    expect(s2.matched).toBe(true);
  });
});
