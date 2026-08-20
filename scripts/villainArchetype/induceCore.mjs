/**
 * induceCore — the rule induction, as a function so the procedure can call it.
 *
 * Extracted from `induceRules.mjs` (which stays as the standalone explorer) so that
 * `profileVillain.mjs` runs the SAME induction every time rather than a re-typed variant.
 * The off-the-cuff variants were the quality problem the founder named.
 */
import { SITUATION_FIELDS, toRow } from './decisionSchema.mjs';
import { classifyLeaf, chiSqP, wilson } from './mixTest.mjs';

export { wilson };

export const MIN_RULE_DEFAULT = 25;
export const RANGE_MAX_DEFAULT = 0.25;
export const MAX_DEPTH_DEFAULT = 5;

/** Continuous columns become bands, because a rule has to be sayable out loud. */
const BANDS = {
  price_pct: (v) => v === '-' ? null
    : v < 20 ? 'a very cheap price (<20%)' : v < 28 ? 'a cheap price (20-28%)'
      : v < 36 ? 'a standard price (28-36%)' : v < 45 ? 'a steep price (36-45%)'
        : 'a very steep price (>45%)',
  stack_bb: (v) => v === '-' ? null
    : v < 30 ? 'a short stack (<30bb)' : v < 80 ? 'a medium stack (30-80bb)'
      : v < 150 ? 'a standard stack (80-150bb)' : 'a deep stack (>150bb)',
  spr: (v) => v === '-' ? null
    : v < 3 ? 'SPR under 3' : v < 8 ? 'SPR 3-8' : v < 20 ? 'SPR 8-20' : 'SPR over 20',
  bet_x_pot: (v) => v === '-' ? null
    : v < 0.4 ? 'a small bet (<0.4x pot)' : v < 0.7 ? 'a medium bet (0.4-0.7x)'
      : v <= 1.05 ? 'a pot-sized bet' : 'an overbet',
  invested_bb: (v) => v === '-' ? null
    : v <= 0.01 ? 'nothing in yet' : v <= 1.01 ? 'only my blind in'
      : v < 10 ? 'a few blinds in' : 'heavily invested',
  players: (v) => `${v}-handed`,
  opps_live: (v) => v === '-' ? null : `${v} opponent(s) live`,
  raises_in: (v) => `${v} raise(s) already in`,
  limpers: (v) => v === '-' ? null : (v > 0 ? `${v} limper(s) ahead` : 'no limpers ahead'),
  callers_ahead: (v) => v === '-' ? null : (v > 0 ? `${v} caller(s) already in` : 'nobody has called yet'),
  barrels: (v) => v === '-' ? null : `${v} street(s) of betting behind it`,
  broadways: (v) => v === '-' ? null : `${v} broadway card(s) out`,
  /**
   * ONE LABELLING FOR `can_raise`, used by the structural split AND by the feature map.
   *
   * The structural split below builds its branches straight off `d.canRaise` with the labels
   * "raising is available" / "raising is not available to me", while `buildFeatures` produced
   * "can raise = yes". Two representations of one fact, and they never had to agree — until the
   * predicate had to be evaluated, at which point EVERY decision failed to match its own rule
   * (1,937 of 1,937), because the card said one string and the evaluator computed the other.
   *
   * Putting the labelling here means both paths read it from one place.
   */
  can_raise: (v) => (v === 'yes' ? 'raising is available'
    : v === 'no' ? 'raising is not available to me' : null),
  to_call_bb: () => null,     // subsumed by price and bet size
  pot_bb: () => null,         // subsumed by SPR
  high_card: () => null,      // too granular to stand as a rule
  hand: () => null,
};

/** Positional re-encodings are preflop-only; postflop they must collapse to in/out of position. */
const PREFLOP_ONLY = ['seat_pos', 'off_button', 'to_act_after', 'acted_before',
  'is_blind', 'is_late', 'blind_v_blind', 'limpers', 'first_in'];

const buildFeatures = () => Object.fromEntries(SITUATION_FIELDS.map((name) => [name, (d) => {
  const row = toRow(d);
  if (PREFLOP_ONLY.includes(name)) {
    if (row.street !== 'preflop') return null;
  } else if (name === 'in_pos' && row.street === 'preflop') return null;
  const raw = row[name];
  if (raw === '-' || raw == null) return null;
  if (Object.prototype.hasOwnProperty.call(BANDS, name)) return BANDS[name](raw);
  return `${name.replace(/_/g, ' ')} = ${raw}`;
}]));

