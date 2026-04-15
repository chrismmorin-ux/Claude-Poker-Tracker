/**
 * @vitest-environment jsdom
 *
 * s13-checked-flop.test.js — SR-3 corpus S13: checked-around flop / Rule V Q1-a fixture.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS13CheckedFlop } from './recorder.js';

describe('SR-3 corpus S13: checked-around flop (Rule V Q1-a fixture)', () => {
  it('flop check-check-check → turn context with pfAggressor set — regression fixture', async () => {
    const corpus = buildS13CheckedFlop();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S13] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S13] snap t=${s.t} contextStreet=${s.contextStreet} handNumber=${s.handNumber} heroSeatFolded=${s.heroSeatFolded}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S13:${hash}]`);

    const s13 = signatures.S13(result);
    console.log('[SR-3/S13] S13 match:', s13);

    expect(s13.matched).toBe(true);
  });
});
