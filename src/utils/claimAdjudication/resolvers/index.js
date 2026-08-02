/**
 * resolvers/index.js — the resolvers registered by default
 *
 * Each one wraps an engine primitive that ALREADY EXISTS. No new poker maths is
 * invented here; a resolver's job is to turn a spoken assertion into the call
 * the engine already knows how to answer, and to hand back the number with its
 * provenance attached.
 *
 * INV-STK-01 is enforced here rather than trusted: a stack-depth claim may only
 * be DISPROVEN against an admissible stack. Anything else is `blocked`.
 */

import { CLAIM_KIND, VERDICT, GAP, makeVerdict } from '../claims';
import { potOddsNeeded } from '../../exploitEngine/preflopFoldResolver';
import { STACK_SOURCE } from '../../seatStacks/stackLedger';

/** A stack is "short" below this, in big blinds. Live full-ring convention. */
const SHORT_STACK_BB = 40;
/** Effective stacks at or under this are push/fold territory. */
const DEEP_STACK_BB = 100;

/**
 * Pot odds — "he's getting a great price", "he's priced in".
 *
 * Uses `potOddsNeeded(callAmount, potBefore)`, the engine's existing definition,
 * so a verdict here can never disagree with what the advisor computed live.
 */
export const potOddsResolver = {
  id: 'pot-odds/preflopFoldResolver',
  kinds: [CLAIM_KIND.POT_ODDS],
  requires: ['pot', 'toCall'],
  resolve: (claim, ctx) => {
    const required = potOddsNeeded(ctx.toCall, ctx.pot);
    if (!Number.isFinite(required)) {
      return makeVerdict({
        verdict: VERDICT.BLOCKED,
        gap: GAP.MISSING_FIELD,
        detail: 'Pot or bet size did not resolve to a number.',
      });
    }

    const pct = required * 100;
    const actual = { value: Number(pct.toFixed(1)), unit: '%-equity-needed' };

    // "Priced in" / "great price" is a claim that the required equity is LOW.
    // Where the founder stated a number, check the number instead.
    if (claim.quantity?.unit === '%-equity-needed' && Number.isFinite(claim.quantity.value)) {
      const stated = claim.quantity.value;
      const close = Math.abs(stated - pct) <= 3;   // spoken figures are rounded
      return makeVerdict({
        verdict: close ? VERDICT.SUPPORTED : VERDICT.DISPROVEN,
        actual,
        detail: `Calling ${ctx.toCall} into ${ctx.pot} needs ${pct.toFixed(1)}% equity; you said ${stated}%.`,
      });
    }

    const cheap = pct <= 33;
    return makeVerdict({
      verdict: cheap ? VERDICT.SUPPORTED : VERDICT.DISPROVEN,
      actual,
      detail: cheap
        ? `Getting ${pct.toFixed(1)}% — a call needs little equity, so "priced in" holds.`
        : `A call needs ${pct.toFixed(1)}% equity here, which is not a cheap price.`,
    });
  },
};

/**
 * Stack depth — "they're short", "we're 40 big blinds deep".
 *
 * THE INV-STK-01 CHOKE POINT. A carried-forward or entered stack may settle this;
 * a buy-in assumption or a stale value may not. Refuting a true claim with a
 * drifted number is the failure this whole tier exists to prevent, so an
 * inadmissible stack yields `blocked` and names why.
 */
