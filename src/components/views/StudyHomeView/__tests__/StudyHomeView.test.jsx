// @vitest-environment jsdom
/**
 * StudyHomeView.test.jsx — Study Home v1 structure and routing.
 *
 * Per docs/design/surfaces/study-home.md §SH-V1.
 *
 * The defect this surface fixes is that 14 of ~16 study tabs were reachable only
 * through a button at the bottom of SessionsView. These tests pin the fix: the
 * three purpose groups exist, every card routes somewhere real, and the drill
 * cards route to a SPECIFIC TAB — a card that dumps the user on the drill view's
 * default tab has not actually solved "where do I go to study".
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { StudyHomeView } from '../StudyHomeView';
import { SCREEN } from '../../../../constants/uiConstants';

const setCurrentScreen = vi.fn();
const openDrills = vi.fn();

vi.mock('../../../../contexts/UIContext', () => ({
  useUI: () => ({ setCurrentScreen, openDrills, SCREEN }),
}));
vi.mock('../../../../contexts/AuthContext', () => ({
  useAuth: () => ({ userId: 'u1' }),
}));

let mockCoach = { loading: false, composites: [] };
vi.mock('../../../../hooks/useSelfCoachMastery', () => ({
  useSelfCoachMastery: () => mockCoach,
}));

beforeEach(() => {
  setCurrentScreen.mockClear();
  openDrills.mockClear();
  mockCoach = { loading: false, composites: [] };
});

describe('StudyHomeView — purpose grouping', () => {
  it('renders exactly the three purpose groups, in Learn → Practice → Review order', () => {
    render(<StudyHomeView scale={1} />);
    for (const id of ['learn', 'practice', 'review']) {
      expect(screen.getByTestId(`study-group-${id}`)).toBeInTheDocument();
    }
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(['Learn', 'Practice', 'Review']);
  });

  it('gives every card a "when to use this" line, not just a title', () => {
    // Without this line the user is back to decoding tab names, four of which
    // are duplicated verbatim across the two drill views.
    render(<StudyHomeView scale={1} />);
    for (const group of ['learn', 'practice', 'review']) {
      const cards = within(screen.getByTestId(`study-group-${group}`)).getAllByRole('button');
      expect(cards.length).toBeGreaterThan(0);
      for (const card of cards) {
        const paragraphs = card.querySelectorAll('p');
        expect(paragraphs.length).toBeGreaterThan(0);
        expect(paragraphs[0].textContent.trim().length).toBeGreaterThan(20);
      }
    }
  });
});

describe('StudyHomeView — routing', () => {
  it.each([
    ['study-card-curriculum', SCREEN.SELF_COACH],
    ['study-card-hand-review', SCREEN.HISTORY],
    ['study-card-refresher', SCREEN.PRINTABLE_REFRESHER],
    ['study-card-anchor-library', SCREEN.ANCHOR_LIBRARY],
  ])('%s routes to its screen', (testid, expected) => {
    render(<StudyHomeView scale={1} />);
    fireEvent.click(screen.getByTestId(testid));
    expect(setCurrentScreen).toHaveBeenCalledWith(expected);
  });

  it.each([
    ['study-card-postflop-lessons', SCREEN.POSTFLOP_DRILLS, 'lessons'],
    ['study-card-preflop-lessons', SCREEN.PREFLOP_DRILLS, 'lessons'],
    ['study-card-line-study', SCREEN.POSTFLOP_DRILLS, 'line'],
    ['study-card-postflop-drills', SCREEN.POSTFLOP_DRILLS, 'explorer'],
    ['study-card-preflop-drills', SCREEN.PREFLOP_DRILLS, 'shape'],
  ])('%s opens the drill view on a specific tab and returns to Study', (testid, screenId, tab) => {
    render(<StudyHomeView scale={1} />);
    fireEvent.click(screen.getByTestId(testid));
    expect(openDrills).toHaveBeenCalledWith(screenId, tab, SCREEN.STUDY_HOME);
  });

  it('never routes a drill card through the plain screen setter', () => {
    // setCurrentScreen would skip the tab + return-screen context entirely.
    render(<StudyHomeView scale={1} />);
    fireEvent.click(screen.getByTestId('study-card-line-study'));
    expect(setCurrentScreen).not.toHaveBeenCalled();
  });
});

describe('StudyHomeView — inventory counts', () => {
  it('derives lesson counts from the content modules rather than hardcoding them', async () => {
    const { LESSONS: postflop } = await import('../../../../utils/postflopDrillContent/lessons');
    const { LESSONS: preflop } = await import('../../../../utils/drillContent/lessons');
    render(<StudyHomeView scale={1} />);
    expect(screen.getByText(`${postflop.length} lessons`)).toBeInTheDocument();
    expect(screen.getByText(`${preflop.length} lessons`)).toBeInTheDocument();
  });

  it('pluralizes and zero-cases the curriculum count', () => {
    mockCoach = { loading: false, composites: [{ compositeScore: 0.4 }] };
    const { unmount } = render(<StudyHomeView scale={1} />);
    expect(screen.getByText('1 concept to work on')).toBeInTheDocument();
    unmount();

    mockCoach = { loading: false, composites: [{ compositeScore: 0.4 }, { compositeScore: 0.2 }] };
    const second = render(<StudyHomeView scale={1} />);
    expect(screen.getByText('2 concepts to work on')).toBeInTheDocument();
    second.unmount();

    mockCoach = { loading: false, composites: [{ compositeScore: 0 }] };
    render(<StudyHomeView scale={1} />);
    expect(screen.getByText('nothing flagged')).toBeInTheDocument();
  });
});
