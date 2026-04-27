// @vitest-environment jsdom
/**
 * LineageModal.test.jsx — 7-field lineage rendering + close handling.
 *
 * PRF Phase 5 — Session 19 (PRF-G5-UI).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LineageModal } from '../LineageModal';

const sampleManifest = {
  cardId: 'PRF-MATH-AUTO-PROFIT',
  schemaVersion: 1,
  class: 'math',
  title: 'Auto-profit threshold',
  bodyMarkdown: 'Test body',
  theoryCitation: 'POKER_THEORY.md §3.1',
  assumptions: { stakes: 'rake-agnostic', rake: null, effectiveStack: 100, field: 'all 9-handed' },
  bucketDefinitionsCited: null,
  contentHash: 'sha256:abc',
  lastVersionedAt: '2026-04-25T00:00:00Z',
  sourceUtils: [],
};

describe('LineageModal — render', () => {
  it('renders modal with cardId in title', () => {
    render(<LineageModal manifest={sampleManifest} onClose={vi.fn()} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('PRF-MATH-AUTO-PROFIT');
  });

  it('renders all 7 field labels', () => {
    render(<LineageModal manifest={sampleManifest} onClose={vi.fn()} />);
    expect(screen.getByText(/1\. Card ID/)).toBeInTheDocument();
    expect(screen.getByText(/2\. Generated/)).toBeInTheDocument();
    expect(screen.getByText(/3\. Source util/)).toBeInTheDocument();
    expect(screen.getByText(/4\. Engine \+ app version/)).toBeInTheDocument();
    expect(screen.getByText(/5\. Theory citation/)).toBeInTheDocument();
    expect(screen.getByText(/6\. Assumption bundle/)).toBeInTheDocument();
    expect(screen.getByText(/7\. Bucket definitions/)).toBeInTheDocument();
  });

  it('renders field values from derive7FieldLineage', () => {
    render(<LineageModal manifest={sampleManifest} runtime={{ engineVersion: 'v9', appVersion: 'v8' }} onClose={vi.fn()} />);
    expect(screen.getByText('PRF-MATH-AUTO-PROFIT v1')).toBeInTheDocument();
    expect(screen.getByText('2026-04-25T00:00:00Z')).toBeInTheDocument();
    expect(screen.getByText('engine v9 / app v8')).toBeInTheDocument();
    expect(screen.getByText('POKER_THEORY.md §3.1')).toBeInTheDocument();
  });

  it('renders "(not applicable)" for null bucketDefinitionsCited', () => {
    render(<LineageModal manifest={sampleManifest} onClose={vi.fn()} />);
    // Find the bucketDefinitionsCited <dd> via data-field-key
    const { container } = render(<LineageModal manifest={sampleManifest} onClose={vi.fn()} />);
    const bucketDd = container.querySelector('[data-field-key="bucketDefinitionsCited"]');
    expect(bucketDd).toHaveTextContent('(not applicable)');
  });

  it('returns null when manifest is missing', () => {
    const { container } = render(<LineageModal onClose={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('LineageModal — close handling', () => {
  it('Close button (✕) fires onClose', () => {
    const onClose = vi.fn();
    render(<LineageModal manifest={sampleManifest} onClose={onClose} />);
    fireEvent.click(screen.getByLabelText(/Close lineage modal/i));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Esc keypress fires onClose', () => {
    const onClose = vi.fn();
    render(<LineageModal manifest={sampleManifest} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('backdrop click fires onClose', () => {
    const onClose = vi.fn();
    const { container } = render(<LineageModal manifest={sampleManifest} onClose={onClose} />);
    const backdrop = container.querySelector('.refresher-modal-backdrop');
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('clicking inside dialog does NOT fire onClose', () => {
    const onClose = vi.fn();
    render(<LineageModal manifest={sampleManifest} onClose={onClose} />);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('LineageModal — accessibility', () => {
  it('dialog has aria-modal=true', () => {
    render(<LineageModal manifest={sampleManifest} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
  });

  it('renders red line #12 footer disclaimer', () => {
    render(<LineageModal manifest={sampleManifest} onClose={vi.fn()} />);
    expect(screen.getByText(/Red line #12/i)).toBeInTheDocument();
  });
});
