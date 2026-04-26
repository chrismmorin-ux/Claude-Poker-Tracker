import { describe, it, expect } from 'vitest';
import parser from '@babel/parser';
import {
  evaluateLiteral,
  validateCoherence,
  extractCoherence,
  buildGraph,
  computeDrift,
} from '../coherence-scan.cjs';

function parseExpression(src) {
  // Wrap as a variable initializer so we can pluck the expression node.
  const ast = parser.parse(`const _ = ${src};`, { sourceType: 'module' });
  return ast.program.body[0].declarations[0].init;
}

describe('evaluateLiteral', () => {
  it('handles primitive types', () => {
    expect(evaluateLiteral(parseExpression('"hello"'))).toBe('hello');
    expect(evaluateLiteral(parseExpression('42'))).toBe(42);
    expect(evaluateLiteral(parseExpression('-3'))).toBe(-3);
    expect(evaluateLiteral(parseExpression('true'))).toBe(true);
    expect(evaluateLiteral(parseExpression('false'))).toBe(false);
    expect(evaluateLiteral(parseExpression('null'))).toBe(null);
  });

  it('handles arrays and nested objects', () => {
    const result = evaluateLiteral(
      parseExpression(`{ a: ['x', 'y'], b: { c: 1, d: [true, null] } }`)
    );
    expect(result).toEqual({ a: ['x', 'y'], b: { c: 1, d: [true, null] } });
  });

  it('rejects spread elements', () => {
    expect(() => evaluateLiteral(parseExpression(`{ ...x }`))).toThrow();
  });

  it('rejects function calls', () => {
    expect(() => evaluateLiteral(parseExpression(`foo()`))).toThrow();
  });

  it('rejects identifier references', () => {
    expect(() => evaluateLiteral(parseExpression(`{ a: someVar }`))).toThrow();
  });

  it('rejects computed keys', () => {
    expect(() => evaluateLiteral(parseExpression(`{ ['x']: 1 }`))).toThrow();
  });

  it('rejects template literals', () => {
    expect(() => evaluateLiteral(parseExpression('`hello`'))).toThrow();
  });
});

describe('validateCoherence', () => {
  const baseValid = {
    id: 'exploit.foo',
    kind: 'primitive',
    produces: ['ev'],
    status: 'integrated',
  };

  it('accepts a minimal valid primitive', () => {
    expect(validateCoherence(baseValid, 'foo.js')).toEqual([]);
  });

  it('rejects missing id', () => {
    const errs = validateCoherence({ ...baseValid, id: undefined }, 'foo.js');
    expect(errs.some((e) => e.includes("'id'"))).toBe(true);
  });

  it('rejects malformed id', () => {
    const errs = validateCoherence({ ...baseValid, id: 'NotKebab' }, 'foo.js');
    expect(errs.some((e) => e.includes('kebab-case'))).toBe(true);
  });

  it('rejects unknown kind', () => {
    const errs = validateCoherence({ ...baseValid, kind: 'wizard' }, 'foo.js');
    expect(errs.some((e) => e.includes("'kind'"))).toBe(true);
  });

  it('rejects unknown status', () => {
    const errs = validateCoherence({ ...baseValid, status: 'almost' }, 'foo.js');
    expect(errs.some((e) => e.includes("'status'"))).toBe(true);
  });

  it('requires produces for primitive/aggregator/research', () => {
    expect(
      validateCoherence({ ...baseValid, produces: undefined }, 'foo.js').some((e) =>
        e.includes("'produces'")
      )
    ).toBe(true);
    expect(
      validateCoherence({ ...baseValid, produces: [] }, 'foo.js').some((e) =>
        e.includes("'produces'")
      )
    ).toBe(true);
  });

  it('requires consumes for surface', () => {
    const errs = validateCoherence(
      { id: 'surface.x', kind: 'surface', status: 'integrated' },
      'foo.js'
    );
    expect(errs.some((e) => e.includes("'consumes'"))).toBe(true);
  });

  it('requires consumes for aggregator', () => {
    const errs = validateCoherence(
      { id: 'hook.x', kind: 'aggregator', produces: ['ev'], status: 'integrated' },
      'foo.js'
    );
    expect(errs.some((e) => e.includes("'consumes'"))).toBe(true);
  });

  it('requires targetIntegration when status=pending-absorption', () => {
    const errs = validateCoherence(
      { ...baseValid, status: 'pending-absorption' },
      'foo.js'
    );
    expect(errs.some((e) => e.includes("'targetIntegration'"))).toBe(true);
  });

  it('requires targetIntegration when kind=research', () => {
    const errs = validateCoherence(
      { id: 'drill.x', kind: 'research', produces: ['shape'], status: 'pending-absorption' },
      'foo.js'
    );
    expect(errs.some((e) => e.includes("'targetIntegration'"))).toBe(true);
  });

  it('validates targetIntegration.layer enum', () => {
    const errs = validateCoherence(
      {
        ...baseValid,
        status: 'pending-absorption',
        targetIntegration: { layer: 'wizard', deadline: '2026-07-01' },
      },
      'foo.js'
    );
    expect(errs.some((e) => e.includes('targetIntegration.layer'))).toBe(true);
  });

  it('validates targetIntegration.deadline format', () => {
    const errs = validateCoherence(
      {
        ...baseValid,
        status: 'pending-absorption',
        targetIntegration: { layer: 'aggregator', deadline: 'tomorrow' },
      },
      'foo.js'
    );
    expect(errs.some((e) => e.includes('deadline'))).toBe(true);
  });

  it('validates pipelineStep range', () => {
    expect(
      validateCoherence({ ...baseValid, pipelineStep: 0 }, 'foo.js').some((e) =>
        e.includes('pipelineStep')
      )
    ).toBe(true);
    expect(
      validateCoherence({ ...baseValid, pipelineStep: 9 }, 'foo.js').some((e) =>
        e.includes('pipelineStep')
      )
    ).toBe(true);
    expect(
      validateCoherence({ ...baseValid, pipelineStep: 1.5 }, 'foo.js').some((e) =>
        e.includes('pipelineStep')
      )
    ).toBe(true);
    expect(validateCoherence({ ...baseValid, pipelineStep: 4 }, 'foo.js')).toEqual([]);
  });

  it('rejects pipelineStep on non-primitive kind', () => {
    const errs = validateCoherence(
      {
        id: 'hook.x',
        kind: 'aggregator',
        produces: ['ev'],
        consumes: ['fold-rate'],
        status: 'integrated',
        pipelineStep: 2,
      },
      'foo.js'
    );
    expect(errs.some((e) => e.includes('primitive'))).toBe(true);
  });
});

