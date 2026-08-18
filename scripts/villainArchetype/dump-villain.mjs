/**
 * Dump ONE villain's decisions, labelled — the founder's requested first output.
 *
 * "Take one specific villain, list each action, then label it." This is that list, and it is
 * the unit everything downstream is fitted to. Nothing here is a rate.
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions, renderDecision } from './decisionLabeler.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 60);
const TARGET = process.env.VILLAIN || null;
const SHOW = Number(process.env.SHOW || 60);

const root = resolveCorpusRoot();
const all = await discoverCorpusFiles({ root });
const { files } = selectCorpusFiles(all, { maxFiles: MAX_FILES });

// Pass 1 — who has the most hands? That is the villain with the most to say.
const counts = new Map();
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    for (const pid of Object.values(h.seatPlayers || {})) counts.set(pid, (counts.get(pid) || 0) + 1);
  }
}
const pid = TARGET || [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
console.log(`villain ${pid} — ${counts.get(pid)} hands in this slice\n`);

// Pass 2 — every decision they faced.
const decisions = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
    if (!seat) continue;
    for (const d of labelDecisions(h, seat)) decisions.push(d);
  }
}

console.log(`${decisions.length} decisions, ${decisions.filter(d => d.handKnown).length} with cards shown\n`);
console.log('─'.repeat(120));
for (const d of decisions.slice(0, SHOW)) console.log(renderDecision(d));
console.log('─'.repeat(120));

// The shown hands are the hard constraints — print them all, separately.
const revealed = decisions.filter(d => d.handKnown);
if (revealed.length) {
  console.log(`\nEVERY REVEALED HAND (${revealed.length}) — hard constraints on any range rule:`);
  const byHand = new Map();
  for (const d of revealed) if (!byHand.has(d.handId)) byHand.set(d.handId, d);
  for (const d of byHand.values()) console.log('  ', d.holeCards.join(''), ' ', d.street, d.action);
}

mkdirSync('.tmp-arch', { recursive: true });
writeFileSync('.tmp-arch/villain-decisions.json', JSON.stringify({ pid, hands: counts.get(pid), decisions }, null, 1));
console.log('\nwrote .tmp-arch/villain-decisions.json');
