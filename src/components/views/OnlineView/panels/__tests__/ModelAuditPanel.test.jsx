/**
 * ModelAuditPanel.test.jsx — WS-307
 *
 * The panel reports which source produced the fold estimate. WS-307 introduced a new
 * one, `composition`: computed from the exact per-combo makeup of the range in front of
 * hero, with no population average blended in.
 *
 * Why this is worth a test rather than an eyeball: the panel previously rendered
 * `source: population` next to an EV the engine had computed from a DIFFERENT number
 * (the flat 0.55 prior), so the audit row explained a quantity the recommendation never
 * used. The whole point of the row is that it is trustworthy.
 */

import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ModelAuditPanel } from '../ModelAuditPanel';

const treeMetadata = { depth: 2, depthReached: 2 };

describe('ModelAuditPanel — fold estimate source', () => {
  test('renders the composition source introduced by WS-307', () => {
    render(
      <ModelAuditPanel
        treeMetadata={treeMetadata}
        foldMeta={{ bet: { source: 'composition', observedN: 0 } }}
      />
    );
    expect(screen.getByText('composition')).toBeInTheDocument();
  });

  test('still renders the pre-existing sources', () => {
    for (const source of ['population', 'model', 'observed', 'model+observed']) {
      const { unmount } = render(
        <ModelAuditPanel treeMetadata={treeMetadata} foldMeta={{ bet: { source } }} />
      );
      expect(screen.getByText(source)).toBeInTheDocument();
      unmount();
    }
  });

  test('an unknown source degrades to a rendered string, never a crash', () => {
    render(
      <ModelAuditPanel treeMetadata={treeMetadata} foldMeta={{ bet: { source: 'future-source' } }} />
    );
    expect(screen.getByText('future-source')).toBeInTheDocument();
  });

  test('renders nothing without tree metadata', () => {
    const { container } = render(<ModelAuditPanel treeMetadata={null} foldMeta={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
