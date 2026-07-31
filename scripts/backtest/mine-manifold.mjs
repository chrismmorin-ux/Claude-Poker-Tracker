#!/usr/bin/env node
/**
 * mine-manifold.mjs — extract the SHAPE of the postflop decision space.
 *
 * WHY THIS EXISTS. Every other miner in this directory answers a question with a
 * number. This one answers a question with a geometry: if you drew every hand in
 * the corpus as a path from "cards dealt" to "pot resolved", what solid would the
 * bundle of paths trace out? How fat is the trunk, where does it bend, where does
 * it narrow to a single channel, and how much money is moving through each tube?
 *
 * It is deliberately standalone — no `src/` imports, no Vite loader — because the
 * output feeds a visualisation, not the engine. It re-implements the minimum PHH
 * walk (see phhAdapter.mjs for the load-bearing, engine-facing version). If a
 * number here ever has to be trusted for a decision, move it onto the adapter.
 *
 * WHAT IT EMITS (out/manifold.json)
 *   trunk  — the path tree. One node per (street, path-prefix), carrying hand
 *            count, pot mass, showdown share, and how many hands EXIT there.
 *   phase  — per-street 2-D histogram over (log pot in BB) x (players live).
 *            The manifold as a density in state space rather than as a tree.
 *   matrix — preflop position x aggression-depth counts, for the "bends".
 *
 * USAGE
 *   node scripts/backtest/mine-manifold.mjs --max-hands 400000 --out out/manifold.json
 */

import { createReadStream, writeFileSync, mkdirSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { readdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const CORPUS_ROOT = 'C:/Users/chris/data/phh-dataset/data/handhq';
const EPS = 1e-9;

const parseArgs = (argv) => {
  const a = {};
  for (let i = 2; i < argv.length; i++) {
    if (!argv[i].startsWith('--')) continue;
    const k = argv[i].slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) a[k] = true;
    else { a[k] = n; i++; }
  }
  return a;
};

// ── PHH reading ──────────────────────────────────────────────────────────────

const WANTED = new Set(['variant', 'antes', 'blinds_or_straddles', 'actions', 'players', 'hand']);

const numList = (v) => {
  const inner = v.replace(/^\[|\]$/g, '');
  if (!inner.trim()) return [];
  return inner.split(',').map(s => Number(s.trim())).map(x => (Number.isFinite(x) ? x : 0));
};
const strList = (v) => {
  const out = [];
  const re = /'([^']*)'|"([^"]*)"/g;
  let m;
  while ((m = re.exec(v)) !== null) out.push(m[1] ?? m[2]);
  return out;
};

