/**
 * HandPlanSection — Hand Plan Layer rendering surface (Stream P P5).
 *
 * Composes two plan sources per the `hand-plan-layer` spec I-HP-1/2/3:
 *   1. Authored plan (when `node.comboPlans[activeBucket]` exists, post-P3
 *      authoring) — bucket-keyed plan text + clickable rule chips that open
 *      the shared <RuleChipModal>.
 *   2. Engine-derived plan (when `computeEnginePlan` returns non-null) —
 *      per-action EV table from `computeBucketEVsV2`, with isBest-highlighted.
 *
 * Default-visibility rule (Q2=C, conditional default):
 *   - Authored present → engine-derived hidden by default
 *   - Authored absent  → engine-derived shown by default
 *   - Toggle "Show solver plan" persists via sessionStorage so advanced
 *     students see both at every node after one click.
 *
 * v1 ship has zero authored plans (P3 deferred to LSW-v2). Every node where
 * computeBucketEVsV2 succeeds renders engine-derived plan content.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { computeDepth2Plan } from '../../../../utils/postflopDrillContent/computeDepth2Plan';
import { getOrCompute } from '../../../../utils/postflopDrillContent/engineCache';
import { villainRangeFor } from '../../../../utils/postflopDrillContent/villainRanges';
import { isKnownArchetype } from '../../../../utils/postflopDrillContent/archetypeRangeBuilder';
import { parseBoard } from '../../../../utils/pokerCore/cardParser';
import { isKnownRuleChip } from '../../../../utils/postflopDrillContent/planRules';
import { RuleChipModal } from './RuleChipModal';

const TOGGLE_KEY = 'handPlanShowSolver';

/**
 * Pick the active bucket for plan lookup. v1 ship: heroView.kind is always
 * 'single-combo' (combo-set + range-level error out of computeBucketEVsV2),
 * so the active bucket is the first entry of bucketCandidates.
 */
const pickActiveBucket = (heroView) => {
  if (!heroView) return null;
  const bc = heroView.bucketCandidates;
  return Array.isArray(bc) && bc.length > 0 ? bc[0] : null;
};

/**
 * Read the persisted "Show solver plan" toggle from sessionStorage. Returns
 * boolean. Defaults to false when key absent or sessionStorage unavailable.
 */
const readToggle = () => {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(TOGGLE_KEY) === '1';
  } catch {
    return false;
  }
};

const writeToggle = (next) => {
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(TOGGLE_KEY, next ? '1' : '0');
    }
  } catch {
    // sessionStorage may be unavailable (private browsing, SSR); fall through.
  }
};

/**
 * Decide which sources render given the current state. Returns:
 *   'authored-only' | 'engine-only' | 'both' | 'none'
 *
 * Pure function — exported for tests.
 */
export const selectActivePlanSource = ({ hasAuthored, hasEngine, toggleOn }) => {
  if (hasAuthored && toggleOn && hasEngine) return 'both';
  if (hasAuthored) return 'authored-only';
  if (hasEngine) return 'engine-only';
  return 'none';
};

// ---------- Rule chip pill ---------- //

const RuleChip = ({ chipId, onTap }) => {
  // Unknown chip ID still renders (so authoring errors are visible); modal
  // surfaces the "unknown rule chip" banner on tap.
  const known = isKnownRuleChip(chipId);
  const tone = known
    ? 'bg-amber-900/30 border-amber-700/70 text-amber-200 hover:bg-amber-800/40'
    : 'bg-rose-900/30 border-rose-700 text-rose-200 hover:bg-rose-800/40';
  return (
    <button
      onClick={() => onTap(chipId)}
      className={`text-[11px] font-medium border rounded-full px-2.5 py-1 transition-colors ${tone}`}
      style={{ minHeight: 32, minWidth: 32 }}
      aria-label={`Rule: ${chipId}`}
    >
      {chipId.replace(/-/g, ' ')}
    </button>
  );
};

// ---------- Authored block ---------- //

