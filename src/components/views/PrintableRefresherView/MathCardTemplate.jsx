/**
 * MathCardTemplate.jsx — renders a Phase B math card.
 *
 * Per `docs/design/surfaces/printable-refresher-card-templates.md` §Math
 * Template: prominent formula + bodyMarkdown body + 7-field lineage footer.
 * Color accent: burnt-orange (#c05621) per print-css-doctrine.md per-class
 * assignment for math.
 *
 * Used by:
 *   - CardDetail sub-view (preview rendering at 2x2.25" scale per surface spec).
 *   - PrintPreview sub-view (full-page rendering with @media print CSS applied).
 *   - In-app catalog row preview (compact mode).
 *
 * Layout regions (Region 1-6 per print-css-doctrine.md):
 *   Region 1: title (14pt bold serif accent)
 *   Region 2: primary body (10pt body)
 *   Region 3: derivation (9pt serif; rendered inline in body for math cards)
 *   Region 4-5: lineage footer (9pt greyscale mono+serif)
 *   Region 6: card-corner stamp (handled by CardCornerStamp; not in this template)
 *
 * PRF Phase 5 — Session 18 (PRF-G5-UI).
 */

import React from 'react';
import { derive7FieldLineage, printFooter } from '../../../utils/printableRefresher/lineage';

const ACCENT_HEX = '#c05621'; // burnt-orange — math class accent

/**
 * Render bodyMarkdown as paragraph blocks. The Phase 1 manifests use plain text
 * with `\n\n` paragraph breaks; rich Markdown (bold, lists, etc.) is deferred
 * to Phase 2+ so that print-CSS layout stays predictable.
 */
function renderBody(bodyMarkdown) {
  if (typeof bodyMarkdown !== 'string') return null;
  const paragraphs = bodyMarkdown.split(/\n\n+/).filter(Boolean);
  return paragraphs.map((p, idx) => (
    <p
      key={idx}
      className="refresher-card-body-paragraph"
      style={{ fontSize: '10pt', lineHeight: '1.4', margin: '0 0 0.5em 0' }}
    >
      {p.split(/\n/).map((line, lineIdx, arr) => (
        <React.Fragment key={lineIdx}>
          {line}
          {lineIdx < arr.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  ));
}

/**
 * MathCardTemplate — single-card render component for class === 'math'.
 *
 * @param {object} props
 * @param {object} props.manifest - Card manifest from cardRegistry.
 * @param {object} [props.runtime] - { engineVersion, appVersion } for lineage. Defaults to placeholders.
 * @param {boolean} [props.compact=false] - True for catalog-row preview; false for print/preview.
 */
export const MathCardTemplate = ({ manifest, runtime, compact = false }) => {
  if (!manifest) return null;
  const lineage = derive7FieldLineage(manifest, runtime || {});
  const footerText = printFooter(lineage);

  return (
    <article
      className="refresher-card refresher-card-math"
      data-card-id={manifest.cardId}
      data-card-class="math"
      style={{
        // Index-card scale (12-up Letter default per Q4 + print-css-doctrine.md)
        fontFamily: 'Georgia, "Times New Roman", serif',
        color: '#000',
        background: '#fff',
        border: '1pt solid #888',
        padding: '0.20in',
        boxSizing: 'border-box',
        breakInside: 'avoid',
        pageBreakInside: 'avoid',
        overflow: 'hidden',
        position: 'relative',
        // Compact mode shrinks for catalog preview; print mode uses full
        // index-card dimensions controlled by parent grid CSS.
        width: compact ? '100%' : undefined,
        maxHeight: compact ? '12em' : undefined,
      }}
    >
      {/* Region 1 — title (14pt bold serif accent) */}
      <header className="refresher-card-region-1" style={{ marginBottom: '0.3em' }}>
        <h2
          style={{
            fontSize: '14pt',
            fontWeight: 'bold',
            color: ACCENT_HEX,
            margin: 0,
            lineHeight: '1.2',
          }}
        >
          {manifest.title}
        </h2>
      </header>

      {/* Region 2 — primary body (10pt body; renders paragraphs from bodyMarkdown) */}
      <section
        className="refresher-card-region-2"
        style={{
          marginBottom: '0.3em',
          // In compact preview mode, fade-mask the bottom for overflow indication.
          maskImage: compact
            ? 'linear-gradient(to bottom, black 70%, transparent 100%)'
            : undefined,
          WebkitMaskImage: compact
            ? 'linear-gradient(to bottom, black 70%, transparent 100%)'
            : undefined,
        }}
      >
        {renderBody(manifest.bodyMarkdown)}
      </section>

      {/* Region 4-5 — lineage footer (9pt greyscale mono+serif). Hidden in compact mode. */}
      {!compact && (
        <footer
          className="refresher-card-region-4-5"
          style={{
            borderTop: '0.5pt solid #888',
            marginTop: '0.3em',
            paddingTop: '0.2em',
            fontSize: '9pt',
            color: '#555',
            fontFamily: 'Menlo, Consolas, monospace',
            whiteSpace: 'pre-wrap',
          }}
        >
          {footerText}
        </footer>
      )}
    </article>
  );
};

export default MathCardTemplate;
