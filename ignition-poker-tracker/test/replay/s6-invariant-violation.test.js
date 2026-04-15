/**
 * @vitest-environment jsdom
 *
 * s6-invariant-violation.test.js — SR-3 corpus S6: invariant badge (RT-66).
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS6InvariantViolation } from './recorder.js';

describe('SR-3 corpus S6: state invariant violation', () => {
  it('push_live_context with mismatched state/street fires invariant-badge', async () => {
    const corpus = buildS6InvariantViolation();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S6] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S6] snap t=${s.t} statusTextHTML.len=${(s.statusTextHTML || '').length}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S6:${hash}]`);

    const s6 = signatures.S6(result);
    console.log('[SR-3/S6] S6 match:', s6);

    expect(s6.matched).toBe(true);
  });
});
