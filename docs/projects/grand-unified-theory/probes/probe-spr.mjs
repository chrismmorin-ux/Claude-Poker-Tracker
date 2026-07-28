/**
 * AS-GUT-2 probe (redesigned — the original was circular).
 *
 * CIRCULARITY FOUND: gameTreeConstants.js:93-97 hardcodes the zone cuts at
 * 2/4/8/13, and buildHeroActions / adjustedRealization / foldEquityCalculator
 * all branch on getSPRZone(). Sweeping SPR through evaluateGameTree and
 * observing discontinuities at 2/4/8/13 would measure the step function we
 * put in, not a property of poker.
 *
 * NON-CIRCULAR REPLACEMENT — two independent questions:
 *
 * Q1. Is a discontinuous argmax evidence of "regimes" at all?
 *     No. argmax over a finite action set of continuous EV functions is
 *     piecewise-constant by construction. Switches are guaranteed. So the
 *     real question is whether the switch LOCATIONS are stable.
 *
 * Q2. Do the stated boundaries follow from a law, independent of the code?
 *     The SPR zone manifest claims: "Zones reflect the geometry of how many
 *     pot-sized bets fit before all-in." That is a checkable claim.
 *
 * Stacking law: bets at fraction f of the current pot, starting pot = 1.
 *   pot_i = pot_{i-1}(1 + 2f);  cumulative hero investment after n bets
 *   = f·Σ(1+2f)^(i-1) = [(1+2f)^n − 1] / 2
 * So the stack depth at which the n-th bet exactly fits is
 *   S_n(f) = [(1+2f)^n − 1] / 2
 */

import { getSPRZone, SPR_ZONES } from '/home/user/Claude-Poker-Tracker/src/utils/exploitEngine/gameTreeConstants.js';

const STATED = [2, 4, 8, 13];

// ── Q2: derive thresholds from the stacking law ────────────────────────

const S_n = (n, f) => ((1 + 2 * f) ** n - 1) / 2;

const SIZINGS = [
  { label: '1.00x pot', f: 1.00 },
  { label: '0.75x pot', f: 0.75 },
  { label: '0.66x pot', f: 0.66 },
  { label: '0.50x pot', f: 0.50 },
  { label: '0.33x pot', f: 0.33 },
];

console.log('='.repeat(78));
console.log('AS-GUT-2 · Q2 — do the stated SPR zone cuts follow from the stacking law?');
console.log('='.repeat(78));
console.log();
console.log('S_n(f) = stack depth (in pots) at which the n-th bet of fraction f exactly fits');
console.log();
console.log('sizing        n=1     n=2     n=3     n=4     n=5');
for (const { label, f } of SIZINGS) {
  const row = [1, 2, 3, 4, 5].map(n => S_n(n, f).toFixed(2).padStart(6)).join('  ');
  console.log(`${label.padEnd(12)} ${row}`);
}

console.log();
console.log(`Codebase zone cuts (gameTreeConstants.js:93-97): ${STATED.join(' · ')}`);
console.log();
console.log('Nearest stacking-law threshold for each stated cut:');
console.log('stated   nearest law threshold              abs err   rel err');
for (const cut of STATED) {
  let best = null;
  for (const { label, f } of SIZINGS) {
    for (let n = 1; n <= 6; n++) {
      const s = S_n(n, f);
      const err = Math.abs(s - cut);
      if (!best || err < best.err) best = { err, s, n, label };
    }
  }
  const rel = (best.err / cut * 100).toFixed(1);
  console.log(
    `${String(cut).padStart(5)}    n=${best.n} at ${best.label} -> ${best.s.toFixed(2).padStart(6)}` +
    `${' '.repeat(9)}${best.err.toFixed(2).padStart(5)}   ${rel.padStart(5)}%`
  );
}

console.log();
console.log('Pot-sized-bet sequence exactly: S_n(1.00) = (3^n - 1)/2');
console.log(`  n=1 -> ${S_n(1, 1)}   n=2 -> ${S_n(2, 1)}   n=3 -> ${S_n(3, 1)}   n=4 -> ${S_n(4, 1)}`);

// ── Q1: is the argmax switch-like, and are switch points stable? ───────
// First-principles one-street EV, no zone lookup anywhere.
//   villain defends at MDF, so folds bet/(pot+bet)   [POKER_THEORY §6.2/6.3]
//   EV(bet b) = pFold·P + (1-pFold)·(E·(P+2b) - b)   [POKER_THEORY §6.1]
// Bets capped by the stack.

const P = 1;
const evBet = (b, E) => {
  const pFold = b / (P + b);
  return pFold * P + (1 - pFold) * (E * (P + 2 * b) - b);
};
const evCheck = (E) => E * P;

const CANDIDATE_FRACTIONS = [0.33, 0.5, 0.75, 1.0, 1.5, 2.0];

const bestAction = (spr, E) => {
  let best = { label: 'check', ev: evCheck(E) };
  for (const f of CANDIDATE_FRACTIONS) {
    const b = Math.min(f, spr);
    if (b <= 0) continue;
    const ev = evBet(b, E);
    const label = b < f - 1e-9 ? 'all-in' : `bet ${f}`;
    if (ev > best.ev + 1e-12) best = { label, ev };
  }
  return best.label;
};

console.log();
console.log('='.repeat(78));
console.log('AS-GUT-2 · Q1 — where does the EV-optimal action actually switch?');
console.log('='.repeat(78));
console.log();
console.log('First-principles model: MDF defence + fold-equity EV. No zone lookup.');
console.log('Sweeping SPR 0.10 -> 25.00 in steps of 0.01, per hero-equity level.');
console.log();
console.log('  equity   switch points in SPR');
const allSwitches = [];
for (const E of [0.25, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85]) {
  const switches = [];
  let prev = bestAction(0.1, E);
  for (let spr = 0.11; spr <= 25.0001; spr += 0.01) {
    const cur = bestAction(spr, E);
    if (cur !== prev) { switches.push(Number(spr.toFixed(2))); prev = cur; }
  }
  allSwitches.push(...switches);
  console.log(`  ${E.toFixed(2)}     ${switches.length ? switches.join(', ') : '(none)'}`);
}

const uniq = [...new Set(allSwitches)].sort((a, b) => a - b);
console.log();
console.log(`All distinct switch points observed: ${uniq.length ? uniq.join(', ') : '(none)'}`);
if (uniq.length) console.log(`Largest switch point: ${Math.max(...uniq)}`);
console.log();
console.log('Zone assignment of each observed switch (per the codebase classifier):');
for (const s of uniq) console.log(`  SPR ${String(s).padStart(5)} -> ${getSPRZone(s)}`);

console.log();
const hits = STATED.filter(c => uniq.some(u => Math.abs(u - c) < 0.05));
console.log(`Stated cuts {2,4,8,13} appearing as observed switch points: ${hits.length} of 4 ${hits.length ? '(' + hits.join(', ') + ')' : ''}`);
console.log();
console.log(`SPR_ZONES vocabulary: ${Object.values(SPR_ZONES).join(' · ')}`);
