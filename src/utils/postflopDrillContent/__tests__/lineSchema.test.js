import { describe, it, expect } from 'vitest';
import {
  validateLine,
  walkLine,
  lineStats,
  SECTION_KINDS,
  STREETS,
  POT_TYPES,
  VILLAIN_ACTION_KINDS,
} from '../lineSchema';

// ---------- Fixture builders ---------- //

const minimalValidLine = () => ({
  id: 'fixture-line',
  title: 'Fixture',
  summary: 'Minimal valid line for testing.',
  setup: {
    hero: { position: 'BTN' },
    villains: [{ position: 'BB', action: 'call', vs: 'BTN' }],
    potType: 'srp',
    effStack: 100,
  },
  rootId: 'root',
  nodes: {
    root: {
      id: 'root',
      street: 'flop',
      board: ['Q♠', '7♥', '2♣'],
      pot: 5.5,
      villainAction: { kind: 'check' },
      sections: [{ kind: 'prose', body: 'some text' }],
      decision: {
        prompt: 'cbet or check?',
        branches: [
          { label: 'cbet', nextId: 'leaf', correct: true, rationale: 'correct' },
          { label: 'check', nextId: 'leaf', correct: false, rationale: 'wrong' },
        ],
      },
    },
    leaf: {
      id: 'leaf',
      street: 'turn',
      board: ['Q♠', '7♥', '2♣', '3♦'],
      pot: 9.0,
      sections: [{ kind: 'prose', body: 'terminal' }],
    },
  },
});

// ---------- Exports sanity ---------- //

describe('lineSchema constant exports', () => {
  it('exports the section kinds', () => {
    expect(SECTION_KINDS).toContain('prose');
    expect(SECTION_KINDS).toContain('why');
    expect(SECTION_KINDS).toContain('adjust');
    expect(SECTION_KINDS).toContain('mismatch');
    expect(SECTION_KINDS).toContain('compute');
  });

  it('exports street, pot type, and villain action kind sets', () => {
    expect(STREETS).toEqual(['flop', 'turn', 'river']);
    expect(POT_TYPES).toContain('srp');
    expect(POT_TYPES).toContain('3bp');
    expect(POT_TYPES).toContain('srp-3way');
    expect(VILLAIN_ACTION_KINDS).toContain('check');
    expect(VILLAIN_ACTION_KINDS).toContain('bet');
    expect(VILLAIN_ACTION_KINDS).toContain('donk');
  });
});

// ---------- validateLine — happy path ---------- //

describe('validateLine — valid fixture', () => {
  it('passes the minimal valid line', () => {
    const { ok, errors } = validateLine(minimalValidLine());
    expect(errors).toEqual([]);
    expect(ok).toBe(true);
  });
});

// ---------- validateLine — rejections ---------- //

