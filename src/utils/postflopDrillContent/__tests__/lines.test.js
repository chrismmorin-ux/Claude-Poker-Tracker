import { describe, it, expect } from 'vitest';
import { LINES, findLine, listLines } from '../lines';
import { validateLine, walkLine, lineStats } from '../lineSchema';

describe('lines catalog', () => {
  it('exports a non-empty LINES array', () => {
    expect(Array.isArray(LINES)).toBe(true);
    expect(LINES.length).toBeGreaterThan(0);
  });

  it('every line has a unique id', () => {
    const ids = LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('findLine returns the right line by id', () => {
    const first = LINES[0];
    expect(findLine(first.id)).toBe(first);
  });

  it('findLine returns null for missing id', () => {
    expect(findLine('does-not-exist')).toBeNull();
  });

  it('listLines returns id/title/summary/tags for every line', () => {
    const summary = listLines();
    expect(summary.length).toBe(LINES.length);
    for (const entry of summary) {
      expect(entry.id).toBeTruthy();
      expect(entry.title).toBeTruthy();
      expect(entry.summary).toBeTruthy();
      expect(Array.isArray(entry.tags)).toBe(true);
    }
  });
});

describe('every LINE validates against the schema', () => {
  for (const line of LINES) {
    describe(`line: ${line.id}`, () => {
      it('passes full validation with zero errors', () => {
        const { ok, errors } = validateLine(line);
        if (!ok) {
          // Surface the first few errors in the failure message for fast diagnosis.
          console.error(`Validation errors for ${line.id}:\n${errors.slice(0, 10).join('\n')}`);
        }
        expect(errors).toEqual([]);
        expect(ok).toBe(true);
      });

      it('has zero unreachable nodes', () => {
        const { reachable, cycles } = walkLine(line);
        const total = Object.keys(line.nodes).length;
        expect(reachable.size).toBe(total);
        expect(cycles).toEqual([]);
      });

      it('has at least one decision node (not all terminals)', () => {
        const stats = lineStats(line);
        expect(stats.decisionNodes).toBeGreaterThan(0);
      });

      it('every branch in every decision has a non-empty rationale', () => {
        for (const node of Object.values(line.nodes)) {
          if (!node.decision) continue;
          for (const b of node.decision.branches) {
            expect(typeof b.rationale).toBe('string');
            expect(b.rationale.length).toBeGreaterThan(0);
          }
        }
      });
    });
  }
});

// ---------- Line 1 specific content checks ---------- //

describe('line: btn-vs-bb-srp-ip-dry-q72r', () => {
  const line = findLine('btn-vs-bb-srp-ip-dry-q72r');

  it('exists', () => {
    expect(line).not.toBeNull();
  });

  it('has ≥ 8 nodes (Phase 1 target)', () => {
    expect(Object.keys(line.nodes).length).toBeGreaterThanOrEqual(8);
  });

  it('uses BTN hero, BB villain, srp pot', () => {
    expect(line.setup.hero.position).toBe('BTN');
    expect(line.setup.villains).toHaveLength(1);
    expect(line.setup.villains[0].position).toBe('BB');
    expect(line.setup.potType).toBe('srp');
  });

  it('root is a flop node with Q-7-2 rainbow board', () => {
    const root = line.nodes[line.rootId];
    expect(root.street).toBe('flop');
    expect(root.board).toEqual(['Q♠', '7♥', '2♣']);
  });

  it('has at least one river-street node', () => {
    const rivers = Object.values(line.nodes).filter((n) => n.street === 'river');
    expect(rivers.length).toBeGreaterThanOrEqual(1);
  });

  it('has at least one terminal node (no decision)', () => {
    const terminals = Object.values(line.nodes).filter((n) => !n.decision);
    expect(terminals.length).toBeGreaterThanOrEqual(1);
  });

  it('has both correct and incorrect branches on the root decision', () => {
    const root = line.nodes[line.rootId];
    const correct = root.decision.branches.filter((b) => b.correct);
    const wrong = root.decision.branches.filter((b) => !b.correct);
    expect(correct.length).toBeGreaterThanOrEqual(1);
    expect(wrong.length).toBeGreaterThanOrEqual(1);
  });
});
