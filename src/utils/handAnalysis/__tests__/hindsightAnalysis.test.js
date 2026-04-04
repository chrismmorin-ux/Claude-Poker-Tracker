import { describe, it, expect, vi } from 'vitest';
import { PRIMITIVE_ACTIONS } from '../../../constants/primitiveActions';

// Mock the equity calculator before importing
vi.mock('../../exploitEngine/monteCarloEquity', () => ({
  handVsRange: vi.fn(),
}));

// Mock cardParser encoding functions
vi.mock('../../pokerCore/cardParser', () => ({
  parseAndEncode: vi.fn((str) => {
    // Simple deterministic encoding for test cards
    const cards = { 'Ah': 0, 'Kd': 1, 'Qs': 2, 'Jc': 3, 'Td': 4, '9h': 5, '8s': 6, '2c': 7 };
    return cards[str] ?? -1;
  }),
  parseBoard: vi.fn((cards) => cards.map((_, i) => 10 + i)),
}));

import { analyzeWithHindsight } from '../hindsightAnalysis';
import { handVsRange } from '../../exploitEngine/monteCarloEquity';

const heroRange = new Float64Array(169).fill(1 / 169);

describe('analyzeWithHindsight', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null for missing villain cards', async () => {
    expect(await analyzeWithHindsight(null, heroRange, ['Ah', 'Kd', 'Qs'], [], 'bet', 100, 50)).toBeNull();
    expect(await analyzeWithHindsight([], heroRange, ['Ah', 'Kd', 'Qs'], [], 'bet', 100, 50)).toBeNull();
  });

  it('returns null for missing hero range', async () => {
    expect(await analyzeWithHindsight(['Ah', 'Kd'], null, ['Qs', 'Jc', 'Td'], [], 'bet', 100, 50)).toBeNull();
  });

  it('computes actual equity and classifies a value bet', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.72 }); // at decision point

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], // current board (3 cards = flop)
      ['Qs', 'Jc', 'Td'], // full board same (no runout change)
      PRIMITIVE_ACTIONS.BET, 100, 50
    );

    expect(result).not.toBeNull();
    expect(result.actualEquity).toBe(0.72);
    expect(result.wasCorrectPlay).toContain('Correct value bet');
    expect(result.luckyUnlucky).toBe('neutral');
  });

  it('classifies a -EV call correctly', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.20 }); // at decision

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.CALL, 100, 50
    );

    expect(result.wasCorrectPlay).toContain('-EV call');
    // equityNeeded = 50/(100+50) ≈ 33%, had 20%
  });

  it('classifies a correct call', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.45 });

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.CALL, 100, 50
    );

    expect(result.wasCorrectPlay).toContain('Correct call');
  });

  it('identifies lucky runout when equity improves significantly', async () => {
    handVsRange
      .mockResolvedValueOnce({ equity: 0.30 })  // at decision (flop)
      .mockResolvedValueOnce({ equity: 0.80 });  // after runout (river)

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'],           // flop only
      ['Qs', 'Jc', 'Td', '9h', '8s'], // full 5-card board
      PRIMITIVE_ACTIONS.CALL, 100, 50
    );

    expect(result.luckyUnlucky).toBe('lucky');
    expect(result.runoutEquity).toBe(0.80);
    expect(result.verdict).toContain('improved');
  });

  it('identifies unlucky runout when equity drops significantly', async () => {
    handVsRange
      .mockResolvedValueOnce({ equity: 0.75 })
      .mockResolvedValueOnce({ equity: 0.20 });

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'],
      ['Qs', 'Jc', 'Td', '9h', '8s'],
      PRIMITIVE_ACTIONS.BET, 100, 50
    );

    expect(result.luckyUnlucky).toBe('unlucky');
    expect(result.verdict).toContain('worsened');
  });

  it('classifies a correct fold', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.15 });

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.FOLD, 100, 50
    );

    // equityNeeded = 50/150 ≈ 33%, had 15% → correct fold
    expect(result.wasCorrectPlay).toContain('Correct fold');
  });

  it('identifies folding best hand', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.60 });

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.FOLD, 100, 50
    );

    expect(result.wasCorrectPlay).toContain('Folded best hand');
  });

  it('classifies a check with high equity as missed value', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.80 });

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.CHECK, 100, 0
    );

    expect(result.wasCorrectPlay).toContain('Missed value');
  });

  it('returns null when equity calc throws', async () => {
    handVsRange.mockRejectedValueOnce(new Error('calc failed'));

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.BET, 100, 50
    );

    expect(result).toBeNull();
  });

  it('returns null for unparseable cards', async () => {
    const result = await analyzeWithHindsight(
      ['XX', 'YY'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.BET, 100, 50
    );

    expect(result).toBeNull();
  });

  it('handles fold with no bet faced', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.40 });

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.FOLD, 100, 0
    );

    expect(result.wasCorrectPlay).toContain('no bet faced');
  });

  it('classifies semi-bluff correctly', async () => {
    handVsRange.mockResolvedValueOnce({ equity: 0.35 });

    const result = await analyzeWithHindsight(
      ['Ah', 'Kd'], heroRange,
      ['Qs', 'Jc', 'Td'], ['Qs', 'Jc', 'Td'],
      PRIMITIVE_ACTIONS.BET, 100, 50
    );

    expect(result.wasCorrectPlay).toContain('Semi-bluff');
  });
});
