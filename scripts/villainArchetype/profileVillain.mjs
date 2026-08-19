/**
 * profileVillain — THE PROCEDURE. One command, same steps, every villain, every time.
 *
 * FOUNDER, 2026-08-18: "This needs to be a repeatable procedure for each villain. you're
 * doing it off the cuff now, which is degrading quality."
 *
 * Correct, and the evidence is in the session that produced this file. Three separate
 * measurement bugs shipped and were caught only because the founder pushed back on a
 * result that looked wrong to him:
 *
 *   - the price owed was the size of the BET, not what the seat owed, so limped pots read
 *     "nothing to call" and every blind's price was overstated;
 *   - "invested so far" used the hand's FINAL total, feeding the model the future;
 *   - "what he paid" summed only CALLS, so a 25bb check-RAISE counted as zero and a shown
 *     bluff was reported as a hand that reached showdown for free.
 *
 * Each of those was a one-line error that survived because nothing ran between me and the
 * conclusion. A document saying "check your metrics" would not have caught any of them.
 * A GATE does. Every check below runs before any rule is induced, and a failure stops the
 * run rather than printing a caveat nobody reads.
 *
 * THE PROCEDURE
 *   1. LOAD      every decision for this villain
 *   2. GATE      instrument self-checks against known answers — fail loud, fail early
 *   3. ENUMERATE the standard table (schema-driven, identical for every villain)
 *   4. INDUCE    the ruleset, every leaf carrying a confidence interval
 *   5. WRINKLES  the leaves that are NOT resolved, and what would resolve each
 *   6. EMIT      a profile file, so two villains can be laid side by side
 *
 * "Expand the surface, rerun, expand again, until there aren't any wrinkles, just
 * confidence intervals" (founder). Step 5 is that loop's instrument: a wrinkle is a leaf
 * whose residue is too big to be a range, and the report names the feature that would cut
 * it. When the wrinkle list is empty, what remains is sampling error, which is what a
 * confidence interval is for.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { discoverCorpusFiles, selectCorpusFiles, resolveCorpusRoot } from '../backtest/corpusFiles.mjs';
import { iterAppHands } from '../backtest/phhAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { strengthAt } from './handStrength.mjs';
import { annotate } from './rangeInference.mjs';
import { fillToWidth } from './buildRangeCharts.mjs';
import { toRow, header, SCHEMA_VERSION, SITUATION_FIELDS, FIELDS } from './decisionSchema.mjs';

const MAX_FILES = Number(process.env.MAX_FILES || 120);
const TARGET = process.env.VILLAIN || null;
const RANK = Number(process.env.RANK || 1);          // 1 = most hands, 2 = next, ...
const OUT = process.env.OUT || '.tmp-arch/profiles';

// ─── 1. LOAD ─────────────────────────────────────────────────────────────────
const root = resolveCorpusRoot();
const { files } = selectCorpusFiles(await discoverCorpusFiles({ root }), { maxFiles: MAX_FILES });

/**
 * TWO PASSES, BECAUSE RETAINING THE CORPUS IS WHAT CAPPED THE SAMPLE.
 *
 * This used to hold every parsed hand in `handsById` so it could rank villains by hand count
 * and only then pick one. That is fine at MAX_FILES=120 and fatal at the full corpus: the run
 * died with `Ineffective mark-compacts near heap limit` at ~4GB, having read 1,756 files to
 * build a list of which it needed 69.
 *
 * The cost of that was not a crash, it was a SILENT CEILING ON EVIDENCE. Every figure in this
 * profile was computed on a 6.8% slice, and the ladder question - does he really open the
 * button wider than under the gun - is decided by n and nothing else. An instrument that
 * cannot read the whole corpus answers "we cannot tell" for a reason that has nothing to do
 * with the villain.
 *
 * Pass 1 counts and retains NOTHING. Pass 2 re-reads and retains only the hands the chosen
 * villain actually sat in. Memory is now O(his hands), not O(corpus), so MAX_FILES exists to
 * make a run quick, never to make it possible. Re-parsing costs a second scan and buys the
 * whole corpus, which is the trade every time.
 */
const counts = new Map();
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    for (const p of Object.values(h.seatPlayers || {})) counts.set(p, (counts.get(p) || 0) + 1);
  }
}
const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
const pid = TARGET || ranked[RANK - 1][0];

