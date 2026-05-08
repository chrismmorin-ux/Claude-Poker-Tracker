/**
 * @vitest-environment jsdom
 *
 * s14-reconnect-mid-advice.test.js — SR-cluster corpus S14:
 *   stale advice (cached by SW for hand N) replayed post-hand-boundary on a
 *   coincidentally-matching street (RT-45 + locked-hand gate must reject).
 *
 * Locks SPR-043 (WS-105 SW→side-panel validateMessage parity) +
 *       SPR-044 (WS-103 freeze live_context at SW boundary) against regression.
 *
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS14ReconnectMidAdvice } from './recorder.js';

describe('SR-cluster corpus S14: reconnect-mid-advice', () => {
  it('stale advice replayed across hand boundary is rejected on coincidental street match (RT-45)', async () => {
    const corpus = buildS14ReconnectMidAdvice();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-cluster/S14] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-cluster/S14] snap t=${s.t} hand=${s.handNumber} adviceStreet=${s.adviceStreet} contextStreet=${s.contextStreet} planPanelVisible=${s.planPanelVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S14:${hash}]`);

    const s14 = signatures.S14(result);
    console.log('[SR-cluster/S14] S14 match:', s14);

    expect(s14.matched).toBe(true);
  });
});
