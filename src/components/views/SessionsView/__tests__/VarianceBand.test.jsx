// @vitest-environment jsdom
/**
 * VarianceBand.test.jsx — bankroll and variance panel.
 *
 * Pure-prop component (no context). The assertions that matter most are the
 * honesty ones: an interval that straddles zero must SAY so, projected figures
 * must be stamped modelled, and a non-winning rate must not be handed a
 * comforting bankroll number.
 */

import React from 'react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import { VarianceBand } from '../VarianceBand';
import { getHandsBySessionId } from '../../../../utils/persistence/index';

// The all-in adjustment reads hands from IndexedDB, which jsdom has no business
// providing. Mock the loader; the equity math itself is covered exhaustively in
// utils/handStats/__tests__/allInEquity.test.js.
vi.mock('../../../../utils/persistence/index', () => ({
  getHandsBySessionId: vi.fn(async () => []),
}));

/** A heads-up all-in hand hero LOST as a big favourite (AA vs KK, king rivers). */
const badBeatHand = () => ({
  gameState: {
    mySeat: 5,
    currentStreet: 'river',
    actionSequence: [
      { seat: 3, action: 'bet', street: 'flop', order: 1, amount: 500, allIn: true },
      { seat: 5, action: 'call', street: 'flop', order: 2, amount: 500 },
    ],
  },
  cardState: {
    communityCards: ['7♣', '2♦', '9♠', '4♥', 'K♠'],
    holeCards: ['A♥', 'A♦'],
    allPlayerCards: { 3: ['K♥', 'K♦'] },
  },
});

const HOUR = 3600000;
const BASE = Date.UTC(2026, 0, 1);

/** A completed cash session of `hours` length returning `pnl` profit. */
const cash = (pnl, hours, i = 0, extra = {}) => ({
  sessionId: `s${i}`,
  startTime: BASE + i * 24 * HOUR,
  endTime: BASE + i * 24 * HOUR + hours * HOUR,
  venue: 'Wind Creek',
  gameType: '1/3',
  buyIn: 500,
  rebuyTransactions: [],
  cashOut: 500 + pnl,
  tipAmount: 0,
  handCount: 0,
  isActive: false,
  ...extra,
});

/** n sessions alternating between two results — a clearly winning sample. */
const winningSample = (n = 40) =>
  Array.from({ length: n }, (_, i) => cash(i % 2 === 0 ? 400 : 200, 3, i));

/** n sessions that lose money, with realistic session-to-session spread. */
const losingSample = (n = 30) =>
  Array.from({ length: n }, (_, i) => cash(i % 3 === 0 ? 300 : -400, 3, i));

/** n sessions with huge swings around a small edge — cannot prove a win rate. */
const swingySample = (n = 40) =>
  Array.from({ length: n }, (_, i) => cash(i % 2 === 0 ? 1500 : -1400, 3, i));

beforeEach(() => {
  try {
    localStorage.clear();
  } catch {}
  getHandsBySessionId.mockReset();
  getHandsBySessionId.mockResolvedValue([]);
});

