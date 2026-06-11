// @vitest-environment jsdom
/**
 * analysisPipeline.seam.test.js
 *
 * Full-chain seam test with **no mocks** — complements the all-mocked
 * src/utils/__tests__/analysisPipeline.test.js (a wiring test). That file
 * mocks every sub-module, so until now no test drove a real hand through:
 *
 *   gameReducer dispatch → usePersistence save-payload construction →
 *   saveHand → IndexedDB (fake-indexeddb) → loadLatestHand →
 *   buildTimeline → buildPlayerStats / derivePercentages
 *
 * The persisted payload is built inline inside usePersistence's auto-save
 * effect, so this test drives the real hook via renderHook rather than
 * hand-constructing the payload — otherwise it would replicate the shape
 * instead of verifying it. Shape drift anywhere along the chain breaks
 * the VPIP/PFR assertions here.
 *
 * WS-216 (seam-audit-2026-06-10) — SPR-120.
 */

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { gameReducer, initialGameState, GAME_ACTIONS } from '../../reducers/gameReducer';
import { playerReducer, initialPlayerState } from '../../reducers/playerReducer';
import { initialCardState } from '../../reducers/cardReducer';
import { PLAYER_ACTIONS } from '../../constants/playerConstants';
import { PRIMITIVE_ACTIONS } from '../../constants/primitiveActions';
import { usePersistence } from '../usePersistence';
import { loadLatestHand, GUEST_USER_ID } from '../../utils/persistence/index';
import { closeDB, resetDBPool, DB_NAME } from '../../utils/persistence/database';
import { buildTimeline } from '../../utils/handAnalysis';
import { buildPlayerStats, derivePercentages } from '../../utils/tendencyCalculations';

// ───────────────────────────────────────────────────────────────────────────
// Test setup — wipe IDB once, then save the hand ONCE and share the reloaded
// record across all assertions.
//
// Per-test wipes don't work here: usePersistence calls initDB() directly on
// mount (usePersistence.js:66), opening a connection outside the getDB()
// pool with no onversionchange handler. closeDB()/resetDBPool() can't reach
// it, so it blocks any subsequent deleteDatabase() forever. One save against
// a once-wiped DB sidesteps that; the forks pool isolates this file in its
// own process, and the reloaded record is never mutated by assertions.
// ───────────────────────────────────────────────────────────────────────────

const deleteEntireDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.deleteDatabase(DB_NAME);
  req.onsuccess = () => resolve();
  req.onerror = (e) => reject(e.target.error);
  req.onblocked = () => resolve();
});

afterAll(async () => {
  closeDB();
  resetDBPool();
});

// ───────────────────────────────────────────────────────────────────────────
// Fixture — a realistic 9-handed hand built ONLY via real reducer dispatches.
//
// Dealer seat 1 → SB 2, BB 3, UTG 4. Hero is mySeat 5 (initialGameState
// defaults). Seat 6 open-raises and c-bets the flop, seat 8 calls down,
// everyone else folds preflop. Turn and river check through.
//
// Final states are precomputed by folding the dispatch list through the
// reducers OUTSIDE React. Dispatching against a live useReducer harness
// after isReady would run the auto-save effect's cleanup on every state
// change, flushing one intermediate hand record per dispatch instead of
// the single completed hand this test asserts on.
// ───────────────────────────────────────────────────────────────────────────

const RAISER_ID = 101;   // seat 6 — open-raise + flop c-bet
const CALLER_ID = 102;   // seat 8 — preflop + flop call
const FOLDER_ID = 103;   // seat 4 — preflop fold

const record = (seat, action, amount) => ({
  type: GAME_ACTIONS.RECORD_PRIMITIVE_ACTION,
  payload: amount === undefined ? { seat, action } : { seat, action, amount },
});
const setStreet = (street) => ({ type: GAME_ACTIONS.SET_STREET, payload: street });

const { FOLD, RAISE, CALL, BET, CHECK } = PRIMITIVE_ACTIONS;

const GAME_DISPATCHES = [
  // Preflop — 9 action entries
  record(4, FOLD),
  record(5, FOLD),
  record(6, RAISE, 3),
  record(7, FOLD),
  record(8, CALL, 3),
  record(9, FOLD),
  record(1, FOLD),
  record(2, FOLD),
  record(3, FOLD),
  // Flop — c-bet called
  setStreet('flop'),
  record(6, BET, 4),
  record(8, CALL, 4),
  // Turn — checks through
  setStreet('turn'),
  record(6, CHECK),
  record(8, CHECK),
  // River — checks through
  setStreet('river'),
  record(6, CHECK),
  record(8, CHECK),
];

