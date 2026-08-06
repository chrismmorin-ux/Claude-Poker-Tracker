#!/usr/bin/env node
/**
 * compact-tier.cjs — UserPromptSubmit hook. THE COMPACT TIER (WS-424 / S1–S5).
 *
 * THERE IS NO COMPACT-TIER FILE, AND THAT IS THE WHOLE MECHANISM.
 * The tier is generated to stdout on every turn and never written to disk. Two
 * artifacts cannot drift apart when there is only one artifact. This beats
 * generate-and-hash (which only DETECTS that the tiers have already disagreed)
 * because this repo has measured what detection costs: the same measurement was
 * stated five times with three different values inside a single file that has no
 * second tier at all. A cross-file drift detector catches none of those five.
 *
 * `scripts/__tests__/compactTier.test.js` FAILS if an on-disk compact-tier artifact
 * ever appears. "We'll just cache it to a file" is the exact change that
 * reintroduces the drift this organ exists to make impossible.
 *
 * EVERY LINE IS VERIFIED AGAINST ITS SOURCE AT EMIT TIME (S2). A rule whose anchor
 * term no longer appears in the source it claims is DROPPED, and the count is
 * printed as `[dropped N]`. The tier can only shrink and say so; it cannot go stale.
 *
 * IMPERATIVES, NOT NAMES (S3). Measured: `Four Motivations` is a name sitting in
 * POKER_THEORY.md and occurs zero times anywhere else in the repo, while
 * `intransitiv*` occurs 114 times across 13 files. Names do not travel; vocabulary
 * in use does. The one always-loaded form that demonstrably worked (CLAUDE.md's §7
 * paragraph) is not a name list — it is an imperative paragraph.
 *
 * NO RE-MEASURABLE MAGNITUDE (S4). No decimals, no percentages, no parameter
 * assignments. Enforced syntactically by `violatesMagnitudeRule()` below, which
 * runs over the emitter's OWN output. Re-measuring anything cannot falsify a tier
 * that states no magnitude. It doubles as a quality filter: a rule that cannot be
 * stated without a number is a lookup, and a lookup does not belong on every turn.
 * Integer counters (`falsified 1x`) are deliberately admissible — a ledger count is
 * not a re-measurable magnitude, and S5 explicitly requires the tier to carry counts.
 *
 * NEVER A DIGEST (S5). Every line must carry something the heavy tier does NOT have
 * — a class name, a count, a status — rather than less of what it does have. §8
 * "Common Mistakes" is the repo's own controlled experiment: the only top-level
 * POKER_THEORY section with zero external citations, and it is a digest of sections
 * drawing 132 and 156. Readers cite the source, never the summary.
 *
 * CEILING IS FLAT — see the long note on CEILING_BYTES below. An earlier revision of
 * this header described a DECAYING schedule and was left in place after the code was
 * changed to flat, so the header contradicted the implementation directly beneath it.
 * That is the same defect adversarial review found twice elsewhere in this work, and
 * it is corrected here rather than left as a curiosity.
 *
 * The producer SLICES ITS OWN OUTPUT to the ceiling, so it is an invariant of the
 * emitter rather than a check that can fail.
 *
 * FAILS OPEN. Any error exits 0 silently, emitting nothing. A broken injector must
 * never block the founder.
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');

/**
 * FLAT. NOT A DECAY CURVE. This is the second derivation; the first was wrong in a
 * way worth recording here, because the reasoning that produced it is seductive.
 *
 * v1 decayed: 8,000 B for turns 1-2, 2,000 through turn 8, 400 thereafter. It was
 * derived by budgeting total per-turn injection at one tenth of the session-start
 * load, and the 60-turn tail landed on that budget exactly. The arithmetic was fine.
 * Two things about it were not.
 *
 * IT BUDGETED THE HIGH-VALUE CHANNEL AGAINST THE LOW-VALUE ONE. The whole thesis of
 * this design (S1) is that POSITION DOMINATES VOLUME — a byte injected every turn
 * shapes the output distribution in a way a byte read once does not. Capping the
 * per-turn channel at a fraction of the session-start read is therefore backwards: it
 * rations the expensive-per-byte channel to protect the cheap one. The correct move
 * is the opposite, and it is the one the founder made to the fleet context: move
 * CONDITIONAL content off the always-loaded path onto a channel that loads when
 * triggered, and spend the freed budget on the spine that must be present every turn.
 *
 * IT DECAYED IN ANTI-CORRELATION WITH NEED. The drift this exists to stop is
 * MID-SESSION drift, not turn-0 framing. The recorded evidence is the session that
 * produced this design: the behaviour had to be externally forced TWICE, during the
 * session. At turn 40 — accumulated context heaviest, drift worst — v1 was cutting
 * the behavioural rules to 400 bytes and dropping 13 of 16.
 *
 * THERE WAS NO BUDGET PROBLEM TO SOLVE. Measured 2026-08-06: the full 18-rule tier is
 * 2,304 B (an earlier revision of this comment said 16 rules / 1,912 B and was not
 * re-measured after rules were added — the exact stale-number failure that session's
 * claim-survival audit scored). CORRECTED 2026-08-06 by independent re-check: that
 * audit's headline of 45.9% is `39/85`, which puts the 8 UNVERIFIABLE claims in the
 * denominator and so counts them as refuted. The pre-registered statistic is
 * `held/(held+refuted)` (docs/context-shift-prereg.md:144), giving 39/77 = 50.6%.
 * Both figures are live in the repo; 50.6% is the one the prereg defines.
 * At every turn of a median 5-turn session that is 1.9% of ONE session-start load,
 * and 3.4% of what is already injected unconditionally on every session. The ceiling
 * below is a backstop against the RULE SET growing without bound, not a ration on
 * what a session is allowed to be reminded of.
 */
