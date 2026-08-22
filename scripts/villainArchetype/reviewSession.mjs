/**
 * reviewSession.mjs — read back a session that was actually played.
 *
 * NO SHEBANG, DELIBERATELY — see the same note in `mineFieldPolicy.mjs`. Tests import this
 * module, and once the module graph grows enough that vitest externalizes it rather than
 * transforming it, the file is compiled through `new vm.Script`, which does not strip a
 * leading `#!` the way Node's module loader does. It surfaces as a bare
 * `SyntaxError: Invalid or unexpected token` pointing at a line number in generated output.
 * Always invoked as `node scripts/villainArchetype/reviewSession.mjs`, so nothing is lost.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT THIS IS FOR
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * The founder plays, stops, and a review is waiting. No export, no button, no step. The sink
 * (`scripts/sessionSink/serve.mjs`) seals a session when the table goes quiet and spawns this.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * THE THING THIS SESSION HAS THAT THE CORPUS NEVER WILL: HERO'S CARDS
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * `heroPolicy.mjs` has to marginalize the engine's advice over hero's INFERRED range, because
 * the corpus masks hole cards (`d dh p1 ????`). Its own header calls that "a weaker claim than
 * a cards-known instrument would make". WS-294 wants a cards-known arm and can only get one on
 * the ~30% of corpus decisions that reached showdown — a showdown-conditioned subset containing
 * ZERO fold decisions, which is why it was never the headline.
 *
 * A session the founder played has none of that. The extension captured `holeCards` on every
 * hand, and `appRecordAdapter` puts them into `showdownCards[heroSeat]`, so `labelDecisions`
 * returns `handKnown: true` on EVERY hero decision — folds included, no showdown required.
 * This runner is therefore the unbiased cards-known arm, and it says so on its output.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * WHAT IT REFUSES TO DO
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 * A session is a few hundred hands. Most cells will not support a claim, and the honest output
 * is a refusal with a reason, not a shrunk number that reads like a measurement
 * (`.claude/rules/sparsity-refuse-or-shrink.md`). Every refusal here names what would resolve
 * it, because a limitation is a thing to remove, not a thing to plan around.
 *
 * It also refuses to price hero against a solver baseline. See the pier-post note on
 * `priceAgainstPoolBestResponse` below.
 *
 * ═══════════════════════════════════════════════════════════════════════════════════════
 * RUN
 * ═══════════════════════════════════════════════════════════════════════════════════════
 *
 *   node scripts/villainArchetype/reviewSession.mjs --session <sealedSessionDir>
 *   node scripts/villainArchetype/reviewSession.mjs --session <dir> --field-policy out/field-policy.json
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

import { readSessionHands } from '../sessionSink/sessionStore.mjs';
import { adaptAppRecord } from '../backtest/appRecordAdapter.mjs';
import { labelDecisions } from './decisionLabeler.mjs';
import { emitConductCard } from './emitConductCard.mjs';
import { buildDossier } from './handDossier.mjs';
import { induce, MIN_RULE_DEFAULT } from './induceCore.mjs';
import { loadLeakRules } from './loadLeakRules.mjs';
import { renderSessionReview } from './renderSessionReview.mjs';
import { priceSession } from './priceSession.mjs';
import { heroContexts } from './runMoneyColumn.mjs';
import { transferStatusFor } from '../backtest/behaviorPolicy.mjs';
import { conductCardProblems } from '../../src/utils/standardOfRecord/conductCard.js';
import { accumulateHeroDecisions } from '../../src/utils/skillAssessment/heroDecisionAccumulator.js';
import { detectWithRules, stabilizeLeaks } from '../../src/utils/skillAssessment/detectWithRules.js';
import { getSolverBaseline } from '../../src/utils/skillAssessment/solverBaselines.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');

// ═══════════════════════════════════════════════════════════════════════════════════════
// REFUSAL VOCABULARY — closed, because a zero is several different facts
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// `observed-zero` (it happened zero times), `unexamined` (we never looked) and `dropped` (it
// was excluded) mean opposite things to anything downstream. Collapsing them is how a hole
// becomes indistinguishable from a measurement of nothing.
export const REFUSALS = Object.freeze({
  THIN: 'unexamined:insufficient-n',
  NO_FIELD_POLICY: 'unexamined:no-field-policy',
  NO_HERO: 'unexamined:hero-not-seated',
  CARDS_UNKNOWN: 'unexamined:hole-cards-not-captured',
});

/** Every refusal states the n or the artefact that would resolve it. Never a bare "not enough". */
const refuse = (reason, detail, resolvedBy) => ({ refused: true, reason, detail, resolvedBy });

const parseArgs = (argv) => {
  const args = {};
  for (let i = 2; i < argv.length; i += 1) {
    const t = argv[i];
    if (!t.startsWith('--')) continue;
    const k = t.slice(2);
    const n = argv[i + 1];
    if (n === undefined || n.startsWith('--')) args[k] = true;
    else { args[k] = n; i += 1; }
  }
  return args;
};

const wilson = (k, n) => {
  if (!n) return [0, 1];
  const p = k / n;
  const half = 1.96 * Math.sqrt((p * (1 - p)) / n);
  return [Math.max(0, p - half), Math.min(1, p + half)];
};

const sha = (o) => `sha256:${createHash('sha256').update(JSON.stringify(o)).digest('hex')}`;

