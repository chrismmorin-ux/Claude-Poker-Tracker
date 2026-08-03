/**
 * decisionAtom.test.js — the atom, its layer emissions, and the refusals (WS-324/328).
 */

import { describe, it, expect } from 'vitest';
import {
  VALUE_KINDS,
  ATOM_BASIS,
  buildLayerEmission,
  samplesFull,
  buildAtomTruth,
  buildDecisionAtom,
  buildAtomSetManifest,
  buildOccupancySpan,
} from '../decisionAtom.js';
import { SOR_SCHEMA_VERSIONS, FORCING_QUESTIONS } from '../schemas.js';

const minimalAtom = (over = {}) => buildDecisionAtom({
  atomId: 'atom-0001',
  situationKey: 'sk:cash:9:flop:BTN',
  carried: { sprBand: 'mid', playersRemaining: 2, source: 'test', pool: 'p1' },
  surfaceId: 'srf-test',
  action: { bet: 0.7, check: 0.3 },
  ruleId: 'r-1',
  warrant: 'empirical',
  ...over,
});

describe('layer emission', () => {
  it('accepts a compressed value by default', () => {
    const e = buildLayerEmission({ layer: 'range', value: { mean: 0.42 } });
    expect(e.valueKind).toBe('compressed');
    expect(VALUE_KINDS).toContain(e.valueKind);
  });

  it('accepts a full value when asked', () => {
    const e = buildLayerEmission({ layer: 'range', value: new Array(169).fill(0.5), valueKind: 'full' });
    expect(e.valueKind).toBe('full');
    expect(e.value).toHaveLength(169);
  });

  it('refuses an unknown layer', () => {
    expect(() => buildLayerEmission({ layer: 'intuition' })).toThrow(/unknown layer/);
  });

  it('refuses an unknown valueKind', () => {
    expect(() => buildLayerEmission({ layer: 'ev', valueKind: 'partial' })).toThrow(/valueKind must be/);
  });

  it('stamps assumptions per-atom, because the surface can be edited later and the atom cannot', () => {
    const e = buildLayerEmission({ layer: 'equity', assumptions: ['monteCarloSamples=2000'] });
    expect(e.assumptions).toEqual(['monteCarloSamples=2000']);
    expect(Object.isFrozen(e.assumptions)).toBe(true);
  });
});

describe('full-intermediate sampling', () => {
  it('is deterministic in the atom id, so a re-run samples the same decisions', () => {
    const a = samplesFull('atom-abc', 0.5);
    const b = samplesFull('atom-abc', 0.5);
    expect(a).toBe(b);
  });

  it('takes everything at rate 1 and nothing at rate 0', () => {
    expect(samplesFull('atom-x', 1)).toBe(true);
    expect(samplesFull('atom-x', 0)).toBe(false);
  });

  it('lands near the requested rate over many ids', () => {
    const ids = Array.from({ length: 4000 }, (_, i) => `atom-${i}`);
    const hit = ids.filter((id) => samplesFull(id, 0.25)).length / ids.length;
    expect(hit).toBeGreaterThan(0.20);
    expect(hit).toBeLessThan(0.30);
  });
});

describe('truth carries its basis', () => {
  it('accepts an observed basis', () => {
    const t = buildAtomTruth({ revealed: 'AhKh', basis: 'observed' });
    expect(t.basis).toBe('observed');
    expect(ATOM_BASIS).toContain(t.basis);
  });

  it('REFUSES a missing basis rather than defaulting it', () => {
    expect(() => buildAtomTruth({ revealed: 'AhKh' })).toThrow(/basis must be one of/);
  });

  it('refuses an unknown basis, and says why the axis exists', () => {
    let msg = '';
    try { buildAtomTruth({ revealed: 'AhKh', basis: 'assumed' }); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/category error/);
  });

  it('permits a hypothesized basis to be RECORDED — the refusal belongs to the probe, not the record', () => {
    // An atom may legitimately record that its belief came from a counterfactual branch.
    // What must never happen is SCORING that against a revealed hand; layerProbes enforces it.
    expect(buildAtomTruth({ revealed: null, basis: 'hypothesized' }).basis).toBe('hypothesized');
  });
});

