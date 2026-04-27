/**
 * Tests for lineSchema.js v4 additions (LSW-P2 — comboPlans).
 *
 * Covers:
 *  - SCHEMA_VERSION bumped to 4
 *  - PLAN_TEXT_MAX_CHARS exported
 *  - validateLine accepts well-formed comboPlans (bucket plans + per-combo overrides)
 *  - rejects orphaned bucket keys (not in heroView.bucketCandidates)
 *  - rejects unknown rule chip IDs
 *  - rejects orphaned override combos (not in heroView.combos for single-combo views)
 *  - rejects bad shapes: missing planText, empty ruleChips, planText > 320 chars
 *  - rejects nested overrides (overrides is flat one-level)
 *  - rejects comboPlans on a node without heroView.bucketCandidates
 *  - additive: legacy nodes without comboPlans remain valid
 */

import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  PLAN_TEXT_MAX_CHARS,
  validateLine,
} from '../lineSchema';

// ----- Version + constant exports -----------------------------------------

describe('schema v4 version + constants', () => {
  it('SCHEMA_VERSION is 4', () => {
    expect(SCHEMA_VERSION).toBe(4);
  });

  it('PLAN_TEXT_MAX_CHARS is exported as 320', () => {
    expect(PLAN_TEXT_MAX_CHARS).toBe(320);
  });
});

// ----- Fixture: a minimal v4 line for the validator to chew on -----------

const makeV4Line = (nodeOverrides = {}) => ({
  id: 'test-v4-line',
  title: 'V4 test line',
  summary: 'Seed line for comboPlans schema tests',
  rootId: 'flop_root',
  setup: {
    hero: { position: 'BTN', action: 'call', vs: 'BB' },
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
      },
      villainRangeContext: { baseRangeId: 'btn_vs_bb_3bp_bb_range' },
      decisionKind: 'standard',
      decision: {
        prompt: 'Hero plays?',
        branches: [
          { label: 'Call',  nextId: null, correct: true,  rationale: 'Call.' },
          { label: 'Raise', nextId: null, correct: false, rationale: 'Folds bluffs.' },
          { label: 'Fold',  nextId: null, correct: false, rationale: 'Gives up.' },
        ],
      },
      ...nodeOverrides,
    },
  },
});

const wellFormedComboPlans = {
  topPairGood: {
    planText:
      'Call-call-fold to a 75% turn barrel; lead bricks that improve your equity-realization.',
    ruleChips: ['mdf-defense', 'call-fold-to-turn-barrel'],
  },
};

// ----- Happy path ----------------------------------------------------------

describe('validateLine accepts well-formed comboPlans', () => {
  it('accepts bucket-keyed plans with valid chips', () => {
    const line = makeV4Line({ comboPlans: wellFormedComboPlans });
    const result = validateLine(line);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('accepts a per-combo override on a single-combo heroView', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: {
          planText: 'Default top-pair plan.',
          ruleChips: ['mdf-defense'],
          overrides: {
            'J♥T♠': {
              planText: 'JTs specifically: lead any heart turn for value+protection.',
              ruleChips: ['board-improvement-plan', 'thin-value-with-foldout'],
            },
          },
        },
      },
    });
    const result = validateLine(line);
    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('accepts comboPlans absent (additive — legacy nodes remain valid)', () => {
    const line = makeV4Line(); // no comboPlans
    expect(validateLine(line).ok).toBe(true);
  });

  it('accepts multiple bucket entries when bucketCandidates carries multiple', () => {
    const line = makeV4Line({
      heroView: {
        kind: 'combo-set',
        combos: ['J♥T♠', '9♠9♣'],
        bucketCandidates: ['topPairGood', 'overpair'],
      },
      comboPlans: {
        topPairGood: { planText: 'TP plan.', ruleChips: ['mdf-defense'] },
        overpair:    { planText: 'OP plan.', ruleChips: ['range-protection'] },
      },
    });
    expect(validateLine(line).ok).toBe(true);
  });
});

// ----- Bucket key validation ----------------------------------------------

