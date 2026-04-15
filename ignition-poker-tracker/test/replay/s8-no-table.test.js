/**
 * @vitest-environment jsdom
 *
 * s8-no-table.test.js — SR-3 corpus S8: no active table banner.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS8NoTable } from './recorder.js';

describe('SR-3 corpus S8: no active table', () => {
  it('push_pipeline_status with empty tables + 5s grace shows no-table banner', async () => {
    const corpus = buildS8NoTable();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S8] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S8] snap t=${s.t} noTableVisible=${s.noTableVisible} hudContentVisible=${s.hudContentVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S8:${hash}]`);

    const s8 = signatures.S8(result);
    console.log('[SR-3/S8] S8 match:', s8);

    expect(s8.matched).toBe(true);
  });
});
