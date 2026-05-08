/**
 * @vitest-environment jsdom
 *
 * s15-sw-reanimate.test.js — SR-cluster corpus S15:
 *   SW eviction (30s gap) → reanimation replays cached advice+exploits onto a
 *   new hand without companion context (locked-hand gate must reject).
 *
 * Locks SPR-043 (WS-105 SW→side-panel validateMessage parity) +
 *       SPR-044 (WS-103 freeze live_context at SW boundary) against regression.
 *
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS15SwReanimate } from './recorder.js';

describe('SR-cluster corpus S15: SW-reanimate cross-hand replay', () => {
  it('SW reanimation bundle for hand N does not promote on hand N+1 PREFLOP', async () => {
    const corpus = buildS15SwReanimate();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-cluster/S15] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-cluster/S15] snap t=${s.t} hand=${s.handNumber} adviceStreet=${s.adviceStreet} contextStreet=${s.contextStreet} planPanelVisible=${s.planPanelVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S15:${hash}]`);

    const s15 = signatures.S15(result);
    console.log('[SR-cluster/S15] S15 match:', s15);

    expect(s15.matched).toBe(true);
  });
});