const CEILING_BYTES = 8000;

function ceilingForTurn(_turn) {
  return CEILING_BYTES;
}

// Retained for callers/tests that introspect the shape. One entry: it is flat.
const CEILING_SCHEDULE = [{ untilTurn: Infinity, bytes: CEILING_BYTES }];

const POKER_THEORY = '.claude/context/POKER_THEORY.md';
const CLAUDE_MD = 'CLAUDE.md';
const DISPATCH_RULE = '.claude/rules/dispatch-dont-assert.md';
const IMPROVEMENT_RULE = '.claude/rules/improvement-default.md';
// Doctrine anchored to the CODE that implements it, not to prose about it. A rule
// that survives only while a paragraph survives is weaker than one that survives
// while the identifier does.
const ACTION_CLASSIFIER = 'src/utils/exploitEngine/actionClassifier.js';

/**
 * The tier's content. Each rule is an IMPERATIVE plus an `anchor` that must still
 * appear in `source` at emit time, which is what makes staleness impossible rather
 * than merely detectable.
 *
 * `kind` drives ordering: behaviour first. The founder's closing requirement is that
 * the compact tier carries BEHAVIOUR, not a summary of doctrine — "You ran this
 * session in a completely different way than normal... this kind of behavior is what
 * we want to be pervasive throughout our context as well."
 */
