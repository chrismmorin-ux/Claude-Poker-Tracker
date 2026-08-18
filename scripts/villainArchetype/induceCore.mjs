/**
 * induceCore — the rule induction, as a function so the procedure can call it.
 *
 * Extracted from `induceRules.mjs` (which stays as the standalone explorer) so that
 * `profileVillain.mjs` runs the SAME induction every time rather than a re-typed variant.
 * The off-the-cuff variants were the quality problem the founder named.
 */
import { SITUATION_FIELDS, toRow } from './decisionSchema.mjs';

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

export const induce = (decisions, {
  minRule = MIN_RULE_DEFAULT, rangeMax = RANGE_MAX_DEFAULT, maxDepth = MAX_DEPTH_DEFAULT,
} = {}) => {
  const FEATURES = buildFeatures();

  const build = (pool, depth, used) => {
    const p = purity(pool);
    if (p.pure || depth >= maxDepth || pool.length < minRule * 2) return { leaf: true, pool };

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
      const big = [...groups.entries()].filter(([, sub]) => sub.length >= minRule);
      if (big.length < 2) continue;
      const small = [...groups.entries()].filter(([, sub]) => sub.length < minRule)
        .flatMap(([, sub]) => sub);
      const branches = big.map(([v, sub]) => [v, sub]);
      // The remainder is kept, but it must clear the same floor as any other branch —
      // pushing it unconditionally was an escape hatch that produced single-decision rules.
      if (small.length >= minRule) branches.push(['everything else', small]);
      else if (small.length) continue;

      const after = branches.reduce((s, [, sub]) => s + (sub.length / pool.length) * entropy(sub), 0);
      const gain = entropy(pool) - after;
      if (gain > 0.01 && (!best || gain > best.gain)) best = { fname, branches, gain };
    }
    if (!best) return { leaf: true, pool };
    return { leaf: false, feature: best.fname,
      children: best.branches.map(([value, sub]) => ({ value, node: build(sub, depth + 1, new Set([...used, best.fname])) })) };
  };

  const leaves = [];
  const walk = (node, path) => {
    if (node.leaf) {
      const p = purity(node.pool);
      leaves.push({ conds: path, pool: node.pool, ...p,
        kind: p.pure ? 'always' : ((1 - p.k / p.n) <= rangeMax ? 'range' : 'unresolved') });
      return;
    }
    for (const c of node.children) walk(c.node, [...path, { feature: node.feature, value: c.value }]);
  };
  walk(build(decisions, 0, new Set()), []);

  const covered = leaves.reduce((s, r) => s + r.n, 0);
  const right = leaves.reduce((s, r) => s + r.k, 0);
  return { rules: leaves, coverage: covered / decisions.length, accuracy: right / covered };
};
