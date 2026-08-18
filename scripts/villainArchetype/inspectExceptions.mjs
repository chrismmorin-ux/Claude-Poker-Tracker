/**
 * inspectExceptions — the 3 hands behind "I never limp (91/94)".
 *
 * A rule that says NEVER while three counter-examples sit inside it is not a rule, it is a
 * rounding. The exceptions are the most informative decisions the villain made: either they
 * are noise, or they are a hidden sub-rule ("I limp AA to trap"), and those two readings
 * imply opposite exploits. This prints every exception with everything knowable about it,
 * and says plainly when the thing you would need to resolve it was never observable.
 */
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions, renderDecision } from './decisionLabeler.mjs';
import { CONTEXTS } from './ruleFitter.mjs';

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

console.log(`villain ${pid} — ${counts.get(pid)} hands\n`);

// Every near-absolute rule, and the decisions that contradict it.
for (const c of CONTEXTS) {
  const app = decisions.filter(c.applies);
  if (app.length < 12) continue;
  const fired = app.filter(c.fired);
  const rate = fired.length / app.length;
  const exceptions = rate >= 0.9 ? app.filter(d => !c.fired(d))
    : rate <= 0.1 ? fired : null;
  if (!exceptions || !exceptions.length) continue;

  console.log('='.repeat(94));
  console.log(`RULE: ${c.firstPerson(rate)}   (${fired.length}/${app.length})`);
  console.log(`THE ${exceptions.length} DECISIONS THAT CONTRADICT IT:`);
  for (const d of exceptions) {
    console.log('  ' + renderDecision(d));
    console.log(`     cards ${d.handKnown ? d.holeCards.join('') : 'NEVER SHOWN'}`
      + ` | opponents live ${d.opponentsLive} | SPR ${d.spr != null ? d.spr.toFixed(1) : '?'}`
      + ` | limpers ahead ${d.limpersAhead}`);
  }
  const shown = exceptions.filter(d => d.handKnown).length;
  console.log(`  -> ${shown} of ${exceptions.length} exceptions had cards shown.`);
  if (shown === 0) {
    console.log('     THE RULE CANNOT BE INTERROGATED AS WRITTEN. Whether this is a trap habit');
    console.log('     ("I limp my very best hands") or noise is UNRESOLVED, and the two readings');
    console.log('     imply opposite exploits. What would resolve it: the same exception set');
    console.log('     pooled across every member of this archetype, where showdowns accumulate.');
  }
  console.log('');
}