describe('validateLine — malformed lines', () => {
  it('rejects missing top-level fields', () => {
    const { ok, errors } = validateLine({});
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('line.id'))).toBe(true);
    expect(errors.some((e) => e.includes('line.title'))).toBe(true);
    expect(errors.some((e) => e.includes('line.rootId'))).toBe(true);
  });

  it('rejects non-object input', () => {
    expect(validateLine(null).ok).toBe(false);
    expect(validateLine(undefined).ok).toBe(false);
    expect(validateLine(42).ok).toBe(false);
    expect(validateLine('hello').ok).toBe(false);
  });

  it('rejects unresolved rootId', () => {
    const line = minimalValidLine();
    line.rootId = 'nonexistent';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("rootId 'nonexistent'"))).toBe(true);
  });

  it('rejects invalid potType', () => {
    const line = minimalValidLine();
    line.setup.potType = 'made-up';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('potType'))).toBe(true);
  });

  it('rejects villain without vs when action=call', () => {
    const line = minimalValidLine();
    line.setup.villains = [{ position: 'BB', action: 'call' }];
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('villain.vs required'))).toBe(true);
  });

  it('accepts villain with open action without vs', () => {
    const line = minimalValidLine();
    line.setup.villains = [{ position: 'UTG', action: 'open' }];
    const { ok } = validateLine(line);
    expect(ok).toBe(true);
  });

  it('rejects empty villains array', () => {
    const line = minimalValidLine();
    line.setup.villains = [];
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('villains'))).toBe(true);
  });

  it('rejects bad section kind', () => {
    const line = minimalValidLine();
    line.nodes.root.sections = [{ kind: 'bogus', body: 'x' }];
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("'bogus'"))).toBe(true);
  });

  it('rejects prose section without body', () => {
    const line = minimalValidLine();
    line.nodes.root.sections = [{ kind: 'prose' }];
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('non-empty body'))).toBe(true);
  });

  it('rejects empty sections array', () => {
    const line = minimalValidLine();
    line.nodes.root.sections = [];
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('sections required'))).toBe(true);
  });

  it('rejects decision with fewer than 2 branches', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches = [
      { label: 'only', nextId: 'leaf', correct: true, rationale: 'solo' },
    ];
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('at least 2 entries'))).toBe(true);
  });

  it('rejects decision with no correct branch', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches.forEach((b) => { b.correct = false; });
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('at least one branch with correct=true'))).toBe(true);
  });

  it('rejects branch with unresolved nextId', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches[0].nextId = 'ghost';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("'ghost' does not resolve"))).toBe(true);
  });

  it('rejects branch without rationale', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches[0].rationale = '';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('rationale required'))).toBe(true);
  });

  it('rejects wrong board length for street', () => {
    const line = minimalValidLine();
    line.nodes.root.board = ['Q♠', '7♥']; // only 2 cards for flop
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("expects 3"))).toBe(true);
  });

  it('rejects wrong turn board length', () => {
    const line = minimalValidLine();
    line.nodes.leaf.board = ['Q♠', '7♥', '2♣']; // only 3 cards for turn
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("expects 4"))).toBe(true);
  });

  it('rejects negative pot', () => {
    const line = minimalValidLine();
    line.nodes.root.pot = -1;
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('pot must be non-negative'))).toBe(true);
  });

  it('rejects invalid villainAction.kind', () => {
    const line = minimalValidLine();
    line.nodes.root.villainAction = { kind: 'meow' };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("'meow'"))).toBe(true);
  });

  it('rejects bad street value', () => {
    const line = minimalValidLine();
    line.nodes.root.street = 'preflop';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("street 'preflop'"))).toBe(true);
  });

  it('rejects orphan nodes (unreachable)', () => {
    const line = minimalValidLine();
    line.nodes.orphan = {
      id: 'orphan',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 0,
      sections: [{ kind: 'prose', body: 'nobody reads me' }],
    };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('orphan nodes'))).toBe(true);
  });

  it('rejects cycles', () => {
    const line = minimalValidLine();
    // route leaf back to root
    line.nodes.leaf.decision = {
      prompt: 'continue?',
      branches: [
        { label: 'back to root', nextId: 'root', correct: true, rationale: 'loop' },
        { label: 'stop', nextId: null, correct: false, rationale: 'terminal' },
      ],
    };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('cycles detected'))).toBe(true);
  });

  it('rejects mismatched node.id and key', () => {
    const line = minimalValidLine();
    line.nodes.root.id = 'not-root';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('must match key'))).toBe(true);
  });
});

// ---------- walkLine ---------- //

describe('walkLine', () => {
  it('returns every reachable node from root', () => {
    const line = minimalValidLine();
    const { reachable } = walkLine(line);
    expect(reachable.size).toBe(2);
    expect(reachable.has('root')).toBe(true);
    expect(reachable.has('leaf')).toBe(true);
  });

  it('omits unreachable nodes', () => {
    const line = minimalValidLine();
    line.nodes.ghost = {
      id: 'ghost',
      street: 'river',
      board: ['Q♠', '7♥', '2♣', '3♦', '8♠'],
      pot: 0,
      sections: [{ kind: 'prose', body: 'x' }],
    };
    const { reachable } = walkLine(line);
    expect(reachable.has('ghost')).toBe(false);
    expect(reachable.size).toBe(2);
  });

  it('detects cycles', () => {
    const line = minimalValidLine();
    line.nodes.leaf.decision = {
      prompt: 'loop?',
      branches: [
        { label: 'yes', nextId: 'root', correct: true, rationale: 'loop' },
        { label: 'no',  nextId: null,    correct: false, rationale: 'stop' },
      ],
    };
    const { cycles } = walkLine(line);
    expect(cycles.length).toBeGreaterThan(0);
  });

  it('handles DAG convergence (two branches to same child) without double-counting', () => {
    const line = minimalValidLine();
    const { reachable } = walkLine(line);
    // both branches of root point to 'leaf' — should still only count it once.
    expect(reachable.size).toBe(2);
  });

  it('handles empty / missing input', () => {
    expect(walkLine(null).reachable.size).toBe(0);
    expect(walkLine({}).reachable.size).toBe(0);
    expect(walkLine({ nodes: {} }).reachable.size).toBe(0);
  });
});

// ---------- lineStats ---------- //

describe('lineStats', () => {
  it('counts decision vs terminal nodes correctly', () => {
    const line = minimalValidLine();
    const stats = lineStats(line);
    expect(stats.totalNodes).toBe(2);
    expect(stats.reachableNodes).toBe(2);
    expect(stats.decisionNodes).toBe(1);
    expect(stats.terminalNodes).toBe(1);
    expect(stats.branches).toBe(2);
  });

  it('counts stub branches (null nextId)', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches.push({
      label: 'hang up', nextId: null, correct: false, rationale: 'stubbed out',
    });
    const stats = lineStats(line);
    expect(stats.branches).toBe(3);
    expect(stats.stubBranches).toBe(1);
  });
});
