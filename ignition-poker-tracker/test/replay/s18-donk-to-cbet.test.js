/**
 * @vitest-environment jsdom
 *
 * s18-donk-to-cbet.test.js — SR-cluster corpus S18:
 *   villain donk-leads mid-coalesce; new advice computed in tight succession;
 *   FSM/raw-state must not decouple, plan-panel must not oscillate, final
 *   advice/context coupling must hold.
 *
 * Locks SPR-045 (WS-102 betweenHandsFsm pendingActive + WS-104 synchronous
 * timer registration) against regression — these enforce R-5.6 FSM-output
 * exclusivity during rapid villain-action transitions.
 *
 * One corpus per file — see determinism.test.js for rationale.
 */

import { describe, it, expect } from 'vitest';
import { runReplay, hashReplay } from './replayer.js';
import { signatures } from './signatures.js';
import { buildS18DonkToCbet } from './recorder.js';

describe('SR-cluster corpus S18: donk→cbet transition', () => {
  it('plan-panel stays stable + advice/context coupled across donk-lead transition (R-5.6)', async () => {
    const corpus = buildS18DonkToCbet();
    const result = await runReplay({ events: corpus.events, seedHands: corpus.seedHands });

    expect(result.snapshots.length).toBeGreaterThan(0);

    console.log('[SR-cluster/S18] mutations:', result.mutations.length, 'snapshots:', result.snapshots.length);
    for (const s of result.snapshots) {
      console.log(`[SR-cluster/S18] snap t=${s.t} hand=${s.handNumber} adviceStreet=${s.adviceStreet} contextStreet=${s.contextStreet} planPanelVisible=${s.planPanelVisible}`);
    }

    const hash = hashReplay(result);
    console.log(`[HASH:S18:${hash}]`);

    const s18 = signatures.S18(result);
    console.log('[SR-cluster/S18] S18 match:', s18);

    expect(s18.matched).toBe(true);
  });
});
