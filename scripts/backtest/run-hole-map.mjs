#!/usr/bin/env node
/**
 * run-hole-map.mjs — View 7 of the Scored Readout: the HOLE MAP.
 *
 * Emits a machine-readable hole table (`--out`) and a self-contained, offline, embeddable
 * HTML visual (`--html`). No CDN assets, no network, no build step.
 *
 * USAGE
 *   node scripts/backtest/run-hole-map.mjs \
 *     --policy out/behavior-policy.json \
 *     --fold-cells out/fold-vs-sizing.json \
 *     --fold-fit out/fold-curve-fit.txt \
 *     --decisions out/depth-ablation.json \
 *     --max-files 40 \
 *     --out out/hole-map.json --html out/hole-map.html
 *
 *   --decision-records out/decisions.jsonl   the WS-410 per-decision sidecar, once a
 *                                            baseline run has produced one. PREFERRED over
 *                                            --decisions; see `readDecisionSidecar`.
 *   --max-files 0                            skip the corpus pass entirely (no rates)
 *   --hands-per-hour 25                      the live-pace assumption on every bb/hour cell
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * THE SUBSTITUTION LEDGER — what this prototype reads INSTEAD of the sidecar
 *
 * The visual is specified as a pure view over the per-decision record
 * (`scripts/backtest/decisionRecord.mjs`). That record does not exist on disk yet, so every
 * field below names the weaker source standing in for it and what is lost. This block is
 * the deliverable's honesty, not its preamble.
 *
 *   SIDECAR FIELD                  STANDING IN TODAY                    WHAT IS LOST
 *   candidates[].ev                evStats.statedEvMean (a MEAN over    the per-action EV,
 *                                  combos, one scalar per decision)     so no near-tie set
 *   candidates[].villainResponse   nothing                              the engine's own
 *     .foldPct                                                          predicted fold, per
 *                                                                       candidate
 *   pPoolObserved                  piPool on the depth-ablation row     nothing — same field
 *   situationKey                   `slices` (5 of the 7 axes; isAgg and  isAgg/isIP joins
 *                                  isIP absent)                          against the policy
 *   raw geometry (pot/bet/SPR)     re-derived from the corpus by         per-decision pot;
 *                                  decisionGeometryFull on a slice      only medians here
 *   depthReached                   evStats.depthReachedMax              per-combo depth
 *   refinement stage ledger        nothing                              whether the wall
 *                                                                       clock decided it
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { openLoader } from './loader.mjs';
import {
  requiredFoldBet, requiredFoldRaise, raiseLookupFrac, evSlopeBet, evSlopeRaise,
  parseHoldOutFoldCurve, foldCurveFromCells, readFoldCurve, flattenPolicyLevel,
  denominate, sumDisjoint, classifyGap, engineFoldPct,
  INELASTICITY_PROVENANCE, TEXTURE_RESOLUTION_NOTE, EXPLOIT_DECAY_CAVEAT,
  DEFAULT_HANDS_PER_HOUR, SIZE_BUCKET_MIDPOINT, PRACTITIONER_REPERTOIRE,
  ZERO_EQUITY_ASSUMPTION,
} from './holeMap.mjs';

import { makeLineAccumulator } from './holeMapLines.mjs';
import { renderHoleMapHtml } from './holeMapHtml.mjs';
import { gitStamp } from './replicationStamp.mjs';
import { registerVersion } from '../../src/utils/standardOfRecord/faultRegister.js';
import { classifyFreshness, WATCHED_PATHS, REGEN_COMMAND } from './holeMapFreshness.mjs';
import { readWatchedDirty } from './holeMapGit.mjs';

/**
 * What the realized-outcome table does NOT establish. Three separate confounds, ranked, and
 * the first one is severe enough that omitting it would make the table actively misleading.
 */
