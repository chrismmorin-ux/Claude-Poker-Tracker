/**
 * induceRules — a decision list that accounts for EVERY decision this villain made.
 *
 * FOUNDER CORRECTION, 2026-08-18, and it reframes the whole measurement:
 *
 *   "We're scoring against the data we built the ruleset on, it's impossible to be
 *    non-predictive unless you're setting rules wrong. ... They HAVE to be 100% predictive,
 *    you can't generate a ruleset from the individual elements without it."
 *
 * The previous pass scored a hand-written ruleset against a majority-class BASELINE, which
 * imported a GENERALISATION standard into a job that needs a DESCRIPTION standard. "If the
 * price is worse than X he folds" is a RULE, not a freebie to be beaten — treating the fold
 * rate as a baseline meant the ruleset had to re-earn the 71% it already explained, and was
 * then declared non-predictive. Backwards.
 *
 * THE RIGHT METRIC. In-sample, 100% coverage and 100% accuracy are REQUIRED, and reachable by
 * construction. What varies, and what actually carries information, is HOW MANY RULES it
 * takes to get there. A ruleset with one rule per decision has memorised the player and
 * describes nothing; a ruleset with twelve rules that covers 1,937 decisions has compressed
 * him, and that compression IS the model. Two villains are compared by lining up their
 * rulesets, never their rates.
 *
 * HOW A RULE IS GROWN (a RIPPER-style decision list). Start from the set of decisions no rule
 * yet covers. Add the single condition that most purifies the covered set, repeat until the
 * set is PURE — every decision in it took the same action — then emit it and remove those
 * decisions. First match governs, so every decision belongs to exactly one rule.
 *
 * WHEN A LEAF WILL NOT PURIFY. Two causes, and they must not be conflated:
 *   MISSING FEATURE  — the discriminating fact exists but is not in the record. Almost always
 *                      the hole cards (visible on 4.70% of seat-hands). Reported as such.
 *   GENUINE MIXING   — the player is not deterministic in that spot.
 * Both are reported as an explicit residue with their composition, never rounded into a
 * majority. An unstated residue is what lets a ruleset claim completeness it has not earned.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { SITUATION_FIELDS, toRow, SCHEMA_VERSION } from './decisionSchema.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;
const MIN_RULE = Number(process.env.MIN_RULE || 25);  // below this, a "rule" is a memorised case
const RANGE_MAX = Number(process.env.RANGE_MAX || 0.25);  // residue above this is not a range, it is a missing condition

/**
 * The features a rule may condition on — DERIVED FROM THE SCHEMA, never hand-listed.
 *
 * Hand-listing them is what let `position` exist in the dossier the agents read and not in
 * the record the inducer used. Reading `SITUATION_FIELDS` means adding a column to the schema
 * automatically offers it to the rule language, and a field marked `outcome` can never be
 * offered at all.
 *
 * Continuous columns are banded here because a rule must be sayable out loud. "price 27%" is
 * a measurement; "a cheap price" is a rule.
 */
const BANDS = {
  price_pct: (v) => v === '-' ? null
    : v < 20 ? 'a very cheap price (<20%)'
      : v < 28 ? 'a cheap price (20-28%)'
        : v < 36 ? 'a standard price (28-36%)'
          : v < 45 ? 'a steep price (36-45%)' : 'a very steep price (>45%)',
  stack_bb: (v) => v === '-' ? null
    : v < 30 ? 'a short stack (<30bb)'
      : v < 80 ? 'a medium stack (30-80bb)'
        : v < 150 ? 'a standard stack (80-150bb)' : 'a deep stack (>150bb)',
  spr: (v) => v === '-' ? null
    : v < 3 ? 'SPR under 3' : v < 8 ? 'SPR 3-8' : v < 20 ? 'SPR 8-20' : 'SPR over 20',
  bet_x_pot: (v) => v === '-' ? null
    : v < 0.4 ? 'a small bet (<0.4x pot)'
      : v < 0.7 ? 'a medium bet (0.4-0.7x)'
        : v <= 1.05 ? 'a pot-sized bet' : 'an overbet',
  to_call_bb: () => null,          // subsumed by price and bet size
  pot_bb: () => null,              // subsumed by SPR
  invested_bb: (v) => v === '-' ? null
    : v <= 0.01 ? 'nothing in yet' : v <= 1.01 ? 'only my blind in'
      : v < 10 ? 'a few blinds in' : 'heavily invested',
  players: (v) => `${v}-handed`,
  opps_live: (v) => v === '-' ? null : `${v} opponent(s) live`,
  raises_in: (v) => `${v} raise(s) already in`,
  limpers: (v) => v > 0 ? `${v} limper(s) ahead` : 'no limpers ahead',
  high_card: () => null,           // too granular to be a rule on its own
  hand: () => null,
};

