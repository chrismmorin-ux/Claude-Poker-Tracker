/**
 * emitConductCard — turn an induced ruleset into the Standard-of-Record form.
 *
 * The procedure produces a description; this makes it a RECORD, so that two descriptions of
 * the same villain can be laid against each other and so that a fault confirmed next month can
 * find the cards that depended on it.
 *
 * WHY THIS DOES NOT USE `buildReplicationManifest` VERBATIM. `manifestProblems` requires the
 * seven REQUIRED_CONSTANTS — PRIOR_WEIGHT, ACTION_TAU_FRACTION, MIN_CONTINUATION_WEIGHT,
 * REFINEMENT_BUDGET_MS, MAX_STAGE_SHARE, REFINEMENT_UNITS_PER_MS, KL_FLOOR. Every one is a
 * constant of the ENGINE's decision model, and the induction that produces a Conduct Card
 * consumes none of them: it reads a labelled table and splits it. Stamping them would assert a
 * dependence that does not exist, which is the same class of dishonesty the manifest was built
 * to stop — the register itself calls the constant set "a floor, not a schema — stamp whatever
 * else a run depends on". So the card carries the manifest's SHAPE with the constant floor that
 * actually applies to it: the induction parameters, which fully determine its rule count.
 */
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  buildConductCard, buildMix, SIZED_ACTIONS, SIZING_REGIMES,
} from '../../src/utils/standardOfRecord/conductCard.js';
import { registerVersion } from '../../src/utils/standardOfRecord/faultRegister.js';
import { SCHEMA_VERSION } from './decisionSchema.mjs';
import { induceSizing } from './induceCore.mjs';
import {
  SIZING_SCHEME_VERSIONS, SIZING_PRIOR_WEIGHT,
  regimeForStreet, sizingValue, bandFor, bandNamesOf, bandingDeclaration, cellKey,
  shrinkBands, armComparison, armResolution, bandShape,
} from './sizingBands.mjs';

const git = (args, fallback) => {
  try { return execFileSync('git', args, { encoding: 'utf8' }).trim(); }
  catch { return fallback; }
};

/** sha256 over the corpus slice actually read, so a rerun on a different slice cannot pass as a rerun. */
export const dealBookHashOf = (files) => {
  const h = createHash('sha256');
  for (const f of [...files].map((x) => (typeof x === 'string' ? x : x.path)).sort()) {
    h.update(String(f).replace(/\\/g, '/'));
    h.update('\0');
  }
  return `sha256:${h.digest('hex')}`;
};

/**
 * CANONICAL BODY — an explicit, ordered, FULL-DEPTH projection.
 *
 * The previous one-liner was `JSON.stringify(card, Object.keys(card).sort())`, which reads
 * like a key-ordering and is actually a replacer allowlist applied at every depth. It hashed
 * 639 of 70,195 bytes. Sabotaging every rate, interval, holding, gate and hash inside the card
 * left the digest identical - so every downstream citation of a card by contentHash was
 * citing a rule count.
 *
 * Written as a recursive sort rather than a hand-listed projection because a hand-listed one
 * silently stops covering fields added later, and this schema is explicitly additive.
 */
const canonicalize = (v) => {
  if (Array.isArray(v)) return v.map(canonicalize);
  if (v && typeof v === 'object') {
    const out = {};
    for (const k of Object.keys(v).sort()) out[k] = canonicalize(v[k]);
    return out;
  }
  return v;
};
// Exported so the known-answer check tests THIS function rather than a copy of it. A check
// that reimplements what it verifies is two representations that never have to agree - the
// exact defect this directory has been bitten by twice.
export const canonical = (card) => JSON.stringify(canonicalize(card));

/**
 * The ERA COORDINATES, parsed from the corpus directory name.
 *
 * HandHQ lays its data out as `PS-2009-07-01_2009-07-23_50NLH_OBFU`, which carries the site,
 * the exact date window and the stake — every one of which the card previously reduced to the
 * prose string "online-50NL-2009". Prose does not sort, and an archetype trajectory has to be
 * plotted against something that does.
 *
 * DERIVED FROM THE HANDS THE CARD CONTAINS, never the wider slice that was scanned. Villain 1's
 * 1,544 hands are ALL PokerStars, even though the scan covered Full Tilt files too; stamping the
 * scan's sites would have put a site on his card that he never played on.
 */
const DIR_RE = /(FTP|PS)-(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})_([A-Za-z0-9]+)_/;
const SITE = { PS: 'PokerStars', FTP: 'FullTilt' };

