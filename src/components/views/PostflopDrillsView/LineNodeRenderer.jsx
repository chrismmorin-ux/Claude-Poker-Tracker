/**
 * LineNodeRenderer — right-pane content for a line node.
 *
 * Dispatches on section kind: prose / formula / example / compute / why /
 * adjust / mismatch. Renders the decision UI below the sections when the
 * node has one, with radio-style branch picks and rationale reveal.
 */

import React, { useState } from 'react';
import { FRAMEWORKS } from '../../../utils/postflopDrillContent/frameworks';
import { archetypeRangeFor, contextLabel } from '../../../utils/postflopDrillContent/archetypeRanges';
import { parseFlopString } from '../../../utils/postflopDrillContent/scenarioLibrary';
import { parseBoard } from '../../../utils/pokerCore/cardParser';
import { resolveBranchCorrect } from '../../../utils/postflopDrillContent/lineSchema';
import { RangeFlopBreakdown } from './RangeFlopBreakdown';
// RT-113 — wire ComputeSection to the shared calculator registry. The import
// crosses drill-view directories (Preflop → Postflop). Acceptable for now;
// proper consolidation into `_shared/drillInternals/` tracked under RT-94.
import { CALCULATORS } from '../PreflopDrillsView/LessonCalculators';
import { BucketEVPanel } from './BucketEVPanel';

export const LineNodeRenderer = ({
  node,
  line,
  archetype,
  revealed,
  selectedBranchIndex,
  onSelectBranch,
  onAdvance,
  canAdvance,
  isTerminal,
}) => {
  const hasBucketCandidates =
    Array.isArray(node?.heroHolding?.bucketCandidates) &&
    node.heroHolding.bucketCandidates.length > 0;
  return (
    <div className="space-y-5">
      {/* Node header */}
      <div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-500 mb-1">
          <span className="font-mono text-amber-300">{node.street}</span>
          {isTerminal && (
            <span className="px-2 py-0.5 rounded-full bg-gray-700 text-gray-300 normal-case text-[10px]">
              Terminal
            </span>
          )}
        </div>
        {(node.frameworks && node.frameworks.length > 0) && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {node.frameworks.map((fwId) => (
              <FrameworkChip key={fwId} fwId={fwId} />
            ))}
          </div>
        )}
      </div>

      {/* Hero holding (RT-106 schema v2 — hand-level teaching anchor) */}
      {node.heroHolding && (
        <HeroHoldingRow heroHolding={node.heroHolding} />
      )}

      {/* Bucket-EV panel — first user-visible payoff of RT-106..118. Mounts
          only when node declares bucketCandidates; reveal-on-click to
          respect the 1600×720 viewport. */}
      {hasBucketCandidates && (
        <BucketEVPanel node={node} line={line} archetype={archetype} />
      )}

      {/* Sections */}
      <div className="space-y-4">
        {node.sections.map((section, i) => (
          <Section key={i} section={section} node={node} />
        ))}
      </div>

      {/* Decision */}
      {node.decision && (
        <DecisionPanel
          decision={node.decision}
          archetype={archetype}
          revealed={revealed}
          selectedBranchIndex={selectedBranchIndex}
          onSelectBranch={onSelectBranch}
          onAdvance={onAdvance}
          canAdvance={canAdvance}
        />
      )}

      {/* Terminal state */}
      {isTerminal && (
        <div className="bg-gray-800/60 border border-gray-700 rounded-lg p-4 text-sm text-gray-300">
          <div className="text-xs uppercase tracking-wide text-gray-500 mb-1">End of line</div>
          Use <strong className="text-gray-100">Restart line</strong> above to replay, or <strong className="text-gray-100">Back to picker</strong> to pick another line.
        </div>
      )}
    </div>
  );
};

// ---------- Hero holding (RT-106) ---------- //