/** Street-aware: the six position labels preflop, the binary postflop. */
const STREET_SCOPED = {
  seat_pos: (row) => row.street === 'preflop' ? row.seat_pos : null,
  in_pos: (row) => row.street === 'preflop' ? null : row.in_pos,
};

const FEATURES = Object.fromEntries(
  SITUATION_FIELDS.map((name) => [name, (d) => {
    const row = toRow(d);
    if (STREET_SCOPED[name]) {
      const v = STREET_SCOPED[name](row);
      return v == null || v === '-' ? null : v;
    }
    const raw = row[name];
    if (raw === '-' || raw == null) return null;
    if (BANDS[name]) return BANDS[name](raw);
    return `${name.replace(/_/g, ' ')} = ${raw}`;
  }]).filter(([, fn]) => fn)
);

const ACTIONS = ['fold', 'check', 'call', 'bet', 'raise'];

const purity = (pool) => {
  const t = new Map();
  for (const d of pool) t.set(d.action, (t.get(d.action) || 0) + 1);
  const best = [...t.entries()].sort((a, b) => b[1] - a[1])[0];
  return { action: best[0], k: best[1], n: pool.length, pure: best[1] === pool.length, tally: t };
};

/**
 * Partition EVERY decision into leaves — one leaf, one rule.
 *
 * A decision LIST accepted a leaf as soon as its residue looked range-like, which let
 * "preflop -> fold 83%" swallow 1,553 decisions without ever splitting on position. Maximum
 * compression, zero insight. A TREE cannot do that: it keeps splitting while a split
 * materially improves purity, and only reads the FINAL leaf as always-or-range.
 *
 * Every decision lands in exactly one leaf, so coverage is 100% by construction. What each
 * leaf then says is one of:
 *
 *   ALWAYS  — every decision in it took the same action.
 *   RANGE   — one action dominates; the residue IS the villain's range in that spot and is
 *             stated as a percentage, never rounded away.
 *   MIXED   — no action dominates. This is a real gap: either a condition is missing from
 *             the record (almost always the hole cards) or the player genuinely mixes.
 */
const MAX_DEPTH = Number(process.env.MAX_DEPTH || 5);

/**
 * Entropy, not majority purity.
 *
 * Majority purity is blind to exactly the thing worth finding. If a villain folds 88% from
 * every seat but RAISES 7% from early position and 18% from the button, that is a real
 * positional rule — and majority purity barely moves, because the majority action is "fold"
 * in both. Entropy sees the minority shift, which is where the range lives.
 */
const entropy = (pool) => {
  const t = new Map();
  for (const d of pool) t.set(d.action, (t.get(d.action) || 0) + 1);
  let h = 0;
  for (const [, c] of t) { const p = c / pool.length; h -= p * Math.log2(p); }
  return h;
};

const infoGain = (parent, branches) => {
  const n = parent.length;
  let after = 0;
  for (const sub of branches) after += (sub.length / n) * entropy(sub);
  return entropy(parent) - after;
};

const buildTree = (pool, depth, used) => {
  const p = purity(pool);
  if (p.pure || depth >= MAX_DEPTH || pool.length < MIN_RULE * 2) {
    return { leaf: true, pool, ...p };
  }

  let best = null;
  for (const [fname, fn] of Object.entries(FEATURES)) {
    if (used.has(fname)) continue;
    const groups = new Map();
    let skip = false;
    for (const d of pool) {
      const v = fn(d);
      // A null means the feature does not apply to this decision (position postflop,
      // in-position preflop). A feature that does not apply to EVERY decision in the pool
      // cannot split it, or the split would encode "which street" twice.
      if (v == null) { skip = true; break; }
      if (!groups.has(v)) groups.set(v, []);
      groups.get(v).push(d);
    }
    if (skip || groups.size < 2) continue;
    // Every branch must be big enough to be a rule rather than a memorised case; small
    // branches are merged into an "other" bucket so the split stays legitimate.
    const big = [...groups.entries()].filter(([, sub]) => sub.length >= MIN_RULE);
    if (big.length < 2) continue;
    const small = [...groups.entries()].filter(([, sub]) => sub.length < MIN_RULE)
      .flatMap(([, sub]) => sub);
    const branches = big.map(([v, sub]) => [v, sub]);
    // ALWAYS keep the remainder. Dropping it silently cost 2.7% of coverage, and a ruleset
    // that quietly omits decisions is exactly the thing this measurement exists to prevent.
    if (small.length) branches.push(['everything else', small]);
    const gain = infoGain(pool, branches.map(b => b[1]));
    if (gain > 0.01 && (!best || gain > best.gain)) best = { fname, branches, gain };
  }

  if (!best) return { leaf: true, pool, ...p };
  return {
    leaf: false, feature: best.fname,
    children: best.branches.map(([value, sub]) => ({
      value, node: buildTree(sub, depth + 1, new Set([...used, best.fname])),
    })),
  };
};

