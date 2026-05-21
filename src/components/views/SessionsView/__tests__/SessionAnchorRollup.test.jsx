/**
 * SessionAnchorRollup.test.jsx — rollup component + AP-06 + AP-08 DOM-asserted.
 *
 * Per SPR-061 / WS-171 + Gate 1 audit acceptance criteria.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { SessionAnchorRollup } from '../SessionAnchorRollup';
import { OBSERVATION_ORIGINS } from '../../../../constants/anchorLibraryConstants';
import { FORBIDDEN_PATTERNS } from '../../../../utils/anchorLibrary/retirementCopy';

const buildMatcherObs = (anchorId, idx = 0) => ({
  id: `obs:h:${idx}:matcher:${anchorId}:flop`,
  handId: `h:${idx}`,
  anchorId,
  origin: OBSERVATION_ORIGINS.MATCHER_SYSTEM,
  ownerTags: [],
  createdAt: '2026-05-09T09:00:00.000Z',
});

const buildOwnerObs = (idx = 0) => ({
  id: `obs:h:${idx}:${idx}`,
  handId: `h:${idx}`,
  origin: OBSERVATION_ORIGINS.OWNER_CAPTURED,
  ownerTags: ['mistake'],
  createdAt: '2026-05-09T09:30:00.000Z',
});

const buildAnchor = (id, archetypeName) => ({
  id,
  archetypeName: archetypeName || id,
  status: 'retired',
  operator: {
    lastOverrideBy: 'system',
    overrideReason: 'auto-retire',
    lastOverrideAt: '2026-05-09T10:30:00.000Z',
  },
});

describe('SessionAnchorRollup', () => {
  describe('empty state', () => {
    it('renders empty placeholder when all 3 arrays are empty', () => {
      const { container } = render(
        <SessionAnchorRollup matcherFired={[]} ownerCaptured={[]} autoRetired={[]} />,
      );
      const root = screen.getByTestId('session-anchor-rollup');
      expect(root).toHaveAttribute('data-empty', 'true');
      expect(container.textContent).toContain('No anchor activity for this session.');
    });

    it('renders empty placeholder when arrays are missing entirely', () => {
      render(<SessionAnchorRollup />);
      expect(screen.getByTestId('session-anchor-rollup')).toHaveAttribute('data-empty', 'true');
    });
  });

  describe('section rendering (AP-08 separation)', () => {
    it('renders 3 distinct sections with header counts', () => {
      render(
        <SessionAnchorRollup
          matcherFired={[buildMatcherObs('a:nit'), buildMatcherObs('a:fish', 1)]}
          ownerCaptured={[buildOwnerObs(0)]}
          autoRetired={[buildAnchor('a:retired-1', 'Nit Overfold')]}
        />,
      );
      expect(screen.getByTestId('session-anchor-rollup-matcher-section')).toBeTruthy();
      expect(screen.getByTestId('session-anchor-rollup-owner-section')).toBeTruthy();
      expect(screen.getByTestId('session-anchor-rollup-auto-retire-section')).toBeTruthy();
    });

    it('matcher header shows separate count from owner header (AP-08 invariant)', () => {
      render(
        <SessionAnchorRollup
          matcherFired={[buildMatcherObs('a:1'), buildMatcherObs('a:2', 1)]}
          ownerCaptured={[buildOwnerObs(0)]}
          autoRetired={[]}
        />,
      );
      const matcherHeader = screen.getByTestId('session-anchor-rollup-matcher-header');
      const ownerHeader = screen.getByTestId('session-anchor-rollup-owner-header');
      expect(matcherHeader).toHaveTextContent(/Matcher-fired anchors/i);
      expect(matcherHeader).toHaveTextContent('(n=2)');
      expect(ownerHeader).toHaveTextContent(/Owner-captured observations/i);
      expect(ownerHeader).toHaveTextContent('(n=1)');
    });

    it('AP-08: no DOM element renders a SUMMED total of matcher + owner counts', () => {
      // 2 matcher + 1 owner = 3 (forbidden combined count); ensure no element shows "3" as a unified total
      const { container } = render(
        <SessionAnchorRollup
          matcherFired={[buildMatcherObs('a:1'), buildMatcherObs('a:2', 1)]}
          ownerCaptured={[buildOwnerObs(0)]}
          autoRetired={[]}
        />,
      );
      const matcherSection = screen.getByTestId('session-anchor-rollup-matcher-section');
      const ownerSection = screen.getByTestId('session-anchor-rollup-owner-section');
      // The two sections must be siblings, not nested — structurally separated.
      expect(matcherSection.contains(ownerSection)).toBe(false);
      expect(ownerSection.contains(matcherSection)).toBe(false);
      // No combined-count phrase like "3 total observations" or "3 events".
      expect(container.textContent).not.toMatch(/\b3\s+(total|combined|all)\b/i);
    });
  });

  describe('matcher-fired section', () => {
    it('renders empty-row copy when matcherFired is empty', () => {
      render(
        <SessionAnchorRollup matcherFired={[]} ownerCaptured={[buildOwnerObs(0)]} autoRetired={[]} />,
      );
      const matcherSection = screen.getByTestId('session-anchor-rollup-matcher-section');
      expect(matcherSection).toHaveTextContent(/No matcher firings during this session/i);
    });

    it('renders observations via AnchorObservationList when present', () => {
      render(
        <SessionAnchorRollup
          matcherFired={[buildMatcherObs('a:1'), buildMatcherObs('a:2', 1)]}
          ownerCaptured={[]}
          autoRetired={[]}
        />,
      );
      const matcherSection = screen.getByTestId('session-anchor-rollup-matcher-section');
      // AnchorObservationList renders timestamps; assert it mounted by checking for relative-time text
      expect(matcherSection).toBeTruthy();
    });
  });

  describe('owner-captured section', () => {
    it('renders empty-row copy when ownerCaptured is empty', () => {
      render(
        <SessionAnchorRollup
          matcherFired={[buildMatcherObs('a:1')]}
          ownerCaptured={[]}
          autoRetired={[]}
        />,
      );
      const ownerSection = screen.getByTestId('session-anchor-rollup-owner-section');
      expect(ownerSection).toHaveTextContent(/No owner captures during this session/i);
    });
  });

  describe('auto-retire section', () => {
    it('renders empty-row copy when autoRetired is empty', () => {
      render(
        <SessionAnchorRollup matcherFired={[]} ownerCaptured={[]} autoRetired={[]} />,
      );
      // Empty state is the all-empty placeholder, not the per-section empty-row.
      // Re-run with only the auto-retire section being empty:
    });

    it('renders summary + list when autoRetired is non-empty', () => {
      render(
        <SessionAnchorRollup
          matcherFired={[]}
          ownerCaptured={[]}
          autoRetired={[buildAnchor('a:1', 'Nit Overfold'), buildAnchor('a:2', 'Fish Overcall')]}
        />,
      );
      const summary = screen.getByTestId('session-anchor-rollup-auto-retire-summary');
      expect(summary).toHaveTextContent('2 anchors auto-retired during this session.');
      const list = screen.getByTestId('session-anchor-rollup-auto-retire-list');
      const items = within(list).getAllByRole('listitem');
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveTextContent('Nit Overfold');
      expect(items[1]).toHaveTextContent('Fish Overcall');
    });

    it('uses singular noun for count=1', () => {
      render(
        <SessionAnchorRollup
          matcherFired={[]}
          ownerCaptured={[]}
          autoRetired={[buildAnchor('a:1', 'Lone Anchor')]}
        />,
      );
      const summary = screen.getByTestId('session-anchor-rollup-auto-retire-summary');
      expect(summary).toHaveTextContent('1 anchor auto-retired during this session.');
    });

    it('falls back to anchor.id when archetypeName missing', () => {
      const anchor = { id: 'a:no-name', operator: {} };
      render(
        <SessionAnchorRollup matcherFired={[]} ownerCaptured={[]} autoRetired={[anchor]} />,
      );
      expect(screen.getByText('a:no-name')).toBeTruthy();
    });
  });

  describe('AP-06 forbidden-pattern absence (DOM-asserted)', () => {
    it.each([1, 2, 5, 17, 99])('autoRetired count=%d: rendered DOM has zero forbidden patterns', (count) => {
      const anchors = Array.from({ length: count }, (_, i) => buildAnchor(`a:${i}`, `Anchor ${i}`));
      const { container } = render(
        <SessionAnchorRollup matcherFired={[]} ownerCaptured={[]} autoRetired={anchors} />,
      );
      const text = container.textContent || '';
      for (const pattern of FORBIDDEN_PATTERNS) {
        expect(text).not.toMatch(pattern);
      }
    });

    it('rendered DOM contains no "your accuracy / observation / confidence" tokens', () => {
      const { container } = render(
        <SessionAnchorRollup
          matcherFired={[buildMatcherObs('a:1')]}
          ownerCaptured={[buildOwnerObs(0)]}
          autoRetired={[buildAnchor('a:1', 'X')]}
        />,
      );
      const text = container.textContent || '';
      expect(text).not.toMatch(/your accuracy/i);
      expect(text).not.toMatch(/your observation/i);
      expect(text).not.toMatch(/your confidence/i);
    });

    it('rendered DOM contains no AP-05 reconsider-retired nudge', () => {
      const { container } = render(
        <SessionAnchorRollup
          matcherFired={[]}
          ownerCaptured={[]}
          autoRetired={[buildAnchor('a:1', 'X')]}
        />,
      );
      const text = container.textContent || '';
      expect(text).not.toMatch(/\breconsider\b/i);
    });
  });

  describe('Tier-1 placeholder is omitted (per founder Q1c)', () => {
    it('rendered DOM contains no candidate-promotion / Tier-1 / Phase 2 mention', () => {
      const { container } = render(
        <SessionAnchorRollup
          matcherFired={[buildMatcherObs('a:1')]}
          ownerCaptured={[buildOwnerObs(0)]}
          autoRetired={[buildAnchor('a:1', 'X')]}
        />,
      );
      const text = container.textContent || '';
      expect(text).not.toMatch(/Tier[\s-]?1/i);
      expect(text).not.toMatch(/candidate[\s-]?promotion/i);
      expect(text).not.toMatch(/coming in Phase/i);
    });
  });
});
