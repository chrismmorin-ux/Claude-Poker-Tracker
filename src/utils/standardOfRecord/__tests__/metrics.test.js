/**
 * metrics.test.js — the WS-434 metrics-union validator.
 *
 * Two properties matter most and both are tested against REAL artifacts, not only
 * fixtures: (1) every committed card stays LEGIBLE while becoming invalid to publish
 * (the disclaimerRegisterVersion asymmetry), and (2) the declared v1 shapes match what
 * the producers actually emit — proven by validating committed cards' metrics blocks
 * with a kind attached. A schema transcribed wrong would fail here, not in production.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { SOR_SCHEMAS, checkAgainstSchema } from '../schemas.js';
import { resultCardProblems } from '../resultCard.js';
import { METRICS_KINDS } from '../metricsSchemas.js';
import {
  metricsProblems,
  conditionedRateProblems,
  overallEvFactorProblems,
} from '../metrics.js';
import { SUSPECTED_FAULTS } from '../faultRegister.js';

const repoFile = (rel) => fileURLToPath(new URL(`../../../../${rel}`, import.meta.url));
const readCard = (rel) => JSON.parse(readFileSync(repoFile(rel), 'utf8'));

/** Generate a schema-conforming value for one field descriptor. */
const valueFor = (field, kind) => {
  if (field.name === 'kind') return kind;
  if (field.shape === 'metrics.shared.conditioned-rate') {
    return { k: 1, n: 4, rate: 0.25, conditional: 'P(event | conditioning population)' };
  }
  if (field.shape) {
    return Object.fromEntries(SOR_SCHEMAS[field.shape].map((f) => [f.name, valueFor(f, kind)]));
  }
  const first = field.type.split('|')[0].trim();
  switch (first) {
    case 'number': return 1;
    case 'string': return 'x';
    case 'boolean': return true;
    case 'array': return [];
    case 'object': return {};
    default: return null;
  }
};

/** A minimal valid metrics block for a kind, straight from its declared schema. */
const fixtureFor = (kind) => Object.fromEntries(
  SOR_SCHEMAS[METRICS_KINDS[kind]].map((f) => [f.name, valueFor(f, kind)]),
);

describe('metricsProblems — dispatch', () => {
  it('rejects a non-object', () => {
    expect(metricsProblems(null)).toEqual([expect.stringContaining('must be an object')]);
    expect(metricsProblems([])).toEqual([expect.stringContaining('must be an object')]);
  });

  it('reports exactly one problem for a missing kind, naming the publish/read asymmetry', () => {
    const problems = metricsProblems({ edgeBB: 1 });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('kind is required to PUBLISH');
    expect(problems[0]).toContain('READABLE');
  });

  it('rejects an unknown kind and names the registered ones', () => {
    const problems = metricsProblems({ kind: 'not-a-kind' });
    expect(problems).toHaveLength(1);
    expect(problems[0]).toContain('not a registered metrics kind');
    expect(problems[0]).toContain('hero-ev');
    expect(problems[0]).toContain('metricsSchemas.js');
  });

  for (const kind of Object.keys(METRICS_KINDS)) {
    it(`accepts a schema-conforming ${kind} block`, () => {
      expect(metricsProblems(fixtureFor(kind))).toEqual([]);
    });
  }

  it('rejects an undeclared top-level key — declaration precedes emission', () => {
    const problems = metricsProblems({ ...fixtureFor('deviation-map'), sneakyNewFigure: 42 });
    expect(problems).toEqual([expect.stringContaining('sneakyNewFigure is not declared')]);
    expect(problems[0]).toContain('metricsSchemas.js');
  });

  it('reports a missing required field of the dispatched variant', () => {
    const m = fixtureFor('deviation-map');
    delete m.deviationVolume;
    expect(metricsProblems(m)).toEqual([expect.stringContaining('deviationVolume is required')]);
  });
});

