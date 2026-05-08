/**
 * @vitest-environment jsdom
 *
 * s16-handnew-within-80ms.test.js — SR-cluster corpus S16:
 *   handNew within the 80ms coalesce window must not cause plan-panel
 *   oscillation; final settled state must be correct.
 *
 * Locks SPR-045 (WS-104 synchronous timer registration + WS-102 betweenHandsFsm
 * pendingActive debounce) against regression.
 *
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS16HandNewWithin80ms } from './recorder.js';

describe('SR-cluster corpus S16: handNew-within-80ms', () => {
  it('plan-panel does not oscillate when handNew arrives mid-coalesce; settled state correct', async () => {
    const corpus = buildS16HandNewWithin80ms();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-cluster/S16] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-cluster/S16] snap t=${s.t} hand=${s.handNumber} adviceStreet=${s.adviceStreet} contextStreet=${s.contextStreet} planPanelVisible=${s.planPanelVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S16:${hash}]`);

    const s16 = signatures.S16(result);
    console.log('[SR-cluster/S16] S16 match:', s16);

    expect(s16.matched).toBe(true);
  });
});
