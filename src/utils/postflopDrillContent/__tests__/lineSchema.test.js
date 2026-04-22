import { describe, it, expect } from 'vitest';
import {
  validateLine,
  walkLine,
  lineStats,
  SECTION_KINDS,
  STREETS,
  POT_TYPES,
  VILLAIN_ACTION_KINDS,
  SCHEMA_VERSION,
  resolveBranchCorrect,
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

// ---------- v2: heroHolding (RT-106) ---------- //

describe('SCHEMA_VERSION', () => {
  it('exports schema version 2 (RT-106)', () => {
    expect(SCHEMA_VERSION).toBe(2);
  });
});

describe('Node.heroHolding (RT-106)', () => {
  it('accepts a node with no heroHolding (additive-optional)', () => {
    const line = minimalValidLine();
    expect(line.nodes.root.heroHolding).toBeUndefined();
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts heroHolding with combos only', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = { combos: ['A♠K♥'] };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts heroHolding with bucketCandidates only', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = { bucketCandidates: ['topSet', 'tptk'] };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts heroHolding with both combos and bucketCandidates', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = {
      combos: ['A♠K♥', '7♦7♣'],
      bucketCandidates: ['topSet', 'overpair'],
    };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects heroHolding that is not an object', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = 'AsKh';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('heroHolding must be an object'))).toBe(true);
  });

  it('rejects empty heroHolding (neither field present)', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = {};
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('requires combos or bucketCandidates'))).toBe(true);
  });

  it('rejects empty combos array', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = { combos: [] };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('combos must be a non-empty array'))).toBe(true);
  });

  it('rejects malformed combo string', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = { combos: ['AsKh'] }; // ascii suits not allowed
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("combos[0] 'AsKh'"))).toBe(true);
  });

  it('rejects combo with duplicate card', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = { combos: ['A♠A♠'] };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('duplicate card'))).toBe(true);
  });

  it('rejects empty bucketCandidates array', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = { bucketCandidates: [] };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('bucketCandidates must be a non-empty array'))).toBe(true);
  });

  it('rejects bucketCandidates containing a non-string entry', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = { bucketCandidates: ['topSet', 42] };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('bucketCandidates[1]'))).toBe(true);
  });

  // LSW-H1 (2026-04-22) — surface audit S7.
  it('rejects `air` in bucketCandidates when combos is non-empty (range-level bucket vs pinned combo)', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = {
      combos: ['A♠K♥'],
      bucketCandidates: ['topSet', 'air'],
    };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("may not include 'air'"))).toBe(true);
  });

  it('accepts `air` in bucketCandidates when no combos are pinned (pure range-level teaching)', () => {
    const line = minimalValidLine();
    line.nodes.root.heroHolding = {
      bucketCandidates: ['topSet', 'air'],
    };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });
});

// ---------- v2: compute.seed (LSW-H1, 2026-04-22) ---------- //

describe('Section.compute.seed (LSW-H1)', () => {
  const withComputeSeed = (seed) => {
    const line = minimalValidLine();
    line.nodes.root.sections = [
      { kind: 'compute', calculator: 'potOdds', seed },
    ];
    return line;
  };

  it('accepts compute section without seed (additive-optional)', () => {
    const line = minimalValidLine();
    line.nodes.root.sections = [{ kind: 'compute', calculator: 'potOdds' }];
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts compute section with valid seed { pot, bet }', () => {
    const { ok, errors } = validateLine(withComputeSeed({ pot: 27.3, bet: 6.8 }));
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts seed with only pot (sparse pin)', () => {
    const { ok, errors } = validateLine(withComputeSeed({ pot: 50 }));
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects seed that is not an object', () => {
    const { ok, errors } = validateLine(withComputeSeed('27.3/6.8'));
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('compute.seed must be an object'))).toBe(true);
  });

  it('rejects seed with non-numeric values', () => {
    const { ok, errors } = validateLine(withComputeSeed({ pot: 'big', bet: 6.8 }));
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("compute.seed['pot']"))).toBe(true);
  });

  it('rejects seed with negative values', () => {
    const { ok, errors } = validateLine(withComputeSeed({ pot: 27, bet: -5 }));
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("compute.seed['bet']"))).toBe(true);
  });

  it('rejects seed with NaN / Infinity', () => {
    const { ok: ok1, errors: e1 } = validateLine(withComputeSeed({ pot: NaN }));
    expect(ok1).toBe(false);
    expect(e1.some((e) => e.includes("compute.seed['pot']"))).toBe(true);
    const { ok: ok2, errors: e2 } = validateLine(withComputeSeed({ bet: Infinity }));
    expect(ok2).toBe(false);
    expect(e2.some((e) => e.includes("compute.seed['bet']"))).toBe(true);
  });
});

