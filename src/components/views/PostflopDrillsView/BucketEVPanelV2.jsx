/**
 * BucketEVPanelV2 — composition root for the v2 decision surface.
 *
 * Per the `bucket-ev-panel-v2` spec + I-DM invariants:
 *   - Renders primitives from VARIANT_RECIPES in order (I-DM-1 structural
 *     enforcement: primitive order is a constant, not inline JSX).
 *   - Villain-range decomposition is always above the hero view (never
 *     hidden behind a disclosure).
 *   - Arithmetic per action is visible as a weighted-total table (P2 dev-
 *     asserts non-empty perGroupContribution — I-DM-2).
 *   - Hero view is a context header, not the decision answer (P3 interface
 *     physically excludes EV props — I-DM-3).
 *
 * Reveal-button fate (Gate-4 Q7): **removed in v2**. Primitives are visible
 * on node entry. This is a deliberate consistency break with v1 — v1
 * students clicked "Reveal" before seeing decomposition; v2 students see it
 * immediately per I-DM-1.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { computeBucketEVsV2 } from '../../../utils/postflopDrillContent/drillModeEngine';
import { computeDepth2Plan } from '../../../utils/postflopDrillContent/computeDepth2Plan';
import { getOrCompute } from '../../../utils/postflopDrillContent/engineCache';
import { villainRangeFor } from '../../../utils/postflopDrillContent/villainRanges';
import { isKnownArchetype } from '../../../utils/postflopDrillContent/archetypeRangeBuilder';
import { parseBoard, parseAndEncode } from '../../../utils/pokerCore/cardParser';
import { VARIANT_RECIPES, selectVariant } from './panels/variantRecipes';
import { VillainRangeDecomposition } from './panels/VillainRangeDecomposition';
import { WeightedTotalTable } from './panels/WeightedTotalTable';
import { HeroViewBlock } from './panels/HeroViewBlock';
import { ActionRecommendationStrip } from './panels/ActionRecommendationStrip';
import { StreetNarrowingContext } from './panels/StreetNarrowingContext';
import { ConfidenceDisclosure } from './panels/ConfidenceDisclosure';
import { GlossaryBlock } from './panels/GlossaryBlock';

/**
 * Compute the adjusted caveats list for the bucket panel given a depth-2
 * cross-check result. Pure helper exported for tests.
 *
 *  - When depth-2 unavailable / errored → caveats unchanged.
 *  - When depth-2 best-action MATCHES bucket-EV best-action → replace
 *    `'v1-simplified-ev'` with `'depth2-cross-validated'`.
 *  - When depth-2 best-action MISMATCHES → keep `'v1-simplified-ev'` (honest
 *    signaling) but add `'depth2-divergent'` so the student knows the
 *    simplified path disagreed with the solver.
 *
 * Best-action match is a leading-token comparison ("bet 75%" → "bet";
 * "Raise to 9bb" → "raise") since bucket-EV labels include sizings and
 * depth-2 labels are bare action kinds.
 */
export const adjustCaveatsForDepth2 = (bucketCaveats, bucketBestLabel, depth2Plan) => {
  const caveats = Array.isArray(bucketCaveats) ? bucketCaveats.slice() : [];
  if (!depth2Plan || depth2Plan.errorState || !depth2Plan.bestActionLabel) {
    return caveats;
  }
  const firstToken = (s) => {
    if (typeof s !== 'string') return '';
    const trimmed = s.trim().toLowerCase();
    if (trimmed.length === 0) return '';
    return trimmed.split(/[\s_-]+/)[0];
  };
  const bucketTok = firstToken(bucketBestLabel);
  const depth2Tok = firstToken(depth2Plan.bestActionLabel);
  if (!bucketTok || !depth2Tok) return caveats;
  const aligned = bucketTok === depth2Tok;
  const idx = caveats.indexOf('v1-simplified-ev');
  if (aligned && idx !== -1) {
    caveats[idx] = 'depth2-cross-validated';
  } else if (!aligned) {
    caveats.push('depth2-divergent');
  }
  return caveats;
};

