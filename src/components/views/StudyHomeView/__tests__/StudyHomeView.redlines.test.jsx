// @vitest-environment jsdom
/**
 * StudyHomeView.redlines.test.jsx — autonomy red lines #5 and #6.
 *
 * These are the two constraints Gate 2 (audits/2026-07-31-blindspot-study-home-v1.md
 * Stage C) identified as most likely to regress, because both would regress by
 * someone adding something that FEELS like an improvement.
 *
 * RED LINE #5 — no streaks, shame, or engagement pressure. A study hub is the
 * single most natural place in the app to render "you haven't practiced X in 34
 * days," and the data to do it is available (conceptMastery exposes staleness).
 * Counts here must be factual inventory of what EXISTS, never behavioral
 * measurement of the USER. Binds hardest on the returning-after-break persona,
 * whose file forbids novice-treatment and re-placement on return.
 *
 * RED LINE #6 — the flat index renders unconditionally. No enrollment gate, no
 * empty-state lockout, no loading state that hides cards. A user with zero
 * history and a user mid-fetch both see every destination.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StudyHomeView } from '../StudyHomeView';
import { SCREEN } from '../../../../constants/uiConstants';

vi.mock('../../../../contexts/UIContext', () => ({
  useUI: () => ({ setCurrentScreen: vi.fn(), openDrills: vi.fn(), SCREEN }),
}));
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ userId: 'u1' }),
}));

let mockCoach = { loading: false, composites: [] };
vi.mock('../../../../hooks/useSelfCoachMastery', () => ({
  useSelfCoachMastery: () => mockCoach,
}));

const ALL_CARDS = [
  'study-card-curriculum',
  'study-card-postflop-lessons',
  'study-card-preflop-lessons',
  'study-card-line-study',
  'study-card-postflop-drills',
  'study-card-preflop-drills',
  'study-card-hand-review',
  'study-card-refresher',
  'study-card-anchor-library',
];

beforeEach(() => { mockCoach = { loading: false, composites: [] }; });

describe('red line #5 — no streaks, shame, or engagement pressure', () => {
  const FORBIDDEN = [
    /streak/i,
    /\bdays? ago\b/i,
    /last (studied|practiced|visited|opened)/i,
    /haven'?t\b/i,
    /you should/i,
    /keep it up/i,
    /don'?t lose/i,
    /\bdue\b/i,
    /overdue/i,
    /falling behind/i,
    /\b\d+% (mastery|complete|mastered)\b/i,
    /\btier \d/i,
    /\brank(ed|ing)?\b/i,
    /\bscore\b/i,
    /\bgrade[ds]?\b/i,
    /\bdecay(ed|ing)?\b/i,
    /stale/i,
  ];

  it.each([
    ['no history', { loading: false, composites: [] }],
    ['some flagged work', { loading: false, composites: [{ compositeScore: 0.8 }, { compositeScore: 0.3 }] }],
    ['loading', { loading: true, composites: null }],
  ])('renders no engagement-pressure copy (%s)', (_label, coach) => {
    mockCoach = coach;
    const { container } = render(<StudyHomeView scale={1} />);
    const text = container.textContent;
    for (const pattern of FORBIDDEN) {
      expect(text, `forbidden copy matched ${pattern}`).not.toMatch(pattern);
    }
  });

  it('states the one user-describing count as a work queue, not a judgment', () => {
    // "N concepts to work on" is carried verbatim from Homebase's study-queue
    // card, which already shipped under this red line. It describes remaining
    // work; it does not evaluate the user.
    mockCoach = { loading: false, composites: [{ compositeScore: 0.5 }, { compositeScore: 0.5 }] };
    render(<StudyHomeView scale={1} />);
    expect(screen.getByText('2 concepts to work on')).toBeInTheDocument();
  });
});

describe('red line #6 — flat index always accessible', () => {
  it.each([
    ['a brand-new user with no history', { loading: false, composites: [] }],
    ['mastery data still loading', { loading: true, composites: null }],
    ['a hook that failed and returned nothing usable', { loading: false, composites: undefined }],
  ])('renders every destination for %s', (_label, coach) => {
    mockCoach = coach;
    render(<StudyHomeView scale={1} />);
    for (const testid of ALL_CARDS) {
      expect(screen.getByTestId(testid), `${testid} missing`).toBeInTheDocument();
    }
  });

  it('shows no count rather than a placeholder while mastery is loading', () => {
    // The card still renders (#6); only its optional meta line is withheld.
    mockCoach = { loading: true, composites: null };
    render(<StudyHomeView scale={1} />);
    expect(screen.getByTestId('study-card-curriculum')).toBeInTheDocument();
    expect(screen.queryByText(/to work on/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nothing flagged/)).not.toBeInTheDocument();
  });
});