const ACTION_ENTRY_COUNT = 15; // 18 dispatches minus 3 SET_STREET

const finalGameState = GAME_DISPATCHES.reduce(gameReducer, initialGameState);

const finalPlayerState = [
  { type: PLAYER_ACTIONS.SET_SEAT_PLAYER, payload: { seat: 6, playerId: RAISER_ID } },
  { type: PLAYER_ACTIONS.SET_SEAT_PLAYER, payload: { seat: 8, playerId: CALLER_ID } },
  { type: PLAYER_ACTIONS.SET_SEAT_PLAYER, payload: { seat: 4, playerId: FOLDER_ID } },
].reduce(playerReducer, initialPlayerState);

// ───────────────────────────────────────────────────────────────────────────
// Save-and-reload — the seam under test.
//
// Mount the real hook with the completed-hand states. Once isReady flips,
// the auto-save effect builds the persisted payload and schedules the
// debounced (1500ms) write; unmounting runs the effect cleanup, which
// flushes the pending save immediately. The flushed closure is async
// (predictionAudit reconstruction + saveHand), so we await its observable
// effect: loadLatestHand returning the record. Real timers throughout —
// fake timers and fake-indexeddb's own async scheduling don't mix.
// ───────────────────────────────────────────────────────────────────────────

const saveAndReload = async () => {
  await deleteEntireDB();
  const { result, unmount } = renderHook(() =>
    usePersistence(
      finalGameState,
      initialCardState,
      finalPlayerState,
      vi.fn(),
      vi.fn(),
      vi.fn(),
      GUEST_USER_ID,
      null,
    ),
  );

  await waitFor(() => expect(result.current.isReady).toBe(true), { timeout: 10000 });
  unmount();

  let reloaded = null;
  await waitFor(async () => {
    reloaded = await loadLatestHand(GUEST_USER_ID);
    expect(reloaded).not.toBeNull();
  }, { timeout: 10000 });
  return reloaded;
};

// ───────────────────────────────────────────────────────────────────────────
// Assertions
// ───────────────────────────────────────────────────────────────────────────

describe('analysis pipeline seam: reducer → save → IDB → reload → tendencies', () => {
  let reloaded = null;

  beforeAll(async () => {
    reloaded = await saveAndReload();
  }, 30000);

  it('round-trips the recorded hand intact and builds a coherent timeline', () => {
    expect(reloaded.gameState.actionSequence).toHaveLength(ACTION_ENTRY_COUNT);
    expect(reloaded.seatPlayers).toEqual({
      4: FOLDER_ID,
      6: RAISER_ID,
      8: CALLER_ID,
    });

    const timeline = buildTimeline(reloaded);
    expect(timeline).toHaveLength(ACTION_ENTRY_COUNT);
    timeline.forEach((entry, i) => {
      expect(typeof entry.seat).toBe('string');
      if (i > 0) expect(entry.order).toBeGreaterThan(timeline[i - 1].order);
    });

    const byStreet = (street) => timeline.filter((e) => e.street === street).length;
    expect(byStreet('preflop')).toBe(9);
    expect(byStreet('flop')).toBe(2);
    expect(byStreet('turn')).toBe(2);
    expect(byStreet('river')).toBe(2);
  });

  it('computes VPIP 100 / PFR 100 for the open-raiser, including the flop c-bet', () => {
    const pct = derivePercentages(buildPlayerStats(RAISER_ID, [reloaded]));
    expect(pct.vpip).toBe(100);
    expect(pct.pfr).toBe(100);
    expect(pct.cbet).toBe(100); // preflop aggressor bet the flop
    expect(pct.sampleSize).toBe(1);
  });

  it('computes VPIP 100 / PFR 0 for the preflop caller', () => {
    const pct = derivePercentages(buildPlayerStats(CALLER_ID, [reloaded]));
    expect(pct.vpip).toBe(100);
    expect(pct.pfr).toBe(0);
  });

  it('computes VPIP 0 / PFR 0 for the preflop folder, who still counts toward the sample', () => {
    const pct = derivePercentages(buildPlayerStats(FOLDER_ID, [reloaded]));
    expect(pct.vpip).toBe(0);
    expect(pct.pfr).toBe(0);
    // A recorded preflop fold counts the hand in the denominator — pins the
    // extractPreflopStats "fold is a preflop timeline entry" semantic.
    expect(pct.sampleSize).toBe(1);
  });
});