/**
 * ────────────────────────────────────────────────────────────────────────────────────────────
 * TWO TARGETS (WS-552) — and why the tree machinery below is parameterised on the label.
 * ────────────────────────────────────────────────────────────────────────────────────────────
 *
 * Until 2026-08-20 this file predicted exactly one thing: WHICH action. `purity` and `entropy`
 * both read `d.action` and nothing else, so a leaf where the villain ALWAYS bets stopped at
 * `p.pure` (below) before a single feature was tested — whatever he was doing with the amount.
 *
 * That is not a cosmetic gap. WS-552, measured on villain 1: his single most reliable rule is a
 * SIZING rule — "4bb base, 3bb only from the button or small blind into an unopened pot, plus
 * 1bb per limper" — firing on 104 of 111 opening raises, and the induction could not express it.
 * It is also the only rule on his card that needs NO hole cards, so it escapes the 94.4% card
 * shortage entirely: the highest-evidence thing about him was the one thing the model was blind
 * to. The interpretive trap that hid it is worth naming, because it nearly closed the ticket:
 * the discount reads as "arithmetic, not a decision" until you notice it is a steal-price vs
 * isolation-price distinction, conditioned entirely on seat. That is strategy.
 *
 * So `labelOf` is now an argument. `ACTION_OF` keeps the original target; `induceSizing` (bottom
 * of this file) passes a band label instead. ONE tree implementation serves both, deliberately:
 * two split searches that never have to agree is the defect this directory has been bitten by
 * repeatedly (`BANDS.can_raise`, `my_bet_x_pot`), and a sizing search with its own hand-rolled
 * floors would drift from the action search's within a month.
 */

/** Tally any label over a pool. One implementation, so `purity` and `entropy` cannot disagree. */
const tallyBy = (pool, labelOf) => {
  const t = new Map();
  for (const d of pool) { const v = labelOf(d); t.set(v, (t.get(v) || 0) + 1); }
  return t;
};

/** The original target: what he did. */
const ACTION_OF = (d) => d.action;

const purity = (pool, labelOf = ACTION_OF) => {
  const t = tallyBy(pool, labelOf);
  const best = [...t.entries()].sort((a, b) => b[1] - a[1])[0];
  // `action` is kept as the name for the original consumers (`profileVillain`, `scoreHeldOut`,
  // `dumpLeaf` all read `r.action`); `label` is the target-neutral name the sizing pass uses.
  return { action: best[0], label: best[0], k: best[1], n: pool.length, pure: best[1] === pool.length, tally: t };
};

const entropy = (pool, labelOf = ACTION_OF) => {
  const t = tallyBy(pool, labelOf);
  let h = 0;
  for (const [, c] of t) { const p = c / pool.length; h -= p * Math.log2(p); }
  return h;
};

/**
 * The feature map, exported so a consumer can EVALUATE a card's predicates against decisions
 * the induction never saw. Without it the predicate is uninterpretable: `"a steep price
 * (36-45%)"` is produced by `BANDS.price_pct`, and only this map knows that.
 */
export const featureMap = () => buildFeatures();

/**
 * GROW ONE TREE — the split search, once, for whichever target `labelOf` names.
 *
 * Lifted out of `induce` unchanged (WS-552) so the sizing search runs the SAME floors, the same
 * partition candidates and the same corrected G-test rather than a re-typed variant. The only
 * new parameters are the ones a second target genuinely needs:
 *
 *   labelOf             what is being predicted. `ACTION_OF` reproduces the original behaviour.
 *   structuralCanRaise  the exempt can_raise pre-split, which is a well-definedness constraint
 *                       on an ACTION MIX and has no analogue for a size (see `induceSizing`).
 *   seedUsed            features already spent by an enclosing search, so a nested pass cannot
 *                       re-condition on a clause its parent leaf already carries.
 *   extraFamily         an outer multiple-comparison family this tree is one member of. The
 *                       action search corrects within a node only; the sizing search runs over
 *                       many strata that were all chosen among, so it carries the stratum count.
 */