const HeroHoldingRow = ({ heroHolding }) => {
  const { combos, bucketCandidates } = heroHolding || {};
  const hasCombos = Array.isArray(combos) && combos.length > 0;
  const hasBuckets = Array.isArray(bucketCandidates) && bucketCandidates.length > 0;
  if (!hasCombos && !hasBuckets) return null;
  return (
    <div className="rounded-lg border border-amber-800/60 bg-amber-900/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-amber-300/90 mb-1">
        Your hand
      </div>
      {hasCombos && (
        <div className="flex flex-wrap gap-1.5 mb-1.5">
          {combos.map((c) => (
            <span
              key={`combo-${c}`}
              className="px-2 py-0.5 rounded-md bg-amber-950/60 border border-amber-700 text-amber-100 font-mono text-sm"
            >
              {c}
            </span>
          ))}
        </div>
      )}
      {hasBuckets && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-gray-500 self-center">
            or
          </span>
          {bucketCandidates.map((b) => (
            <span
              key={`bucket-${b}`}
              className="px-2 py-0.5 rounded-full bg-gray-900/50 border border-gray-700 text-gray-300 text-[11px]"
            >
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Framework chip ---------- //

const frameworkName = (fwId) => {
  for (const fw of Object.values(FRAMEWORKS)) {
    if (fw.id === fwId) return fw.name;
  }
  return fwId;
};

const FrameworkChip = ({ fwId }) => (
  <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-900/40 border border-teal-800 text-teal-200">
    {frameworkName(fwId)}
  </span>
);

// ---------- Section dispatch ---------- //

const Section = ({ section, node }) => {
  switch (section.kind) {
    case 'prose':    return <ProseSection section={section} />;
    case 'why':      return <AccentSection section={section} label="Why" accent="amber" />;
    case 'adjust':   return <AccentSection section={section} label="Adjust" accent="sky" />;
    case 'mismatch': return <AccentSection section={section} label="Mismatch" accent="rose" />;
    case 'formula':  return <FormulaSection section={section} />;
    case 'example':  return <ExampleSection section={section} />;
    case 'compute':  return <ComputeSection section={section} node={node} />;
    default:         return null;
  }
};

const ProseSection = ({ section }) => (
  <div>
    {section.heading && (
      <h3 className="text-sm font-semibold text-gray-200 mb-1.5">{section.heading}</h3>
    )}
    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{section.body}</p>
  </div>
);

const ACCENT_COLORS = {
  amber: { badge: 'bg-amber-900/40 text-amber-300 border-amber-700', border: 'border-l-amber-600' },
  sky:   { badge: 'bg-sky-900/40 text-sky-300 border-sky-700',       border: 'border-l-sky-600' },
  rose:  { badge: 'bg-rose-900/40 text-rose-300 border-rose-700',    border: 'border-l-rose-600' },
};

const AccentSection = ({ section, label, accent }) => {
  const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.amber;
  return (
    <div className={`pl-3 border-l-2 ${colors.border}`}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border ${colors.badge}`}>
          {label}
        </span>
        {section.heading && (
          <h3 className="text-sm font-semibold text-gray-200">{section.heading}</h3>
        )}
      </div>
      <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">{section.body}</p>
    </div>
  );
};

const FormulaSection = ({ section }) => (
  <div className="bg-gray-900/80 border border-gray-800 rounded-lg px-4 py-3">
    <code className="text-sm text-emerald-300 font-mono">{section.body}</code>
  </div>
);

const ExampleSection = ({ section }) => {
  const [revealed, setRevealed] = useState(false);
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const reveal = () => {
    if (revealed) return;
    setLoading(true);
    setError(null);
    setTimeout(() => {
      try {
        const range = archetypeRangeFor(section.context);
        const opposingRange = section.opposingContext ? archetypeRangeFor(section.opposingContext) : null;
        const board = parseBoard(parseFlopString(section.board));
        setPayload({ range, opposingRange, board });
        setRevealed(true);
      } catch (e) {
        setError(e.message || String(e));
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  const label = contextLabel(section.context)
    + (section.opposingContext ? ` vs ${contextLabel(section.opposingContext)}` : '');

  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-xs uppercase tracking-wide text-gray-500">Worked example</div>
          <div className="text-base font-bold text-white mt-0.5">
            {label} · <span className="font-mono text-teal-300">{section.board}</span>
          </div>
        </div>
        {!revealed && (
          <button
            onClick={reveal}
            disabled={loading}
            className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-600 text-white text-xs font-medium px-3 py-1.5 rounded transition-colors"
          >
            {loading ? 'Computing…' : 'Reveal'}
          </button>
        )}
      </div>
      <p className="text-sm text-gray-300 italic">{section.takeaway}</p>
      {error && (
        <div className="mt-3 bg-red-900/30 border border-red-800 text-red-300 rounded px-3 py-2 text-xs">
          {error}
        </div>
      )}
      {revealed && payload && (
        <div className="mt-3">
          <RangeFlopBreakdown
            range={payload.range}
            opposingRange={payload.opposingRange}
            board={payload.board}
            context={section.context}
            opposingContext={section.opposingContext}
          />
        </div>
      )}
    </div>
  );
};

// RT-113 — real calculator dispatcher. Falls back to a visible error state
// when `section.calculator` is unknown so authoring mistakes surface in dev.
// LSW-H1 (2026-04-22): threads node-context props so calculators open with
// the spot's actual numbers instead of generic defaults. Calculator reads
// `section.seed` when the author pinned explicit numbers; otherwise falls
// back to `node.pot` + implied bet-size from `node.villainAction.size`.
const calculatorPropsForCompute = (section, node) => {
  if (section.calculator !== 'potOdds') return {};
  if (section.seed && typeof section.seed === 'object') {
    return {
      initialPot: Number.isFinite(section.seed.pot) ? section.seed.pot : undefined,
      initialBet: Number.isFinite(section.seed.bet) ? section.seed.bet : undefined,
    };
  }
  if (!node) return {};
  const pot = Number.isFinite(node.pot) ? node.pot : undefined;
  const vSize = node.villainAction && Number.isFinite(node.villainAction.size)
    ? node.villainAction.size
    : 0.5;
  return {
    initialPot: pot,
    initialBet: Number.isFinite(pot) ? Number((pot * vSize).toFixed(2)) : undefined,
  };
};

const ComputeSection = ({ section, node }) => {
  const Calculator = CALCULATORS[section.calculator];
  if (!Calculator) {
    return (
      <div className="bg-rose-900/30 border border-rose-800 text-rose-200 rounded px-3 py-2 text-xs">
        Unknown calculator: {String(section.calculator)}
      </div>
    );
  }
  const calcProps = calculatorPropsForCompute(section, node);
  return (
    <div className="bg-gray-800/70 border border-gray-700 rounded-lg p-4 space-y-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">
        Compute · {section.calculator}
      </div>
      {section.heading && (
        <h3 className="text-sm font-semibold text-gray-200">{section.heading}</h3>
      )}
      {section.intro && (
        <p className="text-sm text-gray-300 leading-relaxed">{section.intro}</p>
      )}
      <Calculator {...calcProps} />
      {section.takeaway && (
        <p className="text-xs text-gray-400 italic leading-relaxed">{section.takeaway}</p>
      )}
    </div>
  );
};

// ---------- Decision ---------- //

const DecisionPanel = ({ decision, archetype, revealed, selectedBranchIndex, onSelectBranch, onAdvance, canAdvance }) => (
  <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
    <div className="text-xs uppercase tracking-wide text-gray-500 mb-2">Decision</div>
    <div className="text-base font-bold text-white mb-3">{decision.prompt}</div>
    <div className="space-y-2">
      {decision.branches.map((branch, i) => (
        <BranchButton
          key={i}
          branch={branch}
          index={i}
          archetype={archetype}
          selected={selectedBranchIndex === i}
          revealed={revealed}
          onSelect={() => onSelectBranch(i)}
        />
      ))}
    </div>
    {revealed && (
      <div className="mt-4 flex justify-end">
        <button
          onClick={onAdvance}
          disabled={!canAdvance}
          className="bg-teal-600 hover:bg-teal-700 disabled:bg-gray-700 disabled:text-gray-500 text-white text-sm font-medium px-4 py-2 rounded transition-colors"
        >
          {canAdvance ? 'Advance →' : 'End of line'}
        </button>
      </div>
    )}
  </div>
);

const BranchButton = ({ branch, index, archetype, selected, revealed, onSelect }) => {
  // Archetype-aware correctness (RT-107). Falls back to flat `correct` when
  // branch lacks correctByArchetype or archetype isn't declared on it.
  const branchCorrect = resolveBranchCorrect(branch, archetype);
  // Indicator that correctness for this branch is archetype-sensitive —
  // used for a subtle "(vs fish)" / "(vs pro)" hint on the badge.
  const hasArchetypeOverride =
    archetype
    && branch.correctByArchetype
    && typeof branch.correctByArchetype[archetype] === 'boolean';

  const base = 'w-full text-left rounded-lg border transition-colors px-3 py-2';
  let colors = 'bg-gray-900/40 border-gray-700 hover:bg-gray-800 hover:border-gray-600';
  if (revealed) {
    if (branchCorrect) {
      colors = 'bg-emerald-900/30 border-emerald-700 text-gray-200';
    } else if (selected) {
      colors = 'bg-rose-900/30 border-rose-700 text-gray-200';
    } else {
      colors = 'bg-gray-900/30 border-gray-800 text-gray-400';
    }
  } else if (selected) {
    colors = 'bg-teal-900/30 border-teal-600 text-gray-100';
  }
  return (
    <button onClick={onSelect} disabled={revealed && !selected} className={`${base} ${colors}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-gray-100">
          <span className="text-gray-500 mr-2">{String.fromCharCode(65 + index)}.</span>
          {branch.label}
        </span>
        {revealed && branchCorrect && (
          <span className="text-[10px] uppercase tracking-wide text-emerald-400 font-semibold">
            correct{hasArchetypeOverride ? ` vs ${archetype}` : ''}
          </span>
        )}
        {revealed && !branchCorrect && selected && (
          <span className="text-[10px] uppercase tracking-wide text-rose-400 font-semibold">your pick</span>
        )}
      </div>
      {revealed && (
        <p className="text-xs text-gray-300 mt-1.5 leading-relaxed">{branch.rationale}</p>
      )}
    </button>
  );
};