// WHICH FILE each hand came from. Needed because the card's provenance must describe the hands
// the card CONTAINS, not the slice that was scanned: villain 1's hands are all PokerStars while
// the scan also covered Full Tilt, and stamping the scan's sites would put a site on his card
// that he never played on.
const fileOfHand = new Map();
const decisions = [];
const handsOfVillain = [];
for (const f of files) {
  for await (const h of iterAppHands(f.path)) {
    const seat = Object.entries(h.seatPlayers || {}).find(([, p]) => p === pid)?.[0];
    if (!seat) continue;
    fileOfHand.set(h, f.path);
    handsOfVillain.push({ h, seat });
    decisions.push(...labelDecisions(h, seat));
  }
}

/**
 * THE ASSUMED HALF OF HAND STRENGTH, filled in once his widths are known.
 *
 * The labeller already computed the EXACT arm - big blind in a limped pot, where his range is
 * every hand and the answer needs nothing but the board. This arm needs his MEASURED entry
 * widths, which only exist after a full pass over his hands, so it necessarily happens here and
 * not there.
 *
 * The widths are measured from his own decisions; only the ORDERING that fills them is a
 * convention, and every row it touches is stamped `assumed` so the two can never be pooled by
 * accident. Filling before induction is the point: the founder's instruction was that the
 * strength buckets be fed to whoever is looking for the rules, and that means the inducer and
 * the leaf dumps both see them, not a separate report nobody joins back.
 */
const entryWidth = (() => {
  const bucket = new Map();
  const add = (key, hit) => {
    if (!bucket.has(key)) bucket.set(key, { k: 0, n: 0 });
    const b = bucket.get(key); b.n++; if (hit) b.k++;
  };
  for (const d of decisions) {
    if (d.street !== 'preflop') continue;
    if (d.firstIn === true && d.canRaise) add(`open-${d.position}@${d.seatsDealt}`, d.action === 'raise');
    else if (d.raisesFaced === 1) add('vs-raise', d.action === 'call' || d.action === 'raise');
    else if (d.raisesFaced === 0 && (d.limpersAhead ?? 0) > 0) add('iso', d.action !== 'fold');
  }
  const eqKey = (pos) => (pos === 'SB' ? 'SB' : pos === 'BB' ? 'BB'
    : (pos === 'BTN' || pos === 'CO') ? 'LATE' : pos === 'HJ' ? 'MIDDLE' : 'EARLY');
  return (d) => {
    const key = d.iAmLastPreflopAggressor ? `open-${d.position}@${d.seatsDealt}` : 'vs-raise';
    const b = bucket.get(key) || bucket.get('vs-raise');
    if (!b || b.n < 25 || !b.k) return null;
    return { cells: fillToWidth(b.k / b.n, eqKey(d.position)).cells, basis: 'assumed' };
  };
})();

let strengthFilled = 0;
for (const d of decisions) {
  if (d.strength) continue;
  const s = strengthAt(d, entryWidth);
  if (s) { d.strength = s; strengthFilled++; }
}

/**
 * BACK-PROPAGATION: what the new card DID to his range, not just what his range is.
 *
 * FOUNDER, 2026-08-19: *"nut changing turns and rivers when draws being made being a completely
 * different situation"*, and *"back propogated"*.
 *
 * A strength distribution read one street at a time cannot see the event that matters. A turn
 * that completes the flush does not merely change his range - it changes it ASYMMETRICALLY, and
 * whether he was the one drawing decides whether that card is worth a barrel or a shutdown. The
 * quantity is the DELTA, and it only exists once the same hand's streets are joined.
 *
 * Deltas are computed against the previous street OF THE SAME HAND, never against a pooled
 * average - two decisions on different boards have no shared baseline to difference.
 */
const byHandStreet = new Map();
for (const d of decisions) {
  if (!d.strength) continue;
  if (!byHandStreet.has(d.handId)) byHandStreet.set(d.handId, []);
  byHandStreet.get(d.handId).push(d);
}
const STREET_ORDER = { flop: 0, turn: 1, river: 2 };
let deltasFilled = 0;
for (const rows of byHandStreet.values()) {
  rows.sort((a, b) => (STREET_ORDER[a.street] ?? 9) - (STREET_ORDER[b.street] ?? 9) || a.order - b.order);
  let prev = null;
  for (const d of rows) {
    if (prev && prev.street !== d.street && prev.strength.basis === d.strength.basis) {
      d.strengthDelta = {
        pct: +(d.strength.pctMean - prev.strength.pctMean).toFixed(2),
        value: +(d.strength.value - prev.strength.value).toFixed(4),
        draw: +(d.strength.realDraw - prev.strength.realDraw).toFixed(4),
        // A card that removes far more draw than it adds value is a BRICK for his range; one
        // that converts draw into value is a card that got there. The sign is the story.
        completed: (prev.strength.realDraw - d.strength.realDraw) > 0.05
          && (d.strength.value - prev.strength.value) > 0.02,
      };
      deltasFilled++;
    }
    if (prev === null || prev.street !== d.street) prev = d;
  }
}