const AuthoredPlanBlock = ({ entry, onChipTap }) => (
  <div className="rounded-lg border border-amber-800/60 bg-amber-950/20 p-4 space-y-3">
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wide text-amber-400/80 font-semibold">Your plan</span>
      <span className="text-[10px] uppercase tracking-wide text-gray-500">authored</span>
    </div>
    <p className="text-sm text-gray-100 leading-relaxed">{entry.planText}</p>
    {Array.isArray(entry.ruleChips) && entry.ruleChips.length > 0 && (
      <div className="flex flex-wrap gap-1.5">
        {entry.ruleChips.map((id) => (
          <RuleChip key={id} chipId={id} onTap={onChipTap} />
        ))}
      </div>
    )}
  </div>
);

// ---------- Next-street plan (LSW-D1 depth-2 forward-look) ---------- //

const NextStreetPlan = ({ plan }) => {
  // The engine's `handPlan` carries up to 5 branches: ifCall / ifRaise /
  // ifVillainBets / ifVillainChecks / nextStreet. Each non-null branch has
  // a human-readable `note` and an action `plan` label. Render as a list.
  const branches = [
    { key: 'ifCall',          label: 'If villain calls' },
    { key: 'ifRaise',         label: 'If villain raises' },
    { key: 'ifVillainBets',   label: 'If villain bets' },
    { key: 'ifVillainChecks', label: 'If villain checks' },
    { key: 'nextStreet',      label: 'Next street plan' },
  ];
  const visible = branches.filter((b) => plan[b.key]);
  if (visible.length === 0) {
    return (
      <p className="text-[11px] italic text-gray-500 leading-relaxed">
        Forward-look unavailable on this node.
      </p>
    );
  }
  return (
    <div className="rounded border border-gray-800 bg-gray-900/60 p-3 space-y-1.5">
      <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold mb-1">
        Forward look
      </div>
      <ul className="space-y-1.5">
        {visible.map((b) => {
          const branch = plan[b.key];
          return (
            <li key={b.key} className="text-xs text-gray-200 leading-relaxed flex gap-2">
              <span className="text-gray-400 min-w-[120px] shrink-0">{b.label}:</span>
              <span className="text-gray-100">
                {branch.note || branch.plan || '—'}
                {branch.scaryCardRanks && branch.scaryCardRanks.length > 0 && (
                  <span className="text-amber-300 ml-1">
                    (scary: {branch.scaryCardRanks.join(', ')})
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

// ---------- Engine-derived block ---------- //

const formatEV = (ev) => {
  if (!Number.isFinite(ev)) return '--';
  const sign = ev >= 0 ? '+' : '';
  return `${sign}${ev.toFixed(2)}bb`;
};

const EnginePlanBlock = ({ plan }) => {
  if (plan.errorState) {
    const recovery = plan.errorState.recovery;
    return (
      <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4 space-y-2">
        <div className="text-[10px] uppercase tracking-wide text-gray-400 font-semibold">Solver plan unavailable</div>
        <div className="text-sm text-gray-300 leading-relaxed">{plan.errorState.userMessage}</div>
        {recovery && (
          <div className="text-xs italic text-gray-400">{recovery}</div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-teal-800/60 bg-teal-950/20 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-wide text-teal-300/80 font-semibold">Solver plan</span>
        <span className="text-[10px] uppercase tracking-wide text-gray-500">engine-derived</span>
      </div>

      {plan.bestActionReason && (
        <p className="text-sm text-gray-100 leading-relaxed">{plan.bestActionReason}</p>
      )}

      <div className="overflow-hidden rounded border border-gray-800">
        <table className="w-full text-xs">
          <thead className="bg-gray-900/80 text-gray-400 uppercase tracking-wide">
            <tr>
              <th className="text-left px-3 py-1.5 font-medium">Action</th>
              <th className="text-right px-3 py-1.5 font-medium">EV</th>
              <th className="text-right px-3 py-1.5 font-medium">CI</th>
            </tr>
          </thead>
          <tbody>
            {plan.perAction.map((a, i) => (
              <tr
                key={i}
                className={a.isBest
                  ? 'bg-emerald-950/40 text-emerald-100 font-semibold'
                  : a.unsupported
                    ? 'text-gray-500'
                    : 'text-gray-300'}
              >
                <td className="px-3 py-1.5">
                  {a.actionLabel || '—'}
                  {a.isBest && (
                    <span className="ml-2 text-[9px] uppercase tracking-wide text-emerald-400">best</span>
                  )}
                  {a.unsupported && (
                    <span className="ml-2 text-[9px] uppercase tracking-wide text-gray-500 italic">unsupported</span>
                  )}
                </td>
                <td className="text-right px-3 py-1.5 font-mono">{formatEV(a.ev)}</td>
                <td className="text-right px-3 py-1.5 font-mono text-gray-500 text-[10px]">
                  {Number.isFinite(a.evLow) && Number.isFinite(a.evHigh)
                    ? `${a.evLow.toFixed(1)} – ${a.evHigh.toFixed(1)}`
                    : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.nextStreetPlan === null && (
        <p className="text-[11px] italic text-gray-500 leading-relaxed">
          Forward-look unavailable on this node (river / no depth-2 branches).
        </p>
      )}

      {plan.nextStreetPlan && typeof plan.nextStreetPlan === 'object' && (
        <NextStreetPlan plan={plan.nextStreetPlan} />
      )}

      {Array.isArray(plan.caveats) && plan.caveats.length > 0 && (
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          Caveats: {plan.caveats.join(' · ')}
        </div>
      )}
    </div>
  );
};

// ---------- Composition root ---------- //

export const HandPlanSection = ({ node, line, archetype }) => {
  const safeArchetype = isKnownArchetype(archetype) ? archetype : 'reg';
  const heroView = node?.heroView;
  const activeBucket = pickActiveBucket(heroView);

  const authoredEntry = useMemo(() => {
    if (!node?.comboPlans || !activeBucket) return null;
    const e = node.comboPlans[activeBucket];
    if (!e || typeof e.planText !== 'string') return null;
    // v1 single-combo: prefer the per-combo override when one exists for the
    // pinned combo; fall back to the bucket entry. heroView.combos[0] in
    // schema-string form is the override key. Schema validator already
    // checked combo-format + heroView.combos membership.
    const comboStr = Array.isArray(heroView.combos) ? heroView.combos[0] : null;
    if (comboStr && e.overrides && e.overrides[comboStr]) {
      const ov = e.overrides[comboStr];
      return { planText: ov.planText, ruleChips: ov.ruleChips || [], from: 'override' };
    }
    return { planText: e.planText, ruleChips: e.ruleChips || [], from: 'bucket' };
  }, [node, heroView, activeBucket]);

  const hasAuthored = authoredEntry !== null;

  const [toggleOn, setToggleOn] = useState(() => readToggle());
  const [openChipId, setOpenChipId] = useState(null);

  const [enginePlan, setEnginePlan] = useState(null);
  const [engineLoading, setEngineLoading] = useState(false);

  // Decide whether we need the engine plan. Skip the call when authored is
  // present and toggle is off (saves the MC compute on taught nodes).
  const needsEngine = !hasAuthored || toggleOn;

  // Build the depth-2 plan input. LSW-D1: replaces the v1-simplified-ev path
  // with a direct call to `computeDepth2Plan` (which wraps `evaluateGameTree`).
  const input = useMemo(() => {
    if (!needsEngine) return null;
    if (!heroView) return null;
    let villainRange;
    try {
      if (node?.villainRangeContext?.baseRangeId) {
        villainRange = villainRangeFor(node.villainRangeContext.baseRangeId);
      } else {
        return null; // v1: require villainRangeContext for engine plan
      }
    } catch (err) {
      return { errorPreflight: err.message || String(err) };
    }
    let board;
    try { board = parseBoard(node.board); } catch (err) {
      return { errorPreflight: `Board parse failed: ${err.message || err}` };
    }
    const heroComboString = Array.isArray(heroView.combos) ? heroView.combos[0] : null;
    if (!heroComboString) return null;
    return {
      input: {
        heroCombo: heroComboString,
        villainRange,
        board,
        pot: Number(node.pot) || 0,
        villainAction: node?.villainAction || null,
        decisionKind: node?.decisionKind || 'standard',
        effectiveStack: line?.setup?.effStack || 100,
        // archetype is informational today — the engine derives behavior
        // from villainModel + playerStats. Future: synthesize playerStats
        // from archetype to make the toggle move depth-2 EV.
        contextHints: { archetype: safeArchetype },
      },
    };
  }, [node, line, safeArchetype, heroView, needsEngine]);

  useEffect(() => {
    if (!needsEngine) {
      setEnginePlan(null);
      return undefined;
    }
    if (!input) {
      setEnginePlan(null);
      return undefined;
    }
    if (input.errorPreflight) {
      setEnginePlan({
        heroCombo: null,
        perAction: [],
        bestActionLabel: null,
        bestActionReason: null,
        decisionKind: node?.decisionKind || 'standard',
        caveats: [],
        nextStreetPlan: null,
        errorState: {
          kind: 'range-unavailable',
          userMessage: 'Solver plan unavailable for this node.',
          diagnostic: input.errorPreflight,
        },
      });
      return undefined;
    }
    let cancelled = false;
    setEngineLoading(true);
    // LSW-D2: cache by stable (line, node, archetype) tuple. Key is opaque
    // to engineCache; the cache module composes engineVersion in for us.
    const cacheKey = `${line?.id || '?'}:${node?.id || '?'}:${safeArchetype}`;
    getOrCompute('depth2Plan', cacheKey, () => computeDepth2Plan(input.input))
      .then((p) => { if (!cancelled) setEnginePlan(p); })
      .catch((err) => {
        if (!cancelled) {
          setEnginePlan({
            heroCombo: null,
            perAction: [],
            bestActionLabel: null,
            bestActionReason: null,
            decisionKind: node?.decisionKind || 'standard',
            caveats: [],
            nextStreetPlan: null,
            errorState: {
              kind: 'engine-internal',
              userMessage: 'Engine error computing solver plan.',
              diagnostic: err.message || String(err),
            },
          });
        }
      })
      .finally(() => { if (!cancelled) setEngineLoading(false); });
    return () => { cancelled = true; };
  }, [input, needsEngine, node]);

  const hasEngine = enginePlan !== null && Array.isArray(enginePlan.perAction);
  const source = selectActivePlanSource({ hasAuthored, hasEngine, toggleOn });

  const handleToggle = () => {
    const next = !toggleOn;
    setToggleOn(next);
    writeToggle(next);
  };

  // Don't render at all when the node has no heroView — there's nothing to
  // anchor a plan to. Mirrors BucketEVPanelV2 gating.
  if (!heroView) return null;

  // Gracefully skip when we have neither source AND no engine result yet.
  // This keeps the section invisible on terminal/non-decision nodes that
  // don't trigger an engine compute.
  if (source === 'none' && !engineLoading) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">Hand plan</div>
        {hasAuthored && hasEngine && (
          <label className="flex items-center gap-2 text-[11px] text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={toggleOn}
              onChange={handleToggle}
              className="accent-teal-500"
            />
            <span>Show solver plan</span>
          </label>
        )}
      </div>

      {source === 'authored-only' && (
        <AuthoredPlanBlock entry={authoredEntry} onChipTap={setOpenChipId} />
      )}

      {source === 'engine-only' && enginePlan && (
        <EnginePlanBlock plan={enginePlan} />
      )}

      {source === 'both' && (
        <div className="space-y-3">
          <AuthoredPlanBlock entry={authoredEntry} onChipTap={setOpenChipId} />
          {enginePlan && <EnginePlanBlock plan={enginePlan} />}
        </div>
      )}

      {engineLoading && !enginePlan && needsEngine && (
        <div className="rounded-lg border border-teal-800/60 bg-teal-900/10 p-4 text-xs text-gray-400 italic">
          Computing solver plan vs {safeArchetype}…
        </div>
      )}

      <RuleChipModal chipId={openChipId} onClose={() => setOpenChipId(null)} />
    </div>
  );
};