const RULES = [
  // ---- BEHAVIOUR (repo method) ----
  { kind: 'behaviour', anchor: 'dispatch', source: CLAUDE_MD,
    text: 'Dispatch, do not assert: spawn an independent check rather than answering from what is already in context.' },
  { kind: 'status', anchor: 'greenfield', source: DISPATCH_RULE,
    text: 'Greenfield dispatch is the measured standard: it held every claim checked, where context-laden runs did not. A load-bearing claim asserted from accumulated context without an independent check is below standard, however confident it reads.' },
  { kind: 'status', anchor: 'accuracy', source: DISPATCH_RULE,
    text: 'The objective is claim accuracy, not vocabulary uptake and not document size. A file-line reference, a measured quantity, or a capability claim must be true.' },
  { kind: 'behaviour', anchor: 'falsifier', source: CLAUDE_MD,
    text: 'Pre-register the falsifier before you see the result, and record it unhedged when it fails.' },
  // Re-anchored 2026-08-06: CLAUDE.md was rewritten mid-session and both this anchor
  // and 'Improvement Default' stopped resolving, so both rules dropped and the tier
  // printed [dropped 2]. The mechanism worked — it refused to emit doctrine its named
  // source no longer carries. But it also exposed the fragility the adversarial review
  // named: 'contradict' was an ACCIDENTAL anchor matching "will contradict you" in a
  // paragraph that has since been deleted. Both now point at the rules files, which are
  // the canonical homes for this doctrine and are harness-injected every session.
  { kind: 'behaviour', anchor: 'contradiction', source: DISPATCH_RULE,
    text: 'Relay contradictions prominently, never in a footnote. Name your own contamination unprompted.' },
  { kind: 'behaviour', anchor: 'least trustworthy', source: DISPATCH_RULE,
    text: 'Treat your own output as the least trustworthy input in the window.' },
  { kind: 'behaviour', anchor: 'permit disagreement', source: DISPATCH_RULE,
    text: 'Write briefs that permit disagreement: state the hypothesis under test as the correction, not as the founder claim.' },
  { kind: 'behaviour', anchor: 'Improvement Default', source: IMPROVEMENT_RULE,
    text: 'A limitation found by analysis is removed by default; accommodation is the founder call, never yours.' },
  { kind: 'behaviour', anchor: 'engine', source: CLAUDE_MD,
    text: 'A declared multi-agent engine is executed by spawning those agents, or you stop and say why. Never the least accurate option.' },

  // ---- DOCTRINE (poker, imperative form, no magnitudes) ----
  { kind: 'doctrine', anchor: 'SPR', source: POKER_THEORY,
    text: 'Derive villain decisions from equity, pot odds, SPR, and players remaining. Never from a position label or a bucket label.' },
  { kind: 'doctrine', anchor: 'First-Principles', source: POKER_THEORY,
    text: 'Labels are outputs of the decision process, never inputs to it. Do not stack a style adjustment on the stats that define the style.' },
  { kind: 'doctrine', anchor: 'callBranchEV', source: ACTION_CLASSIFIER,
    text: 'Classify a bet by its callBranchEV. Cite the calling range for a value hand, not fold equity.' },
  { kind: 'doctrine', anchor: 'showdown', source: POKER_THEORY,
    text: 'River equity is a showdown-outcome distribution, not runout variance. Pre-river variance stays real.' },
  { kind: 'doctrine', anchor: 'conditional', source: POKER_THEORY,
    text: 'Every number carries its conditioning set and its inverse conditional. Take the base rate from board combinatorics, never from the model estimating it.' },
  { kind: 'doctrine', anchor: 'blocker', source: POKER_THEORY,
    text: 'Carve a subclass grid from its parent. Never build a child grid independently, and never normalise a prior grid into a distribution.' },

  // ---- STATUS / COUNTERS (S5: what the heavy tier does NOT carry) ----
  { kind: 'status', anchor: '3.4', source: POKER_THEORY,
    text: 'POKER_THEORY taxonomy in the postflop section: falsified 1x. It has been too small before; do not read it as closed.' },
  { kind: 'status', anchor: 'Standard of Record', source: CLAUDE_MD,
    text: 'Any comparative claim about strategy, model quality, or EV resolves to a Result Card, or it is not a claim.' },
  // CORRECTED 2026-08-06 — the previous text said the founder game is "short-handed by
  // comparison", which is FALSE and was injected on every turn. The corpus is online
  // 6-max AND full-ring (DISCLAIMER-AND-FAULT-REGISTER.md, Population row); the founder's
  // game is live 9-handed — LONGER-handed, not shorter. The error was caused by S4: the
  // handedness figures are magnitudes, S4 bans them, so they were paraphrased into words
  // and the paraphrase reversed the direction. The comparative is now dropped entirely
  // rather than restated, because the honest claim is DISTINCTNESS, not a direction.
  // Anchor moved off the common word `live` onto a distinctive phrase.
  { kind: 'status', anchor: 'transferred, not measured', source: CLAUDE_MD,
    text: 'The corpus is online and historical; the founder game is live and a distinct population. A claim anchored on it is transferred, not measured. Say so.' },
];

