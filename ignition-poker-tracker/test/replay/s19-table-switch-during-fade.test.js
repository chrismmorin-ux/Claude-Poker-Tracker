/**
 * @vitest-environment jsdom
 *
 * s19-table-switch-during-fade.test.js — SR-cluster corpus S19:
 *   stale-advice fade timer running on table_1; table_2 becomes active mid-fade;
 *   R-8.1 state-clear symmetry must null all per-table fields (timer, advice,
 *   stale-badge HTML) so the new table's render starts clean.
 *
 * Locks SPR-045 (WS-104 synchronous timer registration) + the broader STP-1
 * state-clear symmetry program (pre-cluster) against regression.
 *
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS19TableSwitchDuringFade } from './recorder.js';

describe('SR-cluster corpus S19: table-switch-during-fade', () => {
  it('stale-advice + table switch → R-8.1 clears all per-table state on the new table', async () => {
    const corpus = buildS19TableSwitchDuringFade();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-cluster/S19] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-cluster/S19] snap t=${s.t} hand=${s.handNumber} actionBarStale=${s.actionBarStale} planPanelVisible=${s.planPanelVisible} actionBarHTMLLen=${(s.actionBarHTML || '').length}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S19:${hash}]`);

    const s19 = signatures.S19(result);
    console.log('[SR-cluster/S19] S19 match:', s19);

    expect(s19.matched).toBe(true);
  });
});
