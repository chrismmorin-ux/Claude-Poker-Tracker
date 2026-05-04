/**
 * invariantMatrix.js — shared runner for the Invariant Coverage Program (ICP).
 *
 * Codifies the matrix-fixture test pattern originated in SPR-002 / WS-001
 * (TableView action-availability audit). Authoritative pattern doc:
 * .claude/context/INVARIANT_MATRIX_PATTERN.md
 *
 * Usage:
 *
 *   import { describe, expect } from 'vitest';
 *   import { runInvariantMatrix } from '../../test/invariantMatrix';
 *   import { fixtures } from './myAudit.fixture.js';
 *
 *   describe('My audit — WS-NNN', () => {
 *     runInvariantMatrix(fixtures, (inputs) => computeActual(inputs));
 *   });
 *
 * The 4 statuses are exhaustive:
 *   matches            → assert actual === expected_per_spec
 *   pinned_bug         → assert actual === actual_today AND spec !== actual_today
 *   spec_gap           → it.skip with comment surfaced in test output
 *   regression_pinned  → assert actual === expected_per_spec (must stay fixed)
 *
 * Caller responsibility: provide computeActual(inputs) that runs the
 * production code path the row's inputs are meant to exercise. Mirroring
 * minimally and importing maximally is preferred — see pattern doc §"The
 * harness mirroring risk".
 */

import { describe, it, expect } from 'vitest';

const VALID_STATUSES = new Set([
  'matches',
  'pinned_bug',
  'spec_gap',
  'regression_pinned',
]);

/**
 * Run an invariant matrix audit.
 *
 * @param {Array} fixtures — array of fixture rows (see pattern doc for schema)
 * @param {Function} computeActual — (inputs) => actualOutput. Called for matches,
 *   pinned_bug, and regression_pinned rows. Not called for spec_gap.
 * @param {Object} [options]
 * @param {Function} [options.compare] — custom comparator(actual, expected).
 *   Defaults to expect(actual).toEqual(expected). Use for partial-match
 *   semantics on cross-coupling rows.
 * @param {number} [options.minRows=1] — assert fixtures.length >= minRows.
 *   Set when the audit has a meaningful coverage floor.
 */
export function runInvariantMatrix(fixtures, computeActual, options = {}) {
  const { compare, minRows = 1 } = options;

  // ---- Meta-tests (always run) -------------------------------------------
  it('fixture row count + status breakdown', () => {
    expect(fixtures.length).toBeGreaterThanOrEqual(minRows);
    const breakdown = countByStatus(fixtures);
    const sum =
      breakdown.matches +
      breakdown.pinned_bug +
      breakdown.spec_gap +
      breakdown.regression_pinned;
    // Catches typos in status field (e.g., 'matches ' or 'PinnedBug')
    expect(sum).toBe(fixtures.length);
  });

  it('every row has a unique id', () => {
    const ids = fixtures.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every row has a recognized status', () => {
    for (const row of fixtures) {
      expect(VALID_STATUSES.has(row.status)).toBe(true);
    }
  });

  // ---- Partition by status -----------------------------------------------
  const matchesRows = fixtures.filter((r) => r.status === 'matches');
  const pinnedBugRows = fixtures.filter((r) => r.status === 'pinned_bug');
  const specGapRows = fixtures.filter((r) => r.status === 'spec_gap');
  const regressionRows = fixtures.filter(
    (r) => r.status === 'regression_pinned'
  );

  const assertEqual = compare
    ? (actual, expected) => compare(actual, expected)
    : (actual, expected) => expect(actual).toEqual(expected);

  // ---- Status-specific suites --------------------------------------------
  if (matchesRows.length > 0) {
    describe('matches (spec === actual)', () => {
      it.each(matchesRows)('$id $scenario_label', (row) => {
        const actual = computeActual(row.inputs);
        assertEqual(actual, row.expected_per_spec);
      });
    });
  }

  if (pinnedBugRows.length > 0) {
    describe('pinned bugs (actual diverges from spec — fix-wave will close)', () => {
      it.each(pinnedBugRows)('$id $scenario_label [$bug_id]', (row) => {
        const actual = computeActual(row.inputs);
        // Lock current (broken) reality so any code change is detected.
        assertEqual(actual, row.actual_today);
        // Confirm spec divergence is real — guards against accidentally
        // flipping a pinned_bug to matches without removing actual_today.
        expect(row.expected_per_spec).not.toEqual(row.actual_today);
      });
    });
  }

  if (specGapRows.length > 0) {
    describe('spec gaps (code cannot compute scenario — structural finding)', () => {
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
          const actual = computeActual(row.inputs);
          assertEqual(actual, row.expected_per_spec);
        }
      );
    });
  }
}

/**
 * Count rows per status. Exposed for direct use in audit-summary tests
 * that want to assert specific breakdown shape (e.g., "this audit pins ≥2
 * regression rows from the failure library").
 */
export function countByStatus(fixtures) {
  return {
    matches: fixtures.filter((r) => r.status === 'matches').length,
    pinned_bug: fixtures.filter((r) => r.status === 'pinned_bug').length,
    spec_gap: fixtures.filter((r) => r.status === 'spec_gap').length,
    regression_pinned: fixtures.filter((r) => r.status === 'regression_pinned')
      .length,
  };
}
