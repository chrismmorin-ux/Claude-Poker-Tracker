/**
 * actionInvariants.fixture.js — WS-001 / SPR-002 / Master Plan Phase 1 (TIA)
 *
 * Audit-only matrix of (active_seats × street × prior_action × hero_role × game_state)
 * → expected_action_options. Pinned per CommandStrip.jsx:317-328 and
 * actionUtils.js:103-108. Scenario labels follow Master Plan vocabulary even where
 * the production code's narrow decision surface (3 primitives) cannot compute them.
 *
 * Row schema:
 *   id              — stable INV-NNN
 *   scenario_label  — Master Plan vocabulary
 *   category        — preflop | postflop | special_state | edge_case
 *   inputs          — game-state snapshot (see actionInvariants.invariants.test.js
 *                     for the harness that consumes these)
 *   expected_per_spec — buttons the matrix says SHOULD render
 *   actual_today    — buttons the harness produces TODAY (null for spec_gap)
 *   status          — matches | pinned_bug | spec_gap | regression_pinned
 *   bug_id          — BUG-OWNER-N | null
 *   fixed_in        — commit SHA where regression was fixed (regression_pinned only)
 *   comment         — spec rationale, gap nature, or repro notes
 *
 * NEVER add a "fix" to this file. WS-001 is audit-only. WS-003 (fix wave) consumes
 * the bug_id rows and migrates them from pinned_bug → matches.
 */

import { PRIMITIVE_ACTIONS } from '../../../../constants/primitiveActions';

const { CHECK, BET, CALL, RAISE, FOLD } = PRIMITIVE_ACTIONS;

// ---------------------------------------------------------------------------
// Helper: build a minimal action-sequence entry. Order is global per-hand.
// ---------------------------------------------------------------------------
const act = (seat, action, street, order, amount = undefined) => {
  const e = { seat, action, street, order };
  if (amount !== undefined) e.amount = amount;
  return e;
};

