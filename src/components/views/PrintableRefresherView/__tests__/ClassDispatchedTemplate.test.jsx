// @vitest-environment jsdom
/**
 * ClassDispatchedTemplate.test.jsx — direct tests for the lifted shared dispatcher.
 *
 * The dispatcher is also exercised indirectly by CardDetail.test.jsx (catalog → detail
 * route) and PrintPreview.test.jsx (grid render). These tests target the dispatcher
 * itself so future class additions are guarded at the unit level.
 *
 * PRF Phase 5 — Session 21 (PRF-G5-UI).
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClassDispatchedTemplate } from '../ClassDispatchedTemplate';

const baseManifest = {
  cardId: 'PRF-DISPATCH-FIXTURE',
  schemaVersion: 1,
  title: 'Dispatch fixture title',
  bodyMarkdown: 'Body for dispatch fixture.',
  theoryCitation: 'POKER_THEORY.md §0',
  assumptions: { stakes: 'rake-agnostic', rake: null, effectiveStack: 100, field: 'fixture' },
  bucketDefinitionsCited: null,
  contentHash: 'sha256:dispatch',
  lastVersionedAt: '2026-04-27T00:00:00Z',
};

describe('ClassDispatchedTemplate', () => {
  it('routes class=math to MathCardTemplate (article.refresher-card-math)', () => {
    const { container } = render(
      <ClassDispatchedTemplate manifest={{ ...baseManifest, class: 'math' }} />
    );
    expect(container.querySelector('article.refresher-card-math')).not.toBeNull();
  });

  it('routes class=preflop to PreflopCardTemplate', () => {
    const { container } = render(
      <ClassDispatchedTemplate manifest={{ ...baseManifest, class: 'preflop' }} />
    );
    expect(container.querySelector('article.refresher-card-preflop')).not.toBeNull();
  });

  it('routes class=equity to EquityCardTemplate', () => {
    const { container } = render(
      <ClassDispatchedTemplate manifest={{ ...baseManifest, class: 'equity' }} />
    );
    expect(container.querySelector('article.refresher-card-equity')).not.toBeNull();
  });

  it('routes class=exceptions to ExceptionsCardTemplate', () => {
    const { container } = render(
      <ClassDispatchedTemplate manifest={{ ...baseManifest, class: 'exceptions' }} />
    );
    expect(container.querySelector('article.refresher-card-exceptions')).not.toBeNull();
  });

  it('renders the role=status placeholder for unknown class (defensive default)', () => {
    render(<ClassDispatchedTemplate manifest={{ ...baseManifest, class: 'mysterious-future-class' }} />);
    const placeholder = screen.getByRole('status');
    expect(placeholder).toHaveTextContent(/template for class.*mysterious-future-class/);
  });

  it('returns null when manifest is missing', () => {
    const { container } = render(<ClassDispatchedTemplate />);
    expect(container).toBeEmptyDOMElement();
  });

  it('passes runtime + compact props through to the dispatched template', () => {
    const { container } = render(
      <ClassDispatchedTemplate
        manifest={{ ...baseManifest, class: 'math' }}
        runtime={{ engineVersion: 'v1.2.3', appVersion: 'v9.9.9' }}
        compact={true}
      />
    );
    // compact=true hides the lineage footer in MathCardTemplate.
    expect(container.querySelector('.refresher-card-math')).not.toBeNull();
    expect(container.textContent || '').not.toMatch(/POKER_THEORY/);
  });
});
