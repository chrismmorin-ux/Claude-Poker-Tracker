/**
 * LiveAnchorBadge.test.jsx — Stream C live anchor badge component tests
 *
 * Per `docs/design/surfaces/live-anchor-badge.md` + AP-07 hard floor.
 *
 * Critical: the AP-07 forbidden-DOM snapshot enforces that none of the
 * calibration-state tokens leak onto the live surface regardless of input.
 */

import React from 'react';
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LiveAnchorBadge } from '../LiveAnchorBadge';

const fullyPopulatedAnchor = {
  id: 'anchor:nit:river:overfold:4flush',
  archetypeName: 'Nit scare-fold',
  status: 'active',
  polarity: 'overfold',
  tier: 2,
  evidence: {
    pointEstimate: 0.72,
    sampleSize: 52,
    credibleInterval: { lower: 0.58, upper: 0.83, level: 0.95 },
    posteriorConfidence: 0.91,
  },
  gtoBaseline: { method: 'MDF', referenceRate: 0.54 },
  consequence: { expectedDividend: { mean: 0.66, sd: 0.14, sharpe: 4.7 } },
  retirementCondition: { method: 'credible-interval-overlap' },
};

describe('LiveAnchorBadge — render', () => {
  test('renders nothing when anchor is null', () => {
    const { container } = render(<LiveAnchorBadge anchor={null} />);
    expect(container.firstChild).toBeNull();
  });

  test('renders nothing when anchor is undefined', () => {
    const { container } = render(<LiveAnchorBadge />);
    expect(container.firstChild).toBeNull();
  });

  test('renders archetype name when anchor present', () => {
    render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    expect(screen.getByText('Nit scare-fold')).toBeTruthy();
  });

  test('renders status dot glyph (●) for active anchors', () => {
    const { container } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    expect(container.textContent).toContain('●');
  });

  test('renders the 10-segment confidence dial', () => {
    const { getByTestId } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    const dial = getByTestId('live-anchor-badge-dial');
    // 0.72 → 7 filled (■), 3 empty (□)
    expect(dial.textContent).toContain('■');
    expect(dial.textContent).toContain('□');
    // exactly 10 segments
    const filled = (dial.textContent.match(/■/g) || []).length;
    const empty = (dial.textContent.match(/□/g) || []).length;
    expect(filled + empty).toBe(10);
    expect(filled).toBe(7); // round(0.72 * 10) = 7
  });

  test('falls back to (unnamed anchor) when archetypeName is missing', () => {
    const noName = { ...fullyPopulatedAnchor, archetypeName: undefined };
    render(<LiveAnchorBadge anchor={noName} />);
    expect(screen.getByText('(unnamed anchor)')).toBeTruthy();
  });

  test('exposes data-anchor-id attribute for telemetry hooks', () => {
    const { getByTestId } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    expect(getByTestId('live-anchor-badge').getAttribute('data-anchor-id')).toBe(
      'anchor:nit:river:overfold:4flush',
    );
  });
});

describe('LiveAnchorBadge — AP-07 forbidden-DOM enforcement (HARD FLOOR)', () => {
  // Per anti-patterns.md AP-07: live anchor surface shows
  // archetypeName + confidence dial only. Never observed rate, n=, CI,
  // retirement state, trend, perception primitive detail.
  test('does NOT render observed rate ("n=" / "%" outside dial / numeric percentage)', () => {
    const { container } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    const text = container.textContent;
    expect(text).not.toMatch(/n=/);
    expect(text).not.toMatch(/52/); // sample size
    expect(text).not.toMatch(/72%/); // observed rate (point estimate as %)
    expect(text).not.toMatch(/0\.72/); // raw point estimate as decimal
  });

  test('does NOT render credible interval bounds', () => {
    const { container } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    const text = container.textContent;
    expect(text).not.toMatch(/CI/);
    expect(text).not.toMatch(/0\.58/);
    expect(text).not.toMatch(/0\.83/);
    expect(text).not.toMatch(/±/);
    expect(text).not.toMatch(/95%/);
  });

  test('does NOT render retirement / suppression labels (status-text leakage)', () => {
    const { container } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    const text = container.textContent;
    expect(text).not.toMatch(/retired/i);
    expect(text).not.toMatch(/expiring/i);
    expect(text).not.toMatch(/suppressed/i);
    expect(text).not.toMatch(/stale/i);
    expect(text).not.toMatch(/active/i); // status text-name even though glyph ●
  });

  test('does NOT render predicted-vs-observed framing or dividend', () => {
    const { container } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    const text = container.textContent;
    expect(text).not.toMatch(/predicted/i);
    expect(text).not.toMatch(/observed/i);
    expect(text).not.toMatch(/gap/i);
    expect(text).not.toMatch(/dividend/i);
    expect(text).not.toMatch(/sample/i);
    expect(text).not.toMatch(/posterior/i);
    expect(text).not.toMatch(/Sharpe/i);
    expect(text).not.toMatch(/MDF/);
  });

  test('does NOT render perception-primitive details', () => {
    const anchorWithPrimitives = {
      ...fullyPopulatedAnchor,
      perceptionPrimitiveIds: ['PP-01'],
      perceptionPrimitiveNames: ['Nit re-weights aggressively on scare cards'],
    };
    const { container } = render(<LiveAnchorBadge anchor={anchorWithPrimitives} />);
    const text = container.textContent;
    expect(text).not.toMatch(/PP-/);
    expect(text).not.toMatch(/re-weights/i);
  });

  test('does NOT render tier label or polarity name', () => {
    const { container } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    const text = container.textContent;
    expect(text).not.toMatch(/tier 2/i);
    expect(text).not.toMatch(/overfold/i); // polarity is internal taxonomy
  });
});

describe('LiveAnchorBadge — tap interaction', () => {
  test('invokes onTap with anchorId, tappedAt, handId', () => {
    const onTap = vi.fn();
    const { getByTestId } = render(
      <LiveAnchorBadge anchor={fullyPopulatedAnchor} handId="hand-3" onTap={onTap} />,
    );
    fireEvent.click(getByTestId('live-anchor-badge'));
    expect(onTap).toHaveBeenCalledTimes(1);
    const payload = onTap.mock.calls[0][0];
    expect(payload.anchorId).toBe('anchor:nit:river:overfold:4flush');
    expect(payload.handId).toBe('hand-3');
    expect(typeof payload.tappedAt).toBe('string');
    expect(payload.tappedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/); // ISO8601 date
  });

  test('handles missing onTap gracefully (no throw)', () => {
    const { getByTestId } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} />);
    expect(() => fireEvent.click(getByTestId('live-anchor-badge'))).not.toThrow();
  });

  test('passes null handId when not provided', () => {
    const onTap = vi.fn();
    const { getByTestId } = render(<LiveAnchorBadge anchor={fullyPopulatedAnchor} onTap={onTap} />);
    fireEvent.click(getByTestId('live-anchor-badge'));
    expect(onTap.mock.calls[0][0].handId).toBeNull();
  });
});