// ---------- v2: Decision.branches[].correctByArchetype (RT-107) ---------- //

describe('Decision.branches[].correctByArchetype (RT-107)', () => {
  it('accepts branches without correctByArchetype (additive-optional)', () => {
    const line = minimalValidLine();
    // baseline fixture has no correctByArchetype anywhere — still valid
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('accepts correctByArchetype when at least one branch is correct per declared archetype', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches[0].correctByArchetype = { fish: true, pro: false };
    line.nodes.root.decision.branches[1].correctByArchetype = { fish: false, pro: true };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('rejects correctByArchetype whose value is not boolean', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches[0].correctByArchetype = { fish: 'yes' };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("correctByArchetype['fish']"))).toBe(true);
  });

  it('rejects correctByArchetype that is not an object', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches[0].correctByArchetype = 'fish';
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('correctByArchetype must be an object'))).toBe(true);
  });

  it('rejects empty correctByArchetype object', () => {
    const line = minimalValidLine();
    line.nodes.root.decision.branches[0].correctByArchetype = {};
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes('must have at least one archetype key'))).toBe(true);
  });

  it('rejects when an archetype has no correct branch across the decision', () => {
    const line = minimalValidLine();
    // Declare fish archetype but never mark any branch correct under it.
    line.nodes.root.decision.branches[0].correctByArchetype = { fish: false };
    line.nodes.root.decision.branches[1].correctByArchetype = { fish: false };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(false);
    expect(errors.some((e) => e.includes("archetype 'fish' has no branch"))).toBe(true);
  });

  it('different branches may declare different archetype sets, each must have ≥1 correct', () => {
    // RT-107 allows a branch to opt into a subset of archetypes; the decision-
    // level check aggregates across all branches.
    const line = minimalValidLine();
    line.nodes.root.decision.branches[0].correctByArchetype = { fish: true };
    line.nodes.root.decision.branches[1].correctByArchetype = { pro: true };
    const { ok, errors } = validateLine(line);
    expect(ok).toBe(true);
    expect(errors).toEqual([]);
  });

  it('flat `correct` still authoritative when correctByArchetype absent', () => {
    // This test codifies the fallback contract: existing content without
    // correctByArchetype continues to work exactly as before (archetype
    // toggle is post-v1; renderer reads branch.correct until RT-107 ships
    // a toggle).
    const line = minimalValidLine();
    // No correctByArchetype anywhere.
    line.nodes.root.decision.branches.forEach((b) => {
      expect(b.correctByArchetype).toBeUndefined();
    });
    const { ok } = validateLine(line);
    expect(ok).toBe(true);
  });
});

describe('resolveBranchCorrect', () => {
  it('returns flat correct when no archetype is active', () => {
    expect(resolveBranchCorrect({ correct: true })).toBe(true);
    expect(resolveBranchCorrect({ correct: false })).toBe(false);
  });

  it('returns flat correct when branch has no correctByArchetype', () => {
    expect(resolveBranchCorrect({ correct: true }, 'fish')).toBe(true);
    expect(resolveBranchCorrect({ correct: false }, 'pro')).toBe(false);
  });

  it('returns archetype-specific value when correctByArchetype[archetype] is defined', () => {
    const branch = { correct: true, correctByArchetype: { fish: false, reg: true, pro: true } };
    expect(resolveBranchCorrect(branch, 'fish')).toBe(false);
    expect(resolveBranchCorrect(branch, 'reg')).toBe(true);
    expect(resolveBranchCorrect(branch, 'pro')).toBe(true);
  });

  it('falls back to flat correct when archetype not declared in correctByArchetype', () => {
    // Branch declares only fish; asking for pro should fall back to flat correct.
    const branch = { correct: true, correctByArchetype: { fish: false } };
    expect(resolveBranchCorrect(branch, 'fish')).toBe(false);
    expect(resolveBranchCorrect(branch, 'pro')).toBe(true);
    expect(resolveBranchCorrect(branch, 'whale')).toBe(true);
  });

  it('handles null/undefined branch gracefully', () => {
    expect(resolveBranchCorrect(null)).toBe(false);
    expect(resolveBranchCorrect(undefined, 'fish')).toBe(false);
  });

  it('ignores non-boolean correctByArchetype entries (schema would reject them, but be defensive)', () => {
    const branch = { correct: true, correctByArchetype: { fish: 'truthy-string' } };
    // Schema validator would reject this at validate time; resolver falls
    // back to flat correct when the entry is non-boolean.
    expect(resolveBranchCorrect(branch, 'fish')).toBe(true);
  });
});