/** Stake label from what the extension recorded, never guessed. */
const stakeLabelOf = (hand) => {
  const b = hand?.ignitionMeta?.blinds;
  if (!b || !(Number(b.bb) > 0)) return null;
  const fmt = (x) => String(Number(x)).replace(/\.0+$/, '');
  return `${fmt(b.sb)}/${fmt(b.bb)}`;
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// STAGE 1 — adapt, and account for every hand that does not make it
// ═══════════════════════════════════════════════════════════════════════════════════════

const adaptAll = (hands) => {
  const adapted = [];
  const skips = {};
  for (const record of hands) {
    const stakeLabel = stakeLabelOf(record);
    const res = adaptAppRecord(record, { site: 'ignition', stakeLabel });
    if (res.skip) {
      skips[res.skip] = (skips[res.skip] || 0) + 1;
      continue;
    }
    adapted.push({ hand: res.hand ?? res, source: record, stakeLabel });
  }
  return { adapted, skips };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// STAGE 2 — hero's decisions, with the cards-known claim CHECKED rather than assumed
// ═══════════════════════════════════════════════════════════════════════════════════════

const heroDecisions = (adapted) => {
  const rows = [];
  let heroHands = 0;
  let observedHands = 0;
  let cardsKnownRows = 0;
  let unknowableRows = 0;
  let carriedHands = 0;

  for (const { hand, source } of adapted) {
    const seat = hand?.gameState?.mySeat;
    if (seat == null) { observedHands += 1; continue; }
    heroHands += 1;

    /**
     * `carried` MEANS HERO'S CARDS ARE UNKNOWABLE, NOT THAT WE FAILED TO CAPTURE THEM.
     *
     * Traced to the protocol on 2026-08-21, after my own hypothesis ("capture attached after
     * the deal") was wrong: on a socket reconnect Ignition sends a CO_TABLE_INFO snapshot that
     * lists every OTHER seat face-down (`pcard1:[32896,32896]`, `pcard3..9` likewise) and
     * OMITS hero's own seat entirely. For a hand already in progress, hero's hole cards are
     * never re-sent. No amount of better capture recovers them.
     *
     * That makes these decisions `unexamined` in this repo's refusal vocabulary — we never
     * could look — and NOT `dropped`. The distinction is load-bearing: counting them as
     * cards-unknown failures made the instrument look broken, and silently excluding them
     * would inflate the cards-known claim. They are excluded from the claim's DENOMINATOR and
     * reported as their own quantity, so the coverage stays visible either way.
     */
    const unknowable = source?.ignitionMeta?.heroSeatConfidence === 'carried';
    if (unknowable) carriedHands += 1;

    const labelled = labelDecisions(hand, seat);
    for (const r of labelled) {
      if (unknowable) unknowableRows += 1;
      else if (r.handKnown) cardsKnownRows += 1;
      rows.push({ ...r, cardsUnknowable: unknowable });
    }
  }

  // The denominator is decisions whose cards COULD be known. A protocol-unknowable hand is not
  // a miss against that claim; it is outside it, and is reported beside it.
  const knowableRows = rows.length - unknowableRows;

  return {
    rows,
    heroHands,
    observedHands,
    cardsKnownRows,
    unknowableRows,
    carriedHands,
    knowableRows,
    // The headline claim of this instrument, stated as a measured fraction rather than an
    // assertion. If it is not ~1.0 the cards-known framing is WRONG for this session and the
    // report must not claim it.
    cardsKnownFraction: knowableRows ? cardsKnownRows / knowableRows : 0,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// STAGE 3 — Conduct Cards
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Induce a ruleset, or refuse.
 *
 * `induce` needs hundreds of decisions per leaf. A session has hundreds TOTAL. Emitting a card
 * off a one-leaf "ruleset" would produce a valid-looking artifact whose rules were never
 * actually found — the exact shape of claim this repo keeps having to retract. So below the
 * floor this refuses and says how many more decisions it needs.
 */
const induceOrRefuse = (rows, { minRule = MIN_RULE_DEFAULT } = {}) => {
  if (rows.length < minRule) {
    return refuse(
      REFUSALS.THIN,
      `${rows.length} decisions; induction needs at least ${minRule} for a single leaf`,
      `${minRule - rows.length} more decisions in this spot class`,
    );
  }
  const out = induce(rows, { minRule, requireSignificance: false });
  return { refused: false, rules: out?.rules ?? out?.leaves ?? [], raw: out };
};

const buildCard = async ({ subjectId, rows, sessionId, population, sourcePaths, gates }) => {
  const induced = induceOrRefuse(rows);
  if (induced.refused) return { card: null, refusal: induced };

  let card = null;
  let problems = null;
  try {
    card = await emitConductCard({
      subjectId,
      rules: induced.rules,
      decisions: rows,
      files: sourcePaths,
      gates,
      induction: { minRule: MIN_RULE_DEFAULT, maxDepth: 5, alpha: 0.05, requireSignificance: false },
      wilson,
      sourcePaths,
      population,
    });
    problems = conductCardProblems(card);
  } catch (e) {
    /**
     * `e.problems` IS THE DIAGNOSIS AND IT WAS BEING THROWN AWAY.
     *
     * `buildConductCard` raises `StandardOfRecordError('conduct card is not valid', {cardId,
     * problems})` — the problems array names every field that failed and why. Keeping only
     * `e.message` reduced all of that to the string "conduct card is not valid", which is
     * `.claude/rules/error-handling.md`'s named anti-pattern verbatim: "'Error occurred' is
     * never acceptable."
     *
     * It cost real coverage before anyone noticed. MEASURED 2026-08-21: 13 of 120 subjects
     * refused with `emit-failed` and not one of the refusals said what was wrong, so a
     * fixable emitter bug read identically to a subject that legitimately had nothing to say.
     */
    const problemList = Array.isArray(e?.problems) ? e.problems : null;
    return {
      card: null,
      refusal: refuse(
        'emit-failed',
        problemList ? `${e.message}: ${problemList.slice(0, 5).join('; ')}` : e.message,
        'fix the emitter or the rows',
      ),
      problems: problemList,
    };
  }
  if (problems?.length) {
    return { card: null, refusal: refuse('card-invalid', problems.slice(0, 5).join('; '), 'fix the listed problems') };
  }
  return { card, refusal: null };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// STAGE 3b — WHO IS THE SUBJECT? (measured 2026-08-21, and the answer constrains the card)
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// An Ignition capture carries NO PLAYER IDENTITY. Measured, not assumed: across a real
// 54-hand capture, `seatPlayers` maps every seat to a synthetic label — `"seat_1"`, `"seat_3"`,
// `"hero"` — and no field anywhere in the record (top level, `ignitionMeta`, `gameState`)
// holds a name, nick, alias or uid. In that same capture the seat-occupancy set changed 26
// times.
//
// The first version of this runner keyed a Conduct Card on `seatPlayers[seat].name`, which is
// `undefined` for those string values, and silently fell through to `seat3`. It emitted eight
// confident "villain" cards that were really cards about CHAIRS — merging every human who sat
// there during the session into one subject, with nothing on the artifact saying so.
//
// WHAT THE DATA ACTUALLY SUPPORTS is a SEAT-OCCUPANCY SEGMENT: "whoever was in seat 3 between
// hand 12 and hand 40". Under the cold-read regime that is not a consolation prize — it is the
// right object, because the founder's question at the table is exactly "what does the person in
// seat 3 do", and Ignition gives him no cross-session identity anyway.
//
// A seat change is invisible in the record, so it is INFERRED from a stack discontinuity: a
// seat whose starting stack jumps upward by more than a rebuy-sized step, having previously
// been short, is probably a different person. That is a heuristic and it is labelled as one.
// It can only SPLIT a subject, never merge two — the safe direction, since an over-split
// produces two thin cards that refuse, while an under-split produces one confident wrong card.

const SYNTHETIC_SEAT_LABEL = /^(seat[_-]?\d+|hero|villain\d*|player\d*)$/i;

/** Real identity if the record carries one; null when it only carries a seat label. */
const identityOf = (entry) => {
  if (entry && typeof entry === 'object') {
    const name = entry.name ?? entry.playerName ?? entry.id ?? entry.playerId;
    return name && !SYNTHETIC_SEAT_LABEL.test(String(name)) ? String(name) : null;
  }
  if (typeof entry === 'string' && !SYNTHETIC_SEAT_LABEL.test(entry)) return entry;
  return null;
};

/**
 * A seat change requires the seat to have actually been EMPTY, not merely to have gained chips.
 *
 * The first cut of this split on an upward stack jump alone and inferred 18 seat changes in a
 * 54-hand capture — nonsense, because winning a 30bb pot makes the next hand's starting stack
 * jump by 30bb. A player who never left the table cannot be a different person, so the
 * occupancy gap is the necessary condition and the stack move is only corroboration.
 *
 * Both directions matter: over-splitting shreds a real subject into thin cards that refuse,
 * under-splitting merges two humans into one confident wrong card. Requiring the gap is more
 * accurate against both.
 */
const SEAT_CHANGE_STACK_DELTA_BB = 10;

/**
 * `sessionId` IS PART OF A SEAT-SEGMENT SUBJECT'S IDENTITY, not decoration on it.
 *
 * A seat-occupancy segment is `seat8#s1` — "whoever was sitting in seat 8 during the first
 * stretch". Across two sessions at two different tables that names TWO DIFFERENT HUMANS, and
 * without the session in the id they were one subject. MEASURED 2026-08-21: `seat8#s1` from
 * the June 15 session and from the June 19 session produced cards with the same id.
 *
 * A real `player:<id>` subject does NOT get the session prefix — that identity is genuinely
 * stable across sessions, and scoping it would prevent the one join that matters, "every card
 * about this player". The two subject kinds have different identity semantics and the id has
 * to say which it is.
 */
export const resolveSubjects = (adapted, heroSeat, sessionId = null) => {
  const bySubject = new Map();
  const identityBasisCounts = { playerId: 0, seatSegment: 0 };
  let segmentSplits = 0;

  // Track, per seat, the running segment and the last starting stack seen there.
  const seatState = new Map();

  adapted.forEach(({ hand, source }, handIndex) => {
    const startStacks = source?.ignitionMeta?.startStacks || {};
    const bb = Number(source?.ignitionMeta?.blinds?.bb) || 0;

    for (const seatKey of Object.keys(hand.seatPlayers || {})) {
      const seat = Number(seatKey);
      if (seat === Number(heroSeat)) continue;

      const identity = identityOf(hand.seatPlayers[seatKey]);
      let subjectId;

      if (identity) {
        identityBasisCounts.playerId += 1;
        subjectId = `player:${identity}`;
      } else {
        identityBasisCounts.seatSegment += 1;
        const st = seatState.get(seat) || { segment: 1, lastStackBB: null, lastHandIndex: -1 };
        const stackBB = bb > 0 && startStacks[seatKey] != null
          ? Number(startStacks[seatKey]) / bb
          : null;

        // NECESSARY CONDITION: the seat was empty for at least one hand in between. Without a
        // gap there is no moment at which a different person could have sat down.
        const wasVacant = st.lastHandIndex >= 0 && handIndex - st.lastHandIndex > 1;
        const stackMoved = st.lastStackBB != null && stackBB != null
          && Math.abs(stackBB - st.lastStackBB) > SEAT_CHANGE_STACK_DELTA_BB;

        if (wasVacant && stackMoved) {
          st.segment += 1;
          segmentSplits += 1;
        }
        st.lastStackBB = stackBB;
        st.lastHandIndex = handIndex;
        seatState.set(seat, st);
        subjectId = `${sessionId ? `${sessionId}:` : ''}seat${seat}#s${st.segment}`;
      }

      const cur = bySubject.get(subjectId)
        || { subjectId, seat, identity, rows: [], hands: 0, firstHandIndex: handIndex, lastHandIndex: handIndex };
      cur.rows.push(...labelDecisions(hand, seat));
      cur.hands += 1;
      cur.lastHandIndex = handIndex;
      bySubject.set(subjectId, cur);
    }
  });

  return {
    subjects: [...bySubject.values()].sort((a, b) => b.rows.length - a.rows.length),
    identityBasis: identityBasisCounts.playerId > 0 && identityBasisCounts.seatSegment === 0
      ? 'player-id'
      : (identityBasisCounts.playerId === 0 ? 'seat-segment' : 'mixed'),
    segmentSplits,
    caveat:
      'Ignition supplies no player identity — measured, not assumed: no name/nick/alias/uid '
      + 'field exists anywhere in a captured record. A subject here is A SEAT-OCCUPANCY '
      + 'SEGMENT, not a person. A same-seat replacement is invisible in the data and is '
      + 'inferred only from an upward stack discontinuity '
      + `(a vacancy gap PLUS a >${SEAT_CHANGE_STACK_DELTA_BB}bb stack move), which is a heuristic that can over-split but `
      + 'never merges two people into one subject.',
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// STAGE 4 — spot locators (NOT verdicts)
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Run the SCF leak rules to find WHICH SPOT CLASSES are worth pricing.
 *
 * These rules compare hero's frequency to `solverBaselines.js`, and all 32 of its entries carry
 * `source: 'hardcoded'` — estimates attributed to solver software, measured from nothing. Under
 * ADR-009's pier posts an equilibrium reference is the LOWER post, and moving away from it
 * toward a field's exploitable tendency is the whole purpose of this system. So a hit here is a
 * SHORTLIST ENTRY, never a finding that hero was wrong, and the output says so in the payload
 * rather than in a comment nobody reads.
 */
const locateSpots = async (sourceHands, heroSeat, stampedAt) => {
  if (heroSeat == null) {
    return { refused: true, ...refuse(REFUSALS.NO_HERO, 'no hand had a hero seat', 'play some hands') };
  }
  const { rules, skipped } = await loadLeakRules();
  // NOTE the shape difference, and do not "fix" it: the accumulator consumes the PERSISTED
  // record (`cardState.communityCards`, encoded ints) while the labeller consumes the ADAPTED
  // one (`gameState.communityCards`, strings). Two consumers, two adapters, ONE source record.
  // Unifying them is the WS-291 three-representations mechanism.
  const acc = accumulateHeroDecisions({ hands: sourceHands, heroSeat });
  const fired = detectWithRules(acc, rules, { baselineLookup: getSolverBaseline });
  return {
    refused: false,
    interpretation:
      'SHORTLIST, NOT VERDICT. Each hit marks a spot class worth pricing against Pool Best '
      + 'Response. The baseline behind it is an unmeasured solver estimate '
      + '(solverBaselines.js, every entry source:"hardcoded"), and deliberately deviating from '
      + 'equilibrium toward the field is what this system exists to do.',
    totalActions: acc.totalActions ?? 0,
    ruleCount: rules.length,
    skippedRuleFiles: skipped,
    spots: stabilizeLeaks(fired, stampedAt),
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// STAGE 5 — the money arm
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Price hero's decisions against POOL BEST RESPONSE — the upper pier post.
 *
 * FOUNDER, 2026-08-21: "solver is not the ideal strategy, not even on a regular table. why are
 * we referring to it like it is." Correct, and `poolBestResponse.mjs:19-22` already says it:
 * "NOT GTO. An equilibrium is UNEXPLOITABLE and deliberately leaves money on the table against
 * a weak field." The number worth reporting is EV LEFT ON THE TABLE against the best response
 * to the MEASURED field — money that was actually there and was not taken.
 *
 * WHY THIS REFUSES TODAY, AND EXACTLY WHAT UNBLOCKS IT.
 *
 * PBR needs a `policy` — the field's measured response rates. The one that exists
 * (`out/behavior-policy.json`) was mined from the 2009 HandHQ corpus. Using it to say what was
 * available against a modern Ignition table is a LEVELS transfer, the top-ranked entry in the
 * Suspected-Fault Register, and `.claude/rules/corpus-transfer-is-earned.md` forbids it crossing
 * into a live claim by default.
 *
 * The right field is the founder's own accumulating Ignition pool, mined from these very
 * sessions. That is why this refuses rather than silently substituting the corpus: the refusal
 * is what makes the missing artefact visible, and the artefact is buildable from data this
 * runner is now collecting on every session.
 *
 * When both exist, they run as TWO ARMS and the delta between them is itself the result — which
 * is `.claude/rules/unmeasured-constants.md` applied to the transfer question, and the only way
 * "does the corpus transfer" ever stops being a caveat and becomes a measurement.
 */
const priceAgainstPoolBestResponse = ({ fieldPolicyPath, sessionId }) => {
  const corpusPolicy = join(REPO, 'out', 'behavior-policy.json');
  const haveCorpus = existsSync(corpusPolicy);
  const haveField = Boolean(fieldPolicyPath) && existsSync(fieldPolicyPath);

  if (!haveField) {
    return {
      ...refuse(
        REFUSALS.NO_FIELD_POLICY,
        'Pool Best Response needs the response rates of the field actually being played. The '
        + `only mined policy available is ${haveCorpus ? 'the 2009 HandHQ corpus' : 'absent'}, `
        + 'and a corpus level reported about a live modern table is transferred, not measured.',
        'Mine a field policy from the accumulating Ignition session store, then pass '
        + '--field-policy <path>. Both arms then run and the DELTA between them measures the '
        + 'transfer instead of assuming it.',
      ),
      arms: {
        field: { available: false, why: 'not yet mined' },
        corpus: {
          available: haveCorpus,
          path: haveCorpus ? 'out/behavior-policy.json' : null,
          usable: false,
          why: 'levels transfer — refused for a live comparative claim per corpus-transfer-is-earned.md',
        },
      },
      pierPosts: {
        upper: 'pool-best-response (refused — no field policy)',
        // Not an oversight. `equilibriumPost.mjs` returns null BY DESIGN because SRC-013 does
        // not exist, and it explicitly refuses to substitute the "GTO-approximate" charts.
        lower: 'equilibrium — UNAVAILABLE, not faked (SRC-013 does not exist)',
        note: 'The location this review reports is therefore one-sided, and says so.',
      },
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────────────
  // THE HOLD-OUT CHECK — verified from the artifact, never trusted
  // ─────────────────────────────────────────────────────────────────────────────────────
  //
  // A policy mined from this session and then used to price this session is fit on the very
  // decisions it is scoring. `mineFieldPolicy` stamps every contributing session id precisely
  // so this can be CHECKED rather than promised, and a promise is what would eventually be
  // broken by someone re-running the miner without `--exclude`.
  let policy;
  try {
    policy = JSON.parse(readFileSync(fieldPolicyPath, 'utf8'));
  } catch (e) {
    return refuse(
      'unexamined:field-policy-unreadable',
      `${fieldPolicyPath}: ${e.message}`,
      're-mine it with scripts/sessionSink/mineFieldPolicy.mjs',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────────────
  // POPULATION IDENTITY IS CHECKED BEFORE THE HOLD-OUT, AND SEPARATELY (WS-632)
  // ─────────────────────────────────────────────────────────────────────────────────────
  //
  // These were once entangled: the hold-out gate demanded `contributingSessions`, the corpus
  // table had none, and the money arm refused for 14 straight sessions over a MISSING STAMP
  // while a table with 12,191 observations sat unused. When that table was hand-stamped to
  // clear the gate, the review then declared it `measured-on-this-field` — a 2009 online
  // policy labelled as a measurement of a 2026 live table, which is entry #1 of the
  // Suspected-Fault Register generated automatically.
  //
  // The inversion is worth naming because it reads as safe: an EMPTY contributingSessions is
  // evidence the policy was NOT measured on this field, and the old code read it as proof that
  // it WAS. So population is now declared, checked first, and never inferred from the shape or
  // emptiness of the hold-out.
  const declaredPopulation = policy?.provenance?.population;
  const policySource = policy?.provenance?.source;
  if (typeof declaredPopulation !== 'string' || !declaredPopulation.trim()) {
    return refuse(
      'unexamined:field-policy-population-undeclared',
      'The field policy does not declare `provenance.population`, so what it measured cannot be '
      + 'named — and an unnamed population defaults to whatever the reader assumes, which is how '
      + 'a corpus level ends up reported as a live measurement.',
      'Re-mine it. Both miners stamp `population` and `source`: mineFieldPolicy.mjs '
      + '(ignition-sessions) and behaviorPolicyMiner.mjs (handhq-corpus).',
    );
  }

  const contributing = policy?.provenance?.contributingSessions;
  if (!Array.isArray(contributing)) {
    return refuse(
      'unexamined:field-policy-unstamped',
      'The field policy carries no `provenance.contributingSessions`, so the hold-out cannot be '
      + 'verified. An unverifiable hold-out is indistinguishable from none. An empty array is a '
      + 'valid answer (observed-zero) and is what a corpus-mined table stamps; a MISSING field '
      + 'is not, because it cannot be told apart from nobody having looked.',
      'Re-mine with scripts/sessionSink/mineFieldPolicy.mjs or scripts/backtest/'
      + 'behaviorPolicyMiner.mjs — both stamp it.',
    );
  }
  if (sessionId && contributing.includes(sessionId)) {
    return refuse(
      'refused:leakage',
      `The field policy was mined from ${sessionId} — the session being priced. Scoring against `
      + 'it would be the model reading its own homework, and more data would converge harder '
      + 'onto the wrong answer rather than correcting it.',
      `Re-mine holding this session out: mineFieldPolicy.mjs --exclude ${sessionId}`,
    );
  }

  // Hold-out verified. The policy is admissible for THIS session, so the caller may price
  // against it. The pricing itself happens in the main flow, which has the adapted hands.
  return {
    refused: false,
    admissible: true,
    policy,
    fieldPolicyPath,
    holdOut: { verified: true, contributingSessions: contributing, excluded: sessionId },
    population: declaredPopulation,
    policySource: policySource ?? null,
  };
};


/**
 * The money column, run over hero's own decisions.
 *
 * SEPARATED FROM THE ADMISSIBILITY CHECK ABOVE, deliberately. That function answers "may this
 * policy be used to score this session" and can refuse for four distinct reasons before any
 * money is computed. This one answers "what did it cost", and it must never be reachable on a
 * policy that failed the first question — which is why it takes the already-validated table
 * rather than a path it would have to re-load and re-check.
 */
const runMoneyColumn = async ({ policyGate, adapted, heroSeat, heroRows }) => {
  if (policyGate.refused || !policyGate.admissible) return policyGate;

  const { ctxs, heroPid, byHandId, idAmbiguity } = heroContexts(adapted, heroSeat);
  if (heroPid == null) {
    return refuse(
      'refused:hero-id-ambiguous',
      `Hero's seat ${heroSeat} carries ${idAmbiguity.length} distinct id(s) across the hands he `
      + `was seated for (${idAmbiguity.join(', ') || 'none'}).`,
      'Scored against the wrong id this returns an empty column and a clean 0.00bb total, so it '
      + 'refuses instead. Check seatPlayers on the hands where mySeat matches.',
    );
  }

  const result = await priceSession({
    ctxs,
    handFor: (ctx) => byHandId.get(ctx.handId) ?? null,
    holeCardsFor: (ctx) => {
      const sc = byHandId.get(ctx.handId)?.gameState?.showdownCards ?? {};
      const shown = sc[String(heroSeat)] ?? sc[heroSeat];
      return Array.isArray(shown) && shown.length === 2 ? shown : null;
    },
    policy: policyGate.policy,
  });

  /**
   * COVERAGE IS REPORTED AGAINST HERO'S WHOLE SESSION, not against what reached the pricer.
   * `accumulateDecisions` drops preflop upstream, so those decisions never arrive to be
   * counted as unpriced — and a coverage figure computed from arrivals flatters itself by
   * exactly the size of the hole.
   */
  const byStreetTotal = {};
  for (const r of heroRows) byStreetTotal[r.street] = (byStreetTotal[r.street] || 0) + 1;

  return {
    refused: false,
    fieldPolicyPath: policyGate.fieldPolicyPath,
    holdOut: policyGate.holdOut,
    transferStatus: transferStatusFor(policyGate.policy),
    comparativeClaim: true,
    totals: result.totals,
    priced: result.priced,
    unpriced: result.unpriced,
    coverage: {
      ...result.coverage,
      heroDecisionsTotal: heroRows.length,
      heroDecisionsByStreet: byStreetTotal,
      pricedShareOfSession: heroRows.length ? result.coverage.decisionsPriced / heroRows.length : 0,
    },
    scope: result.scope,
    pierPosts: {
      // Names the population it is a best response TO. Saying "the field in this session"
      // while scoring against a 2009 corpus table is the same false claim WS-632 removed one
      // field above, and a reader who trusts the pier post would never see the correction.
      upper: policyGate.policySource === 'ignition-sessions'
        ? 'pool-best-response, against the field in this session'
        : `pool-best-response, against ${policyGate.population} — NOT this session's field`,
      // Not an oversight. `equilibriumPost.mjs` returns null BY DESIGN because SRC-013 does
      // not exist, and it explicitly refuses to substitute the "GTO-approximate" charts.
      lower: 'equilibrium — UNAVAILABLE, not faked (SRC-013 does not exist)',
      note: 'The location this review reports is therefore one-sided, and says so.',
    },
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// STAGE 6 — the hands worth looking at
// ═══════════════════════════════════════════════════════════════════════════════════════

/**
 * Rank hands by how much money moved through hero's decisions.
 *
 * SELECTION IS A BIAS AND IS DECLARED — the same discipline `selectHands.mjs` states: any rate
 * computed over these hands describes THIS SET, never the player. They are here to be read, not
 * to be averaged.
 */
const rankHands = (adapted, rows, limit) => {
  const byHand = new Map();
  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  for (const r of rows) {
    const cur = byHand.get(r.handId)
      || { handId: r.handId, decisions: 0, investedBB: 0, potPeakBB: 0, streets: new Set() };
    cur.decisions += 1;
    // FIELD NAMES MATTER HERE, and the first version of this got them wrong in the worst way:
    // it read `priceBB ?? amountBB`, neither of which exists on a labelled row, so every hand
    // scored 0, the ranking silently degraded to decision-count, and the rendered column
    // asserted "0.0" as though it were a measurement. `investedBB` is cumulative within the
    // hand and `potBB` is the pot faced at that decision, so both take a MAX, never a sum.
    cur.investedBB = Math.max(cur.investedBB, num(r.investedBB));
    cur.potPeakBB = Math.max(cur.potPeakBB, num(r.potBB));
    cur.streets.add(r.street);
    byHand.set(r.handId, cur);
  }
  const ranked = [...byHand.values()]
    .map((h) => ({ ...h, streets: [...h.streets] }))
    .sort((a, b) => b.investedBB - a.investedBB || b.potPeakBB - a.potPeakBB || b.decisions - a.decisions)
    .slice(0, limit);

  const dossiers = [];
  for (const entry of ranked) {
    const match = adapted.find(({ hand }) => hand?.handId === entry.handId);
    if (!match) continue;
    try {
      dossiers.push({ ...entry, dossier: buildDossier(match.hand, match.hand.gameState.mySeat) });
    } catch (e) {
      dossiers.push({ ...entry, dossier: null, error: e.message });
    }
  }
  return {
    selectionBias:
      'Ranked by how much hero actually put in (investedBB), with the biggest pot he faced '
      + 'beside it. Chosen to be informative, so any rate computed over this set describes '
      + 'THIS SET, never the player.',
    hands: dossiers,
  };
};

// ═══════════════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════════════

export const reviewSession = async ({ sessionDir, fieldPolicyPath = null, topHands = 10, now = () => new Date().toISOString() }) => {
  const stampedAt = now();
  const read = await readSessionHands(sessionDir);

  if (!read.hands.length) {
    return { ok: false, ...refuse('unexamined:empty-session', `no hands at ${sessionDir}`, 'nothing') };
  }

  const { adapted, skips } = adaptAll(read.hands);
  const hero = heroDecisions(adapted);

  // Hero's seat for the accumulator — the modal seat, since a session is one sitting.
  const seatCounts = new Map();
  for (const h of read.hands) {
    const s = h?.gameState?.mySeat;
    if (s != null) seatCounts.set(Number(s), (seatCounts.get(Number(s)) || 0) + 1);
  }
  const heroSeat = [...seatCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const sourcePaths = [sessionDir];
  /**
   * GATES ARE SCOPED TO THE CARD THEY GUARD. They were not, and it cost 11 cards at once.
   *
   * `conductCard.js` is deliberately absolute — "a card whose gates did not pass is not a
   * thinner card, it is an unverified one" — so a card is refused outright if any gate it
   * carries failed. That doctrine is right. What was wrong was WHICH gates each card carried:
   * every card, hero's and every opponent's, was handed the same array.
   *
   * MEASURED 2026-08-21 on sess-20260619-025941: ONE hero decision out of 38 lacked hole cards
   * (97.4% < the 99% floor), and that single row refused hero's card AND all ten opponent
   * cards in the session. An opponent's Conduct Card is a record of what THAT SEAT did facing
   * what — it has no dependence whatsoever on whether hero's hole cards were captured.
   *
   * So: capture-integrity gates bind every card, because a torn or unsealed file makes every
   * row in it suspect. The cards-known gate binds HERO'S card only, because it is a claim
   * about hero's rows.
   */
  const captureGates = [
    { name: 'session sealed', ok: Boolean(read.manifest), detail: read.manifest?.hash ?? 'provisional' },
    { name: 'no corrupt tail', ok: read.corruptTail === false, detail: read.corruptTail ? 'TORN TAIL' : 'clean' },
  ];
  const heroCardsKnownGate = {
    name: 'cards-known on hero decisions',
    ok: hero.cardsKnownFraction > 0.99,
    detail: `${(hero.cardsKnownFraction * 100).toFixed(1)}% of ${hero.knowableRows} knowable row(s)`
      + (hero.unknowableRows
        ? `; ${hero.unknowableRows} row(s) across ${hero.carriedHands} hand(s) are UNKNOWABLE `
          + "(reconnect snapshot omits hero's own seat), excluded from the denominator"
        : ''),
  };
  // The review-level report still shows all three — the reader should see the cards-known
  // result whether or not it gated anything.
  const gates = [...captureGates, heroCardsKnownGate];

  const stakes = [...new Set(adapted.map((a) => a.stakeLabel).filter(Boolean))];
  const population =
    `One Ignition session played by the founder${stakes.length ? ` at ${stakes.join(', ')}` : ''}. `
    + `${hero.heroHands} hands with hero seated, ${hero.observedHands} observed. This is a `
    + 'single sitting against one table\'s players — not a sample of any pool, and no rate here '
    + 'describes a population.';

  // Hero's card.
  const heroCard = heroSeat == null
    ? { card: null, refusal: refuse(REFUSALS.NO_HERO, 'hero never seated in this session', 'play some hands') }
    : await buildCard({
      subjectId: `hero-${read.manifest?.setId ?? 'session'}`,
      rows: hero.rows,
      population,
      sourcePaths,
      gates: [...captureGates, heroCardsKnownGate],
    });

  // A card per OPPONENT SUBJECT — a seat-occupancy segment when the source carries no player
  // identity, which for Ignition is always. See resolveSubjects for what was measured.
  const resolved = resolveSubjects(adapted, heroSeat, read.manifest?.setId ?? null);
  const subjectPopulation = `${population} ${resolved.caveat}`;

  const opponents = [];
  for (const s of resolved.subjects) {
    const built = await buildCard({
      subjectId: s.subjectId,
      rows: s.rows,
      population: subjectPopulation,
      sourcePaths,
      // Capture integrity only. Hero's cards-known fraction says nothing about this seat.
      gates: captureGates,
    });
    opponents.push({
      subjectId: s.subjectId,
      seat: s.seat,
      identity: s.identity,
      identityBasis: s.identity ? 'player-id' : 'seat-segment',
      handsObserved: s.hands,
      handSpan: [s.firstHandIndex, s.lastHandIndex],
      decisions: s.rows.length,
      card: built.card,
      refusal: built.refusal,
    });
  }

  const spots = await locateSpots(read.hands, heroSeat, stampedAt);
  const policyGate = priceAgainstPoolBestResponse({
    fieldPolicyPath, sessionId: read.manifest?.setId ?? null,
  });
  const money = await runMoneyColumn({
    policyGate, adapted, heroSeat, heroRows: hero.rows,
  });
  const notable = rankHands(adapted, hero.rows, topHands);

  const review = {
    kind: 'session-review',
    schemaVersion: 1,
    stampedAt,
    session: {
      dir: sessionDir,
      id: read.manifest?.setId ?? null,
      tableId: read.manifest?.tableId ?? null,
      handsHash: read.manifest?.hash ?? null,
      complete: read.complete,
      corruptTail: read.corruptTail,
      startedAt: read.manifest?.startedAt ?? null,
      endedAt: read.manifest?.endedAt ?? null,
    },
    intake: {
      handsRead: read.hands.length,
      adapted: adapted.length,
      skipped: skips,
      // Every hand is accounted for. A count that does not reconcile is a bug, not a rounding.
      reconciles: read.hands.length === adapted.length + Object.values(skips).reduce((a, b) => a + b, 0),
    },
    hero: {
      seat: heroSeat,
      handsSeated: hero.heroHands,
      handsObserved: hero.observedHands,
      decisions: hero.rows.length,
      cardsKnownRows: hero.cardsKnownRows,
      cardsKnownFraction: hero.cardsKnownFraction,
      // Reported, never folded into the fraction. A zero here and a zero in `cardsKnownRows`
      // mean opposite things.
      knowableDecisions: hero.knowableRows,
      unknowableDecisions: hero.unknowableRows,
      unknowableHands: hero.carriedHands,
      unknowableReason: hero.unknowableRows
        ? "reconnect: Ignition's CO_TABLE_INFO snapshot omits hero's own seat, so hole cards "
          + 'for a hand already in progress are never re-sent'
        : null,
      cardsKnownClaim: hero.cardsKnownFraction > 0.99
        ? 'UNBIASED CARDS-KNOWN: hero\'s hole cards are present on every decision including '
          + 'folds, with no showdown conditioning. The corpus cannot produce this arm.'
        : 'CARDS-KNOWN CLAIM NOT SUPPORTED on this session — see cardsKnownFraction.',
      conductCard: heroCard.card,
      conductCardRefusal: heroCard.refusal,
    },
    opponents: {
      identityBasis: resolved.identityBasis,
      segmentSplitsInferred: resolved.segmentSplits,
      caveat: resolved.caveat,
      subjects: opponents,
    },
    spots,
    money,
    notable,
    gates,
    population,
  };

  review.contentHash = sha({ ...review, contentHash: undefined });
  return { ok: true, review };
};

const main = async () => {
  const args = parseArgs(process.argv);
  const sessionDir = typeof args.session === 'string' ? args.session : null;
  if (!sessionDir) {
    console.error('Usage: node scripts/villainArchetype/reviewSession.mjs --session <sealedSessionDir> [--field-policy <path>] [--out <dir>]');
    process.exit(2);
  }

  const out = typeof args.out === 'string' ? args.out : join(sessionDir, 'review');
  const result = await reviewSession({
    sessionDir,
    fieldPolicyPath: typeof args['field-policy'] === 'string' ? args['field-policy'] : null,
    topHands: Number(args['top-hands'] || 10),
  });

  if (!result.ok) {
    console.error(`REFUSED: ${result.reason} — ${result.detail}`);
    process.exit(1);
  }

  await mkdir(out, { recursive: true });
  // The RECORD first, then the view. If the renderer throws, the record is already durable —
  // a page that failed to draw must never cost the measurement behind it.
  await writeFile(join(out, 'review.json'), `${JSON.stringify(result.review, null, 2)}\n`, 'utf8');
  try {
    await writeFile(join(out, 'review.html'), renderSessionReview(result.review), 'utf8');
  } catch (e) {
    console.error(`review.html could not be rendered (${e.message}) — review.json is intact`);
  }

  const r = result.review;
  console.log(`session ${r.session.id}: ${r.intake.handsRead} hands read, ${r.intake.adapted} adapted`);
  console.log(`hero seat ${r.hero.seat}: ${r.hero.decisions} decisions, cards known on ${(r.hero.cardsKnownFraction * 100).toFixed(1)}%`);
  console.log(`hero conduct card: ${r.hero.conductCard?.cardId ?? `REFUSED (${r.hero.conductCardRefusal?.reason})`}`);
  const subs = r.opponents.subjects;
  console.log(`opponents (${r.opponents.identityBasis}): ${subs.filter((v) => v.card).length} carded, `
    + `${subs.filter((v) => !v.card).length} refused, ${r.opponents.segmentSplitsInferred} seat-change split(s) inferred`);
  console.log(`spots shortlisted: ${r.spots.spots?.length ?? 0}`);
  console.log(`money arm: ${r.money.refused
    ? `REFUSED (${r.money.reason})`
    : `${r.money.totals.evLeftBB.toFixed(2)}bb left on the table over `
      + `${r.money.coverage.decisionsPriced}/${r.money.coverage.heroDecisionsTotal} decision(s)`}`);
  console.log(`written to ${out}/review.json`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch((e) => { console.error(e); process.exit(1); });
}
