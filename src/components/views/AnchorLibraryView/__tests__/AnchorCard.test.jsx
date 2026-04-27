// @vitest-environment jsdom
/**
 * AnchorCard.test.jsx — render + interaction coverage for collapsed anchor card.
 *
 * EAL Phase 6 — Session 18 (S18).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnchorCard } from '../AnchorCard';

const baseAnchor = {
  id: 'anchor:nit:river:overfold:4flush',
  archetypeName: 'Nit Over-Fold to River Overbet on 4-Flush Scare',
  status: 'active',
  tier: 2,
  polarity: 'overfold',
  lineSequence: [
    { street: 'flop' },
    { street: 'turn' },
    { street: 'river' },
  ],
  evidence: { pointEstimate: 0.72 },
  validation: { timesApplied: 34 },
};

describe('AnchorCard — basic render', () => {
  it('returns null when anchor is missing', () => {
    const { container } = render(<AnchorCard />);
    expect(container).toBeEmptyDOMElement();
  });

  it('returns null when anchor is not an object', () => {
    const { container } = render(<AnchorCard anchor="oops" />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders archetype name as a heading', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent(baseAnchor.archetypeName);
  });

  it('renders fallback name when archetypeName is missing', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, archetypeName: undefined }} />);
    expect(screen.getByText(/unnamed anchor/i)).toBeInTheDocument();
  });

  it('exposes data-anchor-id + data-status for DOM-reachable assertions (red line #2)', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    const card = screen.getByTestId('anchor-card');
    expect(card).toHaveAttribute('data-anchor-id', baseAnchor.id);
    expect(card).toHaveAttribute('data-status', 'active');
  });
});

describe('AnchorCard — status chip + glyph', () => {
  it.each([
    ['active', '●'],
    ['retired', '○'],
    ['expiring', '◐'],
    ['suppressed', '⊘'],
    ['candidate', '?'],
  ])('renders %s status with glyph %s', (status, glyph) => {
    render(<AnchorCard anchor={{ ...baseAnchor, status }} />);
    const card = screen.getByTestId('anchor-card');
    expect(card).toHaveAttribute('data-status', status);
    expect(card.textContent).toContain(glyph);
    expect(card.textContent).toContain(status);
  });

  it('falls back to candidate glyph for unknown status', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, status: 'mystery' }} />);
    const card = screen.getByTestId('anchor-card');
    expect(card.textContent).toContain('?');
  });
});

describe('AnchorCard — meta chips', () => {
  it('renders Tier {n} when tier is a number', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, tier: 2 }} />);
    expect(screen.getByText(/Tier 2/)).toBeInTheDocument();
  });

  it('passes through string tier label', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, tier: 'Tier 1 candidate' }} />);
    expect(screen.getByText(/Tier 1 candidate/)).toBeInTheDocument();
  });

  it('omits tier chip when tier is missing', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, tier: undefined }} />);
    expect(screen.queryByText(/Tier/)).toBeNull();
  });

  it('derives street from the last lineSequence entry', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    expect(screen.getByText(/river/)).toBeInTheDocument();
  });

  it('omits street chip when lineSequence is empty', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, lineSequence: [] }} />);
    expect(screen.queryByText(/flop|turn|river/)).toBeNull();
  });

  it('renders polarity chip', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    expect(screen.getByText(/overfold/)).toBeInTheDocument();
  });
});

describe('AnchorCard — confidence dial', () => {
  it('exposes accessible alt text "Confidence N% of 100%"', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    expect(screen.getByLabelText('Confidence 72% of 100%')).toBeInTheDocument();
  });

  it('clamps pointEstimate above 1 to 100%', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, evidence: { pointEstimate: 1.5 } }} />);
    expect(screen.getByLabelText('Confidence 100% of 100%')).toBeInTheDocument();
  });

  it('clamps pointEstimate below 0 to 0%', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, evidence: { pointEstimate: -0.3 } }} />);
    expect(screen.getByLabelText('Confidence 0% of 100%')).toBeInTheDocument();
  });

  it('handles missing evidence as 0%', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, evidence: undefined }} />);
    expect(screen.getByLabelText('Confidence 0% of 100%')).toBeInTheDocument();
  });
});

describe('AnchorCard — firing count', () => {
  it('renders fired N× from validation.timesApplied', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    expect(screen.getByText(/fired 34×/)).toBeInTheDocument();
  });

  it('falls back to 0 when validation is missing (anchor not yet fired)', () => {
    render(<AnchorCard anchor={{ ...baseAnchor, validation: undefined }} />);
    expect(screen.getByText(/fired 0×/)).toBeInTheDocument();
  });

  it('does NOT render a "target" or "goal" count (red line #5 — no gamification)', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    const card = screen.getByTestId('anchor-card');
    expect(card.textContent).not.toMatch(/of \d+/i); // would imply "fired 34 of 100"
    expect(card.textContent).not.toMatch(/goal/i);
    expect(card.textContent).not.toMatch(/target/i);
  });
});

describe('AnchorCard — ⓘ button', () => {
  it('has ≥44×44 tap target (H-ML06)', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    const info = screen.getByTestId('anchor-card-info');
    expect(info).toHaveStyle({ minHeight: '44px', minWidth: '44px' });
  });

  it('has aria-label naming the anchor (recognition > recall, H-N06)', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    const info = screen.getByTestId('anchor-card-info');
    expect(info).toHaveAttribute('aria-label', `Show details for ${baseAnchor.archetypeName}`);
  });

  it('has aria-expanded="false" at S18 (panel not yet shipped)', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    expect(screen.getByTestId('anchor-card-info')).toHaveAttribute('aria-expanded', 'false');
  });

  it('invokes onInfoTap with the anchor when tapped', () => {
    const onInfoTap = vi.fn();
    render(<AnchorCard anchor={baseAnchor} onInfoTap={onInfoTap} />);
    fireEvent.click(screen.getByTestId('anchor-card-info'));
    expect(onInfoTap).toHaveBeenCalledWith(baseAnchor);
  });

  it('is inert (no crash) when onInfoTap is omitted', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    expect(() => fireEvent.click(screen.getByTestId('anchor-card-info'))).not.toThrow();
  });
});

describe('AnchorCard — AP-04 refusal (no scalar calibration score)', () => {
  it('does NOT render a "score" or "grade" label anywhere', () => {
    render(<AnchorCard anchor={baseAnchor} />);
    const card = screen.getByTestId('anchor-card');
    expect(card.textContent).not.toMatch(/calibration score/i);
    expect(card.textContent).not.toMatch(/grade/i);
    expect(card.textContent).not.toMatch(/your accuracy/i);
  });
});
