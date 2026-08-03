/**
 * entryCard.mjs — WS-323. The Entry Map as a WS-322 Declared surface.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * WHY THE MAP HAS TO BECOME A CARD
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The map is a grid of numbers. A Strategy Card is a STRATEGY: enclosed over its declared
 * domain, warranted per rule, executable from the one artifact. ADR-009's guarantee is that a
 * declared surface is scored by the SAME instrument as the observed, fitted and imported ones
 * — so until the map loads as a Card it cannot be compared to anything, and a number nobody
 * can compare is a number nobody can be wrong about.
 *
 * It also closes the founder's own definition of a strategy: "a strategy just needs to account
 * for all your hands." The map answers 169 × position × facing-action. The Card is where that
 * answer is forced to be TOTAL — every state inside the domain reaches a rule or the residual,
 * and the loader refuses a card that cannot show it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * THE THREE NAMED GROUPS, AND WHY THE FRINGE IS NOT LEFT TO THE RESIDUAL
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * The obvious card is 84 `enter` rules and a residual that folds everything else. It would
 * load, and it would be wrong in a specific way: the 59 genuinely-marginal cells and the 119
 * unmeasured ones would become indistinguishable from the 1,090 the arithmetic actively
 * rejects. "We decided to fold this", "we could not tell", and "we never reached it" would all
 * read as the same silence. That is exactly the conflation the Coverage Census exists to
 * prevent, reappearing one artifact later.
 *
 * So three groups are NAMED and the residual carries only what the arithmetic rejected:
 *
 *   enter/*       clear+       the interval is entirely above zero. Enter, with the map's action.
 *   fringe/*      fringe-tight the interval straddles zero and is TIGHT. Folding is the declared
 *                              default, and this is the one band where a read may legitimately
 *                              break the tie — which is why the cells are named rather than
 *                              buried, so a future card can override exactly these.
 *   unmeasured/*  unmeasured   the interval straddles zero and is WIDE. Fold, because nothing
 *                              supports entering — but this is a research queue, not a finding.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * EVERY RULE IS WARRANTED `equity`, AND THAT IS ITSELF A CLAIM
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * All 262 rules come from the same arithmetic, so all 262 carry the `equity` warrant. What
 * differs between the groups is not the KIND of reason but WHAT THE ARITHMETIC ESTABLISHED,
 * which is why the distinction lives in the rule id and the claim rather than in the warrant
 * class. Stated positively: this card declares that none of its rules rest on a population
 * read and none rest on fear. A machine-enumerated map has no business claiming either, and a
 * later hand-authored card that overrides these cells will differ from it precisely there.
 *
 * The `unmeasured` claims say outright that no sign was established. An `equity` warrant whose
 * claim admits the arithmetic abstained is the honest shape — WS-327's derived fear-detector
 * should see these rules for what they are, and dressing them as something firmer would hide
 * them from it.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * PROVENANCE LIVES IN `rationale`, WHERE THE HASH CAN REACH IT
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * `loadStrategyCardSync` returns a normalized card built from named fields, so any extra
 * top-level block a generator attaches is DROPPED on load. A provenance block outside the
 * schema would therefore sit in the file, survive review, and vanish the moment anything
 * actually loaded the card — the file and the card would disagree.
 *
 * So the policy id, engine commit, τ and band counts are written into `rationale`, which is
 * required, loaded, and inside `canonicalCardBody`'s hash. A card whose provenance changed is
 * a different card, and the hash says so. The JSON artifact keeps a machine-readable copy too,
 * marked as the convenience copy it is.
 */

import { BANDS } from './entryMap.mjs';

/** Schema version of the emitted artifact wrapper (the Card's own version is SoR's). */
export const ENTRY_CARD_ARTIFACT_VERSION = 1;

/**
 * The advisor's generic action vocabulary, resolved to the legal preflop entry action.
 *
 * NOT A RELABELLING — a resolution, and the engine is the authority for it. `preflopAdvisor`
 * emits `check` for the first-in branch where it has just computed `limpCost` and a limped-pot
 * EV (see the `limpIsIP` / `limpCost` block); `check` is simply the generic name that branch
 * pushes. A card that copied it verbatim would tell a player to check from UTG, which is not a
 * legal action, and an unexecutable card is not a strategy.
 *
 * The mapping is total and unambiguous on the shipped map: `facingAction` fully determines the
 * vocabulary (none → check|bet, raise → call|raise), so an unrecognised pair means the engine's
 * action set changed and the card must not guess. It throws.
 */