const growTree = ({
  pool: root, labelOf = ACTION_OF, features: FEATURES, minRule, maxDepth, alpha,
  requireSignificance, structuralCanRaise = false, seedUsed = null, extraFamily = 1,
}) => {
  const build = (pool, depth, used) => {
    const p = purity(pool, labelOf);

    /**
     * STRUCTURAL SPLIT, taken before anything is measured and exempt from every floor.
     *
     * A mix is a distribution over the actions he chose among. If some rows in the pool did
     * not HAVE one of those actions available, the mix is not a coherent distribution — it
     * reports him "declining to raise" in spots where raising did not exist. That is a
     * well-definedness constraint, not a pattern to be discovered, so it must not be subject
     * to the minimum-n floor or the significance test: those exist to stop overfitting, and
     * there is nothing to overfit in "this action was not on the menu".
     *
     * Measured on villain 1: the heavily-invested leaf holds 33 decisions of which 9 could
     * not raise. Pooled it reads call 52 / fold 27 / raise 21. Split, the 24 real decisions
     * read fold 33 / call 38 / raise 29, and the 9 forced ones are 8 calls and a fold. The
     * "calls about half" figure was an artifact of counting forced continuations as choices.
     * Found by an agent reading the leaf cold; the induction had no way to see it.
     */
    if (structuralCanRaise && !used.has('can_raise')) {
      const groups = new Map();
      let complete = true;
      for (const d of pool) {
        if (d.canRaise == null) { complete = false; break; }
        // Read from BANDS, never re-typed here — see the note on BANDS.can_raise.
        const key = BANDS.can_raise(d.canRaise ? 'yes' : 'no');
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(d);
      }
      if (complete && groups.size === 2) {
        return { leaf: false, feature: 'can_raise', structural: true,
          children: [...groups.entries()].map(([value, sub]) => ({
            value, node: build(sub, depth, new Set([...used, 'can_raise'])) })) };
      }
    }

    if (p.pure || depth >= maxDepth || pool.length < minRule * 2) return { leaf: true, pool };

    // How many features are even testable here. Bonferroni denominator for the split test:
    // with ~45 candidate features, an uncorrected 0.05 finds two "significant" splits per node
    // in pure noise, which is exactly how a ruleset inflates while describing nothing new.
    let testable = 0;
    for (const [fname, fn] of Object.entries(FEATURES)) {
      if (used.has(fname)) continue;
      const vals = new Set();
      let complete = true;
      for (const d of pool) { const v = fn(d); if (v == null) { complete = false; break; } vals.add(v); }
      if (complete && vals.size >= 2) testable++;
    }

    let best = null;
    for (const [fname, fn] of Object.entries(FEATURES)) {
      if (used.has(fname)) continue;
      const groups = new Map();
      let skip = false;
      for (const d of pool) {
        const v = fn(d);
        if (v == null) { skip = true; break; }
        if (!groups.has(v)) groups.set(v, []);
        groups.get(v).push(d);
      }
      if (skip || groups.size < 2) continue;

      /**
       * CANDIDATE PARTITIONS OF THIS FEATURE.
       *
       * The multi-way split is first, and used to be the only one — which meant a single rare
       * value could VETO ITS OWN FEATURE. Measured on villain 1: the leaf `a few blinds in AND
       * initiative = no AND closes = yes` (n=85) splits on `facing` into 49 / 24 / 12. Facing
       * no bet he bets 7 and checks 5 and never folds; facing a bet he folds 24, calls 18,
       * raises 7. Those are not the same player. The feature was dropped because the third
       * branch held 12 decisions, and the leaf was then reported as unresolved — a real,
       * strongly separating condition (p = 3e-11) discarded by a floor meant to stop
       * overfitting, and charged to the villain as a mystery.
       *
       * So each value that clears the floor also gets a ONE-VS-REST binary partition. `a bet`
       * (49) against the other 36 is a legal split where the three-way was not. The floor still
       * does its job: every branch of every candidate must hold at least `minRule` decisions.
       */
      const partitions = [];
      const big = [...groups.entries()].filter(([, sub]) => sub.length >= minRule);
      if (big.length >= 2) {
        const small = [...groups.entries()].filter(([, sub]) => sub.length < minRule)
          .flatMap(([, sub]) => sub);
        const branches = big.map(([v, sub]) => [v, sub]);
        if (small.length >= minRule) { branches.push(['everything else', small]); partitions.push(branches); }
        else if (!small.length) partitions.push(branches);
      }
      if (groups.size > 2) {
        for (const [v, sub] of groups) {
          const rest = [...groups.entries()].filter(([v2]) => v2 !== v).flatMap(([, s]) => s);
          if (sub.length >= minRule && rest.length >= minRule) {
            partitions.push([[v, sub], [`not ${v}`, rest]]);
          }
        }
      }

      for (const branches of partitions) {
      const after = branches.reduce((s, [, sub]) => s + (sub.length / pool.length) * entropy(sub, labelOf), 0);
      const gain = entropy(pool, labelOf) - after;
      if (gain <= 0.01) continue;

      // FOUNDER 2026-08-18, the mix shape: a split must be SIGNIFICANT, not merely positive.
      // `gain > 0.01` is satisfiable by noise at every node, so the old stopping rule was
      // "keep cutting until you run out of depth" - which manufactures structure and then
      // charges it to the villain as a rule. G is the likelihood-ratio statistic for exactly
      // the quantity being maximised here (G = 2 * n * ln2 * gain), so the test and the
      // objective are the same function; judging one by the other would be incoherent.
      const G = 2 * pool.length * Math.LN2 * gain;
      const df = (branches.length - 1) * (new Set(pool.map(labelOf)).size - 1);
      // `extraFamily` is 1 for the action search, which preserves its behaviour exactly. The
      // sizing search sets it to the number of strata it chose among — see `induceSizing`.
      const pAdj = Math.min(1, chiSqP(G, df) * Math.max(1, testable) * Math.max(1, extraFamily));
      if (requireSignificance && !(pAdj < alpha)) continue;

      if (!best || gain > best.gain) best = { fname, branches, gain, G, df, pAdj };
      }
    }
    if (!best) return { leaf: true, pool };
    return { leaf: false, feature: best.fname, gain: best.gain, G: best.G, df: best.df, pAdj: best.pAdj,
      children: best.branches.map(([value, sub]) => ({ value, node: build(sub, depth + 1, new Set([...used, best.fname])) })) };
  };

  return build(root, 0, new Set(seedUsed || []));
};

