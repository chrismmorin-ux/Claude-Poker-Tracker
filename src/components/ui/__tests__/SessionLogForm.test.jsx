// @vitest-environment jsdom
/**
 * SessionLogForm.test.jsx — log-a-past-session / edit-a-session form.
 *
 * Field parsing is covered in sessionLogFields.test.js; these tests cover the
 * component's own contract: prefill on edit, the live duration echo, the
 * miss-tap guard, and that values reach onSubmit in record shape.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionLogForm } from '../SessionLogForm';

// The form reads venues and stakes from settings; stub the context, not the form.
vi.mock('../../../contexts', () => ({
  useSettings: () => ({
    allVenues: ['Wind Creek', 'Horseshoe Hammond'],
    allGameTypes: {
      ONE_TWO: { label: '1/2' },
      ONE_THREE: { label: '1/3' },
      TWO_FIVE: { label: '2/5' },
    },
    allGameTypeKeys: ['ONE_TWO', 'ONE_THREE', 'TWO_FIVE'],
    getVenueNote: () => '',
  }),
}));

const existingSession = {
  sessionId: 7,
  startTime: new Date(2026, 7, 5, 17, 30).getTime(),
  endTime: new Date(2026, 7, 5, 21, 0).getTime(),
  venue: 'Wind Creek',
  gameType: '1/3',
  buyIn: 500,
  rebuyTransactions: [],
  cashOut: 1401,
  tipAmount: null,
  notes: '',
};

let onSubmit;
let onCancel;

beforeEach(() => {
  onSubmit = vi.fn();
  onCancel = vi.fn();
});

describe('SessionLogForm', () => {
  describe('logging a new session', () => {
    it('opens titled for logging, with today prefilled', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByText('Log a session')).toBeInTheDocument();
      expect(screen.getByTestId('log-date').value).not.toBe('');
    });

    it('submits parsed values in record shape', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-date'), { target: { value: '2026-08-05' } });
      fireEvent.change(screen.getByTestId('log-time-in'), { target: { value: '17:30' } });
      fireEvent.change(screen.getByTestId('log-time-out'), { target: { value: '21:00' } });
      fireEvent.change(screen.getByTestId('log-buy-in'), { target: { value: '500' } });
      fireEvent.change(screen.getByTestId('log-cash-out'), { target: { value: '1401' } });
      fireEvent.click(screen.getByTestId('log-submit'));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const data = onSubmit.mock.calls[0][0];
      expect(data.buyIn).toBe(500);
      expect(data.cashOut).toBe(1401);
      expect(data.durationHours).toBeCloseTo(3.5, 6);
    });

    it('will not submit without a date and start time', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-date'), { target: { value: '' } });
      fireEvent.click(screen.getByTestId('log-submit'));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/Date is required/i)).toBeInTheDocument();
    });

    it('rejects a negative cash-out rather than storing it', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-time-in'), { target: { value: '17:30' } });
      fireEvent.change(screen.getByTestId('log-cash-out'), { target: { value: '-50' } });
      fireEvent.click(screen.getByTestId('log-submit'));
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/cannot be negative/i)).toBeInTheDocument();
    });
  });

  describe('duration echo', () => {
    it('shows the session length as the clocks are filled in', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-time-in'), { target: { value: '17:30' } });
      fireEvent.change(screen.getByTestId('log-time-out'), { target: { value: '21:00' } });
      expect(screen.getByTestId('log-duration')).toHaveTextContent('3h 30m');
    });

    it('flags a session that ran past midnight instead of showing a negative', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-time-in'), { target: { value: '22:00' } });
      fireEvent.change(screen.getByTestId('log-time-out'), { target: { value: '03:45' } });
      const echo = screen.getByTestId('log-duration');
      expect(echo).toHaveTextContent('5h 45m');
      expect(echo).toHaveTextContent(/past midnight/i);
    });

    it('shows nothing until an end time exists', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-time-in'), { target: { value: '17:30' } });
      expect(screen.queryByTestId('log-duration')).not.toBeInTheDocument();
    });
  });

  describe('editing an existing session', () => {
    it('opens titled for editing, prefilled from the session', () => {
      render(<SessionLogForm session={existingSession} onSubmit={onSubmit} onCancel={onCancel} />);
      expect(screen.getByText('Edit session')).toBeInTheDocument();
      expect(screen.getByTestId('log-date').value).toBe('2026-08-05');
      expect(screen.getByTestId('log-time-in').value).toBe('17:30');
      expect(screen.getByTestId('log-time-out').value).toBe('21:00');
      expect(screen.getByTestId('log-buy-in').value).toBe('500');
      expect(screen.getByTestId('log-cash-out').value).toBe('1401');
    });

    it('submits only the changed value alongside the rest', () => {
      render(<SessionLogForm session={existingSession} onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-cash-out'), { target: { value: '900' } });
      fireEvent.click(screen.getByTestId('log-submit'));
      const data = onSubmit.mock.calls[0][0];
      expect(data.cashOut).toBe(900);
      expect(data.buyIn).toBe(500);
    });

    it('keeps a venue that is no longer in settings', () => {
      // Imported sheet venues ("greg game") are not in the settings list and must
      // not silently reset to blank when the session is edited.
      render(
        <SessionLogForm
          session={{ ...existingSession, venue: "Greg's game" }}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
      expect(screen.getByTestId('log-venue').value).toBe("Greg's game");
    });

    it('shows a zero cash-out as 0, not blank', () => {
      render(
        <SessionLogForm
          session={{ ...existingSession, cashOut: 0 }}
          onSubmit={onSubmit}
          onCancel={onCancel}
        />
      );
      expect(screen.getByTestId('log-cash-out').value).toBe('0');
    });
  });

  describe('dismissal', () => {
    it('closes on the × button', () => {
      render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.click(screen.getByLabelText('Close'));
      expect(onCancel).toHaveBeenCalled();
    });

    it('ignores a backdrop tap once anything has been typed', () => {
      // AUDIT-2026-04-21-SV F6 miss-tap guard: a stray tap must not bin the entry.
      const { container } = render(<SessionLogForm onSubmit={onSubmit} onCancel={onCancel} />);
      fireEvent.change(screen.getByTestId('log-buy-in'), { target: { value: '500' } });
      fireEvent.click(container.firstChild);
      expect(onCancel).not.toHaveBeenCalled();
    });

    it('closes on a backdrop tap while untouched', () => {
      const { container } = render(
        <SessionLogForm session={existingSession} onSubmit={onSubmit} onCancel={onCancel} />
      );
      fireEvent.click(container.firstChild);
      expect(onCancel).toHaveBeenCalled();
    });
  });
});
