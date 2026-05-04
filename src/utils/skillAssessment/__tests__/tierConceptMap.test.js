/**
 * @file Tests for tierConceptMap.js — concept registry well-formedness +
 * helper getter coverage. Per WS-148 / SPR-033.
 */

import { describe, it, expect } from 'vitest';
import {
  CONCEPT_REGISTRY,
  SITUATION_KEY_TO_CONCEPT,
  getConceptKind,
  getTierForConcept,
  listConceptsForTier,
  getChildrenOf,
  getParentOf,
  getAllConceptIds,
  getAllUmbrellaIds,
  resolveSituationKeyToConcept,
} from '../tierConceptMap.js';

const VALID_KINDS = new Set([
  'general-skill',
  'rule-anchored-umbrella',
  'rule-anchored-specific',
]);

describe('tierConceptMap — registry well-formedness', () => {
  it('every entry has the expected meta shape', () => {
    for (const [conceptId, meta] of Object.entries(CONCEPT_REGISTRY)) {
      expect(meta, `${conceptId} meta`).toBeDefined();
      expect(VALID_KINDS.has(meta.kind), `${conceptId} kind=${meta.kind}`).toBe(true);
      expect(typeof meta.tier).toBe('number');
      expect(meta.tier).toBeGreaterThanOrEqual(1);
      expect(meta.tier).toBeLessThanOrEqual(6);
      expect(meta.parent === null || typeof meta.parent === 'string').toBe(true);
      expect(Array.isArray(meta.children)).toBe(true);
    }
  });

  it('umbrella concepts have non-empty children and no parent', () => {
    for (const [conceptId, meta] of Object.entries(CONCEPT_REGISTRY)) {
      if (meta.kind !== 'rule-anchored-umbrella') continue;
      expect(meta.children.length, `${conceptId} children`).toBeGreaterThan(0);
      expect(meta.parent, `${conceptId} parent`).toBeNull();
    }
  });

  it('rule-anchored-specific concepts have a parent and no children', () => {
    for (const [conceptId, meta] of Object.entries(CONCEPT_REGISTRY)) {
      if (meta.kind !== 'rule-anchored-specific') continue;
      expect(meta.parent, `${conceptId} parent`).toBeTruthy();
      expect(meta.children.length, `${conceptId} children`).toBe(0);
    }
  });

  it('general-skill concepts have no parent and no children', () => {
    for (const [conceptId, meta] of Object.entries(CONCEPT_REGISTRY)) {
      if (meta.kind !== 'general-skill') continue;
      expect(meta.parent, `${conceptId} parent`).toBeNull();
      expect(meta.children.length, `${conceptId} children`).toBe(0);
    }
  });

  it('every umbrella child is registered and points back to its parent', () => {
    for (const [umbrellaId, meta] of Object.entries(CONCEPT_REGISTRY)) {
      if (meta.kind !== 'rule-anchored-umbrella') continue;
      for (const childId of meta.children) {
        expect(CONCEPT_REGISTRY[childId], `child ${childId} of ${umbrellaId} not registered`).toBeDefined();
        expect(CONCEPT_REGISTRY[childId].parent, `child ${childId} parent`).toBe(umbrellaId);
      }
    }
  });

  it('every parent reference points to a registered umbrella', () => {
    for (const [conceptId, meta] of Object.entries(CONCEPT_REGISTRY)) {
      if (meta.parent === null) continue;
      const parent = CONCEPT_REGISTRY[meta.parent];
      expect(parent, `parent ${meta.parent} of ${conceptId} not registered`).toBeDefined();
      expect(parent.kind).toBe('rule-anchored-umbrella');
      expect(parent.children).toContain(conceptId);
    }
  });

  it('every SITUATION_KEY_TO_CONCEPT value is a registered specific concept', () => {
    for (const [key, conceptId] of Object.entries(SITUATION_KEY_TO_CONCEPT)) {
      expect(CONCEPT_REGISTRY[conceptId], `key ${key} → ${conceptId} not registered`).toBeDefined();
      expect(CONCEPT_REGISTRY[conceptId].kind).toBe('rule-anchored-specific');
    }
  });
});

