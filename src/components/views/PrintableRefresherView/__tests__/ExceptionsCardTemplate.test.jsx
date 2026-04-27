// @vitest-environment jsdom
/**
 * ExceptionsCardTemplate.test.jsx — render-time correctness for the exceptions card template.
 *
 * PRF Phase 5 — Session 20 (PRF-G5-UI).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExceptionsCardTemplate } from '../ExceptionsCardTemplate';

const baseManifest = {
  cardId: 'PRF-EXCEPTIONS-BB-LIVE-POOL-FLAT-RANGE',
  schemaVersion: 1,
  class: 'exceptions',
  title: 'BB live-pool flat range vs BTN',
  bodyMarkdown:
    '$1/$3 live · 100bb effective · POKER_THEORY §9.2.\n\nSolver baseline: BB defends ~42% vs BTN open (balanced).\n\nLive-pool divergence: live BB flats wider (48-52%) and 3bets less. Consequence: postflop range cap shifts.\n\nOverride when: observed BB 3bet% > 8% AND stakes ≥ $5/$10 → revert to solver baseline.',
  generatedFields: {},
  theoryCitation: 'POKER_THEORY.md §9.2 BB live-pool flat-range divergence',
  assumptions: {
    stakes: '$1/$3',
    rake: '10% cap $5',
    effectiveStack: 100,
    field: 'live cash',
    divergenceScope: 'live-pool',
  },
  auditId: 'LSW-F2-btn-vs-bb-q72r',
  bucketDefinitionsCited: null,
  contentHash: 'sha256:exceptions',
  lastVersionedAt: '2026-04-27T00:00:00Z',
};

describe('ExceptionsCardTemplate — basic render', () => {
  it('renders the card title', () => {
    render(<ExceptionsCardTemplate manifest={baseManifest} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(/BB live-pool flat range vs BTN/);
  });

  it('uses maroon accent #7f1d1d on the title', () => {
    render(<ExceptionsCardTemplate manifest={baseManifest} />);
    const title = screen.getByRole('heading', { level: 2 });
    expect(title).toHaveStyle({ color: '#7f1d1d' });
  });

  it('renders the subtitle/scenario as the first paragraph', () => {
    render(<ExceptionsCardTemplate manifest={baseManifest} />);
    expect(screen.getByText(/\$1\/\$3 live · 100bb/)).toBeInTheDocument();
  });

  it('classifies "Solver baseline:" prefix as a labeled section', () => {
    const { container } = render(<ExceptionsCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('.refresher-exceptions-section-solver')).not.toBeNull();
    expect(screen.getByText('Solver baseline:')).toBeInTheDocument();
    expect(screen.getByText(/BB defends ~42% vs BTN open/)).toBeInTheDocument();
  });

  it('classifies "Live-pool divergence:" prefix as a labeled section', () => {
    const { container } = render(<ExceptionsCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('.refresher-exceptions-section-divergence')).not.toBeNull();
    expect(screen.getByText('Live-pool divergence:')).toBeInTheDocument();
    expect(screen.getByText(/live BB flats wider/)).toBeInTheDocument();
  });

  it('hoists "Override when:" into Region 3 callout', () => {
    const { container } = render(<ExceptionsCardTemplate manifest={baseManifest} />);
    const region3 = container.querySelector('.refresher-exceptions-override');
    expect(region3).not.toBeNull();
    expect(region3.textContent).toMatch(/Override when:/);
    expect(region3.textContent).toMatch(/observed BB 3bet% > 8%/);
  });

  it('does NOT render the Region 3 override callout when no override paragraph', () => {
    const noOverride = {
      ...baseManifest,
      bodyMarkdown:
        'Live-pool subtitle.\n\nSolver baseline: cite a stat.\n\nLive-pool divergence: cite the deviation.',
    };
    const { container } = render(<ExceptionsCardTemplate manifest={noOverride} />);
    expect(container.querySelector('.refresher-exceptions-override')).toBeNull();
  });

  it('renders the auditId in the lineage footer block', () => {
    render(<ExceptionsCardTemplate manifest={baseManifest} />);
    expect(screen.getByText(/audit id: LSW-F2-btn-vs-bb-q72r/)).toBeInTheDocument();
  });

  it('renders data-audit-id attribute on the article for CI introspection', () => {
    const { container } = render(<ExceptionsCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('article')).toHaveAttribute('data-audit-id', 'LSW-F2-btn-vs-bb-q72r');
  });

  it('omits data-audit-id when auditId is absent', () => {
    const noAudit = { ...baseManifest, auditId: undefined };
    const { container } = render(<ExceptionsCardTemplate manifest={noAudit} />);
    expect(container.querySelector('article')).not.toHaveAttribute('data-audit-id');
  });

  it('falls back to plain prose paragraphs when no recognized prefix', () => {
    const proseOnly = {
      ...baseManifest,
      bodyMarkdown: 'Subtitle here.\n\nThis is just prose without any leading prefix.',
    };
    render(<ExceptionsCardTemplate manifest={proseOnly} />);
    expect(screen.getByText(/This is just prose/)).toBeInTheDocument();
  });

  it('renders the lineage footer with theoryCitation when not compact', () => {
    render(<ExceptionsCardTemplate manifest={baseManifest} runtime={{ engineVersion: 'v9.9', appVersion: 'v8.8' }} />);
    expect(screen.getByText(/PRF-EXCEPTIONS-BB-LIVE-POOL-FLAT-RANGE v1/)).toBeInTheDocument();
    expect(screen.getByText(/POKER_THEORY\.md §9\.2/)).toBeInTheDocument();
  });

  it('omits the lineage footer + audit id when compact=true', () => {
    render(<ExceptionsCardTemplate manifest={baseManifest} compact={true} />);
    expect(screen.queryByText(/audit id:/)).toBeNull();
    expect(screen.getByText(/BB live-pool flat range vs BTN/)).toBeInTheDocument();
  });

  it('returns null when manifest is missing', () => {
    const { container } = render(<ExceptionsCardTemplate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders data-card-class="exceptions" + data-card-id attributes', () => {
    const { container } = render(<ExceptionsCardTemplate manifest={baseManifest} />);
    const article = container.querySelector('article');
    expect(article).toHaveAttribute('data-card-class', 'exceptions');
    expect(article).toHaveAttribute('data-card-id', 'PRF-EXCEPTIONS-BB-LIVE-POOL-FLAT-RANGE');
  });

  it('renders break-inside: avoid for print fidelity', () => {
    const { container } = render(<ExceptionsCardTemplate manifest={baseManifest} />);
    expect(container.querySelector('article')).toHaveStyle({ breakInside: 'avoid' });
  });
});
