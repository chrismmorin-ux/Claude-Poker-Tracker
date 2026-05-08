/**
 * @vitest-environment jsdom
 *
 * s17-two-advice-before-context.test.js — SR-cluster corpus S17:
 *   two push_action_advice arrive before any push_live_context — plan-panel
 *   must remain hidden until context arrives (R-7.2 pre-dispatch invariant gate).
 *
 * Locks SPR-043 (WS-105 SW→side-panel validateMessage parity) +
 *       SPR-044 (WS-103 freeze live_context at SW boundary) against regression.
 *
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS17TwoAdviceBeforeContext } from './recorder.js';

describe('SR-cluster corpus S17: two advice before context', () => {
  it('plan-panel stays hidden when advice arrives without companion context (R-7.2)', async () => {
    const corpus = buildS17TwoAdviceBeforeContext();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-cluster/S17] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-cluster/S17] snap t=${s.t} adviceStreet=${s.adviceStreet} contextStreet=${s.contextStreet} planPanelVisible=${s.planPanelVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S17:${hash}]`);

    const s17 = signatures.S17(result);
    console.log('[SR-cluster/S17] S17 match:', s17);

    expect(s17.matched).toBe(true);
  });
});
