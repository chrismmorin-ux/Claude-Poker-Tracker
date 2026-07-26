// @vitest-environment jsdom
/**
 * RangeDetailPanel — derived-line subclass surface (WS-256).
 *
 * The load-bearing behavior here is the EVIDENCE GATE: every subclass grid
 * carries prior mass, so its posterior width never reaches 0. Rendering an
 * unbacked pill would show a confident-looking "Squeeze: 8%" built from
 * nothing but the prior — the same trap that kept a rangeRules rule dead in
 * production until WS-223.
 */
import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RangeDetailPanel } from '../RangeDetailPanel';

const grid = (fill = 0.2) => new Float64Array(169).fill(fill);

const makeProfile = () => {
  const ranges = {};
  for (const pos of ['EARLY', 'MIDDLE', 'LATE', 'SB', 'BB']) {
    ranges[pos] = {};
    for (const a of ['fold', 'limp', 'open', 'coldCall', 'threeBet',
                     'openFirstIn', 'isoRaise', 'cold3Bet', 'squeeze', 'limpReraise']) {
      ranges[pos][a] = grid();
    }
  }
  return { ranges, showdownAnchors: [] };
};

const makeSummary = (subclassCounts = {}) => {
  const subclasses = {};
  const defs = {
    openFirstIn: 'open', isoRaise: 'open',
    cold3Bet: 'threeBet', squeeze: 'threeBet', limpReraise: 'threeBet',
  };
  for (const [key, parent] of Object.entries(defs)) {
    const count = subclassCounts[key] || 0;
    subclasses[key] = { parent, width: 12, count, pct: count ? 20 : null };
  }
  return {
    LATE: {
      noRaise: {}, facedRaise: {},
      noRaiseFreqs: { open: 30, limp: 10 },
      facedRaiseFreqs: { coldCall: 25, threeBet: 12 },
      subclasses,
      noRaiseHands: 40, facedRaiseHands: 30, hands: 70,
    },
  };
};

const renderPanel = (subclassCounts) =>
  render(
    <RangeDetailPanel
      rangeProfile={makeProfile()}
      rangeSummary={makeSummary(subclassCounts)}
      playerName="Villain"
      onClose={vi.fn()}
      isOpen
    />
  );

describe('RangeDetailPanel — subclass evidence gate', () => {
  it('hides every subclass pill when nothing has been observed', () => {
    renderPanel({});
    expect(screen.queryByText('First-In')).not.toBeInTheDocument();
    expect(screen.queryByText('Iso')).not.toBeInTheDocument();
    // The parent pill remains — it IS the honest aggregate until evidence exists.
    expect(screen.getByText('Open')).toBeInTheDocument();
  });

  it('shows only the observed subclass, not its unobserved sibling', () => {
    renderPanel({ isoRaise: 4 });
    expect(screen.getByText('Iso')).toBeInTheDocument();
    expect(screen.queryByText('First-In')).not.toBeInTheDocument();
  });

  it('renders the observed count next to the pill', () => {
    renderPanel({ isoRaise: 7 });
    const pill = screen.getByTitle('Iso — 7 observed');
    // Scoped to the pill: bare '7' also matches the range grid's rank labels.
    expect(pill).toHaveTextContent(/^Iso\s*7$/);
  });

  it('surfaces facing-raise subclasses after switching scenario', () => {
    renderPanel({ squeeze: 5, limpReraise: 2 });
    fireEvent.click(screen.getByText('Facing Raise'));
    expect(screen.getByText('Squeeze')).toBeInTheDocument();
    expect(screen.getByText('Limp-3Bet')).toBeInTheDocument();
    expect(screen.queryByText('Cold 3-Bet')).not.toBeInTheDocument();
  });

  it('warns that a thin subclass is mostly inherited from its parent', () => {
    renderPanel({ squeeze: 2 });
    fireEvent.click(screen.getByText('Facing Raise'));
    fireEvent.click(screen.getByText('Squeeze'));

    expect(screen.getByText(/Only 2 observed/)).toBeInTheDocument();
    expect(screen.getByText(/inherited/)).toBeInTheDocument();
    expect(screen.getByText(/3-bet range/)).toBeInTheDocument();
  });

  it('drops the inherited-range warning once evidence accumulates', () => {
    renderPanel({ squeeze: 9 });
    fireEvent.click(screen.getByText('Facing Raise'));
    fireEvent.click(screen.getByText('Squeeze'));
    expect(screen.queryByText(/mostly inherited/)).not.toBeInTheDocument();
  });

  it('reports the subclass backing count rather than total hands when one is selected', () => {
    renderPanel({ squeeze: 6 });
    fireEvent.click(screen.getByText('Facing Raise'));

    expect(screen.getByText('Hands:')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Squeeze'));
    expect(screen.getByText('Seen:')).toBeInTheDocument();
  });

  it('degrades cleanly when the summary predates the taxonomy (no subclasses key)', () => {
    const summary = makeSummary({});
    delete summary.LATE.subclasses;

    render(
      <RangeDetailPanel
        rangeProfile={makeProfile()}
        rangeSummary={summary}
        playerName="Villain"
        onClose={vi.fn()}
        isOpen
      />
    );
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.queryByText('Squeeze')).not.toBeInTheDocument();
  });
});
