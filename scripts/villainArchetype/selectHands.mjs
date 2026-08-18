/**
 * selectHands — pick the hands worth explaining, and write their dossiers to disk.
 *
 * Not a random sample. A random sample of poker hands is mostly folds preflop, and a fold
 * preflop with no cards shown carries almost no information to explain. The hands that force
 * an explanation are the ones where the player committed money, or where a showdown revealed
 * a holding that looks wrong for the line they took — the founder's "why did the villain call
 * an all-in with bottom pair".
 *
 * SELECTION IS A BIAS AND IS DECLARED. These hands are chosen to be informative, so any rate
 * computed over them describes THIS SET, never the player. Rules induced here must be tested
 * back against all decisions (`testSequenceRules` style), which is where a rate is allowed.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { buildDossier } from './handDossier.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;
const OUT = process.env.OUT || '.tmp-arch/dossiers';
const LIMIT = Number(process.env.LIMIT || 0);   // 0 = EVERY hand, which is the default

const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

const counts = new Map();
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    for (const pid of Object.values(h.seatPlayers || {})) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
}
const pid = TARGET || [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];

/** How much this hand demands an explanation. Higher = more informative. */
const interest = (hand, seat, ds) => {
  const bb = hand._backtest?.bb || 1;
  const sd = hand.gameState?.showdownCards || {};
  let score = 0;
  const committed = ds.reduce((m, d) => Math.max(m, d.potBB || 0), 0);
  score += Math.min(committed / 10, 12);                       // big pots demand explanation
  if (sd[String(seat)]) score += 8;                            // we can see the holding
  if (ds.some(d => d.action === 'raise' && d.street !== 'preflop')) score += 4;
  if (ds.some(d => d.facing !== 'no bet' && d.potOddsNeeded > 0.4 && d.action !== 'fold')) score += 6; // called a steep price
  if (ds.some(d => d.street === 'river' && d.action === 'call')) score += 3;
  if (ds.length >= 4) score += 2;                              // a multi-street line
  return score;
};

const cands = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
    if (!seat) continue;
    const ds = labelDecisions(h, seat);
    // EVERY hand with a voluntary action, including the one-action preflop folds. Those
    // folds are ~87% of a tight player's hands and they are where the entry rule actually
    // lives; excluding them would leave the ruleset describing only the hands that got
    // interesting, which is the selection bias this whole pass exists to avoid.
    if (ds.length < 1) continue;
    cands.push({ hand: h, seat, ds, score: interest(h, seat, ds) });
  }
}
// Founder ruling 2026-08-18: explain EVERY hand, not the dramatic ones. Selecting the
// interesting hands only teaches you about interesting spots, and the ordinary folds are
// where most of a player's ruleset actually lives. `score` is retained only as an ordering
// so a partial run covers the most informative hands first — it no longer excludes anything.
cands.sort((a, b) => b.score - a.score);
const picked = LIMIT > 0 ? cands.slice(0, LIMIT) : cands;

mkdirSync(OUT, { recursive: true });
const index = [];
picked.forEach((c, i) => {
  const { text, facts } = buildDossier(c.hand, c.seat);
  const file = `${OUT}/hand-${String(i + 1).padStart(2, '0')}-${c.hand.handId}.txt`;
  writeFileSync(file, text);
  index.push({ n: i + 1, file, handId: c.hand.handId, score: +c.score.toFixed(1), ...facts });
});
writeFileSync(`${OUT}/index.json`, JSON.stringify({ pid, hands: counts.get(pid), picked: index }, null, 1));

console.log(`villain ${pid} — ${counts.get(pid)} hands, ${cands.length} with a multi-action line`);
console.log(`wrote ${picked.length} dossiers to ${OUT}/\n`);
for (const r of index) {
  console.log(`  ${String(r.n).padStart(2)}. ${r.handId}  score ${String(r.score).padStart(5)}  `
    + `${r.showdown ? 'SHOWDOWN' : 'no showdown'}  ${r.villainCards ? r.villainCards.join('') : '(cards unknown)'}  ${r.position}`);
}
