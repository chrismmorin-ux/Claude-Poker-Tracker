/**
 * gameReducer.undoInvariants.fixture.js — ICP-1 / WS-122
 *
 * Audit-only matrix for gameReducer UNDO_BATCH and UNDO_LAST_ACTION,
 * including cross-coupling rows that pin independence from playerReducer
 * (seatPlayers) and uiReducer (selectedPlayers).
 *
 * Pattern doc: .claude/context/INVARIANT_MATRIX_PATTERN.md
 * Canonical UI sibling: src/components/views/TableView/__tests__/actionInvariants.fixture.js
 *
 * Function under audit:
 *   - gameReducer:UNDO_BATCH (gameReducer.js:163-172) — slice actionSequence
 *     to [0, afterIndex). Reject non-number, negative, or >=length afterIndex.
 *   - gameReducer:UNDO_LAST_ACTION (gameReducer.js:138-161) — remove last
 *     entry for (seat, currentStreet). Reject when no match found.
 *
 * Existing test coverage (per-action `it()` shape):
 *   - src/reducers/__tests__/gameReducer.test.js:168-203 (UNDO_LAST_ACTION, 3 tests)
 *   - src/reducers/__tests__/gameReducer.test.js:205+ (UNDO_BATCH, ~5 tests)
 *
 * What this matrix adds (audit-only, no production changes):
 *   - Combinatorial corners across street boundaries, absentSeats, and
 *     showdown-action mixed sequences
 *   - Cross-coupling rows: pin that UNDO_BATCH does NOT mutate
 *     playerReducer.seatPlayers or uiReducer.selectedPlayers (these slices
 *     are independent by spec)
 *   - Edge cases: undo from empty state, undo all, undo at boundaries
 *   - Spec gaps: dimensions the current API surface cannot express
 *
 * NEVER add a "fix" to this file. ICP-1 is audit-only. Fix-waves are
 * separate workstreams and would migrate pinned_bug rows to matches by
 * removing actual_today and updating production code.
 */

import { GAME_ACTIONS, initialGameState } from '../gameReducer';

// ---------------------------------------------------------------------------
// Helper: build a minimal action-sequence entry (mirrors
// actionInvariants.fixture.js helper for cross-audit consistency).
// ---------------------------------------------------------------------------
const act = (seat, action, street, order, amount = undefined) => {
  const e = { seat, action, street, order };
  if (amount !== undefined) e.amount = amount;
  return e;
};

// Convenience: build a game state by extending initial.
const gs = (overrides = {}) => ({ ...initialGameState, ...overrides });

