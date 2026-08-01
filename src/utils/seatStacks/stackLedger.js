/**
 * stackLedger.js — per-seat chip stacks for the LIVE CASH path
 *
 * Surface spec: docs/design/surfaces/seat-stack-ledger.md
 * Gate 1: audits/2026-08-01-entry-seat-stack-ledger.md (YELLOW)
 * Gate 2: audits/2026-08-01-blindspot-seat-stack-ledger.md (commitments C-1..C-6)
 *
 * WHY THIS EXISTS. The cash path tracked no stacks at all, so effective stack and
 * SPR were uncomputable and every stack-depth claim in a Voice Reasoning Note
 * bound to `null`. This makes them computable.
 *
 * WHAT IT IS NOT: an accounting system. It is an ESTIMATE WITH PROVENANCE. A
 * consumer needs "≈22bb, carried" far more than it needs an exact integer that
 * nobody at a live table can supply.
 *
 * PROVENANCE IS THE POINT (C-1). Entry cost forbids asking for nine numbers a
 * hand, so most values are derived by carry-forward — and a derived value is
 * weaker evidence than an observed one. Every entry therefore carries where it
 * came from and how long ago it was last evidence-grounded.
 *
 *   entered        founder typed it, or an action proved it
 *   carried        arithmetic from a known prior value
 *   buyin-default  assumed from the session buy-in; never observed
 *   stale          too far from its last observation to be admissible
 *   unknown        no basis at all
 *
 * INV-STK-01 (C-2) — THE SAFETY PROPERTY. Only `entered` or `carried` may
 * DISPROVE a claim. Everything else yields "not checkable". Drift must produce
 * abstention, never a false refutation: the founder's posture is that his claims
 * stand until disproven WITH DATA, and refuting a true claim with a drifted
 * number inverts the entire purpose of adjudication. A null is honest; a
 * confidently wrong 22bb is not.
 *
 * OBSERVED BEATS DERIVED (C-3). A seat that commits more than the ledger says it
 * has just proved the ledger wrong. That is not action data "silently rewriting"
 * stack data — it is the same trust hierarchy poolBaseline.js already applies to
 * population stats, where a higher-trust source dominates a lower-trust one.
 *
 * Pure. No React, no IDB, no clock. Hand numbers are passed in, so staleness is
 * deterministic in tests.
 */

export const STACK_SOURCE = Object.freeze({
  ENTERED: 'entered',
  CARRIED: 'carried',
  BUYIN_DEFAULT: 'buyin-default',
  STALE: 'stale',
  UNKNOWN: 'unknown',
});

/** INV-STK-01: the only sources that may disprove a claim. */
export const ADMISSIBLE_SOURCES = Object.freeze([STACK_SOURCE.ENTERED, STACK_SOURCE.CARRIED]);

/** One orbit at a full table. A carried value older than this is not evidence. */
export const STALE_AFTER_HANDS = 9;
/** A never-observed assumption expires as soon as the seat has played a hand. */
export const BUYIN_STALE_AFTER_HANDS = 1;

// =============================================================================
// ENTRIES
// =============================================================================

/**
 * `observedAtHand` records the last time this seat's stack was EVIDENCE-GROUNDED
 * — not the last time arithmetic touched it. Carry-forward preserves it, which is
 * what lets staleness measure distance from observation rather than from the most
 * recent addition. Conflating the two would make a carried value immortal.
 */
const makeEntry = (amount, source, observedAtHand) => ({
  amount: Math.max(0, Number(amount) || 0),
  source,
  observedAtHand: Number(observedAtHand) || 0,
});

/**
 * The source this entry actually has NOW, after decay.
 *
 * Stored separately from the decayed value so the ledger never has to be swept:
 * age is a function of the current hand, so decay is computed at read.
 */
export const resolveSource = (entry, currentHand) => {
  if (!entry || !Number.isFinite(entry.amount)) return STACK_SOURCE.UNKNOWN;
  if (entry.source === STACK_SOURCE.UNKNOWN || entry.source === STACK_SOURCE.STALE) {
    return entry.source;
  }

  const age = Math.max(0, (Number(currentHand) || 0) - (Number(entry.observedAtHand) || 0));

  if (entry.source === STACK_SOURCE.BUYIN_DEFAULT) {
    return age >= BUYIN_STALE_AFTER_HANDS ? STACK_SOURCE.STALE : STACK_SOURCE.BUYIN_DEFAULT;
  }
  if (age >= STALE_AFTER_HANDS) return STACK_SOURCE.STALE;
  // An entered value is only `entered` for the hand it was observed in. After
  // that it is being carried, and says so.
  if (entry.source === STACK_SOURCE.ENTERED) {
    return age === 0 ? STACK_SOURCE.ENTERED : STACK_SOURCE.CARRIED;
  }
  return STACK_SOURCE.CARRIED;
};