/**
 * WALK A TREE TO ITS LEAVES, carrying the path, the sibling sets and the spent features.
 *
 * Extracted with `growTree` and for the same reason. The sibling branch values travel with each
 * condition because `everything else` and `not X` are defined only relative to the other
 * branches at that node — a condition that does not carry them cannot be evaluated against a
 * decision the tree never saw, which is what made an earlier label-only card unrunnable.
 */
const walkTree = (root, onLeaf) => {
  const rec = (node, path, used) => {
    if (node.leaf) { onLeaf(node.pool, path, used); return; }
    const siblings = node.children.map((c) => c.value);
    for (const c of node.children) {
      rec(c.node, [...path, { feature: node.feature, value: c.value, siblings }],
        new Set([...used, node.feature]));
    }
  };
  rec(root, [], new Set());
};

/**
 * The two forms a path takes on a leaf: the RAW values behind each band label (so a rule cannot
 * read as a condition it is not) and the machine-evaluable PREDICATE. Shared by both searches.
 */
const condValuesOf = (path, pool) => path.map((c) => {
  const vals = new Set();
  for (const d of pool) {
    const v = toRow(d)[c.feature];
    if (v !== '-' && v != null) vals.add(String(v));
  }
  return { feature: c.feature, value: c.value, values: [...vals].sort(), constant: vals.size === 1 };
});

/**
 * Three operators, because the tree makes three kinds of branch:
 *   eq    the decision's value for this feature equals `value`
 *   not   it is anything except `value`      (the one-vs-rest split)
 *   else  it is none of `siblings`           (the pooled small groups)
 */
const predicateOf = (path) => path.map((c) => ({
  feature: c.feature,
  op: c.value === 'everything else' ? 'else' : (c.value.startsWith('not ') ? 'not' : 'eq'),
  value: c.value.startsWith('not ') ? c.value.slice(4) : c.value,
  siblings: c.siblings,
}));