export const stackDepthResolver = {
  id: 'stack-depth/stackLedger',
  kinds: [CLAIM_KIND.STACK_DEPTH],
  requires: ['effStackBB'],
  resolve: (claim, ctx) => {
    if (!ctx.stacksAdmissible) {
      return makeVerdict({
        verdict: VERDICT.BLOCKED,
        gap: GAP.INADMISSIBLE_PROVENANCE,
        detail: ctx.effStackSource === STACK_SOURCE.BUYIN_DEFAULT
          ? 'Stacks here are the session buy-in assumption, never observed. The claim stands; enter a stack to make it checkable.'
          : 'Stacks here are stale — too far from the last time one was observed to refute anything. The claim stands.',
        basis: { provenance: ctx.effStackSource },
      });
    }

    const bb = ctx.effStackBB;
    const actual = { value: Number(bb.toFixed(1)), unit: 'bb' };
    const basis = { provenance: ctx.effStackSource };

    if (Number.isFinite(claim.quantity?.value) && claim.quantity?.unit === 'bb') {
      const stated = claim.quantity.value;
      const close = Math.abs(stated - bb) <= Math.max(3, stated * 0.15);
      return makeVerdict({
        verdict: close ? VERDICT.SUPPORTED : VERDICT.DISPROVEN,
        actual,
        basis,
        detail: `Effective stack is ${bb.toFixed(1)}bb (${ctx.effStackSource}); you said ${stated}bb.`,
      });
    }

    // Qualitative: "short" / "deep".
    const saidShort = claim.comparator === 'lt';
    const isShort = bb <= SHORT_STACK_BB;
    const isDeep = bb >= DEEP_STACK_BB;
    const agrees = saidShort ? isShort : isDeep;

    return makeVerdict({
      verdict: agrees ? VERDICT.SUPPORTED : VERDICT.DISPROVEN,
      actual,
      basis,
      detail: `Effective stack is ${bb.toFixed(1)}bb (${ctx.effStackSource}), against a ${SHORT_STACK_BB}bb short / ${DEEP_STACK_BB}bb deep convention.`,
    });
  },
};

/** Players live — exact from the snapshot, no modelling involved. */
export const playersLiveResolver = {
  id: 'players-live/snapshot',
  kinds: [CLAIM_KIND.PLAYERS_LIVE],
  requires: ['playersLive'],
  resolve: (claim, ctx) => {
    const actual = { value: ctx.playersLive, unit: 'players' };
    if (!Number.isFinite(claim.quantity?.value)) {
      return makeVerdict({
        verdict: VERDICT.BLOCKED,
        gap: GAP.AMBIGUOUS,
        detail: 'No count was stated, so there is nothing to compare.',
        actual,
      });
    }
    const matches = claim.quantity.value === ctx.playersLive;
    return makeVerdict({
      verdict: matches ? VERDICT.SUPPORTED : VERDICT.DISPROVEN,
      actual,
      detail: `${ctx.playersLive} live at this point; you said ${claim.quantity.value}.`,
    });
  },
};

/**
 * Sizing — "I should have sized up".
 *
 * Deliberately UNFALSIFIABLE rather than blocked. A plan about what one should
 * have done is not a statement of fact about the hand, and `findOptimalBetSize`
 * answering differently is a divergence to log, not a refutation. Per founder
 * ratification F1, this lane records divergence and never renders a verdict on
 * whether the founder's reasoning was sound.
 */
export const sizingResolver = {
  id: 'sizing/unfalsifiable',
  kinds: [CLAIM_KIND.SIZING],
  requires: [],
  resolve: () => makeVerdict({
    verdict: VERDICT.UNFALSIFIABLE,
    detail: 'A statement of intent, not a fact about the hand. Recorded for engine-divergence comparison, not refuted.',
  }),
};

/**
 * Range claims about a population — "EP limpers never have aces".
 *
 * Registered as LIVE-BLOCKED on purpose. The imported reference pool (SRC-011,
 * HandHQ) is 21.6M ONLINE hands and is structurally barred from serving live
 * segments; the live prior is a hand-authored founder estimate with pseudocount
 * 10, which is not data that can refute anything.
 *
 * There is also a selection-bias trap the provenance registry already documents
 * under SRC-002: showdown reveals over-represent passive and calling lines, so a
 * holdings claim computed from observed hands is a conditional on a selected
 * set, never a population rate. Until a resolver handles that correctly, an
 * honest `blocked` beats a confidently biased answer.
 */
export const populationRangeResolver = {
  id: 'range/population-priors',
  kinds: [CLAIM_KIND.RANGE],
  requires: [],
  segments: ['online'],
  resolve: () => makeVerdict({
    verdict: VERDICT.BLOCKED,
    gap: GAP.NO_RESOLVER,
    detail: 'Population range checking is not wired yet. Note SRC-002: showdown reveals are a selected set and must never be quoted as a population rate.',
  }),
};

export const DEFAULT_RESOLVERS = [
  potOddsResolver,
  stackDepthResolver,
  playersLiveResolver,
  sizingResolver,
  populationRangeResolver,
];

export const _CONVENTIONS = { SHORT_STACK_BB, DEEP_STACK_BB };
