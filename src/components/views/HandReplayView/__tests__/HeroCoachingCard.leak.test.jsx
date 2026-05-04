// @vitest-environment jsdom
/**
 * @file Tests for the SCF leak-badge rendering inside HeroCoachingCard.
 *
 * SPR-030 / WS-145 (2026-05-03). Pre-existing HeroCoachingCard rendering tested
 * indirectly via ReviewPanel; this file focuses on the new leak badge surface.
 */

import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HeroCoachingCard } from '../HeroCoachingCard';

afterEach(() => cleanup());

const sampleLeak = (overrides = {}) => ({
  leakRuleId: 'hero-ip-cbet-overfold',
  label: 'IP cbet defense — fold-to-cbet rate',
  situationKey: 'flop:medium:LATE:def:ip:bet:vsBet',
  observedRate: 0.52,
  ciLower: 0.38,
  ciUpper: 0.66,
  sampleSize: 30,
  solverBaseline: 0.38,
  relatedConceptId: 'cbet-defense-cluster',
  severity: 0.5,
  confidence: 0.85,
  ...overrides,
});

const stubCoaching = () => ({
  evAssessment: {
    verdict: '+EV',
    expectedValue: 0.5,
    equityNeeded: 0.33,
    actualEquity: 0.50,
    reason: 'Sample reason',
    alternatives: [],
  },
});

// ─── Badge rendering ─────────────────────────────────────────────────────

describe('HeroCoachingCard — leak badge rendering', () => {
  it('renders nothing when no leak prop and no coaching', () => {
    const { container } = render(<HeroCoachingCard heroCoaching={null} leak={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the leak badge when leak prop provided', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    expect(screen.getByTestId('hero-leak-badge')).toBeDefined();
  });

  it('renders ⚑ glyph + label in collapsed state', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    const badge = screen.getByTestId('hero-leak-badge');
    expect(badge.textContent).toMatch(/⚑/);
    expect(badge.textContent).toMatch(/IP cbet defense/);
  });

  it('claim card is hidden by default', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    expect(screen.queryByTestId('hero-leak-claim-card')).toBeNull();
  });

  it('expands claim card on tap; collapses on second tap', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    const button = screen.getByRole('button', { name: /leak: IP cbet defense/i });
    fireEvent.click(button);
    expect(screen.getByTestId('hero-leak-claim-card')).toBeDefined();
    fireEvent.click(button);
    expect(screen.queryByTestId('hero-leak-claim-card')).toBeNull();
  });
});

// ─── CD-5 4-field discipline ─────────────────────────────────────────────

describe('HeroCoachingCard — CD-5 4-field claim discipline', () => {
  it('expanded card shows all 4 mandatory CD-5 fields', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    fireEvent.click(screen.getByRole('button', { name: /leak: IP cbet defense/i }));
    // Field 1: situation key (the label)
    expect(screen.getByTestId('cd5-field-situation').textContent).toMatch(/IP cbet defense/);
    // Field 2: sample size + observed + CI
    const obs = screen.getByTestId('cd5-field-observation').textContent;
    expect(obs).toMatch(/52%/);
    expect(obs).toMatch(/38%/); // ciLower
    expect(obs).toMatch(/66%/); // ciUpper
    expect(obs).toMatch(/30 hands/);
    // Field 3: solver baseline
    expect(screen.getByTestId('cd5-field-baseline').textContent).toMatch(/38%/);
    // Field 4: threshold floor
    expect(screen.getByTestId('cd5-field-threshold').textContent).toMatch(/30 hands/);
  });

  it('renders related drill link when present', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    fireEvent.click(screen.getByRole('button', { name: /leak: IP cbet defense/i }));
    expect(screen.getByTestId('cd5-related-drill').textContent).toMatch(/cbet-defense/);
  });
});

// ─── Affordances (Drill / Dismiss / Snooze) ──────────────────────────────

describe('HeroCoachingCard — affordances', () => {
  it('Drill this fires onDrill callback with the leak', () => {
    const onDrill = vi.fn();
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} onDrill={onDrill} />);
    fireEvent.click(screen.getByRole('button', { name: /leak: IP cbet defense/i }));
    fireEvent.click(screen.getByTestId('leak-affordance-drill'));
    expect(onDrill).toHaveBeenCalledTimes(1);
    expect(onDrill.mock.calls[0][0]).toMatchObject({ leakRuleId: 'hero-ip-cbet-overfold' });
  });

  it('Dismiss fires onDismiss callback with the leak', () => {
    const onDismiss = vi.fn();
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button', { name: /leak: IP cbet defense/i }));
    fireEvent.click(screen.getByTestId('leak-affordance-dismiss'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('Snooze fires onSnooze callback with the leak', () => {
    const onSnooze = vi.fn();
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} onSnooze={onSnooze} />);
    fireEvent.click(screen.getByRole('button', { name: /leak: IP cbet defense/i }));
    fireEvent.click(screen.getByTestId('leak-affordance-snooze'));
    expect(onSnooze).toHaveBeenCalledTimes(1);
  });

  it('omits affordance buttons when callbacks are not provided', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    fireEvent.click(screen.getByRole('button', { name: /leak: IP cbet defense/i }));
    expect(screen.queryByTestId('leak-affordance-drill')).toBeNull();
    expect(screen.queryByTestId('leak-affordance-dismiss')).toBeNull();
    expect(screen.queryByTestId('leak-affordance-snooze')).toBeNull();
  });
});

// ─── Autonomy red line #5 — no shame / engagement copy ───────────────────

describe('HeroCoachingCard — autonomy red line #5 lint test', () => {
  it('default rendered leak output contains no graded / engagement copy', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    fireEvent.click(screen.getByRole('button', { name: /leak: IP cbet defense/i }));
    const text = screen.getByTestId('hero-leak-claim-card').textContent || '';
    // Forbidden: graded copy, scoring, streak, engagement-pressure, shame.
    expect(text).not.toMatch(/wrong/i);
    expect(text).not.toMatch(/missed/i);
    expect(text).not.toMatch(/score/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/level up/i);
    expect(text).not.toMatch(/master/i);
    expect(text).not.toMatch(/grade/i);
    expect(text).not.toMatch(/great job/i);
    expect(text).not.toMatch(/well done/i);
    expect(text).not.toMatch(/excellent/i);
    expect(text).not.toMatch(/you (are|need|should|must)/i);
  });

  it('collapsed badge label contains no graded / engagement copy', () => {
    render(<HeroCoachingCard heroCoaching={stubCoaching()} leak={sampleLeak()} />);
    const badge = screen.getByTestId('hero-leak-badge').textContent || '';
    expect(badge).not.toMatch(/wrong|missed|score|streak|grade|master|great job|excellent/i);
  });
});
