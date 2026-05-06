/**
 * actionInvariants.invariants.test.js — WS-001 / SPR-002 audit runner
 *
 * Walks actionInvariants.fixture.js. Computes "what buttons render today" for
 * each row and asserts based on row.status:
 *
 *   matches            — actual must equal expected_per_spec
 *   pinned_bug         — actual must equal actual_today (records reality);
 *                        also asserts spec divergence is real
 *   spec_gap           — skipped via it.skip; surfaces in test output
 *   regression_pinned  — actual must equal expected_per_spec (must stay fixed)
 *
 * The test harness MIRRORS CommandStrip.jsx:317-328 logic. If harness diverges
 * from production rendering, the audit is silently invalidated. WS-003 fix-wave
 * should re-derive the harness from the actual code path it asserts against.
 *
 * Audit-only: NO PRODUCTION CODE CHANGES are made by this file or its fixture.
 */

import { describe, it, expect } from 'vitest';
import { fixtures } from './actionInvariants.fixture.js';
import { getValidActions } from '../../../../utils/actionUtils';
import { hasBetOrRaiseOnStreet, hasSeatFolded, getStraddler } from '../../../../utils/sequenceUtils';
import { PRIMITIVE_ACTIONS } from '../../../../constants/primitiveActions';

// ---------------------------------------------------------------------------
// Harness — mirrors CommandStrip.jsx button-decision pipeline.
// Source of truth: src/components/views/TableView/CommandStrip.jsx (post-WS-129
// fix wave: SB-completing transform + folded-seat guard + hand-over guard;
// post-WS-002 straddle wave: BB/SB option recognizes straddle as last raise +
// isStraddlerOption guard) + src/utils/actionUtils.js (showdown branch returns []).
// ---------------------------------------------------------------------------

// WS-002 straddle harness translation — fixture rows mark scenarios with
// special_state: 'straddle' + straddler_seat: <number>. PRIMITIVE_ACTIONS now
// has STRADDLE; we synthesize the actionSequence entry the production app would
// have recorded (preflop, order=1, action='straddle'). All other entries shift
// their order by +1 to preserve uniqueness.
function injectStraddleEntry(rawSequence, straddlerSeat) {
  const straddleEntry = {
    seat: straddlerSeat,
    action: PRIMITIVE_ACTIONS.STRADDLE,
    street: 'preflop',
    order: 1,
    amount: 2,
  };
  const shifted = (rawSequence || []).map((e) => ({ ...e, order: e.order + 1 }));
  return [straddleEntry, ...shifted];
}

function computeRenderedButtons(inputs) {
  const { currentStreet, selectedPlayers, bigBlindSeat,
          smallBlindSeat, special_state, straddler_seat } = inputs;

  // Translate special_state='straddle' into a real STRADDLE actionSequence entry.
  const actionSequence = special_state === 'straddle' && straddler_seat !== undefined
    ? injectStraddleEntry(inputs.actionSequence, straddler_seat)
    : inputs.actionSequence;

  // Empty selection renders nothing
  if (!selectedPlayers || selectedPlayers.length === 0) return [];

  const isMultiSeat = selectedPlayers.length > 1;
  const singleSelectedSeat = selectedPlayers.length === 1 ? selectedPlayers[0] : null;

  // WS-129 FOLDED-SEAT-ACTS guard — folded seat re-selected → no buttons
  const selectedSeatHasFolded = singleSelectedSeat
    ? hasSeatFolded(actionSequence, singleSelectedSeat)
    : false;

  // WS-129 HAND-OVER-BUTTONS guard — when only 0/1 active seat remains
  // (not absent, not folded across any street), hand is decided.
  // Compute activeSeatCount from inputs (mirrors useSeatUtils).
  const NUM_SEATS = 9;
  const absentSet = new Set(inputs.absentSeats || []);
  let activeSeatCount = 0;
  for (let s = 1; s <= NUM_SEATS; s++) {
    if (absentSet.has(s)) continue;
    if (hasSeatFolded(actionSequence, s)) continue;
    activeSeatCount++;
  }
  const handIsDecided = activeSeatCount <= 1;

  if (selectedSeatHasFolded || handIsDecided) return [];

  const hasBet = hasBetOrRaiseOnStreet(actionSequence, currentStreet);
  const rawValidActions = getValidActions(currentStreet, hasBet, isMultiSeat);

  // WS-129 SB-COMPLETING: SB completing into limpers gets the same CALL→CHECK
  // transform as BB option facing no raise.
  // WS-002 STRADDLE: a posted straddle counts as effective last raise — BB/SB
  // facing only a straddle do NOT get the CHECK transform. The straddler
  // themselves gets a parallel option when action returns unraised.
  const noPreflopRaise = !actionSequence.some(
    (e) => e.street === 'preflop' && e.action === 'raise'
  );
  const straddler = getStraddler(actionSequence);
  const noPreflopAggression = noPreflopRaise && straddler === null;
  const isBBOption =
    currentStreet === 'preflop' && !isMultiSeat &&
    selectedPlayers[0] === bigBlindSeat && noPreflopAggression;
  const isSBCompleting =
    currentStreet === 'preflop' && !isMultiSeat &&
    selectedPlayers[0] === smallBlindSeat && noPreflopAggression;
  const isStraddlerOption =
    currentStreet === 'preflop' && !isMultiSeat &&
    straddler !== null && selectedPlayers[0] === straddler && noPreflopRaise;

  const validActions = (isBBOption || isSBCompleting || isStraddlerOption)
    ? rawValidActions.map((a) =>
        a === PRIMITIVE_ACTIONS.CALL ? PRIMITIVE_ACTIONS.CHECK : a
      )
    : rawValidActions;

  return validActions;
}

