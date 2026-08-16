/**
 * modelReadinessStaleness.test.js — the gate must not report a STALE failure in silence.
 *
 * THE BUG THIS LOCKS. The Model Readiness Gate's stated design rule is that it never
 * reports a criterion as MET when it cannot verify it. That rule held. Nothing guarded the
 * inverse, and on 2026-08-16 the inverse was live:
 *
 *   - C3 was reported FAILING on `edge 12.042, CI low -7.597` — the 2026-07-28 smoke run,
 *     NINE contributing players — while `out/hero-ev-300p.json` had sat on disk since
 *     2026-08-07 reading `c3Passes: true, admissible: true, clusters: 278`.
 *   - C5 was reported FAILING on a 32-day protocol drift that three `protocol_run_completed`
 *     events had already healed.
 *
 * Nobody noticed for ~20 days, and the reason is structural rather than careless: a
 * criterion failing on superseded evidence looks EXACTLY like a criterion that is honestly
 * failing. There is no visible difference, so there is nothing to prompt a second look. The
 * scorecard is hand-appended, has no producer, and the SessionStart hook fails open by
 * design — so a gate frozen on stale rows is silent in every channel meant to report it.
 *
 * WHAT IS DELIBERATELY *NOT* TESTED HERE, because it must never be built: auto-adoption.
 * The detector may not change a verdict. `--record --from` stays the only path from an
 * artifact to the scorecard, and it still refuses inadmissible reports. A checker that
 * absorbed a number because it found a file would let the gate open as a side effect of
 * writing one — the silent-bar-move the gate doc forbids.
 */

import { describe, test, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { unrecordedHeroEvEvidence } from '../readiness/model-readiness.mjs';

/** A hero-EV artifact, shaped like the real one (verified against out/hero-ev-300p.json). */
const REGISTER = 'FR-1+bb7d37d9aeac';        // what the recorded row ran under
const OLD_REGISTER = 'FR-1+746d7b4aaea4';    // predates FAULT-untaxed-fold-branch

const artifact = ({ edge = 5.2623, ciLow = 2.1323, clusters = 278, admissible = true, complete = true, register = REGISTER } = {}) => ({
  report: {
    gate: {
      heroEvEdge: edge,
      heroEvCiLow: ciLow,
      corpusArmPasses: true,
      liveShiftedArmPasses: true,
      c3Passes: admissible && ciLow > 0,
      admissible,
      blockedBy: [],
      armsWouldPass: true,
    },
    admissibility: {
      admissible,
      blockers: admissible ? [] : [{ code: 'INCOMPLETE_RUN', detail: 'partial' }],
      warnings: [],
      clusters,
      minClustersForCI: 30,
      complete,
    },
    arms: { engineRaked: { players: clusters, edgeBB: edge } },
  },
  run: { replicationStamp: { disclaimerRegisterVersion: register } },
});

/** The stale scorecard row that was actually in front of the founder. */
const STALE_ROW = {
  heroEvEdge: 12.042, heroEvCiLow: -7.597, heroEvClusters: 9,
  disclaimerRegisterVersion: REGISTER,
};

let dir;
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'readiness-')); });
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const write = (name, obj) => writeFileSync(join(dir, name), JSON.stringify(obj));

describe('unrecordedHeroEvEvidence — the stale-failure detector', () => {
  test('flags an admissible artifact the scorecard has not been told about', () => {
    write('hero-ev-300p.json', artifact());

    const found = unrecordedHeroEvEvidence(STALE_ROW, dir);

    expect(found).toHaveLength(1);
    expect(found[0].file).toBe('out/hero-ev-300p.json');
    expect(found[0].clusters).toBe(278);
    expect(found[0].ciLow).toBeCloseTo(2.1323, 4);
  });

  test('stays silent once that artifact IS the recorded row', () => {
    write('hero-ev-300p.json', artifact());

    // Same numbers now in the scorecard — there is nothing left to look at.
    const recorded = {
      heroEvEdge: 5.2623, heroEvCiLow: 2.1323, heroEvClusters: 278,
      disclaimerRegisterVersion: REGISTER,
    };
    expect(unrecordedHeroEvEvidence(recorded, dir)).toHaveLength(0);
  });

  test('ignores a .partial snapshot — a partial must never look like evidence', () => {
    // The real partial says of itself: "PARTIAL SNAPSHOT — NOT a validated result."
    write('hero-ev-rebaseline.json.partial', artifact({ clusters: 75, ciLow: 2.945 }));

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir)).toHaveLength(0);
  });

  test('ignores an inadmissible report even when its CI looks great', () => {
    // The 2026-07-31 case: edge +16.72, CI [7.52, 23.42], from THREE players.
    write('hero-ev-killed.json', artifact({ edge: 16.72, ciLow: 7.52, clusters: 3, admissible: false }));

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir)).toHaveLength(0);
  });

  test('ignores an admissible artifact that would not clear the cluster bar', () => {
    write('hero-ev-thin.json', artifact({ clusters: 29 }));

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir)).toHaveLength(0);
  });

  test('ignores an admissible artifact whose CI still straddles zero', () => {
    write('hero-ev-wide.json', artifact({ edge: 12.042, ciLow: -7.597, clusters: 400 }));

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir)).toHaveLength(0);
  });

  test('strongest evidence first when several are unrecorded', () => {
    write('hero-ev-a.json', artifact({ clusters: 75 }));
    write('hero-ev-b.json', artifact({ clusters: 278 }));

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir).map((u) => u.clusters)).toEqual([278, 75]);
  });

  test('survives an unreadable directory and unparseable files — it can never break the gate', () => {
    writeFileSync(join(dir, 'hero-ev-corrupt.json'), '{not json');

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir)).toEqual([]);
    expect(unrecordedHeroEvEvidence(STALE_ROW, join(dir, 'does-not-exist'))).toEqual([]);
  });

  test('a null scorecard row does not crash the detector, and claims nothing', () => {
    write('hero-ev-300p.json', artifact());

    // No row means no register to compare against. Absence is not agreement.
    expect(unrecordedHeroEvEvidence(null, dir)).toEqual([]);
  });

  // ── The fault-register guard ───────────────────────────────────────────────────────
  //
  // This is the bug the FIRST version of this detector shipped with, caught within the
  // hour. It pointed at out/hero-ev-300p.json — edge 5.26, CI low +2.13, 278 players,
  // admissible — as evidence that a recorded FAILURE "may be stale". That artifact ran
  // under a register predating FAULT-untaxed-fold-branch, where the fold branch of every
  // postflop EV paid an unraked pot. The corrected run read edge 2.27, CI [-1.17, +5.56]
  // at MORE players. The old number was not better evidence; it was inflated by a fault,
  // and surfacing it would have argued the founder out of an honest failure.

  test('says nothing about an artifact from a DIFFERENT fault register', () => {
    write('hero-ev-300p.json', artifact({ edge: 5.2623, ciLow: 2.1323, register: OLD_REGISTER }));

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir)).toEqual([]);
  });

  test('says nothing when the artifact carries no register stamp at all', () => {
    write('hero-ev-unstamped.json', artifact({ register: null }));

    expect(unrecordedHeroEvEvidence(STALE_ROW, dir)).toEqual([]);
  });

  test('says nothing when the ROW carries no register stamp', () => {
    write('hero-ev-300p.json', artifact());
    const rowWithoutRegister = { heroEvEdge: 12.042, heroEvCiLow: -7.597, heroEvClusters: 9 };

    expect(unrecordedHeroEvEvidence(rowWithoutRegister, dir)).toEqual([]);
  });
});