export const provenanceOf = (paths, decisions) => {
  const sites = new Set(), starts = [], ends = [], stakes = new Set();
  for (const p of paths) {
    const m = DIR_RE.exec(String(p).split('\\').join('/'));
    if (!m) continue;
    sites.add(SITE[m[1]] || m[1]);
    starts.push(m[2]); ends.push(m[3]); stakes.add(m[4]);
  }
  if (!sites.size) return null;
  const dateStart = starts.sort()[0];
  const dateEnd = ends.sort().slice(-1)[0];
  const spanDays = Math.round(
    (Date.parse(dateEnd) - Date.parse(dateStart)) / 86400000,
  ) + 1;

  // Table size per HAND, not per decision — a 6-handed hand with four decisions in it is one
  // hand, and counting decisions would weight busy hands as if they were extra tables.
  const seatsByHand = new Map();
  for (const d of decisions) if (d.seatsDealt != null) seatsByHand.set(d.handId, d.seatsDealt);
  const tableSizes = {};
  for (const n of seatsByHand.values()) tableSizes[n] = (tableSizes[n] || 0) + 1;

  return {
    site: [...sites].sort().join('+'),
    dateStart, dateEnd, spanDays,
    stake: [...stakes].sort().join('+'),
    tableSizes,
    // Stated because it is the fact most likely to be forgotten when the card is quoted: a
    // 23-day window is a SNAPSHOT of a player, not a career, and a player can change inside one.
    note: `${spanDays} days of play. A snapshot, not a career — this card cannot see change within the subject.`,
  };
};

/**
 * @param {Object} input
 * @param {string} input.subjectId
 * @param {Array}  input.rules       - induced leaves, each carrying `.mix`
 * @param {Array}  input.decisions   - every labelled decision for this subject
 * @param {Array}  input.files       - the corpus files read
 * @param {Array}  input.gates       - the instrument self-checks, already run
 * @param {Object} input.induction   - {minRule, maxDepth, alpha, requireSignificance}
 * @param {Function} input.wilson
 * @param {string} input.population
 */
