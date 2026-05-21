import { describe, test, expect } from 'vitest';
import { LINES } from '../../postflopDrillContent/lines';
import { villainRangeFor, isKnownBaseRangeId } from '../../postflopDrillContent/villainRanges';
import { enumerateCombos } from '../../pokerCore/rangeMatrix';
import { exactComboEquity } from '../../pokerCore/monteCarloEquity';
import { parseAndEncode } from '../../pokerCore/cardParser';
import { LSW_RL_EQUITY_BASELINE, KNOWN_DEGENERATE_NODES, PARITY_TOLERANCE } from './lswRlParityBaseline';

/**
 * INV-LSW-RL-EQUITY-PARITY (WS-206) — drift-pin form.
 *
 * Range Lab (RL) is the equity validator for Line Study (LSW) content. LSW
 * nodes carry the *inputs* for an equity computation (board, hero combo,
 * villain range archetype) but no authored equity number — the lines were
 * written with qualitative reasoning. This test therefore pins the ENGINE's
 * computed hero-vs-range equity for every authored node to a committed
 * baseline. Any engine change (rangeEngine / pokerCore / villain-range
 * resolution) that shifts a node's equity beyond ±0.5% fails CI, forcing a
 * human to confirm the change is intended and the LSW line still teaches
 * correctly. This closes the "engine drift silently breaks LSW correctness"
 * gap named in the WS-206 charter.
 *
 * Equity source is pokerCore exactComboEquity (deterministic exhaustive
 * enumeration), shared with the Range Lab cache (WS-205) — one equity source
 * of truth, so RL and this invariant can never disagree by construction.
 */

const parseCombo = (s) => [parseAndEncode(s.slice(0, 2)), parseAndEncode(s.slice(2))];

/** Walk every authored line and collect parity-eligible nodes. A node is
 *  eligible when it has a 3–5 card board, a single-combo heroView, and a
 *  villain range that resolves from villainRangeContext.baseRangeId. */
const collectParityNodes = () => {
  const out = [];
  for (const line of LINES) {
    for (const [nodeId, node] of Object.entries(line.nodes || {})) {
      const board = node.board;
      const hv = node.heroView;
      const baseRangeId = node.villainRangeContext?.baseRangeId;
      if (!Array.isArray(board) || board.length < 3 || board.length > 5) continue;
      if (!hv || hv.kind !== 'single-combo' || !Array.isArray(hv.combos) || hv.combos.length !== 1) continue;
      if (!baseRangeId || !isKnownBaseRangeId(baseRangeId)) continue;
      out.push({ key: `${line.id}::${nodeId}`, board, comboStr: hv.combos[0], baseRangeId });
    }
  }
  return out;
};

/** Engine hero-vs-villain-range equity for a node, weighted over the resolved
 *  villain range. Deterministic — no RNG. */
const computeNodeEquity = ({ board, comboStr, baseRangeId }) => {
  const hero = parseCombo(comboStr);
  const enc = board.map(parseAndEncode);
  const villainRange = villainRangeFor(baseRangeId);
  const combos = enumerateCombos(villainRange, [...hero, ...enc]);
  let wsum = 0, esum = 0;
  for (const c of combos) {
    const eq = exactComboEquity(hero, [c.card1, c.card2], enc);
    if (Number.isNaN(eq)) continue;
    const w = c.weight ?? 1;
    esum += w * eq;
    wsum += w;
  }
  return wsum > 0 ? esum / wsum : NaN;
};

// Compute every eligible node's equity once. Split into VALID (a finite
// equity → pinned to baseline) and DEGENERATE (NaN → illegal inputs, must be
// in the documented allowlist).
const PARITY_NODES = collectParityNodes();
const COMPUTED = PARITY_NODES.map((n) => ({ ...n, equity: computeNodeEquity(n) }));
const VALID = COMPUTED.filter((n) => !Number.isNaN(n.equity));
const DEGENERATE = COMPUTED.filter((n) => Number.isNaN(n.equity));

describe('INV-LSW-RL-EQUITY-PARITY — engine equity is pinned for authored LSW nodes', () => {
  // Generation pass: GEN_LSW_RL_BASELINE=1 prints the JSON to stdout for review
  // instead of asserting. Used to (re)author lswRlParityBaseline.js.
  if (process.env.GEN_LSW_RL_BASELINE) {
    test('GEN baseline', () => {
      const out = {};
      for (const node of VALID) out[node.key] = Number(node.equity.toFixed(6));
      // eslint-disable-next-line no-console
      console.log('LSW_RL_EQUITY_BASELINE_JSON\n' + JSON.stringify(out, null, 2));
      // eslint-disable-next-line no-console
      console.log('DEGENERATE\n' + JSON.stringify(DEGENERATE.map((n) => n.key), null, 2));
      expect(PARITY_NODES.length).toBeGreaterThan(0);
    }, 120000);
    return;
  }

  test('at least one authored node is parity-pinned', () => {
    expect(VALID.length).toBeGreaterThan(0);
  });

  test('every degenerate node is a documented known bug (none silently dropped)', () => {
    for (const node of DEGENERATE) {
      expect(
        KNOWN_DEGENERATE_NODES,
        `Node ${node.key} has illegal inputs (hero/board collision or empty range) `
        + 'and is NOT in KNOWN_DEGENERATE_NODES. Fix the line content or document it.',
      ).toHaveProperty(node.key);
    }
    // The allowlist must not carry stale keys.
    const degenKeys = new Set(DEGENERATE.map((n) => n.key));
    for (const key of Object.keys(KNOWN_DEGENERATE_NODES)) {
      expect(degenKeys.has(key)).toBe(true);
    }
  });

  test('baseline has no stale keys', () => {
    const validKeys = new Set(VALID.map((n) => n.key));
    for (const key of Object.keys(LSW_RL_EQUITY_BASELINE)) {
      expect(validKeys.has(key)).toBe(true);
    }
  });

  test.each(VALID.map((n) => [n.key, n]))(
    'engine equity for %s matches committed baseline within tolerance',
    (key, node) => {
      expect(LSW_RL_EQUITY_BASELINE, `No committed baseline for ${key}`).toHaveProperty(key);
      expect(node.equity).toBeGreaterThanOrEqual(0);
      expect(node.equity).toBeLessThanOrEqual(1);
      expect(Math.abs(node.equity - LSW_RL_EQUITY_BASELINE[key])).toBeLessThanOrEqual(PARITY_TOLERANCE);
    },
    120000,
  );
});