export const induce = (decisions, {
  minRule = MIN_RULE_DEFAULT, rangeMax = RANGE_MAX_DEFAULT, maxDepth = MAX_DEPTH_DEFAULT,
  alpha = 0.05, requireSignificance = true,
} = {}) => {
  const FEATURES = buildFeatures();

  const leaves = [];
  const onLeaf = (poolAtLeaf, path, used) => {
    {
      const node = { pool: poolAtLeaf };
      const p = purity(node.pool);
      // The mix verdict REPLACES the old `rangeMax` cut. That threshold decided "his range"
      // vs "a wrinkle" on residue size alone, which is a number, not a finding: a 26% residue
      // and a 24% residue got opposite verdicts for no reason anyone could state. The verdict
      // now says WHY the leaf is impure, and each answer is separately actionable.
      const mix = classifyLeaf(node.pool, FEATURES, used, { alpha });
      /**
       * THE RAW VALUES BEHIND EACH BAND LABEL, so a rule cannot read as a condition it is not.
       *
       * A band name describes a RANGE; if only one value in that range ever occurs, the rule
       * says he responds to something that never varied. Measured on villain 1: four rules are
       * headed "a steep price (36-45%)" and `price_pct` takes exactly two values across all
       * 1,291 first-in preflop rows - 40 for everyone, 25 for the small blind, both fixed by the
       * blind structure. So "a steep price" denotes "I am not the small blind", and reads as
       * price sensitivity in a spot where no one has bet.
       *
       * Printing the values makes the degenerate case self-evident without guessing which
       * feature the reader should have been shown instead.
       */
      const condValues = condValuesOf(path, node.pool);
      /**
       * THE PREDICATE — the same conditions as `conds`, in a form a machine can evaluate.
       *
       * `conds` carries only the branch LABEL ("a steep price (36-45%)", "not 4 opponent(s)
       * live", "everything else"). A label is enough to render a sentence and not enough to
       * decide whether an unseen decision falls in this leaf, so the card built from it can be
       * read and cannot be RUN: no held-out score, no replay, no simulation, no diff between
       * two runs. Every downstream use is a composition with the state->rule map, and that map
       * was being discarded at the last step while the data to build it sat on the node.
       *
       * Three operators, because the tree makes three kinds of branch:
       *   eq    the decision's value for this feature equals `value`
       *   not   it is anything except `value`      (the one-vs-rest split)
       *   else  it is none of `siblings`           (the pooled small groups)
       *
       * `siblings` is the full branch set at that node, carried because `else` and `not` are
       * meaningless without it — which is precisely why a label-only card cannot be evaluated.
       */
      const predicate = predicateOf(path);
      leaves.push({ conds: path, condValues, predicate, pool: node.pool, ...p, verdict: mix.verdict, mix,
        // kind is kept so older consumers still parse; verdict is the one that carries meaning.
        kind: p.pure ? 'always' : ((1 - p.k / p.n) <= rangeMax ? 'range' : 'unresolved') });
    }
  };
  walkTree(growTree({
    pool: decisions, labelOf: ACTION_OF, features: FEATURES,
    minRule, maxDepth, alpha, requireSignificance, structuralCanRaise: true,
  }), onLeaf);

  const covered = leaves.reduce((s, r) => s + r.n, 0);
  const right = leaves.reduce((s, r) => s + r.k, 0);
  return { rules: leaves, coverage: covered / decisions.length, accuracy: right / covered };
};

