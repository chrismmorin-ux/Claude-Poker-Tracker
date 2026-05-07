// @vitest-environment jsdom
/**
 * @file SelfCoachView copy-discipline lint — forbidden-rank-label outside
 * the owner-tier radio + autonomy red line #5 engagement-pressure copy +
 * tier-as-rank lint (numeric "Tier N" form).
 *
 * Mirrors the pattern from
 *   src/components/views/HandReplayView/__tests__/HeroCoachingCard.leak.test.jsx
 * (lines 141-167).
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { FORBIDDEN_RANK_LABELS } from '../../../../utils/skillAssessment/learningStateDescriber';

vi.mock('../../../../contexts', () => ({
  useUI: () => ({
    setCurrentScreen: vi.fn(),
    SCREEN: { TABLE: 'table' },
    openLessonDetail: vi.fn(),
  }),
  useSettings: () => ({
    settings: {
      selfCoach: {
        signalToggles: { enableLeak: true, enableDrill: true, enableTest: true, enableRecent: true },
        signalWeights: { W_leak: 0.5, W_drill: 0.3, W_test: 0.15, W_recent: 0.05 },
        ownerTier: null,
      },
    },
    dispatchSettings: vi.fn(),
  }),
}));

vi.mock('../../../../utils/skillAssessment/conceptMastery', () => {
  const mkMastery = (id, kind, opts = {}) => ({
    conceptId: id,
    leakSignal: { hasFiredLeak: !!opts.leakFired, severity: opts.severity || 0, sampleSize: opts.sampleSize || 0 },
    drillSignal: { mastery: opts.drillMastery || 0, attemptCount: opts.drillAttempts || 0, lastAttemptAt: null },
    testSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
    recencyPenalty: 0,
    meta: { kind, tier: opts.tier || 1, parent: opts.parent || null, children: opts.children || [] },
  });
  return {
    listAllConceptMastery: vi.fn().mockResolvedValue([
      mkMastery('pot-odds', 'general-skill', { tier: 1, drillMastery: 0.5, drillAttempts: 3 }),
      mkMastery('cbet-defense-cluster', 'rule-anchored-umbrella', {
        tier: 3, leakFired: true, severity: 0.6, sampleSize: 30,
        children: ['ip-cbet-defense-dry-LATE'],
      }),
      mkMastery('ip-cbet-defense-dry-LATE', 'rule-anchored-specific', {
        tier: 3, parent: 'cbet-defense-cluster', leakFired: true, severity: 0.4, sampleSize: 30,
      }),
    ]),
  };
});

vi.mock('../../../../utils/skillAssessment/lessonRegistry', () => ({
  getLesson: vi.fn(() => null),
  listLoadedLessons: vi.fn().mockReturnValue([]),
  listLessonsForCurriculum: vi.fn().mockReturnValue([]),
}));

import { CurriculumTab } from '../CurriculumTab';
import { SettingsTab } from '../SettingsTab';

afterEach(() => cleanup());

describe('SelfCoachView copy-discipline — forbidden-rank-labels OUTSIDE owner-tier radio', () => {
  it('CurriculumTab body contains no rank-label words anywhere', async () => {
    const { container } = render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-descriptor-summary')).toBeDefined();
    });
    // Open every umbrella + every inspector to maximize DOM coverage.
    const toggles = container.querySelectorAll('[data-testid$="-toggle"]');
    toggles.forEach((t) => fireEvent.click(t));
    const badges = container.querySelectorAll('[data-testid$="-composite-badge"]');
    badges.forEach((b) => fireEvent.click(b));
    const text = container.textContent || '';
    for (const label of FORBIDDEN_RANK_LABELS) {
      // Match standalone rank labels — not as part of dashed conceptId fragments.
      // FORBIDDEN_RANK_LABELS includes 'pro' which would collide with 'protocol' etc.;
      // assert as a whole-word boundary regex.
      const wholeWord = new RegExp(`\\b${label.replace(/-/g, '\\-')}\\b`, 'i');
      if (wholeWord.test(text)) {
        // If a rank word appears, fail with a precise diagnostic.
        throw new Error(`Forbidden rank label "${label}" leaked into Curriculum DOM. Tier indicators must be numeric "Tier N".`);
      }
    }
  });

  it('tier indicators in Curriculum render as "Tier N" numeric form, never as rank words', async () => {
    const { container } = render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-tier-1')).toBeDefined();
    });
    const tierHeader1 = screen.getByTestId('curriculum-tier-1').querySelector('h2').textContent;
    const tierHeader3 = screen.getByTestId('curriculum-tier-3').querySelector('h2').textContent;
    expect(tierHeader1).toMatch(/Tier 1/);
    expect(tierHeader3).toMatch(/Tier 3/);
    // Confirm none of the rank labels appear in tier headers.
    for (const label of FORBIDDEN_RANK_LABELS) {
      expect(tierHeader1).not.toMatch(new RegExp(label, 'i'));
      expect(tierHeader3).not.toMatch(new RegExp(label, 'i'));
    }
    // Sanity: container references "Tier" multiple times.
    expect(container.textContent).toMatch(/Tier \d/);
  });

  it('SettingsTab — rank labels appear ONLY inside the owner-tier radio group', () => {
    const { container } = render(<SettingsTab />);
    const radio = screen.getByTestId('self-coach-owner-tier');
    const radioText = radio.textContent || '';
    const fullText = container.textContent || '';
    for (const label of FORBIDDEN_RANK_LABELS) {
      // Each label MUST appear in the radio (the radio is THE place these render).
      expect(radioText).toMatch(new RegExp(label, 'i'));
      // The label appears in `fullText` only because `radioText ⊆ fullText`. The
      // rest of the surface (signal toggles + signal weight sliders) MUST NOT
      // include the label outside the radio. We check that by removing the
      // radio's text from the full text and verifying nothing remains.
      const outsideRadio = fullText.replace(radioText, '');
      expect(outsideRadio).not.toMatch(new RegExp(`\\b${label}\\b`, 'i'));
    }
  });
});

describe('SelfCoachView copy-discipline — autonomy red line #5 engagement-pressure copy', () => {
  it('CurriculumTab body contains no graded / engagement copy', async () => {
    const { container } = render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-descriptor-summary')).toBeDefined();
    });
    const toggles = container.querySelectorAll('[data-testid$="-toggle"]');
    toggles.forEach((t) => fireEvent.click(t));
    const badges = container.querySelectorAll('[data-testid$="-composite-badge"]');
    badges.forEach((b) => fireEvent.click(b));
    const text = container.textContent || '';
    expect(text).not.toMatch(/wrong/i);
    expect(text).not.toMatch(/missed/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/level up/i);
    expect(text).not.toMatch(/grade/i);
    expect(text).not.toMatch(/great job/i);
    expect(text).not.toMatch(/well done/i);
    expect(text).not.toMatch(/excellent/i);
    expect(text).not.toMatch(/you (are|need|should|must)/i);
    // 'score' deliberately excluded — composite score IS the field name. The
    // semantic concern is grading copy ("you scored X"), not the word itself
    // appearing in axis labels. The full set of "you ..." patterns above
    // catches the grading-imperative shape.
  });

  it('SettingsTab body contains no graded / engagement copy', () => {
    const { container } = render(<SettingsTab />);
    const text = container.textContent || '';
    expect(text).not.toMatch(/wrong/i);
    expect(text).not.toMatch(/missed/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/level up/i);
    expect(text).not.toMatch(/grade/i);
    expect(text).not.toMatch(/great job/i);
    expect(text).not.toMatch(/well done/i);
    expect(text).not.toMatch(/excellent/i);
    expect(text).not.toMatch(/you (are|need|should|must)/i);
  });
});