describe('extractCoherence', () => {
  it('locates a named export', () => {
    const src = `
      import x from 'y';
      export const __coherence__ = {
        id: 'exploit.foo',
        kind: 'primitive',
        produces: ['ev'],
        status: 'integrated',
      };
      export const helper = 1;
    `;
    const r = extractCoherence(src, 'foo.js');
    expect(r.coherence).toBeDefined();
    expect(r.coherence.id).toBe('exploit.foo');
  });

  it('marks @coherence-exempt files', () => {
    const src = `// @coherence-exempt: pure utility shim\nexport const x = 1;`;
    const r = extractCoherence(src, 'foo.js');
    expect(r.exempt).toBe(true);
    expect(r.exemptReason).toBe('pure utility shim');
  });

  it('marks files without __coherence__ as undeclared', () => {
    const src = `export const x = 1;`;
    const r = extractCoherence(src, 'foo.js');
    expect(r.undeclared).toBe(true);
  });

  it('returns evalError for non-literal expressions', () => {
    const src = `export const __coherence__ = computeMetadata();`;
    const r = extractCoherence(src, 'foo.js');
    expect(r.evalError).toBeDefined();
  });

  it('returns parseError on invalid JS', () => {
    const src = `export const = `;
    const r = extractCoherence(src, 'foo.js');
    expect(r.parseError).toBeDefined();
  });
});

describe('buildGraph', () => {
  it('detects id collisions', () => {
    const modules = [
      { relPath: 'a.js', coherence: { id: 'x.foo', kind: 'primitive', produces: ['ev'] } },
      { relPath: 'b.js', coherence: { id: 'x.foo', kind: 'primitive', produces: ['ev'] } },
    ];
    const g = buildGraph(modules);
    expect(g.idCollisions).toHaveLength(1);
    expect(g.idCollisions[0].id).toBe('x.foo');
  });

  it('indexes producers and consumers by tag', () => {
    const modules = [
      { relPath: 'a.js', coherence: { id: 'x.a', kind: 'primitive', produces: ['ev'] } },
      {
        relPath: 'b.js',
        coherence: { id: 'x.b', kind: 'aggregator', produces: ['briefing'], consumes: ['ev'] },
      },
    ];
    const g = buildGraph(modules);
    expect(g.producersByTag.get('ev')).toEqual(['x.a']);
    expect(g.consumersByTag.get('ev')).toEqual(['x.b']);
  });
});