// ────────────────────────────────────────────────────────────────────────────────────────────
// THE SECOND TARGET (WS-552) — HOW BIG, searched inside the answer to WHICH.
// ────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Why this is a SECOND PASS over action-homogeneous slices and not one combined objective.
 *
 * The combined objective is the obvious design and it is wrong three separate ways. Make the
 * target the joint `(action, band)` and:
 *
 *   1. IT DOUBLE-COUNTS. A split that genuinely separates actions gets credited with all the
 *      band separation that rides along with it — a leaf split into "he folds" / "he raises"
 *      shows enormous joint gain purely because folds have no size. The gain then attributes to
 *      the situation feature a structure that is a definitional consequence of the action, which
 *      is the same stacking error the repo's first-principles rule names for style adjustments
 *      layered on the stats that define the style (POKER_THEORY §7: labels are outputs of the
 *      decision process, never inputs to it).
 *   2. IT STARVES THE CELLS. `|actions| x |bands|` is 5 x 10 preflop here. WS-578 refused the
 *      joint on exactly this ground when it built the RECORD; building the SEARCH on it would
 *      reintroduce what the record form declined.
 *   3. IT IS UNSAYABLE. "He plays (raise, 3.5bb) 41% of the time" is not a rule a human executes
 *      at a table under the cold-read regime. "He raises here, and when he does it is 3.5" is.
 *
 * The factorisation is the honest form and it costs nothing: P(action, size | situation) =
 * P(action | situation) · P(size | action, situation). The first factor is what `induce` already
 * estimates. The second is what this estimates, and estimating it CONDITIONAL ON THE ACTION is
 * not a modelling nicety — it is the whole double-counting guard, enforced structurally:
 *
 *   **Every stratum this searches contains exactly one action.** `assertHomogeneous` throws if
 *   that is ever false. A gain measured on a set where the action never varies cannot be
 *   attributable to action separation, so the two searches' claims are disjoint by construction
 *   rather than by care. Two rules stacked — one separating actions, one separating sizes within
 *   an action — are two factors of one joint, never two counts of one effect.
 *
 * The cost of this choice, named rather than hidden: a feature that separates ONLY the size and
 * not the action cannot cause an action leaf to exist, so it is searched inside whatever leaf the
 * action search happened to produce. If the action search cut the pool on a feature irrelevant to
 * sizing, the sizing search sees fragments. That is a real loss of power and the combined
 * objective would not have it — it is accepted because the alternative buys that power with an
 * attribution error, and an attribution error is not recoverable downstream.
 *
 * ── STRATIFIED BY REGIME, and this is not tidiness ──
 *
 * An induced leaf genuinely spans streets (villain 2 has leaves carrying `["preflop","flop"]` and
 * `["turn","preflop","flop","river"]`). Preflop sizes are a bb LATTICE and postflop sizes are a
 * POT FRACTION; the two band alphabets are disjoint. Search a mixed pool and `street` wins every
 * time with near-total "gain" — not because he sizes differently by street but because a preflop
 * row CANNOT carry a postflop band name. That is a tautology dressed as a read, and it is exactly
 * the incommensurability `sizingBands.mjs` exists to prevent, arriving through the objective
 * instead of through the record. So: one search per (leaf, action, regime).
 *
 * Inside the postflop stratum `street` stays a legal feature, because there the alphabet IS
 * shared and "two-thirds on the flop, half on the turn" is a genuine and common sizing read.
 */

/** Why a stratum produced no sizing rule. A CLOSED list — a blank is not a finding. */
export const SIZING_STRATUM_OUTCOMES = Object.freeze({
  /** A significant split was found. `leaves` carries it. */
  SPLIT: 'split',
  /** Searched, nothing cleared the corrected threshold. A stated null, not a blank. */
  NO_SIGNIFICANT_SPLIT: 'no-significant-split',
  /**
   * One band carried every observation. NOT a failure — a near-deterministic size is itself an
   * exploitable fact (WS-578 AC5), and there is nothing left for a split to separate.
   */
  SINGLE_BAND: 'single-band',
  /** Too few sized decisions for `minRule` to permit any split. Reported, never silently skipped. */
  BELOW_FLOOR: 'below-floor',
});

/**
 * THE INVARIANT THE DOUBLE-COUNTING ARGUMENT RESTS ON, checked rather than trusted.
 *
 * If this ever throws, the sizing gain being reported is partly action separation and the
 * factorisation above is void. A silent `if` would let that ship; the throw is the point.
 *
 * Stated honestly about what it is: a TRIPWIRE on the stratum-assembly path, not a discovery.
 * Today the rows reaching it were filtered by action three statements earlier, so it cannot fire
 * — which is exactly the state a tripwire should be in. It exists because the tempting future
 * edit is to pool two thin strata to clear the floor, and that edit silently converts every
 * downstream sizing gain into a partly-action-separation number with nothing to notice.
 * Exported so a test can demonstrate the refusal rather than trusting the comment.
 */
export const assertActionHomogeneous = (rows, action) => {
  for (const d of rows) {
    if (d.action !== action) {
      throw new Error(
        `sizing stratum for "${action}" contains a "${d.action}" — the second target is estimated `
        + 'CONDITIONAL on the action, and a mixed stratum makes its gain partly action separation',
      );
    }
  }
};

/**
 * Induce the SIZE rules, given the action rules `induce` already produced.
 *
 * @param {Array} rules      the leaves from `induce`, each carrying `.pool` and `.conds`
 * @param {Object} opts
 * @param {(d:Object) => ({regime:string, band:string}|null)} opts.cellOf
 *   The banded size of one decision, or `null` when no size is derivable. INJECTED rather than
 *   imported: the lattice lives in `sizingBands.mjs`, which imports `MIN_RULE_DEFAULT` from this
 *   file, and closing that cycle would make module-init order load-bearing. It also keeps the
 *   induction independent of which arm it runs under — `emitConductCard` runs it twice, once per
 *   banding arm, because a banding is an unmeasured constant and
 *   `.claude/rules/unmeasured-constants.md` requires both arms and the delta between them.
 * @param {Array<string>} opts.sizedActions  actions that HAVE a size. Others carry no stratum.
 */