// ---------------------------------------------------------------------------
// Partition fixtures by status. it.each requires non-empty arrays — guard
// each describe block.
// ---------------------------------------------------------------------------
const matchesRows = fixtures.filter((r) => r.status === 'matches');
const pinnedBugRows = fixtures.filter((r) => r.status === 'pinned_bug');
const specGapRows = fixtures.filter((r) => r.status === 'spec_gap');
const regressionRows = fixtures.filter((r) => r.status === 'regression_pinned');

describe('TableView action-availability invariants — WS-001 audit fixture', () => {
  it('fixture row count + status breakdown', () => {
    // Audit metadata assertion. Headline: the matrix exists at all.
    // Numbers should grow as WS-002/WS-003 iterate; keep this loose.
    expect(fixtures.length).toBeGreaterThanOrEqual(30);
    const breakdown = {
      total: fixtures.length,
      matches: matchesRows.length,
      pinned_bug: pinnedBugRows.length,
      spec_gap: specGapRows.length,
      regression_pinned: regressionRows.length,
    };
    // Sanity: every row has a recognized status.
    const sum =
      breakdown.matches +
      breakdown.pinned_bug +
      breakdown.spec_gap +
      breakdown.regression_pinned;
    expect(sum).toBe(breakdown.total);
    // Headline finding: at least 2 owner-named regressions are pinned.
    expect(regressionRows.some((r) => r.bug_id === 'BUG-OWNER-1')).toBe(true);
    expect(regressionRows.some((r) => r.bug_id === 'BUG-OWNER-2')).toBe(true);
  });

  it('every row has a unique id', () => {
    const ids = fixtures.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  if (matchesRows.length > 0) {
    describe('matches (spec === actual)', () => {
      it.each(matchesRows)('$id $scenario_label', (row) => {
        const actual = computeRenderedButtons(row.inputs);
        expect(actual).toEqual(row.expected_per_spec);
      });
    });
  }

  if (pinnedBugRows.length > 0) {
    describe('pinned bugs (actual diverges from spec — WS-003 will fix)', () => {
      it.each(pinnedBugRows)('$id $scenario_label [$bug_id]', (row) => {
        const actual = computeRenderedButtons(row.inputs);
        // Lock in current (broken) reality so any code change is detected.
        expect(actual).toEqual(row.actual_today);
        // Confirm spec divergence is real — protects against accidentally
        // flipping a pinned_bug to matches without removing actual_today.
        expect(row.expected_per_spec).not.toEqual(row.actual_today);
      });
    });
  }

  if (specGapRows.length > 0) {
    describe('spec gaps (code cannot compute scenario — surfaces structural finding)', () => {
      it.skip.each(specGapRows)(
        '$id $scenario_label — gap: $comment',
        () => {}
      );
    });
  }

  if (regressionRows.length > 0) {
    describe('regression pins (must stay fixed)', () => {
      it.each(regressionRows)(
        '$id $scenario_label [fixed in $fixed_in]',
        (row) => {
          const actual = computeRenderedButtons(row.inputs);
          expect(actual).toEqual(row.expected_per_spec);
        }
      );
    });
  }
});
