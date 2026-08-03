/**
 * entryCensus.test.js — WS-323. The zeros are the point.
 *
 * `calibrationMetrics.aggregateBySlice` groups OBSERVED rows only, so a context with no rows
 * never appears in its output and reads as absent-because-irrelevant rather than
 * absent-because-unmeasured. Those are opposite facts, and the Coverage Census exists to keep
 * them apart by enumerating the DECLARED DOMAIN and reporting every cell including the zeros.
 *
 * The measurement below is the one that corrected this ticket's own premise. WS-323 was filed
 * on the claim that the entry question is answerable on every folded hand — "no showdown
 * selection" — and the census is where that claim meets the corpus. It loses. A premise
 * corrected only in a commit message is a premise the next session re-adopts, so it is
 * corrected in an artifact, with numbers, and here in a test that would fail if the artifact
 * ever quietly started claiming otherwise.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { buildEntryCensus, censusHand, parseHandActions } from '../backtest/entryCensus.mjs';
import { checkAgainstSchema, SOR_SCHEMAS } from '../../src/utils/standardOfRecord/schemas.js';

/**
 * A two-hand corpus file in the corpus's own shape: hole cards MASKED at deal (`????`), one
 * seat revealing at showdown. This is not a simplification for the test — it is what every
 * file in the real corpus looks like, and it is the whole reason the premise fails.
 */
const PHHS = `[1]
actions = [
  'd dh p1 ????',
  'd dh p2 ????',
  'd dh p3 ????',
  'p3 f',
  'p1 cbr 300',
  'p2 cc',
  'd db 2h7c9s',
  'p1 sm AsKs',
]

[2]
actions = [
  'd dh p1 ????',
  'd dh p2 ????',
  'p1 f',
  'p2 cc',
]
`;

/** The corpus's own directory convention — `discoverCorpusFiles` ignores anything else. */
const CORPUS_DIR = 'PS-2009-07-01_2009-07-23_200NLH_OBFU';

let root;
beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'entry-census-'));
  mkdirSync(join(root, CORPUS_DIR), { recursive: true });
  writeFileSync(join(root, CORPUS_DIR, 'a.phhs'), PHHS);
});
afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('what the corpus can and cannot tell us about an entry cell', () => {
  it('counts each seat\'s FIRST preflop decision, and only its first', () => {
    // The entry question is "was it worth entering", which a seat answers once. A later
    // re-raise in the same hand is a different question and would double-count the seat.
    const tally = { decisions: 0, folds: 0, foldsAttributable: 0, entries: 0, entriesAttributable: 0 };
    for (const actions of parseHandActions(PHHS)) censusHand(actions, tally);
    expect(tally.decisions).toBe(5);   // 3 seats in hand 1, 2 in hand 2
    expect(tally.folds).toBe(2);
    expect(tally.entries).toBe(3);
  });

  it('stops at the flop — a postflop action is not an entry decision', () => {
    const tally = { decisions: 0, folds: 0, foldsAttributable: 0, entries: 0, entriesAttributable: 0 };
    censusHand([
      'd dh p1 ????', 'p1 cc', 'd db 2h7c9s', 'p1 cbr 100',
    ], tally);
    expect(tally.decisions).toBe(1);
  });

  it('attributes a folded hand to NO cell, because the cards were never shown', async () => {
    // This is the finding. Not "few", not "biased" — zero, at any sample size, ever.
    const census = await buildEntryCensus(['AA', 'AKs', '72o'], { root });
    expect(census.corpusAttribution.folds).toBeGreaterThan(0);
    expect(census.corpusAttribution.foldsAttributable).toBe(0);
    expect(census.corpusAttribution.foldsAttributablePct).toBe(0);
  });

  it('attributes only the entries that reached a showdown', async () => {
    // And says why that subset is not evidence: it is selected toward hands that got called
    // down, which biases it hardest in the fringe band the map exists to measure.
    const census = await buildEntryCensus(['AA', 'AKs', '72o'], { root });
    expect(census.corpusAttribution.entriesAttributable).toBe(1);
    expect(census.corpusAttribution.note).toMatch(/called down/);
  });
});

describe('three kinds of absence, kept apart', () => {
  it('reports every declared context including the ones with no hits', async () => {
    const census = await buildEntryCensus(['AA', 'AKs', '72o'], { root });
    // 3 classes x 5 position categories x 2 facing actions.
    expect(census.cells).toHaveLength(30);
    expect(census.totalContexts).toBe(30);
  });

  it('keeps structurally unreachable contexts out of the reachable count', async () => {
    // An unmeasured cell is a research queue; an unreachable one should never acquire a number
    // no matter how much compute is spent. Collapsing them makes the denominator wrong in both
    // directions. Unreachable = (EARLY x raise) + (BB x none), 3 classes each.
    const census = await buildEntryCensus(['AA', 'AKs', '72o'], { root });
    expect(census.unreachableContexts).toBe(6);
    expect(census.reachableContexts).toBe(24);
    expect(census.reachableContexts + census.unreachableContexts).toBe(census.totalContexts);
  });

  it('gives each unreachable cell its reason rather than just omitting it', async () => {
    const census = await buildEntryCensus(['AA'], { root });
    const utgVsRaise = census.cells.find((c) => c.cellId === 'AA|EARLY|raise');
    expect(utgVsRaise.reachable).toBe(false);
    expect(utgVsRaise.unreachableReason).toMatch(/utg-acts-first/);
  });
});

describe('the census is a WS-322 Coverage Census, not a bespoke shape', () => {
  it('validates against the registered schema', async () => {
    // A coverage record that answered to nothing could drift into saying whatever the run that
    // produced it found convenient.
    const census = await buildEntryCensus(['AA', 'AKs'], { root });
    const problems = checkAgainstSchema(census, SOR_SCHEMAS.coverageCensus, { label: 'coverageCensus' });
    expect(problems).toEqual([]);
  });
});
