/**
 * gameReducer.undoInvariants.test.js — ICP-1 / WS-122 audit runner
 *
 * Walks gameReducer.undoInvariants.fixture.js. Most rows go through the
 * shared runner at src/test/invariantMatrix.js. Two row classes need
 * custom handling and run in dedicated describe blocks:
 *
 *   1. category === 'cross_coupling' rows assert that a gameReducer UNDO
 *      action does NOT mutate sibling slices (playerReducer.seatPlayers,
 *      uiReducer.selectedPlayers). The generic runner only sees gameState;
 *      cross-coupling assertions need explicit harness work.
 *
 *   2. UNDO-R-001 asserts state-object-reference identity (not deep equal)
 *      for rejected UNDO actions — a React re-render-skip optimization.
 *      The generic runner uses toEqual; this row uses toBe.
 *
 * Audit-only: no production code is touched.
 *
 * Pattern doc: .claude/context/INVARIANT_MATRIX_PATTERN.md
 */

import { describe, it, expect } from 'vitest';
import { gameReducer } from '../gameReducer';
import { playerReducer } from '../playerReducer';
import { uiReducer, UI_ACTIONS, initialUiState } from '../uiReducer';
import { initialPlayerState } from '../playerReducer';
import { runInvariantMatrix } from '../../test/invariantMatrix';
import { fixtures } from './gameReducer.undoInvariants.fixture.js';

// ---------------------------------------------------------------------------
// Partition the fixture so each subset goes to the right runner.
// ---------------------------------------------------------------------------
const SAME_REF_PIN_ID = 'UNDO-R-001';

const crossCouplingRows = fixtures.filter(
  (r) => r.category === 'cross_coupling'
);
const sameRefRows = fixtures.filter((r) => r.id === SAME_REF_PIN_ID);
const standardRows = fixtures.filter(
  (r) => r.category !== 'cross_coupling' && r.id !== SAME_REF_PIN_ID
);

// ---------------------------------------------------------------------------
// Harness for STANDARD rows: apply the action to gameReducer; return only
// the slices the row asserts on (drives toEqual partial-match).
// ---------------------------------------------------------------------------
function computeActualGameState(inputs) {
  const next = gameReducer(inputs.prev_state, inputs.action);
  // Return only the keys present in the row's expected_per_spec to allow
  // partial-match assertions. The generic runner uses toEqual; mismatch
  // shape makes assertion noisy, so we filter to what the row pins.
  const pinKeys = inputs.__pinKeys__ || ['actionSequence', 'currentStreet'];
  const out = {};
  for (const key of pinKeys) {
    if (key in next) out[key] = next[key];
  }
  return out;
}

// Each row implicitly pins keys present in its expected_per_spec. Compute
// once and stash on the inputs so computeActualGameState knows what to
// return. (Pure transformation; doesn't mutate fixtures.)
const standardRowsWithPinKeys = standardRows.map((r) => ({
  ...r,
  inputs: {
    ...r.inputs,
    __pinKeys__: Object.keys(r.expected_per_spec || {}),
  },
}));

// ---------------------------------------------------------------------------
// describe blocks
// ---------------------------------------------------------------------------
describe('gameReducer UNDO invariants — WS-122 / ICP-1', () => {
  describe('standard rows (via shared runner)', () => {
    runInvariantMatrix(
      standardRowsWithPinKeys,
      (inputs) => computeActualGameState(inputs),
      { minRows: 10 }
    );
  });

  describe('cross-coupling: UNDO does not mutate sibling slices', () => {
    it.each(crossCouplingRows)(
      '$id $scenario_label',
      (row) => {
        // Apply UNDO to gameReducer only.
        const nextGame = gameReducer(row.inputs.prev_state, row.inputs.action);

        // Assert game-state pin holds.
        for (const key of Object.keys(row.expected_per_spec)) {
          expect(nextGame[key]).toEqual(row.expected_per_spec[key]);
        }

        // Assert sibling slices are byte-identical (no spurious mutation).
        if (row.expected_sibling_invariants?.player_seatPlayers_unchanged) {
          // Confirm playerReducer does NOT listen to GAME_ACTIONS.UNDO_BATCH
          // or UNDO_LAST_ACTION. Use a real initial state merged with the
          // row's seatPlayers so the validated-reducer wrapper is happy.
          const playerPrev = {
            ...initialPlayerState,
            ...row.inputs.sibling_player_state,
          };
          const playerNext = playerReducer(playerPrev, row.inputs.action);
          expect(playerNext.seatPlayers).toEqual(playerPrev.seatPlayers);
        }

        if (row.expected_sibling_invariants?.ui_selectedPlayers_unchanged) {
          // Build a real initialUiState seeded with the row's selection so
          // the validated-reducer wrapper accepts the input.
          const uiPrev = {
            ...initialUiState,
            selectedPlayers: row.inputs.sibling_ui_selectedPlayers,
          };
          const uiNext = uiReducer(uiPrev, row.inputs.action);
          // Pin selectedPlayers value equality (createValidatedReducer may
          // produce a new wrapper object even on no-op).
          expect(uiNext.selectedPlayers).toEqual(uiPrev.selectedPlayers);
        }
      }
    );

    it('UI uiReducer.SET_SELECTION sanity (positive control)', () => {
      // Positive control: confirm uiReducer DOES respond to its own
      // actions, so the cross-coupling tests above are not false-passing
      // because uiReducer is broken or empty.
      const prev = { ...initialUiState, selectedPlayers: [3] };
      const next = uiReducer(prev, {
        type: UI_ACTIONS.SET_SELECTION,
        payload: [3, 5],
      });
      expect(next.selectedPlayers).toEqual([3, 5]);
    });
  });

  describe('regression pins requiring object-identity (toBe, not toEqual)', () => {
    it.each(sameRefRows)(
      '$id $scenario_label',
      (row) => {
        const next = gameReducer(row.inputs.prev_state, row.inputs.action);
        // Same-reference invariant: rejected UNDO returns the SAME state
        // object so React can skip re-renders. A future refactor that
        // returns `{...state}` would silently break this.
        expect(next).toBe(row.inputs.prev_state);
      }
    );
  });
});