/**
 * INFERENCE FROM THE TERMINAL ACTION — run after strength and the street deltas exist.
 *
 * A hand that ends without a showdown still says what he did NOT have. This is the only channel
 * that works on every hand rather than on the 7-9% that reach a showdown, and it is why 43
 * behaviours that the detectability census reports as blind for want of an outcome are partly
 * reachable anyway.
 */
const inference = annotate(decisions);

console.log(`PROFILE — villain ${pid}`);
console.log(`${handsOfVillain.length} hands · ${decisions.length} decisions · schema v${SCHEMA_VERSION}`);
{
  const post = decisions.filter((d) => d.street !== 'preflop');
  const withStr = post.filter((d) => d.strength);
  const exact = withStr.filter((d) => d.strength.basis === 'exact').length;
  console.log(`hand strength on ${withStr.length} of ${post.length} postflop decisions `
    + `(${exact} exact, ${withStr.length - exact} assumed)\n`);
}

// ─── 2. GATES ────────────────────────────────────────────────────────────────
/**
 * Every gate is a KNOWN ANSWER, not a plausibility check. Each one corresponds to a bug
 * that actually shipped, so the suite grows by one entry every time something gets through.
 */
const gates = [];
const gate = (name, ok, detail) => gates.push({ name, ok: !!ok, detail });

// A seat facing limps owes the big blind. This read "nothing to call" for the whole corpus.
const limpFacers = decisions.filter(d => d.street === 'preflop' && d.limpersAhead > 0
  && d.position !== 'BB' && d.position !== 'SB');
gate('a seat facing limps owes money',
  limpFacers.length === 0 || limpFacers.every(d => d.toCallBB > 0),
  `${limpFacers.filter(d => d.toCallBB <= 0).length} of ${limpFacers.length} said nothing to call`);

// The big blind facing a raise owes LESS than the raise, because the blind is already in.
const bbFacing = decisions.filter(d => d.position === 'BB' && d.facing === 'a raise' && d.potBB);
gate('the big blind owes less than the raise',
  bbFacing.every(d => d.toCallBB > 0),
  `${bbFacing.length} big-blind-vs-raise decisions checked`);

// Invested-so-far is backward looking; it can never exceed what was available.
const badInvest = decisions.filter(d => d.investedBB != null && d.myStackBB != null
  && d.investedBB > d.myStackBB + d.investedBB + 0.01);
gate('invested is backward-looking only', badInvest.length === 0,
  `${badInvest.length} decisions invested more than existed`);

const postflopRows = (ds) => ds.filter(d => d.boardTexture);

// Paired boards must occur. They silently never did, because the field name was wrong.
const postflop = postflopRows(decisions);
const pairedSeen = postflop.filter(d => d.boardTexture.paired).length;
gate('paired boards are detected', postflop.length === 0 || pairedSeen > 0,
  `${pairedSeen} paired of ${postflop.length} postflop decisions`);

// A field cannot contradict another field. `raisedOverMyBet` was true on 39 decisions where
// `iBetThisStreet` was false — your bet cannot be raised if you never bet. The cause was
// `iBetThisStreet` reading the CURRENT street aggressor, so it flipped to false the moment
// someone raised over him, and it silently meant something other than its own name. Found by
// an agent reading one leaf cold, not by the code.
const contradictory = decisions.filter(d => d.raisedOverMyBet && !d.iBetThisStreet);
gate('a raise over my bet implies I bet', contradictory.length === 0,
  `${contradictory.length} decisions claimed a raise over a bet that never happened`);

// Board texture and the draw flags describe the same board and must agree. Flagged by an
// agent that found a row labelled `twotone` while `flushDraw` was true.
const textureClash = postflopRows(decisions).filter(d =>
  d.boardTexture.flushDraw && !d.boardTexture.monotone && !d.boardTexture.twoTone
  && !(d.boardTexture.trips || d.boardTexture.paired));
gate('board texture agrees with the draw flags', textureClash.length === 0,
  `${textureClash.length} boards had a flush draw with no suited texture`);

// Raising must be available wherever he actually raised. If `canRaise` is ever false on a row
// where the action IS a raise, the legality flag is wrong and would corrupt every mix using it.
const impossibleRaise = decisions.filter(d => d.canRaise === false && d.action === 'raise');
gate('legal-action flag never forbids an action he took', impossibleRaise.length === 0,
  `${impossibleRaise.length} raises taken where raising was marked unavailable`);

