// @vitest-environment jsdom
/**
 * MathCardTemplate.test.jsx — render-time correctness for the math card template.
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MathCardTemplate } from '../MathCardTemplate';

const sampleManifest = {
  cardId: 'PRF-MATH-AUTO-PROFIT',
  schemaVersion: 1,
  class: 'math',
  title: 'Auto-profit threshold — single-bullet bluff (rake-agnostic, 100bb effective)',
  bodyMarkdown: 'Bet B into pot P needs villain to fold at least B/(P+B) of their range.\n\nWorked example: bet 6 into pot 8 → break-even fold frequency = 6/14 = 42.9%.',
  theoryCitation: 'POKER_THEORY.md §3.1 (auto-profit threshold derivation)',
  assumptions: { stakes: 'rake-agnostic', rake: null, effectiveStack: 100, field: 'all 9-handed live cash' },
  bucketDefinitionsCited: null,
  contentHash: 'sha256:abc',
  lastVersionedAt: '2026-04-25T00:00:00Z',
};

describe('MathCardTemplate — basic render', () => {
  it('renders the card title', () => {
    render(<MathCardTemplate manifest={sampleManifest} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Auto-profit threshold/);
  });

  it('renders bodyMarkdown paragraphs (split on double-newline)', () => {
    render(<MathCardTemplate manifest={sampleManifest} />);
    expect(screen.getByText(/Bet B into pot P/)).toBeInTheDocument();
    expect(screen.getByText(/Worked example/)).toBeInTheDocument();
  });

  it('renders the lineage footer with all 7 fields when not compact', () => {
    render(<MathCardTemplate manifest={sampleManifest} runtime={{ engineVersion: 'v9.9', appVersion: 'v8.8' }} />);
    // Footer is a single text block; check for representative excerpts
    expect(screen.getByText(/PRF-MATH-AUTO-PROFIT v1/)).toBeInTheDocument();
    expect(screen.getByText(/2026-04-25T00:00:00Z/)).toBeInTheDocument();
    expect(screen.getByText(/POKER_THEORY-derivation/)).toBeInTheDocument();
    expect(screen.getByText(/engine v9\.9 \/ app v8\.8/)).toBeInTheDocument();
    expect(screen.getByText(/POKER_THEORY\.md §3\.1/)).toBeInTheDocument();
    expect(screen.getByText(/no bucket definitions cited/)).toBeInTheDocument();
  });

  it('omits the lineage footer when compact=true', () => {
    render(<MathCardTemplate manifest={sampleManifest} compact={true} />);
    // Footer text should not be present
    expect(screen.queryByText(/POKER_THEORY-derivation/)).toBeNull();
    // But the title + body still render
    expect(screen.getByText(/Auto-profit threshold/)).toBeInTheDocument();
    expect(screen.getByText(/Bet B into pot P/)).toBeInTheDocument();
  });

  it('returns null when manifest is missing', () => {
    const { container } = render(<MathCardTemplate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('uses burnt-orange accent on the title (math class color)', () => {
    render(<MathCardTemplate manifest={sampleManifest} />);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveStyle({ color: '#c05621' });
  });

  it('renders break-inside: avoid for print fidelity', () => {
    const { container } = render(<MathCardTemplate manifest={sampleManifest} />);
    const article = container.querySelector('article.refresher-card-math');
    expect(article).toHaveStyle({ breakInside: 'avoid' });
  });

  it('renders data-card-class attribute for CSS targeting', () => {
    const { container } = render(<MathCardTemplate manifest={sampleManifest} />);
    const article = container.querySelector('article');
    expect(article).toHaveAttribute('data-card-class', 'math');
  });

  it('renders data-card-id attribute', () => {
    const { container } = render(<MathCardTemplate manifest={sampleManifest} />);
    const article = container.querySelector('article');
    expect(article).toHaveAttribute('data-card-id', 'PRF-MATH-AUTO-PROFIT');
  });
});
