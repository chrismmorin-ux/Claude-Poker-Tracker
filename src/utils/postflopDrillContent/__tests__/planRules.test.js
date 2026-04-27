import { describe, it, expect } from 'vitest';
import {
  PLAN_RULE_CHIPS,
  PLAN_RULE_CHIP_ORDER,
  isKnownRuleChip,
  listKnownRuleChips,
  getRuleChip,
  MDF_DEFENSE,
  RANGE_PROTECTION,
  CHECKING_RANGE_CONSTRUCTION,
  CALL_WITH_A_PLAN,
  CALL_FOLD_TO_TURN_BARREL,
  RAISE_FOLD,
  THIN_VALUE_WITH_FOLDOUT,
  BLOCKER_DRIVEN_RAISE,
  CAPPED_UNCAPPED_EXPLOITATION,
  POLARIZED_LINEAR_RESPONSE,
  EQUITY_REALIZATION_DEFENSE,
  BOARD_IMPROVEMENT_PLAN,
} from '../planRules';

const KEBAB_CASE = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

describe('PLAN_RULE_CHIPS — taxonomy invariants', () => {
  it('declares ≥10 chips per Stream P P1 acceptance criterion', () => {
    expect(Object.keys(PLAN_RULE_CHIPS).length).toBeGreaterThanOrEqual(10);
  });

  it('every chip carries the required shape', () => {
    for (const [id, chip] of Object.entries(PLAN_RULE_CHIPS)) {
      expect(chip.id, `${id}: id must equal map key`).toBe(id);
      expect(typeof chip.label, `${id}: label`).toBe('string');
      expect(chip.label.trim().length, `${id}: label non-empty`).toBeGreaterThan(0);
      expect(typeof chip.shortBody, `${id}: shortBody`).toBe('string');
      expect(chip.shortBody.trim().length, `${id}: shortBody non-empty`).toBeGreaterThan(0);
      expect(typeof chip.fullBody, `${id}: fullBody`).toBe('string');
      expect(chip.fullBody.trim().length, `${id}: fullBody non-empty`).toBeGreaterThan(0);
      expect(Array.isArray(chip.citations), `${id}: citations array`).toBe(true);
      expect(chip.citations.length, `${id}: ≥1 citation`).toBeGreaterThan(0);
    }
  });

  it('every chip ID is stable kebab-case (no spaces, no caps, no underscores)', () => {
    for (const id of Object.keys(PLAN_RULE_CHIPS)) {
      expect(KEBAB_CASE.test(id), `${id} not kebab-case`).toBe(true);
    }
  });

  it('every citation carries source + anchor', () => {
    for (const [id, chip] of Object.entries(PLAN_RULE_CHIPS)) {
      for (const c of chip.citations) {
        expect(['POKER_THEORY.md', 'external'], `${id}: citation source`).toContain(c.source);
        expect(typeof c.anchor, `${id}: citation anchor`).toBe('string');
        expect(c.anchor.trim().length, `${id}: citation anchor non-empty`).toBeGreaterThan(0);
        if ('note' in c) {
          expect(typeof c.note).toBe('string');
        }
      }
    }
  });

  it('POKER_THEORY.md citations use §N.M anchor format', () => {
    const anchorRe = /^§\d+(\.\d+)?$/;
    for (const [id, chip] of Object.entries(PLAN_RULE_CHIPS)) {
      for (const c of chip.citations) {
        if (c.source === 'POKER_THEORY.md') {
          expect(anchorRe.test(c.anchor), `${id}: bad anchor "${c.anchor}"`).toBe(true);
        }
      }
    }
  });

  it('chips and citation arrays are frozen (prevents mutation-by-accident)', () => {
    expect(Object.isFrozen(PLAN_RULE_CHIPS)).toBe(true);
    for (const [id, chip] of Object.entries(PLAN_RULE_CHIPS)) {
      expect(Object.isFrozen(chip), `${id}: chip not frozen`).toBe(true);
      expect(Object.isFrozen(chip.citations), `${id}: citations not frozen`).toBe(true);
      for (const c of chip.citations) {
        expect(Object.isFrozen(c), `${id}: citation not frozen`).toBe(true);
      }
    }
  });

  it('every owner-approved chip name is present', () => {
    const required = [
      'mdf-defense',
      'range-protection',
      'checking-range-construction',
      'call-with-a-plan',
      'call-fold-to-turn-barrel',
      'raise-fold',
      'thin-value-with-foldout',
      'blocker-driven-raise',
      'capped-uncapped-exploitation',
      'polarized-linear-response',
      'equity-realization-defense',
      'board-improvement-plan',
    ];
    for (const id of required) {
      expect(PLAN_RULE_CHIPS[id], `missing chip: ${id}`).toBeDefined();
    }
  });

  it('chip IDs are unique (no duplicates between named exports + index)', () => {
    const ids = Object.values(PLAN_RULE_CHIPS).map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });
});