describe('conditionedRateProblems — the canonical {k, n, rate, conditional} semantics', () => {
  const good = { k: 3, n: 12, rate: 0.25, conditional: 'P(fold | facing a bet)' };

  it('accepts a coherent conditioned rate', () => {
    expect(conditionedRateProblems(good)).toEqual([]);
  });

  it('requires rate to be NULL exactly when n is 0', () => {
    expect(conditionedRateProblems({ k: 0, n: 0, rate: 0, conditional: 'P(a | b)' }))
      .toEqual([expect.stringContaining('must be NULL when n is 0')]);
    expect(conditionedRateProblems({ k: 0, n: 0, rate: null, conditional: 'P(a | b)' })).toEqual([]);
  });

  it('rejects a rate that disagrees with its own k/n — a stale or pre-multiplied copy', () => {
    expect(conditionedRateProblems({ ...good, rate: 0.5 }))
      .toEqual([expect.stringContaining('does not equal k/n')]);
  });

  it('rejects k > n — a numerator larger than its conditioning population', () => {
    expect(conditionedRateProblems({ k: 13, n: 12, rate: 13 / 12, conditional: 'P(a | b)' }))
      .toEqual([expect.stringContaining('exceeds n')]);
  });

  it('rejects a conditional that does not state its conditioning set', () => {
    expect(conditionedRateProblems({ ...good, conditional: 'the fold rate' }))
      .toEqual([expect.stringContaining('does not state its conditioning set')]);
  });
});

describe('the conditioned-rate walk — canonical aliases are validated wherever they nest', () => {
  it('catches a broken {k, n, rate, conditional} buried inside an undeclared container', () => {
    const m = fixtureFor('study-ladder');
    m.axes = {
      limpRate: {
        evalK: 3, evalN: 12, evalRate: 0.25,
        conditioned: { k: 3, n: 12, rate: 0.5, conditional: 'P(limp | first action, not BB)' },
      },
    };
    expect(metricsProblems(m)).toEqual([
      expect.stringContaining('axes.limpRate.conditioned'),
    ]);
    expect(metricsProblems(m)[0]).toContain('does not equal k/n');
  });

  it('does not fire on look-alikes — {flips, n} is not a conditioned rate', () => {
    const m = fixtureFor('depth-ablation');
    m.flipCountByStreet = { river: { flips: 8, n: 10 } };
    expect(metricsProblems(m)).toEqual([]);
  });

  it('walks arrays — a bad row in holdOutBySizeBucketConditioned is named by index', () => {
    const m = fixtureFor('fold-curve-shape');
    m.holdOutBySizeBucketConditioned = [
      { bucket: '0-33', conditioned: { k: 0, n: 0, rate: 0.2, conditional: 'P(fold | bucket)' } },
    ];
    const problems = metricsProblems(m);
    expect(problems).toEqual([expect.stringContaining('holdOutBySizeBucketConditioned[0].conditioned')]);
    expect(problems[0]).toContain('must be NULL when n is 0');
  });
});

describe('overallEvFactorProblems — the product never travels without both factors', () => {
  it('is silent when the product is absent or null', () => {
    expect(overallEvFactorProblems({ kind: 'hero-ev' })).toEqual([]);
    expect(overallEvFactorProblems({ overallEvBB100: null })).toEqual([]);
  });

  it('rejects the product without its factors', () => {
    const problems = overallEvFactorProblems({ overallEvBB100: 5, edgeBB: null, opportunitiesPerHand: 2.1 });
    expect(problems).toEqual([expect.stringContaining('edgeBB is null')]);
    expect(problems[0]).toContain('composeOverallEv');
  });

  it('accepts the product with both factors finite', () => {
    expect(overallEvFactorProblems({ overallEvBB100: 5, edgeBB: 0.024, opportunitiesPerHand: 2.1 }))
      .toEqual([]);
  });
});

