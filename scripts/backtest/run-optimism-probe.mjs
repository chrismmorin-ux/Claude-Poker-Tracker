#!/usr/bin/env node
/**
 * run-optimism-probe.mjs — how much of the engine's stated EV is the max talking? (WS-295)
 *
 * WHAT THIS RUNS ON, stated first because it is the whole conditional. NOT the corpus. This
 * evaluates a FIXED set of synthetic nodes R times each, varying only the estimator's random
 * seed, and decomposes the gap between what the engine states and what the action it picked
 * is worth. See `optimismBias.mjs` for the decomposition and for the standing caveat that the
 * replicate mean is the estimator's own mean, never truth.
 *
 * WHY SYNTHETIC IS THE RIGHT DESIGN HERE, and not a compromise. The quantity of interest is
 * `E[max_a EVhat(a)] - max_a E[EVhat(a)]` — an expectation over the estimator's OWN sampling
 * distribution at a fixed node. Recovering that needs REPEATED draws at the SAME node, which
 * a corpus pass cannot supply: each corpus decision is visited exactly once. A corpus run
 * measures the curse's SHAPE across nodes (which is what WS-295's accept criteria ask for);
 * only a replicate design measures its SIZE. The two are complementary and neither
 * substitutes for the other.
 *
 * THE CLOCK IS FROZEN, on purpose. `Date.now` is pinned so the refinement budget never trips
 * and the full depth-2/3 tree runs on every replicate. Otherwise the bailout point moves with
 * machine load and the measured spread would be a mixture of estimator noise and scheduling
 * noise, with no way to attribute it.
 *
 * ── WS-496: THE REPLICATE IS `rngSalt`, NOT `Math.random` ──
 * This probe used to sweep 200 seeds by overriding the global `Math.random`. It produced
 * noiseSd = 0.0e+0 on all 8 nodes in BOTH arms, meanArgmaxStability = 1.0, and a reported
 * curse of 1e-13 to 1e-15 — floating-point dust. Six UNDERPOWERED verdicts, and not one of
 * them was a sample-size complaint.
 *
 * The engine's runout sampler is `boardDerivedRng(cards, salt)`, seeded from the BOARD CARDS.
 * It reads `Math.random` nowhere, deliberately — determinism was made free in WS-355/WS-393 so
 * a flip caused by the sampler could never be mistaken for one caused by a code change. So the
 * 200 seeds were 200 IDENTICAL COMPUTATIONS. The estimand is induced by estimator variation;
 * with no variation it is zero by construction, and the run could not have answered at any
 * replicate count. More replicates was the one response guaranteed not to help.
 *
 * `rngSalt` (WS-496) is XORed into every stream salt inside one evaluation, so sweeping it
 * gives genuinely independent SAMPLING draws of the same node. `Math.random` is still pinned,
 * but only so that anything else that might reach for it cannot add unattributed noise — it is
 * no longer the varying input.
 *
 * USAGE
 *   node scripts/backtest/run-optimism-probe.mjs --replicates 12 --out out/optimism.json
 *   node scripts/backtest/run-optimism-probe.mjs --replicates 12 --scenarios flop-wet-noaction-top30
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { nodeOptimism, optimismProblems, shapeReport } from './optimismBias.mjs';

const REPO = process.cwd();

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[k] = true;
    else { args[k] = n; i++; }
  }
  return args;
};

// Same generator dumpGameTreeEV uses, so a seed means the same draw sequence in both.
const mulberry32 = (seed) => () => {
  seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const FROZEN_NOW = 1_700_000_000_000;
const realNow = Date.now;
const realRandom = Math.random;
/**
 * Pin the ambient nondeterminism. NOT the replicate — see the WS-496 note in the header.
 *
 * `Math.random` is still pinned to a fixed stream so that any code path which does reach for it
 * contributes the SAME draw on every replicate, leaving `rngSalt` as the only varying input.
 * Pinning it to a per-replicate seed is exactly what made this probe measure nothing.
 */
const freeze = () => {
  const rng = mulberry32(0x5eed);
  Math.random = () => rng();
  Date.now = () => FROZEN_NOW;
};
const restore = () => { Date.now = realNow; Math.random = realRandom; };

/**
 * The two depth arms.
 *
 * `depth-1` is `refinementBudgetMs: 0` — the configuration that shipped in production for the
 * life of the project (WS-334 measured zero depth-2 calls on a live evaluation), so it is a
 * real historical arm rather than a hypothetical. `depth-2plus` is the engine's own default
 * with the clock frozen, i.e. the full refined tree.
 *
 * WS-361 is the reason both are run. If depth-2's outputs disagree with depth-1 in ways that
 * look wrong, and the named suspect is `E[max]` optimism, then the arms must be compared on
 * exactly this quantity — same nodes, same replicate count, same seeds.
 */