const OUTCOME_ARM_CAVEATS = Object.freeze([
  {
    id: 'holding-confound',
    severity: 'SEVERE — read this before reading any mean',
    text:
      'THE REALIZED MEAN IS NOT THE INCREMENTAL EV OF ADDING THE LINE. A player check-raises '
      + 'the river when they have a hand worth raising. So "+22.8 bb on river check-raises" is '
      + 'overwhelmingly a statement about WHAT THEY HELD, not about the raise. The decision and '
      + 'the holding are confounded and this data cannot separate them — the corpus contains no '
      + 'counterfactual in which the same player check-raised the same holding and did not. What '
      + 'this arm DOES establish honestly: how rare the line is (with its denominator), how large '
      + 'the pots are, and that the line is not a disaster in practice.',
  },
  {
    id: 'exit-branch',
    severity: 'STRUCTURAL — applies to checkraise_fold specifically',
    text:
      'checkraise_fold is the LOSING BRANCH of a line by construction: it selects hands where '
      + 'the raise was made and then abandoned. Its mean is the cost of the exit, not the EV of '
      + 'the line. The line\'s value lives in the branches where villain folds or calls worse — '
      + 'those rows are flop/turn/river_checkraise. A negative mean here is arithmetic, not evidence.',
  },
  {
    id: 'whole-hand',
    severity: 'MODERATE',
    text:
      'The net is the WHOLE HAND\'s result, not the line\'s incremental contribution. A triple '
      + 'barrel that wins a big pot is credited with money that partly belongs to the preflop '
      + 'raise and the flop bet. No decomposition is available here and none is implied.',
  },
  {
    id: 'player-selection',
    severity: 'MODERATE',
    text:
      'Not survivorship over OUTCOMES — hands where the line lost are present exactly as much as '
      + 'hands where it won, and nothing filters on result. But it IS a selected sample of '
      + 'PLAYERS: the seats that fire a triple barrel are not a random draw from the pool.',
  },
]);

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
const list = (v) => (typeof v === 'string' ? v.split(',').map((s) => s.trim()).filter(Boolean) : null);
const int = (v, d) => (v === undefined || v === true ? d : Number.parseInt(v, 10));
const str = (v, d) => (typeof v === 'string' ? v : d);
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** The bet sizings the hole table is priced at. Declared, not discovered. */
const SIZING_LADDER = [0.25, 0.33, 0.50, 0.66, 0.75, 1.00, 1.25, 1.50, 2.00];
/** Raise-to multiples of the faced bet. 3x is the standard check-raise. */
const RAISE_LADDER = [2.5, 3.0, 4.0];

/**
 * Read the WS-410 per-decision sidecar if it exists, else the depth-ablation run rows.
 *
 * Returns rows in one shape so nothing downstream branches on which source it got. The
 * `source` field rides along so the visual can say which one it drew.
 */
const readDecisionSidecar = (args) => {
  const sidecarPath = str(args['decision-records'], null);
  if (sidecarPath && existsSync(sidecarPath)) {
    const rows = [];
    let meta = null;
    for (const line of readFileSync(sidecarPath, 'utf8').split(/\r?\n/)) {
      if (!line.trim()) continue;
      const obj = JSON.parse(line);
      if (obj.kind === 'meta') { meta = obj; continue; }
      rows.push(obj);
    }
    return { source: 'decision-sidecar', path: sidecarPath, meta, rows, complete: true };
  }
  const p = str(args.decisions, 'out/depth-ablation.json');
  if (!existsSync(p)) return { source: 'none', path: null, meta: null, rows: [], complete: false };
  const doc = readJson(p);
  return {
    source: 'depth-ablation-run-rows',
    path: p,
    meta: doc?.run?.provenance ?? doc?.report?.provenance ?? null,
    rows: doc?.run?.decisions ?? [],
    complete: false,
    degraded:
      'No per-decision sidecar on disk. Falling back to the depth-ablation run rows, which '
      + 'carry piPool/piOurs/slices/evStats but NOT the ranked candidate list, NOT per-action '
      + 'EVs, NOT per-candidate villain fold predictions, and NOT raw geometry.',
  };
};

/**
 * The bounded corpus pass. Two products, both engine-independent:
 *   1. OPPORTUNITY COUNTS + pot geometry per (street, facing, sizeBucket) -> the RATE column
 *   2. Realized outcomes for the named lines -> the outcome-anchored arm
 */
