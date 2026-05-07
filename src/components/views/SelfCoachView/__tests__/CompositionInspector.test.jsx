// @vitest-environment jsdom
/**
 * @file CompositionInspector tests — CD-5 4-field discipline + math
 * display + disabled-signal struck-through state.
 *
 * SPR-042 / WS-159 (2026-05-06).
 */

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CompositionInspector } from '../CompositionInspector';

afterEach(() => cleanup());

const sampleConcept = (overrides = {}) => ({
  conceptId: 'ip-cbet-defense-medium-LATE',
  meta: { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster' },
  ...overrides,
});

const sampleMastery = (overrides = {}) => ({
  conceptId: 'ip-cbet-defense-medium-LATE',
  leakSignal: { hasFiredLeak: true, severity: 0.6, sampleSize: 30 },
  drillSignal: { mastery: 0.5, attemptCount: 4, lastAttemptAt: '2026-05-04' },
  testSignal: { mastery: 0, attemptCount: 0, lastAttemptAt: null },
  recencyPenalty: 0,
  meta: { kind: 'rule-anchored-specific', tier: 3, parent: 'cbet-defense-cluster' },
  ...overrides,
});

const sampleComposite = (overrides = {}) => ({
  conceptId: 'ip-cbet-defense-medium-LATE',
  compositeScore: 0.45,
  breakdown: { leak: 0.30, drill: 0.15, test: 0.15, recent: 0 },
  ...overrides,
});

const DEFAULT_W = { W_leak: 0.5, W_drill: 0.3, W_test: 0.15, W_recent: 0.05 };
const DEFAULT_T = { enableLeak: true, enableDrill: true, enableTest: true, enableRecent: true };

describe('CompositionInspector — 4 CD-5 fields', () => {
  it('renders cd5-field-concept with conceptId + tier numeric form', () => {
    render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={sampleComposite()}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    const concept = screen.getByTestId('cd5-field-concept').textContent;
    expect(concept).toMatch(/ip-cbet-defense-medium-LATE/);
    expect(concept).toMatch(/Tier 3/);
    expect(concept).toMatch(/parent: cbet-defense-cluster/);
  });

  it('renders all 4 signal lines in cd5-field-signals', () => {
    render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={sampleComposite()}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    expect(screen.getByTestId('composition-inspector-signal-leak')).toBeDefined();
    expect(screen.getByTestId('composition-inspector-signal-drill')).toBeDefined();
    expect(screen.getByTestId('composition-inspector-signal-test')).toBeDefined();
    expect(screen.getByTestId('composition-inspector-signal-recent')).toBeDefined();
  });

  it('renders cd5-field-sample with sample sizes for each signal', () => {
    render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={sampleComposite()}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    const sample = screen.getByTestId('cd5-field-sample').textContent;
    expect(sample).toMatch(/leak: 30 hands/);
    expect(sample).toMatch(/drill: 4 attempts/);
  });

  it('renders cd5-field-methodology with the formula source', () => {
    render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={sampleComposite()}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    const methodology = screen.getByTestId('cd5-field-methodology').textContent;
    expect(methodology).toMatch(/composite/);
    expect(methodology).toMatch(/composite\.js/);
  });
});

describe('CompositionInspector — math display', () => {
  it('shows weight and contribution values for each enabled signal', () => {
    render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={sampleComposite()}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    const leakLine = screen.getByTestId('composition-inspector-signal-leak').textContent;
    expect(leakLine).toMatch(/W_leak=0\.50/);
    expect(leakLine).toMatch(/severity=0\.60/);
    expect(leakLine).toMatch(/= 0\.30/);
  });
});

describe('CompositionInspector — disabled-signal struck-through', () => {
  it('disabled signal renders with line-through text style', () => {
    const togglesLeakOff = { ...DEFAULT_T, enableLeak: false };
    render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={{ ...sampleComposite(), breakdown: { leak: 0, drill: 0.15, test: 0.15, recent: 0 } }}
        weights={DEFAULT_W}
        toggles={togglesLeakOff}
      />,
    );
    const leakLine = screen.getByTestId('composition-inspector-signal-leak');
    expect(leakLine.style.textDecoration).toMatch(/line-through/);
  });
});

describe('CompositionInspector — autonomy red line #5 lint', () => {
  it('renders no graded / engagement copy', () => {
    render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={sampleComposite()}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    const text = screen.getByTestId('composition-inspector').textContent || '';
    expect(text).not.toMatch(/wrong/i);
    expect(text).not.toMatch(/missed/i);
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/level up/i);
    expect(text).not.toMatch(/great job/i);
    expect(text).not.toMatch(/well done/i);
    expect(text).not.toMatch(/excellent/i);
    expect(text).not.toMatch(/you (are|need|should|must)/i);
  });
});

describe('CompositionInspector — null / loading guards', () => {
  it('returns null when concept is missing', () => {
    const { container } = render(
      <CompositionInspector
        concept={null}
        mastery={sampleMastery()}
        composite={sampleComposite()}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('returns null when composite is missing', () => {
    const { container } = render(
      <CompositionInspector
        concept={sampleConcept()}
        mastery={sampleMastery()}
        composite={null}
        weights={DEFAULT_W}
        toggles={DEFAULT_T}
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