describe('the declared v1 shapes match real committed artifacts', () => {
  // Each case attaches the kind to a real card's metrics block. A transcription error in
  // metricsSchemas.js (wrong type, missed key, wrong required) fails HERE, against the
  // artifact, rather than at the next production run.
  const cases = [
    ['depth-ablation', 'docs/standard-of-record/cards/RC-depth-ablation.json'],
    ['layer-divergence', 'docs/standard-of-record/cards/RC-layer-divergence.json'],
    ['river-flip-replicate', 'docs/standard-of-record/cards/RC-river-flip-replicate.json'],
    ['river-flip-replicate', 'docs/standard-of-record/cards/RC-river-flip-replicate-ws378fix.json'],
    ['atoms-instrument', '.artifacts/atoms/gen1.card.json'],
    ['atoms-instrument', '.artifacts/atoms/gen2.card.json'],
    ['study-ladder', '.artifacts/study-ladder.card.json'],
  ];

  for (const [kind, rel] of cases) {
    it(`${rel} validates as ${kind} once a kind is attached`, () => {
      const card = readCard(rel);
      expect(metricsProblems({ kind, ...card.metrics })).toEqual([]);
    });
  }
});

describe('legacy asymmetry — committed cards stay legible, become unpublishable', () => {
  it('RC-depth-ablation.json parses cleanly and fails metricsProblems on kind alone', () => {
    const card = readCard('docs/standard-of-record/cards/RC-depth-ablation.json');
    // READABLE: the Result Card schema still sees metrics as a bare required object.
    expect(checkAgainstSchema(card, SOR_SCHEMAS.resultCard, { label: 'resultCard' })).toEqual([]);
    // UNPUBLISHABLE: the metrics validator asks for the kind the card predates.
    expect(metricsProblems(card.metrics)).toEqual([expect.stringContaining('kind is required')]);
  });

  it('resultCardProblems (the publish path) names metrics.kind on a legacy card — commit C wiring', () => {
    const card = readCard('docs/standard-of-record/cards/RC-depth-ablation.json');
    const problems = resultCardProblems(card);
    expect(problems.some((p) => p.includes('kind is required to PUBLISH'))).toBe(true);
  });

  it('a fully-declared card passes the wired publish path end to end', () => {
    const card = readCard('docs/standard-of-record/cards/RC-depth-ablation.json');
    const withKind = { ...card, metrics: { kind: 'depth-ablation', ...card.metrics } };
    // The manifest half may or may not hold problems of its own era; assert only that the
    // metrics half is clean — no problem mentions metrics.
    expect(resultCardProblems(withKind).filter((p) => p.includes('resultCard.metrics'))).toEqual([]);
  });
});

describe('fault-matcher non-regression — adding `kind` changes no matcher verdict', () => {
  // The fault register's metrics-facing matchers are regexes over top-level key names and
  // values. `kind` (a string value, no ev/edge/bb/ci/n token as a whole key) must be inert:
  // for every entry that reads metrics, the verdict on a card with kind must equal the
  // verdict without it.
  const metricsFacing = SUSPECTED_FAULTS.filter(
    (e) => (e.matchesOn ?? []).some((p) => p.startsWith('metrics.')),
  );

  it('at least one metrics-facing matcher exists (the test is not vacuous)', () => {
    expect(metricsFacing.length).toBeGreaterThan(0);
  });

  const baseCards = [
    readCard('docs/standard-of-record/cards/RC-depth-ablation.json'),
    readCard('docs/standard-of-record/cards/RC-layer-divergence.json'),
    readCard('.artifacts/atoms/gen1.card.json'),
  ];

  it('matches(cardWithKind) === matches(cardWithoutKind) for every metrics-facing entry', () => {
    for (const entry of metricsFacing) {
      for (const card of baseCards) {
        const withKind = { ...card, metrics: { kind: 'depth-ablation', ...card.metrics } };
        expect(
          Boolean(entry.matches(withKind)),
          `${entry.faultId} changed its verdict when metrics.kind was added`,
        ).toBe(Boolean(entry.matches(card)));
      }
    }
  });
});
