/**
 * populationBaseline — what the FIELD does, measured on the same instrument as the subject.
 *
 * FOUNDER, 2026-08-18: *"any comparisons to baseline are a different thing than the player's
 * behavior itself. Both matter, but they matter separately."*
 *
 * That is the second-argument rule, and this module exists to keep the two apart in code as
 * well as in prose. A Conduct Card takes NO second argument. Everything here is the second
 * argument — the reference an Appraisal is made against — and it must never be folded back
 * into the description.
 *
 * WHY THIS EXISTS AT ALL. The villain dossier compared his widths to `PREFLOP_CHARTS`, which
 * `rangeMatrix.js:272` labels "9-max 100bb cash". The subject never played a nine-handed hand.
 * Every width comparison in that document overstated his deviation, and the headline finding
 * ("he barely widens with position") inverted once the reference was corrected. A baseline
 * measured on the SAME corpus, the SAME seats and the SAME instrument cannot make that error.
 *
 * SEATS ARE KEYED BY PLAYERS-BEHIND, not by name. At four-, five- and six-handed tables the
 * same seat name sits in front of a different number of opponents, and "UTG" is the seat most
 * distorted by that. Players-behind is the mechanism; the name is a label.
 *
 * The founder's third point is recorded because it changes what this number MEANS: the
 * population is semi-available to the subject. He watches these players nightly and has a feel
 * for them, however inaccurate. So a divergence from this baseline is not purely an external
 * analyst's construct — it may be his response to his own read of the field.
 */
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const MIN_OPPS = Number(process.env.MIN_OPPS || 40);

const quantile = (arr, q) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * (s.length - 1)))];
};

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

/** Per player: counters for each measured quantity. */
const P = new Map();
const bump = (pid, key, hit) => {
  let r = P.get(pid);
  if (!r) { r = {}; P.set(pid, r); }
  const c = r[key] || (r[key] = { k: 0, n: 0 });
  c.n++; if (hit) c.k++;
};

let hands = 0;
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    hands++;
    for (const [seat, pid] of Object.entries(h.seatPlayers || {})) {
      let ds;
      try { ds = labelDecisions(h, seat); } catch { continue; }
      for (const d of ds) {
        if (d.street !== 'preflop') {
          // flop continuation bet: I bet last street (preflop raiser), nobody has bet into me
          if (d.street === 'flop' && d.iBetLastStreet && d.facing === 'no bet') {
            bump(pid, 'cbetFlop', d.action === 'bet');
          }
          continue;
        }
        const entered = d.action === 'raise' || d.action === 'call' || d.action === 'bet';
        if (d.firstIn) {
          // KEYED BY PLAYERS BEHIND, not seat name.
          const behind = d.seatsToActAfterMe;
          if (behind != null) bump(pid, `firstIn_behind${behind}`, entered);
          bump(pid, 'openLimp', d.action === 'call');
        }
        if (d.position === 'BB' && d.facing === 'a raise') bump(pid, 'bbDefend', entered);
        // FOLD-TO-RAISE by seat, which is what a steal has to get through. Keyed by the seat
        // that must fold, because a steal needs EVERY remaining seat to fold and the blinds
        // behave nothing like the open seats.
        if (d.facing === 'a raise') bump(pid, `foldToRaise_${d.position}`, d.action === 'fold');
        if (d.position === 'SB' && d.firstIn) bump(pid, 'sbFirstIn', entered);
      }
    }
  }
}

console.log(`corpus slice: ${files.length} files, ${hands} hands, ${P.size} distinct players`);
console.log(`qualifying threshold: >= ${MIN_OPPS} opportunities per measured quantity\n`);

const report = (key, label) => {
  const vals = [];
  for (const r of P.values()) {
    const c = r[key];
    if (c && c.n >= MIN_OPPS) vals.push(c.k / c.n);
  }
  if (!vals.length) { console.log(`${label.padEnd(34)} no qualifying players`); return null; }
  console.log(`${label.padEnd(34)} n=${String(vals.length).padStart(4)}  `
    + `p25 ${(100 * quantile(vals, 0.25)).toFixed(1)}%  `
    + `MEDIAN ${(100 * quantile(vals, 0.5)).toFixed(1)}%  `
    + `p75 ${(100 * quantile(vals, 0.75)).toFixed(1)}%`);
  return vals;
};

console.log('FIRST-IN ENTRY, BY PLAYERS STILL TO ACT BEHIND');
for (let b = 1; b <= 5; b++) report(`firstIn_behind${b}`, `  ${b} behind`);
console.log();
report('openLimp', 'OPEN-LIMP when first in');
report('bbDefend', 'BIG BLIND defends vs a raise');
report('sbFirstIn', 'SMALL BLIND first-in entry');
report('cbetFlop', 'FLOP continuation bet');

console.log('\nFOLD TO A RAISE, by the seat that must fold (what a steal must get through)');
for (const seat of ['SB', 'BB', 'BTN', 'CO', 'HJ', 'UTG']) report(`foldToRaise_${seat}`, `  ${seat} folds`);

/**
 * Dump the PER-PLAYER rates, not just the quantiles.
 *
 * The exploit card needs to know how often "the seat behind me" folds, and that quantity is
 * uncertain for a reason a median cannot express: you do not know WHO is sitting there. The
 * right spread is the BETWEEN-PLAYER distribution, which is far wider than the sampling error
 * on any one rate - and an earlier version of the exploit card fabricated a denominator
 * (`Math.round(rate * 60)`) to manufacture an interval, which made a default argument the knob
 * that decided every verdict on the page.
 */
const dump = {};
for (const key of ['foldToRaise_SB', 'foldToRaise_BB', 'foldToRaise_BTN', 'foldToRaise_CO']) {
  const rates = [];
  for (const r of P.values()) {
    const c = r[key];
    if (c && c.n >= MIN_OPPS) rates.push({ k: c.k, n: c.n, rate: c.k / c.n });
  }
  dump[key.replace('foldToRaise_', '')] = rates;
}
const { writeFileSync } = await import('node:fs');
writeFileSync('.tmp-arch/field-seats.json', JSON.stringify(dump));
console.log('\nwrote .tmp-arch/field-seats.json - per-player fold-to-raise rates for '
  + Object.entries(dump).map(([k, v]) => `${k}:${v.length}`).join(' '));

// The elasticity the dossier built its thesis on, measured per player on the same instrument.
console.log('\nPOSITIONAL ELASTICITY  (entry with 2 behind) / (entry with 5 behind)');
const el = [];
for (const [pid, r] of P) {
  const a = r.firstIn_behind2, b = r.firstIn_behind5;
  if (a && b && a.n >= MIN_OPPS && b.n >= MIN_OPPS && b.k > 0) el.push([pid, (a.k / a.n) / (b.k / b.n)]);
}
const ev = el.map(([, v]) => v);
if (ev.length) {
  console.log(`  n=${ev.length} qualifying players  `
    + `p25 ${quantile(ev, 0.25).toFixed(2)}x  MEDIAN ${quantile(ev, 0.5).toFixed(2)}x  p75 ${quantile(ev, 0.75).toFixed(2)}x`);
  const subj = el.find(([pid]) => pid === 'SO0Om/HLLvkJps9pZmbgqQ');
  if (subj) {
    const below = ev.filter((v) => v < subj[1]).length;
    console.log(`  SUBJECT = ${subj[1].toFixed(2)}x  -> ${(100 * below / ev.length).toFixed(0)}th percentile`);
  } else console.log('  SUBJECT did not qualify at this threshold');
}