export const emitConductCard = async ({
  subjectId, rules, decisions, files, gates, induction, wilson, population,
  sourcePaths = null,
}) => {
  const handIds = new Set(decisions.map((d) => d.handId));
  const shown = decisions.filter((d) => d.handKnown);

  // Which shown hands he actually CHOSE to play. A free big-blind showdown reveals what he was
  // dealt, never what he selects, and a composition claim resting on those is resting on noise.
  const voluntaryHands = new Set(
    decisions.filter((d) => d.street === 'preflop'
      && (d.action === 'call' || d.action === 'raise' || d.action === 'bet'))
      .map((d) => d.handId),
  );
  const voluntarilyEnteredShown = new Set(
    shown.filter((d) => voluntaryHands.has(d.handId)).map((d) => d.handId),
  ).size;

  const ordered = [...rules].sort((a, b) => b.n - a.n);

  /**
   * RULE IDENTITY IS THE PREDICATE, NOT THE RANK.
   *
   * `ruleId` was `r01..rNN` assigned by position after sorting by n. So identity was RANK BY
   * SIZE: add a hundred hands, let one leaf overtake another, and `r08` silently denotes a
   * different spot. Every citation of a rule — `unresolved[].ruleId`, `residual.ruleId`, an
   * EV appraisal, an archetype parent link, a longitudinal comparison of one villain against
   * himself — points through that id, and every one of them rebinds on the next run with no
   * error anywhere. Measured: two cards for the same subject over the same 3,386 decisions,
   * from different engine commits, shared ONE ruleId out of 25 while 21 rules had no
   * counterpart at all.
   *
   * Hashing the canonical predicate makes the id a property of the SPOT. The same spot keeps
   * its id across runs, corpus growth and instrument changes; a spot that genuinely changed
   * gets a new id, which is the correct behaviour and is visible in a diff.
   */
  const canonicalPredicate = (r) => (r.predicate || [])
    .map((c) => `${c.feature}|${c.op}|${c.value}|${[...(c.siblings || [])].sort().join(",")}`)
    .join(" AND ");
  const ruleId = (r) => `r-${createHash("sha256").update(canonicalPredicate(r)).digest("hex").slice(0, 10)}`;

  /**
   * ────────────────────────────────────────────────────────────────────────────────────────
   * SIZING (v3, WS-578) — the line below used to be where the amount was thrown away.
   * ────────────────────────────────────────────────────────────────────────────────────────
   *
   * `r.mix.dist` is `classifyLeaf`'s tally keyed on the action NAME (mixTest.mjs:153-155), so
   * `[action, k]` never carried an amount and the card recorded none. Measured on villain 2:
   * `my_raise_to_bb` populated on 1,676 of 1,676 aggressive actions and reaching the card on
   * ZERO rules. `r.pool` has held the labelled decisions all along — the sizes were one filter
   * away the entire time.
   *
   * NOT a joint over (action x size), per the ticket: that multiplies the leaf count and
   * starves every cell. A sub-distribution WITHIN the action, banded the way the situation
   * features already are.
   */
  const PRIMARY_SCHEME = 'S2';
  const ALT_SCHEME = 'S3';
  const SCHEMES = [PRIMARY_SCHEME, ALT_SCHEME];

  const sizeSample = (d) => ({ sizeBb: d.myRaiseToBB ?? null, potBb: d.potBB ?? null, street: d.street });
  const sizedDecisions = decisions.filter((d) => SIZED_ACTIONS.includes(d.action));

  /** `(regime, band)` -> k over any row set, under one scheme. Cells, never bare band names. */
  const tallyCells = (rows, scheme) => {
    const m = new Map();
    for (const d of rows) {
      const key = cellKey(regimeForStreet(d.street), bandFor(d.myRaiseToBB ?? null, d.potBB ?? null, d.street, scheme));
      m.set(key, (m.get(key) || 0) + 1);
    }
    return m;
  };

  /**
   * THE PARENT CHAIN, computed ONCE over the whole card rather than per leaf.
   *
   * `.claude/rules/sparsity-refuse-or-shrink.md`: a sizing band is a DECISION INPUT — it feeds
   * a simulator's transition function and is never a displayed comparative claim — so a thin
   * cell SHRINKS toward its parent rather than refusing. The parent is this action's card-level
   * sizing distribution; ITS parent is every sized action on the card pooled. Refusal is the
   * wrong operation here: at the repo's own MIN_RULE_DEFAULT only a handful of (rule, action)
   * pairs clear the floor, and those few hold the large majority of the aggressive decisions —
   * the cells are thin, the MASS is not, and a transition function must return something at
   * every node it can be stepped into.
   */
  const sizeParents = {};
  const sizePopulation = {};
  for (const scheme of SCHEMES) {
    sizePopulation[scheme] = { counts: tallyCells(sizedDecisions, scheme), n: sizedDecisions.length };
    sizeParents[scheme] = {};
    for (const act of SIZED_ACTIONS) {
      const rows = sizedDecisions.filter((d) => d.action === act);
      sizeParents[scheme][act] = { counts: tallyCells(rows, scheme), n: rows.length };
    }
  }

  /**
   * One band distribution over an arbitrary row set, under one arm.
   *
   * Factored out of `armBands` (WS-552) so the INDUCED sizing sub-rules go through the identical
   * shrinkage, interval and shape pipeline as the leaf-level block. A sub-rule with its own
   * hand-rolled band construction would be a second representation of one fact, which is the
   * defect this directory has already been bitten by three times (`BANDS.can_raise`,
   * `my_bet_x_pot`, the canonical-body replacer).
   */
  const bandsOver = ({ scheme, rows, regimes, parentCounts, parentN, popCounts, popN, parentLabel }) => {
    // EVERY band of every regime PRESENT here, zeros included. The zeros are the holes and they
    // are the informative part — the same argument the coverage census makes about its own empty
    // cells. Regimes absent from the row set are not invented.
    const cells = regimes.flatMap((regime) => bandNamesOf(regime, scheme).map((band) => ({ regime, band })));
    const counts = tallyCells(rows, scheme);
    const observed = new Map();
    for (const d of rows) {
      const v = sizingValue(sizeSample(d));
      if (!v) continue;
      const key = cellKey(v.regime, bandFor(d.myRaiseToBB ?? null, d.potBB ?? null, d.street, scheme));
      observed.set(key, [...(observed.get(key) || []), v.value]);
    }
    return shrinkBands({
      cells, counts, n: rows.length, parentCounts, parentN, popCounts, popN, parentLabel,
    }).map((b) => ({
      ...b,
      // The interval is on the RAW count, because that is what an interval is about. `p` is
      // the shrunk estimate and it deliberately sits outside its own raw interval when the
      // cell is thin — which is the visible signature of the shrinkage, not a defect.
      ci: wilson(b.k, rows.length),
      // WS-578 AC5, in a queryable form. This is what makes the S2 `>=8` merge impossible to
      // miss: a band reporting distinctValues 14 with modalShare 0.63 is a point mass wearing
      // a tail's name, and a near-deterministic size is itself an exploitable fact.
      shape: bandShape(observed.get(cellKey(b.regime, b.band)) || []),
    }));
  };

  /**
   * ────────────────────────────────────────────────────────────────────────────────────────
   * THE SIZING RULES (WS-552) — the induction now predicts HOW BIG, not only WHICH.
   * ────────────────────────────────────────────────────────────────────────────────────────
   *
   * WS-578 made the card RECORD the size. It did not make the SEARCH see it, so the sharpest
   * rule a villain has could still be invisible: a spot where he always bets but bets 3/4 pot
   * instead of 1/2 is action-PURE, and `induce` stops at a pure leaf before testing a single
   * feature. Measured on villain 1, the rule that fires on 104 of 111 opening raises is a sizing
   * rule, and it is the only rule on his card that needs no hole cards — the highest-evidence
   * thing about him was the one thing the model was blind to.
   *
   * BOTH ARMS, because the induction's target labels come FROM the banding, so a banding change
   * can change which rules exist — not merely how their cells are counted. That makes the arm
   * delta here structural (which strata split, on which feature) rather than a scalar, and
   * `.claude/rules/unmeasured-constants.md` wants it reported either way. Running the second arm
   * costs one more in-memory tree over rows already loaded.
   */
  const sizingInduction = {};
  for (const scheme of SCHEMES) {
    sizingInduction[scheme] = induceSizing(ordered, {
      sizedActions: SIZED_ACTIONS,
      cellOf: (d) => {
        // `null` is the unsized row, and `induceSizing` holds those OUT of the search rather
        // than banding them: a split separating "we could derive his size" from "we could not"
        // is a rule about our pipeline, not about him.
        if (!sizingValue(sizeSample(d))) return null;
        return {
          regime: regimeForStreet(d.street),
          band: bandFor(d.myRaiseToBB ?? null, d.potBB ?? null, d.street, scheme),
        };
      },
      minRule: induction.minRule,
      maxDepth: induction.maxDepth,
      alpha: induction.alpha,
      requireSignificance: induction.requireSignificance,
    });
  }

  /** A sizing rule's identity is its PREDICATE, for the same reason a rule's is — never its rank. */
  const sizingRuleId = (rule, action, regime, leaf) => `s-${createHash('sha256')
    .update([ruleId(rule), action, regime, canonicalPredicate(leaf)].join(' >> '))
    .digest('hex').slice(0, 10)}`;

  /**
   * One action's sizing block, or `null` — and null is a POSITIVE statement (WS-578 AC2) that
   * this action has no size, never "we did not record it". A fold and a check move no chips; a
   * call is at a price someone else set.
   */
  const buildSizing = (rows, action, rule) => {
    if (!SIZED_ACTIONS.includes(action)) return null;
    const regimes = [...new Set(rows.map((d) => regimeForStreet(d.street)))].sort();
    const parentN = sizeParents[PRIMARY_SCHEME][action].n;

    const armBands = (scheme) => bandsOver({
      scheme,
      rows,
      regimes,
      parentCounts: sizeParents[scheme][action].counts,
      parentN: sizeParents[scheme][action].n,
      popCounts: sizePopulation[scheme].counts,
      popN: sizePopulation[scheme].n,
      parentLabel: `${action}@card (n=${sizeParents[scheme][action].n}), itself shrunk toward all sized actions on this card (n=${sizePopulation[scheme].n})`,
    });

    /**
     * THE INDUCED SUB-RULES for one arm, and the STRATA THAT DID NOT SPLIT beside them.
     *
     * Both halves ship. "This spot was searched and his sizing did not separate" is a finding —
     * it says the size here is a single policy and a simulator may use the leaf block directly —
     * and a card carrying only the hits would let "no sizing rule" read as "not looked for",
     * which is the `separatorSearch` failure one level down.
     *
     * The chain gains a level rather than a branch: sub-rule cell -> this (rule, action) ->
     * `action`@card -> every sized action. Each level shrinks toward its immediate parent, which
     * was itself shrunk, so a thin sub-rule cannot be pulled toward a parent treated as ground
     * truth merely because it sits one step up.
     */
    const armSubRules = (scheme) => {
      const strata = (sizingInduction[scheme].byRule.get(rule)?.get(action)) || [];
      const parentCounts = tallyCells(rows, scheme);
      return strata.map((st) => ({
        regime: st.regime,
        n: st.n,
        // Held out of the search, so it is counted where a reader will see it rather than
        // absorbed into a band.
        unsizedExcluded: st.unsizedExcluded,
        bandsOccupied: st.bandsOccupied,
        outcome: st.outcome,
        split: st.split,
        rules: st.leaves.map((leaf) => ({
          sizingRuleId: sizingRuleId(rule, action, st.regime, leaf),
          when: leaf.conds.map((c) => c.value).join(' AND ') || 'everything else',
          predicate: leaf.predicate,
          condValues: leaf.condValues,
          regime: st.regime,
          n: leaf.n,
          band: leaf.band,
          k: leaf.k,
          // A first-class rule carries its own interval, exactly as an action does.
          ci: wilson(leaf.k, leaf.n),
          pure: leaf.pure,
          bands: bandsOver({
            scheme,
            rows: leaf.pool,
            regimes: [st.regime],
            parentCounts,
            parentN: rows.length,
            popCounts: sizeParents[scheme][action].counts,
            popN: sizeParents[scheme][action].n,
            parentLabel: `${action} under rule ${ruleId(rule)} (n=${rows.length}), itself shrunk toward ${action}@card (n=${sizeParents[scheme][action].n})`,
          }),
        })),
      }));
    };

    const unsizedK = rows.filter((d) => !sizingValue(sizeSample(d))).length;
    return {
      regimes,
      scheme: PRIMARY_SCHEME,
      schemeVersion: SIZING_SCHEME_VERSIONS[PRIMARY_SCHEME],
      altScheme: ALT_SCHEME,
      altSchemeVersion: SIZING_SCHEME_VERSIONS[ALT_SCHEME],
      k: rows.length,
      sizedK: rows.length - unsizedK,
      unsizedK,
      shrunk: true,
      thin: rows.length < SIZING_PRIOR_WEIGHT,
      parent: `${action}@card`,
      parentN,
      priorWeight: SIZING_PRIOR_WEIGHT,
      // CLASS IS SET BY WHERE THE NUMBER ENDS UP, not by where it was computed. `p` is a
      // decision input and may be consumed as one; the moment it is displayed, cited or
      // compared it has changed class and must carry the shrunk flag or refuse.
      classNote: 'decision input — `p` is a posterior mean shrunk toward the parent, `pRaw` is the '
        + 'raw rate, `k`/`n` are counts. If a consumer SHOWS or CITES one of these it has become a '
        + 'comparative claim and must carry `shrunk` on its face or refuse (sparsity-refuse-or-shrink.md).',
      bands: armBands(PRIMARY_SCHEME),
      altBands: armBands(ALT_SCHEME),
      /**
       * WS-552 — the induced SIZING rules, one entry per (regime) stratum, hanging off the same
       * `sizing` block rather than in a parallel structure. A second home for a size on this card
       * would be a second axis nothing forces to agree with the first, and that is exactly the
       * shape WS-291 survived inside for the life of the project.
       *
       * These sub-rule bands sum to the SUB-RULE's own n, not to the action's k — the strata
       * partition only the SIZED decisions of this action, since unsized rows are held out of
       * the search. `unsizedExcluded` on each stratum is what keeps that visible.
       */
      subRules: armSubRules(PRIMARY_SCHEME),
      altSubRules: armSubRules(ALT_SCHEME),
    };
  };

  const mixes = ordered.map((r) => buildMix({
    ruleId: ruleId(r),
    when: r.conds.map((c) => c.value).join(' AND ') || 'everything else',
    n: r.n,
    actions: r.mix.dist.map(([action, k]) => ({
      action,
      k,
      ci: wilson(k, r.n),
      // `r.mix.dist` is a straight tally over `r.pool` by action (mixTest.mjs:153-155), so this
      // filter recovers exactly those k decisions. `buildMix` throws if it ever does not.
      sizing: buildSizing(r.pool.filter((d) => d.action === action), action, r),
    })),
    verdict: r.verdict,
    separators: (r.mix.separators || []).slice(0, 5).map((s) => ({ feature: s.feature, p: s.pAdj })),
    shown: r.pool.filter((d) => d.handKnown)
      .map((d) => ({ cards: d.holeCards.join(''), action: d.action, street: d.street })),
    streets: r.pool.reduce((m, d) => { m[d.street] = (m[d.street] || 0) + 1; return m; }, {}),
  }));

  /**
   * THE ENCLOSURE CLAUSE — and the branch that used to find the wrong rule is deleted.
   *
   * The old code searched for a leaf whose path contained the literal `everything else` and
   * called it the fallback. But `everything else` is a branch label at an INTERNAL node — the
   * pooled remainder of the siblings at that split — not a root-level catch-all. Scanning
   * n-descending therefore returned the LARGEST leaf carrying that label anywhere on its path.
   * Measured: villain 2 declared `r08`, a 330-decision c-bet rule, as its enclosure clause,
   * while the real catch-all (n=25) sat unnamed; villain 1 declared a 34-decision leaf, 1.0%
   * of his decisions, as the fallback for 3,386.
   *
   * There is no need to guess, because the property is now PROVEN rather than assumed: the
   * round-trip gates in `profileVillain` check that every decision matches exactly one rule
   * and that each rule re-derives its own decision counts. A partition needs no fallback, and
   * saying so is more honest than naming a rule that is not one.
   */
  const residual = {
    ruleId: mixes[mixes.length - 1].ruleId,
    kind: 'partition-is-total',
    note: 'The induced leaves partition every decision this card was built from, so the ruleset '
      + 'is enclosed by the partition rather than by a named fallback. This is CHECKED, not '
      + 'assumed: the round-trip gates verify that every decision matches exactly one rule and '
      + 'that each rule re-derives its own action counts. Off-support is a property of decisions '
      + 'the card never saw and is reported separately.',
  };

  const unresolved = mixes
    .filter((m) => m.verdict === 'hidden-cond' || m.verdict === 'needs-cards')
    .map((m) => ({
      ruleId: m.ruleId,
      verdict: m.verdict,
      resolvedBy: m.verdict === 'needs-cards'
        ? 'the range-inference layer — the discriminating fact is his holding, and no amount of additional corpus supplies it'
        : `sample: ${m.separators[0]?.feature ?? 'a named feature'} separates this leaf but every cut lands under the minimum-rule floor`,
    }));

  // OCCUPANCY — the situations he actually lived through. Bounds every downstream claim,
  // because the card is silent outside it and a best response would exploit the silence.
  const occupancy = {
    unit: 'decision',
    total: decisions.length,
    byStreet: decisions.reduce((m, d) => { m[d.street] = (m[d.street] || 0) + 1; return m; }, {}),
    byFacing: decisions.reduce((m, d) => { m[d.facing] = (m[d.facing] || 0) + 1; return m; }, {}),
    note: 'The card describes only these situations. A best-response computed outside this occupancy measures the card\'s holes, not the subject\'s weakness.',
  };

  // The ruleset as an identity: the sorted set of predicate ids. Order-independent, so two
  // runs that find the same spots in a different order produce the same hash.
  const rulesetHash = createHash("sha256")
    .update(mixes.map((m) => m.ruleId).sort().join("|")).digest("hex");

  const dealBookHash = dealBookHashOf(files);

  /**
   * ═════════════════════════════════════════════════════════════════════════════════════
   * cardId IS CONTENT IDENTITY: (subject, ruleset, deal book). MEASURED COLLISION, TWICE.
   * ═════════════════════════════════════════════════════════════════════════════════════
   *
   * Round one: `cardId` was a slug of the SUBJECT alone, so every re-derivation carried the
   * same one — five cards in `.tmp-arch/` with 19, 25, 18, 18 and 25 rules from five engine
   * commits, all claiming to be `CC-SO0OmHLLvkJp`. The ruleset hash was added to fix it.
   *
   * Round two, MEASURED 2026-08-21 across twelve real sessions: it was still colliding, and
   * the ruleset hash could not have caught it because the ruleset was identical. The slug
   * `subjectId.slice(0, 12)` truncated `hero-sess-20260615-013317-table_1781487173384001`
   * down to `herosess2026` — cutting off precisely the segment that names the session. Two
   * sessions, two different cards, one id:
   *
   *     CC-herosess2026-643d1dd2   <- June 15 AND June 19
   *     CC-seat8s1-643d1dd2        <- seat 8 in two sessions, i.e. two different humans
   *
   * The lesson the first fix missed: a READABLE PREFIX IS NOT AN IDENTITY. Any fixed-width
   * slug of an unbounded string collides, and it collides silently — a store keyed on this
   * overwrites rather than errors.
   *
   * So the id now hashes the FULL subject, and the deal book joins the ruleset in the
   * identity. Two cards share an id if and only if they describe the same subject, under the
   * same rules, from the same hands — which is what "the same card" means. The readable
   * prefix is kept in front for a human reading a filename, and carries no identity load.
   */
  const identityHash = createHash('sha256')
    .update([subjectId, rulesetHash, dealBookHash].join(' '))
    .digest('hex');

  const card = buildConductCard({
    cardId: `CC-${subjectId.replace(/[^A-Za-z0-9]/g, '').slice(0, 12)}-${identityHash.slice(0, 16)}`,
    rulesetHash,
    subjectId,
    dealBook: {
      dealBookHash,
      files: files.length,
      hands: handIds.size,
      decisions: decisions.length,
    },
    evidence: {
      decisions: decisions.length,
      revealedDecisions: shown.length,
      revealedShare: shown.length / decisions.length,
      shownHands: new Set(shown.map((d) => d.handId)).size,
      voluntarilyEnteredShown,
    },
    rules: mixes,
    residual,
    unresolved,
    // ARITY 1 IS THE HONEST VALUE AND IT IS THE POINT OF THE FIELD. `classifyLeaf` tests
    // features one at a time; on 2026-08-18 an independent search over 113,704 OR-combinations
    // refuted a mix verdict this search had produced. Declaring the arity is what keeps "no
    // separator found" from being read as "no separator exists".
    separatorSearch: {
      arity: 1,
      correction: 'bonferroni, one family of m observable features plus the card test',
      /**
       * MEASURED FROM THE RUN, not typed. The family size is the number of hypotheses the
       * verdict was actually chosen among, and it moved on 2026-08-19 when the card test was
       * brought inside the same correction as the features it competes with. Before that the
       * features were corrected and the card test was not, so a separator at raw p=0.012 could
       * lose to a card test at p=0.032 and the leaf would be published as "only his cards
       * resolve it" - the one verdict that says more corpus cannot help.
       */
      familySize: (() => {
        const sizes = ordered.map((r) => r.mix?.family).filter((x) => Number.isFinite(x));
        if (!sizes.length) return null;
        return { min: Math.min(...sizes), max: Math.max(...sizes), leaves: sizes.length };
      })(),
      alpha: induction.alpha,
      combinationsSearched: false,
      note: 'Single features only, each leaf corrected over its own family of testable features plus the card test. A disjunction of three conditions refuted one of these verdicts at corrected p=0.024 on 2026-08-18, so every mix here is provisional until the search covers combinations. Separately, on 2026-08-19 analysts given single leaves blind found observable separators in two spots this arity-1 search had labelled needs-cards.',
    },
    induction,
    gates,
    occupancy,
    manifest: {
      engineCommit: git(['rev-parse', 'HEAD'], 'unknown'),
      engineDirty: git(['status', '--porcelain'], '') !== '',
      dealBookHash: dealBookHashOf(files),
      schemaVersion: SCHEMA_VERSION,
      seeds: {},
      // A POSITIVE CLAIM of bit-reproducibility: the induction draws no randomness at all, so
      // an empty list here is a statement rather than an omission.
      unseededSources: [],
      constants: induction,
      constantFloorNote: 'The Result Card REQUIRED_CONSTANTS are engine-model constants and this induction consumes none of them; stamping them would assert a dependence that does not exist. These four fully determine the rule count.',
    },
    // AWAITED. `registerVersion` is async; calling it bare stamped a Promise, and the card
    // validator caught it on the first live run — which is what the validator is for.
    disclaimerRegisterVersion: await registerVersion(),
    /**
     * THE SIZE AXIS, ON THE CARD.
     *
     * Not a pointer to `sizingBands.mjs`: the full boundary table rides here, so a stored card
     * can never be silently re-based by a later lattice change. A card carrying only
     * `{scheme:'S2', version:1}` still reads wrong under a build whose S2 means something else,
     * and the reader has no way to notice — which is WS-291's mechanism (a wrong number that
     * never has to meet a right one) reproduced in miniature.
     *
     * BOTH ARMS SHIP, per `.claude/rules/unmeasured-constants.md`: a banding is a constant that
     * has not been proven, so the estimate and the alternative both run and the DELTA between
     * them is a reported result rather than a diagnostic glanced at once. Same decisions, same
     * sizes, same shrinkage — the arms differ only in the boundaries, so the delta measures the
     * constant and not the setup. A delta of zero is a finding: it says the banding is not
     * load-bearing on this path. Neither arm is the answer by default; `primary` is a declared
     * choice a downstream consumer may override, never an implicit default that drifts.
     */
    sizingBanding: sizedDecisions.length === 0 ? null : {
      primary: PRIMARY_SCHEME,
      arms: SCHEMES.map((scheme) => ({
        ...bandingDeclaration(scheme),
        resolution: armResolution(sizedDecisions.map(sizeSample), scheme),
      })),
      delta: armComparison(sizedDecisions.map(sizeSample), { primary: PRIMARY_SCHEME, alt: ALT_SCHEME }),
      /**
       * WS-552 — HOW HARD THE CARD LOOKED FOR A SIZING RULE, and what it found.
       *
       * The exact counterpart of `separatorSearch` one level up, and required for the same
       * reason: without it, "no sizing rules on this card" reads as "his sizing does not vary"
       * when it may only mean "every stratum sat under the floor". The per-stratum outcomes are
       * on each action's `sizing.subRules`; this is the card-level summary of the same facts.
       *
       * BOTH ARMS, and the delta between them is STRUCTURAL rather than scalar: the induction's
       * target labels come from the banding, so a different lattice can produce a different set
       * of rules, not merely different counts in the same cells. `armsAgree` is the honest
       * one-line answer to "did the banding decide the finding".
       */
      induction: {
        arms: Object.fromEntries(SCHEMES.map((scheme) => [scheme, {
          ...sizingInduction[scheme].summary,
          search: sizingInduction[scheme].search,
        }])),
        primary: PRIMARY_SCHEME,
        delta: {
          split: sizingInduction[ALT_SCHEME].summary.split - sizingInduction[PRIMARY_SCHEME].summary.split,
          sizingRules: sizingInduction[ALT_SCHEME].summary.sizingRules
            - sizingInduction[PRIMARY_SCHEME].summary.sizingRules,
          sign: `positive = ${ALT_SCHEME} finds MORE than ${PRIMARY_SCHEME}`,
          armsAgree: JSON.stringify(sizingInduction[PRIMARY_SCHEME].summary.features)
            === JSON.stringify(sizingInduction[ALT_SCHEME].summary.features),
          note: 'A delta of zero is a finding: it says the banding did not decide which sizing '
            + 'rules exist, only how their cells are counted. A non-zero delta promotes the '
            + 'banding from a recording convention to a load-bearing modelling choice.',
        },
      },
      shrinkage: {
        operation: 'shrink-toward-parent',
        why: 'A sizing band is a DECISION INPUT feeding a simulator\'s transition function, never '
          + 'a displayed comparative claim, so `.claude/rules/sparsity-refuse-or-shrink.md` says shrink '
          + 'rather than refuse. Refusal is the right operation where a band reaches a human (a ranked '
          + 'spot list, a Guide); class is set by where the number ENDS UP, which is why every band '
          + 'carries `shrunk` and every block carries `classNote`.',
        estimator: 'posterior mean (k + m*qParent) / (n + m), applied UNIFORMLY rather than only '
          + 'below the floor — a threshold-triggered shrink puts a discontinuity at n = m and makes '
          + 'a cell at n = 24 and a cell at n = 26 incomparable in a way nothing on the card shows',
        priorWeight: SIZING_PRIOR_WEIGHT,
        priorWeightSource: 'induceCore.mjs MIN_RULE_DEFAULT — the repo\'s own minimum leaf size, reused rather than re-chosen',
        chain: 'cell (rule, action, regime, band) -> action across this card -> all sized actions on this card',
        thinAt: SIZING_PRIOR_WEIGHT,
        note: 'A zero band keeps a NON-ZERO estimate on purpose: a simulator must not assign '
          + 'probability zero to a size this player demonstrably uses elsewhere merely because one '
          + 'leaf never contained it.',
      },
      conventions: {
        [SIZING_REGIMES.PREFLOP_BB]: 'raise-TO, cumulative for the street, in big blinds (decisionLabeler myRaiseToBB)',
        [SIZING_REGIMES.POSTFLOP_POT_FRACTION]: 'raise-TO over the pot INCLUDING the live bet (myRaiseToBB / potBB). '
          + 'Named rather than assumed: decisionLabeler deleted a field that conflated this with the '
          + 'INCREMENTAL cost under a legend saying only "as a fraction of the pot". Raise-to is the '
          + 'right numerator for a transition function — the environment needs where the chips go, not '
          + 'this player\'s share of getting them there. The two coincide except where he already had '
          + 'chips in on the street (12 of 570 postflop aggressive actions on villain 2).',
        excluded: 'my_bet_x_pot as it stands in the ARCHIVED v2 TSVs — that column divided by '
          + 'potBB - myBet, subtracting his own bet from a pot that never contained it (median 350, '
          + 'max 15,900). Fixed in decisionLabeler on 2026-08-19; the archived cards predate the fix.',
      },
      knownLimitation: 'S2 v2 split the v1 `>=8` tail after measurement showed it carried '
        + '8,325,235 of 8,327,391 preflop sum-of-squares — essentially ALL the reconstruction error '
        + '— with 121 of its 191 observations at exactly 12bb. Preflop RMSE fell 8.68 -> 2.50 bb. '
        + 'STILL MERGED, and named rather than hidden: (a) `12.25-79` pools 4-bets (13-19bb, 32 obs) '
        + 'with large 3-bets and mid shoves (23-58bb, 20 obs) at RMSE 11.17 — the same '
        + 'different-actions argument applies again, and it is not split because no comparable gap '
        + 'exists there, so any edge would be fitted rather than found; (b) `>=79` is a SIZE PROXY '
        + 'for "he is all-in", not an all-in flag, and at a different stack depth the proxy is '
        + 'wrong with nothing here to notice. Per-band `shape` makes both inspectable.',
      declaredBy: 'scripts/villainArchetype/sizingBands.mjs',
    },
    population,
    provenance: provenanceOf(
      sourcePaths || files.map((f) => (typeof f === 'string' ? f : f.path)),
      decisions,
    ),
  });

  card.contentHash = `sha256:${createHash('sha256').update(canonical(card)).digest('hex')}`;
  return card;
};
