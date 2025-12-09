/**
 * ImportConfirmModal.test.jsx - Tests for import confirmation modal
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImportConfirmModal } from '../ImportConfirmModal';

describe('ImportConfirmModal', () => {
  const mockImportData = {
    counts: {
      hands: 150,
      sessions: 10,
      players: 25,
    },
    exportedAtISO: '2025-12-09T12:00:00.000Z',
  };

  const defaultProps = {
    isOpen: true,
    importData: mockImportData,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering conditions', () => {
    it('returns null when not open', () => {
      const { container } = render(
        <ImportConfirmModal {...defaultProps} isOpen={false} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('returns null when importData is null', () => {
      const { container } = render(
        <ImportConfirmModal {...defaultProps} importData={null} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders when open with importData', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('Confirm Import')).toBeInTheDocument();
    });
  });

  describe('content rendering', () => {
    it('renders warning message', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('Warning: This will replace ALL existing data!')).toBeInTheDocument();
    });

    it('renders backup file description', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('The backup file contains:')).toBeInTheDocument();
    });

    it('renders hands count', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('150 hands')).toBeInTheDocument();
    });

    it('renders sessions count', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('10 sessions')).toBeInTheDocument();
    });

    it('renders players count', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('25 players')).toBeInTheDocument();
    });

    it('renders exported date', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText(/Exported:/)).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('renders Import & Replace button', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('Import & Replace')).toBeInTheDocument();
    });
  });

  describe('data format variations', () => {
    it('handles counts object format', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      expect(screen.getByText('150 hands')).toBeInTheDocument();
    });

    it('handles data array format when counts missing', () => {
      const dataFormat = {
        data: {
          hands: new Array(75).fill({}),
          sessions: new Array(5).fill({}),
          players: new Array(12).fill({}),
        },
      };
      render(<ImportConfirmModal {...defaultProps} importData={dataFormat} />);
      expect(screen.getByText('75 hands')).toBeInTheDocument();
      expect(screen.getByText('5 sessions')).toBeInTheDocument();
      expect(screen.getByText('12 players')).toBeInTheDocument();
    });

    it('defaults to 0 when no counts or data', () => {
      const emptyData = {};
      render(<ImportConfirmModal {...defaultProps} importData={emptyData} />);
      expect(screen.getByText('0 hands')).toBeInTheDocument();
      expect(screen.getByText('0 sessions')).toBeInTheDocument();
      expect(screen.getByText('0 players')).toBeInTheDocument();
    });

    it('does not show exported date when not provided', () => {
      const noDateData = { counts: { hands: 10, sessions: 1, players: 2 } };
      render(<ImportConfirmModal {...defaultProps} importData={noDateData} />);
      expect(screen.queryByText(/Exported:/)).not.toBeInTheDocument();
    });
  });

  describe('button interactions', () => {
    it('calls onCancel when Cancel clicked', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Cancel'));
      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onConfirm when Import & Replace clicked', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      fireEvent.click(screen.getByText('Import & Replace'));
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });
  });

  describe('styling', () => {
    it('warning text has red color', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      const warning = screen.getByText('Warning: This will replace ALL existing data!');
      expect(warning).toHaveClass('text-red-600');
    });

    it('Cancel button has gray styling', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toHaveClass('bg-gray-200');
    });

    it('Import button has red styling', () => {
      render(<ImportConfirmModal {...defaultProps} />);
      const importButton = screen.getByText('Import & Replace');
      expect(importButton).toHaveClass('bg-red-600');
    });

    it('has modal backdrop', () => {
      const { container } = render(<ImportConfirmModal {...defaultProps} />);
      const overlay = container.firstChild;
      expect(overlay).toHaveClass('fixed', 'inset-0', 'bg-black/50');
    });
  });

  describe('edge cases', () => {
    it('handles zero counts', () => {
      const zeroData = { counts: { hands: 0, sessions: 0, players: 0 } };
      render(<ImportConfirmModal {...defaultProps} importData={zeroData} />);
      expect(screen.getByText('0 hands')).toBeInTheDocument();
      expect(screen.getByText('0 sessions')).toBeInTheDocument();
      expect(screen.getByText('0 players')).toBeInTheDocument();
    });

    it('handles large counts', () => {
      const largeData = { counts: { hands: 10000, sessions: 500, players: 1000 } };
      render(<ImportConfirmModal {...defaultProps} importData={largeData} />);
      expect(screen.getByText('10000 hands')).toBeInTheDocument();
      expect(screen.getByText('500 sessions')).toBeInTheDocument();
      expect(screen.getByText('1000 players')).toBeInTheDocument();
    });

    it('handles missing individual count fields', () => {
      const partialData = { counts: { hands: 50 } };
      render(<ImportConfirmModal {...defaultProps} importData={partialData} />);
      expect(screen.getByText('50 hands')).toBeInTheDocument();
      expect(screen.getByText('0 sessions')).toBeInTheDocument();
      expect(screen.getByText('0 players')).toBeInTheDocument();
    });
  });
});
