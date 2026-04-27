/**
 * PreflopCardTemplate.jsx — renders a Phase A preflop card.
 *
 * Per `docs/design/surfaces/printable-refresher-card-templates.md` §Template 1
 * (Preflop): Region 1 title + scenario subtitle, Region 2 13×13 hand grid +
 * sizing hint, Region 3 optional exception callout, Region 4-5 lineage footer.
 *
 * Class accent: navy `#1e3a5f` per per-class deuteranopia palette assignment
 * (H-PM02). ≤5% ink coverage per H-PM03.
 *
 * Manifest contract (per surface spec §Template 1 required manifest fields):
 *   - `generatedFields.rangeGrid` — 169-entry array (row-major, A=0, K=1, ... 2=12;
 *     suited upper-right, offsuit lower-left, pairs on diagonal). Each entry is a
 *     boolean (in-range) or 0..1 frequency. Empty / missing → no grid rendered.
 *   - `generatedFields.defaultSizing` — string ("3bb (4bb if 2 limpers)") rendered
 *     under the grid in Region 2.
 *   - `bodyMarkdown` — subtitle / exception prose / corollary. Paragraphs after
 *     the first \n\n become Region 3 exception callout when present.
 *   - `assumptions.position` / `assumptions.action` — surfaced in subtitle if
 *     bodyMarkdown subtitle absent.
 *
 * PRF Phase 5 — Session 20 (PRF-G5-UI).
 */

import React from 'react';
import { derive7FieldLineage, printFooter } from '../../../utils/printableRefresher/lineage';

const ACCENT_HEX = '#1e3a5f'; // navy — preflop class accent

const RANK_ORDER = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

/**
 * Render the 13×13 hand grid from a 169-entry generatedFields.rangeGrid array.
 *
 * Cell shading conventions:
 *   - frequency 1 (or boolean true) → solid accent fill
 *   - frequency 0 (or boolean false / undefined) → outline only
 *   - frequency in (0, 1) → mixed-strategy half-fill (split background)
 *
 * The diagonal (i === j) is pairs (AA, KK, ...). Above-diagonal is suited.
 * Below-diagonal is offsuit.
 */
function renderHandGrid(rangeGrid) {
  if (!Array.isArray(rangeGrid) || rangeGrid.length !== 169) return null;
  const cells = [];
  for (let i = 0; i < 13; i += 1) {
    for (let j = 0; j < 13; j += 1) {
      const idx = i * 13 + j;
      const value = rangeGrid[idx];
      const frequency = typeof value === 'number' ? value : value === true ? 1 : 0;
      const r1 = RANK_ORDER[i];
      const r2 = RANK_ORDER[j];
      let label;
      if (i === j) {
        label = `${r1}${r2}`;
      } else if (i < j) {
        label = `${r1}${r2}s`;
      } else {
        label = `${r2}${r1}o`;
      }
      const isFull = frequency >= 0.999;
      const isMixed = frequency > 0 && frequency < 0.999;
      const fill = isFull ? ACCENT_HEX : 'transparent';
      const mixedBg = isMixed
        ? `linear-gradient(to top, ${ACCENT_HEX} ${Math.round(frequency * 100)}%, transparent ${Math.round(frequency * 100)}%)`
        : undefined;
      const color = isFull ? '#fff' : '#000';
      cells.push(
        <div
          key={`${i}-${j}`}
          className="refresher-preflop-grid-cell"
          data-cell={label}
          data-frequency={frequency}
          style={{
            border: `0.5pt solid ${i === j ? ACCENT_HEX : '#888'}`,
            background: mixedBg || fill,
            color,
            fontSize: '5.5pt',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: 'Menlo, Consolas, monospace',
            fontWeight: i === j ? 600 : 400,
            aspectRatio: '1 / 1',
          }}
        >
          {label}
        </div>
      );
    }
  }
  return (
    <div
      className="refresher-preflop-grid"
      role="img"
      aria-label="13 by 13 preflop hand grid"
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(13, 1fr)',
        gap: 0,
        border: `0.5pt solid ${ACCENT_HEX}`,
        margin: '0.2em 0',
      }}
    >
      {cells}
    </div>
  );
}

/**
 * Render bodyMarkdown — first paragraph is subtitle/scenario, second+ paragraphs
 * are derivation/exception callouts. (Mirrors the Math template's split-on-\n\n
 * convention.)
 */
function renderBody(bodyMarkdown) {
  if (typeof bodyMarkdown !== 'string') return { primary: null, derivation: null };
  const paragraphs = bodyMarkdown.split(/\n\n+/).filter(Boolean);
  const [primary, ...rest] = paragraphs;
  const renderParagraph = (text, key) => (
    <p
      key={key}
      className="refresher-card-body-paragraph"
      style={{ fontSize: '10pt', lineHeight: '1.4', margin: '0 0 0.4em 0' }}
    >
      {text.split(/\n/).map((line, lineIdx, arr) => (
        <React.Fragment key={lineIdx}>
          {line}
          {lineIdx < arr.length - 1 && <br />}
        </React.Fragment>
      ))}
    </p>
  );
  return {
    primary: primary ? renderParagraph(primary, 'primary') : null,
    derivation: rest.length > 0 ? rest.map((p, idx) => renderParagraph(p, `d-${idx}`)) : null,
  };
}

/**
 * PreflopCardTemplate — single-card render component for class === 'preflop'.
 *
 * @param {object} props
 * @param {object} props.manifest - Card manifest from cardRegistry.
 * @param {object} [props.runtime] - { engineVersion, appVersion } for lineage.
 * @param {boolean} [props.compact=false] - True for catalog-row preview.
 */
export const PreflopCardTemplate = ({ manifest, runtime, compact = false }) => {
  if (!manifest) return null;
  const lineage = derive7FieldLineage(manifest, runtime || {});
  const footerText = printFooter(lineage);
  const { primary, derivation } = renderBody(manifest.bodyMarkdown);
  const generated = manifest.generatedFields || {};
  const rangeGrid = generated.rangeGrid;
  const sizing = generated.defaultSizing;

  return (
    <article
      className="refresher-card refresher-card-preflop"
      data-card-id={manifest.cardId}
      data-card-class="preflop"
      style={{
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

      {/* Region 2 — primary content (subtitle + 13×13 grid + sizing hint) */}
      <section
        className="refresher-card-region-2"
        style={{
          marginBottom: '0.3em',
          maskImage: compact
            ? 'linear-gradient(to bottom, black 70%, transparent 100%)'
            : undefined,
          WebkitMaskImage: compact
            ? 'linear-gradient(to bottom, black 70%, transparent 100%)'
            : undefined,
        }}
      >
        {primary}
        {renderHandGrid(rangeGrid)}
        {sizing && (
          <p
            className="refresher-preflop-sizing"
            style={{
              fontSize: '10pt',
              fontWeight: 600,
              margin: '0.3em 0 0 0',
              color: ACCENT_HEX,
            }}
          >
            Sizing: {sizing}
          </p>
        )}
      </section>

      {/* Region 3 — derivation / exception callout (optional) */}
      {!compact && derivation && (
        <section
          className="refresher-card-region-3"
          style={{
            fontSize: '9pt',
            fontStyle: 'italic',
            color: '#333',
            borderTop: '0.5pt dashed #aaa',
            paddingTop: '0.2em',
            marginBottom: '0.3em',
          }}
        >
          {derivation}
        </section>
      )}

      {/* Region 4-5 — lineage footer */}
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

export default PreflopCardTemplate;