describe('computeDrift', () => {
  function buildScenario(modules) {
    const g = buildGraph(modules);
    const today = new Date('2026-04-26T00:00:00Z');
    return computeDrift({ modules, graph: g, today });
  }

  it('flags orphan primitives', () => {
    const drift = buildScenario([
      { relPath: 'a.js', coherence: { id: 'x.a', kind: 'primitive', produces: ['ev', 'fold-rate'] } },
      { relPath: 'b.js', coherence: { id: 'x.b', kind: 'surface', consumes: ['ev'] } },
    ]);
    const tags = drift.orphans.map((o) => o.tag);
    expect(tags).toContain('fold-rate');
    expect(tags).not.toContain('ev');
  });

  it('does not flag research-only orphans (deadline machinery handles them)', () => {
    const drift = buildScenario([
      {
        relPath: 'r.js',
        coherence: {
          id: 'drill.shapes',
          kind: 'research',
          produces: ['shape'],
          status: 'pending-absorption',
          targetIntegration: { layer: 'aggregator', deadline: '2099-01-01' },
        },
      },
    ]);
    const tags = drift.orphans.map((o) => o.tag);
    expect(tags).not.toContain('shape');
  });

  it('flags dangling consumers', () => {
    const drift = buildScenario([
      { relPath: 's.js', coherence: { id: 'x.s', kind: 'surface', consumes: ['unknown-tag'] } },
    ]);
    const tags = drift.danglingConsumers.map((d) => d.tag);
    expect(tags).toContain('unknown-tag');
  });

  it('flags expired deadlines', () => {
    const drift = buildScenario([
      {
        relPath: 'r.js',
        coherence: {
          id: 'drill.x',
          kind: 'research',
          produces: ['shape'],
          status: 'pending-absorption',
          targetIntegration: { layer: 'aggregator', deadline: '2020-01-01' },
        },
      },
    ]);
    expect(drift.expiredDeadlines).toHaveLength(1);
    expect(drift.expiredDeadlines[0].id).toBe('drill.x');
  });

  it('does not flag deadlines for integrated modules', () => {
    const drift = buildScenario([
      {
        relPath: 'r.js',
        coherence: {
          id: 'drill.x',
          kind: 'research',
          produces: ['shape'],
          status: 'integrated',
          targetIntegration: { layer: 'aggregator', deadline: '2020-01-01' },
        },
      },
    ]);
    expect(drift.expiredDeadlines).toHaveLength(0);
  });

  it('flags unfulfilled expectedConsumers', () => {
    const drift = buildScenario([
      {
        relPath: 'r.js',
        coherence: {
          id: 'drill.shapes',
          kind: 'research',
          produces: ['shape'],
          status: 'pending-absorption',
          targetIntegration: {
            layer: 'aggregator',
            deadline: '2099-01-01',
            expectedConsumers: ['hook.live-action-advisor'],
          },
        },
      },
    ]);
    expect(drift.unfulfilledExpectations).toHaveLength(1);
    expect(drift.unfulfilledExpectations[0].expected).toBe('hook.live-action-advisor');
  });

  it('clears unfulfilled when expected consumer declares the right tag', () => {
    const drift = buildScenario([
      {
        relPath: 'r.js',
        coherence: {
          id: 'drill.shapes',
          kind: 'research',
          produces: ['shape'],
          status: 'pending-absorption',
          targetIntegration: {
            layer: 'aggregator',
            deadline: '2099-01-01',
            expectedConsumers: ['hook.x'],
          },
        },
      },
      {
        relPath: 'h.js',
        coherence: {
          id: 'hook.x',
          kind: 'aggregator',
          produces: ['briefing'],
          consumes: ['shape'],
          status: 'integrated',
        },
      },
    ]);
    expect(drift.unfulfilledExpectations).toHaveLength(0);
  });

  it('reports new (non-seed) tags for vocabulary triage', () => {
    const drift = buildScenario([
      { relPath: 'a.js', coherence: { id: 'x.a', kind: 'primitive', produces: ['totally-new-tag'] } },
    ]);
    expect(drift.newTags).toContain('totally-new-tag');
  });
});