// Registry mapping primitive ids to their component. The renderer consults
// this — adding a new primitive means adding its id + component here AND
// referencing it in VARIANT_RECIPES. I-DM-1 code-review visibility rule.
const PRIMITIVE_REGISTRY = Object.freeze({
  P1: VillainRangeDecomposition,
  P2: WeightedTotalTable,
  P3: HeroViewBlock,
  P4: ActionRecommendationStrip,
  P5: StreetNarrowingContext,
  P6: ConfidenceDisclosure,
  P6b: GlossaryBlock,
});

// Default hero actions when node.decision is absent. v1 ship uses the
// DEFAULT_ACTIONS shape from the engine — check / bet_33 / bet_75 / bet_150.
// For v2 spec compliance the action labels are used directly.
const DEFAULT_HERO_ACTIONS = [
  { label: 'check', kind: 'check' },
  { label: 'bet 33%',  kind: 'bet', betFraction: 0.33 },
  { label: 'bet 75%',  kind: 'bet', betFraction: 0.75 },
  { label: 'bet 150%', kind: 'bet', betFraction: 1.5 },
];

const deriveHeroActionsFromDecision = (decision) => {
  if (!decision || !Array.isArray(decision.branches)) return DEFAULT_HERO_ACTIONS;
  return decision.branches.map((b) => {
    const label = (b.label || '').toLowerCase();
    if (label.startsWith('check') || label === 'check-back') {
      return { label: b.label, kind: 'check' };
    }
    if (label.startsWith('fold')) return { label: b.label, kind: 'fold' };
    if (label.startsWith('call')) return { label: b.label, kind: 'call' };
    if (label.startsWith('jam')) return { label: b.label, kind: 'jam' };
    if (label.startsWith('raise')) return { label: b.label, kind: 'raise' };
    // Bet sizing extraction: look for "N%" patterns.
    const pctMatch = b.label.match(/(\d+(?:\.\d+)?)\s*%/);
    if (pctMatch) {
      const pct = Number(pctMatch[1]) / 100;
      return { label: b.label, kind: 'bet', betFraction: pct };
    }
    return { label: b.label, kind: 'bet', betFraction: 0.75 };
  });
};

const parseHeroCombo = (comboStr) => {
  if (typeof comboStr !== 'string' || comboStr.length !== 4) return null;
  const c1 = parseAndEncode(comboStr.slice(0, 2));
  const c2 = parseAndEncode(comboStr.slice(2, 4));
  if (c1 < 0 || c2 < 0 || c1 === c2) return null;
  return { card1: c1, card2: c2 };
};

/**
 * Collect every bucket label rendered on the current node so the glossary
 * block (P6b) can scope its entry list to what the student is actually
 * looking at. Pulls from decomposition groupIds (P1) + heroView.bucketCandidates.
 */
const collectVisibleLabels = ({ decomposition, heroView }) => {
  const out = new Set();
  if (Array.isArray(decomposition)) {
    for (const g of decomposition) out.add(g.groupId);
  }
  if (heroView && Array.isArray(heroView.bucketCandidates)) {
    for (const b of heroView.bucketCandidates) out.add(b);
  }
  return Array.from(out);
};