/**
 * S4, applied to the emitter's own output. Decimals, percentages, and parameter
 * assignments are rejected. Bare integers are permitted so S5's counters survive
 * (`falsified 1x`) — a ledger count is not a quantity anyone can re-measure.
 */
function violatesMagnitudeRule(text) {
  if (/\d+\.\d/.test(text)) return true;          // decimal
  if (/\d\s*%/.test(text)) return true;            // percentage
  if (/[A-Za-z_]\w*\s*=\s*-?\d/.test(text)) return true; // parameter assignment
  return false;
}

/**
 * Count real FOUNDER turns in the transcript, to select the ceiling.
 *
 * DO NOT count `"type":"user"` records naively. Every tool RESULT is also stored as
 * a `type:"user"` record, so the naive count runs about 66x high — measured 132
 * against an actual 2 on a live transcript. That collapsed the schedule to its
 * 400-byte floor inside the first founder turn and meant the 8,000-byte head, which
 * is the entire point of the decay curve, never applied at all. The bug was invisible
 * from the code and obvious the moment the hook's own output was read.
 *
 * A founder turn is a `type:"user"` record whose `message.content` is a STRING.
 * Tool results carry an ARRAY of content blocks.
 *
 * COST, re-measured 2026-08-06 (the "~4ms on a 1.6MB transcript" this comment used to
 * claim was understated 2.5-4.6x): 9.1-18.5 ms at 1.78 MB, 37.6-48.3 ms at 6.8 MB,
 * against 1.9-2.4 ms for build(). The CLI no longer calls this — see the note at the
 * call site. It is retained, exported and tested for the day the ceiling stops being
 * flat, which is a design question the founder has not yet ruled on.
 */
function turnIndex(transcriptPath) {
  try {
    if (!transcriptPath || !fs.existsSync(transcriptPath)) return 1;
    const raw = fs.readFileSync(transcriptPath, 'utf8');
    let turns = 0;
    for (const line of raw.split('\n')) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch { continue; }
      if (rec.type !== 'user' || rec.isMeta) continue;
      const content = rec.message && rec.message.content;
      if (typeof content === 'string' && content.trim()) turns++;
    }
    return Math.max(1, turns);
  } catch {
    return 1; // fail open toward the LARGER ceiling: unknown transcript is turn 1
  }
}

/**
 * A dropped rule names ITSELF, its cause, and the file it failed against.
 *
 * Added 2026-08-06 after the failure it exists to surface actually fired. A kit
 * upgrade (c116a816) rewrote CLAUDE.md by 60 lines mid-session; two anchors stopped
 * resolving; the Improvement Default — a declared HARD RESTRICTION — was silently
 * withheld from every turn for part of a session. The only signal was the string
 * `[dropped 2]`, which names nothing, so the loss was invisible from inside the
 * window that was missing it. The refusal to emit unverified doctrine was correct;
 * the silence about WHICH doctrine was not.
 *
 * The id is DERIVED (`basename:"anchor"`), never stored, so it cannot drift from the
 * rule it names — the same failure mode this whole file exists to prevent. It also
 * happens to be the exact pair a reader needs in order to fix the anchor.
 */
function dropRecord(rule, cause) {
  return {
    id: `${path.basename(rule.source)}:"${rule.anchor}"`,
    cause,
    anchor: rule.anchor,
    source: rule.source,
  };
}

/**
 * Render the drop line. Empty string when nothing dropped.
 *
 * The named list is CAPPED so the diagnostic can never itself breach the ceiling it
 * reports against — a drop line that overflows would drop rules to explain dropped
 * rules. The count is always exact; only the enumeration is bounded.
 */
const DROP_NAME_CAP = 12;
const DROP_LINE_RESERVE = 640; // >= worst-case rendered length of a capped drop line

function dropLine(records) {
  if (records.length === 0) return '';
  const named = records.slice(0, DROP_NAME_CAP);
  const parts = named.map((r) => `${r.id} ${r.cause}`);
  const rest = records.length - named.length;
  const tail = rest > 0 ? `; +${rest} more` : '';
  return `[dropped ${records.length}: ${parts.join('; ')}${tail}]`;
}