/**
 * A SEAT DECLARED ALL-IN MUST NEVER ACT AGAIN ON THAT STREET.
 *
 * The gate above caught the all-in bug, but only by LUCK: it fires only where the villain
 * happened to raise into a spot the labeller called forced. A seat wrongly marked all-in in
 * front of a villain who folded produced no signal at all, and `facingAllIn` is a condition
 * the induction is free to split on.
 *
 * This is the direct invariant, and it needs no cooperation from the villain: if the standing
 * bet was all-in, the seat that made it has no chips and cannot voluntarily act again before
 * the street ends. It reads the hand rather than the villain, so it covers every decision
 * rather than the ones where a contradiction happened to surface.
 */
let allInThenActed = 0;
for (const { h } of handsOfVillain) {
  const seq = [...(h.gameState?.actionSequence || [])].sort((a, b) => a.order - b.order);
  for (const d of decisions) {
    if (d.handId !== h.handId || d.facingAllIn !== true) continue;
    let bettor = null;
    for (const e of seq) {
      if (e.order >= d.order) break;
      if (e.street !== d.street) continue;
      if (e.action === 'raise' || e.action === 'bet') bettor = e;
    }
    if (!bettor) continue;
    const actedAgain = seq.some(e => e.street === d.street && e.order > bettor.order
      && String(e.seat) === String(bettor.seat)
      && (e.action === 'raise' || e.action === 'bet' || e.action === 'call'));
    if (actedAgain) allInThenActed++;
  }
}
gate('a seat declared all-in never acts again that street', allInThenActed === 0,
  `${allInThenActed} decisions faced an "all-in" whose bettor acted again`);

/**
 * INVESTED, RECOMPUTED BY A SECOND IMPLEMENTATION.
 *
 * Deliberately a duplicate rather than a known-answer constant, because the bug this catches is
 * invisible to every simple invariant: `investedBB` double-counted a blind seat's posted blind
 * once that seat RAISED, since a raise `amount` is the street's cumulative commitment and the
 * blind had been added separately. 566 of 569 blind decisions facing an open were exact - the
 * seats had not acted yet - so a "blind's first action equals his blind" check passes while the
 * defect sits in the 69 decisions where he raised.
 *
 * Differential testing is what found it, so differential testing is what guards it. The two
 * implementations share no code; if they ever disagree, one of them is wrong and the run stops.
 */
const investedTruth = (h, seat, order, bbUnit) => {
  const g = h.gameState || {};
  const occ = Object.keys(h.seatPlayers || {}).map(Number).sort((a, b) => a - b);
  const bi = occ.indexOf(Number(g.dealerButtonSeat));
  const s = String(seat);
  let total = 0; const per = {};
  if (bi >= 0) {
    const ring = [...occ.slice(bi + 1), ...occ.slice(0, bi + 1)];
    const sb = (g.blinds?.sb ?? bbUnit / 2) / bbUnit;
    const bbA = (g.blinds?.bb ?? bbUnit) / bbUnit;
    if (String(ring[0]) === s) { total += sb; per.preflop = sb; }
    if (String(ring[1]) === s) { total += bbA; per.preflop = bbA; }
  }
  for (const e of [...(g.actionSequence || [])].sort((a, b) => a.order - b.order)) {
    if (e.order >= order) break;
    if (String(e.seat) !== s) continue;
    const amt = (e.amount ?? 0) / bbUnit;
    if (e.action === 'raise' || e.action === 'bet') {
      total += Math.max(0, amt - (per[e.street] || 0)); per[e.street] = amt;
    } else if (e.action === 'call') {
      total += amt; per[e.street] = (per[e.street] || 0) + amt;
    }
  }
  return total;
};
let investedMismatch = 0;
{
  const seatOf = new Map(handsOfVillain.map(({ h, seat }) => [h.handId, { h, seat }]));
  for (const d of decisions) {
    const rec = seatOf.get(d.handId); if (!rec) continue;
    const bbUnit = rec.h._backtest?.bb ?? rec.h.gameState?.blinds?.bb ?? 1;
    if (Math.abs(investedTruth(rec.h, rec.seat, d.order, bbUnit) - d.investedBB) > 0.011) investedMismatch++;
  }
}
gate('invested agrees with an independent recomputation', investedMismatch === 0,
  `${investedMismatch} of ${decisions.length} decisions disagree`);

/**
 * THE NEW SIZING COLUMN, ANCHORED ON A KNOWN ANSWER.
 *
 * Postflop, if I have put nothing into this street, then what I owe IS the bet he made - there
 * is no dead money of mine between us. That identity needs no reimplementation of either
 * quantity, so it catches the base mismatch that has now produced three separate bugs in this
 * file (all-in detection, invested double-count, and the sizing column itself): cumulative
 * "raise to" figures compared against incremental ones.
 */
