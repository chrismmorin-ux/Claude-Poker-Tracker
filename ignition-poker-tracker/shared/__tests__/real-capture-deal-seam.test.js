/**
 * real-capture-deal-seam.test.js — REAL-PRODUCER regression for the HUD-drop bug.
 *
 * Unlike the hand-authored fixtures elsewhere, these are VERBATIM frame strings
 * from a real Ignition capture (ignition-frames-2026-06-14, seat-2 hero). They
 * drive the actual TableManager → HandStateMachine, and we assert that the live
 * context produced at every step passes the exact service-worker drop gate
 * (validateMessage('live_context', ...)).
 *
 * History: the retired heroSeat ∈ active∪folded invariant dropped ~20% of live
 * updates here — every frame between CO_SIT_PLAY (hero seated) and the hero's
 * own blind, plus all between-hands/DEALING frames — silently blanking the HUD.
 * A replay of the full 769-frame capture went from 151 drops to 0 once the rule
 * was removed. This locks the deal-phase slice so it can never silently return.
 */

import { describe, it, expect } from 'vitest';
import { TableManager } from '../table-manager.js';
import { validateMessage } from '../message-schemas.js';

// Verbatim from the real capture (the deal phase that triggered the bug).
const REAL_DEAL_FRAMES = [
  '61|{"seq":34,"tDiff":0,"data":{"seat":7,"pid":"CO_DEALER_SEAT"}}',
  '67|{"seq":35,"tDiff":0,"data":{"play":1,"seat":2,"pid":"CO_SIT_PLAY"}}',        // hero (seat 2) seated
  '67|{"seq":36,"tDiff":0,"data":{"tableState":4,"pid":"CO_TABLE_STATE"}}',         // DEALING
  '116|{"seq":37,"tDiff":0,"data":{"pid":"CO_BLIND_INFO","seat":8,"account":2973,"baseStakes":0,"btn":2,"bet":10,"dead":0}}',
  '116|{"seq":38,"tDiff":0,"data":{"pid":"CO_BLIND_INFO","seat":9,"account":1962,"baseStakes":0,"btn":4,"bet":25,"dead":0}}',
  '116|{"seq":39,"tDiff":0,"data":{"pid":"CO_BLIND_INFO","seat":2,"account":2475,"baseStakes":0,"btn":8,"bet":25,"dead":0}}', // hero posts
];

const CONN_ID = 'real_capture_conn';
const URL = 'wss://pkscb.ignitioncasino.eu/poker-games/rgs?X-PokerAPI-Site-Id=140';

describe('real-capture deal seam — heroSeat-not-in-active must NOT drop the HUD', () => {
  it('every live context across the deal phase passes the SW drop gate', () => {
    const tm = new TableManager();
    let sawHeroSeatedNotActive = false;

    for (const frame of REAL_DEAL_FRAMES) {
      tm.routeMessage(CONN_ID, frame, URL);
      const hsm = tm.getHSM(CONN_ID);
      if (!hsm) continue;
      const ctx = hsm.getLiveHandContext();
      if (!ctx) continue;

      // The exact production gate the service worker applies before forwarding.
      const err = validateMessage('live_context', { type: 'live_context', context: ctx });
      expect(err, `live context dropped during deal: ${err}`).toBeNull();

      // Confirm we actually exercised the bug's trigger state (hero seated but
      // not yet in the active set) — otherwise this test would be vacuous.
      const active = ctx.activeSeatNumbers || [];
      const folded = ctx.foldedSeats || [];
      if (ctx.heroSeat === 2 && !active.includes(2) && !folded.includes(2)) {
        sawHeroSeatedNotActive = true;
      }
    }

    expect(sawHeroSeatedNotActive, 'expected to hit the heroSeat-seated-not-active state').toBe(true);
  });
});
