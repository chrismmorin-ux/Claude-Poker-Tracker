/**
 * AutoRetireBanner.test.jsx — banner UI + AP-06 DOM-asserted forbidden-pattern absence.
 *
 * Per SPR-060 / WS-170 + Gate 1 audit acceptance criterion 6: AP-06 forbidden
 * patterns must be absent at every count value, asserted at component DOM level.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AutoRetireBanner } from '../AutoRetireBanner';
import { FORBIDDEN_PATTERNS } from '../../../../utils/anchorLibrary/retirementCopy';

const setup = (props = {}) => {
  const onReview = vi.fn();
  const onDismiss = vi.fn();
  const utils = render(
    <AutoRetireBanner
      count={props.count ?? 1}
      onReview={props.onReview ?? onReview}
      onDismiss={props.onDismiss ?? onDismiss}
    />,
  );
  return { ...utils, onReview, onDismiss };
};

describe('AutoRetireBanner', () => {
  describe('render', () => {
    it('renders nothing for count=0', () => {
      const { container } = setup({ count: 0 });
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for negative count', () => {
      const { container } = setup({ count: -1 });
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing for non-integer count', () => {
      const { container } = setup({ count: 1.5 });
      expect(container.firstChild).toBeNull();
    });

    it('renders banner for count=1 with singular noun', () => {
      setup({ count: 1 });
      expect(screen.getByTestId('auto-retire-banner-message')).toHaveTextContent(
        '1 anchor auto-retired since you last looked.',
      );
    });

    it('renders banner for count=N with plural noun', () => {
      setup({ count: 5 });
      expect(screen.getByTestId('auto-retire-banner-message')).toHaveTextContent(
        '5 anchors auto-retired since you last looked.',
      );
    });

    it('exposes count via data-count attribute', () => {
      setup({ count: 3 });
      expect(screen.getByTestId('auto-retire-banner')).toHaveAttribute('data-count', '3');
    });

    it('uses role=status + aria-live=polite (non-interruptive)', () => {
      setup({ count: 2 });
      const banner = screen.getByTestId('auto-retire-banner');
      expect(banner).toHaveAttribute('role', 'status');
      expect(banner).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('actions', () => {
    it('Review button has accessible label and ≥44px tap target', () => {
      setup({ count: 2 });
      const reviewBtn = screen.getByTestId('auto-retire-banner-review');
      expect(reviewBtn).toHaveTextContent('Review');
      // Inline-style assertion — the component sets minHeight/minWidth.
      expect(reviewBtn.style.minHeight).toBe('44px');
      expect(reviewBtn.style.minWidth).toBe('44px');
    });

    it('Dismiss button has aria-label and ≥44px tap target', () => {
      setup({ count: 2 });
      const dismissBtn = screen.getByTestId('auto-retire-banner-dismiss');
      expect(dismissBtn).toHaveAttribute('aria-label', 'Dismiss banner');
      expect(dismissBtn.style.minHeight).toBe('44px');
      expect(dismissBtn.style.minWidth).toBe('44px');
    });

    it('fires onReview when Review tapped', () => {
      const { onReview } = setup({ count: 2 });
      fireEvent.click(screen.getByTestId('auto-retire-banner-review'));
      expect(onReview).toHaveBeenCalledTimes(1);
    });

    it('fires onDismiss when Dismiss tapped', () => {
      const { onDismiss } = setup({ count: 2 });
      fireEvent.click(screen.getByTestId('auto-retire-banner-dismiss'));
      expect(onDismiss).toHaveBeenCalledTimes(1);
    });

    it('does not crash when onReview is missing', () => {
      const { container } = render(<AutoRetireBanner count={1} onDismiss={() => {}} />);
      expect(() => fireEvent.click(container.querySelector('[data-testid="auto-retire-banner-review"]'))).not.toThrow();
    });

    it('does not crash when onDismiss is missing', () => {
      const { container } = render(<AutoRetireBanner count={1} onReview={() => {}} />);
      expect(() => fireEvent.click(container.querySelector('[data-testid="auto-retire-banner-dismiss"]'))).not.toThrow();
    });
  });

  describe('AP-06 forbidden-pattern absence (DOM-asserted)', () => {
    it.each([1, 2, 5, 17, 99])('count=%d: rendered DOM has zero forbidden patterns', (count) => {
      const { container } = setup({ count });
      const text = container.textContent || '';
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    });

    it('rendered DOM contains no "your accuracy / observation / confidence" phrasings', () => {
      const { container } = setup({ count: 5 });
      const text = container.textContent || '';
      expect(text).not.toMatch(/your accuracy/i);
      expect(text).not.toMatch(/your observation/i);
      expect(text).not.toMatch(/your confidence/i);
    });

    it('rendered DOM contains no AP-04 numeric-grade tokens (n=, %, score)', () => {
      // The banner is intentionally count-only; numeric grades like
      // "n=42", "73%", "score" indicate calibration leakage onto a study
      // surface (AP-04 / AP-07 study-side analog).
      const { container } = setup({ count: 5 });
      const text = container.textContent || '';
      expect(text).not.toMatch(/\bn\s*=\s*\d/i);
      expect(text).not.toMatch(/\bscore\b/i);
      expect(text).not.toMatch(/\bgrade\b/i);
    });

    it('rendered DOM contains no AP-05 reconsider-retired nudge', () => {
      const { container } = setup({ count: 5 });
      const text = container.textContent || '';
      expect(text).not.toMatch(/\breconsider\b/i);
    });
  });
});
