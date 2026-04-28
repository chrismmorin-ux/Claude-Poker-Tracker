/**
 * AnchorDetailPanel.test.jsx — transparency panel render contract.
 *
 * EAL Phase 6 — Session 20 (S20).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AnchorDetailPanel, formatRelativeTime } from '../AnchorDetailPanel';
import { PERCEPTION_PRIMITIVE_SEEDS } from '../../../../utils/anchorLibrary/perceptionPrimitiveSeed';

const buildAnchor = (overrides = {}) => ({
  id: 'anchor:test:1',
  archetypeName: 'Test Anchor',
  status: 'active',
  tier: 2,
  polarity: 'overfold',
  lineSequence: [
    { street: 'flop' },
    { street: 'turn' },
    { street: 'river' },
  ],
  perceptionPrimitiveIds: ['PP-01'],
  gtoBaseline: { method: 'MDF', referenceRate: 0.54, referenceEv: 0.04 },
  evDecomposition: { statAttributable: 0.5, perceptionAttributable: 0.5 },
  retirementCondition: { method: 'credible-interval-overlap', params: { level: 0.95 } },
  origin: { source: 'ai-authored', authoredAt: '2026-04-24T12:00:00Z', authoredBy: 'session-1' },
  evidence: { pointEstimate: 0.72 },
  validation: { timesApplied: 12, lastFiredAt: '2026-04-26T12:00:00Z' },
  ...overrides,
});

describe('AnchorDetailPanel — defensive rendering', () => {
  it('returns null when anchor missing', () => {
    const { container } = render(<AnchorDetailPanel anchor={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('returns null when anchor not an object', () => {
    const { container } = render(<AnchorDetailPanel anchor={'oops'} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders panel container with role=region + aria-label including archetype name', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const panel = screen.getByTestId('anchor-detail-panel');
    expect(panel.getAttribute('role')).toBe('region');
    expect(panel.getAttribute('aria-label')).toContain('Test Anchor');
  });

  it('does not render collapse button when onCollapse omitted', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    expect(screen.queryByTestId('anchor-detail-panel-collapse')).toBeNull();
  });

  it('renders collapse button + invokes onCollapse on click', () => {
    const onCollapse = vi.fn();
    render(<AnchorDetailPanel anchor={buildAnchor()} onCollapse={onCollapse} />);
    const btn = screen.getByTestId('anchor-detail-panel-collapse');
    fireEvent.click(btn);
    expect(onCollapse).toHaveBeenCalledTimes(1);
  });
});

describe('AnchorDetailPanel — section 1: Observed rate', () => {
  it('shows "Not yet observed" when calibrationGap absent', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const row = screen.getByTestId('panel-row-observed');
    expect(row.textContent).toContain('Not yet observed');
    expect(row.textContent).toContain('n=0');
  });

  it('shows percent + CI + sample size when calibrationGap present', () => {
    const anchor = buildAnchor({
      calibrationGap: {
        observedRate: 0.58,
        observedCI: { lower: 0.42, upper: 0.74 },
        observedSampleSize: 22,
      },
    });
    render(<AnchorDetailPanel anchor={anchor} />);
    const row = screen.getByTestId('panel-row-observed');
    expect(row.textContent).toContain('58%');
    expect(row.textContent).toContain('42%-74%');
    expect(row.textContent).toContain('n=22');
  });

  it('shows percent without CI when CI malformed', () => {
    const anchor = buildAnchor({
      calibrationGap: {
        observedRate: 0.58,
        observedCI: null,
        observedSampleSize: 10,
      },
    });
    render(<AnchorDetailPanel anchor={anchor} />);
    const row = screen.getByTestId('panel-row-observed');
    expect(row.textContent).toContain('58%');
    expect(row.textContent).toContain('n=10');
  });
});

describe('AnchorDetailPanel — section 2: Predicted rate', () => {
  it('renders predicted rate with GTO method attribution', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const row = screen.getByTestId('panel-row-predicted');
    expect(row.textContent).toContain("Model's predicted rate");
    expect(row.textContent).toContain('54%');
    expect(row.textContent).toContain('MDF');
  });

  it('shows "Unavailable" when gtoBaseline.referenceRate missing', () => {
    const anchor = buildAnchor({ gtoBaseline: { method: 'MDF' } });
    render(<AnchorDetailPanel anchor={anchor} />);
    const row = screen.getByTestId('panel-row-predicted');
    expect(row.textContent).toContain('Unavailable');
  });
});

describe('AnchorDetailPanel — section 3: Perception model', () => {
  it('renders primitive ID + full name (no raw IDs alone — H-N06)', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ perceptionPrimitiveIds: ['PP-01'] })} />);
    const list = screen.getByTestId('panel-perception-list');
    expect(list).toBeTruthy();
    const pp01 = PERCEPTION_PRIMITIVE_SEEDS.find((p) => p.id === 'PP-01');
    expect(list.textContent).toContain('PP-01');
    expect(list.textContent).toContain(pp01.name);
  });

  it('renders multiple primitives with their names', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ perceptionPrimitiveIds: ['PP-01', 'PP-04'] })} />);
    const items = screen.getAllByTestId('panel-perception-list')[0].querySelectorAll('li');
    expect(items.length).toBe(2);
    expect(items[0].getAttribute('data-primitive-id')).toBe('PP-01');
    expect(items[1].getAttribute('data-primitive-id')).toBe('PP-04');
  });

  it('falls back to "(name unavailable)" for unknown primitive IDs', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ perceptionPrimitiveIds: ['PP-99'] })} />);
    const list = screen.getByTestId('panel-perception-list');
    expect(list.textContent).toContain('PP-99');
    expect(list.textContent).toContain('name unavailable');
  });

  it('shows "None" when perceptionPrimitiveIds empty', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ perceptionPrimitiveIds: [] })} />);
    const row = screen.getByTestId('panel-row-perception');
    expect(row.textContent).toContain('None');
  });

  it('shows "None" when perceptionPrimitiveIds missing entirely', () => {
    const anchor = buildAnchor();
    delete anchor.perceptionPrimitiveIds;
    render(<AnchorDetailPanel anchor={anchor} />);
    const row = screen.getByTestId('panel-row-perception');
    expect(row.textContent).toContain('None');
  });
});

describe('AnchorDetailPanel — section 4: Status', () => {
  it('renders full text mapping for active', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'active' })} />);
    expect(screen.getByTestId('panel-row-status').textContent).toContain('calibration within target zone');
  });

  it('renders full text mapping for retired', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'retired' })} />);
    expect(screen.getByTestId('panel-row-status').textContent).toContain('owner-finalized');
  });

  it('renders full text mapping for expiring', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'expiring' })} />);
    expect(screen.getByTestId('panel-row-status').textContent).toContain('retirement pending');
  });

  it('renders full text mapping for suppressed', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'suppressed' })} />);
    expect(screen.getByTestId('panel-row-status').textContent).toContain('owner muted');
  });

  it('falls back to "status detail unavailable" for unknown status', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'mystery' })} />);
    expect(screen.getByTestId('panel-row-status').textContent).toContain('mystery');
  });
});

describe('AnchorDetailPanel — section 5: Last fired', () => {
  it('shows relative time when lastFiredAt present', () => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    render(<AnchorDetailPanel anchor={buildAnchor({ validation: { lastFiredAt: oneHourAgo } })} />);
    const row = screen.getByTestId('panel-row-last-fired');
    expect(row.textContent).toMatch(/1 hour ago|just now|min ago/);
  });

  it('shows "never" when lastFiredAt null', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ validation: { lastFiredAt: null } })} />);
    const row = screen.getByTestId('panel-row-last-fired');
    expect(row.textContent).toContain('never');
  });
});

describe('AnchorDetailPanel — section 6: Deep-link button (S20 stub)', () => {
  it('renders disabled-style deep-link button with aria-disabled=true', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const btn = screen.getByTestId('panel-deep-link-dashboard');
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.getAttribute('title')).toContain('Calibration Dashboard');
  });

  it('invokes onOpenDashboard with anchorId on click', () => {
    const onOpenDashboard = vi.fn();
    render(<AnchorDetailPanel anchor={buildAnchor()} onOpenDashboard={onOpenDashboard} />);
    fireEvent.click(screen.getByTestId('panel-deep-link-dashboard'));
    expect(onOpenDashboard).toHaveBeenCalledWith('anchor:test:1');
  });

  it('does not crash when onOpenDashboard omitted', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    expect(() => fireEvent.click(screen.getByTestId('panel-deep-link-dashboard'))).not.toThrow();
  });
});

describe('AnchorDetailPanel — section 7: Override actions (S20 stubs)', () => {
  it('renders all 3 override action buttons for active anchor', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'active' })} />);
    expect(screen.getByTestId('panel-action-retire')).toBeTruthy();
    expect(screen.getByTestId('panel-action-suppress')).toBeTruthy();
    expect(screen.getByTestId('panel-action-reset')).toBeTruthy();
    expect(screen.queryByTestId('panel-action-re-enable')).toBeNull();
  });

  it('Retire button has data-action="retire" and ≥40px tap target', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const btn = screen.getByTestId('panel-action-retire');
    expect(btn.getAttribute('data-action')).toBe('retire');
    expect(parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(40);
  });

  it('invokes onOverrideAction with action + anchorId on click', () => {
    const onOverrideAction = vi.fn();
    render(<AnchorDetailPanel anchor={buildAnchor()} onOverrideAction={onOverrideAction} />);
    fireEvent.click(screen.getByTestId('panel-action-retire'));
    expect(onOverrideAction).toHaveBeenCalledWith('retire', 'anchor:test:1');

    fireEvent.click(screen.getByTestId('panel-action-suppress'));
    expect(onOverrideAction).toHaveBeenCalledWith('suppress', 'anchor:test:1');

    fireEvent.click(screen.getByTestId('panel-action-reset'));
    expect(onOverrideAction).toHaveBeenCalledWith('reset', 'anchor:test:1');
  });
});

describe('AnchorDetailPanel — Re-enable action (S23, status-conditional)', () => {
  it('renders [Re-enable] (only) for retired anchors', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'retired' })} />);
    expect(screen.getByTestId('panel-action-re-enable')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-action-retire')).toBeNull();
    expect(screen.queryByTestId('panel-action-suppress')).toBeNull();
    expect(screen.queryByTestId('panel-action-reset')).toBeNull();
  });

  it('renders [Re-enable] (only) for suppressed anchors', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'suppressed' })} />);
    expect(screen.getByTestId('panel-action-re-enable')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-action-retire')).toBeNull();
    expect(screen.queryByTestId('panel-action-suppress')).toBeNull();
    expect(screen.queryByTestId('panel-action-reset')).toBeNull();
  });

  it('renders [Retire/Suppress/Reset] for expiring anchors (not yet terminal)', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'expiring' })} />);
    expect(screen.getByTestId('panel-action-retire')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-action-re-enable')).toBeNull();
  });

  it('renders [Retire/Suppress/Reset] for candidate anchors', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'candidate' })} />);
    expect(screen.getByTestId('panel-action-retire')).toBeInTheDocument();
    expect(screen.queryByTestId('panel-action-re-enable')).toBeNull();
  });

  it('exposes data-actions-variant attribute for visual/test reach', () => {
    const { rerender } = render(<AnchorDetailPanel anchor={buildAnchor({ status: 'active' })} />);
    expect(screen.getByTestId('panel-overrides').getAttribute('data-actions-variant')).toBe('override');
    rerender(<AnchorDetailPanel anchor={buildAnchor({ status: 'retired' })} />);
    expect(screen.getByTestId('panel-overrides').getAttribute('data-actions-variant')).toBe('re-enable');
  });

  it('Re-enable button has data-action="re-enable" + ≥40px tap target', () => {
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'retired' })} />);
    const btn = screen.getByTestId('panel-action-re-enable');
    expect(btn.getAttribute('data-action')).toBe('re-enable');
    expect(parseInt(btn.style.minHeight, 10)).toBeGreaterThanOrEqual(40);
  });

  it('Re-enable click invokes onOverrideAction with action="re-enable" + anchorId', () => {
    const onOverrideAction = vi.fn();
    render(<AnchorDetailPanel anchor={buildAnchor({ status: 'retired' })} onOverrideAction={onOverrideAction} />);
    fireEvent.click(screen.getByTestId('panel-action-re-enable'));
    expect(onOverrideAction).toHaveBeenCalledWith('re-enable', 'anchor:test:1');
  });
});

describe('AnchorDetailPanel — AP-06 copy discipline', () => {
  it('does NOT contain forbidden owner-grading copy', () => {
    const anchor = buildAnchor({
      calibrationGap: {
        observedRate: 0.58,
        observedCI: { lower: 0.42, upper: 0.74 },
        observedSampleSize: 22,
      },
    });
    const { container } = render(<AnchorDetailPanel anchor={anchor} />);
    const text = container.textContent.toLowerCase();
    // Forbidden patterns per AP-06 and CD-2 / CD-3
    expect(text).not.toMatch(/your accuracy/);
    expect(text).not.toMatch(/your observation/);
    expect(text).not.toMatch(/you were off/);
    expect(text).not.toMatch(/you misjudged/);
    expect(text).not.toMatch(/grade your/);
    expect(text).not.toMatch(/score your/);
    expect(text).not.toMatch(/how did you/);
    expect(text).not.toMatch(/did you nail/);
  });

  it('uses "Model\'s predicted rate" framing for predicted rate row', () => {
    render(<AnchorDetailPanel anchor={buildAnchor()} />);
    const row = screen.getByTestId('panel-row-predicted');
    expect(row.textContent).toContain("Model's predicted rate");
  });
});

describe('AnchorDetailPanel — event isolation', () => {
  it('stops click propagation so card-level handlers do not see panel clicks', () => {
    const cardClick = vi.fn();
    const { container } = render(
      <div onClick={cardClick}>
        <AnchorDetailPanel anchor={buildAnchor()} />
      </div>,
    );
    const panel = container.querySelector('[data-testid="anchor-detail-panel"]');
    fireEvent.click(panel);
    expect(cardClick).not.toHaveBeenCalled();
  });
});

describe('formatRelativeTime', () => {
  const NOW = Date.parse('2026-04-28T12:00:00Z');

  it('returns "never" for null input', () => {
    expect(formatRelativeTime(null, NOW)).toBe('never');
  });

  it('returns "never" for undefined input', () => {
    expect(formatRelativeTime(undefined, NOW)).toBe('never');
  });

  it('returns "—" for empty string', () => {
    expect(formatRelativeTime('', NOW)).toBe('—');
  });

  it('returns "—" for malformed timestamp', () => {
    expect(formatRelativeTime('not-a-date', NOW)).toBe('—');
  });

  it('returns "just now" within first 60 seconds', () => {
    expect(formatRelativeTime('2026-04-28T11:59:30Z', NOW)).toBe('just now');
  });

  it('returns minutes for < 1 hour', () => {
    expect(formatRelativeTime('2026-04-28T11:50:00Z', NOW)).toBe('10 min ago');
  });

  it('returns "1 hour ago" exactly', () => {
    expect(formatRelativeTime('2026-04-28T11:00:00Z', NOW)).toBe('1 hour ago');
  });

  it('returns plural "hours ago" for > 1 hour', () => {
    expect(formatRelativeTime('2026-04-28T09:00:00Z', NOW)).toBe('3 hours ago');
  });

  it('returns days for > 24 hours and < 7 days', () => {
    expect(formatRelativeTime('2026-04-25T12:00:00Z', NOW)).toBe('3 days ago');
  });

  it('returns weeks for ≥ 7 days', () => {
    expect(formatRelativeTime('2026-04-14T12:00:00Z', NOW)).toBe('2 weeks ago');
  });

  it('returns "in the future" for forward timestamps', () => {
    expect(formatRelativeTime('2026-04-29T12:00:00Z', NOW)).toBe('in the future');
  });
});
