/**
 * resolverRegistry.js — capability-matched claim resolution
 *
 * THE DESIGN CONSTRAINT (founder, 2026-08-01): *"I anticipate the engine being
 * able to support more and more complex positions with greater accuracy… I
 * expect the notes I enter will become more nuanced, so the parser needs to be
 * very good."*
 *
 * A `switch (claim.kind)` would satisfy today and rot immediately: every new
 * engine capability would mean editing the adjudicator, and every claim shape
 * the switch had not heard of would fall through to nothing.
 *
 * So resolvers DECLARE what they can answer, and the adjudicator matches on that
 * declaration. Adding an engine capability is one `register()` call. Nothing in
 * the parser or the vocabulary moves.
 *
 * A resolver descriptor:
 *   {
 *     id,           stable name, appears in every verdict's basis
 *     kinds,        CLAIM_KIND values it answers
 *     requires,     snapshot fields that must be non-null for it to run
 *     segments,     ['live','online'] — which populations it may serve, or null for any
 *     resolve,      (claim, ctx) => verdict
 *   }
 *
 * `requires` is what makes a missing field produce a NAMED gap rather than a
 * crash or a silent skip. `segments` is what stops an online-only data source
 * being quoted at a live hand — the live/online wall is enforced at the registry
 * rather than trusted to each resolver's own discipline.
 */

import { VERDICT, GAP, makeVerdict } from './claims';

const REQUIRED_KEYS = ['id', 'kinds', 'resolve'];

export const createRegistry = () => {
  const resolvers = [];

  const register = (descriptor) => {
    for (const key of REQUIRED_KEYS) {
      if (!descriptor?.[key]) throw new Error(`resolver descriptor missing ${key}`);
    }
    if (resolvers.some((r) => r.id === descriptor.id)) {
      throw new Error(`resolver ${descriptor.id} already registered`);
    }
    resolvers.push({
      requires: [],
      segments: null,
      ...descriptor,
    });
    return registry;
  };

  /** Every resolver that answers this claim's kind, regardless of readiness. */
  const candidatesFor = (claim) =>
    resolvers.filter((r) => r.kinds.includes(claim?.kind));

  /**
   * Which snapshot fields a resolver needs but does not have.
   *
   * `null` and `undefined` both count as absent. A `0` does NOT — zero is a
   * legitimate pot and a legitimate stack, and treating it as missing is the
   * same class of bug that made deriveEffStackAt suppress the SPR zone.
   */
  const missingFields = (resolver, context) =>
    (resolver.requires || []).filter((field) => {
      const v = context?.[field];
      return v === null || v === undefined;
    });

  /**
   * Resolve one claim.
   *
   * Ordering is deliberate. Every non-answer is a NAMED gap, because the gap is
   * the work item — an unnamed failure teaches nothing and generates nothing.
   */
  const resolve = (claim, context = {}, options = {}) => {
    const candidates = candidatesFor(claim);
    if (candidates.length === 0) {
      return makeVerdict({
        verdict: VERDICT.BLOCKED,
        gap: GAP.NO_RESOLVER,
        detail: `Nothing can check a '${claim?.kind}' claim yet. The claim stands; this is an engine capability to build.`,
      });
    }

    const segment = options.segment || null;
    const admissible = candidates.filter(
      (r) => !r.segments || !segment || r.segments.includes(segment),
    );
    if (admissible.length === 0) {
      return makeVerdict({
        verdict: VERDICT.BLOCKED,
        gap: GAP.WRONG_SEGMENT,
        detail: `The only sources that could answer this are not admissible for a '${segment}' hand. Live and online are distinct populations and are never merged.`,
      });
    }

    // Prefer a resolver whose inputs are all present. Among those, the first
    // registered wins — registration order is the priority declaration.
    const ready = admissible.filter((r) => missingFields(r, context).length === 0);
    if (ready.length === 0) {
      const blockedBy = [...new Set(admissible.flatMap((r) => missingFields(r, context)))];
      return makeVerdict({
        verdict: VERDICT.BLOCKED,
        gap: GAP.MISSING_FIELD,
        detail: `Not recorded at this point in the hand: ${blockedBy.join(', ')}. The claim stands.`,
        basis: { blockedBy },
      });
    }

    const resolver = ready[0];
    try {
      const verdict = resolver.resolve(claim, context);
      if (!verdict) {
        return makeVerdict({
          verdict: VERDICT.BLOCKED,
          gap: GAP.NO_RESOLVER,
          detail: `${resolver.id} declined to answer this claim.`,
          basis: { resolver: resolver.id },
        });
      }
      return {
        ...verdict,
        basis: { resolver: resolver.id, ...(verdict.basis || {}) },
      };
    } catch (error) {
      // A resolver throwing must never take down the adjudication of a whole
      // note. The other claims are still worth checking.
      return makeVerdict({
        verdict: VERDICT.BLOCKED,
        gap: GAP.NO_RESOLVER,
        detail: `${resolver.id} failed: ${error?.message || 'unknown error'}`,
        basis: { resolver: resolver.id },
      });
    }
  };

  /** Introspection — what the engine can currently answer, for reporting gaps. */
  const capabilities = () =>
    resolvers.map(({ id, kinds, requires, segments }) => ({ id, kinds, requires, segments }));

  const registry = { register, resolve, candidatesFor, missingFields, capabilities };
  return registry;
};
