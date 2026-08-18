/**
 * verifyRule — the half of the loop that stops a plausible rule from becoming a believed one.
 *
 * An explainer reads 64 hands and proposes "I fold to any preflop raise regardless of price".
 * That claim is generated from a SLICE, and the slice is not random: hands are ordered by how
 * much they demanded explanation, so one agent may see almost nothing but preflop folds and
 * another almost nothing but stacked-off pots. A support count from inside one batch is a
 * statement about that batch. It is not a rate, and treating it as one is how an artefact of
 * the feeding order becomes a property of the player.
 *
 * So every proposed rule comes back here and is re-tested against EVERY decision the villain
 * made, with its own conditioning set stated. The explainer proposes; this disposes.
 *
 * WHAT A VERIFIED RULE REPORTS
 *   support / total      over all decisions matching the rule's `when`, not over a batch
 *   the exception set    every decision that contradicts it, so §4 of the engine spec can
 *                        classify it as sub-rule, noise, or unresolvable
 *   the discriminating   for a threshold rule, the rate in each band — a rule that claims a
 *   profile              threshold is only true if the bands actually differ
 */

import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';

/**
 * Rules proposed by the explainer agents, encoded as predicates over labelled decisions.
 * `when` selects the decisions the rule speaks about; `then` is what the rule says happens.
 * `bands` (optional) splits the same population so a claimed threshold can be checked.
 */
export const PROPOSED = [
  {
    id: 'folds-to-any-preflop-raise',
    prose: 'I fold to any preflop raise once someone else has acted, regardless of size, price, '
      + 'stack depth, or how many players are behind me.',
    source: 'explainer batch-06',
    when: (d) => d.street === 'preflop' && (d.facing === 'a raise' || d.facing === 'a 3-bet'),
    then: (d) => d.action === 'fold',
    // The rule's own claim is that NONE of these move the answer. If any band differs
    // materially the rule is false as stated and the band is the real rule.
    bands: {
      price: (d) => d.potOddsNeeded == null ? null
        : d.potOddsNeeded < 0.28 ? 'cheap (<28%)'
          : d.potOddsNeeded < 0.36 ? 'standard (28-36%)' : 'steep (>36%)',
      depth: (d) => d.spr == null ? null : d.spr < 20 ? 'shallow (SPR<20)'
        : d.spr < 60 ? 'medium (20-60)' : 'deep (>60)',
      playersBehind: (d) => d.closesAction == null ? null
        : (d.closesAction ? 'closes action' : 'players behind'),
    },
  },
  {
    id: 'raises-not-limps-when-first-in',
    prose: 'When the action comes to me with nobody in, I raise rather than limp or fold.',
    source: 'explainer batch-06',
    when: (d) => d.street === 'preflop' && d.firstIn && d.facing === 'no raise'
      && (d.action === 'raise' || d.action === 'call'),
    then: (d) => d.action === 'raise',
  },
  {
    id: 'bb-option-check-fold',
    prose: 'When I get a free option in the big blind, I check, and I fold to the first bet '
      + 'whatever the board looks like.',
    source: 'explainer batch-06',
    when: (d) => d.street === 'flop' && !d.iAmPreflopAggressor && d.facing === 'a bet',
    then: (d) => d.action === 'fold',
    bands: {
      texture: (d) => !d.boardTexture ? null
        : d.boardTexture.connected ? 'connected'
          : d.boardTexture.paired ? 'paired'
            : d.boardTexture.monotone ? 'monotone' : 'dry',
      price: (d) => d.potOddsNeeded == null ? null
        : d.potOddsNeeded < 0.28 ? 'cheap (<28%)'
          : d.potOddsNeeded < 0.36 ? 'standard (28-36%)' : 'steep (>36%)',
    },
  },
  {
    id: 'price-does-not-move-me',
    prose: 'My continuing range is governed by hand strength, not pot odds — the price does '
      + 'not change whether I continue.',
    source: 'explainer batch-06',
    when: (d) => d.potOddsNeeded != null && d.toCallBB > 0,
    then: (d) => d.action !== 'fold',
    bands: {
      price: (d) => d.potOddsNeeded < 0.25 ? '1. under 25%'
        : d.potOddsNeeded < 0.30 ? '2. 25-30%'
          : d.potOddsNeeded < 0.35 ? '3. 30-35%'
            : d.potOddsNeeded < 0.42 ? '4. 35-42%' : '5. over 42%',
    },
    // A "price does not move me" claim is REFUTED by variation, not supported by a high rate.
    verdictIsFlatness: true,
  },
  {
    id: 'threebet-sizing-is-always-12bb',
    prose: 'When I re-raise someone before the flop, I always make it 12bb, whatever my position '
      + 'or stack depth.',
    source: 'explainer batch-09 (4/4)',
    when: (d) => d.street === 'preflop' && d.facing === 'a raise' && d.action === 'raise',
    then: () => true,
    // A SIZING claim is not tested by a rate. Report the actual sizes.
    // MEASURED IN BIG BLINDS, not as a fraction of pot. The first pass tested
    // raiseToFractionOfPot and called the rule false — but the pot varies between spots, so a
    // FIXED bb sizing necessarily produces a varying pot fraction. Testing the wrong unit
    // refutes a true rule.
    describeSizes: (pool) => pool.map(d => (d.potBB != null && d.raiseToFractionOfPot != null)
      ? d.raiseToFractionOfPot * d.potBB : null).filter(x => x != null),
    sizeUnit: 'bb',
  },
  {
    id: 'never-opens-early',
    prose: 'I do not open from early position or the hijack. If it folds to me there, I fold.',
    source: 'explainer batch-15 (0 opens in 28 tries)',
    when: (d) => d.street === 'preflop' && d.firstIn && d.facing === 'no raise',
    then: (d) => d.action === 'fold',
    bands: { position: (d) => d.opponentsLive == null ? null
      : d.opponentsLive >= 5 ? 'early (5+ behind)'
        : d.opponentsLive >= 3 ? 'middle (3-4 behind)'
          : d.opponentsLive >= 1 ? 'late (1-2 behind)' : 'blind vs blind' },
  },
  {
    id: 'entry-is-positional-not-flat',
    prose: 'THE CORRECTION: my entry rate is not one number. It depends entirely on how many '
      + 'players are still behind me.',
    source: 'contradiction between the 12.8% marginal and 0-for-28 early opens',
    when: (d) => d.street === 'preflop' && d.firstIn && d.facing === 'no raise',
    then: (d) => d.action !== 'fold',
    bands: { playersBehind: (d) => d.opponentsLive == null ? null : `${d.opponentsLive} behind` },
    verdictIsFlatness: true,
  },
];

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;

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

