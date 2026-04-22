/**
 * RT-108 — Engine-vs-authored drift CI.
 *
 * Snapshots deterministic engine outputs for every decision node in every
 * authored line. When any engine constant or algorithm shifts (see MEMORY
 * Items 25-27 for the pattern), this test fails with a per-(lineId, nodeId,
 * field) diff — signaling the authored content in `lines.js` may need review.
 *
 * Fields snapshotted (all deterministic — no Monte Carlo):
 *   - villain-narrowed-range total combo count + capped flags
 *   - range-segmenter bucket percentages (nuts/strong/marginal/draw/air)
 *   - fold-curve response at a fixed (baseFold, betFraction) probe grid
 *   - sentinel engine constants (POP_CALLING_RATES baseline)
 *
 * To regenerate baseline after a deliberate engine revision:
 *   UPDATE_DRILL_DRIFT_SNAPSHOT=true npm test -- engineAuthoredDrift
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { LINES } from '../lines';
import { archetypeRangeFor } from '../archetypeRanges';
import { parseBoard } from '../../pokerCore/cardParser';
import { analyzeBoardTexture } from '../../pokerCore/boardTexture';
import { narrowByBoard } from '../../exploitEngine/postflopNarrower';
import { segmentRange } from '../../exploitEngine/rangeSegmenter';
import { logisticFoldResponse } from '../../exploitEngine/villainModelData';
import { POP_CALLING_RATES, POP_BETTING_RATES, BUCKET_EQUITY_ANCHORS } from '../../exploitEngine/gameTreeConstants';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SNAPSHOT_PATH = path.resolve(__dirname, '__snapshots__', 'engine-authored-drift.json');

const round = (n, digits = 4) => (Number.isFinite(n) ? Number(n.toFixed(digits)) : n);

// Fixed probe grid. Any of: fold-curve param change, style steepness change,
// midpoint shift — will move these numbers and fail the test.
const FOLD_CURVE_PROBES = [
  { baseFold: 0.50, fraction: 0.33 },
  { baseFold: 0.50, fraction: 0.50 },
  { baseFold: 0.50, fraction: 0.75 },
  { baseFold: 0.50, fraction: 1.00 },
  { baseFold: 0.70, fraction: 0.50 },
  { baseFold: 0.30, fraction: 1.50 },
];

const NARROW_ACTION_FOR = (kind) => {
  switch (kind) {
    case 'cbet': case 'donk': case 'bet': case 'raise': case 'checkraise':
      return 'bet';
    case 'call':
      return 'call';
    case 'check':
    default:
      return 'check';
  }
};

const buildNodeEntry = (line, node) => {
  // Only snapshot decision nodes — terminals have no teaching-EV payload.
  if (!node.decision) return null;
  if (!Array.isArray(node.board) || node.board.length === 0) return null;

  const villain = line.setup?.villains?.[0];
  if (!villain) return null;

  let preflopRange;
  try {
    preflopRange = archetypeRangeFor({
      position: villain.position,
      action: villain.action,
      vs: villain.vs,
    });
  } catch {
    // archetypeRanges doesn't cover this (position, action, vs) combo yet.
    // Skip — not a drift concern until the range is defined.
    return null;
  }
  if (!preflopRange) return null;

  let board;
  try {
    board = parseBoard(node.board);
  } catch {
    return null;
  }
  const boardTexture = analyzeBoardTexture(board);

  const actionKind = node.villainAction?.kind || 'check';
  const narrowAction = NARROW_ACTION_FOR(actionKind);
  const narrowed = narrowByBoard(preflopRange, narrowAction, board, [], { boardTexture });
  const seg = segmentRange(narrowed, board, [], boardTexture);

  return {
    lineId: line.id,
    nodeId: node.id,
    street: node.street,
    board: [...node.board],
    villainAction: actionKind,
    narrowAction,
    totalCombos: seg.totalCombos,
    totalWeight: round(seg.totalWeight, 2),
    isCapped: seg.isCapped,
    isWeaklyCapped: seg.isWeaklyCapped,
    bucketPct: {
      nuts:     round(seg.buckets.nuts.pct),
      strong:   round(seg.buckets.strong.pct),
      marginal: round(seg.buckets.marginal.pct),
      draw:     round(seg.buckets.draw.pct),
      air:      round(seg.buckets.air.pct),
    },
  };
};

const buildNodeSnapshot = () => {
  const entries = [];
  const skipped = [];
  for (const line of LINES) {
    for (const nodeId of Object.keys(line.nodes)) {
      const node = line.nodes[nodeId];
      if (!node.decision) continue;
      const entry = buildNodeEntry(line, node);
      if (entry) entries.push(entry);
      else skipped.push({ lineId: line.id, nodeId });
    }
  }
  // Sort for stability — node iteration order should already be insertion
  // order, but explicit sort defends against V8/engine behavior drift.
  entries.sort((a, b) => {
    if (a.lineId !== b.lineId) return a.lineId < b.lineId ? -1 : 1;
    if (a.nodeId !== b.nodeId) return a.nodeId < b.nodeId ? -1 : 1;
    return 0;
  });
  skipped.sort((a, b) => {
    if (a.lineId !== b.lineId) return a.lineId < b.lineId ? -1 : 1;
    return a.nodeId < b.nodeId ? -1 : 1;
  });
  return { entries, skipped };
};

const buildFoldCurveSnapshot = () => FOLD_CURVE_PROBES.map(({ baseFold, fraction }) => ({
  baseFold,
  fraction,
  response: round(logisticFoldResponse(baseFold, fraction)),
}));

const buildConstantsSnapshot = () => ({
  POP_CALLING_RATES,
  POP_BETTING_RATES,
  BUCKET_EQUITY_ANCHORS,
});

const buildFullSnapshot = () => {
  const { entries, skipped } = buildNodeSnapshot();
  return {
    schemaVersion: 1,
    generator: 'RT-108 engine-authored drift CI',
    nodes: entries,
    skippedNodes: skipped,
    foldCurveProbes: buildFoldCurveSnapshot(),
    constants: buildConstantsSnapshot(),
  };
};

describe('RT-108 — engine-vs-authored drift CI', () => {
  const current = buildFullSnapshot();

  it('produces at least one snapshot entry across authored lines', () => {
    expect(current.nodes.length).toBeGreaterThan(0);
  });

  it('any skipped decision node is an archetype-range gap (not a drift signal)', () => {
    // This assertion is pure documentation — it never fails, but the number
    // of skipped nodes is part of the snapshot so adding a new line with an
    // unsupported (position, action, vs) archetype combo surfaces in diffs.
    expect(Array.isArray(current.skippedNodes)).toBe(true);
  });

  it('matches stored baseline (drift signals engine change — review lines.js + multiwayFrameworks.js)', () => {
    const shouldUpdate = process.env.UPDATE_DRILL_DRIFT_SNAPSHOT === 'true';
    const exists = fs.existsSync(SNAPSHOT_PATH);

    if (!exists || shouldUpdate) {
      fs.mkdirSync(path.dirname(SNAPSHOT_PATH), { recursive: true });
      fs.writeFileSync(SNAPSHOT_PATH, JSON.stringify(current, null, 2) + '\n');
      if (!exists) {
        // First-run baseline creation — not a regression.
        console.warn(`[RT-108] Baseline snapshot created at ${SNAPSHOT_PATH}`);
        return;
      }
      console.warn(`[RT-108] Baseline snapshot UPDATED (UPDATE_DRILL_DRIFT_SNAPSHOT=true)`);
      return;
    }

    const stored = JSON.parse(fs.readFileSync(SNAPSHOT_PATH, 'utf-8'));
    expect(current).toEqual(stored);
  });
});