const collectLeaves = (node, path, out) => {
  if (node.leaf) {
    const p = purity(node.pool);
    out.push({
      conds: path, pool: node.pool, action: p.action, k: p.k, n: p.n,
      pure: p.pure, tally: p.tally,
      kind: p.pure ? 'always' : ((1 - p.k / p.n) <= RANGE_MAX ? 'range' : 'unresolved'),
    });
    return out;
  }
  for (const c of node.children) {
    collectLeaves(c.node, [...path, { feature: node.feature, value: c.value }], out);
  }
  return out;
};

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

const counts = new Map();
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    for (const pid of Object.values(h.seatPlayers || {})) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
}
const pid = TARGET || [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

const decisions = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
    if (seat) decisions.push(...labelDecisions(h, seat));
  }
}

// ── induce ───────────────────────────────────────────────────────────────────
const tree = buildTree(decisions, 0, new Set());
const rules = collectLeaves(tree, [], []).sort((a, b) => b.n - a.n);

const describe = (conds) => conds.length
  ? conds.map(c => FEATURES[c.feature] && c.value).join(' AND ')
  : 'anything not caught above';

const totalCovered = rules.reduce((s, r) => s + r.n, 0);
const totalRight = rules.reduce((s, r) => s + r.k, 0);
const pureRules = rules.filter(r => r.pure);

console.log(`VILLAIN ${pid}  (schema v${SCHEMA_VERSION}, ${Object.keys(FEATURES).length} conditionable fields)`);
console.log(`${counts.get(pid)} hands · ${decisions.length} decisions\n`);
console.log('THE RULESET');
console.log(`  rules                : ${rules.length}`);
console.log(`  coverage             : ${totalCovered}/${decisions.length} = ${(totalCovered / decisions.length * 100).toFixed(1)}%`);
console.log(`  accuracy in-sample   : ${totalRight}/${totalCovered} = ${(totalRight / totalCovered * 100).toFixed(2)}%`);
console.log(`  ALWAYS rules (pure)  : ${rules.filter(r => r.kind === 'always').length}`);
console.log(`  RANGE rules          : ${rules.filter(r => r.kind === 'range').length}`);
console.log(`  UNRESOLVED           : ${rules.filter(r => r.kind === 'unresolved').length}`);
console.log(`  compression          : ${(decisions.length / rules.length).toFixed(0)} decisions per rule\n`);

rules.forEach((r, i) => {
  const others = [...r.tally.entries()].filter(([a]) => a !== r.action).sort((a, b) => b[1] - a[1]);
  const pctOther = ((r.n - r.k) / r.n * 100).toFixed(1);
  console.log(`${String(i + 1).padStart(2)}. [${String(r.n).padStart(4)} decisions]  ${describe(r.conds)}`);
  if (r.kind === 'always') {
    console.log(`     -> I ALWAYS ${r.action}.  (${r.n}/${r.n})`);
  } else if (r.kind === 'range') {
    console.log(`     -> I ${r.action} ${(r.k / r.n * 100).toFixed(0)}% of the time.`);
    console.log(`        The other ${pctOther}% is my RANGE here: ${others.map(([a, n]) => `${a} ${(n / r.n * 100).toFixed(1)}%`).join(', ')}`);
  } else {
    console.log(`     -> UNRESOLVED. ${r.action} ${(r.k / r.n * 100).toFixed(0)}%, but the residue is too large to be a range:`);
    console.log(`        ${others.map(([a, n]) => `${a} ${(n / r.n * 100).toFixed(1)}%`).join(', ')}`);
  }
  const shown = r.pool.filter(d => d.action !== r.action && d.handKnown);
  if (r.n - r.k) {
    console.log(`        cards shown on ${shown.length} of ${r.n - r.k} off-action decisions`
      + (shown.length ? `: ${shown.slice(0, 12).map(d => d.holeCards.join('')).join(' ')}` : ' — never observable'));
  }
});

const residue = rules.reduce((s, r) => s + (r.n - r.k), 0);
console.log(`\nRESIDUE TOTAL: ${residue}/${decisions.length} = ${(residue / decisions.length * 100).toFixed(2)}% of decisions are not determined by the observable record.`);
const residueShown = rules.flatMap(r => r.pool.filter(d => d.action !== r.action)).filter(d => d.handKnown).length;
console.log(`  of those, ${residueShown} had cards shown — the rest need the hole cards that were never revealed.`);

mkdirSync('.tmp-arch', { recursive: true });
writeFileSync('.tmp-arch/induced.json', JSON.stringify({
  pid, hands: counts.get(pid), decisions: decisions.length,
  ruleCount: rules.length, coverage: totalCovered, accuracy: totalRight / totalCovered,
  residue,
  rules: rules.map((r, i) => ({
    n: i + 1, size: r.n, correct: r.k, pure: r.pure, action: r.action,
    conds: r.conds, tally: [...r.tally.entries()],
  })),
}, null, 1));
console.log('\nwrote .tmp-arch/induced.json');