async function* iterHands(filePath) {
  const rl = createInterface({
    input: createReadStream(filePath, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });
  let raw = null;
  for await (const line of rl) {
    if (line.startsWith('[')) {
      if (raw) yield raw;
      raw = {};
      continue;
    }
    if (!raw) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!WANTED.has(key)) continue;
    const value = line.slice(eq + 1).trim();
    if (key === 'variant') raw.variant = value.replace(/^['"]|['"]$/g, '');
    else if (key === 'antes') raw.antes = numList(value);
    else if (key === 'blinds_or_straddles') raw.blinds = numList(value);
    else if (key === 'actions') raw.actions = strList(value);
    else if (key === 'players') raw.players = strList(value);
  }
  if (raw) yield raw;
}

const walkFiles = async (dir, out) => {
  let entries;
  try { entries = await readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) await walkFiles(full, out);
    else if (e.name.endsWith('.phhs')) out.push(full);
  }
  return out;
};

// ── position + line vocabulary ───────────────────────────────────────────────

/** Blind-order index -> position class. Index 0 = SB, 1 = BB, n-1 = button. */
const posClass = (i, n) => {
  if (i === 0) return 'SB';
  if (i === 1) return 'BB';
  if (i === n - 1) return 'BTN';
  if (i === n - 2) return 'CO';
  if (i === n - 3) return 'HJ';
  return 'EP';
};

const DEPTH = ['limp', 'open', '3bet', '4bet+'];
const depthLabel = (raiseCount) => DEPTH[Math.min(raiseCount, 3)];

/**
 * Classify one postflop street from its ordered action list.
 *
 * The vocabulary is deliberately small: who fired first (the previous street's
 * aggressor, or somebody else), and how far the street escalated. That is the
 * axis a player actually reasons on, and it keeps the tree drawable.
 */
const classifyStreet = (acts, prevAgg) => {
  const firstAgg = acts.find(a => a.kind === 'bet');
  if (!firstAgg) return { label: 'check', agg: prevAgg, escalation: 0 };

  const role = firstAgg.p === prevAgg ? 'cbet' : 'lead';
  const checkedBefore = new Set(
    acts.filter(a => a.kind === 'check' && a.order < firstAgg.order).map(a => a.p),
  );

  const raise = acts.find(a => a.kind === 'raise');
  let lastAgg = firstAgg.p;
  for (const a of acts) if (a.kind === 'bet' || a.kind === 'raise') lastAgg = a.p;

  if (raise) {
    const isXR = checkedBefore.has(raise.p);
    return {
      label: `${role}\u2192${isXR ? 'xr' : 'raise'}`,
      agg: lastAgg,
      escalation: 2,
    };
  }
  const called = acts.some(a => a.kind === 'call' && a.order > firstAgg.order);
  return {
    label: `${role}\u2192${called ? 'call' : 'fold'}`,
    agg: lastAgg,
    escalation: called ? 1 : 0,
  };
};

// ── the walk ─────────────────────────────────────────────────────────────────

const STREETS = ['preflop', 'flop', 'turn', 'river'];
const STREET_FOR_BOARD = { 0: 0, 3: 1, 4: 2, 5: 3 };

/**
 * Convert one raw hand into a trajectory:
 *   { branch, steps: [{street, label, potBBAfter, live}], showdown, finalPotBB }
 * Returns null for hands outside the modelled shape (heads-up, straddles, ...).
 */
const trajectory = (raw) => {
  if (raw.variant !== 'NT') return null;
  const { actions, blinds, players } = raw;
  if (!Array.isArray(actions) || !Array.isArray(blinds) || !Array.isArray(players)) return null;

  const n = players.length;
  if (n < 3 || n > 9) return null;

  const posted = blinds.slice(0, n);
  const nz = posted.map((v, i) => (v > EPS ? i : -1)).filter(i => i !== -1);
  if (nz.length !== 2 || nz[0] !== 0 || nz[1] !== 1) return null;
  const sb = posted[0];
  const bb = posted[1];
  if (!(bb > sb)) return null;

  let pot = (raw.antes || []).reduce((s, a) => s + (a > 0 ? a : 0), 0) + sb + bb;
  const committed = new Array(n).fill(0);
  committed[0] = sb;
  committed[1] = bb;
  let currentBet = bb;

  const folded = new Array(n).fill(false);
  let boardLen = 0;
  let streetIdx = 0;
  let order = 0;

  const byStreet = [[], [], [], []];
  let preflopRaises = 0;
  let preflopAgg = 1;          // BB is the nominal aggressor until someone raises
  const potAtStreetStart = [pot / bb, null, null, null];
  const liveAtStreetStart = [n, null, null, null];
  let sawShowdownReveal = false;

  for (const token of actions) {
    const parts = token.trim().split(/\s+/);
    if (parts.length === 0) continue;

    if (parts[0] === 'd') {
      if (parts[1] === 'db') {
        boardLen += Math.floor((parts[2] ?? '').length / 2);
        const next = STREET_FOR_BOARD[boardLen];
        if (next === undefined) return null;
        streetIdx = next;
        committed.fill(0);
        currentBet = 0;
        potAtStreetStart[streetIdx] = pot / bb;
        liveAtStreetStart[streetIdx] = folded.filter(f => !f).length;
      }
      continue;
    }

    const m = /^p(\d+)$/.exec(parts[0]);
    if (!m) return null;
    const pi = Number(m[1]) - 1;
    if (!Number.isInteger(pi) || pi < 0 || pi >= n) return null;
    const verb = parts[1];

    if (verb === 'sm') { sawShowdownReveal = true; continue; }

    const owed = currentBet - committed[pi];

    if (verb === 'f') {
      folded[pi] = true;
      byStreet[streetIdx].push({ p: pi, kind: 'fold', order: order++ });
      continue;
    }
    if (verb === 'cc') {
      if (owed > EPS) {
        byStreet[streetIdx].push({ p: pi, kind: 'call', order: order++ });
        pot += owed;
        committed[pi] = currentBet;
      } else {
        byStreet[streetIdx].push({ p: pi, kind: 'check', order: order++ });
      }
      continue;
    }
    if (verb === 'cbr') {
      const to = Number(parts[2]);
      if (!Number.isFinite(to) || to <= 0) return null;
      const isBet = currentBet <= EPS;
      byStreet[streetIdx].push({ p: pi, kind: isBet ? 'bet' : 'raise', order: order++ });
      pot += to - committed[pi];
      committed[pi] = to;
      currentBet = to;
      if (streetIdx === 0) { preflopRaises++; preflopAgg = pi; }
      continue;
    }
    return null;
  }

  // ── preflop branch ─────────────────────────────────────────────────────────
  const toFlop = liveAtStreetStart[1];
  let branch;
  if (preflopRaises === 0) {
    branch = toFlop && toFlop > 1 ? 'limped' : 'walk';
  } else {
    branch = `${posClass(preflopAgg, n)} ${depthLabel(preflopRaises)}`;
  }

  const steps = [];
  // In a limped pot there is no preflop raiser, so nobody can "continuation bet".
  // Anchoring on the BB would label every limped-pot flop bet a c-bet and inflate
  // the c-bet channel by the single largest branch in the corpus.
  let agg = preflopRaises === 0 ? -1 : preflopAgg;
  for (let s = 1; s <= 3; s++) {
    if (potAtStreetStart[s] === null) break;
    const res = classifyStreet(byStreet[s], agg);
    agg = res.agg;
    steps.push({
      street: STREETS[s],
      label: res.label,
      escalation: res.escalation,
      potStart: potAtStreetStart[s],
      live: liveAtStreetStart[s],
    });
  }

  const finalLive = folded.filter(f => !f).length;
  return {
    branch,
    seats: n,
    steps,
    reachedFlop: potAtStreetStart[1] !== null,
    showdown: sawShowdownReveal || finalLive > 1,
    finalPotBB: pot / bb,
    liveAtStreetStart,
    potAtStreetStart,
  };
};

// ── accumulation ─────────────────────────────────────────────────────────────

const POT_BINS = [0, 2, 4, 8, 16, 32, 64, 128, 256, Infinity];
const potBin = (p) => {
  for (let i = 0; i < POT_BINS.length - 1; i++) if (p < POT_BINS[i + 1]) return i;
  return POT_BINS.length - 2;
};

const main = async () => {
  const args = parseArgs(process.argv);
  const maxHands = Number(args['max-hands'] ?? 400000);
  const outPath = String(args.out ?? 'out/manifold.json');

  const files = (await walkFiles(CORPUS_ROOT, [])).sort();
  if (files.length === 0) throw new Error(`no .phhs under ${CORPUS_ROOT}`);
  console.log(`Discovered ${files.length} corpus file(s).`);

  const nodes = new Map();   // key -> node
  const phase = [];          // per street: Map("potBin:live") -> count
  for (let i = 0; i < 4; i++) phase.push(new Map());
  const matrix = new Map();  // "POS|depth" -> {n, potSum}

  let read = 0;
  let used = 0;
  let skipped = 0;

  const touch = (key, parent, label, streetIdx) => {
    let node = nodes.get(key);
    if (!node) {
      node = {
        key, parent, label, street: streetIdx,
        n: 0, exits: 0, showdowns: 0, potSum: 0, liveSum: 0, escSum: 0,
      };
      nodes.set(key, node);
    }
    return node;
  };

  outer:
  for (const file of files) {
    for await (const raw of iterHands(file)) {
      read++;
      if (read % 100000 === 0) console.log(`  ${read} hands read, ${used} used`);
      const t = trajectory(raw);
      if (!t) { skipped++; if (read >= maxHands) break outer; continue; }
      used++;

      // phase-space density
      for (let s = 0; s < 4; s++) {
        if (t.potAtStreetStart[s] === null) break;
        const k = `${potBin(t.potAtStreetStart[s])}:${Math.min(t.liveAtStreetStart[s], 9)}`;
        phase[s].set(k, (phase[s].get(k) || 0) + 1);
      }

      // preflop matrix
      const mk = t.branch;
      const cell = matrix.get(mk) || { n: 0, potSum: 0, flops: 0 };
      cell.n++;
      cell.potSum += t.finalPotBB;
      if (t.reachedFlop) cell.flops++;
      matrix.set(mk, cell);

      // trunk: root -> branch -> street labels
      const root = touch('*', null, 'all hands', -1);
      root.n++;
      root.potSum += t.finalPotBB;
      root.liveSum += t.seats;
      if (t.showdown) root.showdowns++;

      const bKey = `*/${t.branch}`;
      const bNode = touch(bKey, '*', t.branch, 0);
      bNode.n++;
      bNode.potSum += t.finalPotBB;
      bNode.liveSum += t.liveAtStreetStart[1] ?? 1;
      if (t.showdown) bNode.showdowns++;
      if (!t.reachedFlop) bNode.exits++;

      let key = bKey;
      let parent = bKey;
      for (let i = 0; i < t.steps.length; i++) {
        const step = t.steps[i];
        key = `${key}/${step.label}`;
        const node = touch(key, parent, step.label, i + 1);
        node.n++;
        node.potSum += step.potStart;
        node.liveSum += step.live;
        node.escSum += step.escalation;
        if (t.showdown) node.showdowns++;
        if (i === t.steps.length - 1) node.exits++;
        parent = key;
      }

      if (read >= maxHands) break outer;
    }
  }

  // Prune: a node is kept if it carries at least MIN_SHARE of all used hands.
  // Pruned mass is NOT silently dropped — it is rolled into a sibling marker so
  // the picture still sums to the corpus.
  const MIN_SHARE = 0.0015;
  const floor = Math.max(20, Math.floor(used * MIN_SHARE));
  const kept = [];
  const rolled = new Map();
  for (const node of nodes.values()) {
    if (node.key === '*' || node.n >= floor) kept.push(node);
    else {
      const r = rolled.get(node.parent) || { n: 0, potSum: 0, exits: 0, showdowns: 0, street: node.street };
      r.n += node.n; r.potSum += node.potSum; r.exits += node.exits; r.showdowns += node.showdowns;
      rolled.set(node.parent, r);
    }
  }
  const keptKeys = new Set(kept.map(k => k.key));
  const surviving = kept.filter(k => k.key === '*' || keptKeys.has(k.parent));

  for (const [parent, r] of rolled) {
    if (!keptKeys.has(parent) || r.n < floor / 2) continue;
    surviving.push({
      key: `${parent}/\u2026rare`, parent, label: '\u2026rare lines', street: r.street,
      n: r.n, exits: r.exits, showdowns: r.showdowns, potSum: r.potSum, liveSum: 0, escSum: 0,
      isRollup: true,
    });
  }

  const round = (x, d = 3) => Number(x.toFixed(d));
  const out = {
    meta: {
      source: 'HandHQ 2009-07 50NLH (FTP + PS), phh-dataset',
      generated: new Date().toISOString().slice(0, 10),
      handsRead: read,
      handsUsed: used,
      skipped,
      note: 'Hands are 3-9 handed with standard blinds. Heads-up and straddled hands excluded. '
          + 'Positions are right-aligned to the button, so short tables keep BTN/CO/HJ exact.',
      pruneFloor: floor,
    },
    trunk: surviving.map(nd => ({
      key: nd.key,
      parent: nd.parent,
      label: nd.label,
      street: nd.street,
      n: nd.n,
      exits: nd.exits,
      showdownRate: nd.n ? round(nd.showdowns / nd.n) : 0,
      meanPot: nd.n ? round(nd.potSum / nd.n, 2) : 0,
      meanLive: nd.liveSum && nd.n ? round(nd.liveSum / nd.n, 2) : null,
      escalation: nd.n ? round(nd.escSum / nd.n, 2) : 0,
      rollup: !!nd.isRollup,
    })),
    phase: phase.map((mp, s) => ({
      street: STREETS[s],
      bins: POT_BINS.slice(0, -1).map((lo, i) => ({ lo, hi: POT_BINS[i + 1] })),
      cells: [...mp.entries()].map(([k, v]) => {
        // A numeric "{potBin}:{liveOpponents}" pair local to the manifold miner, not a
        // canonical spot identifier (WS-317 guard opt-out).
        const [pb, live] = k.split(':').map(Number); // not-a-situation-key
        return { potBin: pb, live, n: v };
      }),
    })),
    matrix: [...matrix.entries()]
      .map(([k, v]) => ({
        branch: k, n: v.n, meanPot: round(v.potSum / v.n, 2), flopRate: round(v.flops / v.n),
      }))
      .sort((a, b) => b.n - a.n),
  };

  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(out, null, 1));
  console.log(`Wrote ${outPath} — ${used} hands, ${out.trunk.length} nodes kept (floor ${floor}).`);
};

main().catch((e) => { console.error(e); process.exit(1); });
