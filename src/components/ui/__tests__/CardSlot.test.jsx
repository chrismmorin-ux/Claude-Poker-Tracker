// @vitest-environment jsdom
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
    it.each([
      ['table', '56px', '80px'],
      ['hole-table', '40px', '58px'],
      ['showdown', '50px', '70px'],
      ['selector', '60px', '85px'],
    ])('%s variant has correct dimensions', (variant, width, height) => {
      const { container } = render(<CardSlot variant={variant} />);
      expect(container.firstChild.style.width).toBe(width);
      expect(container.firstChild.style.height).toBe(height);
    });

    it('defaults to showdown variant', () => {
      const { container } = render(<CardSlot />);
      expect(container.firstChild.style.width).toBe('50px');
      expect(container.firstChild.style.height).toBe('70px');
    });
  });

  describe('card colors', () => {
    it.each([
      ['K♥', 'text-red-600'],
      ['Q♦', 'text-red-600'],
      ['A♠', 'text-black'],
      ['J♣', 'text-black'],
    ])('renders %s with %s', (card, colorClass) => {
      render(<CardSlot card={card} />);
      expect(screen.getByText(card).className).toContain(colorClass);
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
  });

  describe('status overlays', () => {
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
  });
});