export const fixtures = [
  // ===========================================================================
  // PREFLOP — single seat (matches the 3 owner-named contexts that DO derive
  // from primitives: open / facing-action / BB-option)
  // ===========================================================================
  {
    id: 'INV-P-001',
    scenario_label: 'preflop_open_BTN_9max',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [8],
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BTN open with no prior preflop action. CALL = limp; RAISE = open-raise.',
  },
  {
    id: 'INV-P-002',
    scenario_label: 'preflop_open_UTG_9max',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [3],
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'UTG open. Same as BTN — code does not differentiate by position.',
  },
  {
    id: 'INV-P-003',
    scenario_label: 'preflop_facing_open_CO',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [7],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'cold-call',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Cold-calling a UTG open from CO. RAISE = iso-raise. wouldBeColdCall in sequenceUtils:278 detects this but is NEVER called by CommandStrip — see INV-G-008 spec_gap.',
  },
  {
    id: 'INV-P-004',
    scenario_label: 'preflop_3bet_BTN_vs_HJ',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [8],
      actionSequence: [act(4, 'raise', 'preflop', 1, 4), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: '3bet',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: '3bet spot. Code returns same buttons as open — preflop_context is UI-only label per Agent-1 audit. No 3bet-specific gating in getValidActions.',
  },
  {
    id: 'INV-P-005',
    scenario_label: 'preflop_4bet_HJ_vs_BTN',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [4],
      actionSequence: [act(4, 'raise', 'preflop', 1, 4), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4), act(8, 'raise', 'preflop', 5, 12)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: '4bet',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: '4bet spot. HJ now faces 3bet. Same buttons.',
  },
  {
    id: 'INV-P-006',
    scenario_label: 'preflop_squeeze_CO_vs_HJ_BTN_caller',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [7],
      actionSequence: [act(4, 'raise', 'preflop', 1, 4), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(8, 'call', 'preflop', 4, 4)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'squeeze',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Squeeze spot. RAISE = squeeze. wouldBeSqueeze in sequenceUtils:364 detects this but is NEVER called by CommandStrip — see INV-G-009 spec_gap.',
  },
  {
    id: 'INV-P-007',
    scenario_label: 'preflop_limp_BTN',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [8],
      actionSequence: [act(3, 'call', 'preflop', 1, 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'limp',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BTN over-limp or iso-raise. CALL = over-limp; RAISE = iso. limp is normalized to call in actionSequence — cannot distinguish from a flat call after raise.',
  },
  {
    id: 'INV-P-008',
    scenario_label: 'preflop_iso_BTN_vs_limper',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [8],
      actionSequence: [act(3, 'call', 'preflop', 1, 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'iso',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Same code path as limp/over-limp. iso label exists nowhere in code per Agent-1.',
  },

  // ===========================================================================
  // PREFLOP — BB option (CALL → CHECK transform in CommandStrip:320-328)
  // ===========================================================================
  {
    id: 'INV-P-010',
    scenario_label: 'preflop_BB_option_unraised',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [1], // BB
      actionSequence: [act(3, 'call', 'preflop', 1, 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'call', 'preflop', 6, 1), act(9, 'fold', 'preflop', 7)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'blinds-completing',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CHECK, RAISE, FOLD],
    actual_today: [CHECK, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BB facing limpers, no raise. CALL→CHECK transform fires. CommandStrip:320-328 handles this OUTSIDE getValidActions.',
  },
  {
    id: 'INV-P-011',
    scenario_label: 'preflop_BB_facing_raise',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [1], // BB
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'fold', 'preflop', 6), act(9, 'fold', 'preflop', 7)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: '3bet',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BB facing a raise. CALL→CHECK transform suppressed by isBBOption check (a raise exists in actionSequence).',
  },
  {
    id: 'INV-P-012',
    scenario_label: 'preflop_SB_completing',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [9], // SB
      actionSequence: [act(3, 'call', 'preflop', 1, 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'fold', 'preflop', 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      smallBlindSeat: 9, // WS-129: required for SB-completing transform
      preflop_context: 'blinds-completing',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CHECK, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-129',
    comment: 'WS-129 fix wave: extended isBBOption transform to also fire for SB completing into limpers (no raise in preflop sequence). SB facing only limpers shows CHECK in UI semantics, mirroring BB option. CommandStrip.jsx isSBCompleting + isBBOption now share CALL→CHECK transform.',
  },

  // ===========================================================================
  // POSTFLOP — single seat, all 3 streets, both bet states
  // ===========================================================================
  {
    id: 'INV-O-001',
    scenario_label: 'flop_cbet_PFR_OOP',
    category: 'postflop',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [3],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'call', 'preflop', 6, 4), act(9, 'fold', 'preflop', 7), act(1, 'fold', 'preflop', 8)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: 'cbet',
      special_state: null,
    },
    expected_per_spec: [CHECK, BET, FOLD],
    actual_today: [CHECK, BET, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'PFR facing checked-around flop. cbet decision. Bet is the c-bet.',
  },
  {
    id: 'INV-O-002',
    scenario_label: 'flop_donk_OOP_caller',
    category: 'postflop',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [1], // BB caller acting first OOP
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'fold', 'preflop', 6), act(9, 'fold', 'preflop', 7), act(1, 'call', 'preflop', 8, 4)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: 'donk',
      special_state: null,
    },
    expected_per_spec: [CHECK, BET, FOLD],
    actual_today: [CHECK, BET, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BB caller acts first on flop. BET is the donk-lead.',
  },
  {
    id: 'INV-O-003',
    scenario_label: 'flop_facing_cbet_caller',
    category: 'postflop',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [1],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'fold', 'preflop', 6), act(9, 'fold', 'preflop', 7), act(1, 'call', 'preflop', 8, 4), act(1, 'check', 'flop', 9), act(3, 'bet', 'flop', 10, 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: 'float',
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BB caller faces cbet. Float = call; check-raise = raise.',
  },
  {
    id: 'INV-O-004',
    scenario_label: 'flop_check_raise',
    category: 'postflop',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [1],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(8, 'call', 'preflop', 2, 4), act(1, 'call', 'preflop', 3, 3), act(1, 'check', 'flop', 4), act(3, 'bet', 'flop', 5, 8), act(8, 'fold', 'flop', 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: 'check-raise',
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BB checked, PFR bet, BTN folded, action back on BB facing cbet. RAISE = check-raise.',
  },
  {
    id: 'INV-O-010',
    scenario_label: 'turn_probe_PFR_checked_back',
    category: 'postflop',
    inputs: {
      currentStreet: 'turn',
      selectedPlayers: [1],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(8, 'fold', 'preflop', 2), act(1, 'call', 'preflop', 3, 3), act(1, 'check', 'flop', 4), act(3, 'check', 'flop', 5)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: 'probe',
      special_state: null,
    },
    expected_per_spec: [CHECK, BET, FOLD],
    actual_today: [CHECK, BET, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Caller leads turn after PFR checked back flop = probe bet.',
  },
  {
    id: 'INV-O-011',
    scenario_label: 'turn_facing_bet_caller',
    category: 'postflop',
    inputs: {
      currentStreet: 'turn',
      selectedPlayers: [1],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(1, 'call', 'preflop', 2, 3), act(1, 'check', 'flop', 3), act(3, 'bet', 'flop', 4, 6), act(1, 'call', 'flop', 5, 6), act(1, 'check', 'turn', 6), act(3, 'bet', 'turn', 7, 14)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Caller faces double-barrel.',
  },
  {
    id: 'INV-O-020',
    scenario_label: 'river_value_bet_PFR',
    category: 'postflop',
    inputs: {
      currentStreet: 'river',
      selectedPlayers: [3],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(1, 'call', 'preflop', 2, 3), act(1, 'check', 'flop', 3), act(3, 'bet', 'flop', 4, 6), act(1, 'call', 'flop', 5, 6), act(1, 'check', 'turn', 6), act(3, 'bet', 'turn', 7, 14), act(1, 'call', 'turn', 8, 14), act(1, 'check', 'river', 9)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: 'value',
      special_state: null,
    },
    expected_per_spec: [CHECK, BET, FOLD],
    actual_today: [CHECK, BET, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'River triple-barrel value spot. BET option present.',
  },
  {
    id: 'INV-O-021',
    scenario_label: 'river_3bet_bluff',
    category: 'postflop',
    inputs: {
      currentStreet: 'river',
      selectedPlayers: [1],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(1, 'call', 'preflop', 2, 3), act(1, 'check', 'flop', 3), act(3, 'bet', 'flop', 4, 6), act(1, 'call', 'flop', 5, 6), act(1, 'check', 'turn', 6), act(3, 'bet', 'turn', 7, 14), act(1, 'call', 'turn', 8, 14), act(1, 'check', 'river', 9), act(3, 'bet', 'river', 10, 30), act(1, 'raise', 'river', 11, 90), act(3, 'raise', 'river', 12, 250)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: '3bet-bluff',
      special_state: null,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'BB faces a 4bet on river. Code returns same CALL/RAISE/FOLD as facing the original bet — no all-in detection. See INV-S-003 (all-in spec_gap).',
  },

  // ===========================================================================
  // MULTI-SEAT SCENARIOS
  // ===========================================================================
  {
    id: 'INV-M-001',
    scenario_label: 'multi_preflop_two_seats',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [4, 5],
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, FOLD],
    actual_today: [CALL, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Multi-seat preflop = batch fold-or-call. No CHECK (BB forced bet), no per-seat RAISE (no per-seat sizing UI).',
  },
  {
    id: 'INV-M-002',
    scenario_label: 'multi_postflop_no_bet_two_seats',
    category: 'postflop',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [4, 5],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'call', 'preflop', 2, 4), act(5, 'call', 'preflop', 3, 4), act(8, 'fold', 'preflop', 4), act(9, 'fold', 'preflop', 5), act(1, 'fold', 'preflop', 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CHECK, FOLD],
    actual_today: [CHECK, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Multi-seat postflop, no prior bet. Batch check-or-fold. RT-2026-04-27 fix dd9b266 ensured CHECK only appears when actually legal.',
  },
  {
    id: 'INV-M-003',
    scenario_label: 'multi_postflop_facing_bet',
    category: 'postflop',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [4, 5],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'call', 'preflop', 2, 4), act(5, 'call', 'preflop', 3, 4), act(8, 'fold', 'preflop', 4), act(3, 'bet', 'flop', 5, 12)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, FOLD],
    actual_today: [CALL, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Multi-seat facing a bet. Call-or-fold. CHECK correctly absent (RT-dd9b266).',
  },
  {
    id: 'INV-M-004',
    scenario_label: 'multi_BB_included_in_selection_unraised',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [1, 9], // BB + SB
      actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'fold', 'preflop', 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'HU',
    },
    expected_per_spec: [CALL, FOLD],
    actual_today: [CALL, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Multi-seat selection that includes BB. isBBOption suppressed (multi-seat). BB cannot fold for free even though no raise.',
  },
  {
    id: 'INV-M-005',
    scenario_label: 'multi_postflop_seats_at_different_action_points',
    category: 'postflop',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [4, 5],
      // Seat 4 has already bet flop; seat 5 has not acted yet on flop
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'call', 'preflop', 2, 4), act(5, 'call', 'preflop', 3, 4), act(1, 'fold', 'preflop', 4), act(4, 'bet', 'flop', 5, 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, FOLD], // for the seat that hasn't acted; seat 4 (the bettor) should be UNSELECTABLE
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'Owner-predicted "more examples" candidate. Multi-seat selection with mixed action state: seat 4 has bet this street, seat 5 has not. The button SET ([CALL, FOLD]) is correct for seat 5, but seat 4 cannot CALL its own bet. The audit surfaces a missing per-seat-applicability dimension — selection eligibility validation does not exist. Batch button decision is single-axis; per-seat action history is not consulted. WS-003 + a follow-on may need to introduce per-seat selection guards.',
  },

  // ===========================================================================
  // SPECIAL STATES — most are spec_gap (code does not compute these)
  // ===========================================================================
  {
    id: 'INV-S-001',
    scenario_label: 'HU_preflop_BTN_acts_first',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [8], // BTN/SB in HU
      actionSequence: [],
      absentSeats: [2, 3, 4, 5, 6, 7],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: 'HU',
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'HU preflop. BTN is SB and acts first. Same buttons as 9-handed — code has no HU-specific handling per Agent-1.',
  },
  {
    id: 'INV-S-002',
    scenario_label: 'HU_postflop_BB_acts_first',
    category: 'special_state',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [1], // BB in HU
      actionSequence: [act(8, 'call', 'preflop', 1, 1), act(1, 'check', 'preflop', 2)],
      absentSeats: [2, 3, 4, 5, 6, 7],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'HU',
    },
    expected_per_spec: [CHECK, BET, FOLD],
    actual_today: [CHECK, BET, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'HU postflop. BB acts first. Standard buttons.',
  },
  {
    id: 'INV-S-003',
    scenario_label: 'all_in_facing_shove',
    category: 'special_state',
    inputs: {
      currentStreet: 'turn',
      selectedPlayers: [1],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(1, 'call', 'preflop', 2, 3), act(1, 'check', 'flop', 3), act(3, 'bet', 'flop', 4, 50)], // suppose villain has shoved
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'all-in',
    },
    expected_per_spec: [CALL, FOLD], // Cannot RAISE if villain is all-in
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'All-in detection MISSING. potCalculator.js does not track stack sizes. getValidActions returns [CALL, RAISE, FOLD] regardless — RAISE is illegal facing an all-in shove. Audit signal: introduce all-in awareness as part of WS-003 fix wave or a follow-on.',
  },
  {
    id: 'INV-S-004',
    scenario_label: 'all_in_hero_short_stack',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [3], // hero has only 2bb left
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: 'all-in',
    },
    expected_per_spec: ['SHOVE', FOLD], // No CALL/RAISE distinction when shoving is the only raise
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'Hero short-stack push-fold. Code has no SHOVE primitive; RAISE is the only path. Stack-aware shove labeling is missing.',
  },
  {
    id: 'INV-S-005',
    scenario_label: 'dead_money_BB_left_table',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [3],
      actionSequence: [],
      absentSeats: [1], // BB seat marked absent AFTER blind posted
      dealerButtonSeat: 8,
      bigBlindSeat: 1, // BB still owes the blind
      preflop_context: 'open',
      postflop_context: null,
      special_state: 'dead-money-blinds',
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: null,
    status: 'spec_gap',
    bug_id: null,
    comment: 'Dead-money blinds: BB seat absent BUT blind already posted (dead money in pot). Code path: getBigBlindSeat skips absent seats per seatUtils:50-64 — would return next active seat as BB, losing the dead-money fact. No way to record "seat absent but their blind is in the pot."',
  },
  {
    id: 'INV-S-006',
    scenario_label: 'sit_out_seat_in_orbit',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [4], // selecting non-absent seat
      actionSequence: [act(3, 'fold', 'preflop', 1)],
      absentSeats: [5], // seat 5 is sitting out
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'sit-out',
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    comment: 'Sit-out handled via absentSeats. Selected seat 4 (active) renders normally. Seat 5 skipped from action queue (seatUtils:75-106). One of the few special_states the code DOES handle.',
  },
  {
    id: 'INV-S-007',
    scenario_label: 'straddle_UTG_unraised',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [4], // first to act after UTG straddle
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 3, // UTG = seat 3 (fixture convention; harness injects STRADDLE entry)
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'WS-002 straddle wave: STRADDLE primitive added; harness injects entry from straddler_seat. UTG straddler posted; hero=4 (UTG+1) is first to act, faces the $2 effective bet. CALL = call straddle; RAISE = open-raise; FOLD = give up. Identical button shape to a non-straddle open.',
  },
  {
    id: 'INV-S-008',
    scenario_label: 'straddle_BB_facing_straddle_no_raise',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [1], // BB facing UTG straddle, action folded around
      actionSequence: [act(4, 'fold', 'preflop', 1), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4), act(8, 'fold', 'preflop', 5), act(9, 'fold', 'preflop', 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 3,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'WS-002 straddle wave: isBBOption now uses noPreflopAggression (excludes straddle). BB facing a posted straddle sees [CALL, RAISE, FOLD] — straddle is the effective last raise, so CHECK is illegal. INV-S-015 pins the symmetric BTN-scope.',
  },
  {
    id: 'INV-S-009',
    scenario_label: 'mucked_seat_post_showdown',
    category: 'special_state',
    inputs: {
      currentStreet: 'showdown',
      selectedPlayers: [3],
      actionSequence: [act(3, 'mucked', 'showdown', 99)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [], // showdown street should not render betting buttons at all
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-129',
    comment: 'WS-129 fix wave: getValidActions now returns [] when street === "showdown". Defense-in-depth — CommandStrip-level guards still exist but the primitive no longer returns illegal options.',
  },

  // ===========================================================================
  // STRADDLE COVERAGE — WS-002 / SPR-010 / Master Plan Phase 1 close-out
  //
  // Scope decided 2026-05-02 (WS-002 owner answer):
  //   - Straddle allowed from UTG or BTN only (narrowed Mississippi)
  //   - Permanent (table-rule) AND optional (per-hand) modes both supported
  //   - UTG > BTN precedence: if both seats want to straddle, only UTG posts
  //   - Re-straddle NOT in scope
  //
  // Action-order rule: straddler acts LAST preflop (after BB). Straddler
  // has an option-to-raise analogous to BB option, on a 2× BB pot where
  // their own posted blind is the effective last "raise".
  //
  // All rows below status='spec_gap' because PRIMITIVE_ACTIONS has no
  // STRADDLE constant and actionSequence has no representation of a posted
  // straddle. Harness skips via it.skip.each — these rows author SPEC for
  // a future fix wave.
  //
  // Production code paths to address in the fix wave:
  //   - PRIMITIVE_ACTIONS (constants/primitiveActions.js): add STRADDLE
  //     constant
  //   - actionSequence: represent posted straddle as preflop entry order 0,
  //     seat = UTG-or-BTN, action = STRADDLE
  //   - sequenceUtils.getNextSeat: straddler acts last preflop after BB
  //   - actionUtils.getValidActions / CommandStrip.isBBOption: BB facing
  //     straddle must see [CALL, RAISE, FOLD], NOT [CHECK, RAISE, FOLD]
  //   - potCalculator: starting pot includes 2× BB straddle posted blind
  //   - Game config (gameTypes / settings persistence): straddleMode flag
  //     'off' | 'utg-only' | 'btn-only' | 'utg-or-btn-with-utg-precedence'
  //   - UI: TableHeader straddle indicator; SeatComponent straddler tag
  // ===========================================================================
  {
    id: 'INV-S-010',
    scenario_label: 'straddle_UTG_hero_BTN_no_raise',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [8],
      actionSequence: [act(4, 'fold', 'preflop', 1), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 3,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'BTN facing UTG straddle, all middle seats folded. Same shape as INV-S-007 — once everyone folds, BTN inherits the open option. Position-independent on the open spot.',
  },
  {
    id: 'INV-S-011',
    scenario_label: 'straddle_UTG_hero_SB_no_raise',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [9],
      actionSequence: [act(4, 'fold', 'preflop', 1), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4), act(8, 'fold', 'preflop', 5)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 3,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'SB facing UTG straddle, action folded around. WS-002: isSBCompleting now uses noPreflopAggression (excludes straddle), so SB facing a posted straddle correctly sees [CALL, RAISE, FOLD] — completing the straddle is the same shape as facing any open.',
  },
  {
    id: 'INV-S-012',
    scenario_label: 'straddle_UTG_straddler_option_unraised',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [3],
      actionSequence: [act(4, 'fold', 'preflop', 1), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4), act(8, 'fold', 'preflop', 5), act(9, 'call', 'preflop', 6, 2), act(1, 'call', 'preflop', 7, 1)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 3,
    },
    expected_per_spec: [CHECK, RAISE, FOLD],
    actual_today: [CHECK, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'WS-002: new isStraddlerOption guard fires when hero === straddler && noPreflopRaise. UTG straddler last-action option produces [CHECK, RAISE, FOLD] — analogous to BB option, since the straddler\'s own posted blind is the effective last raise.',
  },
  {
    id: 'INV-S-013',
    scenario_label: 'straddle_UTG_straddler_facing_3bet',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [3],
      actionSequence: [act(4, 'fold', 'preflop', 1), act(5, 'raise', 'preflop', 2, 8), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4), act(8, 'fold', 'preflop', 5), act(9, 'fold', 'preflop', 6), act(1, 'fold', 'preflop', 7)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 3,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'UTG straddler facing a raise after their posted blind. Standard facing-action button shape (CALL/RAISE/FOLD); isStraddlerOption does NOT fire because noPreflopRaise=false. Action-order rule (straddler acts LAST regardless of seat order) is enforced by getFirstActionSeat skipping the straddler — Sprint A2 surfaces it visibly via TableHeader/SeatComponent.',
  },
  {
    id: 'INV-S-014',
    scenario_label: 'straddle_BTN_hero_UTG_open',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [3],
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 8,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'BTN straddle, UTG (hero seat 3) opens — first to act preflop. CALL = limp into the BTN straddle. The action-order tail (BTN straddler closes after BB) is enforced upstream in getFirstActionSeat / getNextActionSeat — the button shape itself is unchanged.',
  },
  {
    id: 'INV-S-015',
    scenario_label: 'straddle_BTN_hero_BB_no_raise',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [1],
      actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(9, 'fold', 'preflop', 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 8,
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'WS-002: BTN straddle, BB facing the extra blind. isBBOption now uses noPreflopAggression (excludes straddle) — symmetric BTN-scope close of the bug class first pinned at INV-S-008. CHECK no longer renders.',
  },
  {
    id: 'INV-S-016',
    scenario_label: 'straddle_BTN_straddler_option_unraised',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [8],
      actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(9, 'call', 'preflop', 6, 2), act(1, 'call', 'preflop', 7, 1)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 8,
    },
    expected_per_spec: [CHECK, RAISE, FOLD],
    actual_today: [CHECK, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'BTN straddler last-action option, symmetric to INV-S-012. WS-002: isStraddlerOption keys off "hero === straddler", so it fires for both UTG and BTN straddle scopes uniformly.',
  },
  {
    id: 'INV-S-017',
    scenario_label: 'straddle_precedence_UTG_wins_over_BTN',
    category: 'special_state',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [4],
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'open',
      postflop_context: null,
      special_state: 'straddle',
      straddler_seat: 3, // UTG wins precedence; BTN does NOT post (single STRADDLE entry)
    },
    expected_per_spec: [CALL, RAISE, FOLD],
    actual_today: [CALL, RAISE, FOLD],
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-002',
    comment: 'PRECEDENCE pin (owner decision 2026-05-02): config = optional, both UTG (seat 3) and BTN (seat 8) wanted to straddle. Per UTG > BTN rule, only UTG posts. straddler_seat=3 (single entry). Pot = SB + BB + UTG straddle (no BTN extra blind). UTG+1 (hero seat 4) first to act — identical button shape to INV-S-007. The Sprint A2 UX layer must enforce single-straddle-per-hand at write time so this row stays a match, not a regression.',
  },

  // ===========================================================================
  // EDGE CASES
  // ===========================================================================
  {
    id: 'INV-E-001',
    scenario_label: 'no_seat_selected',
    category: 'edge_case',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [],
      actionSequence: [],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [], // CommandStrip:696 guards: do not render if selectedPlayers empty
    actual_today: [],
    status: 'matches',
    bug_id: null,
    comment: 'Empty selection. Harness mirrors CommandStrip guard.',
  },
  {
    id: 'INV-E-002',
    scenario_label: 'seat_already_folded_selected',
    category: 'edge_case',
    inputs: {
      currentStreet: 'flop',
      selectedPlayers: [3],
      actionSequence: [act(3, 'fold', 'preflop', 1)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [], // folded seats cannot act
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-129',
    comment: 'WS-129 fix wave: CommandStrip now guards via hasSeatFolded(actionSequence, singleSelectedSeat) — re-selecting a folded seat returns rawValidActions=[] before any transform. Defense-in-depth (SeatComponent may also guard tap-handler).',
  },
  {
    id: 'INV-E-003',
    scenario_label: 'all_seats_folded_to_one',
    category: 'edge_case',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [3],
      // 8 folds (seats 1, 2, 4, 5, 6, 7, 8, 9) — only seat 3 remains active.
      actionSequence: [act(4, 'fold', 'preflop', 1), act(5, 'fold', 'preflop', 2), act(6, 'fold', 'preflop', 3), act(7, 'fold', 'preflop', 4), act(8, 'fold', 'preflop', 5), act(9, 'fold', 'preflop', 6), act(1, 'fold', 'preflop', 7), act(2, 'fold', 'preflop', 8)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [], // hand is over; only one seat remains
    status: 'matches',
    bug_id: null,
    fixed_in: 'WS-129',
    comment: 'WS-129 fix wave: CommandStrip now guards via activeSeatCount <= 1 — when only one active seat remains (uses hand-level survivor count, not street-level responder count), returns no buttons. Defense-in-depth (next-hand auto-advance may also fire).',
  },

  // ===========================================================================
  // OWNER-REPORTED REGRESSIONS (Master Plan §B line 94, reported 2026-04-30)
  // Both believed fixed pre-audit. Pinned to ensure they stay fixed.
  // ===========================================================================
  {
    id: 'INV-R-001',
    scenario_label: 'BUG-OWNER-1_multi_seat_illegal_check',
    category: 'special_state',
    inputs: {
      // Owner report: "check option appearing for a seat when two players were
      // selected and it shouldn't have been available." Reported 2026-04-30.
      // Likely repro: postflop multi-seat with bet — pre-fix returned CHECK.
      currentStreet: 'flop',
      selectedPlayers: [4, 5],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'call', 'preflop', 2, 4), act(5, 'call', 'preflop', 3, 4), act(1, 'fold', 'preflop', 4), act(3, 'bet', 'flop', 5, 8)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CALL, FOLD],
    actual_today: [CALL, FOLD],
    status: 'regression_pinned',
    bug_id: 'BUG-OWNER-1',
    fixed_in: 'dd9b266',
    comment: 'Owner-reported 2026-04-30. Best-known repro per commit dd9b266 fix description: pre-fix multi-seat returned [CHECK, CALL, FOLD] regardless of bet state. Post-fix asserts [CALL, FOLD] facing a bet. Note: the reported scenario may be a DIFFERENT multi-seat CHECK case the dd9b266 fix did not cover — see INV-M-005 for owner-predicted "more examples" candidate.',
  },
  {
    id: 'INV-R-002',
    scenario_label: 'BUG-OWNER-2_post_fold_bet_missing',
    category: 'edge_case',
    inputs: {
      // Owner report: "after a fold, next-to-act seat lost ability to bet."
      // Repro: postflop multi-way, no prior bet, one seat folds, action moves
      // to next seat — buttons should still include BET.
      currentStreet: 'flop',
      selectedPlayers: [5],
      actionSequence: [act(3, 'raise', 'preflop', 1, 4), act(4, 'call', 'preflop', 2, 4), act(5, 'call', 'preflop', 3, 4), act(1, 'fold', 'preflop', 4), act(3, 'check', 'flop', 5), act(4, 'fold', 'flop', 6)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: null,
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CHECK, BET, FOLD],
    actual_today: [CHECK, BET, FOLD],
    status: 'regression_pinned',
    bug_id: 'BUG-OWNER-2',
    fixed_in: 'unknown',
    comment: 'Owner-reported 2026-04-30. After seat 4 folds postflop with no bet, seat 5 should retain BET. Today the harness produces [CHECK, BET, FOLD] — the fold does not corrupt hasBet. If this assertion ever fails, BUG-OWNER-2 has regressed. Cannot identify a specific fix commit; possibly never broken at the getValidActions level — owner may have observed it via a different surface (ControlZone/orbit-tap/SeatComponent guard).',
  },

  // ===========================================================================
  // COMMIT-HISTORY REGRESSION PINS (additional "would-have-caught-it" evidence)
  // ===========================================================================
  {
    id: 'INV-R-010',
    scenario_label: 'RT-c52318b_BB_check_option_not_call',
    category: 'preflop',
    inputs: {
      currentStreet: 'preflop',
      selectedPlayers: [1], // BB
      actionSequence: [act(3, 'fold', 'preflop', 1), act(4, 'fold', 'preflop', 2), act(5, 'fold', 'preflop', 3), act(6, 'fold', 'preflop', 4), act(7, 'fold', 'preflop', 5), act(8, 'fold', 'preflop', 6), act(9, 'call', 'preflop', 7, 1)],
      absentSeats: [],
      dealerButtonSeat: 8,
      bigBlindSeat: 1,
      preflop_context: 'blinds-completing',
      postflop_context: null,
      special_state: null,
    },
    expected_per_spec: [CHECK, RAISE, FOLD],
    actual_today: [CHECK, RAISE, FOLD],
    status: 'regression_pinned',
    bug_id: null,
    fixed_in: 'c52318b',
    comment: 'Commit c52318b (2026-03-20) fixed "BB gets CHECK (not CALL) when facing no raise preflop." Pre-fix: BB facing limpers saw CALL. Post-fix: isBBOption transform converts to CHECK. Pin asserts the transform still fires.',
  },
];

export default fixtures;