let sizingMismatch = 0, sizingChecked = 0;
for (const d of decisions) {
  if (d.street === 'preflop') continue;
  if (d.aggressorToBB == null || d.toCallBB == null || d.investedThisStreetBB == null) continue;
  sizingChecked++;
  // THE FULL IDENTITY, not the special case. The first version of this gate excluded only
  // `iBetThisStreet`, which does not cover having CALLED earlier in the round - and villain 2
  // produced exactly that: he called 5bb, faced a raise of 22bb, and owed 17bb. The gate called
  // the instrument wrong when the arithmetic was right and the check was incomplete.
  if (Math.abs(d.aggressorToBB - d.investedThisStreetBB - d.toCallBB) > 0.011) sizingMismatch++;
}
/**
 * A FOLD THAT COSTS NOTHING IS NOT A CHOICE.
 *
 * One decision per villain folds with nothing to call. Legal on most sites, never correct, and
 * almost certainly a sit-out or disconnect - but it sits inside a mix as though he weighed it
 * against checking, which is the same defect as counting a forced continuation as a decision.
 * Reported with a count rather than silently dropped: a row removed without a number is a row
 * nobody can audit.
 */
const freeFolds = decisions.filter(d => d.action === 'fold' && (d.toCallBB ?? 0) <= 0);
gate('folds that cost nothing are counted and flagged', freeFolds.length <= 3,
  `${freeFolds.length} fold(s) with nothing to call`);

gate('what I owe equals his street total minus mine',
  sizingMismatch === 0,
  `${sizingMismatch} of ${sizingChecked} checked`);

/**
 * A positional feature may never map one value onto two different seats.
 *
 * `off_button` did exactly that across table sizes — value 3 was EP at six-handed, the big
 * blind at five, the small blind at four — so the induction built "rules" that pooled seats
 * the founder describes as drastically different. The failure is invisible in the rule text,
 * which reads like a clean positional ladder. This gate makes it loud.
 *
 * WHAT THIS GATE USED TO ASSERT, AND WHY THAT WAS WRONG. It required the seat NAME to be a
 * function of `off_button`: one distance from the button, one label. That holds only while
 * every seat is named from the button backwards, and the naming is not like that. Early seats
 * are named from the FRONT — under the gun is whoever opens the field — and late seats from
 * the BACK. At five-handed the third seat is both `n - 3` and the first to act; naming it by
 * distance called it the hijack and pooled it with the six-handed hijack, which acts second.
 * The old gate PASSED on that pooling and FAILED on the fix, because a label that is merely
 * `off_button` renamed cannot disagree with `off_button` — and a seat name that carries no
 * information beyond a column already in the schema violates the over-enumeration rule the
 * whole feature set is built on ("redundancy is deliberate — correlation picks the framing").
 *
 * WHAT IT ASSERTS NOW, which catches the original bug more directly and costs nothing:
 *
 *   1. `off_button` is never defined for a blind. The recorded failure was value 3 meaning
 *      early position at one table size and a BLIND at another; a blind has posted money and
 *      acts last preflop, so pooling it with a voluntary seat is the collision that mattered.
 *   2. Within one table size, one `off_button` value means one seat. That is the actual
 *      well-definedness constraint, and it does not force the two naming directions to agree.
 *
 * `off_button` still pools ACROSS table sizes by construction — it is a physical distance, and
 * BTN at four-handed and at six-handed share value 0. That is only safe because table size is
 * itself a conditionable column, so the induction can always cut the pool back apart; assert
 * that too, since the day `players` leaves the situation group this becomes a silent blend.
 */
// Blinds now carry a distance from the button. What must hold instead is that one value never
// conflates a blind with a non-blind at the same table size - the collision the old gate was
// really guarding against, stated directly rather than by withholding the column.
const seatsPerDistance = new Map();
for (const d of decisions) {
  if (d.offButton == null) continue;
  const key = `${d.seatsDealt}-handed off_button=${d.offButton}`;
  if (!seatsPerDistance.has(key)) seatsPerDistance.set(key, new Set());
  seatsPerDistance.get(key).add(d.position);
}
const collided = [...seatsPerDistance.entries()].filter(([, v]) => v.size > 1);
gate('one distance from the button means one seat, at one table size', collided.length === 0,
  collided.length ? collided.map(([k, v]) => `${k}={${[...v].join(',')}}`).join(' ')
    : `${seatsPerDistance.size} table-size/distance pairs, each a single seat`);

