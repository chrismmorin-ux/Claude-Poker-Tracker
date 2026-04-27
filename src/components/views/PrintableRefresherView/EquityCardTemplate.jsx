/**
 * EquityCardTemplate.jsx — renders a Phase C equity card.
 *
 * Per `docs/design/surfaces/printable-refresher-card-templates.md` §Template 3
 * (Equity): Region 1 title + opponent-range subtitle, Region 2 range×texture
 * matrix table, Region 3 bucket-definition citation, Region 4-5 lineage footer.
 *
 * Class accent: teal `#0f766e` per per-class deuteranopia palette assignment
 * (H-PM02). ≤5% ink coverage per H-PM03.
 *
 * Manifest contract (per surface spec §Template 3 required manifest fields):
 *   - `generatedFields.equityMatrix` — { headers: string[], rows: { texture, cells:
 *     number[] }[] }. Headers are bucket names ("Nut", "Strong", "Marginal",
 *     "Draw"). Cells are bucket percentages (0..100). Atomicity-enforced:
 *     row count ≤ 8 per surface spec H-PM05.
 *   - `generatedFields.rangeId` — opponent range identifier surfaced in subtitle.
 *   - `bodyMarkdown` — title context / caption / bucket-definition citation.
 *   - `bucketDefinitionsCited` — required path to bucket glossary; not null.
 *
 * PRF Phase 5 — Session 20 (PRF-G5-UI).
 */

import React from 'react';
import { derive7FieldLineage, printFooter } from '../../../utils/printableRefresher/lineage';

const ACCENT_HEX = '#0f766e'; // teal — equity class accent
const MAX_ROWS = 8; // H-PM05 atomicity cap from surface spec

/**
 * Render the equity matrix as a table. Headers are bucket names, rows are
 * (texture × bucket-percentages). Greyscale-safe shading via cell intensity
 * proportional to percentage (deuteranopia friendly per H-PM02).
 */
function renderEquityMatrix(matrix) {
  if (!matrix || !Array.isArray(matrix.rows) || !Array.isArray(matrix.headers)) return null;
  const rows = matrix.rows.slice(0, MAX_ROWS);
  return (
    <table
      className="refresher-equity-matrix"
      role="table"
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '8.5pt',
        fontFamily: 'Menlo, Consolas, monospace',
        margin: '0.2em 0',
        tableLayout: 'fixed',
      }}
    >
      <thead>
        <tr>
          <th
            scope="col"
            style={{
              textAlign: 'left',
              borderBottom: `0.75pt solid ${ACCENT_HEX}`,
              padding: '0.1em 0.25em',
              fontWeight: 600,
              color: ACCENT_HEX,
            }}
          >
            Texture
          </th>
          {matrix.headers.map((h) => (
            <th
              key={h}
              scope="col"
              style={{
                textAlign: 'right',
                borderBottom: `0.75pt solid ${ACCENT_HEX}`,
                padding: '0.1em 0.25em',
                fontWeight: 600,
                color: ACCENT_HEX,
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, idx) => (
          <tr key={row.texture || idx}>
            <th
              scope="row"
              style={{
                textAlign: 'left',
                fontWeight: 400,
                padding: '0.1em 0.25em',
                borderBottom: '0.25pt solid #ddd',
              }}
            >
              {row.texture}
            </th>
            {(row.cells || []).map((value, cellIdx) => {
              const pct = typeof value === 'number' ? value : Number(value) || 0;
              return (
                <td
                  key={cellIdx}
                  style={{
                    textAlign: 'right',
                    padding: '0.1em 0.25em',
                    borderBottom: '0.25pt solid #ddd',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {pct}%
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Render bodyMarkdown — first paragraph is subtitle/scenario, second+ are
 * caption / bucket-definition citation prose. Same split-on-\n\n convention
 * as Math + Preflop templates.
 */
function renderBody(bodyMarkdown) {
  if (typeof bodyMarkdown !== 'string') return { primary: null, footer: null };
  const paragraphs = bodyMarkdown.split(/\n\n+/).filter(Boolean);
  const [primary, ...rest] = paragraphs;
  const renderParagraph = (text, key, italic) => (
    <p
      key={key}
      className="refresher-card-body-paragraph"
      style={{
        fontSize: '10pt',
        lineHeight: '1.4',
        margin: '0 0 0.4em 0',
        fontStyle: italic ? 'italic' : 'normal',
        color: italic ? '#333' : '#000',
      }}
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
    primary: primary ? renderParagraph(primary, 'primary', false) : null,
    footer: rest.length > 0 ? rest.map((p, idx) => renderParagraph(p, `f-${idx}`, true)) : null,
  };
}

/**
 * EquityCardTemplate — single-card render component for class === 'equity'.
 *
 * @param {object} props
 * @param {object} props.manifest - Card manifest from cardRegistry.
 * @param {object} [props.runtime] - { engineVersion, appVersion } for lineage.
 * @param {boolean} [props.compact=false] - True for catalog-row preview.
 */
export const EquityCardTemplate = ({ manifest, runtime, compact = false }) => {
  if (!manifest) return null;
  const lineage = derive7FieldLineage(manifest, runtime || {});
  const footerText = printFooter(lineage);
  const { primary, footer: bucketCitation } = renderBody(manifest.bodyMarkdown);
  const matrix = manifest.generatedFields?.equityMatrix;

  return (
    <article
      className="refresher-card refresher-card-equity"
      data-card-id={manifest.cardId}
      data-card-class="equity"
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
      {/* Region 1 — title */}
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

      {/* Region 2 — primary content (subtitle + matrix) */}
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
        {renderEquityMatrix(matrix)}
      </section>

      {/* Region 3 — bucket-definition citation (italicized prose from bodyMarkdown tail) */}
      {!compact && bucketCitation && (
        <section
          className="refresher-card-region-3"
          style={{
            borderTop: '0.5pt dashed #aaa',
            paddingTop: '0.2em',
            marginBottom: '0.3em',
            fontSize: '9pt',
          }}
        >
          {bucketCitation}
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

export default EquityCardTemplate;
