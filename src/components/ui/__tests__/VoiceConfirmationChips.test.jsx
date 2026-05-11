/**
 * VoiceConfirmationChips.test.jsx
 *
 * Covers:
 *   - Returns null when cards is null or empty.
 *   - Renders N chips for N parsed cards.
 *   - Commit dispatches the current chips; Cancel calls onCancel.
 *   - External cards prop change hard-resets working state.
 *   - Rank-cycle math (nextRank / prevRank / classifySwipe) — pure-function unit tests.
 *     (jsdom's pointer-event dispatch is unreliable across React versions, so the
 *     gesture-to-state plumbing is exercised by the chip's own JSX render; the
 *     math is validated standalone here.)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import VoiceConfirmationChips, {
  nextRank,
  prevRank,
  cardRank,
  cardSuit,
  classifySwipe,
  SWIPE_THRESHOLD_PX,
} from '../VoiceConfirmationChips';

describe('VoiceConfirmationChips — empty / null', () => {
  it('returns null when cards is null', () => {
    const { container } = render(
      <VoiceConfirmationChips cards={null} onCommit={() => {}} onCancel={() => {}} />,
    );
    expect(container.firstChild).toBe(null);
  });

  it('returns null when cards is empty array', () => {
    const { container } = render(
      <VoiceConfirmationChips cards={[]} onCommit={() => {}} onCancel={() => {}} />,
    );
    expect(container.firstChild).toBe(null);
  });
});

describe('VoiceConfirmationChips — rendering', () => {
  it('renders one chip per card with correct data-card', () => {
    render(
      <VoiceConfirmationChips
        cards={['A♥', 'J♠', 'T♣']}
        onCommit={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByTestId('voice-confirmation-chips-chip-0').getAttribute('data-card')).toBe('A♥');
    expect(screen.getByTestId('voice-confirmation-chips-chip-1').getAttribute('data-card')).toBe('J♠');
    expect(screen.getByTestId('voice-confirmation-chips-chip-2').getAttribute('data-card')).toBe('T♣');
  });

  it('renders commit + cancel buttons', () => {
    render(
      <VoiceConfirmationChips cards={['A♥']} onCommit={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByTestId('voice-confirmation-chips-commit')).toBeTruthy();
    expect(screen.getByTestId('voice-confirmation-chips-cancel')).toBeTruthy();
  });
});

describe('VoiceConfirmationChips — commit / cancel', () => {
  it('commit fires onCommit with current cards', () => {
    const onCommit = vi.fn();
    render(
      <VoiceConfirmationChips cards={['A♥', 'J♠']} onCommit={onCommit} onCancel={() => {}} />,
    );
    fireEvent.click(screen.getByTestId('voice-confirmation-chips-commit'));
    expect(onCommit).toHaveBeenCalledWith(['A♥', 'J♠']);
  });

  it('cancel fires onCancel', () => {
    const onCancel = vi.fn();
    render(
      <VoiceConfirmationChips cards={['A♥']} onCommit={() => {}} onCancel={onCancel} />,
    );
    fireEvent.click(screen.getByTestId('voice-confirmation-chips-cancel'));
    expect(onCancel).toHaveBeenCalled();
  });
});

describe('VoiceConfirmationChips — external cards prop change', () => {
  it('hard-resets working state when cards prop changes', () => {
    const { rerender } = render(
      <VoiceConfirmationChips cards={['K♥']} onCommit={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByTestId('voice-confirmation-chips-chip-0').getAttribute('data-card')).toBe('K♥');

    rerender(
      <VoiceConfirmationChips cards={['Q♦']} onCommit={() => {}} onCancel={() => {}} />,
    );
    expect(screen.getByTestId('voice-confirmation-chips-chip-0').getAttribute('data-card')).toBe('Q♦');
  });
});

// ─── Pure swipe math (R4 cycle correctness) ──────────────────────────────────

describe('rank cycle math', () => {
  describe('nextRank (swipe up direction)', () => {
    it('Q → K', () => expect(nextRank('Q')).toBe('K'));
    it('K → A', () => expect(nextRank('K')).toBe('A'));
    it('A → 2 (wrap)', () => expect(nextRank('A')).toBe('2'));
    it('2 → 3', () => expect(nextRank('2')).toBe('3'));
    it('T → J', () => expect(nextRank('T')).toBe('J'));
    it('5 → 6', () => expect(nextRank('5')).toBe('6'));
    it('returns input unchanged for non-rank tokens', () => {
      expect(nextRank('Z')).toBe('Z');
    });
  });

  describe('prevRank (swipe down direction)', () => {
    it('K → Q', () => expect(prevRank('K')).toBe('Q'));
    it('A → K', () => expect(prevRank('A')).toBe('K'));
    it('2 → A (wrap)', () => expect(prevRank('2')).toBe('A'));
    it('3 → 2', () => expect(prevRank('3')).toBe('2'));
    it('J → T', () => expect(prevRank('J')).toBe('T'));
  });

  it('cycles A through full ladder back to A in 13 nextRank calls', () => {
    let r = 'A';
    for (let i = 0; i < 13; i++) r = nextRank(r);
    expect(r).toBe('A');
  });

  describe('cardRank / cardSuit', () => {
    it('splits 2-char card', () => {
      expect(cardRank('A♥')).toBe('A');
      expect(cardSuit('A♥')).toBe('♥');
    });
    it('handles 10-rank "T"', () => {
      expect(cardRank('T♦')).toBe('T');
      expect(cardSuit('T♦')).toBe('♦');
    });
    it('returns empty for invalid inputs', () => {
      expect(cardRank('')).toBe('');
      expect(cardRank(null)).toBe('');
      expect(cardSuit('A')).toBe('');
    });
  });

  describe('classifySwipe', () => {
    it('returns "up" when dy <= -threshold', () => {
      expect(classifySwipe(-SWIPE_THRESHOLD_PX)).toBe('up');
      expect(classifySwipe(-100)).toBe('up');
    });
    it('returns "down" when dy >= threshold', () => {
      expect(classifySwipe(SWIPE_THRESHOLD_PX)).toBe('down');
      expect(classifySwipe(100)).toBe('down');
    });
    it('returns null when motion is below threshold', () => {
      expect(classifySwipe(0)).toBe(null);
      expect(classifySwipe(5)).toBe(null);
      expect(classifySwipe(-5)).toBe(null);
    });
    it('returns null for non-finite input', () => {
      expect(classifySwipe(NaN)).toBe(null);
      expect(classifySwipe('not a number')).toBe(null);
    });
  });
});
