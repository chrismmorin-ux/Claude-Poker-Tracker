/**
 * @vitest-environment jsdom
 *
 * s10-tournament.test.js — SR-3 corpus S10: tournament bar.
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS10Tournament } from './recorder.js';

describe('SR-3 corpus S10: tournament mode', () => {
  it('push_tournament + live context renders tournament-bar with M-ratio', async () => {
    const corpus = buildS10Tournament();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-3/S10] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-3/S10] snap t=${s.t} tournamentBarVisible=${s.tournamentBarVisible} barHTML.len=${(s.tournamentBarHTML || '').length}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S10:${hash}]`);

    const s10 = signatures.S10(result);
    console.log('[SR-3/S10] S10 match:', s10);

    expect(s10.matched).toBe(true);
  });
});