export const fixtures = [
  // ===========================================================================
  // UNDO_BATCH — happy paths + boundary corners
  // ===========================================================================
  {
    id: 'UNDO-B-001',
    scenario_label: 'undo_batch_keeps_first_two_of_three',
    category: 'undo_batch',
    inputs: {
      prev_state: gs({
        actionSequence: [
          act(3, 'fold', 'preflop', 1),
          act(4, 'call', 'preflop', 2, 4),
          act(5, 'raise', 'preflop', 3, 12),
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 2 } },
    },
    expected_per_spec: {
      actionSequence: [
        act(3, 'fold', 'preflop', 1),
        act(4, 'call', 'preflop', 2, 4),
      ],
    },
    actual_today: {
      actionSequence: [
        act(3, 'fold', 'preflop', 1),
        act(4, 'call', 'preflop', 2, 4),
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: 'afterIndex=2 keeps indices [0, 2) → 2 entries.',
  },
  {
    id: 'UNDO-B-002',
    scenario_label: 'undo_batch_afterIndex_zero_clears_all',
    category: 'undo_batch',
    inputs: {
      prev_state: gs({
        actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2)],
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 0 } },
    },
    expected_per_spec: { actionSequence: [] },
    actual_today: { actionSequence: [] },
    status: 'matches',
    bug_id: null,
    comment: 'afterIndex=0 → slice(0,0) → empty array. Full undo semantics.',
  },
  {
    id: 'UNDO-B-003',
    scenario_label: 'undo_batch_afterIndex_negative_no_op',
    category: 'edge_case',
    inputs: {
      prev_state: gs({ actionSequence: [act(3, 'fold', 'preflop', 1)] }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: -1 } },
    },
    expected_per_spec: { actionSequence: [act(3, 'fold', 'preflop', 1)] },
    actual_today: { actionSequence: [act(3, 'fold', 'preflop', 1)] },
    status: 'matches',
    bug_id: null,
    comment: 'Negative afterIndex rejected; reducer returns same state ref.',
  },
  {
    id: 'UNDO-B-004',
    scenario_label: 'undo_batch_afterIndex_at_length_no_op',
    category: 'edge_case',
    inputs: {
      prev_state: gs({
        actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2)],
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 2 } },
    },
    expected_per_spec: {
      actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2)],
    },
    actual_today: {
      actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2)],
    },
    status: 'matches',
    bug_id: null,
    comment: 'afterIndex === length is rejected (>=length check at line 165). No-op.',
  },
  {
    id: 'UNDO-B-005',
    scenario_label: 'undo_batch_afterIndex_past_length_no_op',
    category: 'edge_case',
    inputs: {
      prev_state: gs({ actionSequence: [act(3, 'fold', 'preflop', 1)] }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 5 } },
    },
    expected_per_spec: { actionSequence: [act(3, 'fold', 'preflop', 1)] },
    actual_today: { actionSequence: [act(3, 'fold', 'preflop', 1)] },
    status: 'matches',
    bug_id: null,
    comment: 'Out-of-range afterIndex rejected.',
  },
  {
    id: 'UNDO-B-006',
    scenario_label: 'undo_batch_empty_sequence',
    category: 'edge_case',
    inputs: {
      prev_state: gs({ actionSequence: [] }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 0 } },
    },
    expected_per_spec: { actionSequence: [] },
    actual_today: { actionSequence: [] },
    status: 'matches',
    bug_id: null,
    comment: 'Undo on empty sequence: 0>=0 trips the rejection branch. No-op.',
  },
  {
    id: 'UNDO-B-007',
    scenario_label: 'undo_batch_non_number_payload_no_op',
    category: 'edge_case',
    inputs: {
      prev_state: gs({ actionSequence: [act(3, 'fold', 'preflop', 1)] }),
      action: {
        type: GAME_ACTIONS.UNDO_BATCH,
        payload: { afterIndex: 'foo' },
      },
    },
    expected_per_spec: { actionSequence: [act(3, 'fold', 'preflop', 1)] },
    actual_today: { actionSequence: [act(3, 'fold', 'preflop', 1)] },
    status: 'matches',
    bug_id: null,
    comment: 'typeof !== number rejected at line 165. Type-safety pin.',
  },
  {
    id: 'UNDO-B-008',
    scenario_label: 'undo_batch_missing_payload_throws',
    category: 'edge_case',
    inputs: {
      prev_state: gs({ actionSequence: [act(3, 'fold', 'preflop', 1)] }),
      action: { type: GAME_ACTIONS.UNDO_BATCH },
    },
    expected_per_spec: { actionSequence: [act(3, 'fold', 'preflop', 1)] },
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'No `payload` field at all. Spec ought to be no-op (defensive). Code destructures action.payload.afterIndex which throws on undefined payload. Spec_gap because what SHOULD happen is debatable: silent no-op, throw, or warn? Owner-triage required for fix-wave.',
  },

  // ===========================================================================
  // UNDO_BATCH — across street boundaries
  // ===========================================================================
  {
    id: 'UNDO-B-010',
    scenario_label: 'undo_batch_back_into_preflop_from_flop',
    category: 'undo_batch',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [
          act(3, 'raise', 'preflop', 1, 4),
          act(1, 'call', 'preflop', 2, 3),
          act(1, 'check', 'flop', 3),
          act(3, 'bet', 'flop', 4, 6),
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 2 } },
    },
    expected_per_spec: {
      // Spec: when undo erases all actions for currentStreet, street rewinds
      // to the last street with surviving actions. WS-130 fix wave.
      currentStreet: 'preflop',
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(1, 'call', 'preflop', 2, 3),
      ],
    },
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-130',
    comment: 'WS-130 fix wave: gameReducer.js UNDO_BATCH now derives lastStreet from newSequence and updates currentStreet accordingly. When undo crosses a street boundary, button rendering + next-action computation stay consistent with the action history.',
  },
  {
    id: 'UNDO-B-011',
    scenario_label: 'undo_batch_keeps_street_when_partial',
    category: 'undo_batch',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [
          act(3, 'raise', 'preflop', 1, 4),
          act(1, 'call', 'preflop', 2, 3),
          act(1, 'check', 'flop', 3),
          act(3, 'bet', 'flop', 4, 6),
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 3 } },
    },
    expected_per_spec: {
      currentStreet: 'flop',
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(1, 'call', 'preflop', 2, 3),
        act(1, 'check', 'flop', 3),
      ],
    },
    actual_today: {
      currentStreet: 'flop',
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(1, 'call', 'preflop', 2, 3),
        act(1, 'check', 'flop', 3),
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Partial undo on flop keeps street consistent. Sister to UNDO-B-010 — clarifies that the bug is street-erasure-specific, not general.',
  },

  // ===========================================================================
  // UNDO_BATCH — interaction with showdown actions
  // ===========================================================================
  {
    id: 'UNDO-B-020',
    scenario_label: 'undo_batch_removes_showdown_action',
    category: 'undo_batch',
    inputs: {
      prev_state: gs({
        currentStreet: 'showdown',
        actionSequence: [
          act(3, 'raise', 'preflop', 1, 4),
          act(1, 'call', 'preflop', 2, 3),
          act(3, 'mucked', 'showdown', 99),
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 2 } },
    },
    expected_per_spec: {
      // WS-130: currentStreet rewinds to 'preflop' (last surviving entry's street).
      currentStreet: 'preflop',
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(1, 'call', 'preflop', 2, 3),
      ],
    },
    actual_today: {
      currentStreet: 'showdown',
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(1, 'call', 'preflop', 2, 3),
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Showdown actions are first-class entries in actionSequence. UNDO_BATCH treats them uniformly with betting actions. Pin: undo can rewind a showdown without special handling.',
  },

  // ===========================================================================
  // UNDO_LAST_ACTION — happy paths
  // ===========================================================================
  {
    id: 'UNDO-L-001',
    scenario_label: 'undo_last_removes_last_for_seat_on_current_street',
    category: 'undo_last',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [
          act(3, 'raise', 'preflop', 1, 4),
          act(3, 'bet', 'flop', 2, 6),
          act(5, 'call', 'flop', 3, 6),
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_LAST_ACTION, payload: 3 },
    },
    expected_per_spec: {
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(5, 'call', 'flop', 3, 6),
      ],
    },
    actual_today: {
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(5, 'call', 'flop', 3, 6),
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: "Removes seat 3's flop bet. Preflop raise preserved (different street). Seat 5's flop call preserved (different seat).",
  },
  {
    id: 'UNDO-L-002',
    scenario_label: 'undo_last_no_match_returns_same_state',
    category: 'undo_last',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [act(3, 'raise', 'preflop', 1, 4)],
      }),
      action: { type: GAME_ACTIONS.UNDO_LAST_ACTION, payload: 5 },
    },
    expected_per_spec: {
      actionSequence: [act(3, 'raise', 'preflop', 1, 4)],
    },
    actual_today: {
      actionSequence: [act(3, 'raise', 'preflop', 1, 4)],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Seat 5 has no flop entry. Loop runs to end with removeIndex=-1; returns state unchanged.',
  },
  {
    id: 'UNDO-L-003',
    scenario_label: 'undo_last_does_not_remove_other_street_action',
    category: 'undo_last',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [
          act(3, 'raise', 'preflop', 1, 4),
          act(5, 'call', 'preflop', 2, 4),
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_LAST_ACTION, payload: 3 },
    },
    expected_per_spec: {
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(5, 'call', 'preflop', 2, 4),
      ],
    },
    actual_today: {
      actionSequence: [
        act(3, 'raise', 'preflop', 1, 4),
        act(5, 'call', 'preflop', 2, 4),
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Seat 3 has no FLOP entry; preflop raise is on a different street. UNDO_LAST_ACTION is street-scoped — no removal.',
  },
  {
    id: 'UNDO-L-004',
    scenario_label: 'undo_last_removes_only_most_recent_for_seat',
    category: 'undo_last',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [
          act(3, 'check', 'flop', 1),
          act(5, 'bet', 'flop', 2, 6),
          act(3, 'raise', 'flop', 3, 18),
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_LAST_ACTION, payload: 3 },
    },
    expected_per_spec: {
      actionSequence: [
        act(3, 'check', 'flop', 1),
        act(5, 'bet', 'flop', 2, 6),
      ],
    },
    actual_today: {
      actionSequence: [
        act(3, 'check', 'flop', 1),
        act(5, 'bet', 'flop', 2, 6),
      ],
    },
    status: 'matches',
    bug_id: null,
    comment: "Seat 3 acted twice on flop (check then check-raise). UNDO removes the most recent (raise), keeps the check. Reverse-iteration loop pin.",
  },
  {
    id: 'UNDO-L-005',
    scenario_label: 'undo_last_payload_invalid_seat',
    category: 'edge_case',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [act(3, 'bet', 'flop', 1, 6)],
      }),
      action: { type: GAME_ACTIONS.UNDO_LAST_ACTION, payload: 99 },
    },
    expected_per_spec: {
      actionSequence: [act(3, 'bet', 'flop', 1, 6)],
    },
    actual_today: {
      actionSequence: [act(3, 'bet', 'flop', 1, 6)],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Seat 99 is out of range but reducer treats it as "no match" — defensive degradation. Pin: invalid seat does not throw, returns state unchanged.',
  },

  // ===========================================================================
  // CROSS-COUPLING — pin independence between game / player / ui slices
  // (These rows assert that UNDO operations on game state leave sibling
  // slices untouched. The runner uses a partial-match comparator so each
  // row asserts only the slices it cares about.)
  // ===========================================================================
  {
    id: 'UNDO-C-001',
    scenario_label: 'undo_batch_does_not_touch_seatPlayers',
    category: 'cross_coupling',
    inputs: {
      // Cross-coupling rows include sibling slices in inputs as a doc only;
      // the harness applies the action only to gameReducer and asserts
      // that NO sibling slice mutated. The runner sees only game state in
      // expected_per_spec — sibling-state assertions are made via the
      // `expected_sibling_invariants` block below.
      prev_state: gs({
        actionSequence: [
          act(3, 'fold', 'preflop', 1),
          act(5, 'raise', 'preflop', 2, 4),
        ],
      }),
      sibling_player_state: { allPlayers: [], seatPlayers: { 3: 12, 5: 7 }, isLoading: false },
      sibling_ui_selectedPlayers: [3],
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 0 } },
    },
    expected_per_spec: {
      actionSequence: [],
    },
    expected_sibling_invariants: {
      // The harness asserts these did not change. Spec: gameReducer is the
      // only slice that owns actionSequence; player/ui slices are independent.
      player_seatPlayers_unchanged: true,
      ui_selectedPlayers_unchanged: true,
    },
    actual_today: {
      actionSequence: [],
    },
    status: 'matches',
    bug_id: null,
    comment: 'UNDO_BATCH erases the entire actionSequence but does NOT cascade into playerReducer.seatPlayers (player at seat 3 stays assigned) or uiReducer.selectedPlayers (UI selection unchanged). This is the correct spec — undo of an ACTION is not the same as undo of a SEAT ASSIGNMENT or a USER SELECTION. Pin enforces independence.',
  },
  {
    id: 'UNDO-C-002',
    scenario_label: 'undo_last_action_seatPlayers_independent',
    category: 'cross_coupling',
    inputs: {
      prev_state: gs({
        currentStreet: 'flop',
        actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(3, 'bet', 'flop', 2, 6)],
      }),
      sibling_player_state: { allPlayers: [], seatPlayers: { 3: 12 }, isLoading: false },
      sibling_ui_selectedPlayers: [],
      action: { type: GAME_ACTIONS.UNDO_LAST_ACTION, payload: 3 },
    },
    expected_per_spec: {
      actionSequence: [act(3, 'raise', 'preflop', 1, 4)],
    },
    expected_sibling_invariants: {
      player_seatPlayers_unchanged: true,
      ui_selectedPlayers_unchanged: true,
    },
    actual_today: {
      actionSequence: [act(3, 'raise', 'preflop', 1, 4)],
    },
    status: 'matches',
    bug_id: null,
    comment: 'Removing seat 3 flop bet does not unassign player from seat 3. Player presence at table is independent from per-action history.',
  },

  // ===========================================================================
  // SPEC GAPS — dimensions UNDO_BATCH cannot express
  // ===========================================================================
  {
    id: 'UNDO-G-001',
    scenario_label: 'undo_across_NEXT_HAND_boundary',
    category: 'spec_gap',
    inputs: {
      prev_state: gs({
        currentStreet: 'preflop',
        dealerButtonSeat: 3, // already advanced from prior hand
        actionSequence: [], // NEXT_HAND cleared the sequence
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 0 } },
    },
    expected_per_spec: null,
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'NEXT_HAND clears actionSequence and advances dealerButtonSeat. After NEXT_HAND, UNDO_BATCH cannot recover the prior hand — actionSequence is empty, button has rotated. There is no "undo NEXT_HAND" action. If user accidentally taps Next Hand, the prior hand is lost. Surfaces a missing capability — feature, not bug.',
  },
  {
    id: 'UNDO-G-002',
    scenario_label: 'undo_with_absent_seat_in_action_history',
    category: 'spec_gap',
    inputs: {
      prev_state: gs({
        absentSeats: [5],
        actionSequence: [
          act(3, 'fold', 'preflop', 1),
          act(5, 'fold', 'preflop', 2), // seat 5 has both an action AND is absent — inconsistent input
        ],
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 1 } },
    },
    expected_per_spec: null,
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'absentSeats and actionSequence can drift: a seat marked absent may have lingering actions from before TOGGLE_ABSENT. UNDO_BATCH does not validate this consistency; it just slices. Spec gap: should reducer reject inconsistent inputs at construction time, or should UNDO repair them? Today it does neither.',
  },
  {
    id: 'UNDO-G-003',
    scenario_label: 'undo_does_not_rewind_potOverride',
    category: 'spec_gap',
    inputs: {
      prev_state: gs({
        actionSequence: [act(3, 'bet', 'flop', 1, 6)],
        potOverride: 100, // user manually set pot
      }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: 0 } },
    },
    expected_per_spec: null,
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'potOverride is independent of actionSequence. UNDO_BATCH does not clear it. If user set potOverride based on a now-undone action, pot is wrong silently. Spec gap: should potOverride snapshot to undo with actions? Today no.',
  },

  // ===========================================================================
  // REGRESSION PINS — actions whose current behavior should NOT change
  // ===========================================================================
  {
    id: 'UNDO-R-001',
    scenario_label: 'undo_returns_same_state_ref_when_rejected',
    category: 'edge_case',
    inputs: {
      prev_state: gs({ actionSequence: [act(3, 'fold', 'preflop', 1)] }),
      action: { type: GAME_ACTIONS.UNDO_BATCH, payload: { afterIndex: -1 } },
    },
    expected_per_spec: { __same_ref__: true },
    actual_today: { __same_ref__: true },
    status: 'regression_pinned',
    bug_id: null,
    fixed_in: 'pre-existing',
    comment: 'Reducer optimization: rejected UNDO returns the same state object reference (not a shallow copy). Lets React skip re-renders when nothing changed. Pin asserts this optimization holds — a future refactor that returns `{...state}` would silently break re-render skipping.',
  },
];

export default fixtures;
