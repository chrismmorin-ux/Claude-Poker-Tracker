/**
 * handLedger.mjs — the hands, counted. WS-428 Stage 0.
 *
 * WHAT THIS EXISTS TO FIX. Until this module the hero-EV runner recorded no hand count at
 * all. It recorded `decisionsScored` and it recorded `handsRead` — a per-FILE tally that is
 * not eval-filtered, not per-hero, not window-filtered, and not cap-aware — and it printed
 * them adjacent to each other. Anyone forming a per-hand figure would have divided one by
 * the other and been wrong by the pool/eval split, the hero multiplicity, the training
 * prefix and both caps, in different directions, so the error would not have looked like
 * an error.
 *
 * THE UNIT IS THE HERO-SEAT-HAND, AND THAT IS NOT A HAND. A corpus hand has no hero —
 * `phhAdapter` sets `mySeat: null`, because a 2009 hand history does not know who we are.
 * The harness manufactures hero by walking each EVAL-partition player in turn over the
 * hands they were seated in, so ONE physical hand seating three EVAL players is traversed
 * three times and is three hero-seat-hands. Measured on this corpus: 2.91 EVAL players per
 * hand at the default 50% partition. Deduplicating by hand id would divide the denominator
 * by that factor and multiply any rate built on it by the same amount.
 *
 * WHAT BELONGS IN THE DENOMINATOR, AND THE DISTINCTION THAT DECIDES IT:
 *
 *   - hero folded preflop, or the hand ended preflop for everyone → **IN**. A real hand,
 *     with a real zero. That is what makes the figure a winrate rather than a rate over
 *     the spots we happened to be able to price.
 *   - the harness could not build a range, or threw → **OUT**, counted separately. That is
 *     a fact about our instrument, not about poker. A denominator that shrinks when the
 *     harness fails reports instrument health as if it were strategy: the figure would
 *     rise on a bug fix with the play unchanged.
 *
 * The training prefix is out on the stronger ground that no advice exists there — we
 * structurally cannot have an opinion about a player's first `minTrainHands` hands, so
 * including them would make the figure move with the corpus's session-length distribution
 * while the strategy stood still.
 *
 * THE ANCHOR IS THE POINT. `fieldWinrateBB100` is the 2009 field's own realized result over
 * exactly this population, and it is the one figure in this pipeline whose correct value is
 * known WITHOUT the instrument: averaged over every seat it must be approximately minus the
 * rake. A denominator error big enough to matter shows up here as the wrong SIGN, which
 * plausible-looking arithmetic downstream cannot disguise. It costs no engine calls.
 */

/** Hero's seat in a hand, or null when this player was not dealt in. */
export const seatOfPlayer = (hand, playerId) => {
  for (const [seat, pid] of Object.entries(hand?.seatPlayers || {})) {
    if (String(pid) === String(playerId)) return seat;
  }
  return null;
};

/** Why a dealt hand could not contribute its realized net. Counted, never silently dropped. */
export const LEDGER_SKIP_REASONS = {
  HERO_NOT_SEATED: 'hero-not-seated',
  HERO_SEAT_NOT_IN_OUTCOME: 'hero-seat-not-in-outcome',
};

export const newHandLedger = () => ({
  dealtHandsInWindows: 0,
  dealtHandsInDroppedWindows: 0,
  fieldNetResolvedHands: 0,
  fieldNetSumBB: 0,
  fieldNetUnresolved: {},
  ledgerSkips: {},
});

const bump = (o, k) => { o[k] = (o[k] || 0) + 1; };

/**
 * Count one walk-forward test window. Call this BEFORE anything that can throw, so a
 * window the harness later fails on has still had its hands counted — they were dealt
 * either way.
 *
 * @param {Object} ledger
 * @param {Object} args
 * @param {string} args.playerId  - the EVAL player being treated as hero
 * @param {Array}  args.testHands - the window, exactly as the scorer receives it
 * @param {Function} args.outcomeFor - (hand) => { raked } — injected so this module needs
 *   no knowledge of rake config and reuses the caller's cache. A hand appears in several
 *   players' windows, so resolving it once per hand rather than once per hero-seat-hand is
 *   the difference between one pass and three.
 */
export const countDealtWindow = (ledger, { playerId, testHands, outcomeFor }) => {
  for (const hand of testHands) {
    ledger.dealtHandsInWindows++;

    const heroSeat = seatOfPlayer(hand, playerId);
    if (heroSeat === null) { bump(ledger.ledgerSkips, LEDGER_SKIP_REASONS.HERO_NOT_SEATED); continue; }

    const { raked } = outcomeFor(hand);
    if (!raked?.resolved) { bump(ledger.fieldNetUnresolved, raked?.reason ?? 'unknown'); continue; }

    const net = raked.netBySeat[String(heroSeat)];
    if (!Number.isFinite(net)) {
      bump(ledger.ledgerSkips, LEDGER_SKIP_REASONS.HERO_SEAT_NOT_IN_OUTCOME);
      continue;
    }

    ledger.fieldNetSumBB += net;
    ledger.fieldNetResolvedHands++;
  }
};

/**
 * Attribute a window to the harness rather than to poker. The hands STAY in
 * `dealtHandsInWindows` — they were dealt — and are additionally counted here so a later
 * consumer can subtract them and see what the subtraction cost.
 */
export const markWindowDropped = (ledger, testHands) => {
  ledger.dealtHandsInDroppedWindows += testHands.length;
};

/**
 * Fold a per-player ledger fragment into a run-level accumulator (WS-433).
 *
 * MUST be called in canonical enumeration order: `fieldNetSumBB` is an order-sensitive
 * float accumulation, and folding fragments in completion order would make the sealed
 * figure depend on worker timing. The orchestrator sorts fragments by playerIndex first.
 */
export const mergeLedgerFragment = (acc, frag) => {
  acc.dealtHandsInWindows += frag.dealtHandsInWindows;
  acc.dealtHandsInDroppedWindows += frag.dealtHandsInDroppedWindows;
  acc.fieldNetResolvedHands += frag.fieldNetResolvedHands;
  acc.fieldNetSumBB += frag.fieldNetSumBB;
  for (const [k, v] of Object.entries(frag.fieldNetUnresolved)) {
    acc.fieldNetUnresolved[k] = (acc.fieldNetUnresolved[k] || 0) + v;
  }
  for (const [k, v] of Object.entries(frag.ledgerSkips)) {
    acc.ledgerSkips[k] = (acc.ledgerSkips[k] || 0) + v;
  }
  return acc;
};

/** Seal into the serializable block. A zero denominator yields null, never 0 and never NaN. */
export const sealHandLedger = (ledger) => ({
  unit: 'hero-seat-hand',
  dealtHandsInWindows: ledger.dealtHandsInWindows,
  dealtHandsInDroppedWindows: ledger.dealtHandsInDroppedWindows,
  fieldNetResolvedHands: ledger.fieldNetResolvedHands,
  fieldNetSumBB: Number(ledger.fieldNetSumBB.toFixed(4)),
  fieldWinrateBB100: ledger.fieldNetResolvedHands > 0
    ? Number(((ledger.fieldNetSumBB / ledger.fieldNetResolvedHands) * 100).toFixed(2))
    : null,
  fieldNetUnresolved: { ...ledger.fieldNetUnresolved },
  ledgerSkips: { ...ledger.ledgerSkips },
  rakeIsModelled: true,
  expectedSign: 'negative — the field pays the rake. A positive value means the population '
    + 'being averaged over is selected on reaching a scoreable spot, not dealt.',
});
