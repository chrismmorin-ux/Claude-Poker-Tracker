/**
 * WS-023 — Per-seed-anchor match drift CI (RT-108 pattern).
 *
 * Freezes the matcher's computed outputs for the 4 seed anchors so any engine
 * change that silently alters which anchors fire — or how their library
 * metadata derives — fails CI with a per-field diff. Complements the per-seed
 * Tier-1 scenario tests (WS-024), which exercise SIMULATOR behavior; this file
 * freezes MATCHER behavior against hand-authored canonical situations.
 *
 * Fields snapshotted (all deterministic — no Monte Carlo, no Date, no RNG):
 *   - per-anchor derived metadata (deriveStyle / deriveStreet / deriveTierKey)
 *     + the lineSequence itself (the seed definitions ARE the table advice)
 *   - 4×4 matchesAnchor cross-matrix: each canonical situation vs each anchor
 *     (catches cross-firing, e.g. a SEED-01 situation firing SEED-03)
 *   - getMatchingAnchors firing sets per situation: live default filter AND
 *     study-mode full allow-list (SEED-04 is status 'candidate' — its absence
 *     from every live set is correct red-line-#6 behavior, asserted below)
 *   - deriveLiveSituation bridge output per seed + the firing sets it produces
 *
 * The liveBridge section drives realistic chip-denominated hands (blinds 1/2,
 * community cards entered) through the full deriveLiveSituation → matcher
 * chain — freezing the end-to-end behavior the LiveAdviceBar badge depends
 * on: pot-fraction sizing conversion, per-street anchor-vocabulary boards,
 * and turn/river scareKind classification.
 *
 * To regenerate baseline after a deliberate engine revision:
 *   UPDATE_ANCHOR_DRIFT_SNAPSHOT=true npm test -- anchorMatchDrift
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getMatchingAnchors, matchesAnchor } from '../matcher';
import { deriveStyle, deriveStreet, deriveTierKey } from '../librarySelectors';
import { deriveLiveSituation } from '../deriveLiveSituation';

import { EAL_SEED_01_ANCHOR } from '../__sim__/scenarios/nitOverfoldRiver4flush';
import { EAL_SEED_02_ANCHOR } from '../__sim__/scenarios/lagOverbluffRiverProbe';
import { EAL_SEED_03_ANCHOR } from '../__sim__/scenarios/fishOvercallTurnDoubleBarrel';
import { EAL_SEED_04_ANCHOR } from '../__sim__/scenarios/tagOverfoldFlopDonk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, '__snapshots__', 'anchor-match-drift.json');

const ALL_STATUSES = ['active', 'expiring', 'retired', 'suppressed', 'candidate'];

// Fixed iteration order — seed number order, never reordered.
const SEED_ANCHORS = [
  { seedId: 'SEED-01', anchor: EAL_SEED_01_ANCHOR },
  { seedId: 'SEED-02', anchor: EAL_SEED_02_ANCHOR },
  { seedId: 'SEED-03', anchor: EAL_SEED_03_ANCHOR },
  { seedId: 'SEED-04', anchor: EAL_SEED_04_ANCHOR },
];

// ───────────────────────────────────────────────────────────────────────────
// Canonical situations — hand-authored to satisfy each anchor's lineSequence
// (matcher.js situation shape; sizing values are pot-fraction ratios). Every
// step with a boardCondition gets a board object on its entry — the matcher
// requires one even for texture 'any'.
// ───────────────────────────────────────────────────────────────────────────

const CANONICAL_SITUATIONS = [
  {
    seedId: 'SEED-01',
    situation: {
      villainStyle: 'Nit',
      actionHistory: {
        flop: { villainAction: { kind: 'call' }, board: { texture: 'wet' } },
        turn: { heroAction: { kind: 'bet', sizing: 0.75 }, villainAction: { kind: 'call' }, board: { texture: 'wet' } },
        river: { heroAction: { kind: 'bet', sizing: 1.2 }, board: { texture: 'flush-complete', scareKind: '4-flush' } },
      },
    },
  },
  {
    seedId: 'SEED-02',
    situation: {
      villainStyle: 'LAG',
      actionHistory: {
        flop: { heroAction: { kind: 'call' }, villainAction: { kind: 'bet', sizing: 0.6 }, board: { texture: 'dry' } },
        turn: { heroAction: { kind: 'check' }, villainAction: { kind: 'check' }, board: { texture: 'dry' } },
        river: { villainAction: { kind: 'bet', sizing: 0.72 }, board: { texture: 'dry' } },
      },
    },
  },
  {
    seedId: 'SEED-03',
    situation: {
      villainStyle: 'Fish',
      actionHistory: {
        flop: { heroAction: { kind: 'bet', sizing: 0.6 }, villainAction: { kind: 'call' }, board: { texture: 'paired' } },
        turn: { heroAction: { kind: 'bet', sizing: 0.7 }, board: { texture: 'paired' } },
      },
    },
  },
  {
    seedId: 'SEED-04',
    situation: {
      villainStyle: 'TAG',
      actionHistory: {
        preflop: { heroAction: { kind: 'call' }, villainAction: { kind: 'raise' } },
        flop: { heroAction: { kind: 'bet', sizing: 0.4 }, board: { texture: 'wet' } },
      },
    },
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Live-bridge fixtures — gameReducer-shaped hands in CHIP units (blinds 1/2,
// preflop starting pot 3). The bridge converts amounts to pot fractions and
// derives per-street boards from the community cards. Each fixture is a
// realistic line designed to satisfy its seed anchor's constraints end-to-end.
// ───────────────────────────────────────────────────────────────────────────

const HERO_SEAT = 1;
const VILLAIN_SEAT = 4;
const BLINDS = { sb: 1, bb: 2 };

const LIVE_BRIDGE_FIXTURES = [
  {
    // Flop monotone J♥T♥8♥ ('any' step), turn 4♦ wet, river 2♥ = 4-flush.
    // Hero turn bet 23/31 ≈ 0.74 ∈ [0.6,1.0]; river overbet 92/77 ≈ 1.19 ∈ [1.0,1.8].
    seedId: 'SEED-01',
    input: {
      currentStreet: 'river',
      heroSeat: HERO_SEAT,
      villainSeat: VILLAIN_SEAT,
      villainStyle: 'Nit',
      blinds: BLINDS,
      communityCards: ['J♥', 'T♥', '8♥', '4♦', '2♥'],
      actionSequence: [
        { seat: HERO_SEAT, street: 'preflop', action: 'raise', amount: 6 },
        { seat: VILLAIN_SEAT, street: 'preflop', action: 'call' },
        { seat: HERO_SEAT, street: 'flop', action: 'bet', amount: 8 },
        { seat: VILLAIN_SEAT, street: 'flop', action: 'call' },
        { seat: HERO_SEAT, street: 'turn', action: 'bet', amount: 23 },
        { seat: VILLAIN_SEAT, street: 'turn', action: 'call' },
        { seat: HERO_SEAT, street: 'river', action: 'bet', amount: 92 },
      ],
    },
  },
  {
    // All board steps 'any'. Villain flop bet 9/15 = 0.6 ∈ [0.5,0.75];
    // turn check-check; river probe 24/33 ≈ 0.73 ∈ [0.66,0.80].
    seedId: 'SEED-02',
    input: {
      currentStreet: 'river',
      heroSeat: HERO_SEAT,
      villainSeat: VILLAIN_SEAT,
      villainStyle: 'LAG',
      blinds: BLINDS,
      communityCards: ['K♠', '7♦', '2♣', '3♥', '9♣'],
      actionSequence: [
        { seat: VILLAIN_SEAT, street: 'preflop', action: 'raise', amount: 6 },
        { seat: HERO_SEAT, street: 'preflop', action: 'call' },
        { seat: VILLAIN_SEAT, street: 'flop', action: 'bet', amount: 9 },
        { seat: HERO_SEAT, street: 'flop', action: 'call' },
        { seat: HERO_SEAT, street: 'turn', action: 'check' },
        { seat: VILLAIN_SEAT, street: 'turn', action: 'check' },
        { seat: VILLAIN_SEAT, street: 'river', action: 'bet', amount: 24 },
      ],
    },
  },
  {
    // Paired flop 8♠8♦3♣, paired turn (K♦ overcard, no scare constraint).
    // Hero flop cbet 9/15 = 0.6 ∈ [0.5,0.67]; turn barrel 23/33 ≈ 0.70 ∈ [0.66,0.75].
    seedId: 'SEED-03',
    input: {
      currentStreet: 'turn',
      heroSeat: HERO_SEAT,
      villainSeat: VILLAIN_SEAT,
      villainStyle: 'Fish',
      blinds: BLINDS,
      communityCards: ['8♠', '8♦', '3♣', 'K♦', ''],
      actionSequence: [
        { seat: HERO_SEAT, street: 'preflop', action: 'raise', amount: 6 },
        { seat: VILLAIN_SEAT, street: 'preflop', action: 'call' },
        { seat: HERO_SEAT, street: 'flop', action: 'bet', amount: 9 },
        { seat: VILLAIN_SEAT, street: 'flop', action: 'call' },
        { seat: HERO_SEAT, street: 'turn', action: 'bet', amount: 23 },
      ],
    },
  },
  {
    // Wet connected flop 9♠8♠7♥; hero donk 6/15 = 0.4 ∈ [0.33,0.5] after
    // flatting villain's preflop raise. Candidate anchor — study-mode only.
    seedId: 'SEED-04',
    input: {
      currentStreet: 'flop',
      heroSeat: HERO_SEAT,
      villainSeat: VILLAIN_SEAT,
      villainStyle: 'TAG',
      blinds: BLINDS,
      communityCards: ['9♠', '8♠', '7♥', '', ''],
      actionSequence: [
        { seat: VILLAIN_SEAT, street: 'preflop', action: 'raise', amount: 6 },
        { seat: HERO_SEAT, street: 'preflop', action: 'call' },
        { seat: HERO_SEAT, street: 'flop', action: 'bet', amount: 6 },
      ],
    },
  },
];

// ───────────────────────────────────────────────────────────────────────────
// Snapshot builders
// ───────────────────────────────────────────────────────────────────────────

const allAnchors = SEED_ANCHORS.map(({ anchor }) => anchor);
const anchorIds = (matched) => matched.map((a) => a.id);

const buildAnchorMetadataSnapshot = () => SEED_ANCHORS.map(({ seedId, anchor }) => ({
  seedId,
  id: anchor.id,
  archetypeName: anchor.archetypeName,
  status: anchor.status,
  polarity: anchor.polarity,
  derivedStyle: deriveStyle(anchor),
  derivedStreet: deriveStreet(anchor),
  derivedTierKey: deriveTierKey(anchor),
  lineSequence: anchor.lineSequence,
}));

const buildCrossMatchSnapshot = () => {
  const rows = [];
  for (const { seedId: situationSeedId, situation } of CANONICAL_SITUATIONS) {
    for (const { seedId: anchorSeedId, anchor } of SEED_ANCHORS) {
      rows.push({
        situation: situationSeedId,
        anchor: anchorSeedId,
        matches: matchesAnchor(situation, anchor),
      });
    }
  }
  return rows;
};

const buildFiringSetsSnapshot = () => CANONICAL_SITUATIONS.map(({ seedId, situation }) => ({
  situation: seedId,
  live: anchorIds(getMatchingAnchors(situation, allAnchors)),
  studyMode: anchorIds(getMatchingAnchors(situation, allAnchors, { includeStatuses: ALL_STATUSES })),
}));

const buildLiveBridgeSnapshot = () => LIVE_BRIDGE_FIXTURES.map(({ seedId, input }) => {
  const derived = deriveLiveSituation(input);
  return {
    situation: seedId,
    derivedSituation: derived,
    live: anchorIds(getMatchingAnchors(derived, allAnchors)),
    studyMode: anchorIds(getMatchingAnchors(derived, allAnchors, { includeStatuses: ALL_STATUSES })),
  };
});

const buildFullSnapshot = () => ({
  schemaVersion: 1,
  generator: 'WS-023 per-seed-anchor match drift CI',
  anchors: buildAnchorMetadataSnapshot(),
  crossMatch: buildCrossMatchSnapshot(),
  firingSets: buildFiringSetsSnapshot(),
  liveBridge: buildLiveBridgeSnapshot(),
});

// ───────────────────────────────────────────────────────────────────────────

describe('WS-023 — per-seed-anchor match drift CI', () => {
  const current = buildFullSnapshot();

  it('covers all four seed anchors', () => {
    expect(current.anchors).toHaveLength(4);
    expect(current.crossMatch).toHaveLength(16);
  });

  it('each canonical situation matches its own anchor (fixture-rot guard)', () => {
    for (const row of current.crossMatch) {
      if (row.situation === row.anchor) {
        expect(row, `${row.situation} should match its own anchor`).toMatchObject({ matches: true });
      }
    }
  });

  it('candidate SEED-04 never fires on the live default filter (red line #6)', () => {
    const seed04Id = EAL_SEED_04_ANCHOR.id;
    for (const set of [...current.firingSets, ...current.liveBridge]) {
      expect(set.live).not.toContain(seed04Id);
    }
  });

  it('the live bridge fires each ACTIVE seed anchor on its canonical line (end-to-end)', () => {
    const byId = Object.fromEntries(current.liveBridge.map((b) => [b.situation, b]));
    expect(byId['SEED-01'].live).toContain(EAL_SEED_01_ANCHOR.id);
    expect(byId['SEED-02'].live).toContain(EAL_SEED_02_ANCHOR.id);
    expect(byId['SEED-03'].live).toContain(EAL_SEED_03_ANCHOR.id);
    // SEED-04 matches structurally but is status 'candidate' → study-mode only.
    expect(byId['SEED-04'].studyMode).toContain(EAL_SEED_04_ANCHOR.id);
  });

  it('matches stored baseline (drift signals matcher/selector/bridge change — review before regenerating)', () => {
    const shouldUpdate = process.env.UPDATE_ANCHOR_DRIFT_SNAPSHOT === 'true';
    const exists = fs.existsSync(SNAPSHOT_PATH);

    if (!exists || shouldUpdate) {
      fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2) + '\n');
      if (!exists) {
        // First-run baseline creation — not a regression.
        console.warn(`[WS-023] Baseline snapshot created at ${SNAPSHOT_PATH}`);
        return;
      }
      console.warn('[WS-023] Baseline snapshot UPDATED (UPDATE_ANCHOR_DRIFT_SNAPSHOT=true)');
      return;
    }

    const stored = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
    expect(current).toEqual(stored);
  });
});