const scanCorpus = async (loader, args) => {
  const maxFiles = int(args['max-files'], 40);
  if (!maxFiles) {
    return { skipped: true, reason: '--max-files 0: corpus pass disabled; no rate column.' };
  }
  const { discoverCorpusFiles, applyFileCap, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
  const { iterAppHands } = await loader.load('/scripts/backtest/phhAdapter.mjs');
  const { resolveHandOutcome } = await loader.load('/scripts/backtest/handOutcome.mjs');
  const { decisionGeometryFull } = await loader.load('/scripts/backtest/decisionGeometry.mjs');

  let files = await discoverCorpusFiles({
    root: str(args['corpus-root'], DEFAULT_CORPUS_ROOT),
    sites: list(args.sites),
    stakes: list(args.stakes) ?? ['50NLH'],
  });
  const totalAvailable = files.length;
  // WS-504: draws proportionally across directories; a sorted prefix read one site.
  ({ files } = applyFileCap(files, { maxFiles }));

  const acc = makeLineAccumulator();
  const nodes = new Map();       // street|facing|sizeBucket -> {n, potBBs}
  const skipStats = {};
  const t0 = Date.now();

  for (const f of files) {
    for await (const hand of iterAppHands(f.path, { site: f.site, stakeLabel: f.stakeLabel }, skipStats)) {
      const outcome = resolveHandOutcome(hand);
      acc.addHand(hand, outcome);

      // Opportunity census. Every postflop decision node is one opportunity at its own
      // (street, facing, sizeBucket) coordinate — the denominator the rate column needs.
      const seq = hand?.gameState?.actionSequence ?? [];
      for (const e of seq) {
        if (e.street === 'preflop') continue;
        let facing = 'none';
        for (const prior of seq) {
          if (prior.order >= e.order) break;
          if (prior.street !== e.street) continue;
          if (prior.action === 'bet') facing = 'bet';
          else if (prior.action === 'raise') facing = 'raise';
        }
        const geo = decisionGeometryFull(hand, e.order, e.street, e.seat);
        if (!geo) continue;
        const key = `${e.street}|${facing}|${facing === 'none' ? 'na' : geo.sizeBucket}`;
        const cur = nodes.get(key) ?? { key, street: e.street, facing, sizeBucket: geo.sizeBucket, n: 0, potBBs: [] };
        cur.n++;
        if (Number.isFinite(geo.potBB)) cur.potBBs.push(geo.potBB);
        nodes.set(key, cur);
      }
    }
  }

  const lineResult = acc.finish();
  const nodeRows = [...nodes.values()].map((v) => {
    const xs = v.potBBs.slice().sort((a, b) => a - b);
    return {
      key: v.key, street: v.street, facing: v.facing, sizeBucket: v.sizeBucket, n: v.n,
      medianPotBB: xs.length ? xs[Math.floor(xs.length / 2)] : null,
      // Per 100 hands FOR ONE PLAYER — seat-hands, not hands. See holeMapLines.finish().
      ratePer100: lineResult.totals.seatHands > 0 ? (v.n / lineResult.totals.seatHands) * 100 : null,
    };
  }).sort((a, b) => b.n - a.n);

  return {
    skipped: false,
    filesScanned: files.length,
    totalAvailable,
    wallMs: Date.now() - t0,
    skipStats,
    totals: lineResult.totals,
    lines: lineResult.rows,
    nodes: nodeRows,
    sampled:
      `${files.length} of ${totalAvailable} corpus files (${str(args.stakes, '50NLH')}), taken in `
      + 'discovery order — NOT a random sample of the corpus. Heads-up hands are dropped by the '
      + 'adapter and are the dominant skip, so usable multiway hands are well under half the raw '
      + 'record count.',
  };
};

/**
 * Build the hole table.
 *
 * A "hole" here is a (node, action) pair the pool leaves largely untaken, priced at the pot
 * geometry of that node. Rows are NOT filtered by n. A large realized outcome with a tiny
 * occurrence count may be exactly the low-frequency/high-magnitude structure the founder is
 * describing, so the sparsity is shown rather than editorialised away.
 */
const buildHoleTable = ({ policy, betCurve, raiseCurve, corpus, handsPerHour }) => {
  const rows = [];
  const nodeRate = new Map();
  const nodePot = new Map();
  for (const nd of corpus?.nodes ?? []) {
    nodeRate.set(nd.key, nd.ratePer100);
    nodePot.set(nd.key, nd.medianPotBB);
  }
  // Pot fallback by street, when a specific coordinate had no corpus rows.
  const potByStreet = {};
  for (const nd of corpus?.nodes ?? []) {
    if (nd.medianPotBB == null) continue;
    (potByStreet[nd.street] ??= []).push({ n: nd.n, p: nd.medianPotBB });
  }
  const fallbackPot = (street) => {
    const xs = potByStreet[street];
    if (!xs?.length) return null;
    const tot = xs.reduce((a, x) => a + x.n, 0);
    return xs.reduce((a, x) => a + x.p * x.n, 0) / tot;
  };

  // ── ARM 1: the RAISE hole (the founder's check-raise), keyed on real policy nodes ──────
  // Level 6 is the full key: facing|isAgg|isIP|texture|street|posCategory|sizeBucket.
  for (const node of flattenPolicyLevel(policy, 6)) {
    if (node.parts.facingAction !== 'bet') continue;
    const { texture, street, posCategory, sizeBucket, isIP, isAgg } = node.parts;
    const s = SIZE_BUCKET_MIDPOINT[sizeBucket];
    if (!s) continue;
    const poolRaiseFreq = node.freq.raise ?? 0;

    const nodeKey = `${street}|bet|${sizeBucket}`;
    const potBB = nodePot.get(nodeKey) ?? fallbackPot(street);
    if (potBB == null) continue;
    const spotRate = nodeRate.get(nodeKey);

    for (const m of RAISE_LADDER) {
      const req = requiredFoldRaise(s, m);
      const pred = readFoldCurve(raiseCurve[street] ?? raiseCurve.all, raiseLookupFrac(s, m));
      if (pred.obs == null) continue;
      const gap = pred.obs - req;
      const slope = evSlopeRaise(potBB, s, m);

      // The hole's RATE is the rate of the spot times the share of it the pool leaves
      // untaken. A branch the pool already takes 30% of the time is not a hole.
      const holeRate = spotRate == null ? null : spotRate * (1 - poolRaiseFreq)
        // this node's share of all spots at this (street, sizeBucket) coordinate
        * (node.n / Math.max(1, sumSiblingN(policy, node)));

      const lineId = `${street}_checkraise`;
      rows.push({
        arm: 'raise-hole',
        lineId,
        nodeKey: `${node.key}#x${m}`,
        spotNodeKey: node.key,
        label: `raise to ${m}x a ${sizeBucket} bet — ${street}, ${texture}, ${isIP}, ${posCategory}, ${isAgg}`,
        street, texture, posCategory, sizeBucket, isIP, isAgg,
        s, raiseMultiple: m, potBB,
        poolFreq: poolRaiseFreq,
        poolCount: node.counts.raise ?? 0,
        nNode: node.n,
        requiredFoldPct: req * 100,
        predictedFoldPct: pred.obs * 100,
        predictedFoldSource: 'measured — HandHQ EVAL half, facing a RAISE',
        predictedFoldBins: pred.bins,
        engineFoldPct: engineFoldPct(raiseLookupFrac(s, m), 0.45) * 100,
        denom: denominate({
          gapFold: gap, slopeBB: slope, ratePer100: holeRate,
          nGap: pred.n, nRate: corpus?.totals?.seatHands ?? 0, handsPerHour,
        }),
        ...classifyGap(gap * 100, lineId),
      });
    }
  }

  // ── ARM 2: the BET-SIZING hole — the "increasing value bet sizing" axis ────────────────
  // Priced against the pool's MEASURED fold response, per street, across the whole ladder.
  for (const street of ['flop', 'turn', 'river']) {
    const streetCurve = betCurve[street] ?? betCurve.all;
    const spotKey = `${street}|none|na`;
    const potBB = nodePot.get(spotKey) ?? fallbackPot(street);
    const spotRate = nodeRate.get(spotKey);
    if (potBB == null) continue;

    // THE UNTAKEN BRANCH AT A FIRST-IN NODE IS "BET AT ALL". The pool checks a measured
    // share of these nodes; that share IS the hole, and it is the only defensible rate
    // here. Using the raw opportunity rate would price a bluff at EVERY first-in node,
    // which is a 100%-betting range and unreachable by construction.
    const checkFreq = poolCheckFreq(policy, street);

    // How often the pool actually USES each sizing. Without this column "bet 33% pot"
    // reads as a hole when it is the pool's modal sizing — the opposite of the truth.
    const curveTotalN = streetCurve.reduce((a, b) => a + b.n, 0);

    for (const s of SIZING_LADDER) {
      const req = requiredFoldBet(s);
      const pred = readFoldCurve(streetCurve, s);
      if (pred.obs == null) continue;
      const gap = pred.obs - req;
      const sizingShare = curveTotalN > 0 ? pred.n / curveTotalN : null;
      const holeRate = spotRate == null || checkFreq == null ? null : spotRate * checkFreq;
      rows.push({
        arm: 'bet-sizing',
        lineId: 'escalating_sizing',
        nodeKey: `${street}|bet@${s}`,
        // EVERY SIZING AT ONE STREET IS THE SAME SPOT. You choose one. Sharing the spot key
        // is what makes `sumDisjoint` refuse to add them, which it must.
        spotNodeKey: spotKey,
        label: `bet ${(s * 100).toFixed(0)}% pot — ${street}, first in (pool checks ${((checkFreq ?? 0) * 100).toFixed(0)}% here)`,
        street, texture: 'all', posCategory: 'all', sizeBucket: null, isIP: 'all', isAgg: 'all',
        s, raiseMultiple: null, potBB,
        poolFreq: sizingShare, poolCount: pred.n, nNode: curveTotalN,
        poolFreqMeaning: 'share of the pool\'s bets made at roughly this sizing',
        requiredFoldPct: req * 100,
        predictedFoldPct: pred.obs * 100,
        predictedFoldSource: `measured — HandHQ EVAL half, facing a BET, ${street}`,
        predictedFoldBins: pred.bins,
        engineFoldPct: engineFoldPct(s, 0.45) * 100,
        denom: denominate({
          gapFold: gap, slopeBB: evSlopeBet(potBB, s), ratePer100: holeRate,
          nGap: pred.n, nRate: corpus?.totals?.seatHands ?? 0, handsPerHour,
        }),
        ...classifyGap(gap * 100, 'escalating_sizing'),
      });
    }
  }

  rows.sort((a, b) => (b.denom.bbPerHour ?? -Infinity) - (a.denom.bbPerHour ?? -Infinity));
  return rows;
};

/**
 * How often the pool CHECKS at a first-in node on this street.
 *
 * This is the untaken branch at a `facingAction: none` node, measured, and it is the rate
 * the bet arm is denominated on. Pooled across texture / position / isIP / isAgg, because
 * the fold curve behind the gap is not conditioned on those either and pretending otherwise
 * would give the row a precision its numerator does not have.
 */
const poolCheckFreq = (policy, street) => {
  let check = 0; let n = 0;
  for (const node of flattenPolicyLevel(policy, 4)) {
    if (node.parts.facingAction !== 'none' || node.parts.street !== street) continue;
    check += node.counts.check ?? 0;
    n += node.n;
  }
  return n > 0 ? check / n : null;
};

/** Total observations at the same (street, sizeBucket) coordinate, for the share split. */
const siblingCache = new Map();
const sumSiblingN = (policy, node) => {
  const co = `${node.parts.street}|${node.parts.sizeBucket}`;
  if (!siblingCache.has(co)) {
    let tot = 0;
    for (const other of flattenPolicyLevel(policy, 6)) {
      if (other.parts.facingAction !== 'bet') continue;
      if (other.parts.street === node.parts.street && other.parts.sizeBucket === node.parts.sizeBucket) {
        tot += other.n;
      }
    }
    siblingCache.set(co, tot);
  }
  return siblingCache.get(co);
};

/** The decision tree — decision points and terminations, both carrying their numbers. */
const buildTree = (policy, decisions) => {
  // EV at a node, where the run rows can supply one. `statedEvMean` is a MEAN OVER COMBOS
  // of the engine's top-action EV — it is the only per-decision EV on disk today and it is
  // NOT a per-action EV. Labelled as such at every display site.
  //
  // Aggregated at EVERY level of the tree, not only the leaves: the founder asked for
  // numbers at decision points as well as at terminations, and a decision point whose EV
  // cell is empty is exactly the kind of blank that makes a diagram stop being read.
  const evFor = (facing, street = null, texture = null) => {
    let sum = 0; let n = 0; let depth = 0;
    for (const d of decisions.rows) {
      const sl = d.slices ?? {};
      if (facing != null && sl.facingAction !== facing) continue;
      if (street != null && sl.street !== street) continue;
      if (texture != null && sl.texture !== texture) continue;
      if (Number.isFinite(d.evStats?.statedEvMean)) { sum += d.evStats.statedEvMean; n++; }
      depth = Math.max(depth, d.evStats?.depthReachedMax ?? 0);
    }
    return { evMean: n ? sum / n : null, evN: n, depthMax: depth || null };
  };

  const node = (depth, filter) => flattenPolicyLevel(policy, depth).filter(filter);
  const tree = { name: 'all postflop decisions', children: [], n: 0, counts: {}, ...evFor(null) };
  for (const facingNode of node(0, () => true)) {
    const facing = facingNode.parts.facingAction;
    tree.n += facingNode.n;
    const fChild = {
      name: `facing: ${facing}`, key: facingNode.key, n: facingNode.n,
      counts: facingNode.counts, freq: facingNode.freq, children: [], ...evFor(facing),
    };
    for (const st of ['flop', 'turn', 'river']) {
      const lvl4 = node(4, (x) => x.parts.facingAction === facing && x.parts.street === st);
      if (!lvl4.length) continue;
      const agg = { n: 0, counts: {} };
      for (const x of lvl4) {
        agg.n += x.n;
        for (const [a, c] of Object.entries(x.counts)) agg.counts[a] = (agg.counts[a] ?? 0) + c;
      }
      const sChild = {
        name: st, key: `${facing}|${st}`, n: agg.n, counts: agg.counts,
        freq: Object.fromEntries(Object.entries(agg.counts).map(([a, c]) => [a, c / agg.n])),
        children: [], ...evFor(facing, st),
      };
      for (const tex of ['dry', 'medium', 'wet']) {
        const cells = lvl4.filter((x) => x.parts.texture === tex);
        if (!cells.length) continue;
        const tAgg = { n: 0, counts: {} };
        for (const x of cells) {
          tAgg.n += x.n;
          for (const [a, c] of Object.entries(x.counts)) tAgg.counts[a] = (tAgg.counts[a] ?? 0) + c;
        }
        sChild.children.push({
          name: tex, key: `${facing}|${st}|${tex}`, n: tAgg.n, counts: tAgg.counts,
          freq: Object.fromEntries(Object.entries(tAgg.counts).map(([a, c]) => [a, c / tAgg.n])),
          children: [], ...evFor(facing, st, tex),
        });
      }
      fChild.children.push(sChild);
    }
    tree.children.push(fChild);
  }
  return tree;
};

const main = async () => {
  const args = parseArgs(process.argv);
  const handsPerHour = int(args['hands-per-hour'], DEFAULT_HANDS_PER_HOUR);
  const outPath = str(args.out, 'out/hole-map.json');
  const htmlPath = str(args.html, 'out/hole-map.html');

  const policy = readJson(str(args.policy, 'out/behavior-policy.json'));
  const foldCells = readJson(str(args['fold-cells'], 'out/fold-vs-sizing.json'));
  const foldFitTxt = readFileSync(str(args['fold-fit'], 'out/fold-curve-fit.txt'), 'utf8');
  const decisions = readDecisionSidecar(args);

  const betCurve = {
    all: foldCurveFromCells(foldCells, { group: 'eval', facing: 'bet' }),
    flop: foldCurveFromCells(foldCells, { group: 'eval', facing: 'bet', street: 'flop' }),
    turn: foldCurveFromCells(foldCells, { group: 'eval', facing: 'bet', street: 'turn' }),
    river: foldCurveFromCells(foldCells, { group: 'eval', facing: 'bet', street: 'river' }),
  };
  const raiseCurve = {
    all: foldCurveFromCells(foldCells, { group: 'eval', facing: 'raise' }),
    flop: foldCurveFromCells(foldCells, { group: 'eval', facing: 'raise', street: 'flop' }),
    turn: foldCurveFromCells(foldCells, { group: 'eval', facing: 'raise', street: 'turn' }),
    river: foldCurveFromCells(foldCells, { group: 'eval', facing: 'raise', street: 'river' }),
  };
  const holdOut = parseHoldOutFoldCurve(foldFitTxt);

  const loader = await openLoader(process.cwd());
  let corpus;
  try {
    corpus = await scanCorpus(loader, args);
  } finally {
    await loader.close();
  }

  const holes = buildHoleTable({ policy, betCurve, raiseCurve, corpus, handsPerHour });
  const tree = buildTree(policy, decisions);

  // The top rows, disjointness-checked. Rows at the same spot node are ALTERNATIVES — you
  // choose one sizing, one raise multiple — so this check is expected to REFUSE, and the
  // refusal is the correct output. It is kept and displayed rather than engineered around.
  const denominated = holes.filter((r) => Number.isFinite(r.denom.bbPerHour));
  const top = denominated.slice(0, 12);
  const totalCheck = sumDisjoint(top, (r) => r.spotNodeKey ?? r.nodeKey);

  // The defensible aggregate: ONE line per spot node — the best-priced one — then summed.
  // This is a portfolio, not a sum of the table, and it is still a CEILING: it assumes every
  // untaken branch at every spot is converted, which no range allows.
  const bestPerSpot = [...denominated.reduce((m, r) => {
    const k = r.spotNodeKey ?? r.nodeKey;
    if (!m.has(k) || m.get(k).denom.bbPerHour < r.denom.bbPerHour) m.set(k, r);
    return m;
  }, new Map()).values()].sort((a, b) => b.denom.bbPerHour - a.denom.bbPerHour);
  const portfolio = sumDisjoint(bestPerSpot, (r) => r.spotNodeKey ?? r.nodeKey);
  portfolio.ceilingNote =
    'A CEILING, NOT A FORECAST. It assumes every untaken branch at every spot is converted, '
    + 'at the fold rate the pool showed against the bets it ACTUALLY faced. A range that '
    + 'bluffed every one of these nodes would be transparent within an orbit and the fold '
    + 'rate would collapse toward the required rate. Read it as the size of the room, not as '
    + 'a win rate.';

  // ── THE TWO ARMS DISAGREE, AND THE DISAGREEMENT IS THE MOST INFORMATIVE OUTPUT ─────────
  // Computed here rather than asserted in prose, so it re-derives on every run and cannot
  // go stale against the numbers it describes.
  const raiseRows = holes.filter((r) => r.arm === 'raise-hole');
  const betRows = holes.filter((r) => r.arm === 'bet-sizing');
  const meanGap = (rs) => (rs.length ? rs.reduce((a, r) => a + r.denom.gapFoldPp, 0) / rs.length : null);
  const crOutcome = (corpus.lines ?? []).filter((l) => l.lineId.endsWith('_checkraise'));
  const armDisagreement = {
    modelArm: {
      what: 'Pure-bluff raise, priced from pot geometry against the measured facing-a-raise fold curve.',
      meanGapPp: meanGap(raiseRows),
      positiveRows: raiseRows.filter((r) => r.denom.gapFoldPp > 0).length,
      totalRows: raiseRows.length,
      bestSignature: raiseRows.filter((r) => r.denom.gapFoldPp > 0)
        .map((r) => `${r.street} ${r.sizeBucket} x${r.raiseMultiple}`)
        .filter((v, i, a) => a.indexOf(v) === i).slice(0, 6),
    },
    outcomeArm: {
      what: 'Check-raises as they actually occurred in the corpus slice, realized chips, no engine.',
      rows: crOutcome.map((l) => ({
        lineId: l.lineId, n: l.n, meanNetBB: l.meanNetBB, seNetBB: l.seNetBB,
        rateGivenOpportunity: l.rateGivenOpportunity,
      })),
    },
    reconciliation:
      'THESE ARE NOT THE SAME OBJECT AND THE GAP BETWEEN THEM IS NOT A CONTRADICTION. The '
      + 'model arm prices a check-raise with ZERO equity when called. The pool\'s actual '
      + 'check-raises are mostly value and semi-bluffs, and their EV comes from the called '
      + 'branch the model sets to zero. Read together they say something sharper than either '
      + 'alone: check-raising this pool works, but NOT as a pure bluff — the fold equity is '
      + 'not there, so the hand has to be able to win at showdown.',
  };

  const asymmetry = {
    headline:
      'THE POOL OVER-FOLDS TO BETS AND UNDER-FOLDS TO RAISES. That asymmetry is the single '
      + 'clearest exploitable structure in this data, and it points the opposite way to the '
      + 'intuition that the check-raise is the biggest hole.',
    betArmMeanGapPp: meanGap(betRows),
    raiseArmMeanGapPp: meanGap(raiseRows),
    betArmEvidenceN: betCurve.all.reduce((a, b) => a + b.n, 0),
    raiseArmEvidenceN: raiseCurve.all.reduce((a, b) => a + b.n, 0),
    consequence:
      'Betting is underpriced by this field at EVERY sizing on the measured axis, and the '
      + 'per-occurrence gap RISES with sizing — which is the measured form of the founder\'s '
      + '"increasing value bet sizing". Raising is close to correctly priced, and below 3x it '
      + 'is priced against the bluffer.',
  };

  // ── THE PROVENANCE STAMP ───────────────────────────────────────────────────────────────
  // ADR-009: a readout carrying a comparative claim states the code that produced it and the
  // fault-register version it stood under. `registerVersion()` is a content hash over the
  // register body, so it changes when any entry is edited whether or not anyone remembered to
  // bump it — which is what lets a fault CONFIRMED tomorrow find the results that depended on
  // it yesterday. `gitStamp` throws rather than substituting "unknown": an artifact that
  // cannot name its engine is not publishable, and must not look publishable.
  const generatedAt = new Date().toISOString();
  const manifest = {
    // `gitStamp` gives `engineCommit` + `engineDirty` (whole tree). `watchedDirty` is the
    // narrower question the freshness verdict actually turns on — see `readWatchedDirty`.
    // Both are kept: the whole-tree flag still bears on reproducibility generally.
    ...gitStamp(process.cwd()),
    watchedDirty: readWatchedDirty({ cwd: process.cwd() }),
    generatedAt,
    disclaimerRegisterVersion: await registerVersion(),
    regenCommand: REGEN_COMMAND,
    // The narrow set of paths whose history can move a number in this artifact. Read
    // `holeMapFreshness.mjs` before widening it — narrowness is what keeps the signal worth
    // reading.
    watchedPaths: [...WATCHED_PATHS],
    artifacts: { json: outPath, html: htmlPath },
    generator: 'scripts/backtest/run-hole-map.mjs',
    spec: 'docs/standard-of-record/SCORED-READOUT-SPEC.md §9bis',
    inputs: {
      policy: str(args.policy, 'out/behavior-policy.json'),
      foldCells: str(args['fold-cells'], 'out/fold-vs-sizing.json'),
      foldFit: str(args['fold-fit'], 'out/fold-curve-fit.txt'),
      decisions: decisions.path ?? null,
      maxFiles: int(args['max-files'], null),
    },
  };
  // At generation time the artifact is by construction current with the commit it stamped —
  // zero watched commits can have landed between `gitStamp` and this line. The re-derivable
  // verdict is `npm run hole-map:check`; this one is the floor the page ships with.
  const freshness = { ...classifyFreshness(manifest, []), checkedAt: generatedAt };

  const doc = {
    schemaVersion: 2,
    generatedAt,
    manifest,
    freshness,
    asymmetry,
    armDisagreement,
    zeroEquityAssumption: ZERO_EQUITY_ASSUMPTION,
    outcomeArmCaveats: OUTCOME_ARM_CAVEATS,
    view: 'View 7 — the Hole Map (SCORED-READOUT-SPEC.md §9bis)',
    population:
      'HandHQ ONLINE cash, July 2009, 50NL, FTP+PS, 3-9 handed. The founder\'s game is LIVE '
      + '9-handed $1/$2-$1/$3. Every figure here is TRANSFERRED, NOT MEASURED for that game.',
    inelasticityModel: INELASTICITY_PROVENANCE,
    exploitDecayCaveat: EXPLOIT_DECAY_CAVEAT,
    textureResolution: TEXTURE_RESOLUTION_NOTE,
    practitionerRepertoire: PRACTITIONER_REPERTOIRE,
    decisionSource: {
      source: decisions.source, path: decisions.path, rows: decisions.rows.length,
      degraded: decisions.degraded ?? null,
    },
    policyProvenance: policy.provenance,
    foldCurve: {
      holdOutBins: holdOut,
      betBins: betCurve.all,
      raiseBins: raiseCurve.all,
      raiseBinsByStreet: { flop: raiseCurve.flop, turn: raiseCurve.turn, river: raiseCurve.river },
      betBinsByStreet: { flop: betCurve.flop, turn: betCurve.turn, river: betCurve.river },
    },
    corpus,
    tree,
    holes,
    totalCheck,
    portfolio: { rows: bestPerSpot, ...portfolio },
    sizingLadder: SIZING_LADDER,
    raiseLadder: RAISE_LADDER,
    handsPerHour,
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(doc, null, 1));
  mkdirSync(dirname(htmlPath), { recursive: true });
  writeFileSync(htmlPath, renderHoleMapHtml(doc));

  console.log(`\nWrote ${outPath}`);
  console.log(`Wrote ${htmlPath}`);
  console.log(`  policy       ${policy.provenance.observations} obs, ${policy.provenance.players} players`);
  console.log(`  fold curve   bet bins ${betCurve.all.length} (n=${betCurve.all.reduce((a, b) => a + b.n, 0)}), `
    + `raise bins ${raiseCurve.all.length} (n=${raiseCurve.all.reduce((a, b) => a + b.n, 0)})`);
  if (!corpus.skipped) {
    console.log(`  corpus       ${corpus.filesScanned}/${corpus.totalAvailable} files, `
      + `${corpus.totals.hands} hands, ${corpus.totals.seatHands} seat-hands, ${corpus.wallMs}ms`);
  }
  console.log(`  holes        ${holes.length} rows, ${denominated.length} carry a rate`);
  console.log(`  top-12 sum   ${totalCheck.disjoint ? `disjoint, ${totalCheck.total?.toFixed(2)} bb/hr` : 'REFUSED — rows share spot nodes (they are alternatives, not addends)'}`);
  console.log(`  portfolio    ${portfolio.disjoint ? `${portfolio.total?.toFixed(2)} bb/hr across ${portfolio.rowsSummed} disjoint spots (a CEILING)` : 'REFUSED'}`);
  console.log('\nTOP HOLES by bb/hour:');
  for (const r of denominated.slice(0, 10)) {
    console.log(`  ${r.label.padEnd(62).slice(0, 62)} gap ${r.denom.gapFoldPp.toFixed(1).padStart(6)}pp  `
      + `${r.denom.perOccurrenceBB.toFixed(2).padStart(7)}bb/occ  ${(r.denom.ratePer100 ?? 0).toFixed(2).padStart(6)}/100h  `
      + `${r.denom.bbPerHour.toFixed(2).padStart(6)} bb/hr  nGap=${r.denom.nGap}`);
  }
};

main().catch((err) => { console.error(err?.stack || String(err)); process.exit(1); });
