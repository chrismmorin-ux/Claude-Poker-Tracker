/**
 * mine-pole-priors.mjs — the k=2 pole priors, mined as a RE-FITTABLE artifact.
 *
 * WHAT THIS IS (founder direction 2026-08-12, pre-registered in
 * ws436-baseline.md §4d). The archetype research found ONE dominant behavioural
 * axis with two poles (k=2, silhouette 0.3428). The pole-prior hypothesis:
 * a thin-history villain is better seeded by THEIR POLE's empirical action
 * distributions — mined from OTHER players — than by the whole population's.
 * That is partial pooling toward a group mean, which the refuted own-stats
 * seed (§4b) was not: the pole rows are other players' decisions, so the
 * same-source double-count does not apply to the VALUES. The villain's own
 * hands contribute only the ASSIGNMENT (bounded, and the soft form has no
 * threshold cliff — §11.4).
 *
 * RE-FITTABLE BY DESIGN (the founder's transfer point): nothing here is
 * corpus-specific. Point it at any file set — including the live segment when
 * volume allows — and it emits the same artifact shape: centroids, a
 * projection axis with a measured softness width, and per-pole pooled action
 * distributions. The consumer (`runner.mjs` pole arms) reads the artifact,
 * never constants.
 *
 * DETERMINISTIC: 2-means initialised at the loose-sticky diagonal extremes
 * (not random), Lloyd iterations to a fixed point. Same input → same artifact.
 *
 * USAGE
 *   node scripts/backtest/mine-pole-priors.mjs --reference out/pool-reference.json \
 *     [--out out/pole-priors.json] [--max-players 300] [--max-hands-per-player 300] \
 *     [--pool-pct 50] [--stakes 50NLH]
 */

import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import { discoverCorpusFiles, DEFAULT_CORPUS_ROOT } from './corpusFiles.mjs';

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
const int = (v, d) => (v === undefined ? d : Number.parseInt(v, 10));
const list = (v) => (typeof v === 'string' ? v.split(',').map(s => s.trim()).filter(Boolean) : null);

const FACINGS = { none: ['check', 'bet'], bet: ['fold', 'call', 'raise'], raise: ['fold', 'call', 'raise'] };
const WILDCARD = '*';