/** Build the tier. Returns { text, dropped, droppedDetail, turn, ceiling }. */
function build(turn) {
  const ceiling = ceilingForTurn(turn);
  const sourceCache = new Map();
  const readSource = (rel) => {
    if (!sourceCache.has(rel)) {
      try { sourceCache.set(rel, fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')); }
      catch { sourceCache.set(rel, null); }
    }
    return sourceCache.get(rel);
  };

  const droppedDetail = [];
  const kept = [];
  for (const rule of RULES) {
    const src = readSource(rule.source);
    // A source that cannot be read drops its rules rather than emitting unverified text.
    if (src === null) { droppedDetail.push(dropRecord(rule, 'source-unreadable')); continue; }
    if (!src.includes(rule.anchor)) { droppedDetail.push(dropRecord(rule, 'anchor-missing')); continue; }
    if (violatesMagnitudeRule(rule.text)) { droppedDetail.push(dropRecord(rule, 'magnitude')); continue; }
    kept.push(rule);
  }
  const dropped = droppedDetail.length;

  const order = { behaviour: 0, status: 1, doctrine: 2 };
  kept.sort((a, b) => order[a.kind] - order[b.kind]);

  const header = 'COMPACT TIER (generated per turn; no file backs this):';
  const lines = [header];
  for (const r of kept) lines.push(`- ${r.text}`);
  if (dropped > 0) lines.push(dropLine(droppedDetail));

  // The producer slices its OWN output. The ceiling is an emitter invariant, not a
  // check that can fail — so there is no state in which the tier is over budget.
  let text = lines.join('\n');
  let detail = droppedDetail;
  if (Buffer.byteLength(text, 'utf8') > ceiling) {
    // BREAK, not CONTINUE. `kept` is already sorted behaviour -> status -> doctrine,
    // and skipping past an over-budget line to admit a SHORTER later one silently
    // inverts that priority: short doctrine outlives long behaviour, which is the
    // exact ordering the flat ceiling above exists to guarantee. Stop at the first
    // line that does not fit and drop the remaining tail in priority order.
    const out = [header];
    let used = Buffer.byteLength(header, 'utf8');
    let cut = 0;
    for (const r of kept) {
      const line = `- ${r.text}`;
      const cost = Buffer.byteLength(line, 'utf8') + 1;
      if (used + cost > ceiling - DROP_LINE_RESERVE) { cut = kept.length - out.length + 1; break; }
      out.push(line); used += cost;
    }
    detail = droppedDetail.concat(
      kept.slice(kept.length - cut).map((r) => dropRecord(r, 'truncated')),
    );
    if (detail.length > 0) out.push(dropLine(detail));
    text = out.join('\n');
  }
  return { text, dropped: detail.length, droppedDetail: detail, turn, ceiling };
}

module.exports = {
  RULES, CEILING_SCHEDULE, ceilingForTurn, violatesMagnitudeRule, build, turnIndex,
  dropRecord, dropLine, DROP_NAME_CAP,
};

if (require.main === module) {
  try {
    let stdin = '';
    try { stdin = fs.readFileSync(0, 'utf8'); } catch { /* no stdin */ }
    let payload = {};
    try { payload = JSON.parse(stdin || '{}'); } catch { payload = {}; }

    // NOT `turnIndex(payload.transcript_path)`. The ceiling is flat by design (see the
    // decay-curve rationale above), so `ceilingForTurn` ignores its argument and the
    // turn index cannot change a single byte of output. Calling it read the ENTIRE
    // transcript synchronously and JSON.parsed every line to feed a constant function:
    // measured 9-18 ms on a 1.8 MB transcript and 38-48 ms on a 6.8 MB one, against
    // 1.9-2.4 ms for the actual tier build. It was ~95% of this hook's own compute,
    // paid on every founder prompt, for a value the CLI then discarded.
    //
    // `turnIndex` is retained and exported because it is correct and tested, and
    // because restoring a turn-varying ceiling is a live design question. It simply
    // has no consumer while the ceiling is flat.
    const { text } = build(1);

    process.stdout.write(JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'UserPromptSubmit',
        additionalContext: text,
      },
    }));
    process.exit(0);
  } catch {
    process.exit(0);
  }
}