describe('tierConceptMap — getters', () => {
  it('getConceptKind returns the kind or null', () => {
    expect(getConceptKind('pot-odds')).toBe('general-skill');
    expect(getConceptKind('cbet-defense-cluster')).toBe('rule-anchored-umbrella');
    expect(getConceptKind('ip-cbet-defense-dry-LATE')).toBe('rule-anchored-specific');
    expect(getConceptKind('nonexistent')).toBeNull();
  });

  it('getTierForConcept returns the tier or null', () => {
    expect(getTierForConcept('pot-odds')).toBe(1);
    expect(getTierForConcept('bb-defense-cluster')).toBe(2);
    expect(getTierForConcept('cbet-defense-cluster')).toBe(3);
    expect(getTierForConcept('blocker-effects-preflop')).toBe(4);
    expect(getTierForConcept('capped-vs-uncapped-ranges')).toBe(5);
    expect(getTierForConcept('nonexistent')).toBeNull();
  });

  it('listConceptsForTier returns all concepts at the given tier', () => {
    const tier1 = listConceptsForTier(1);
    expect(tier1).toContain('pot-odds');

    const tier2 = listConceptsForTier(2);
    expect(tier2).toContain('bb-defense-cluster');
    expect(tier2).toContain('bb-defense-vs-EARLY');

    const tier3 = listConceptsForTier(3);
    expect(tier3).toContain('cbet-defense-cluster');
    expect(tier3).toContain('range-vs-range-thinking');
    expect(tier3).toContain('board-texture');

    const tier6 = listConceptsForTier(6);
    expect(tier6).toEqual([]);
  });

  it('getChildrenOf returns child concept IDs for umbrellas', () => {
    expect(getChildrenOf('cbet-defense-cluster')).toHaveLength(6);
    expect(getChildrenOf('bb-defense-cluster')).toHaveLength(5);
    expect(getChildrenOf('pot-odds')).toEqual([]);
    expect(getChildrenOf('nonexistent')).toEqual([]);
  });

  it('getParentOf returns the parent umbrella for sub-concepts', () => {
    expect(getParentOf('ip-cbet-defense-dry-LATE')).toBe('cbet-defense-cluster');
    expect(getParentOf('bb-defense-vs-EARLY')).toBe('bb-defense-cluster');
    expect(getParentOf('pot-odds')).toBeNull();
    expect(getParentOf('cbet-defense-cluster')).toBeNull();
    expect(getParentOf('nonexistent')).toBeNull();
  });

  it('getAllConceptIds returns the full sorted registry', () => {
    const ids = getAllConceptIds();
    const sorted = [...ids].sort();
    expect(ids).toEqual(sorted);
    expect(ids.length).toBe(Object.keys(CONCEPT_REGISTRY).length);
  });

  it('getAllUmbrellaIds returns only umbrella concepts', () => {
    const umbrellas = getAllUmbrellaIds();
    expect(umbrellas).toContain('cbet-defense-cluster');
    expect(umbrellas).toContain('bb-defense-cluster');
    expect(umbrellas).not.toContain('pot-odds');
    expect(umbrellas).not.toContain('ip-cbet-defense-dry-LATE');
  });

  it('resolveSituationKeyToConcept maps known keys + returns null otherwise', () => {
    expect(resolveSituationKeyToConcept('flop:dry:LATE:def:ip:bet:cbet')).toBe('ip-cbet-defense-dry-LATE');
    expect(resolveSituationKeyToConcept('flop:wet:BUTTON:def:ip:bet:cbet')).toBe('ip-cbet-defense-wet-BUTTON');
    expect(resolveSituationKeyToConcept('preflop:none:BIG_BLIND:def:oop:raise:vsopen')).toBeNull();
    expect(resolveSituationKeyToConcept('garbage:key:format')).toBeNull();
  });
});
