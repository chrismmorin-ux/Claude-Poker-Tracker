// @vitest-environment jsdom
/**
 * PreflopCardTemplate.test.jsx — render-time correctness for the preflop card template.
 *
 * PRF Phase 5 — Session 20 (PRF-G5-UI).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PreflopCardTemplate } from '../PreflopCardTemplate';

const baseManifest = {
  cardId: 'PRF-PREFLOP-OPEN-CO-100BB-2-5',
  schemaVersion: 1,
  class: 'preflop',
  title: 'CO open · 100bb',
  bodyMarkdown:
    '$2/$5 cash · 5% rake cap $5 · 9-handed.\n\nException: vs straddle → tighten top 5% of range.',
  generatedFields: {
    rangeGrid: Array.from({ length: 169 }, (_, idx) => (idx % 7 === 0 ? 1 : 0)),
    defaultSizing: '3bb (4bb if 2 limpers)',
  },
  theoryCitation: 'POKER_THEORY.md §3.2',
  assumptions: { stakes: '$2/$5', rake: '5% cap $5', effectiveStack: 100, field: '9-handed live cash' },
  bucketDefinitionsCited: null,
  contentHash: 'sha256:preflop',
  lastVersionedAt: '2026-04-27T00:00:00Z',
};

describe('PreflopCardTemplate — basic render', () => {
  it('renders the card title', () => {
    render(<PreflopCardTemplate manifest={baseManifest} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/CO open · 100bb/);
  });

  it('uses navy accent #1e3a5f on the title', () => {
    render(<PreflopCardTemplate manifest={baseManifest} />);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveStyle({ color: '#1e3a5f' });
  });

  it('renders the 13×13 hand grid with 169 cells when rangeGrid present', () => {
    const { container } = render(<PreflopCardTemplate manifest={baseManifest} />);
    const cells = container.querySelectorAll('.refresher-preflop-grid-cell');
    expect(cells).toHaveLength(169);
  });

  it('omits the hand grid when rangeGrid is missing or wrong length', () => {
    const noGrid = { ...baseManifest, generatedFields: {} };
    const { container } = render(<PreflopCardTemplate manifest={noGrid} />);
    expect(container.querySelector('.refresher-preflop-grid')).toBeNull();
  });

  it('renders the sizing hint when defaultSizing is present', () => {
    render(<PreflopCardTemplate manifest={baseManifest} />);
    expect(screen.getByText(/Sizing:/)).toBeInTheDocument();
    expect(screen.getByText(/3bb \(4bb if 2 limpers\)/)).toBeInTheDocument();
  });

  it('renders the exception/derivation paragraph as Region 3 callout', () => {
    render(<PreflopCardTemplate manifest={baseManifest} />);
    expect(screen.getByText(/Exception: vs straddle/)).toBeInTheDocument();
  });

  it('omits Region 3 when no second paragraph', () => {
    const single = { ...baseManifest, bodyMarkdown: 'CO open scenario.' };
    const { container } = render(<PreflopCardTemplate manifest={single} />);
    expect(container.querySelector('.refresher-card-region-3')).toBeNull();
  });

  it('renders the lineage footer when not compact', () => {
    render(<PreflopCardTemplate manifest={baseManifest} runtime={{ engineVersion: 'v9.9', appVersion: 'v8.8' }} />);
    expect(screen.getByText(/PRF-PREFLOP-OPEN-CO-100BB-2-5 v1/)).toBeInTheDocument();
    expect(screen.getByText(/POKER_THEORY\.md §3\.2/)).toBeInTheDocument();
  });

  it('omits the lineage footer when compact=true', () => {
    render(<PreflopCardTemplate manifest={baseManifest} compact={true} />);
    expect(screen.queryByText(/POKER_THEORY\.md §3\.2/)).toBeNull();
    expect(screen.getByText(/CO open · 100bb/)).toBeInTheDocument();
  });

  it('returns null when manifest is missing', () => {
    const { container } = render(<PreflopCardTemplate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders data-card-class="preflop" attribute', () => {
    const { container } = render(<PreflopCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('article')).toHaveAttribute('data-card-class', 'preflop');
  });

  it('renders data-card-id attribute', () => {
    const { container } = render(<PreflopCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('article')).toHaveAttribute(
      'data-card-id',
      'PRF-PREFLOP-OPEN-CO-100BB-2-5'
    );
  });

  it('renders break-inside: avoid for print fidelity', () => {
    const { container } = render(<PreflopCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('article')).toHaveStyle({ breakInside: 'avoid' });
  });

  it('grid has aria-label describing the 13×13 structure', () => {
    const { container } = render(<PreflopCardTemplate manifest={baseManifest} />);
    const grid = container.querySelector('.refresher-preflop-grid');
    expect(grid).toHaveAttribute('aria-label', '13 by 13 preflop hand grid');
  });

  it('grid cells include data-cell labels (AA on diagonal, AKs above, AKo below)', () => {
    const { container } = render(<PreflopCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('[data-cell="AA"]')).not.toBeNull();
    expect(container.querySelector('[data-cell="AKs"]')).not.toBeNull();
    expect(container.querySelector('[data-cell="AKo"]')).not.toBeNull();
    expect(container.querySelector('[data-cell="22"]')).not.toBeNull();
  });

  it('mixed-frequency cells render with linear-gradient background', () => {
    const mixedManifest = {
      ...baseManifest,
      generatedFields: {
        ...baseManifest.generatedFields,
        rangeGrid: Array.from({ length: 169 }, () => 0.5),
      },
    };
    const { container } = render(<PreflopCardTemplate manifest={mixedManifest} />);
    const cells = container.querySelectorAll('.refresher-preflop-grid-cell');
    const styles = Array.from(cells).map((c) => c.getAttribute('style') || '');
    expect(styles.some((s) => /linear-gradient/.test(s))).toBe(true);
  });
});
