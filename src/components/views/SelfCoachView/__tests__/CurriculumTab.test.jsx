// @vitest-environment jsdom
/**
 * @file CurriculumTab tests — descriptor header + tree rendering +
 * umbrella expand/collapse + empty-lesson greying + Drill-this nav.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';

let mockOpenLessonDetail;

vi.mock('../../../../contexts', () => ({
  useUI: () => ({
    openLessonDetail: mockOpenLessonDetail,
    setCurrentScreen: vi.fn(),
    SCREEN: { TABLE: 'table' },
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
    drillSignal: { mastery: opts.drillMastery || 0, attemptCount: opts.drillAttempts || 0, lastAttemptAt: opts.lastDrill || null },
    testSignal: { mastery: opts.testMastery || 0, attemptCount: 0, lastAttemptAt: null },
    recencyPenalty: opts.recencyPenalty || 0,
    meta: { kind, tier: opts.tier || 1, parent: opts.parent || null, children: opts.children || [] },
  });
  const FAKE_MASTERIES = [
    mkMastery('pot-odds', 'general-skill', { tier: 1, drillMastery: 0.5, drillAttempts: 5 }),
    mkMastery('cbet-defense-cluster', 'rule-anchored-umbrella', {
      tier: 3, leakFired: true, severity: 0.6, sampleSize: 30,
      children: ['ip-cbet-defense-dry-LATE', 'ip-cbet-defense-medium-LATE'],
    }),
    mkMastery('ip-cbet-defense-dry-LATE', 'rule-anchored-specific', {
      tier: 3, parent: 'cbet-defense-cluster', leakFired: true, severity: 0.4, sampleSize: 30,
    }),
    mkMastery('ip-cbet-defense-medium-LATE', 'rule-anchored-specific', {
      tier: 3, parent: 'cbet-defense-cluster', leakFired: true, severity: 0.5, sampleSize: 32,
    }),
  ];
  return {
    listAllConceptMastery: vi.fn().mockResolvedValue(FAKE_MASTERIES),
  };
});

vi.mock('../../../../utils/skillAssessment/lessonRegistry', () => {
  const LESSON_FOR = {
    'pot-odds': { meta: { conceptId: 'pot-odds', title: 'Pot odds', tier: 1 } },
    'cbet-defense-cluster': { meta: { conceptId: 'cbet-defense-cluster', title: 'IP cbet defense', tier: 3 } },
    'ip-cbet-defense-dry-LATE': { meta: { conceptId: 'ip-cbet-defense-dry-LATE', title: 'IP dry LATE', tier: 3 } },
    // ip-cbet-defense-medium-LATE INTENTIONALLY omitted to test "Lesson coming"
  };
  return {
    getLesson: vi.fn((conceptId) => LESSON_FOR[conceptId] ?? null),
    listLoadedLessons: vi.fn().mockReturnValue(Object.keys(LESSON_FOR)),
    listLessonsForCurriculum: vi.fn().mockReturnValue([]),
  };
});

import { CurriculumTab } from '../CurriculumTab';

beforeEach(() => {
  mockOpenLessonDetail = vi.fn();
});
afterEach(() => cleanup());

describe('CurriculumTab — render shell', () => {
  it('shows loading state initially', () => {
    render(<CurriculumTab />);
    // Synchronously, the hook has loading=true; loading text renders.
    expect(screen.getByTestId('self-coach-curriculum-tab').textContent).toMatch(/Loading curriculum/);
  });

  it('renders descriptor summary after load', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-descriptor-summary')).toBeDefined();
    });
    expect(screen.getByTestId('curriculum-descriptor-summary').textContent).toMatch(/focused on|attention on|no active focus/);
  });

  it('renders the next-teachable badge when a recommendation exists', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-next-teachable')).toBeDefined();
    });
  });
});

describe('CurriculumTab — tier-grouped tree', () => {
  it('renders Tier 1 + Tier 3 sections', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-tier-1')).toBeDefined();
      expect(screen.getByTestId('curriculum-tier-3')).toBeDefined();
    });
  });

  it('renders pot-odds general-skill row at Tier 1', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-pot-odds')).toBeDefined();
    });
  });

  it('renders cbet-defense-cluster umbrella row at Tier 3 with children hidden by default', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-cbet-defense-cluster')).toBeDefined();
    });
    expect(screen.queryByTestId('concept-row-ip-cbet-defense-dry-LATE')).toBeNull();
    expect(screen.queryByTestId('concept-row-ip-cbet-defense-medium-LATE')).toBeNull();
  });

  it('expands umbrella to reveal children on toggle click', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-cbet-defense-cluster-toggle')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-cbet-defense-cluster-toggle'));
    expect(screen.getByTestId('concept-row-ip-cbet-defense-dry-LATE')).toBeDefined();
    expect(screen.getByTestId('concept-row-ip-cbet-defense-medium-LATE')).toBeDefined();
  });

  it('collapses umbrella on second toggle click', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-cbet-defense-cluster-toggle')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-cbet-defense-cluster-toggle'));
    fireEvent.click(screen.getByTestId('concept-row-cbet-defense-cluster-toggle'));
    expect(screen.queryByTestId('concept-row-ip-cbet-defense-dry-LATE')).toBeNull();
  });
});

describe('CurriculumTab — empty-lesson rendering', () => {
  it('renders Lesson coming tag on sub-concept without a lesson', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-cbet-defense-cluster-toggle')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-cbet-defense-cluster-toggle'));
    expect(screen.getByTestId('concept-row-ip-cbet-defense-medium-LATE-lesson-coming')).toBeDefined();
  });

  it('does NOT render Lesson coming tag on sub-concept WITH a lesson', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-cbet-defense-cluster-toggle')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-cbet-defense-cluster-toggle'));
    expect(screen.queryByTestId('concept-row-ip-cbet-defense-dry-LATE-lesson-coming')).toBeNull();
  });

  it('disables Drill button on sub-concept without a lesson', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-cbet-defense-cluster-toggle')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-cbet-defense-cluster-toggle'));
    const drillBtn = screen.getByTestId('concept-row-ip-cbet-defense-medium-LATE-drill-this');
    expect(drillBtn.disabled).toBe(true);
  });
});

describe('CurriculumTab — Drill-this navigation', () => {
  it('clicking Drill on a concept WITH a lesson invokes openLessonDetail', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-pot-odds-drill-this')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-pot-odds-drill-this'));
    expect(mockOpenLessonDetail).toHaveBeenCalledWith('pot-odds');
  });

  it('clicking Drill on a concept WITHOUT a lesson does NOT invoke openLessonDetail', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-cbet-defense-cluster-toggle')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-cbet-defense-cluster-toggle'));
    fireEvent.click(screen.getByTestId('concept-row-ip-cbet-defense-medium-LATE-drill-this'));
    expect(mockOpenLessonDetail).not.toHaveBeenCalled();
  });
});

describe('CurriculumTab — composition inspector', () => {
  it('toggling the composite badge reveals the inspector', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-pot-odds-composite-badge')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-pot-odds-composite-badge'));
    expect(screen.getByTestId('composition-inspector')).toBeDefined();
  });

  it('inspector shows the 4 CD-5 fields', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('concept-row-pot-odds-composite-badge')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('concept-row-pot-odds-composite-badge'));
    expect(screen.getByTestId('cd5-field-concept')).toBeDefined();
    expect(screen.getByTestId('cd5-field-signals')).toBeDefined();
    expect(screen.getByTestId('cd5-field-sample')).toBeDefined();
    expect(screen.getByTestId('cd5-field-methodology')).toBeDefined();
  });

  it('Why button on the next-teachable header opens the header inspector', async () => {
    render(<CurriculumTab />);
    await waitFor(() => {
      expect(screen.getByTestId('curriculum-next-teachable-why')).toBeDefined();
    });
    fireEvent.click(screen.getByTestId('curriculum-next-teachable-why'));
    expect(screen.getByTestId('composition-inspector')).toBeDefined();
  });
});