const main = async () => {
  const args = parseArgs(process.argv);
  if (args.reference === undefined) {
    throw new Error('Missing --reference. Pass a POOL table path or `--reference none`.');
  }
  const referenceTable = (args.reference === 'none' || args.reference === true)
    ? null
    : JSON.parse(readFileSync(args.reference, 'utf8'));

  const files = await discoverCorpusFiles({
    root: args['corpus-root'] || DEFAULT_CORPUS_ROOT,
    stakes: list(args.stakes) || ['50NLH'],
  });
  console.log(`corpus: ${files.length} file(s)`);

  const loader = await openLoader(process.cwd());
  try {
    const { indexEvalPlayers, segmentFor } = await loader.load('/scripts/backtest/runner.mjs');
    const { GROUPS, DEFAULT_POOL_PCT } = await loader.load('/scripts/backtest/partition.mjs');
    const { buildPlayerStats, derivePercentages } = await loader.load('/src/utils/tendencyCalculations.js');
    const { resolveStatPriors } = await loader.load('/src/utils/exploitEngine/poolBaseline.js');
    const { buildRangeProfile } = await loader.load('/src/utils/rangeEngine/index.js');
    const { accumulateDecisions } = await loader.load('/src/utils/exploitEngine/decisionAccumulator.js');
    const { aggregateBuckets } = await loader.load('/src/utils/exploitEngine/villainDecisionModel.js');

    const poolPct = int(args['pool-pct'], DEFAULT_POOL_PCT);
    const { byPlayer, handsRead } = await indexEvalPlayers({
      files,
      poolPct,
      maxPlayers: int(args['max-players'], 300),
      maxHandsPerPlayer: int(args['max-hands-per-player'], 300),
      group: GROUPS.POOL,
      onProgress: ({ handsRead: h, players }) => console.log(`  ${h} hands read, ${players} pool players`),
    });

    // ── per-player coordinates + per-facing action counts ─────────────────────
    const players = [];
    let profiled = 0;
    for (const [pid, hands] of byPlayer) {
      let profile;
      try { profile = buildRangeProfile(pid, hands, 'polemine'); } catch { continue; }
      if (!profile) continue;
      let summary;
      try { summary = accumulateDecisions(pid, hands, profile, 'polemine'); } catch { continue; }
      if (!summary?.buckets) continue;

      const stats = buildPlayerStats(pid, hands);
      const { segmentKey, seatBucket } = segmentFor(hands);
      const statPriors = resolveStatPriors({
        segmentKey, seatBucket, referenceTable, excludePlayerId: pid, poolIndex: null,
      });
      const pct = derivePercentages(stats, statPriors);
      if (!pct?.shrunk) continue;

      const counts = {};
      let decisions = 0;
      for (const [facing, responses] of Object.entries(FACINGS)) {
        const pattern = {
          street: WILDCARD, texture: WILDCARD, posCategory: WILDCARD,
          isAgg: WILDCARD, isIP: WILDCARD, facingAction: facing, contextAction: WILDCARD,
        };
        const { actionCounts, totalN } = aggregateBuckets(summary.buckets, pattern);
        counts[facing] = {};
        for (const a of responses) counts[facing][a] = actionCounts[a] || 0;
        decisions += totalN;
      }

      players.push({
        pid,
        // The research axis: looseness (vpip) and stickiness (1 − foldToCbet).
        x: pct.shrunk.vpip,
        y: pct.shrunk.foldToCbet,
        counts,
        decisions,
        hands: hands.length,
      });
      profiled++;
      if (profiled % 50 === 0) console.log(`  profiled ${profiled} players`);
    }
    console.log(`profiled ${players.length} POOL players from ${handsRead} hands.`);
    if (players.length < 40) throw new Error(`Only ${players.length} usable players — too thin to fit poles.`);

    // ── deterministic 2-means on (vpip, foldToCbet) ───────────────────────────
    // Init at the loose-sticky diagonal extremes (max x−y and min x−y), then
    // Lloyd to a fixed point. No RNG, so the artifact is a pure function of input.
    const score = (p) => p.x - p.y; // loose-and-sticky is high-x, low-y
    let a0 = players[0], b0 = players[0];
    for (const p of players) {
      if (score(p) > score(a0)) a0 = p;
      if (score(p) < score(b0)) b0 = p;
    }
    let cA = { x: a0.x, y: a0.y };
    let cB = { x: b0.x, y: b0.y };
    const d2 = (p, c) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2;
    let assign = new Array(players.length).fill('A');
    for (let iter = 0; iter < 100; iter++) {
      let changed = false;
      players.forEach((p, i) => {
        const next = d2(p, cA) <= d2(p, cB) ? 'A' : 'B';
        if (next !== assign[i]) { assign[i] = next; changed = true; }
      });
      const mean = (side) => {
        const m = players.filter((_, i) => assign[i] === side);
        return {
          x: m.reduce((s, p) => s + p.x, 0) / m.length,
          y: m.reduce((s, p) => s + p.y, 0) / m.length,
          n: m.length,
        };
      };
      const mA = mean('A'), mB = mean('B');
      if (mA.n === 0 || mB.n === 0) throw new Error('degenerate pole (empty cluster)');
      cA = { x: mA.x, y: mA.y };
      cB = { x: mB.x, y: mB.y };
      if (!changed) break;
    }

    // ── projection axis + measured softness ───────────────────────────────────
    const axis = { dx: cB.x - cA.x, dy: cB.y - cA.y };
    const norm = Math.hypot(axis.dx, axis.dy);
    const unit = { dx: axis.dx / norm, dy: axis.dy / norm };
    const proj = (p) => (p.x - cA.x) * unit.dx + (p.y - cA.y) * unit.dy;
    const midpoint = norm / 2;
    const sds = ['A', 'B'].map((side) => {
      const m = players.filter((_, i) => assign[i] === side).map(proj);
      const mu = m.reduce((s, v) => s + v, 0) / m.length;
      return Math.sqrt(m.reduce((s, v) => s + (v - mu) ** 2, 0) / Math.max(1, m.length - 1));
    });
    // Softness = pooled within-pole SD of the projection: the logistic resolves no
    // finer than the clusters themselves separate (the WS-366 lesson — a width
    // borrowed from the wrong statistic turns a soft boundary into a step).
    const width = (sds[0] + sds[1]) / 2;

    // ── per-pole pooled action distributions ─────────────────────────────────
    const poolRows = (side) => {
      const members = players.filter((_, i) => assign[i] === side);
      const rows = {};
      for (const [facing, responses] of Object.entries(FACINGS)) {
        const total = {};
        for (const a of responses) total[a] = members.reduce((s, p) => s + p.counts[facing][a], 0);
        const sum = Object.values(total).reduce((s, v) => s + v, 0);
        rows[facing] = {};
        for (const a of responses) rows[facing][a] = sum > 0 ? total[a] / sum : 1 / responses.length;
      }
      return {
        distributions: rows,
        players: members.length,
        decisions: members.reduce((s, p) => s + p.decisions, 0),
      };
    };

    const artifact = {
      schemaVersion: 1,
      builtFrom: {
        group: 'POOL',
        poolPct,
        files: files.length,
        handsRead,
        playersProfiled: players.length,
        maxPlayers: int(args['max-players'], 300),
        maxHandsPerPlayer: int(args['max-hands-per-player'], 300),
        referenceTier: referenceTable ? 'stamped-table' : 'founder-estimate',
        axisDefinition: 'coords = (shrunk.vpip, shrunk.foldToCbet); pole A = loose-sticky extreme init',
      },
      centroids: { A: cA, B: cB },
      projection: { origin: cA, unit, midpoint, width, interCentroidDistance: norm },
      poles: { A: poolRows('A'), B: poolRows('B') },
    };

    const out = typeof args.out === 'string' ? args.out : 'out/pole-priors.json';
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify(artifact, null, 2));
    console.log(`Wrote ${out}`);
    console.log(`  pole A (loose-sticky): ${artifact.poles.A.players} players, ${artifact.poles.A.decisions} decisions, centroid vpip=${cA.x.toFixed(3)} ftc=${cA.y.toFixed(3)}`);
    console.log(`  pole B (tight-foldy) : ${artifact.poles.B.players} players, ${artifact.poles.B.decisions} decisions, centroid vpip=${cB.x.toFixed(3)} ftc=${cB.y.toFixed(3)}`);
    console.log(`  bet-facing rows: A fold ${artifact.poles.A.distributions.bet.fold.toFixed(3)} vs B fold ${artifact.poles.B.distributions.bet.fold.toFixed(3)}`);
  } finally {
    await loader.close();
  }
};

main().catch((e) => { console.error(`\n${e.stack || e.message}\n`); process.exit(1); });