describe('VarianceBand', () => {
  it('renders nothing without a cash sample', () => {
    const { container } = render(<VarianceBand sessions={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when every session is a tournament', () => {
    const tourneys = [cash(500, 3, 0, { sessionKind: 'tournament' })];
    const { container } = render(<VarianceBand sessions={tourneys} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the observed hourly rate in the header', () => {
    render(<VarianceBand sessions={winningSample()} />);
    // +300 avg over 3h = $100/hr
    expect(screen.getByTestId('variance-band')).toHaveTextContent('+$100/hr');
  });

  it('collapses and persists the choice', () => {
    render(<VarianceBand sessions={winningSample()} />);
    const toggle = screen.getByRole('button', { name: /Bankroll & Variance/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(localStorage.getItem('sessionsView.varianceCollapsed')).toBe('1');
  });

  describe('win-rate interval', () => {
    it('says plainly when the sample cannot prove a winning rate', () => {
      render(<VarianceBand sessions={swingySample()} />);
      const verdict = screen.getByTestId('interval-verdict');
      expect(verdict).toHaveTextContent(/consistent with breaking even or losing/i);
    });

    it('confirms a rate the swings cannot explain away', () => {
      render(<VarianceBand sessions={winningSample()} />);
      expect(screen.getByTestId('interval-verdict')).toHaveTextContent(
        /genuine winning rate/i
      );
    });

    it('declines to draw a range below the session threshold', () => {
      render(<VarianceBand sessions={winningSample(10)} />);
      expect(screen.queryByTestId('interval-bar')).not.toBeInTheDocument();
      expect(screen.getByText(/Needs 20 cash sessions/i)).toBeInTheDocument();
    });

    it('names the sample size and hours it used', () => {
      render(<VarianceBand sessions={winningSample(30)} />);
      expect(screen.getByTestId('variance-band')).toHaveTextContent('30 cash sessions');
      expect(screen.getByTestId('variance-band')).toHaveTextContent('90 hours');
    });

    it('declares what it excluded rather than silently dropping it', () => {
      const sessions = [
        ...winningSample(25),
        cash(900, 4, 90, { sessionKind: 'tournament' }),
        cash(-200, 0, 91, { endTime: BASE + 91 * 24 * HOUR }),
      ];
      render(<VarianceBand sessions={sessions} />);
      const band = screen.getByTestId('variance-band');
      expect(band).toHaveTextContent('1 tournament');
      expect(band).toHaveTextContent('1 without a recorded time');
    });

    it('draws a zero marker when the interval spans zero', () => {
      render(<VarianceBand sessions={swingySample()} />);
      expect(screen.getByTestId('interval-zero')).toBeInTheDocument();
    });
  });

  describe('bankroll requirement', () => {
    it('stamps projected figures as modelled', () => {
      render(<VarianceBand sessions={winningSample()} />);
      // Bankroll, downswing and Kelly blocks are all projections.
      expect(screen.getAllByTestId('modelled-tag').length).toBeGreaterThanOrEqual(3);
    });

    it('changes the required bankroll with the risk tolerance', () => {
      render(<VarianceBand sessions={winningSample()} />);
      fireEvent.click(screen.getByTestId('tolerance-0.1'));
      const lenient = screen.getByText(/Bankroll for a 10% risk/i).nextSibling.textContent;
      fireEvent.click(screen.getByTestId('tolerance-0.01'));
      const strict = screen.getByText(/Bankroll for a 1% risk/i).nextSibling.textContent;
      const num = (s) => Number(s.replace(/[^0-9]/g, ''));
      expect(num(strict)).toBeGreaterThan(num(lenient));
    });

    it('persists the tolerance choice', () => {
      render(<VarianceBand sessions={winningSample()} />);
      fireEvent.click(screen.getByTestId('tolerance-0.1'));
      expect(localStorage.getItem('sessionsView.ruinTolerance')).toBe('0.1');
    });

    it('refuses to quote a bankroll for a losing rate', () => {
      const losing = losingSample();
      render(<VarianceBand sessions={losing} />);
      expect(screen.getByTestId('no-required-bankroll')).toHaveTextContent(
        /No bankroll makes this survivable/i
      );
    });

    it('computes risk of ruin once a bankroll is entered', () => {
      render(<VarianceBand sessions={winningSample()} />);
      expect(screen.queryByTestId('ruin-result')).not.toBeInTheDocument();
      fireEvent.change(screen.getByTestId('bankroll-input'), { target: { value: '5000' } });
      expect(screen.getByTestId('ruin-result')).toBeInTheDocument();
      expect(localStorage.getItem('sessionsView.bankroll')).toBe('5000');
    });

    it('reports certain ruin for a losing player, not a percentage', () => {
      const losing = losingSample();
      render(<VarianceBand sessions={losing} />);
      fireEvent.change(screen.getByTestId('bankroll-input'), { target: { value: '100000' } });
      expect(within(screen.getByTestId('ruin-result')).getByText('Certain')).toBeInTheDocument();
    });
  });

  describe('downswings and Kelly', () => {
    it('reports the worst stretch actually experienced', () => {
      const sessions = [cash(500, 3, 0), cash(-800, 3, 1), cash(300, 3, 2)];
      render(<VarianceBand sessions={sessions} />);
      expect(screen.getByText(/Worst stretch you've had/i).nextSibling).toHaveTextContent('$800');
    });

    it('shows Kelly sizings for a winning rate', () => {
      render(<VarianceBand sessions={winningSample()} />);
      expect(screen.getByText('Full Kelly')).toBeInTheDocument();
      expect(screen.getByText(/Half Kelly/i)).toBeInTheDocument();
      expect(screen.getByText(/Quarter Kelly/i)).toBeInTheDocument();
    });

    it('withholds Kelly at a non-winning rate', () => {
      const losing = losingSample();
      render(<VarianceBand sessions={losing} />);
      expect(screen.queryByText('Full Kelly')).not.toBeInTheDocument();
      expect(screen.getByText(/Kelly needs a positive win rate/i)).toBeInTheDocument();
    });
  });

  describe('all-in EV adjusted rate', () => {
    it('says there is nothing to adjust when no hands are recorded', async () => {
      // Every imported spreadsheet session is in exactly this state.
      render(<VarianceBand sessions={winningSample()} />);
      await waitFor(() =>
        expect(screen.getByTestId('adjusted-rate-empty')).toBeInTheDocument()
      );
      expect(screen.getByTestId('adjusted-rate-empty')).toHaveTextContent(
        /No all-in hands recorded yet/i
      );
    });

    it('raises the rate when hero lost an all-in as the favourite', async () => {
      // One bad beat on the first session; the rest have no hands.
      getHandsBySessionId.mockImplementation(async (id) =>
        id === 's0' ? [badBeatHand()] : []
      );
      render(<VarianceBand sessions={winningSample()} />);

      await waitFor(() =>
        expect(screen.getByTestId('adjusted-rate')).toHaveTextContent(/Adjusted for all-in luck/i)
      );
      const row = screen.getByTestId('adjusted-rate');
      expect(row).toHaveTextContent(/Replaces the result of 1 all-in hand/i);
      // Losing as a favourite means the adjustment credits hero.
      expect(row).toHaveTextContent(/\+\$/);
    });

    it('states the limit — only all-in pots are corrected', async () => {
      getHandsBySessionId.mockImplementation(async (id) =>
        id === 's0' ? [badBeatHand()] : []
      );
      render(<VarianceBand sessions={winningSample()} />);
      await waitFor(() =>
        expect(screen.getByTestId('adjusted-rate')).toHaveTextContent(
          /coolers you paid off with chips behind still count in full/i
        )
      );
    });

    it('stamps the adjusted rate as modelled', async () => {
      getHandsBySessionId.mockImplementation(async (id) =>
        id === 's0' ? [badBeatHand()] : []
      );
      render(<VarianceBand sessions={winningSample()} />);
      await waitFor(() =>
        expect(
          within(screen.getByTestId('adjusted-rate')).getByTestId('modelled-tag')
        ).toBeInTheDocument()
      );
    });

    it('degrades quietly when the hand store cannot be read', async () => {
      getHandsBySessionId.mockRejectedValue(new Error('idb unavailable'));
      render(<VarianceBand sessions={winningSample()} />);
      // The rest of the band must still render — a failed adjustment is not a
      // reason to hide the measured win rate.
      expect(screen.getByTestId('variance-band')).toHaveTextContent('+$100/hr');
      await waitFor(() =>
        expect(screen.queryByTestId('adjusted-rate')).not.toBeInTheDocument()
      );
    });
  });
});