export const BucketEVPanelV2 = ({ node, line, archetype }) => {
  const safeArchetype = isKnownArchetype(archetype) ? archetype : 'reg';
  const heroView = node?.heroView;

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  // Derive stable input for the engine call.
  const input = useMemo(() => {
    if (!heroView) return null;
    // Resolve villain range from villainRangeContext.baseRangeId OR fall
    // back to line.setup.villains[0] tuple (legacy lines migrating one node
    // at a time).
    let villainRange;
    try {
      if (node?.villainRangeContext?.baseRangeId) {
        villainRange = villainRangeFor(node.villainRangeContext.baseRangeId);
      } else if (line?.setup?.villains?.[0]) {
        // Fallback path — resolve via archetypeRangeFor directly.
        // eslint-disable-next-line global-require
        const { archetypeRangeFor } = require('../../../utils/postflopDrillContent/archetypeRanges');
        villainRange = archetypeRangeFor(line.setup.villains[0]);
      } else {
        return null;
      }
    } catch (err) {
      return { errorPreflight: err.message || String(err) };
    }

    let board;
    try {
      board = parseBoard(node.board);
    } catch (err) {
      return { errorPreflight: `Board parse failed: ${err.message || err}` };
    }

    // Map heroView to the engine's expected shape.
    const combos = Array.isArray(heroView.combos)
      ? heroView.combos.map(parseHeroCombo).filter((c) => c !== null)
      : [];

    const heroActions = deriveHeroActionsFromDecision(node?.decision);

    return {
      input: {
        nodeId: node.id || 'unknown',
        lineId: line?.id || 'unknown',
        street: node.street,
        board,
        pot: Number(node.pot) || 0,
        effStack: line?.setup?.effStack || 100,
        villains: [{
          position: line?.setup?.villains?.[0]?.position || 'BB',
          baseRange: villainRange,
        }],
        heroView: {
          kind: heroView.kind,
          combos,
          classLabel: heroView.classLabel,
          bucketCandidates: heroView.bucketCandidates,
        },
        decisionKind: node.decisionKind || 'standard',
        heroActions,
        archetype: safeArchetype,
        actionHistory: null, // Commit 3 scope: narrowing is always null on canary root.
      },
    };
  }, [node, line, safeArchetype, heroView]);

  useEffect(() => {
    if (!input) {
      setResult(null);
      return;
    }
    if (input.errorPreflight) {
      setResult({
        decomposition: [],
        actionEVs: [],
        recommendation: { actionLabel: '', templatedReason: '' },
        valueBeatRatio: null,
        streetNarrowing: null,
        confidence: { mcTrials: 0, populationPriorSource: '', archetype: '', caveats: [] },
        errorState: {
          kind: 'range-unavailable',
          userMessage: 'Villain range could not be resolved for this node.',
          diagnostic: input.errorPreflight,
        },
      });
      return;
    }
    let cancelled = false;
    setLoading(true);
    // LSW-D2: cache by stable (line, node, archetype) tuple. engineCache
    // composes the engineVersion stamp into the key so a version bump
    // invalidates implicitly.
    const cacheKey = `${input.input.lineId || '?'}:${input.input.nodeId || '?'}:${safeArchetype}`;
    getOrCompute('bucketEVsV2', cacheKey, () => computeBucketEVsV2(input.input))
      .then((out) => {
        if (!cancelled) setResult(out);
      })
      .catch((err) => {
        if (!cancelled) {
          setResult({
            decomposition: [],
            actionEVs: [],
            recommendation: { actionLabel: '', templatedReason: '' },
            valueBeatRatio: null,
            streetNarrowing: null,
            confidence: { mcTrials: 0, populationPriorSource: '', archetype: '', caveats: [] },
            errorState: {
              kind: 'engine-internal',
              userMessage: 'Engine error computing bucket EVs.',
              diagnostic: err.message || String(err),
            },
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [input]);

  // LSW-D2 follow-on (2026-04-27): cross-validate against depth-2 plan when
  // available. Cache hit if HandPlanSection already ran the same compute on
  // this (line, node, archetype). Replaces the `'v1-simplified-ev'` caveat
  // with `'depth2-cross-validated'` (best-action match) or
  // `'depth2-divergent'` (mismatch) when depth-2 succeeds. Preserves I-DM-2
  // arithmetic-traceability — does NOT modify decomposition or actionEVs.
  const [depth2Plan, setDepth2Plan] = useState(null);

  useEffect(() => {
    if (!input || input.errorPreflight) {
      setDepth2Plan(null);
      return undefined;
    }
    const heroComboString = Array.isArray(heroView?.combos) ? heroView.combos[0] : null;
    if (!heroComboString) {
      setDepth2Plan(null);
      return undefined;
    }
    let cancelled = false;
    const cacheKey = `${input.input.lineId || '?'}:${input.input.nodeId || '?'}:${safeArchetype}`;
    const depth2Input = {
      heroCombo: heroComboString,
      villainRange: input.input.villains?.[0]?.baseRange,
      board: input.input.board,
      pot: input.input.pot,
      villainAction: node?.villainAction || null,
      decisionKind: input.input.decisionKind || 'standard',
      effectiveStack: input.input.effStack || 100,
      contextHints: { archetype: safeArchetype },
    };
    getOrCompute('depth2Plan', cacheKey, () => computeDepth2Plan(depth2Input))
      .then((p) => { if (!cancelled) setDepth2Plan(p); })
      .catch(() => { if (!cancelled) setDepth2Plan(null); });
    return () => { cancelled = true; };
  }, [input, safeArchetype, heroView, node]);

  // v2 panel only renders on nodes with heroView — LineNodeRenderer branches
  // on that presence. Guard anyway for robustness.
  if (!heroView) return null;

  // Variant selection from schema fields.
  const variantId = selectVariant({
    street: node.street,
    villainFirst: Boolean(node.villainAction),
    decisionKind: node.decisionKind || 'standard',
  });
  const recipe = VARIANT_RECIPES[variantId] || VARIANT_RECIPES.V1;

  if (loading) {
    return (
      <div className="rounded-lg border border-teal-800/60 bg-teal-900/10 p-4 text-xs text-gray-400 italic">
        Computing bucket decomposition vs {safeArchetype}…
      </div>
    );
  }

  if (!result) return null;

  // Error banner (Gate-4 F03 compliance) — render instead of primitives when
  // errorState is populated.
  if (result.errorState) {
    return (
      <div className="rounded-lg border border-rose-800 bg-rose-950/30 p-4 space-y-1.5">
        <div className="text-[10px] uppercase tracking-wide text-rose-300">
          Decomposition unavailable ({result.errorState.kind})
        </div>
        <div className="text-xs text-rose-100">{result.errorState.userMessage}</div>
        {result.errorState.recovery && (
          <div className="text-[11px] text-rose-200/80">{result.errorState.recovery}</div>
        )}
        {result.errorState.diagnostic && (
          <details className="text-[10px] text-gray-400">
            <summary className="cursor-pointer hover:text-gray-300">diagnostic</summary>
            <div className="pt-1 font-mono text-[10px] whitespace-pre-wrap">{result.errorState.diagnostic}</div>
          </details>
        )}
      </div>
    );
  }

  // Build the props bundle for each primitive once. Primitives take only
  // what they need from this bundle — the registry lookup below selects
  // the right component per recipe id.
  const visibleLabels = collectVisibleLabels({
    decomposition: result.decomposition,
    heroView,
  });

  const propsByPrimitive = {
    P1: {
      decomposition: result.decomposition,
      decisionKind: node.decisionKind || 'standard',
      archetype: safeArchetype,
    },
    P2: {
      decomposition: result.decomposition,
      actionEVs: result.actionEVs,
    },
    P3: {
      mode: heroView.kind,
      combo: input?.input?.heroView?.combos?.[0],
      combos: heroView.combos,
      classLabel: heroView.classLabel,
    },
    P4: {
      recommendation: result.recommendation,
      valueBeatRatio: result.valueBeatRatio,
    },
    P5: {
      streetNarrowing: result.streetNarrowing,
    },
    P6: {
      confidence: {
        ...result.confidence,
        caveats: adjustCaveatsForDepth2(
          result.confidence?.caveats,
          result.recommendation?.actionLabel,
          depth2Plan,
        ),
      },
    },
    P6b: {
      labelIds: visibleLabels,
    },
  };

  return (
    <div className="rounded-lg border border-teal-800/60 bg-teal-900/10 p-4 space-y-3">
      <div className="flex items-baseline justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wide text-teal-300/90">
            Decision surface · v2
          </div>
          <div className="text-[10px] text-gray-500">
            {node.decisionKind || 'standard'} · variant {variantId} · change archetype in the toolbar above
          </div>
        </div>
        <div className="text-[10px] uppercase tracking-wide text-gray-500">
          vs {safeArchetype}
        </div>
      </div>
      {recipe.map((primId, i) => {
        const Component = PRIMITIVE_REGISTRY[primId];
        if (!Component) {
          // Unknown primitive id — visible dev warning, non-crashing.
          return (
            <div
              key={`unknown-${primId}-${i}`}
              className="rounded border border-amber-800 bg-amber-950/30 px-3 py-2 text-[11px] text-amber-200"
            >
              Unknown primitive '{primId}' in variant recipe.
            </div>
          );
        }
        const props = propsByPrimitive[primId] || {};
        return <Component key={`${primId}-${i}`} {...props} />;
      })}
    </div>
  );
};