const ARMS = [
  { id: 'depth-1', refinementBudgetMs: 0 },
  { id: 'depth-2plus', refinementBudgetMs: 2000 },
];

const main = async () => {
  const args = parseArgs(process.argv);
  const R = Number.parseInt(args.replicates ?? '12', 10);
  if (!Number.isFinite(R) || R < 2) {
    console.error('--replicates must be >= 2; the whole design is repeated draws at one node.');
    process.exit(2);
  }
  const only = typeof args.scenarios === 'string' ? new Set(args.scenarios.split(',')) : null;

  const loader = await openLoader(REPO);
  try {
    const { evaluateGameTree } = await loader.load('/src/utils/exploitEngine/gameTreeEvaluator.js');
    const { parseAndEncode } = await loader.load('/src/utils/pokerCore/cardParser.js');
    const { tightRange, topRange, fullRange } =
      await loader.load('/src/utils/exploitEngine/__tests__/fixtures/ranges.js');
    const { registerVersion } = await loader.load('/src/utils/standardOfRecord/faultRegister.js');

    // Guarded exactly as dumpGameTreeEV guards it: an unparseable suit encodes to -1, three
    // of which still satisfy `board.length >= 3`, and the whole tree then runs on garbage and
    // produces a plausible-looking result that exercises nothing.
    const cards = (...strs) => {
      const encoded = strs.map(parseAndEncode);
      const bad = strs.filter((_, i) => encoded[i] < 0);
      if (bad.length) throw new Error(`unparseable card(s): ${bad.join(', ')} — suits must be ♠♥♦♣`);
      return encoded;
    };

    // The scenario set is dumpGameTreeEV's, unchanged. Reusing it rather than inventing one
    // means this probe and the bit-identity harness are talking about the same nodes, and a
    // reader can line the two artifacts up.
    const SCENARIOS = [
      { name: 'flop-dry-noaction-tight', board: cards('A♠', '7♥', '2♦'), hero: cards('K♦', 'Q♦'),
        range: () => tightRange(), villainAction: null, villainBet: 0, pot: 100, stack: 900 },
      { name: 'flop-dry-facing-bet-tight', board: cards('A♠', '7♥', '2♦'), hero: cards('K♦', 'Q♦'),
        range: () => tightRange(), villainAction: 'bet', villainBet: 65, pot: 100, stack: 900 },
      { name: 'flop-wet-noaction-top30', board: cards('J♥', 'T♥', '9♦'), hero: cards('A♣', 'A♦'),
        range: () => topRange(30), villainAction: null, villainBet: 0, pot: 120, stack: 800 },
      { name: 'flop-wet-facing-bet-top30', board: cards('J♥', 'T♥', '9♦'), hero: cards('Q♠', 'Q♣'),
        range: () => topRange(30), villainAction: 'bet', villainBet: 80, pot: 120, stack: 800 },
      { name: 'flop-wet-facing-raise-full', board: cards('J♥', 'T♥', '9♦'), hero: cards('K♥', 'Q♥'),
        range: () => fullRange(), villainAction: 'raise', villainBet: 150, pot: 200, stack: 700 },
      { name: 'turn-noaction-top30', board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('A♥', 'K♣'),
        range: () => topRange(30), villainAction: null, villainBet: 0, pot: 200, stack: 600 },
      { name: 'turn-facing-bet-tight', board: cards('A♠', '7♥', '2♦', '9♣'), hero: cards('7♠', '7♦'),
        range: () => tightRange(), villainAction: 'bet', villainBet: 120, pot: 200, stack: 600 },
      { name: 'turn-wet-facing-bet-top50', board: cards('J♥', 'T♥', '9♦', '2♥'), hero: cards('A♥', 'J♠'),
        range: () => topRange(50), villainAction: 'bet', villainBet: 140, pot: 260, stack: 540 },
    ].filter((s) => !only || only.has(s.name));

    const out = {
      // Everything a replication needs, in the artifact rather than in this file's history.
      config: {
        replicates: R,
        arms: ARMS,
        frozenNow: FROZEN_NOW,
        // WS-496: the replicate axis. Non-zero and mutually distinct — 0 is the engine's
        // historical stream, so including it would make one replicate special.
        rngSalts: Array.from({ length: R }, (_, i) => 0x9e37 + i * 0x2545),
        replicateAxis: 'rngSalt',
        // Retained so an artifact from before 2026-08-19 is still identifiable as the broken
        // design rather than looking like a run that merely found nothing.
        rngSeeds: null,
        trials: 200,
        scenarios: SCENARIOS.map((s) => s.name),
        generator: 'mulberry32',
      },
      scope:
        'SYNTHETIC NODES, not corpus hands. Measures optimism induced by the engine estimator\'s '
        + 'OWN sampling noise at a fixed node; a bias shared by every replicate is invisible here '
        + 'by construction, so every figure is a LOWER BOUND on the total curse. Units are the '
        + 'engine\'s internal chips at the stated pot sizes, NOT bb and NOT a winrate.',
      liveTransfer:
        'This is evidence about the ESTIMATOR\'S STRUCTURE. It is not anchored to any pool, so it '
        + 'is neither a 2009-online result nor a live 1/2-1/3 constant. Any live magnitude read '
        + 'off it would be transferred, not measured.',

      // ─────────────────────────────────────────────────────────────────────────────────────
      // WHY THERE IS NO RESULT CARD HERE, stated rather than silently omitted.
      //
      // ADR-009 binds COMPARATIVE claims to a Result Card, and a Result Card requires a Match:
      // surfaceId x dealBookId x fieldId. This probe has none of the three — it evaluates
      // synthetic nodes against no Deal Book and no Field, and it compares an estimator to
      // ITSELF rather than one strategy to another. `resultCardProblems` rejects a card whose
      // match ids are absent, and inventing ids to get past that check is exactly the failure
      // the standard exists to stop.
      //
      // The vocabulary's own home for a measurement of this kind is the Suspected-Fault
      // Register, and two entries are directly on point:
      //
      //   FAULT-self-grading-circularity    (instrument, P=0.80) — its falsifier reads "Score
      //     the same decisions against REALIZED chips and against model EV; a systematic gap in
      //     the engine's favour is the optimizer's curse made visible." That falsifier is the
      //     CORPUS arm of WS-295, not this probe; this probe bounds one term of it.
      //   FAULT-monte-carlo-irreproducibility (instrument, P=1.00, partially-supported) — whose
      //     open status rests on the noise floor never having been measured. The per-action
      //     `sdEv` figures below are a measurement of that floor at these nodes, though NOT the
      //     run-level Deal-Book spread its falsifier asks for.
      //
      // The register version is stamped so that a fault confirmed tomorrow can find this
      // artifact, which is the same guarantee `manifest.disclaimerRegisterVersion` gives a card.
      // ─────────────────────────────────────────────────────────────────────────────────────
      isResultCard: false,
      notAResultCardBecause:
        'no Match — this probe has no Deal Book, no Field, and no second surface. It compares '
        + 'the estimator to itself. Under ADR-009 it is fault-register evidence, not a Result Card.',
      bearsOnFaults: ['FAULT-self-grading-circularity', 'FAULT-monte-carlo-irreproducibility'],
      disclaimerRegisterVersion: await registerVersion(),
      arms: {},
    };

    for (const arm of ARMS) {
      const nodes = [];
      for (const s of SCENARIOS) {
        const replicates = [];
        const t0 = realNow();
        for (let r = 0; r < R; r++) {
          // A DIFFERENT rngSalt per replicate — this is the only varying input. Same salt list
          // across arms and scenarios so the arms are paired draw-for-draw.
          freeze();
          let result = null;
          try {
            // eslint-disable-next-line no-await-in-loop -- the engine call is the whole cost
            result = await evaluateGameTree({
              villainRange: s.range(),
              board: s.board,
              heroCards: s.hero,
              potSize: s.pot,
              villainAction: s.villainAction,
              villainBet: s.villainBet,
              effectiveStack: s.stack,
              playerStats: { style: 'TAG', vpip: 22, pfr: 18, af: 2.5, cbet: 60 },
              villainModel: null,
              contextHints: { isIP: true, texture: 'unknown', posCategory: 'LATE' },
              trials: 200,
              refinementBudgetMs: arm.refinementBudgetMs,
              rngSalt: out.config.rngSalts[r],
            });
          } catch (err) {
            restore();
            console.log(`  ${s.name} r${r}: engine error ${err?.message || err}`);
            continue;
          }
          restore();
          const recs = result?.recommendations || [];
          if (!recs.length) continue;
          replicates.push(Object.fromEntries(recs.map((x) => [
            // Sizing is part of the ACTION for the purposes of an argmax — 'bet 33%' and
            // 'bet 75%' are two candidates the max chooses between, and collapsing them to
            // 'bet' would hide exactly the branching that drives the bias.
            x.sizing?.betFraction != null ? `${x.action}@${x.sizing.betFraction}` : x.action,
            x.ev,
          ])));
        }
        const node = nodeOptimism(replicates);
        const elapsed = realNow() - t0;
        if (node) {
          node.cluster = s.name;
          node.scenario = s.name;
          node.problems = optimismProblems(node);
          nodes.push(node);
        }
        console.log(
          `${arm.id.padEnd(12)} ${s.name.padEnd(32)} ${String(elapsed).padStart(6)}ms  `
          + (node
            ? `acts=${node.nActions} curse=${node.curse.toFixed(3)} jensen=${node.jensenGap.toFixed(3)} `
              + `sel=${node.selectionLoss.toFixed(3)} noise=${node.meanNoiseSd.toFixed(3)} `
              + `margin=${node.topTwoMargin.toFixed(3)} stab=${node.argmaxStability.toFixed(2)}`
            : 'no decomposition'),
        );
      }

      // The aggregate is a plain mean over nodes, and it is a mean over a HAND-PICKED
      // scenario set — not a population estimate. Named as such so it cannot be read as one.
      const finite = nodes.filter((n) => Number.isFinite(n.curse));
      const mean = (k) => (finite.length ? finite.reduce((s, n) => s + n[k], 0) / finite.length : null);
      out.arms[arm.id] = {
        refinementBudgetMs: arm.refinementBudgetMs,
        nodes,
        aggregate: {
          nodesScored: finite.length,
          note: 'unweighted mean over a hand-picked scenario set — descriptive, not a population estimate',
          meanCurse: mean('curse'),
          meanJensenGap: mean('jensenGap'),
          meanSelectionLoss: mean('selectionLoss'),
          meanNoiseSd: mean('meanNoiseSd'),
          meanTopTwoMargin: mean('topTwoMargin'),
          meanStatedEv: mean('stated'),
          meanRealizedEv: mean('realized'),
          meanArgmaxStability: mean('argmaxStability'),
          // The number a reader will want: the curse as a fraction of what the engine states.
          // Reported only when the stated level is far enough from zero for a ratio to mean
          // anything — a ratio against a near-zero denominator is a divide-by-noise.
          curseAsShareOfStated: (() => {
            const st = mean('stated');
            const cu = mean('curse');
            if (st === null || cu === null || Math.abs(st) < 1) return null;
            return cu / Math.abs(st);
          })(),
        },
        shape: shapeReport(nodes),
      };
    }

    // THE WS-361 CONTRAST. Paired by scenario, so the difference is the arm and not the node.
    const d1 = new Map((out.arms['depth-1']?.nodes ?? []).map((n) => [n.scenario, n]));
    const d2 = new Map((out.arms['depth-2plus']?.nodes ?? []).map((n) => [n.scenario, n]));
    const paired = [...d2.keys()].filter((k) => d1.has(k)).map((k) => ({
      scenario: k,
      depth1Curse: d1.get(k).curse,
      depth2Curse: d2.get(k).curse,
      curseDelta: d2.get(k).curse - d1.get(k).curse,
      depth1Actions: d1.get(k).nActions,
      depth2Actions: d2.get(k).nActions,
      depth1Noise: d1.get(k).meanNoiseSd,
      depth2Noise: d2.get(k).meanNoiseSd,
      depth1Stated: d1.get(k).stated,
      depth2Stated: d2.get(k).stated,
      statedDelta: d2.get(k).stated - d1.get(k).stated,
    }));
    out.ws361 = {
      question: 'Is depth-2\'s disagreement with depth-1 explained by E[max] optimism?',
      paired,
      meanCurseDelta: paired.length
        ? paired.reduce((s, p) => s + p.curseDelta, 0) / paired.length : null,
      meanStatedDelta: paired.length
        ? paired.reduce((s, p) => s + p.statedDelta, 0) / paired.length : null,
      readingRule:
        'The suspect is CONFIRMED only if depth-2 carries a materially larger curse than depth-1 '
        + 'AND that difference is a material share of the stated-EV difference between the arms. '
        + 'If depth-2 raises stated EV far more than it raises the curse, the disagreement has '
        + 'another cause and this suspect is REFUTED as its explanation.',
    };

    if (typeof args.out === 'string') {
      mkdirSync(dirname(args.out), { recursive: true });
      writeFileSync(args.out, JSON.stringify(out, null, 2));
      console.log(`\nWrote ${args.out}`);
    }
  } finally {
    restore();
    await loader.close();
  }
};

main().catch((e) => { restore(); console.error(e?.stack || String(e)); process.exit(1); });
