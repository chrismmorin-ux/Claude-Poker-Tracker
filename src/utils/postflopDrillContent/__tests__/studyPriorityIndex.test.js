import { describe, it, expect } from 'vitest';
import {
  reachProbabilities,
  computeNodeSPI,
  computeLineSPI,
  rankLinesBySPI,
  explainSPI,
  lineMatchesFilters,
  POSITION_PAIR_FREQ,
  POT_TYPE_FREQ,
  BOARD_CLASS_FREQ,
} from '../studyPriorityIndex';
import { LINES, findLine } from '../lines';

// ---------- Fixture builder ---------- //

const mkLine = (overrides = {}) => ({
  id: 'fx',
  title: 'Fixture',
  summary: 'fixture',
  tags: ['dry'],
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
      sections: [{ kind: 'prose', body: 'x' }],
      decision: {
        prompt: '?',
        branches: [
          { label: 'a', nextId: 'leaf', correct: true,  rationale: 'r' },
          { label: 'b', nextId: 'leaf', correct: false, rationale: 'r' },
        ],
      },
    },
    leaf: {
      id: 'leaf',
      street: 'turn',
      board: ['Q♠', '7♥', '2♣', '3♦'],
      pot: 9.0,
      sections: [{ kind: 'prose', body: 'x' }],
    },
  },
  ...overrides,
});

// ---------- Population constants ---------- //

describe('population constants', () => {
  it('BTN vs BB is the most-frequent position pair', () => {
    const btnBB = POSITION_PAIR_FREQ.BTN.BB;
    for (const [heroPos, row] of Object.entries(POSITION_PAIR_FREQ)) {
      for (const [villainPos, p] of Object.entries(row)) {
        if (heroPos === 'BTN' && villainPos === 'BB') continue;
        expect(p).toBeLessThanOrEqual(btnBB);
      }
    }
  });

  it('SRP is the most-frequent pot type', () => {
    const srp = POT_TYPE_FREQ.srp;
    for (const [k, p] of Object.entries(POT_TYPE_FREQ)) {
      if (k === 'srp') continue;
      expect(p).toBeLessThanOrEqual(srp);
    }
  });

  it('BOARD_CLASS_FREQ covers the core partitions', () => {
    expect(BOARD_CLASS_FREQ['unpaired-rainbow']).toBeGreaterThan(0);
    expect(BOARD_CLASS_FREQ['paired']).toBeGreaterThan(0);
    expect(BOARD_CLASS_FREQ['unpaired-monotone']).toBeGreaterThan(0);
  });
});

// ---------- reachProbabilities ---------- //

describe('reachProbabilities', () => {
  it('assigns positive probability to every reachable node', () => {
    const line = mkLine();
    const probs = reachProbabilities(line);
    expect(probs.root).toBeGreaterThan(0);
    expect(probs.leaf).toBeGreaterThan(0);
  });

  it('leaf with two branches converging has sum of both branch probabilities', () => {
    const line = mkLine();
    const probs = reachProbabilities(line);
    // root's probability splits across 2 branches, both reach leaf — so
    // leaf's probability should approximately equal root's prob ×
    // villainAction-factor-for-leaf × (0.5 + 0.5).
    // (no villain action on leaf in fixture, so factor is 1.)
    expect(probs.leaf).toBeCloseTo(probs.root, 5);
  });

  it('returns empty object for invalid line', () => {
    expect(reachProbabilities(null)).toEqual({});
    expect(reachProbabilities({})).toEqual({});
  });
});

// ---------- computeNodeSPI ---------- //

describe('computeNodeSPI', () => {
  it('returns 0 for a node with pot=0', () => {
    const n = { pot: 0, sections: [] };
    expect(computeNodeSPI(n, 0.01)).toBe(0);
  });

  it('scales with pot size', () => {
    const small = { pot: 5, decision: null, sections: [] };
    const big   = { pot: 50, decision: null, sections: [] };
    const smallSPI = computeNodeSPI(small, 0.01);
    const bigSPI = computeNodeSPI(big, 0.01);
    expect(bigSPI).toBeGreaterThan(smallSPI);
    expect(bigSPI).toBeCloseTo(smallSPI * 10, 5);
  });

  it('decision nodes have a difficulty bonus over terminal', () => {
    const dec = { pot: 10, decision: { prompt: '?', branches: [] }, sections: [] };
    const term = { pot: 10, decision: null, sections: [] };
    expect(computeNodeSPI(dec, 0.01)).toBeGreaterThan(computeNodeSPI(term, 0.01));
  });
});

