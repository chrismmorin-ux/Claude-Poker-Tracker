/**
 * scenarioValidator.test.js — numeric-honesty gate for the scenario library.
 *
 * Iterates every scenario in scenarioLibrary.SCENARIOS, resolves its
 * archetype ranges, parses the board, runs the primary framework's
 * applies(), and asserts the returned subcase matches `expectedSubcase`.
 *
 * If a scenario's claim drifts outside its framework's band, this test
 * fails loudly with the scenario id and the computed-vs-expected subcases.
 *
 * Matches the pattern of preflopDrillContent/__tests__/frameworkValidator.test.js.
 */

import { describe, test, expect } from 'vitest';
import { SCENARIOS, parseFlopString } from '../scenarioLibrary';
import { archetypeRangeFor } from '../archetypeRanges';
import { FRAMEWORKS } from '../frameworks';
import { parseBoard } from '../../pokerCore/cardParser';

// Map framework id → the catalog entry (for lookup by scenario.primary).
const FRAMEWORK_BY_ID = {};
for (const fw of Object.values(FRAMEWORKS)) FRAMEWORK_BY_ID[fw.id] = fw;

describe('scenarioLibrary — every scenario classifies as expected', () => {
  for (const s of SCENARIOS) {
    test(`${s.id} → ${s.primary}/${s.expectedSubcase}`, () => {
      const fw = FRAMEWORK_BY_ID[s.primary];
      expect(fw, `framework ${s.primary} not registered`).toBeDefined();

      const range = archetypeRangeFor(s.context);
      const opposingRange = s.opposingContext ? archetypeRangeFor(s.opposingContext) : null;
      const board = parseBoard(parseFlopString(s.board));
      expect(board.length, `board '${s.board}' failed to parse`).toBe(3);

      const scenario = {
        range,
        opposingRange,
        board,
        context: s.context,
        opposingContext: s.opposingContext || null,
      };
      const match = fw.applies(scenario);
      expect(match, `${fw.id} did not apply to ${s.id}`).not.toBeNull();
      expect(
        match.subcase,
        `scenario ${s.id}: expected subcase '${s.expectedSubcase}', got '${match.subcase}'`,
      ).toBe(s.expectedSubcase);
    });
  }
});

describe('scenarioLibrary — structural', () => {
  test('every scenario has unique id', () => {
    const ids = SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('every primary framework id resolves', () => {
    for (const s of SCENARIOS) {
      expect(FRAMEWORK_BY_ID[s.primary], `${s.id}: unknown framework ${s.primary}`).toBeDefined();
    }
  });

  test('every expectedSubcase is declared by its framework', () => {
    for (const s of SCENARIOS) {
      const fw = FRAMEWORK_BY_ID[s.primary];
      const subcaseIds = fw.subcases.map((sc) => sc.id);
      expect(
        subcaseIds,
        `${s.id}: framework ${fw.id} does not declare subcase '${s.expectedSubcase}'`,
      ).toContain(s.expectedSubcase);
    }
  });
});
