#!/usr/bin/env node
/**
 * diffProbeRuns.mjs — paired comparison of two probeFrequency artifacts (WS-436 B4).
 *
 * The probe's rows are paired BY KEY (`${playerId}|${handId}|${order}`, seeded per
 * decision), so two runs — different code states, different villain arms — can be
 * differenced per decision. Until this tool, that pairing existed and the comparison
 * was done by eyeball on the printed aggregate tables (the dilution-by-identical-
 * decisions mistake dump-records.mjs documents for its own domain).
 *
 * Reports:
 *   - each run's aggregate action mix (the eyeball table, reproduced)
 *   - paired coverage: keys present in both
 *   - divergence: fraction of shared keys where piOurs differs at all, and the mean
 *     total-variation distance over the DIVERGENT subset (per the paired-on-divergent
 *     doctrine — an average over identical rows measures the overlap, not the change)
 *   - per-street breakdown, and feed coverage when either side carried a feed
 *
 * USAGE
 *   node scripts/backtest/diffProbeRuns.mjs A.json B.json
 */

import { readFileSync } from 'node:fs';

const load = (p) => JSON.parse(readFileSync(p, 'utf8'));
const pct = (x) => `${(100 * x).toFixed(1)}%`;

const mix = (rows) => {
  const sum = {};
  let n = 0;
  for (const r of rows) {
    for (const [a, p] of Object.entries(r.piOurs || {})) sum[a] = (sum[a] || 0) + p;
    n++;
  }
  const out = {};
  for (const [a, s] of Object.entries(sum)) out[a] = n ? s / n : 0;
  return { n, out };
};

const tv = (p, q) => {
  const actions = new Set([...Object.keys(p || {}), ...Object.keys(q || {})]);
  let d = 0;
  for (const a of actions) d += Math.abs((p?.[a] || 0) - (q?.[a] || 0));
  return d / 2;
};

const main = () => {
  const [pathA, pathB] = process.argv.slice(2);
  if (!pathA || !pathB) {
    console.error('usage: diffProbeRuns.mjs <A.json> <B.json>');
    process.exit(2);
  }
  const A = load(pathA);
  const B = load(pathB);

  console.log(`A: ${A.label ?? pathA}  (villainSource=${A.villainSource ?? 'null(pre-B2 artifact)'}, rows=${A.rows.length})`);
  console.log(`B: ${B.label ?? pathB}  (villainSource=${B.villainSource ?? 'null(pre-B2 artifact)'}, rows=${B.rows.length})`);

  for (const [name, run] of [['A', A], ['B', B]]) {
    const m = mix(run.rows);
    const parts = Object.entries(m.out).sort().map(([a, p]) => `${a} ${pct(p)}`).join('  ');
    const fed = run.rows.filter(r => r.villainFed).length;
    const fedNote = run.villainSource && run.villainSource !== 'null'
      ? `  [feed coverage ${fed}/${m.n} = ${pct(m.n ? fed / m.n : 0)}]` : '';
    console.log(`  ${name} action mix (n=${m.n}): ${parts}${fedNote}`);
  }

  const byKeyB = new Map(B.rows.map(r => [r.key, r]));
  const shared = A.rows.filter(r => byKeyB.has(r.key));
  console.log(`\npaired keys: ${shared.length} of A=${A.rows.length} / B=${B.rows.length}`);
  if (shared.length === 0) {
    console.log('NO SHARED KEYS — these runs are not comparable decision-for-decision.');
    process.exit(1);
  }

  const streets = ['ALL', 'flop', 'turn', 'river'];
  console.log('\n            n     divergent      meanTV(divergent)');
  for (const st of streets) {
    const sub = st === 'ALL' ? shared : shared.filter(r => r.street === st);
    const divs = sub
      .map(r => tv(r.piOurs, byKeyB.get(r.key).piOurs))
      .filter(d => d > 1e-12);
    const meanTv = divs.length ? divs.reduce((s, d) => s + d, 0) / divs.length : 0;
    console.log(
      `  ${st.padEnd(8)} ${String(sub.length).padStart(4)}   ${String(divs.length).padStart(4)}`
      + ` (${pct(sub.length ? divs.length / sub.length : 0).padStart(6)})   ${meanTv.toFixed(4)}`,
    );
  }
};

main();