/** INV-STK-01 gate. Consumers call this rather than testing sources by hand. */
export const isAdmissible = (entry, currentHand) =>
  ADMISSIBLE_SOURCES.includes(resolveSource(entry, currentHand));

/**
 * Read a seat as a consumer sees it: amount plus its CURRENT provenance.
 * Returns `amount: null` — never 0 — when there is no basis, because 0 is a
 * legitimate stack and would be indistinguishable from "we don't know".
 * (`deriveEffStackAt` returned 0 for unknown and silently suppressed the SPR
 * zone on every cash hand for exactly this reason.)
 */
export const readStack = (ledger, seat, currentHand) => {
  const entry = ledger?.[seat] ?? ledger?.[String(seat)] ?? null;
  const source = resolveSource(entry, currentHand);
  if (!entry || source === STACK_SOURCE.UNKNOWN) {
    return { amount: null, source: STACK_SOURCE.UNKNOWN, admissible: false };
  }
  return {
    amount: entry.amount,
    source,
    admissible: ADMISSIBLE_SOURCES.includes(source),
  };
};

// =============================================================================
// LEDGER CONSTRUCTION AND MUTATION (all non-mutating)
// =============================================================================

/**
 * Seed seats from the session buy-in. Never observed, so it expires fast — this
 * is a starting guess that gets replaced by the first thing anyone actually does.
 */
export const seedLedger = ({ seats = [], buyIn = null, atHand = 0 } = {}) => {
  const ledger = {};
  if (!Number.isFinite(Number(buyIn)) || Number(buyIn) <= 0) return ledger;
  for (const seat of seats) {
    ledger[seat] = makeEntry(buyIn, STACK_SOURCE.BUYIN_DEFAULT, atHand);
  }
  return ledger;
};

/** Founder typed a value. The strongest source there is. */
export const setSeatStack = (ledger, { seat, amount, atHand = 0 } = {}) => {
  if (!Number.isFinite(Number(amount)) || Number(amount) < 0) return ledger;
  return { ...(ledger || {}), [seat]: makeEntry(amount, STACK_SOURCE.ENTERED, atHand) };
};

/** Explicitly mark a seat unknown (player left, stack genuinely not established). */
export const clearSeatStack = (ledger, seat) => {
  if (!ledger || !(seat in ledger)) return ledger || {};
  const next = { ...ledger };
  delete next[seat];
  return next;
};

/**
 * C-3 — observed action corrects derived inference.
 *
 * A seat that has committed more than the ledger credits it with has PROVED the
 * ledger wrong. Raise it to what was actually committed and promote it to
 * `entered`: the figure is now evidence-grounded, not inferred.
 *
 * Only ever raises. A seat committing less than its stack proves nothing — that
 * is just a normal bet.
 *
 * `estimated` (from calculateSidePots) means some bet/raise lacked an amount, so
 * contributions are unreliable and must not be treated as observations.
 *
 * @returns {{ ledger: Object, corrections: Array<{seat, from, to}> }}
 */
export const reconcileWithContributions = (
  ledger,
  { contributions = {}, atHand = 0, estimated = false } = {},
) => {
  const corrections = [];
  if (estimated) return { ledger: ledger || {}, corrections };

  let next = ledger || {};
  for (const key of Object.keys(contributions)) {
    const seat = Number(key);
    const committed = Number(contributions[key]) || 0;
    if (committed <= 0) continue;

    const entry = next[seat] ?? next[String(seat)] ?? null;
    // A seat with no entry at all is now known to have had AT LEAST this much.
    // That is a real observation and better than nothing.
    if (!entry) {
      next = { ...next, [seat]: makeEntry(committed, STACK_SOURCE.ENTERED, atHand) };
      corrections.push({ seat, from: null, to: committed });
      continue;
    }
    if (committed > entry.amount) {
      corrections.push({ seat, from: entry.amount, to: committed });
      next = { ...next, [seat]: makeEntry(committed, STACK_SOURCE.ENTERED, atHand) };
    }
  }
  return { ledger: next, corrections };
};

/**
 * Carry the ledger into the next hand: stack − committed + won.
 *
 * Founder-ratified 2026-08-01 ("I always record the winner, carry-forward is
 * fine"), which is what makes `payouts` reliable enough to build on.
 *
 * `observedAtHand` is PRESERVED, not refreshed — arithmetic is not observation,
 * and pretending otherwise would make a stack that has not been seen in twenty
 * hands look as trustworthy as one entered a moment ago.
 *
 * A hand with `estimated` contributions cannot be carried honestly: the
 * subtraction would be wrong by an unknown amount. Those seats degrade to STALE
 * rather than propagating a corrupted number as `carried`.
 */