describe('PLAN_RULE_CHIP_ORDER — pedagogical ordering', () => {
  it('contains every chip exactly once', () => {
    expect(PLAN_RULE_CHIP_ORDER.length).toBe(Object.keys(PLAN_RULE_CHIPS).length);
    const ids = PLAN_RULE_CHIP_ORDER.map((c) => c.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
    for (const chip of PLAN_RULE_CHIP_ORDER) {
      expect(PLAN_RULE_CHIPS[chip.id]).toBe(chip);
    }
  });

  it('order array is frozen', () => {
    expect(Object.isFrozen(PLAN_RULE_CHIP_ORDER)).toBe(true);
  });

  it('leads with math foundations (MDF + range protection)', () => {
    expect(PLAN_RULE_CHIP_ORDER[0]).toBe(MDF_DEFENSE);
    expect(PLAN_RULE_CHIP_ORDER[1]).toBe(RANGE_PROTECTION);
  });
});

describe('Lookup helpers', () => {
  it('isKnownRuleChip recognizes every defined chip', () => {
    for (const id of Object.keys(PLAN_RULE_CHIPS)) {
      expect(isKnownRuleChip(id)).toBe(true);
    }
  });

  it('isKnownRuleChip rejects unknown / malformed input', () => {
    expect(isKnownRuleChip('does-not-exist')).toBe(false);
    expect(isKnownRuleChip('')).toBe(false);
    expect(isKnownRuleChip(null)).toBe(false);
    expect(isKnownRuleChip(undefined)).toBe(false);
    expect(isKnownRuleChip(42)).toBe(false);
    expect(isKnownRuleChip({})).toBe(false);
  });

  it('listKnownRuleChips returns the same set as the index keys', () => {
    expect(listKnownRuleChips().sort()).toEqual(Object.keys(PLAN_RULE_CHIPS).sort());
  });

  it('getRuleChip returns the chip object for known IDs', () => {
    expect(getRuleChip('mdf-defense')).toBe(MDF_DEFENSE);
    expect(getRuleChip('blocker-driven-raise')).toBe(BLOCKER_DRIVEN_RAISE);
  });

  it('getRuleChip returns null for unknown IDs (no throw)', () => {
    expect(getRuleChip('does-not-exist')).toBeNull();
    expect(getRuleChip('')).toBeNull();
    expect(getRuleChip(null)).toBeNull();
  });
});

describe('Named exports — direct chip imports', () => {
  it('every named export matches its index entry', () => {
    const pairs = [
      ['mdf-defense', MDF_DEFENSE],
      ['range-protection', RANGE_PROTECTION],
      ['checking-range-construction', CHECKING_RANGE_CONSTRUCTION],
      ['call-with-a-plan', CALL_WITH_A_PLAN],
      ['call-fold-to-turn-barrel', CALL_FOLD_TO_TURN_BARREL],
      ['raise-fold', RAISE_FOLD],
      ['thin-value-with-foldout', THIN_VALUE_WITH_FOLDOUT],
      ['blocker-driven-raise', BLOCKER_DRIVEN_RAISE],
      ['capped-uncapped-exploitation', CAPPED_UNCAPPED_EXPLOITATION],
      ['polarized-linear-response', POLARIZED_LINEAR_RESPONSE],
      ['equity-realization-defense', EQUITY_REALIZATION_DEFENSE],
      ['board-improvement-plan', BOARD_IMPROVEMENT_PLAN],
    ];
    for (const [id, exp] of pairs) {
      expect(exp.id, `named export id`).toBe(id);
      expect(PLAN_RULE_CHIPS[id]).toBe(exp);
    }
  });
});
