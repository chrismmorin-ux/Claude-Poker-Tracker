/**
 * CardSlot.test.jsx - Tests for CardSlot component
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardSlot } from '../CardSlot';
import { SEAT_STATUS } from '../../../test/utils';

describe('CardSlot', () => {
  describe('rendering', () => {
    it('renders empty slot with plus sign', () => {
      render(<CardSlot />);
      expect(screen.getByText('+')).toBeInTheDocument();
    });

    it('renders card when provided', () => {
      render(<CardSlot card="A♠" />);
      expect(screen.getByText('A♠')).toBeInTheDocument();
    });

    it('does not show plus when card is present', () => {
      render(<CardSlot card="K♥" />);
      expect(screen.queryByText('+')).not.toBeInTheDocument();
    });
  });

  describe('variants', () => {
    it('renders table variant with correct dimensions', () => {
      const { container } = render(<CardSlot variant="table" />);
      expect(container.firstChild.style.width).toBe('70px');
      expect(container.firstChild.style.height).toBe('100px');
    });

    it('renders hole-table variant with correct dimensions', () => {
      const { container } = render(<CardSlot variant="hole-table" />);
      expect(container.firstChild.style.width).toBe('40px');
      expect(container.firstChild.style.height).toBe('58px');
    });

    it('renders showdown variant with correct dimensions', () => {
      const { container } = render(<CardSlot variant="showdown" />);
      expect(container.firstChild.style.width).toBe('50px');
      expect(container.firstChild.style.height).toBe('70px');
    });

    it('renders selector variant with correct dimensions', () => {
      const { container } = render(<CardSlot variant="selector" />);
      expect(container.firstChild.style.width).toBe('60px');
      expect(container.firstChild.style.height).toBe('85px');
    });

    it('defaults to showdown variant', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.style.width).toBe('50px');
      expect(container.firstChild.style.height).toBe('70px');
    });

    it('falls back to showdown for unknown variant', () => {
      const { container } = render(<CardSlot variant="unknown" />);
      expect(container.firstChild.style.width).toBe('50px');
    });
  });

  describe('card colors', () => {
    it('renders red cards in red color', () => {
      render(<CardSlot card="K♥" />);
      const card = screen.getByText('K♥');
      expect(card.className).toContain('text-red-600');
    });

    it('renders diamonds in red color', () => {
      render(<CardSlot card="Q♦" />);
      const card = screen.getByText('Q♦');
      expect(card.className).toContain('text-red-600');
    });

    it('renders black cards in black color', () => {
      render(<CardSlot card="A♠" />);
      const card = screen.getByText('A♠');
      expect(card.className).toContain('text-black');
    });

    it('renders clubs in black color', () => {
      render(<CardSlot card="J♣" />);
      const card = screen.getByText('J♣');
      expect(card.className).toContain('text-black');
    });
  });

  describe('hidden state', () => {
    it('does not show card text when hidden', () => {
      render(<CardSlot card="A♠" isHidden={true} />);
      expect(screen.queryByText('A♠')).not.toBeInTheDocument();
    });

    it('does not show plus when hidden', () => {
      render(<CardSlot isHidden={true} />);
      expect(screen.queryByText('+')).not.toBeInTheDocument();
    });

    it('applies gray background when hidden', () => {
      const { container } = render(<CardSlot isHidden={true} />);
      expect(container.firstChild.className).toContain('bg-gray-700');
    });

    it('applies opacity when hidden', () => {
      const { container } = render(<CardSlot isHidden={true} />);
      expect(container.firstChild.className).toContain('opacity-60');
    });
  });

  describe('highlight state', () => {
    it('applies highlight ring when highlighted', () => {
      const { container } = render(<CardSlot isHighlighted={true} />);
      expect(container.firstChild.className).toContain('ring-4');
      expect(container.firstChild.className).toContain('ring-yellow-400');
    });

    it('applies scale when highlighted', () => {
      const { container } = render(<CardSlot isHighlighted={true} />);
      expect(container.firstChild.className).toContain('scale-110');
    });

    it('does not apply highlight when not highlighted', () => {
      const { container } = render(<CardSlot isHighlighted={false} />);
      expect(container.firstChild.className).not.toContain('ring-yellow-400');
    });
  });

  describe('status overlays', () => {
    it('applies mucked background', () => {
      const { container } = render(<CardSlot status="mucked" />);
      expect(container.firstChild.className).toContain('bg-gray-400');
    });

    it('applies won background', () => {
      const { container } = render(<CardSlot status="won" />);
      expect(container.firstChild.className).toContain('bg-green-200');
    });

    it('applies folded background with SEAT_STATUS', () => {
      const { container } = render(
        <CardSlot status={SEAT_STATUS.FOLDED} SEAT_STATUS={SEAT_STATUS} />
      );
      expect(container.firstChild.className).toContain('bg-red-200');
    });

    it('applies absent background with SEAT_STATUS', () => {
      const { container } = render(
        <CardSlot status={SEAT_STATUS.ABSENT} SEAT_STATUS={SEAT_STATUS} />
      );
      expect(container.firstChild.className).toContain('bg-gray-300');
    });

    it('applies opacity for status other than won', () => {
      const { container } = render(<CardSlot status="mucked" />);
      expect(container.firstChild.className).toContain('opacity-60');
    });

    it('does not apply opacity for won status', () => {
      const { container } = render(<CardSlot status="won" />);
      expect(container.firstChild.className).not.toContain('opacity-60');
    });
  });

  describe('click handling', () => {
    it('calls onClick when clicked and canInteract is true', () => {
      const onClick = vi.fn();
      render(<CardSlot onClick={onClick} canInteract={true} />);

      fireEvent.click(screen.getByText('+'));

      expect(onClick).toHaveBeenCalled();
    });

    it('does not call onClick when canInteract is false', () => {
      const onClick = vi.fn();
      const { container } = render(<CardSlot onClick={onClick} canInteract={false} />);

      fireEvent.click(container.firstChild);

      expect(onClick).not.toHaveBeenCalled();
    });

    it('applies cursor-pointer when clickable', () => {
      const { container } = render(<CardSlot onClick={() => {}} canInteract={true} />);
      expect(container.firstChild.className).toContain('cursor-pointer');
    });

    it('applies cursor-default when not interactive', () => {
      const { container } = render(<CardSlot canInteract={false} />);
      expect(container.firstChild.className).toContain('cursor-default');
    });
  });

  describe('hover effects', () => {
    it('applies hover ring when interactive and not highlighted', () => {
      const { container } = render(
        <CardSlot onClick={() => {}} canInteract={true} isHighlighted={false} />
      );
      expect(container.firstChild.className).toContain('hover:ring-2');
      expect(container.firstChild.className).toContain('hover:ring-blue-400');
    });

    it('does not apply hover ring when highlighted', () => {
      const { container } = render(
        <CardSlot onClick={() => {}} canInteract={true} isHighlighted={true} />
      );
      expect(container.firstChild.className).not.toContain('hover:ring-blue-400');
    });

    it('applies table-specific hover style for table variant', () => {
      const { container } = render(
        <CardSlot variant="table" onClick={() => {}} />
      );
      expect(container.firstChild.className).toContain('hover:ring-yellow-400');
    });
  });

  describe('background colors', () => {
    it('applies white background for card with content', () => {
      const { container } = render(<CardSlot card="A♠" />);
      expect(container.firstChild.className).toContain('bg-white');
    });

    it('applies gray background for empty slot', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.className).toContain('bg-gray-300');
    });

    it('applies dark background for empty table variant', () => {
      const { container } = render(<CardSlot variant="table" />);
      expect(container.firstChild.className).toContain('bg-gray-700');
    });

    it('applies white background for table variant with card', () => {
      const { container } = render(<CardSlot variant="table" card="A♠" />);
      expect(container.firstChild.className).toContain('bg-white');
    });
  });

  describe('styling', () => {
    it('has rounded-lg corners', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.className).toContain('rounded-lg');
    });

    it('has shadow-lg', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.className).toContain('shadow-lg');
    });

    it('centers content with flex', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.className).toContain('flex');
      expect(container.firstChild.className).toContain('items-center');
      expect(container.firstChild.className).toContain('justify-center');
    });

    it('has bold font', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.className).toContain('font-bold');
    });

    it('has transition-all for animations', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.className).toContain('transition-all');
    });
  });

  describe('text sizes by variant', () => {
    it('uses text-2xl for table variant', () => {
      const { container } = render(<CardSlot variant="table" card="A♠" />);
      expect(container.firstChild.className).toContain('text-2xl');
    });

    it('uses text-xl for hole-table variant', () => {
      const { container } = render(<CardSlot variant="hole-table" card="A♠" />);
      expect(container.firstChild.className).toContain('text-xl');
    });

    it('uses text-lg for showdown variant', () => {
      const { container } = render(<CardSlot variant="showdown" card="A♠" />);
      expect(container.firstChild.className).toContain('text-lg');
    });

    it('uses text-xl for selector variant', () => {
      const { container } = render(<CardSlot variant="selector" card="A♠" />);
      expect(container.firstChild.className).toContain('text-xl');
    });
  });

  describe('plus sign styling', () => {
    it('plus has gray color', () => {
      render(<CardSlot />);
      const plus = screen.getByText('+');
      expect(plus.className).toContain('text-gray-400');
    });
  });
});
