/**
 * adjudicate.js — run a reasoning note against the engine
 *
 * Orchestration only. Extraction lives in claimExtractor, checking lives in the
 * resolvers, and the matching rule lives in the registry. This file's whole job
 * is to walk a note's claims, bind each to the state that was on screen when it
 * was spoken, and collect the verdicts plus the gaps.
 *
 * THE GAPS ARE THE POINT AS MUCH AS THE VERDICTS. Under the founder's ratified
 * posture — claims stand until disproven with data, or proven with model
 * upgrades — a `blocked` verdict is not a failure to report. It is the
 * specification of the next engine capability, generated from real reasoning
 * rather than guessed at in a planning session.
 */

import { VERDICT, applyHedgePolicy } from './claims';
import { createRegistry } from './resolverRegistry';
import { DEFAULT_RESOLVERS } from './resolvers';
import { extractClaims } from './claimExtractor';

/** A registry with the default resolvers already registered. */
export const defaultRegistry = () => {
  const registry = createRegistry();
  for (const resolver of DEFAULT_RESOLVERS) registry.register(resolver);
  return registry;
};

/**
 * A claim's checking context is the snapshot captured WHEN IT WAS SPOKEN, plus
 * whatever the caller can add that the snapshot does not carry (e.g. the amount
 * facing a player, which depends on which decision is being talked about).
 */
const contextFor = (claim, extra = {}) => ({
  ...(claim.context || {}),
  ...extra,
});

/**
 * @param {object} note — a finalized VRN note
 * @param {object} [options]
 * @param {object} [options.registry] — defaults to the standard resolver set
 * @param {'live'|'online'} [options.segment] — the population this hand belongs to
 * @param {object} [options.extraContext] — fields the snapshot does not carry
 * @returns {{
 *   noteId, results, unparsed, coverage,
 *   summary: { supported, disproven, blocked, unfalsifiable },
 *   gaps: Array<{ gap, kind, detail, count }>
 * }}
 */
export const adjudicateNote = (note, options = {}) => {
  const {
    registry = defaultRegistry(),
    segment = null,
    extraContext = {},
  } = options;

  const { claims, unparsed, coverage } = extractClaims(note);

  const results = claims.map((claim) => {
    const ctx = contextFor(claim, extraContext);
    const raw = registry.resolve(claim, ctx, { segment });
    // Hedge policy is applied centrally so no resolver has to remember it: a
    // claim the founder hedged may diverge from the data but is never refuted
    // by it.
    return { claim, verdict: applyHedgePolicy(claim, raw) };
  });

  const summary = {
    supported: 0, disproven: 0, blocked: 0, unfalsifiable: 0,
  };
  for (const { verdict } of results) {
    if (verdict.verdict === VERDICT.SUPPORTED) summary.supported += 1;
    else if (verdict.verdict === VERDICT.DISPROVEN) summary.disproven += 1;
    else if (verdict.verdict === VERDICT.BLOCKED) summary.blocked += 1;
    else summary.unfalsifiable += 1;
  }

  return {
    noteId: note?.id ?? null,
    results,
    unparsed,
    coverage,
    summary,
    gaps: collectGaps(results),
  };
};

/**
 * The work queue, deduplicated.
 *
 * Grouped by (gap, claim kind) rather than by individual claim, because the unit
 * of work is "make stack-depth claims checkable", not "check this one sentence".
 * `count` is how often the founder's own reasoning ran into it — which is a far
 * better priority signal than an estimate, and is the reason to generate this
 * from real notes rather than plan it.
 */
export const collectGaps = (results) => {
  const byKey = new Map();
  for (const { claim, verdict } of results) {
    if (verdict.verdict !== VERDICT.BLOCKED) continue;
    const key = `${verdict.gap}::${claim.kind}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.count += 1;
      continue;
    }
    byKey.set(key, {
      gap: verdict.gap,
      kind: claim.kind,
      detail: verdict.detail,
      count: 1,
    });
  }
  return [...byKey.values()].sort((a, b) => b.count - a.count);
};