export const ENTRY_ACTIONS = Object.freeze({
  'none/check': 'limp',
  'none/bet': 'open',
  'raise/call': 'call',
  'raise/raise': '3bet',
});

export const entryActionOf = (facingAction, advisorAction, { cellId = '?' } = {}) => {
  const resolved = ENTRY_ACTIONS[`${facingAction}/${advisorAction}`];
  if (!resolved) {
    throw new Error(
      `cell "${cellId}": the advisor recommended "${advisorAction}" facing "${facingAction}", ` +
      `which is not one of ${Object.keys(ENTRY_ACTIONS).join(', ')}. The engine's action set ` +
      'has changed; resolve the new action explicitly rather than letting the card guess.',
    );
  }
  return resolved;
};

const bb = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(3)}bb`;

/**
 * Build a Strategy Card from a loaded entry map.
 *
 * @param {Object} map - the output of `loadEntryMap` (bands already recomputed at one τ)
 * @returns {Object} a card in the shape `loadStrategyCardSync` accepts
 */
export const buildEntryCard = (map) => {
  const policyId = map.continuationPolicy.id;
  const tau = map.reporting.tauBB;
  const counts = map.counts?.byBand ?? {};

  const rules = [];

  const cellsIn = (band) => map.cells.filter((c) => c.band === band);

  // ── enter/* — the interval is entirely above zero ────────────────────────────────────────
  for (const c of cellsIn(BANDS.CLEAR_PLUS)) {
    rules.push({
      id: `enter/${c.cellId}`,
      when: { handClass: c.handClass, posCategory: c.posCategory, facingAction: c.facingAction },
      do: entryActionOf(c.facingAction, c.bestAction, { cellId: c.cellId }),
      warrant: {
        class: 'equity',
        claim: `entry margin ${bb(c.margin)} over folding, interval [${bb(c.lower)}, ${bb(c.upper)}] ` +
          `entirely above zero, under ${policyId}`,
      },
      note: `mcError ${c.mcError.toFixed(3)}bb · modelError ${c.modelError.toFixed(3)}bb`,
    });
  }

  // ── fringe/* — straddles zero, tight. Fold declared; a read may break the tie ────────────
  for (const c of cellsIn(BANDS.FRINGE_TIGHT)) {
    rules.push({
      id: `fringe/${c.cellId}`,
      when: { handClass: c.handClass, posCategory: c.posCategory, facingAction: c.facingAction },
      do: 'fold',
      warrant: {
        class: 'equity',
        claim: `entry margin ${bb(c.margin)}, interval [${bb(c.lower)}, ${bb(c.upper)}] straddles ` +
          `zero at half-width ${c.halfWidth.toFixed(3)}bb ≤ τ=${tau}bb — genuinely indifferent to ` +
          `folding, not merely unmeasured, under ${policyId}`,
      },
      note: 'the arithmetic abstains here; folding is the declared default and a read may ' +
        'legitimately override it. Named rather than left to the residual so a later card can ' +
        'override exactly these cells.',
    });
  }

  // ── unmeasured/* — straddles zero, wide. A research queue, not a finding ─────────────────
  for (const c of cellsIn(BANDS.UNMEASURED)) {
    rules.push({
      id: `unmeasured/${c.cellId}`,
      when: { handClass: c.handClass, posCategory: c.posCategory, facingAction: c.facingAction },
      do: 'fold',
      warrant: {
        class: 'equity',
        claim: `NO SIGN ESTABLISHED: entry margin ${bb(c.margin)} with interval ` +
          `[${bb(c.lower)}, ${bb(c.upper)}], half-width ${c.halfWidth.toFixed(3)}bb > τ=${tau}bb. ` +
          `Folding is declared because nothing supports entering, not because entering was ` +
          `shown to lose, under ${policyId}`,
      },
      note: `research queue: ${c.modelError > c.mcError ? 'modelError dominates — more DATA' : 'mcError dominates — more SAMPLES'}`,
    });
  }

  const rationale = [
    `The Entry Map under continuation policy ${policyId}, at engine commit ${map.engineCommit}` +
      `${map.engineDirty ? ' (DIRTY TREE — not replicable)' : ''}, banded at τ=${tau}bb.`,
    '',
    'Folding is EV = 0 by definition, so "worth playing" is exactly EV(enter) > 0 and the hands ' +
    'indifferent to folding sit at zero by construction. Every cell of (169 hand classes × 5 ' +
    'position categories × 2 facing-actions) was enumerated and evaluated through the production ' +
    'preflop advisor, and carries an interval rather than a bare point estimate — because ' +
    '"near zero" and "we cannot tell" look identical in a point estimate and are different facts.',
    '',
    `Band counts at this τ: clear+ ${counts[BANDS.CLEAR_PLUS] ?? 0} · fringe-tight ` +
      `${counts[BANDS.FRINGE_TIGHT] ?? 0} · unmeasured ${counts[BANDS.UNMEASURED] ?? 0} · clear- ` +
      `${counts[BANDS.CLEAR_MINUS] ?? 0} · structurally unreachable ${counts.unreachable ?? 0}.`,
    '',
    'WHAT THIS CARD IS NOT. Entry EV is not a property of a hand — it is conditional on how the ' +
    `hand is played after the flop. ${policyId} cannot barrel, realizes no equity from overcards, ` +
    'and check-folds air for zero, so it systematically undervalues UNPAIRED hands: this card ' +
    'declines to open AKs from early position, which is a true statement about the policy and a ' +
    'false statement about poker. It is published as the BASELINE a better continuation policy ' +
    'has to beat, and the fringe-migration report is the instrument that will show it being ' +
    'beaten — unpaired hands climbing out of clear- is precisely what a policy that can barrel ' +
    'would produce.',
    '',
    'Every rule carries the equity warrant, which is itself a claim: nothing in this card rests ' +
    'on a population read and nothing rests on fear. A machine-enumerated map has no business ' +
    'claiming either.',
  ].join('\n');

  return {
    cardId: `entry-map/${policyId}`,
    schemaVersion: 1,
    title: `Entry Map — is this hand worth playing at all? (${policyId})`,
    rationale,
    domain: {
      street: 'preflop',
      gameType: map.domain?.gameType ?? 'cash',
      seats: map.domain?.seats ?? [6, 9],
      stackDepthBB: map.domain?.stackDepthBB ?? [80, 200],
    },
    rules,
    residual: {
      do: 'fold',
      rationale:
        'Every cell not named above is one the arithmetic actively REJECTED: its whole interval ' +
        'lies below zero, so entering loses money that folding does not. Folding is EV 0, which ' +
        'means this residual\'s EV share is zero by construction — the money does not come from ' +
        'the part nobody designed. The structurally unreachable spots (UTG facing a raise; ' +
        'folded-to-BB, where there is no entry decision) also land here, harmlessly: they never ' +
        'arise, so no query ever reaches this clause through them.',
    },
  };
};

/**
 * The emitted artifact: the card, plus the convenience provenance copy.
 *
 * The provenance block is explicitly NOT part of the card — `loadStrategyCardSync` drops it —
 * and the load-bearing copy of every field in it is inside `card.rationale`, where the content
 * hash can reach it.
 */
export const buildEntryCardArtifact = (map) => ({
  artifactVersion: ENTRY_CARD_ARTIFACT_VERSION,
  generatedBy: 'scripts/backtest/run-entry-card.mjs',
  provenanceNote:
    'Convenience copy for machine readers. NOT part of the Strategy Card — the loader drops ' +
    'unknown top-level fields, so the load-bearing copy of all of this lives in card.rationale, ' +
    'inside the content hash.',
  provenance: {
    continuationPolicy: map.continuationPolicy,
    engineCommit: map.engineCommit,
    engineDirty: Boolean(map.engineDirty),
    tauBB: map.reporting.tauBB,
    field: map.field ? { sourceId: map.field.sourceId, stakeBB: map.field.stakeBB, seatBucket: map.field.seatBucket } : null,
    bandCounts: map.counts?.byBand ?? {},
  },
  card: buildEntryCard(map),
});