export const induceSizing = (rules, {
  cellOf,
  sizedActions = ['bet', 'raise'],
  minRule = MIN_RULE_DEFAULT,
  maxDepth = MAX_DEPTH_DEFAULT,
  alpha = 0.05,
  requireSignificance = true,
} = {}) => {
  if (typeof cellOf !== 'function') {
    throw new Error('induceSizing needs a cellOf(decision) -> {regime, band} | null; see sizingBands.bandFor');
  }
  const FEATURES = buildFeatures();

  /**
   * PASS 1 — enumerate the strata. Done before any test runs because the family size has to be
   * the number of hypotheses that were CHOSEN AMONG, and that number is only knowable up front.
   *
   * `unsized` rows are held OUT of the search and counted separately. A split separating "we
   * could derive his size" from "we could not" would be a rule about OUR pipeline's coverage, not
   * about him — the identical defect `decisionSchema.mjs` fixed by moving `str_basis` out of the
   * situation group after it appeared as a condition on villain 1's second-highest-lift rule. The
   * count rides on the stratum so the exclusion is visible rather than absorbed.
   */
  const eligible = [];
  const catalogue = [];
  rules.forEach((rule, ruleIndex) => {
    for (const action of sizedActions) {
      const all = (rule.pool || []).filter((d) => d.action === action);
      if (!all.length) continue;
      const byRegime = new Map();
      let unsizedExcluded = 0;
      for (const d of all) {
        const cell = cellOf(d);
        if (!cell) { unsizedExcluded += 1; continue; }
        if (!byRegime.has(cell.regime)) byRegime.set(cell.regime, []);
        byRegime.get(cell.regime).push(d);
      }
      for (const [regime, rows] of byRegime) {
        const bandOf = (d) => cellOf(d).band;
        const distinct = new Set(rows.map(bandOf));
        const stratum = {
          ruleIndex,
          rule,
          action,
          regime,
          n: rows.length,
          // Named on every stratum: `unsized` is a fact about our derivation, held out of the
          // search rather than banded, so it must be counted where a reader will see it.
          unsizedExcluded,
          actionK: all.length,
          bandsOccupied: distinct.size,
          dist: [...tallyBy(rows, bandOf).entries()].sort((a, b) => b[1] - a[1]),
          rows,
          bandOf,
          outcome: null,
          leaves: [],
          split: null,
        };
        catalogue.push(stratum);
        if (distinct.size < 2) { stratum.outcome = SIZING_STRATUM_OUTCOMES.SINGLE_BAND; continue; }
        // The same floor the action search uses to decide a pool is splittable at all
        // (`pool.length < minRule * 2`), read from the same constant rather than re-chosen.
        if (rows.length < minRule * 2) { stratum.outcome = SIZING_STRATUM_OUTCOMES.BELOW_FLOOR; continue; }
        eligible.push(stratum);
      }
    }
  });

  /**
   * THE OUTER FAMILY. The action search corrects within a node, over the features testable there,
   * and does not correct across nodes — a convention this pass could simply have copied. It does
   * not, and the reason is that the two searches are differently exposed: the action search tests
   * one family per node it was already committed to visiting, while this one goes looking across
   * every (leaf, action, regime) stratum on the card and reports whichever ones fire. With ~30
   * strata an uncorrected 0.05 manufactures a sizing rule or two out of noise on any card, and a
   * manufactured sizing rule is worse than a missing one: it is the highest-evidence-LOOKING
   * object on the card precisely because it needs no hole cards (WS-552's own premise).
   *
   * So the stratum count multiplies into every p-value, on top of the per-node feature
   * correction. This is deliberately CONSERVATIVE relative to the action search, and the
   * asymmetry is stated rather than smoothed over.
   */
  const extraFamily = Math.max(1, eligible.length);

  const featureUse = new Map();
  for (const stratum of eligible) {
    // The tripwire, on the rows that ACTUALLY reach the search — after the regime grouping, which
    // is the assembly step a later edit is most likely to change.
    assertActionHomogeneous(stratum.rows, stratum.action);
    const tree = growTree({
      pool: stratum.rows,
      labelOf: stratum.bandOf,
      features: FEATURES,
      minRule,
      maxDepth,
      alpha,
      requireSignificance,
      // No `can_raise` pre-split. That exemption exists because an action mix over rows where an
      // action was unavailable is not a coherent distribution. The analogue for a SIZE is the
      // legal sizing interval (min-raise floor below, stack above), and no field records it — so
      // it is named as a limitation on the result rather than faked with a proxy.
      structuralCanRaise: false,
      // The action leaf's own conditions are already spent. Re-splitting on one would produce a
      // sizing rule whose sentence repeats its parent's clause, and it matches the convention the
      // action search already holds (a used feature is never re-tested below itself).
      seedUsed: new Set((stratum.rule.conds || []).map((c) => c.feature)),
      extraFamily,
    });

    if (tree.leaf) { stratum.outcome = SIZING_STRATUM_OUTCOMES.NO_SIGNIFICANT_SPLIT; continue; }

    stratum.outcome = SIZING_STRATUM_OUTCOMES.SPLIT;
    stratum.split = {
      feature: tree.feature, gain: tree.gain, G: tree.G, df: tree.df, pAdj: tree.pAdj, family: extraFamily,
    };
    featureUse.set(tree.feature, (featureUse.get(tree.feature) || 0) + 1);
    walkTree(tree, (pool, path) => {
      const p = purity(pool, stratum.bandOf);
      stratum.leaves.push({
        conds: path,
        condValues: condValuesOf(path, pool),
        predicate: predicateOf(path),
        pool,
        n: pool.length,
        // The MODAL band and its count, so a sizing rule reads the way an action rule does. The
        // full distribution rides beside it because the residue is the policy, exactly as the
        // action residue is the range — a modal label with the rest discarded is what the Conduct
        // Card form already refuses one level up.
        band: p.label,
        k: p.k,
        pure: p.pure,
        dist: [...p.tally.entries()].sort((a, b) => b[1] - a[1]),
      });
    });
  }

  const split = catalogue.filter((s) => s.outcome === SIZING_STRATUM_OUTCOMES.SPLIT);
  const byRule = new Map();
  for (const s of catalogue) {
    if (!byRule.has(s.rule)) byRule.set(s.rule, new Map());
    const perAction = byRule.get(s.rule);
    if (!perAction.has(s.action)) perAction.set(s.action, []);
    perAction.get(s.action).push(s);
  }

  return {
    strata: catalogue,
    byRule,
    summary: {
      strata: catalogue.length,
      eligible: eligible.length,
      split: split.length,
      sizingRules: split.reduce((s, x) => s + x.leaves.length, 0),
      byOutcome: catalogue.reduce((m, s) => { m[s.outcome] = (m[s.outcome] || 0) + 1; return m; }, {}),
      features: Object.fromEntries([...featureUse.entries()].sort((a, b) => b[1] - a[1])),
    },
    search: {
      target: 'the banded size of the action, within the action',
      objective: 'information gain on the band label, G-tested — the same objective and the same '
        + 'statistic the action search uses, so the two are comparable',
      factorisation: 'P(action, size | situation) = P(action | situation) . P(size | action, situation). '
        + 'This estimates the second factor ONLY, on strata where the action is constant, which is '
        + 'what makes it a factorisation rather than a double count.',
      stratification: 'one search per (rule, action, regime). A leaf spans streets, and the preflop '
        + 'bb lattice and the postflop pot fraction have disjoint band alphabets, so a mixed search '
        + 'would report street as a near-total separator by tautology.',
      correction: 'bonferroni over the features testable at each node, TIMES the number of eligible '
        + 'strata — more conservative than the action search, because this pass searches across '
        + 'strata it went looking for rather than nodes it was already visiting',
      strataFamily: extraFamily,
      minRule,
      maxDepth,
      alpha,
      requireSignificance,
      unsizedHeldOut: 'rows with no derivable size are excluded from the search and counted on the '
        + 'stratum. A split separating derivable from underivable would be a rule about our '
        + 'pipeline, which is the str_basis defect decisionSchema already had to remove.',
      knownLimitation: 'No structural pre-split for sizing LEGALITY. The action search exempts '
        + 'can_raise because a mix over rows where an action was unavailable is incoherent; the '
        + 'sizing analogue is the legal interval (min-raise floor, stack ceiling) and no field '
        + 'records it, so a leaf where he was near-capped may read as a sizing preference.',
    },
  };
};
