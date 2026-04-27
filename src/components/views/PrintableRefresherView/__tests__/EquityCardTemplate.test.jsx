// @vitest-environment jsdom
/**
 * EquityCardTemplate.test.jsx — render-time correctness for the equity card template.
 *
 * PRF Phase 5 — Session 20 (PRF-G5-UI).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EquityCardTemplate } from '../EquityCardTemplate';

const baseManifest = {
  cardId: 'PRF-EQUITY-RANGE-VS-RANGE-TEXTURES',
  schemaVersion: 1,
  class: 'equity',
  title: 'Range equity · flop textures',
  bodyMarkdown:
    'vs UTG 12% open range · 100bb effective.\n\nNote: cells show the % of the range that falls into each bucket. Buckets cited: pokerCore/rangeMatrix.',
  generatedFields: {
    rangeId: 'UTG_OPEN_12PCT',
    equityMatrix: {
      headers: ['Nut', 'Strong', 'Marginal', 'Draw'],
      rows: [
        { texture: 'KQ7 rainbow', cells: [18, 22, 30, 20] },
        { texture: 'T98 two-tone', cells: [14, 19, 28, 29] },
        { texture: 'A92 rainbow', cells: [22, 26, 26, 16] },
        { texture: '862 mono', cells: [10, 15, 25, 35] },
      ],
    },
  },
  theoryCitation: 'POKER_THEORY.md §3.1 §7.3',
  assumptions: { stakes: 'solver-vs-solver', rake: null, effectiveStack: 100, field: 'solver baseline', opponentRange: 'UTG_OPEN_12PCT' },
  bucketDefinitionsCited: 'docs/design/glossary/equity-buckets.md',
  contentHash: 'sha256:equity',
  lastVersionedAt: '2026-04-27T00:00:00Z',
};

describe('EquityCardTemplate — basic render', () => {
  it('renders the card title', () => {
    render(<EquityCardTemplate manifest={baseManifest} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/Range equity · flop textures/);
  });

  it('uses teal accent #0f766e on the title', () => {
    render(<EquityCardTemplate manifest={baseManifest} />);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveStyle({ color: '#0f766e' });
  });

  it('renders the equity matrix as a table', () => {
    render(<EquityCardTemplate manifest={baseManifest} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('renders all bucket headers', () => {
    render(<EquityCardTemplate manifest={baseManifest} />);
    expect(screen.getByRole('columnheader', { name: /^Texture$/ })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Nut' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Strong' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Marginal' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: 'Draw' })).toBeInTheDocument();
  });

  it('renders all matrix rows with texture row-headers', () => {
    render(<EquityCardTemplate manifest={baseManifest} />);
    expect(screen.getByRole('rowheader', { name: 'KQ7 rainbow' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'T98 two-tone' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: 'A92 rainbow' })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: '862 mono' })).toBeInTheDocument();
  });

  it('renders cell percentages with % suffix', () => {
    render(<EquityCardTemplate manifest={baseManifest} />);
    // 18% / 30% / 35% are unique in the fixture; 22% / 26% appear twice
    expect(screen.getByText('18%')).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('35%')).toBeInTheDocument();
    // Duplicates assert via count
    expect(screen.getAllByText('22%')).toHaveLength(2);
  });

  it('caps row count at 8 (H-PM05 atomicity)', () => {
    const oversizedManifest = {
      ...baseManifest,
      generatedFields: {
        ...baseManifest.generatedFields,
        equityMatrix: {
          headers: ['A', 'B'],
          rows: Array.from({ length: 12 }, (_, idx) => ({
            texture: `t-${idx}`,
            cells: [10, 20],
          })),
        },
      },
    };
    render(<EquityCardTemplate manifest={oversizedManifest} />);
    expect(screen.getAllByRole('rowheader')).toHaveLength(8);
  });

  it('omits the table when equityMatrix is missing', () => {
    const noMatrix = { ...baseManifest, generatedFields: { rangeId: baseManifest.generatedFields.rangeId } };
    render(<EquityCardTemplate manifest={noMatrix} />);
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('renders the bucket-citation paragraph as Region 3', () => {
    const { container } = render(<EquityCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('.refresher-card-region-3')).not.toBeNull();
    expect(screen.getByText(/Buckets cited: pokerCore\/rangeMatrix/)).toBeInTheDocument();
  });

  it('renders the lineage footer when not compact', () => {
    render(<EquityCardTemplate manifest={baseManifest} runtime={{ engineVersion: 'v9.9', appVersion: 'v8.8' }} />);
    expect(screen.getByText(/PRF-EQUITY-RANGE-VS-RANGE-TEXTURES v1/)).toBeInTheDocument();
    expect(screen.getByText(/POKER_THEORY\.md §3\.1 §7\.3/)).toBeInTheDocument();
  });

  it('omits the lineage footer when compact=true', () => {
    render(<EquityCardTemplate manifest={baseManifest} compact={true} />);
    expect(screen.queryByText(/POKER_THEORY\.md §3\.1/)).toBeNull();
    expect(screen.getByText(/Range equity · flop textures/)).toBeInTheDocument();
  });

  it('returns null when manifest is missing', () => {
    const { container } = render(<EquityCardTemplate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders data-card-class="equity" + data-card-id attributes', () => {
    const { container } = render(<EquityCardTemplate manifest={baseManifest} />);
    const article = container.querySelector('article');
    expect(article).toHaveAttribute('data-card-class', 'equity');
    expect(article).toHaveAttribute('data-card-id', 'PRF-EQUITY-RANGE-VS-RANGE-TEXTURES');
  });

  it('renders break-inside: avoid for print fidelity', () => {
    const { container } = render(<EquityCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('article')).toHaveStyle({ breakInside: 'avoid' });
  });
});