const tableSizes = new Set(decisions.map(d => d.seatsDealt));
gate('table size is conditionable, so off-button can be un-pooled',
  SITUATION_FIELDS.includes('players'),
  `players is a situation field; ${tableSizes.size} table size(s) present: ${[...tableSizes].sort().join(', ')}`);

// No outcome field may be offered as a rule condition.
const outcomeNames = FIELDS.filter(f => f.group === 'outcome').map(f => f.name);
gate('no outcome field is conditionable',
  outcomeNames.every(n => !SITUATION_FIELDS.includes(n)),
  outcomeNames.join(', ') + ' held out');

// Money committed must count raises, not only calls — the bug that hid a 25bb bluff.
const moneyIn = (ds) => ds.filter(d => d.street !== 'preflop')
  .reduce((s, d) => s + (d.action === 'call' ? (d.toCallBB || 0)
    : (d.action === 'bet' || d.action === 'raise') ? ((d.myRaiseToBB || 0)) : 0), 0);
const aggressorHands = handsOfVillain.filter(({ h, seat }) =>
  labelDecisions(h, seat).some(d => d.street !== 'preflop' && (d.action === 'bet' || d.action === 'raise')));
gate('money counts raises, not only calls',
  aggressorHands.length === 0 || aggressorHands.some(({ h, seat }) => moneyIn(labelDecisions(h, seat)) > 0),
  `${aggressorHands.length} hands where he bet or raised postflop`);

console.log('GATES');
let failed = 0;
for (const g of gates) {
  console.log(`  ${g.ok ? 'pass' : 'FAIL'}  ${g.name.padEnd(44)} ${g.detail}`);
  if (!g.ok) failed++;
}
if (failed) {
  console.error(`\n${failed} GATE(S) FAILED — the instrument is wrong, so no rules will be induced.`);
  process.exit(1);
}

// ─── 3. ENUMERATE ────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const safe = pid.replace(/[^A-Za-z0-9]/g, '').slice(0, 12);
const rows = decisions.map(toRow);
writeFileSync(`${OUT}/${safe}.tsv`,
  [header().join('\t'), ...rows.map(r => header().map(c => r[c]).join('\t'))].join('\n'));

// ─── 4. INDUCE, as MIXES with intervals ──────────────────────────────────────
/**
 * FOUNDER, 2026-08-18: "If we allow for a rule to be to mix, then we will have a new shape of
 * rule that allows us to still be precise at lower rule count and less statistical variance by
 * just giving it a mixing %."
 *
 * Measured on villain 1 the moment it was wired: 34 rules -> 18, coverage unchanged at 100%,
 * accuracy 83.0% -> 82.8%, rules with a CI wider than 30pp 4 -> 1. Half the ruleset for two
 * tenths of a point, and the intervals got tighter rather than looser, because the same
 * decisions now sit in one estimate instead of three.
 *
 * A rule is now a DISTRIBUTION over actions, not a majority label with a discarded remainder.
 * Every rule reports every action he took in that spot, each with its own interval.
 */
const { induce, wilson } = await import('./induceCore.mjs');
const { rules, coverage, accuracy } = induce(decisions);

const VERDICTS = {
  always: 'ALWAYS — the exception set is empty',
  // The wording is exact, and the exactness matters. `classifyLeaf` tests features ONE AT A
  // TIME, so "mix" means no SINGLE feature separates the split. It cannot see a disjunction.
  // Demonstrated 2026-08-18 on the continuation-bet leaf: an agent searching 113,704 OR-
  // combinations with a permutation FWER found (opps_live>=3 OR initiative=no OR barrels=3)
  // separating it at corrected p=0.024 — 1 bet in 16 against 46 in 67 — while every one of
  // its three parts died individually under correction. Calling that leaf a mix was wrong.
  // Until the search covers combinations, this verdict is a statement about single features
  // and must not be read as a statement about the villain.
  mix: 'MIX — no SINGLE feature separates these (combinations not yet searched)',
  'hidden-cond': 'HIDDEN CONDITION — a feature DOES separate this, blocked only by sample size',
  'needs-cards': 'NEEDS CARDS — the shown hands separate; nothing observable does',
};

console.log(`\nRULESET — ${rules.length} rules, ${(coverage * 100).toFixed(1)}% coverage, `
  + `${(accuracy * 100).toFixed(1)}% in-sample accuracy\n`);

