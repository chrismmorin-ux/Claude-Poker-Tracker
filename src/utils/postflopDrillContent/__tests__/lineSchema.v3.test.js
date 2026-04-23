/**
 * Tests for lineSchema.js v3 additions (LSW-G4-IMPL Commit 2.5).
 *
 * Covers:
 *  - SCHEMA_VERSION bumped to 3
 *  - HERO_VIEW_KINDS / DECISION_KINDS / DECISION_STRATEGIES / NARROWING_SPEC_KINDS exports
 *  - validateLine accepts v3-shaped nodes (heroView + villainRangeContext +
 *    decisionKind + decisionStrategy)
 *  - migration guard: simultaneous heroHolding + heroView rejected
 *  - heroView kind constraints (single-combo must have exactly one combo, etc.)
 *  - villainRangeContext baseRangeId + narrowingSpec validation
 *  - `air` in heroView.bucketCandidates rejected when kind=single-combo
 */

import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  HERO_VIEW_KINDS,
  DECISION_KINDS,
  DECISION_STRATEGIES,
  NARROWING_SPEC_KINDS,
  validateLine,
} from '../lineSchema';

// ----- Version + enum exports -----------------------------------------------

describe('schema v3 version + enums', () => {
  it('SCHEMA_VERSION is 3', () => {
    expect(SCHEMA_VERSION).toBe(3);
  });

  it('HERO_VIEW_KINDS contains single-combo / combo-set / range-level', () => {
    expect(HERO_VIEW_KINDS).toEqual(expect.arrayContaining(['single-combo', 'combo-set', 'range-level']));
    expect(Object.isFrozen(HERO_VIEW_KINDS)).toBe(true);
  });

  it('DECISION_KINDS contains standard / bluff-catch / thin-value', () => {
    expect(DECISION_KINDS).toEqual(expect.arrayContaining(['standard', 'bluff-catch', 'thin-value']));
    expect(Object.isFrozen(DECISION_KINDS)).toBe(true);
  });

  it('DECISION_STRATEGIES contains pure + mixed', () => {
    expect(DECISION_STRATEGIES).toEqual(expect.arrayContaining(['pure', 'mixed']));
    expect(Object.isFrozen(DECISION_STRATEGIES)).toBe(true);
  });

  it('NARROWING_SPEC_KINDS has at least 5 handler names', () => {
    expect(NARROWING_SPEC_KINDS.length).toBeGreaterThanOrEqual(5);
    expect(NARROWING_SPEC_KINDS).toEqual(expect.arrayContaining([
      'keep-continuing-vs-action', 'keep-call-range', 'drop-raises',
    ]));
    expect(Object.isFrozen(NARROWING_SPEC_KINDS)).toBe(true);
  });
});

// ----- Fixture: a minimal v3 line for the validator to chew on -------------

const makeV3Line = (overrides = {}) => ({
  id: 'test-v3-line',
  title: 'V3 test line',
  summary: 'Seed line for schema tests',
  rootId: 'flop_root',
  setup: {
    hero:     { position: 'BTN', action: 'call', vs: 'BB' },
    villains: [{ position: 'BB', action: 'threeBet', vs: 'BTN' }],
    potType: '3bp',
    effStack: 90,
  },
  nodes: {
    flop_root: {
      id: 'flop_root',
      street: 'flop',
      board: ['T♥', '9♥', '6♠'],
      pot: 20.5,
      villainAction: { kind: 'donk', size: 0.33 },
      sections: [{ kind: 'prose', heading: 'The spot', body: 'BB donks.' }],
      heroView: {
        kind: 'single-combo',
        combos: ['J♥T♠'],
        bucketCandidates: ['topPairGood'],
        classLabel: 'top pair good',
      },
      villainRangeContext: {
        baseRangeId: 'btn_vs_bb_3bp_bb_range',
        narrowingSpec: { kind: 'keep-continuing-vs-action', actions: ['villain-donk'] },
        narrowingLabel: 'flop donk range',
      },
      decisionKind: 'standard',
      decisionStrategy: 'pure',
      frameworks: ['range_advantage'],
      decision: {
        prompt: 'Hero plays?',
        branches: [
          { label: 'Call',   nextId: null, correct: true,  rationale: 'Call.' },
          { label: 'Raise',  nextId: null, correct: false, rationale: 'Folds out bluffs.' },
          { label: 'Fold',   nextId: null, correct: false, rationale: 'Gives up.' },
        ],
      },
      ...(overrides.nodeOverrides || {}),
    },
  },
  ...overrides.lineLevel,
});

// ----- validateLine accepts v3 content -------------------------------------

describe('validateLine accepts v3 nodes', () => {
  it('passes a minimal v3-shaped line', () => {
    const line = makeV3Line();
    const result = validateLine(line);
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts decisionKind=bluff-catch + thin-value', () => {
    for (const kind of ['standard', 'bluff-catch', 'thin-value']) {
      const line = makeV3Line({ nodeOverrides: { decisionKind: kind } });
      const result = validateLine(line);
      expect(result.ok).toBe(true);
    }
  });

  it('accepts heroView without bucketCandidates', () => {
    const line = makeV3Line({
      nodeOverrides: {
        heroView: { kind: 'single-combo', combos: ['J♥T♠'] },
      },
    });
    expect(validateLine(line).ok).toBe(true);
  });

  it('accepts villainRangeContext without narrowingSpec (root nodes have no narrowing)', () => {
    const line = makeV3Line({
      nodeOverrides: {
        villainRangeContext: { baseRangeId: 'btn_vs_bb_3bp_bb_range' },
      },
    });
    expect(validateLine(line).ok).toBe(true);
  });
});

