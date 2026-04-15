/**
 * @vitest-environment jsdom
 *
 * s3-plan-panel-race.test.js — S3 corpus: plan-panel vis→hidden race.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS3PlanPanelRace } from './recorder.js';

describe('SR-1 corpus S3: plan-panel vis→hidden race', () => {
  it('plan-panel transitions visible→hidden within 200ms on flop arrival', async () => {
    const corpus = buildS3PlanPanelRace();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-1/S3] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-1/S3] snap t=${s.t} planPanelVisible=${s.planPanelVisible} adviceStreet=${s.adviceStreet} contextStreet=${s.contextStreet}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S3:${hash}]`);

    const s3 = signatures.S3(result);
    console.log('[SR-1/S3] S3 match:', s3);

    expect(s3.matched).toBe(true);
  });
});