for (const r of rules.sort((a, b) => b.n - a.n)) {
  /**
   * A condition whose underlying column never varied inside the leaf is annotated with the one
   * value it took. Without it, "a steep price (36-45%)" reads as a price he responds to when the
   * price was 40% on every row and could not have been anything else.
   */
  const desc = r.conds.length
    ? r.conds.map((c, i) => {
      const cv = r.condValues?.[i];
      // Only RANGE labels can mislead. "0 raise(s) already in" already names its value; a band
      // like "(36-45%)" or "<20%" promises variation the leaf may not contain.
      const isRange = /\(\d+\s*-\s*\d+%\)|<\s*\d+%/.test(c.value);
      return cv && cv.constant && isRange
        ? `${c.value} [always exactly ${cv.values[0]}]` : c.value;
    }).join(' AND ')
    : 'everything else';
  console.log(`[${String(r.n).padStart(4)}]  ${desc}`);
  for (const [action, c] of r.mix.dist) {
    const [lo, hi] = wilson(c, r.n);
    console.log(`        I ${String(action).padEnd(6)} ${String(Math.round(100 * c / r.n)).padStart(3)}%  `
      + `[95% CI ${(lo * 100).toFixed(0)}-${(hi * 100).toFixed(0)}%, width ${((hi - lo) * 100).toFixed(0)}pp]  (${c}/${r.n})`);
  }
  console.log(`        ${VERDICTS[r.verdict]}`);
  if (r.mix.separators.length) {
    console.log(`        cut it with: ${r.mix.separators.slice(0, 4)
      .map(s => `${s.feature} (p=${s.pAdj.toExponential(1)})`).join(', ')}`);
  }
  if (r.verdict === 'needs-cards') {
    console.log(`        the ${r.mix.cardTest.nShown} shown hands separate at p=${r.mix.cardTest.p.toFixed(4)}`
      + ` — resolving this needs the range-inference layer, not more corpus.`);
  }
}

// ─── 5. WHAT IS STILL UNRESOLVED ─────────────────────────────────────────────
const byVerdict = rules.reduce((m, r) => { m[r.verdict] = (m[r.verdict] || 0) + 1; return m; }, {});
console.log('\nVERDICTS — ' + Object.entries(byVerdict).map(([k, v]) => `${k} ${v}`).join(' · '));

const unresolved = rules.filter(r => r.verdict === 'hidden-cond' || r.verdict === 'needs-cards');
console.log(`\nSTILL UNRESOLVED: ${unresolved.length} of ${rules.length} rules `
  + `(${unresolved.reduce((s, r) => s + r.n, 0)} of ${decisions.length} decisions)`);
for (const r of unresolved) {
  console.log(`  [${r.n}] ${r.conds.map(c => c.value).join(' AND ') || 'everything else'}`);
  console.log(`        ${r.verdict === 'needs-cards'
    ? 'needs hole cards — the inference layer is what resolves it'
    : `needs sample — ${r.mix.separators[0].feature} separates it but every cut lands under the floor`}`);
}

const wide = rules.filter(r => { const [lo, hi] = wilson(r.k, r.n); return (hi - lo) > 0.30; });
console.log(`\nRULES TOO THIN TO TRUST (CI wider than 30pp): ${wide.length} of ${rules.length}`);

// ─── 5b. THE GATE THIS CHANGE OPENS ──────────────────────────────────────────
/**
 * A mix and an unresolved wrinkle are observationally identical at a single node. If `mix`
 * becomes the label applied whenever splitting fails, the unresolved count goes to zero for
 * the wrong reason and the search stops early — the same self-concealing failure the engine
 * spec names in §4. So the classifier has to be shown to be DISCRIMINATING, not merely running.
 */
const impure = rules.filter(r => r.verdict !== 'always');
const postGates = [];
postGates.push({ name: 'the mix classifier actually tested features',
  ok: impure.every(r => r.mix.tested > 0),
  detail: `min features tested on an impure leaf: ${Math.min(...impure.map(r => r.mix.tested))}` });
postGates.push({ name: 'the mix verdict discriminates',
  ok: impure.length === 0 || impure.some(r => r.verdict !== 'mix'),
  detail: `${impure.filter(r => r.verdict === 'mix').length} of ${impure.length} impure leaves came back "mix"`
    + (impure.every(r => r.verdict === 'mix') ? ' — ALL of them, which means the test is not separating anything' : '') });
postGates.push({ name: 'every verdict is on the closed list',
  ok: rules.every(r => Object.prototype.hasOwnProperty.call(VERDICTS, r.verdict)),
  detail: Object.keys(byVerdict).join(', ') });

console.log('\nPOST-INDUCTION GATES');
let postFailed = 0;
for (const g of postGates) {
  console.log(`  ${g.ok ? 'pass' : 'FAIL'}  ${g.name.padEnd(44)} ${g.detail}`);
  if (!g.ok) postFailed++;
}
if (postFailed) {
  console.error(`\n${postFailed} POST-INDUCTION GATE(S) FAILED — the ruleset is not trustworthy.`);
  process.exit(1);
}

