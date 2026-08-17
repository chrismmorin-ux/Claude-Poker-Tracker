#!/usr/bin/env node
/**
 * show-ws481-flips.mjs — WS-481. Render the decisions whose advice changed, as HANDS.
 *
 * The paired probe reports rows keyed `${playerId}|${handId}|${order}`. That is enough to
 * pair arms and not enough to look at, so this resolves the key back to the actual spot:
 * board, street pot, the sizing villain faced, and the line up to the decision. A measured
 * 21.8% divergence is a number; a founder can only check it against a board.
 *
 * USAGE
 *   node scripts/backtest/show-ws481-flips.mjs
 */
import { readFileSync } from 'node:fs';
import { openLoader } from './loader.mjs';

const RANKS = '23456789TJQKA';
const SUITS = ['♠', '♥', '♦', '♣'];

const main = async () => {
  const REPO = process.cwd().split(String.fromCharCode(92)).join('/');
  const loader = await openLoader(REPO);
  try {
    const { discoverCorpusFiles, applyFileCap, DEFAULT_CORPUS_ROOT } = await loader.load('/scripts/backtest/corpusFiles.mjs');
    const { indexEvalPlayers } = await loader.load('/scripts/backtest/runner.mjs');
    const { calculatePotProgression } = await loader.load('/src/utils/potCalculator.js');

    const A = JSON.parse(readFileSync(`${REPO}/out/ws481-model-BEFORE.json`, 'utf8')).rows;
    const Bm = new Map(JSON.parse(readFileSync(`${REPO}/out/ws481-model-AFTER.json`, 'utf8')).rows.map(r => [r.key, r]));
    const tv = (p, q) => {
      const ks = new Set([...Object.keys(p || {}), ...Object.keys(q || {})]);
      let s = 0;
      for (const k of ks) s += Math.abs((p?.[k] || 0) - (q?.[k] || 0));
      return s / 2;
    };
    const changed = [];
    for (const a of A) {
      const b = Bm.get(a.key);
      if (!b) continue;
      const d = tv(a.piOurs, b.piOurs);
      if (d > 1e-12) changed.push({ a, b, d });
    }
    changed.sort((x, y) => y.d - x.d);
    const wanted = new Map(changed.map(c => [c.a.key.split('|')[1], true]));

    // WS-504: `strategy: 'prefix'` ON PURPOSE, and it is the one place a naive migration to
    // the new default would break something silently. This tool reconstructs hands referenced
    // BY AN ALREADY-EMITTED ARTIFACT, and emit-ws481-result-card.mjs pins the same 300-file
    // prefix. Drawing proportionally here would look up hand ids in a file set that never
    // contained them, and the tool would simply report fewer flips rather than fail.
    const { files } = applyFileCap(
      await discoverCorpusFiles({ root: DEFAULT_CORPUS_ROOT, stakes: ['50NLH'] }),
      { maxFiles: 300, strategy: 'prefix' },
    );
    const { byPlayer } = await indexEvalPlayers({ files, maxPlayers: 300 });

    // handId -> hand, for the hands we need
    const hands = new Map();
    for (const [, hs] of byPlayer) {
      for (const h of hs) {
        const id = String(h.handId);
        if (wanted.has(id) && !hands.has(id)) hands.set(id, h);
      }
    }

    const card = (c) => `${RANKS[Math.floor(c / 4)]}${SUITS[c % 4]}`;
    const cardsOf = (arr) => (arr || []).map(x => (typeof x === 'number' ? card(x) : x)).join(' ');
    const fmt = (d) => Object.entries(d || {}).filter(([, v]) => v > 0.0005)
      .sort((x, y) => y[1] - x[1]).map(([k, v]) => `${k} ${(100 * v).toFixed(0)}%`).join(', ');
    const argmax = (p) => Object.entries(p || {}).sort((x, y) => y[1] - x[1])[0][0];

    let shown = 0;
    for (const { a, b, d } of changed) {
      const [pid, handId, orderStr] = a.key.split('|');
      const order = Number(orderStr);
      const hand = hands.get(handId);
      const flipped = argmax(a.piOurs) !== argmax(b.piOurs);
      if (!flipped && shown >= 6) continue;
      shown++;

      console.log(`\n${'='.repeat(78)}`);
      console.log(`${flipped ? '*** ADVICE FLIPPED ***  ' : ''}${a.street.toUpperCase()}  facing=${a.facingAction}  TV=${d.toFixed(3)}`);
      console.log(`hand ${handId}  seat-player ${pid.slice(0, 10)}…  order ${order}`);

      if (!hand) { console.log('  (hand not in the indexed slice)'); continue; }

      const gs = hand.gameState || {};
      const seq = gs.actionSequence || [];
      const prog = calculatePotProgression(seq, gs.blinds || { sb: 0.25, bb: 0.5 });
      const idx = seq.findIndex(e => e && e.order === order);
      const geo = idx >= 0 ? prog[idx] : null;
      const heroSeat = Object.entries(hand.seatPlayers || {}).find(([, p]) => String(p) === pid)?.[0];

      const board = gs.communityCards || [];
      const upto = a.street === 'flop' ? 3 : a.street === 'turn' ? 4 : 5;
      console.log(`board  ${cardsOf(board.slice(0, upto))}${board.length > upto ? `   (runout ${cardsOf(board.slice(upto))})` : ''}`);
      if (geo) {
        console.log(`pot at the decision  ${geo.potBefore.toFixed(2)}   owed ${geo.owed.toFixed(2)}`
          + `${geo.owed > 0 ? `   = ${(geo.owed / Math.max(geo.potBefore - geo.owed, 1e-9)).toFixed(2)}x the pot` : ''}`);
      }
      console.log('line:');
      for (const e of seq) {
        if (!e) continue;
        const mark = e.order === order ? '  <-- THIS DECISION' : '';
        const who = String(e.seat) === String(heroSeat) ? 'seat' : 'opp ';
        console.log(`   ${String(e.street).padEnd(7)} ${who} ${String(e.seat)}  ${String(e.action).padEnd(6)}`
          + `${e.amount != null ? String(e.amount) : ''}${mark}`);
        if (e.order === order) break;
      }
      console.log(`engine BEFORE: ${fmt(a.piOurs)}`);
      console.log(`engine AFTER : ${fmt(b.piOurs)}`);
      // `observed` is what the TRACKED PLAYER (the one whose policy is being scored) did — not
      // the opponent. Mislabeling it as the villain's action inverts who the row is about.
      console.log(`the player actually: ${a.observed}`);
    }
  } finally {
    await loader.close();
  }
};
main().catch((e) => { console.error(e); process.exit(1); });
