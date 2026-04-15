/**
 * @vitest-environment jsdom
 *
 * s9-pipeline-recovery.test.js — SR-3 corpus S9: recovery banner lifecycle.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS9PipelineRecovery } from './recorder.js';

describe('SR-3 corpus S9: pipeline recovery banner', () => {
  it('push_recovery_needed shows banner; push_recovery_cleared hides it', async () => {
    const corpus = buildS9PipelineRecovery();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S9] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S9] snap t=${s.t} recoveryBannerVisible=${s.recoveryBannerVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S9:${hash}]`);

    const s9 = signatures.S9(result);
    console.log('[SR-3/S9] S9 match:', s9);

    expect(s9.matched).toBe(true);
  });
});