export const advanceHand = (
  ledger,
  { contributions = {}, payouts = {}, estimated = false } = {},
) => {
  const next = {};
  for (const key of Object.keys(ledger || {})) {
    const seat = Number(key);
    const entry = ledger[key];
    if (!entry) continue;

    if (estimated) {
      next[seat] = { ...entry, source: STACK_SOURCE.STALE };
      continue;
    }

    const committed = Number(contributions[seat]) || 0;
    const won = Number(payouts[seat]) || 0;
    const amount = Math.max(0, entry.amount - committed + won);

    next[seat] = {
      amount,
      // buyin-default stays buyin-default: carrying an assumption forward does
      // not turn it into a derivation from anything real.
      source: entry.source === STACK_SOURCE.BUYIN_DEFAULT
        ? STACK_SOURCE.BUYIN_DEFAULT
        : STACK_SOURCE.CARRIED,
      observedAtHand: entry.observedAtHand,
    };
  }
  return next;
};

// =============================================================================
// DERIVED QUANTITIES
// =============================================================================

/**
 * Effective stack — the CORRECT definition: the smallest stack that can still be
 * played for, i.e. min(hero, deepest-relevant opponent) across seats still live.
 *
 * `heroStateReplayUtils.deriveEffStackAt` computed hero's REMAINING stack and
 * called it effective stack. That is a different quantity and it is not the one
 * any strategy consumer wants. This is the single definition; the other is
 * deleted onto it.
 *
 * Returns `{ amount: null }` when hero or every opponent is inadmissible —
 * abstention, per INV-STK-01, rather than a number built on a guess.
 */
export const effectiveStackAt = (ledger, { heroSeat, liveSeats = [], currentHand = 0 } = {}) => {
  const hero = readStack(ledger, heroSeat, currentHand);
  if (hero.amount === null || !hero.admissible) {
    return { amount: null, source: hero.source, admissible: false };
  }

  const opponents = liveSeats
    .map(Number)
    .filter((s) => s !== Number(heroSeat))
    .map((s) => readStack(ledger, s, currentHand))
    .filter((r) => r.amount !== null && r.admissible);

  if (opponents.length === 0) {
    return { amount: null, source: STACK_SOURCE.UNKNOWN, admissible: false };
  }

  // Heads-up: min(hero, villain). Multiway: hero can be covered by the deepest
  // opponent, so what is playable is bounded by the LARGEST opponent stack.
  const deepestOpponent = Math.max(...opponents.map((o) => o.amount));
  const amount = Math.min(hero.amount, deepestOpponent);

  // The result is only as trustworthy as its weakest input.
  const weakest = [hero, ...opponents].some((r) => r.source === STACK_SOURCE.CARRIED)
    ? STACK_SOURCE.CARRIED
    : STACK_SOURCE.ENTERED;

  return { amount, source: weakest, admissible: true };
};

/**
 * `Number(null)` is 0, not NaN — so a plain Number() coercion turns "we don't
 * know" into a confident zero, which is precisely the failure this module
 * exists to prevent. Absence is rejected before any arithmetic sees it.
 */
const finiteOrNull = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** SPR at a point. Null pot or null effective stack yields null, never 0. */
export const sprFrom = (effectiveStack, pot) => {
  const e = finiteOrNull(effectiveStack);
  const p = finiteOrNull(pot);
  if (e === null || p === null || p <= 0) return null;
  return e / p;
};

/** Stack in big blinds — the unit every stack-depth claim is actually made in. */
export const toBigBlinds = (amount, bb) => {
  const a = finiteOrNull(amount);
  const b = finiteOrNull(bb);
  if (a === null || b === null || b <= 0) return null;
  return a / b;
};

/**
 * The shape snapshots persist. Every value travels with its provenance, so a
 * consumer reading `stacks` without reading `stackSource` is reading a different
 * quantity than the one recorded — the same discipline `potBasis` already
 * enforces for the pot.
 */
export const buildStackBinding = (ledger, { heroSeat, liveSeats = [], currentHand = 0, pot = null, bb = null } = {}) => {
  const stacks = {};
  const sources = {};
  for (const seat of liveSeats.map(Number)) {
    const r = readStack(ledger, seat, currentHand);
    stacks[seat] = r.amount;
    sources[seat] = r.source;
  }

  const eff = effectiveStackAt(ledger, { heroSeat, liveSeats, currentHand });
  const spr = eff.amount === null ? null : sprFrom(eff.amount, pot);

  return {
    stacks: Object.keys(stacks).length ? stacks : null,
    stackSources: Object.keys(sources).length ? sources : null,
    effStack: eff.amount,
    effStackSource: eff.source,
    effStackBB: eff.amount === null ? null : toBigBlinds(eff.amount, bb),
    spr,
    // A single flag consumers can gate on without knowing the tier vocabulary.
    stacksAdmissible: eff.admissible,
  };
};
