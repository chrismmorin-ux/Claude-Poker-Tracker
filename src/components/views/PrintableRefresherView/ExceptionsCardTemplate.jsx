/**
 * ExceptionsCardTemplate.jsx — renders a Phase C exceptions card.
 *
 * Per `docs/design/surfaces/printable-refresher-card-templates.md` §Template 4
 * (Exceptions): Region 1 title + theory-§ subtitle, Region 2 solver-baseline +
 * live-pool divergence prose, Region 3 override trigger, Region 4-5 lineage
 * footer (carries the audit id citation per F4 + F5).
 *
 * Class accent: maroon `#7f1d1d` per per-class deuteranopia palette assignment
 * (H-PM02). ≤5% ink coverage per H-PM03.
 *
 * Manifest contract (per surface spec §Template 4 required manifest fields):
 *   - `bodyMarkdown` — solver-baseline / divergence / override paragraphs.
 *     Convention: paragraphs split by \n\n; first is subtitle/scenario, second
 *     is solver-baseline, third is live-pool divergence + consequence, fourth
 *     is override-trigger. Templates render the first paragraph as primary
 *     subtitle; solver/divergence/override blocks emerge from sections marked
 *     by leading "Solver baseline:" / "Live-pool divergence:" / "Override when:"
 *     prefixes (CD-discipline § "Exceptions cards"). Unprefixed paragraphs fall
 *     back to plain prose.
 *   - `auditId` — required, visible in Region 4-5 lineage footer + as a
 *     `data-audit-id` attribute on the article for CI introspection.
 *   - `theoryCitation` — must cite POKER_THEORY.md §9.X (CI enforced).
 *
 * PRF Phase 5 — Session 20 (PRF-G5-UI).
 */

import React from 'react';
import { derive7FieldLineage, printFooter } from '../../../utils/printableRefresher/lineage';

const ACCENT_HEX = '#7f1d1d'; // maroon — exceptions class accent

const SECTION_PREFIXES = [
  { key: 'solver', label: 'Solver baseline', prefix: /^solver baseline\s*:/i },
  { key: 'divergence', label: 'Live-pool divergence', prefix: /^live[-\s]?pool divergence\s*:/i },
  { key: 'override', label: 'Override when', prefix: /^override when\s*:/i },
];

/**
 * Classify each paragraph by its leading prefix; unmatched paragraphs are
 * carried forward as plain prose under whichever section last claimed them
 * (default: "primary"). Returns an object with one node per known section
 * plus `primary` for the subtitle/intro.
 */
function classifyBody(bodyMarkdown) {
  if (typeof bodyMarkdown !== 'string') return { primary: null, sections: [] };
  const paragraphs = bodyMarkdown.split(/\n\n+/).filter(Boolean);
  if (paragraphs.length === 0) return { primary: null, sections: [] };
  const [primary, ...rest] = paragraphs;
  const sections = [];
  rest.forEach((p) => {
    const match = SECTION_PREFIXES.find((s) => s.prefix.test(p.trim()));
    if (match) {
      const stripped = p.replace(match.prefix, '').trim();
      sections.push({ key: match.key, label: match.label, body: stripped });
    } else {
      sections.push({ key: 'prose', label: null, body: p.trim() });
    }
  });
  return { primary, sections };
}

function renderInlineParagraph(text, key, opts = {}) {
  const { italic = false, color = '#000', size = '10pt' } = opts;
  return (
    <p
      key={key}
      className="refresher-card-body-paragraph"
      style={{
        fontSize: size,
        lineHeight: '1.4',
        margin: '0 0 0.4em 0',
        color,
        fontStyle: italic ? 'italic' : 'normal',
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
}

/**
 * ExceptionsCardTemplate — single-card render component for class === 'exceptions'.
 *
 * @param {object} props
 * @param {object} props.manifest - Card manifest from cardRegistry.
 * @param {object} [props.runtime] - { engineVersion, appVersion } for lineage.
 * @param {boolean} [props.compact=false] - True for catalog-row preview.
 */
export const ExceptionsCardTemplate = ({ manifest, runtime, compact = false }) => {
  if (!manifest) return null;
  const lineage = derive7FieldLineage(manifest, runtime || {});
  const footerText = printFooter(lineage);
  const { primary, sections } = classifyBody(manifest.bodyMarkdown);
  const overrideSection = sections.find((s) => s.key === 'override');
  const nonOverrideSections = sections.filter((s) => s.key !== 'override');
  const auditId = manifest.auditId;

  return (
    <article
      className="refresher-card refresher-card-exceptions"
      data-card-id={manifest.cardId}
      data-card-class="exceptions"
      data-audit-id={auditId || undefined}
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

      {/* Region 2 — primary content (subtitle + solver/divergence/prose blocks) */}
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
        {primary && renderInlineParagraph(primary, 'primary')}
        {nonOverrideSections.map((section, idx) => (
          <div
            key={`s-${idx}`}
            className={`refresher-exceptions-section refresher-exceptions-section-${section.key}`}
            style={{ marginBottom: '0.3em' }}
          >
            {section.label && (
              <p
                style={{
                  fontSize: '9.5pt',
                  fontWeight: 600,
                  color: ACCENT_HEX,
                  margin: '0 0 0.15em 0',
                }}
              >
                {section.label}:
              </p>
            )}
            {renderInlineParagraph(section.body, `body-${idx}`, { size: '9.5pt' })}
          </div>
        ))}
      </section>

      {/* Region 3 — override trigger callout (if present) */}
      {!compact && overrideSection && (
        <section
          className="refresher-card-region-3 refresher-exceptions-override"
          style={{
            borderTop: '0.5pt dashed #aaa',
            paddingTop: '0.2em',
            marginBottom: '0.3em',
            background: '#fef2f2',
            padding: '0.3em',
            borderRadius: '0.1em',
          }}
        >
          <p
            style={{
              fontSize: '9.5pt',
              fontWeight: 600,
              color: ACCENT_HEX,
              margin: '0 0 0.15em 0',
            }}
          >
            Override when:
          </p>
          {renderInlineParagraph(overrideSection.body, 'override', { size: '9.5pt' })}
        </section>
      )}

      {/* Region 4-5 — lineage footer + audit id strip */}
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
          {auditId && (
            <div
              className="refresher-exceptions-audit-id"
              style={{ marginTop: '0.15em', color: ACCENT_HEX, fontWeight: 500 }}
            >
              audit id: {auditId}
            </div>
          )}
        </footer>
      )}
    </article>
  );
};

export default ExceptionsCardTemplate;