describe('the atom itself', () => {
  it('stamps the current schema version', () => {
    expect(minimalAtom().schemaVersion).toBe(SOR_SCHEMA_VERSIONS.decisionAtom);
    expect(SOR_SCHEMA_VERSIONS.decisionAtom).toBe(2);
  });

  it('throws rather than returning a partial object when a required field is missing', () => {
    expect(() => buildDecisionAtom({ atomId: 'a' })).toThrow(/not well-formed/);
  });

  it('names the specific problems in the error', () => {
    let msg = '';
    try { buildDecisionAtom({ atomId: 'a' }); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/situationKey/);
    expect(msg).toMatch(/surfaceId/);
  });

  it('records a null ruleId as the residual signal rather than an error', () => {
    expect(minimalAtom({ ruleId: null, warrant: null }).ruleId).toBeNull();
  });

  it('refuses truth supplied without a valid basis, even bypassing buildAtomTruth', () => {
    expect(() => minimalAtom({ truth: { revealed: 'AhKh' } })).toThrow(/without a valid `basis`/);
  });

  it('carries the v2 capture fields', () => {
    const atom = minimalAtom({
      alternativeScores: { fold: -1.2, call: 0.3, raise: 0.31 },
      rulesMatchedAndLost: ['r-7'],
      beliefState: { seat3: { mean: 0.4 } },
      truth: buildAtomTruth({ revealed: 'QdQc', basis: 'observed' }),
      seeds: { deal: 42, monteCarlo: 7 },
      actorSeat: 3,
      actorRole: 'villain',
      wallTimeMs: 12.5,
      tokens: null,
    });
    expect(atom.alternativeScores.raise).toBeCloseTo(0.31);
    expect(atom.actorRole).toBe('villain');
    expect(atom.seeds.deal).toBe(42);
  });

  it('captures VILLAIN decisions, not just hero — hero-only logging makes the interesting result unreachable', () => {
    const villain = minimalAtom({ actorSeat: 5, actorRole: 'villain' });
    expect(villain.actorRole).toBe('villain');
  });

  it('is frozen', () => {
    expect(Object.isFrozen(minimalAtom())).toBe(true);
  });
});

describe('the atom set manifest', () => {
  it('records the sampling rate rather than leaving it inferable', () => {
    const m = buildAtomSetManifest({ atomSetId: 'set-1', surfaceId: 'srf-1', fullSampleRate: 0.05 });
    expect(m.fullSampleRate).toBe(0.05);
  });

  it('refuses a rate outside [0,1] and explains why it is recorded', () => {
    let msg = '';
    try { buildAtomSetManifest({ atomSetId: 's', fullSampleRate: 1.5 }); } catch (e) { msg = e.message; }
    expect(msg).toMatch(/crashed run/);
  });

  it('requires an id', () => {
    expect(() => buildAtomSetManifest({})).toThrow(/atomSetId is required/);
  });

  it('holds the seat-occupancy timeline, so table-history questions stay answerable', () => {
    const m = buildAtomSetManifest({
      atomSetId: 'set-2',
      seatOccupancy: [buildOccupancySpan({ seat: 1, joinedAtHand: 0, leftAtHand: 120 })],
    });
    expect(m.seatOccupancy[0].handsSeated).toBe(120);
  });

  it('leaves handsSeated null for a seat still occupied', () => {
    expect(buildOccupancySpan({ seat: 2, joinedAtHand: 10 }).handsSeated).toBeNull();
  });
});

describe('the forcing-function question list', () => {
  it('ships with the schema', () => {
    expect(FORCING_QUESTIONS.length).toBeGreaterThan(5);
  });

  it('records the still-open choice of `d` as UNANSWERABLE rather than omitting it', () => {
    // This assertion used to name the layer-attribution question. WS-324 answered that one —
    // by requiring `d` as an argument with no default, so a layer share is computable without
    // anyone having decided WHICH `d` is right. The choice of `d` itself is what remains open,
    // and it stays on this list until FSA Phase 3 measures it. The guard is unchanged in
    // substance: an unanswerable question must be RECORDED, never quietly dropped, because
    // the list is how the schema learns from its own gaps.
    const unanswered = FORCING_QUESTIONS.filter((q) => q.answerable === false);
    expect(unanswered.length).toBeGreaterThan(0);
    expect(unanswered[0].note).toMatch(/Phase 3/);
    expect(unanswered.some((q) => /divergence measure/.test(q.question))).toBe(true);
  });

  it('names a field for every answerable question', () => {
    for (const q of FORCING_QUESTIONS.filter((x) => x.answerable)) {
      expect(q.field, `"${q.question}" claims to be answerable but names no field`).toBeTruthy();
    }
  });
});