// ---------- Line-level ranking ---------- //

describe('computeLineSPI + rankLinesBySPI on authored catalog', () => {
  it('produces a positive score for every authored line', () => {
    for (const line of LINES) {
      const { score, dominantNodeId } = computeLineSPI(line);
      expect(score).toBeGreaterThan(0);
      expect(dominantNodeId).toBeTruthy();
    }
  });

  it('BTN-vs-BB SRP (most-frequent) outranks a synthetic rare-spot line', () => {
    const real = findLine('btn-vs-bb-srp-ip-dry-q72r');
    const rare = mkLine({
      id: 'rare',
      setup: {
        hero: { position: 'UTG' },
        villains: [{ position: 'BB', action: 'fourBet', vs: 'UTG' }],
        potType: '4bp',
        effStack: 100,
      },
      tags: ['dry', 'high-card'],
    });

    const realSPI = computeLineSPI(real).score;
    const rareSPI = computeLineSPI(rare).score;
    expect(realSPI).toBeGreaterThan(rareSPI);
  });

  it('rankLinesBySPI returns descending order', () => {
    const entries = rankLinesBySPI([...LINES]);
    for (let i = 1; i < entries.length; i++) {
      expect(entries[i - 1].score).toBeGreaterThanOrEqual(entries[i].score);
    }
  });
});

// ---------- explainSPI ---------- //

describe('explainSPI', () => {
  it('returns structured breakdown with all factors', () => {
    const line = findLine('btn-vs-bb-srp-ip-dry-q72r');
    const x = explainSPI(line);
    expect(x.score).toBeGreaterThan(0);
    expect(x.factors.positionLabel).toBe('BTN vs BB');
    expect(x.factors.potTypeLabel).toBe('srp');
    expect(x.factors.positionFactor).toBeGreaterThan(0);
    expect(x.factors.potTypeFactor).toBeGreaterThan(0);
    expect(x.dominantNode.id).toBeTruthy();
    expect(x.dominantNode.potBB).toBeGreaterThan(0);
  });

  it('log-freq component is non-negative', () => {
    for (const line of LINES) {
      const x = explainSPI(line);
      expect(x.dominantNode.logFreqComponent).toBeGreaterThanOrEqual(0);
    }
  });
});

// ---------- lineMatchesFilters ---------- //

describe('lineMatchesFilters', () => {
  it('returns true when no filters are provided', () => {
    const line = mkLine();
    expect(lineMatchesFilters(line, {})).toBe(true);
    expect(lineMatchesFilters(line)).toBe(true);
  });

  it('potType filter narrows correctly', () => {
    const line = mkLine({ setup: { hero: { position: 'BTN' }, villains: [{ position: 'BB', action: 'call', vs: 'BTN' }], potType: '3bp', effStack: 100 } });
    expect(lineMatchesFilters(line, { potType: new Set(['srp']) })).toBe(false);
    expect(lineMatchesFilters(line, { potType: new Set(['3bp']) })).toBe(true);
  });

  it('heroPosition filter narrows correctly', () => {
    const line = mkLine();
    expect(lineMatchesFilters(line, { heroPosition: new Set(['UTG']) })).toBe(false);
    expect(lineMatchesFilters(line, { heroPosition: new Set(['BTN']) })).toBe(true);
  });

  it('multiway filter distinguishes HU from MW', () => {
    const hu = mkLine();
    const mw = mkLine({
      setup: {
        ...mkLine().setup,
        villains: [
          { position: 'BB', action: 'call', vs: 'BTN' },
          { position: 'SB', action: 'call', vs: 'BTN' },
        ],
        potType: 'srp-3way',
      },
    });
    expect(lineMatchesFilters(hu, { multiway: 'hu' })).toBe(true);
    expect(lineMatchesFilters(hu, { multiway: 'mw' })).toBe(false);
    expect(lineMatchesFilters(mw, { multiway: 'mw' })).toBe(true);
    expect(lineMatchesFilters(mw, { multiway: 'hu' })).toBe(false);
  });

  it('boardTag filter matches any tag', () => {
    const line = mkLine({ tags: ['dry', 'high-card'] });
    expect(lineMatchesFilters(line, { boardTag: new Set(['wet']) })).toBe(false);
    expect(lineMatchesFilters(line, { boardTag: new Set(['dry']) })).toBe(true);
    expect(lineMatchesFilters(line, { boardTag: new Set(['wet', 'high-card']) })).toBe(true);
  });
});
