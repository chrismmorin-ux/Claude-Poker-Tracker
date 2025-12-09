/**
 * TableHeader.test.jsx - Tests for table header component
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TableHeader } from '../TableHeader';

describe('TableHeader', () => {
  const defaultProps = {
    handCount: 0,
    sessionTimeDisplay: '1:30:00',
    hasActiveSession: true,
    isSidebarCollapsed: false,
    onEndSession: vi.fn(),
    onNewSession: vi.fn(),
    onNextHand: vi.fn(),
    onResetHand: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders hand count starting from 1', () => {
      render(<TableHeader {...defaultProps} handCount={0} />);
      expect(screen.getByText('Hand #1')).toBeInTheDocument();
    });

    it('renders correct hand number', () => {
      render(<TableHeader {...defaultProps} handCount={46} />);
      expect(screen.getByText('Hand #47')).toBeInTheDocument();
    });

    it('renders session time display when active session', () => {
      render(<TableHeader {...defaultProps} />);
      expect(screen.getByText('1:30:00')).toBeInTheDocument();
    });

    it('renders Next Hand button', () => {
      render(<TableHeader {...defaultProps} />);
      expect(screen.getByText('Next Hand')).toBeInTheDocument();
    });

    it('renders Reset Hand button', () => {
      render(<TableHeader {...defaultProps} />);
      expect(screen.getByText('Reset Hand')).toBeInTheDocument();
    });
  });

  describe('active session state', () => {
    it('renders End Session button when session is active', () => {
      render(<TableHeader {...defaultProps} hasActiveSession={true} />);
      expect(screen.getByText('End Session')).toBeInTheDocument();
      expect(screen.queryByText('New Session')).not.toBeInTheDocument();
    });

    it('renders New Session button when no active session', () => {
      render(<TableHeader {...defaultProps} hasActiveSession={false} />);
      expect(screen.getByText('New Session')).toBeInTheDocument();
      expect(screen.queryByText('End Session')).not.toBeInTheDocument();
    });

    it('does not render session time when no active session', () => {
      render(<TableHeader {...defaultProps} hasActiveSession={false} />);
      expect(screen.queryByText('1:30:00')).not.toBeInTheDocument();
    });
  });

  describe('sidebar state', () => {
    it('applies expanded sidebar margin class', () => {
      const { container } = render(<TableHeader {...defaultProps} isSidebarCollapsed={false} />);
      const header = container.firstChild;
      expect(header).toHaveClass('ml-36');
    });

    it('applies collapsed sidebar margin class', () => {
      const { container } = render(<TableHeader {...defaultProps} isSidebarCollapsed={true} />);
      const header = container.firstChild;
      expect(header).toHaveClass('ml-14');
    });
  });

  describe('button interactions', () => {
    it('calls onEndSession when End Session button clicked', () => {
      render(<TableHeader {...defaultProps} hasActiveSession={true} />);
      fireEvent.click(screen.getByText('End Session'));
      expect(defaultProps.onEndSession).toHaveBeenCalledTimes(1);
    });

    it('calls onNewSession when New Session button clicked', () => {
      render(<TableHeader {...defaultProps} hasActiveSession={false} />);
      fireEvent.click(screen.getByText('New Session'));
      expect(defaultProps.onNewSession).toHaveBeenCalledTimes(1);
    });

    it('calls onNextHand when Next Hand button clicked', () => {
      render(<TableHeader {...defaultProps} />);
      fireEvent.click(screen.getByText('Next Hand'));
      expect(defaultProps.onNextHand).toHaveBeenCalledTimes(1);
    });

    it('calls onResetHand when Reset Hand button clicked', () => {
      render(<TableHeader {...defaultProps} />);
      fireEvent.click(screen.getByText('Reset Hand'));
      expect(defaultProps.onResetHand).toHaveBeenCalledTimes(1);
    });
  });

  describe('edge cases', () => {
    it('renders with high hand count', () => {
      render(<TableHeader {...defaultProps} handCount={999} />);
      expect(screen.getByText('Hand #1000')).toBeInTheDocument();
    });

    it('renders with long session time', () => {
      render(<TableHeader {...defaultProps} sessionTimeDisplay="12:59:59" />);
      expect(screen.getByText('12:59:59')).toBeInTheDocument();
    });

    it('renders with empty session time', () => {
      render(<TableHeader {...defaultProps} sessionTimeDisplay="" />);
      // Should not crash, but time display should be empty
      expect(screen.queryByText('1:30:00')).not.toBeInTheDocument();
    });
  });
});
