/**
 * ws318Probe.mjs — WS-318 quantification (temporary, not a shipped module).
 *
 * Measures how the weakness match rate moves between the three candidate semantics.
 *
 * HONEST LIMIT: this is STRUCTURAL, not corpus-derived. The accept criterion asks for the
 * delta "over a real hand set"; the HandHQ corpus lives outside the repo and is not
 * reachable here, so this enumerates the situation-key space instead. That measures the
 * SHAPE of the change exactly (which pairs match under which rule) while leaving the
 * real-world frequency weighting unmeasured — the distribution of contextAction within a
 * (street, isAgg) cell is what scales it, and that needs the corpus.
 */
import { formatSituationKey, tryParseSituationKey } from '../../src/utils/pokerCore/situationKey.js';

const STREETS = ['flop', 'turn', 'river'];
const TEXTURES = ['dry', 'wet'];
const POSITIONS = ['EARLY', 'LATE'];
const IS_AGG = ['agg', 'def'];
const IS_IP = ['ip', 'oop'];
const FACING = ['none', 'bet', 'raise'];
const CONTEXT_ACTIONS = ['check', 'bet', 'call', 'raise', 'fold'];

const keys = [];
for (const street of STREETS)
  for (const texture of TEXTURES)
    for (const posCategory of POSITIONS)
      for (const isAgg of IS_AGG)
        for (const isIP of IS_IP)
          for (const facingAction of FACING)
            for (const contextAction of CONTEXT_ACTIONS)
              keys.push(formatSituationKey({
                street, texture, posCategory, isAgg, isIP, facingAction, contextAction,
              }));

const rules = {
  'b: street + isAgg (CURRENT)': (w, a) => w.street === a.street && w.isAgg === a.isAgg,
  'a: street + contextAction': (w, a) => w.street === a.street && w.contextAction === a.contextAction,
  'c: street + isAgg + contextAction': (w, a) =>
    w.street === a.street && w.isAgg === a.isAgg && w.contextAction === a.contextAction,
};

const parsed = keys.map(tryParseSituationKey);
const total = parsed.length * parsed.length;

console.log(`situation keys enumerated: ${parsed.length}  (ordered pairs: ${total})\n`);
console.log('rule                                  matching pairs    rate   vs current');
const counts = {};
for (const [name, fn] of Object.entries(rules)) {
  let n = 0;
  for (const w of parsed) for (const a of parsed) if (fn(w, a)) n++;
  counts[name] = n;
}
const current = counts['b: street + isAgg (CURRENT)'];
for (const [name, n] of Object.entries(counts)) {
  const pct = ((n / total) * 100).toFixed(2);
  const rel = ((n / current) * 100).toFixed(1);
  console.log(name.padEnd(38), String(n).padStart(9), `${pct.padStart(8)}%`, `${rel.padStart(9)}%`);
}

// The single case the accept criterion names: same street, same isAgg, DIFFERENT action.
const w = tryParseSituationKey(formatSituationKey({
  street: 'river', texture: 'dry', posCategory: 'LATE', isAgg: 'agg', isIP: 'ip',
  facingAction: 'none', contextAction: 'check',
}));
const a = tryParseSituationKey(formatSituationKey({
  street: 'river', texture: 'dry', posCategory: 'LATE', isAgg: 'agg', isIP: 'ip',
  facingAction: 'none', contextAction: 'bet',
}));
console.log('\nThe near-miss case — weakness on a river CHECK vs a river BET (same street, same role):');
for (const [name, fn] of Object.entries(rules)) {
  console.log(`  ${name.padEnd(38)} → ${fn(w, a) ? 'MATCHES' : 'does not match'}`);
}