// ----- Migration guard -----------------------------------------------------

describe('heroHolding hard-deprecation (Commit 5)', () => {
  it('rejects a node with heroHolding alongside heroView', () => {
    const line = makeV3Line({
      nodeOverrides: {
        heroHolding: { combos: ['J♥T♠'], bucketCandidates: ['topPair'] },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/heroHolding is removed in schema v3/);
  });

  it('rejects a node with heroHolding only — v1 pipeline is removed', () => {
    const line = makeV3Line({
      nodeOverrides: { heroView: undefined },
    });
    delete line.nodes.flop_root.heroView;
    line.nodes.flop_root.heroHolding = { combos: ['J♥T♠'], bucketCandidates: ['topPair'] };
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/heroHolding is removed in schema v3/);
  });

  it('rejection message guides author to the v3 migration path', () => {
    const line = makeV3Line({ nodeOverrides: { heroView: undefined } });
    delete line.nodes.flop_root.heroView;
    line.nodes.flop_root.heroHolding = { combos: ['J♥T♠'] };
    const msg = validateLine(line).errors.join(' ');
    expect(msg).toMatch(/heroView/);
    expect(msg).toMatch(/villainRangeContext/);
    expect(msg).toMatch(/decisionKind/);
  });
});

// ----- heroView validation -------------------------------------------------

describe('heroView validation', () => {
  it('rejects unknown kind', () => {
    const line = makeV3Line({
      nodeOverrides: { heroView: { kind: 'telepathic-combo', combos: ['J♥T♠'] } },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/heroView\.kind '\w.*' must be one of/);
  });

  it('rejects single-combo with >1 combos', () => {
    const line = makeV3Line({
      nodeOverrides: { heroView: { kind: 'single-combo', combos: ['J♥T♠', 'J♣T♣'] } },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/exactly 1 entry for kind 'single-combo'/);
  });

  it('rejects malformed combo strings', () => {
    const line = makeV3Line({
      nodeOverrides: { heroView: { kind: 'single-combo', combos: ['bogus'] } },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/must match rank\+suit/);
  });

  it('rejects duplicate-card combo', () => {
    const line = makeV3Line({
      nodeOverrides: { heroView: { kind: 'single-combo', combos: ['J♥J♥'] } },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/duplicate card/);
  });

  it('rejects air in bucketCandidates when kind=single-combo', () => {
    const line = makeV3Line({
      nodeOverrides: {
        heroView: {
          kind: 'single-combo',
          combos: ['J♥T♠'],
          bucketCandidates: ['topPair', 'air'],
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/may not include 'air'/);
  });

  it('rejects empty bucketCandidates array', () => {
    const line = makeV3Line({
      nodeOverrides: {
        heroView: { kind: 'single-combo', combos: ['J♥T♠'], bucketCandidates: [] },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/bucketCandidates must be a non-empty array/);
  });

  it('rejects non-string classLabel', () => {
    const line = makeV3Line({
      nodeOverrides: {
        heroView: { kind: 'single-combo', combos: ['J♥T♠'], classLabel: 42 },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/classLabel must be a non-empty string/);
  });
});

// ----- villainRangeContext validation --------------------------------------

describe('villainRangeContext validation', () => {
  it('rejects empty baseRangeId', () => {
    const line = makeV3Line({
      nodeOverrides: { villainRangeContext: { baseRangeId: '' } },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/baseRangeId must be a non-empty string/);
  });

  it('rejects missing baseRangeId', () => {
    const line = makeV3Line({
      nodeOverrides: { villainRangeContext: {} },
    });
    expect(validateLine(line).ok).toBe(false);
  });

  it('rejects narrowingSpec with unknown kind', () => {
    const line = makeV3Line({
      nodeOverrides: {
        villainRangeContext: {
          baseRangeId: 'btn_vs_bb_3bp_bb_range',
          narrowingSpec: { kind: 'bogus-narrowing' },
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/narrowingSpec\.kind '\w.*' must be one of/);
  });

  it('accepts narrowingSpec with empty actions array when present', () => {
    const line = makeV3Line({
      nodeOverrides: {
        villainRangeContext: {
          baseRangeId: 'btn_vs_bb_3bp_bb_range',
          narrowingSpec: { kind: 'keep-call-range' }, // no `actions` at all
        },
      },
    });
    expect(validateLine(line).ok).toBe(true);
  });

  it('rejects narrowingSpec.actions with non-string entries', () => {
    const line = makeV3Line({
      nodeOverrides: {
        villainRangeContext: {
          baseRangeId: 'btn_vs_bb_3bp_bb_range',
          narrowingSpec: { kind: 'keep-call-range', actions: [42, null] },
        },
      },
    });
    expect(validateLine(line).ok).toBe(false);
  });
});

// ----- decisionKind + decisionStrategy -------------------------------------

describe('decisionKind + decisionStrategy', () => {
  it('rejects unknown decisionKind', () => {
    const line = makeV3Line({ nodeOverrides: { decisionKind: 'bogus-kind' } });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/decisionKind '\w.*' must be one of/);
  });

  it('rejects unknown decisionStrategy', () => {
    const line = makeV3Line({ nodeOverrides: { decisionStrategy: 'half-baked' } });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/decisionStrategy '\w.*' must be one of/);
  });

  it('accepts absent decisionKind + decisionStrategy (optional fields)', () => {
    const line = makeV3Line({
      nodeOverrides: {
        decisionKind: undefined,
        decisionStrategy: undefined,
      },
    });
    delete line.nodes.flop_root.decisionKind;
    delete line.nodes.flop_root.decisionStrategy;
    expect(validateLine(line).ok).toBe(true);
  });
});