// ─── 6. THE CONDUCT CARD ─────────────────────────────────────────────────────
/**
 * The description becomes a RECORD. Founder, 2026-08-18: the villain profile is "his game in
 * his terms", not a read — a read needs a second argument this object does not have. The card
 * is therefore the only one of the villain objects that makes no comparative claim, which is
 * why it gets a form of its own while an Appraisal or a Read is a Result Card variant.
 */
const { emitConductCard } = await import('./emitConductCard.mjs');
const conductCard = await emitConductCard({
  subjectId: pid,
  rules, decisions, files, gates: [...gates, ...postGates],
  induction: {
    minRule: 25, maxDepth: 5, alpha: 0.05, requireSignificance: true,
  },
  wilson,
  sourcePaths: [...new Set(handsOfVillain.map(({ h }) => fileOfHand.get(h)).filter(Boolean))],
  population: 'online-50NL-2009 (HandHQ). NOT the founder\'s live 9-handed 1/2-1/3 game.',
});
writeFileSync(`${OUT}/${safe}.conduct-card.json`, JSON.stringify(conductCard, null, 1));
console.log(`\nCONDUCT CARD ${conductCard.cardId}`);
console.log(`  ${conductCard.rules.length} mixes · ${conductCard.unresolved.length} unresolved · `
  + `separator search arity ${conductCard.separatorSearch.arity}`);
console.log(`  ${conductCard.contentHash}`);
console.log(`  ${conductCard.dealBook.dealBookHash}`);

writeFileSync(`${OUT}/${safe}.json`, JSON.stringify({
  pid, schema: SCHEMA_VERSION, hands: handsOfVillain.length, decisions: decisions.length,
  // TABLE SIZES HE ACTUALLY PLAYED, as a share of his decisions. On the card because a dossier
  // that says "nine-handed" about a six-max player misstates what every position means, and the
  // first one did exactly that from a hardcoded line. It is a property of the subject, so it
  // belongs in the record rather than in the prose that renders it.
  tableSizes: [...decisions.reduce((m, d) => m.set(d.seatsDealt, (m.get(d.seatsDealt) || 0) + 1),
    new Map())].sort((a, b) => a[0] - b[0]).map(([seats, n]) => ({ seats, n, share: n / decisions.length })),
  gates: [...gates, ...postGates], coverage, accuracy,
  rules: rules.map(r => {
    const [lo, hi] = wilson(r.k, r.n);
    return { n: r.n, k: r.k, action: r.action, kind: r.kind, verdict: r.verdict,
      conds: r.conds, condValues: r.condValues, ci: [lo, hi], tally: [...r.tally.entries()],
      /**
       * The strength ceiling this rule's decisions sat under, split by street and by basis.
       * Carried on the rule rather than computed downstream so the dossier reads one number
       * from the record instead of re-deriving it and risking a different answer.
       */
      strength: (() => {
        const g = new Map();
        for (const d of r.pool) {
          if (!d.strength) continue;
          const key = `${d.street}|${d.strength.basis}`;
          if (!g.has(key)) g.set(key, { street: d.street, basis: d.strength.basis, n: 0, value: 0, draw: 0, air: 0, bet: 0 });
          const a = g.get(key);
          a.n++; a.value += d.strength.value; a.draw += d.strength.draw; a.air += d.strength.air;
          if (d.action === 'bet' || d.action === 'raise') a.bet++;
        }
        return [...g.values()].map(a => ({
          street: a.street, basis: a.basis, n: a.n,
          value: +(a.value / a.n).toFixed(4), draw: +(a.draw / a.n).toFixed(4),
          air: +(a.air / a.n).toFixed(4), bet: a.bet,
        }));
      })(),
      mix: r.mix.dist.map(([a, c]) => ({ action: a, k: c, rate: c / r.n, ci: wilson(c, r.n) })),
      separators: r.mix.separators.slice(0, 5).map(s => ({ feature: s.feature, p: s.pAdj })),
      cardTest: r.mix.cardTest ? { n: r.mix.cardTest.nShown, p: r.mix.cardTest.p } : null,
      shown: r.pool.filter(d => d.handKnown).map(d => ({ cards: d.holeCards.join(''), action: d.action, street: d.street })),
      streets: r.pool.reduce((m, d) => { m[d.street] = (m[d.street] || 0) + 1; return m; }, {}),
    };
  }),
  unresolved: unresolved.length,
}, null, 1));
console.log(`\nwrote ${OUT}/${safe}.json and .tsv`);