describe('comboPlans bucket key validation', () => {
  it('rejects a bucket key not present in heroView.bucketCandidates', () => {
    const line = makeV4Line({
      comboPlans: {
        flushDraw: { planText: 'plan', ruleChips: ['mdf-defense'] }, // not in bucketCandidates
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/bucket 'flushDraw' is not in heroView\.bucketCandidates/);
  });

  it('rejects empty comboPlans object (omit the field instead)', () => {
    const line = makeV4Line({ comboPlans: {} });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/comboPlans must have at least one bucket entry/);
  });

  it('rejects comboPlans on a node without heroView.bucketCandidates', () => {
    const line = makeV4Line({
      heroView: { kind: 'single-combo', combos: ['J♥T♠'] }, // no bucketCandidates
      comboPlans: wellFormedComboPlans,
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/comboPlans requires heroView with non-empty bucketCandidates/);
  });

  it('rejects comboPlans on a node without heroView at all', () => {
    const line = makeV4Line({
      heroView: undefined,
      comboPlans: wellFormedComboPlans,
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/comboPlans requires heroView/);
  });

  it('rejects comboPlans that is not an object', () => {
    const line = makeV4Line({ comboPlans: 'not-an-object' });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/comboPlans must be an object/);
  });
});

// ----- Rule chip validation -----------------------------------------------

describe('comboPlans rule chip validation', () => {
  it('rejects an unknown chip ID with a helpful pointer', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: 'plan', ruleChips: ['does-not-exist'] },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(
      /chip 'does-not-exist' is not registered in planRules\.PLAN_RULE_CHIPS/,
    );
  });

  it('rejects a non-string chip ID', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: 'plan', ruleChips: [42] },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/ruleChips\[0\]: must be a non-empty string/);
  });

  it('rejects an empty ruleChips array (non-empty required)', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: 'plan', ruleChips: [] },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/ruleChips must be a non-empty array/);
  });

  it('rejects a missing ruleChips field', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: 'plan' }, // no ruleChips
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/ruleChips must be a non-empty array/);
  });
});

// ----- planText validation -------------------------------------------------

describe('comboPlans planText validation', () => {
  it('rejects empty planText', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: '', ruleChips: ['mdf-defense'] },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/planText must be a non-empty trimmed string/);
  });

  it('rejects whitespace-only planText', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: '   \n  ', ruleChips: ['mdf-defense'] },
      },
    });
    expect(validateLine(line).ok).toBe(false);
  });

  it(`rejects planText longer than ${PLAN_TEXT_MAX_CHARS} chars`, () => {
    const longText = 'x'.repeat(PLAN_TEXT_MAX_CHARS + 1);
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: longText, ruleChips: ['mdf-defense'] },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(new RegExp(`planText \\(${PLAN_TEXT_MAX_CHARS + 1} chars\\) exceeds ${PLAN_TEXT_MAX_CHARS}-char limit`));
  });

  it(`accepts planText at exactly ${PLAN_TEXT_MAX_CHARS} chars (boundary)`, () => {
    const exactText = 'a'.repeat(PLAN_TEXT_MAX_CHARS);
    const line = makeV4Line({
      comboPlans: {
        topPairGood: { planText: exactText, ruleChips: ['mdf-defense'] },
      },
    });
    expect(validateLine(line).ok).toBe(true);
  });
});

// ----- Override key validation --------------------------------------------

describe('comboPlans override key validation', () => {
  it('rejects an override combo not in heroView.combos (single-combo view)', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: {
          planText: 'plan',
          ruleChips: ['mdf-defense'],
          overrides: {
            'A♠K♥': { planText: 'override', ruleChips: ['mdf-defense'] }, // not in combos
          },
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/override key 'A♠K♥' is not in heroView\.combos/);
  });

  it('rejects an override key with bad combo format', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: {
          planText: 'plan',
          ruleChips: ['mdf-defense'],
          overrides: {
            'JT': { planText: 'override', ruleChips: ['mdf-defense'] }, // missing suits
          },
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/override key 'JT' must match rank\+suit×2/);
  });

  it('rejects an override key with duplicate cards', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: {
          planText: 'plan',
          ruleChips: ['mdf-defense'],
          overrides: {
            'J♥J♥': { planText: 'override', ruleChips: ['mdf-defense'] },
          },
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/override key 'J♥J♥' has duplicate card/);
  });

  it('rejects nested overrides inside an override (flat structure)', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: {
          planText: 'plan',
          ruleChips: ['mdf-defense'],
          overrides: {
            'J♥T♠': {
              planText: 'override',
              ruleChips: ['mdf-defense'],
              overrides: { // <-- nested, should reject
                'J♥T♠': { planText: 'nested', ruleChips: ['mdf-defense'] },
              },
            },
          },
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/overrides not allowed inside an override/);
  });

  it('rejects overrides field that is not an object', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: {
          planText: 'plan',
          ruleChips: ['mdf-defense'],
          overrides: 'not-an-object',
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    expect(result.errors.join('\n')).toMatch(/overrides: must be an object/);
  });

  it('validates override planText + ruleChips with the same rules as bucket entries', () => {
    const line = makeV4Line({
      comboPlans: {
        topPairGood: {
          planText: 'plan',
          ruleChips: ['mdf-defense'],
          overrides: {
            'J♥T♠': { planText: '', ruleChips: ['unknown-chip'] }, // both wrong
          },
        },
      },
    });
    const result = validateLine(line);
    expect(result.ok).toBe(false);
    const joined = result.errors.join('\n');
    expect(joined).toMatch(/planText must be a non-empty trimmed string/);
    expect(joined).toMatch(/chip 'unknown-chip' is not registered/);
  });
});
