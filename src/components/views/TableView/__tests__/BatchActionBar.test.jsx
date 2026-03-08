// @vitest-environment jsdom
/**
 * BatchActionBar.test.jsx - Tests for batch action buttons
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BatchActionBar } from '../BatchActionBar';

describe('BatchActionBar', () => {
  const defaultProps = {
    remainingCount: 5,
    canCheckAround: true,
    currentStreet: 'preflop',
    onRestFold: vi.fn(),
    onCheckAround: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders Rest Fold with correct count', () => {
      render(<BatchActionBar {...defaultProps} />);
      expect(screen.getByText('Rest Fold (5)')).toBeInTheDocument();
    });

    it('renders Check Around when canCheckAround is true', () => {
      render(<BatchActionBar {...defaultProps} />);
      expect(screen.getByText('Check Around (5)')).toBeInTheDocument();
    });

    it('hides Check Around when canCheckAround is false', () => {
      render(<BatchActionBar {...defaultProps} canCheckAround={false} />);
      expect(screen.queryByText(/Check Around/)).not.toBeInTheDocument();
    });

    it('renders nothing on showdown street', () => {
      const { container } = render(<BatchActionBar {...defaultProps} currentStreet="showdown" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders nothing when remainingCount is 0', () => {
      const { container } = render(<BatchActionBar {...defaultProps} remainingCount={0} />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('interactions', () => {
    it('calls onRestFold when Rest Fold clicked', () => {
      render(<BatchActionBar {...defaultProps} />);
      fireEvent.click(screen.getByText('Rest Fold (5)'));
      expect(defaultProps.onRestFold).toHaveBeenCalledTimes(1);
    });

    it('calls onCheckAround when Check Around clicked', () => {
      render(<BatchActionBar {...defaultProps} />);
      fireEvent.click(screen.getByText('Check Around (5)'));
      expect(defaultProps.onCheckAround).toHaveBeenCalledTimes(1);
    });
  });
});