console.log(`villain ${pid} — ${counts.get(pid)} hands, ${decisions.length} decisions`);
console.log('Rules proposed by explainer agents, re-tested against EVERY decision.\n');

for (const r of PROPOSED) {
  const pool = decisions.filter(r.when);
  const fired = pool.filter(r.then);
  const rate = pool.length ? fired.length / pool.length : null;
  console.log('='.repeat(96));
  console.log(`${r.id}   [proposed by ${r.source}]`);
  console.log(`  "${r.prose}"`);
  if (!pool.length) { console.log('  NO MATCHING DECISIONS — cannot be tested.\n'); continue; }
  console.log(`  Over ALL decisions: ${fired.length}/${pool.length} = ${(rate * 100).toFixed(1)}%`);

  if (r.bands) {
    for (const [name, fn] of Object.entries(r.bands)) {
      const groups = new Map();
      for (const d of pool) {
        const g = fn(d); if (g == null) continue;
        if (!groups.has(g)) groups.set(g, { k: 0, n: 0 });
        const x = groups.get(g); x.n++; if (r.then(d)) x.k++;
      }
      const rows = [...groups.entries()].filter(([, x]) => x.n >= 8).sort();
      if (rows.length < 2) continue;
      const rates = rows.map(([, x]) => x.k / x.n);
      const spread = (Math.max(...rates) - Math.min(...rates)) * 100;
      console.log(`   by ${name}:`);
      for (const [g, x] of rows) console.log(`      ${String(g).padEnd(20)} ${((x.k / x.n) * 100).toFixed(1).padStart(5)}%  (${x.k}/${x.n})`);
      // An ABSOLUTE percentage-point band is the wrong instrument and the founder already
      // corrected it once: 8pp on a 90% base is noise, 8pp on a 10% base is a doubling. Judge
      // on the RATIO of the complement rates as well, so low-base-rate dimensions are not
      // waved through.
      const lo = Math.min(...rates), hi = Math.max(...rates);
      const ratio = (1 - lo) > 0 && (1 - hi) > 0 ? Math.max((1 - lo) / (1 - hi), (1 - hi) / (1 - lo)) : Infinity;
      const moves = spread >= 10 || ratio >= 1.5;
      console.log(`      spread ${spread.toFixed(1)}pp, ${ratio.toFixed(2)}x on the complement  ->  ${moves
        ? 'THE RULE IS FALSE AS STATED — this dimension moves the answer, and IS the rule'
        : 'the rule holds across this dimension'}`);
    }
  }

  if (r.describeSizes) {
    const sizes = r.describeSizes(pool);
    if (sizes.length) {
      const sorted = [...sizes].sort((a, b) => a - b);
      const uniq = new Map();
      for (const x of sizes) { const k = x.toFixed(2); uniq.set(k, (uniq.get(k) || 0) + 1); }
      const unit = r.sizeUnit || 'x pot';
      console.log(`   sizes in ${unit}: min ${sorted[0].toFixed(2)}  median `
        + `${sorted[Math.floor(sorted.length / 2)].toFixed(2)}  max ${sorted[sorted.length - 1].toFixed(2)}`);
      console.log('   distinct sizes: ' + [...uniq.entries()].sort((a, b) => b[1] - a[1])
        .slice(0, 8).map(([k, v]) => `${k}(x${v})`).join(' '));
      const spread = sorted[sorted.length - 1] - sorted[0];
      const tol = r.sizeUnit === 'bb' ? 2.0 : 0.15;
      console.log(`   -> ${spread <= tol ? 'ONE SIZE — the sizing rule holds' : `SIZING VARIES by ${spread.toFixed(1)}${r.sizeUnit || ''} — the fixed-size claim is false as stated`}`);
    }
  }

  const exceptions = pool.filter(d => !r.then(d));
  console.log(`  EXCEPTION SET: ${exceptions.length} decisions contradict it.`);
  if (exceptions.length && exceptions.length <= 12) {
    for (const d of exceptions) {
      console.log(`     hand ${d.handId} ${d.street} facing ${d.facing}`
        + `${d.potOddsNeeded != null ? ` need ${(d.potOddsNeeded * 100).toFixed(0)}%` : ''}`
        + ` -> ${d.action}${d.handKnown ? ` {${d.holeCards.join('')}}` : ' (cards never shown)'}`);
    }
  } else if (exceptions.length) {
    const shown = exceptions.filter(d => d.handKnown);
    console.log(`     ${shown.length} of them had cards shown: `
      + shown.slice(0, 14).map(d => d.holeCards.join('')).join(' ') + (shown.length > 14 ? ' ...' : ''));
  }
  console.log('');
}
