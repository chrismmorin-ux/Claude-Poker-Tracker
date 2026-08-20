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

const purity = (pool) => {
  const t = new Map();
  for (const d of pool) t.set(d.action, (t.get(d.action) || 0) + 1);
  const best = [...t.entries()].sort((a, b) => b[1] - a[1])[0];
  return { action: best[0], k: best[1], n: pool.length, pure: best[1] === pool.length, tally: t };
};

const entropy = (pool) => {
  const t = new Map();
  for (const d of pool) t.set(d.action, (t.get(d.action) || 0) + 1);
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

export const induce = (decisions, {
  minRule = MIN_RULE_DEFAULT, rangeMax = RANGE_MAX_DEFAULT, maxDepth = MAX_DEPTH_DEFAULT,
  alpha = 0.05, requireSignificance = true,
} = {}) => {
  const FEATURES = buildFeatures();

  const build = (pool, depth, used) => {
    const p = purity(pool);

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
    if (!used.has('can_raise')) {
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
      const after = branches.reduce((s, [, sub]) => s + (sub.length / pool.length) * entropy(sub), 0);
      const gain = entropy(pool) - after;
      if (gain <= 0.01) continue;

      // FOUNDER 2026-08-18, the mix shape: a split must be SIGNIFICANT, not merely positive.
      // `gain > 0.01` is satisfiable by noise at every node, so the old stopping rule was
      // "keep cutting until you run out of depth" - which manufactures structure and then
      // charges it to the villain as a rule. G is the likelihood-ratio statistic for exactly
      // the quantity being maximised here (G = 2 * n * ln2 * gain), so the test and the
      // objective are the same function; judging one by the other would be incoherent.
      const G = 2 * pool.length * Math.LN2 * gain;
      const df = (branches.length - 1) * (new Set(pool.map(d => d.action)).size - 1);
      const pAdj = Math.min(1, chiSqP(G, df) * Math.max(1, testable));
      if (requireSignificance && !(pAdj < alpha)) continue;

      if (!best || gain > best.gain) best = { fname, branches, gain, G, df, pAdj };
      }
    }
    if (!best) return { leaf: true, pool };
    return { leaf: false, feature: best.fname,
      children: best.branches.map(([value, sub]) => ({ value, node: build(sub, depth + 1, new Set([...used, best.fname])) })) };
  };

  const leaves = [];
  const walk = (node, path, used) => {
    if (node.leaf) {
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
      const condValues = path.map((c) => {
        const vals = new Set();
        for (const d of node.pool) {
          const v = toRow(d)[c.feature];
          if (v !== '-' && v != null) vals.add(String(v));
        }
        return { feature: c.feature, value: c.value, values: [...vals].sort(), constant: vals.size === 1 };
      });
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
      const predicate = path.map((c) => ({
        feature: c.feature,
        op: c.value === 'everything else' ? 'else' : (c.value.startsWith('not ') ? 'not' : 'eq'),
        value: c.value.startsWith('not ') ? c.value.slice(4) : c.value,
        siblings: c.siblings,
      }));
      leaves.push({ conds: path, condValues, predicate, pool: node.pool, ...p, verdict: mix.verdict, mix,
        // kind is kept so older consumers still parse; verdict is the one that carries meaning.
        kind: p.pure ? 'always' : ((1 - p.k / p.n) <= rangeMax ? 'range' : 'unresolved') });
      return;
    }
    // The sibling branch values travel with each condition: `everything else` and `not X` are
    // defined only relative to the other branches at that node, so a condition that does not
    // carry them cannot be evaluated against a decision the tree never saw.
    const siblings = node.children.map((c) => c.value);
    for (const c of node.children) {
      walk(c.node, [...path, { feature: node.feature, value: c.value, siblings }],
        new Set([...used, node.feature]));
    }
  };
  walk(build(decisions, 0, new Set()), [], new Set());

  const covered = leaves.reduce((s, r) => s + r.n, 0);
  const right = leaves.reduce((s, r) => s + r.k, 0);
  return { rules: leaves, coverage: covered / decisions.length, accuracy: right / covered };
};
