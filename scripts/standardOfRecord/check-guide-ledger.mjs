#!/usr/bin/env node
/**
 * check-guide-ledger.mjs — the observance monitor for the guide form (prog-guide-authority).
 *
 * Founder directive, 2026-08-16: "put a monitor on when this is used, so we have good
 * observance protocols of the information."
 *
 * ─── WHAT IT MONITORS, AND WHY BOTH HALVES ARE NEEDED ────────────────────────
 *
 * Two questions, and a gate answering only the second is worse than no gate:
 *
 *   1. IS THE FORM USED AT ALL?   (inertness — §INERT)
 *   2. IS IT SOUND WHERE USED?    (conformance — the violation list)
 *
 * A standard with ZERO instances passes every conformance check trivially and prints a
 * green tick. That is exactly the shape of `prog-strategy-of-record`'s own baseline
 * finding: 7 of 13 standardOfRecord modules, 1,679 lines, zero non-test consumers, under
 * 304 passing tests. Conformance-only monitoring cannot distinguish "perfectly obeyed"
 * from "never used", so this gate measures inertness FIRST and treats it as a violation
 * on a deadline.
 *
 * ─── WHY IT PARSES DATA AND NOT PROSE ────────────────────────────────────────
 *
 * Every Guide carries a fenced ```guide-standing``` JSON block declaring its conditioning
 * set, what it marginalizes over, its Weighting, and its Census counts. The gate reads
 * THAT. Grepping prose for "weighting" would pass on the word appearing in a sentence
 * that disclaims it — and the repo's own rule (VOCABULARY, revealed-preference prior) is
 * that a classifier of this kind ships "as data + a classifier, never as prose".
 *
 * JSON rather than YAML deliberately: `js-yaml` is not resolvable from the repo root, and
 * a monitor that cannot run because of a missing dependency is a monitor that gets deleted.
 *
 * ─── THE ANTI-ROT CORE (inherited from check-label-ledger.mjs) ────────────────
 *
 * `--update` writes newly discovered documents with `ledger: null`, AND A NULL LEDGER IS
 * ITSELF A VIOLATION. Re-snapshotting records that a document EXISTS; it never asserts
 * that anyone DECIDED anything about it. The only way to green this gate is a human
 * writing a `GUIDE:<id>` row or a reasoned exclusion.
 *
 * ─── WHY IT IS WIRED ON DAY ONE ──────────────────────────────────────────────
 *
 * `smart-test-runner.sh:23-24` records FIND-086 / WS-431: the Standard-of-Record additive
 * gate existed from WS-329 and was wired NOWHERE, so "registering a schema bought
 * nothing". This lands in `smart-test-runner.sh` and `ci.yml` in the commit that creates it.
 *
 * Usage:
 *   node scripts/standardOfRecord/check-guide-ledger.mjs              # check
 *   node scripts/standardOfRecord/check-guide-ledger.mjs --update     # re-snapshot
 *   node scripts/standardOfRecord/check-guide-ledger.mjs --undecided  # what needs a row
 *   node scripts/standardOfRecord/check-guide-ledger.mjs --observe    # append to the time series
 *
 * Exit codes: 0 clean · 1 violation · 2 internal error.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, appendFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join, relative } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const GUIDE_ROOT = join(REPO, 'docs', 'guides');
const QUEUE_ROOT = join(REPO, '.claude', 'workstream', 'queue');
const BASELINE = join(HERE, 'guide-ledger-baseline.json');
const OBSERVANCE = join(REPO, 'docs', 'standard-of-record', 'guide-observance.jsonl');

/** The five slots of the title schema (GUIDE-STANDARD.md §0.2). */
export const SLOTS = ['game', 'position', 'subject', 'field', 'geometry'];

/** Closed vocabulary. An exclusion is a recorded judgment, so its reasons are enumerated. */
export const EXCLUSION_REASONS = new Set([
  'method-doc',        // describes how to produce guides, is not one
  'pedagogy',          // explains a command or protocol to a reader
  'pre-form',          // authored before the form existed; grandfathered
  'not-yet-triaged',   // promise to come back — requires a ticket, expires
]);

/** How long a `not-yet-triaged` exclusion may stand before it is itself the violation. */
export const UNTRIAGED_MAX_DAYS = 90;

/**
 * AS-732's declared threshold, lifted verbatim from prog-guide-authority.yaml so the
 * assumption is EXECUTED rather than described. An assumption that is never run is a
 * caveat again.
 */
export const AS732_ROWS = 20;
export const AS732_MIN_QUEUE_REFS = 3;

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

export const daysSince = (iso) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Infinity : (Date.now() - t) / 86_400_000;
};

// ─── harvest ──────────────────────────────────────────────────────────────────

const walk = (dir) => {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith('.md')) out.push(p);
  }
  return out;
};

/** Extract the fenced ```guide-standing``` JSON block, if present. */
export const readStanding = (text) => {
  const m = text.match(/```guide-standing\s*\n([\s\S]*?)```/);
  if (!m) return { present: false, standing: null, parseError: null };
  try {
    return { present: true, standing: JSON.parse(m[1]), parseError: null };
  } catch (e) {
    return { present: true, standing: null, parseError: e.message };
  }
};

export const harvest = () => {
  if (!existsSync(GUIDE_ROOT)) {
    return { rows: [], files: 0, missingRoot: true };
  }
  const files = walk(GUIDE_ROOT);
  const rows = files.map((abs) => {
    const text = readFileSync(abs, 'utf8');
    const key = relative(REPO, abs).replace(/\\/g, '/');
    const { present, standing, parseError } = readStanding(text);
    const sections = [...text.matchAll(/^##\s*§(\d+)/gm)].map((m) => Number(m[1]));
    return { key, standing, standingPresent: present, parseError, sections };
  });
  return { rows, files: files.length, missingRoot: false };
};

/**
 * Count queue items actually working guide coverage.
 *
 * DELIBERATELY NARROW, and the first draft of this function was the counter-example. It
 * matched a bare /unexamined/ and returned 5 on a queue where the true count was 2 —
 * WS-378, WS-382 and WS-407 merely contain the word in unrelated contexts. A loose matcher
 * here is worse than none, because it makes AS-732 read as SUPPORTED (holes are being
 * worked) on evidence that is nothing of the kind.
 *
 * KNOWN CEILING, owned by WS-519: this counts items belonging to the program, not items
 * linked to a SPECIFIC unexamined row. The real fix gives every Census row an id and has
 * queue items name it, so "20 holes, 3 items" cannot hide 3 items all pointing at the same
 * hole. That needs real rows to exist before the id scheme is chosen, which is why it rides
 * on the first derived Guide rather than being guessed at now.
 */
export const queueRefs = () => {
  if (!existsSync(QUEUE_ROOT)) return 0;
  let n = 0;
  for (const name of readdirSync(QUEUE_ROOT)) {
    if (!name.endsWith('.yaml')) continue;
    const t = readFileSync(join(QUEUE_ROOT, name), 'utf8');
    const ownedByProgram = /^program:\s*["']?guide-authority["']?\s*$/m.test(t);
    const namesAGuide = /docs\/guides\/[\w.-]+\.md/.test(t);
    if (ownedByProgram || namesAGuide) n += 1;
  }
  return n;
};

// ─── the checks ───────────────────────────────────────────────────────────────

// `refsFn` is injected so the AS-732 branch can be exercised without standing up a
// queue directory. Default is the real reader, so the CLI path is unchanged.
export const compare = (baseline, rows, refsFn = queueRefs) => {
  const violations = [];
  const meta = baseline.__meta ?? {};
  const guides = [];

  for (const row of rows) {
    const base = baseline[row.key];
    const ledger = base ? base.ledger : null;

    // 1 — UNDECIDED DOCUMENT. The anti-rot core.
    if (ledger == null) {
      violations.push(`UNDECIDED DOCUMENT: ${row.key}\n`
        + '      Add a ledger value "GUIDE:<id>" if this is a Guide, or "EXCLUDED:<reason>"\n'
        + `      with a reason from [${[...EXCLUSION_REASONS].join(', ')}].\n`
        + '      --update RECORDS a document; it does not decide anything about it.');
      continue;
    }

    if (ledger.startsWith('EXCLUDED:')) {
      const reason = ledger.slice('EXCLUDED:'.length);
      if (!EXCLUSION_REASONS.has(reason)) {
        violations.push(`EXCLUSION MALFORMED: ${row.key} is excluded as "${reason}", which is `
          + 'not in EXCLUSION_REASONS. An exclusion is a recorded judgment, so its vocabulary '
          + 'is closed.');
      } else if (reason === 'not-yet-triaged') {
        if (!base.ticket) {
          violations.push(`EXCLUSION MALFORMED: ${row.key} is "not-yet-triaged" with no ticket. `
            + 'That reason is a promise to come back, and a promise with no owner is not one.');
        } else if (base.since && daysSince(base.since) > UNTRIAGED_MAX_DAYS) {
          violations.push(`STALE EXCLUSION: ${row.key} has been "not-yet-triaged" since `
            + `${base.since} (${Math.floor(daysSince(base.since))} days, limit `
            + `${UNTRIAGED_MAX_DAYS}). An exception that never expires is how the exclusions `
            + 'list quietly becomes the register.');
        }
      }
      continue;
    }

    if (!ledger.startsWith('GUIDE:')) {
      violations.push(`LEDGER MALFORMED: ${row.key} carries "${ledger}", which is neither a `
        + '"GUIDE:<id>" nor an "EXCLUDED:<reason>".');
      continue;
    }

    // ── from here down the document CLAIMS to be a Guide, so the form binds ──
    guides.push(row);

    // 2 — STANDING BLOCK MISSING OR UNPARSEABLE
    if (!row.standingPresent) {
      violations.push(`STANDING BLOCK MISSING: ${row.key} is ledgered as a Guide but carries no `
        + '```guide-standing``` block. The monitor reads declared data, never prose — a Guide '
        + 'that does not declare its conditioning set cannot be checked against the slot rule.');
      continue;
    }
    if (row.parseError) {
      violations.push(`STANDING BLOCK UNPARSEABLE: ${row.key} — ${row.parseError}`);
      continue;
    }

    const s = row.standing;
    const cond = s.conditioning ?? {};
    const openSlots = SLOTS.filter((k) => cond[k] == null);

    // 3 — UNDECLARED SLOT. Worse than an open one: nothing marks it as marginalized.
    const missingKeys = SLOTS.filter((k) => !(k in cond));
    if (missingKeys.length) {
      violations.push(`UNDECLARED SLOT: ${row.key} omits [${missingKeys.join(', ')}] from its `
        + 'conditioning block entirely. An unnamed slot is worse than an open one — the reader '
        + 'supplies a default unconsciously and nothing marks the claim as marginalized. '
        + 'Declare it explicitly as null.');
    }

    // 4 — THE SLOT RULE (GUIDE-STANDARD.md §0.2). The program's namesake violation.
    if (openSlots.length && s.authority !== 'authored-root') {
      const noWeighting = s.weighting == null;
      const noChildren = !Array.isArray(s.marginalizes_over) || s.marginalizes_over.length === 0;
      if (noWeighting || noChildren) {
        violations.push(`SLOT DROPPED WITHOUT WEIGHTING: ${row.key} leaves `
          + `[${openSlots.join(', ')}] open but declares `
          + `${noWeighting ? 'no weighting' : 'a weighting'}`
          + `${noChildren ? ' and no marginalizes_over set' : ''}.\n`
          + '      A word may leave a title only if the guide carries (a) the set it '
          + 'marginalizes over and (b) the Weighting used.\n'
          + '      Without it the general claim wears the specific claim\'s credibility — the '
          + 'WS-291 mechanism, reached by deletion.');
      }
      if (s.weighting != null && !['frequency', 'uniform'].includes(s.weighting)) {
        violations.push(`WEIGHTING UNKNOWN: ${row.key} declares weighting "${s.weighting}". The `
          + 'register defines exactly two: `frequency` and `uniform`.');
      }
    }

    // 5 — MISSING REQUIRED SECTION (GUIDE-STANDARD.md §4)
    const missing = [0, 1, 2, 3, 4, 5, 6].filter((n) => !row.sections.includes(n));
    if (missing.length) {
      violations.push(`MISSING REQUIRED SECTION: ${row.key} lacks §${missing.join(', §')}. `
        + 'The seven sections are the form; a Guide missing one is not a shorter Guide.');
    }

    // 6 — CENSUS CLAIMS TOTAL COVERAGE
    const census = s.census ?? {};
    if (!('unexamined' in census)) {
      violations.push(`CENSUS INCOMPLETE: ${row.key} declares no \`unexamined\` count. A zero is `
        + 'three different facts and the Census refuses to collapse them.');
    } else if (Number(census.unexamined) === 0) {
      violations.push(`CENSUS CLAIMS TOTAL COVERAGE: ${row.key} reports zero \`unexamined\` rows. `
        + 'That is a stronger claim than any Guide in this repo can currently support — no live '
        + 'field sample exists. A guide that claims to have looked everywhere has not looked.');
    }
  }

  // 7 — ORPHANED LEDGER ROW: register rot, guarded from the other side.
  const liveKeys = new Set(rows.map((r) => r.key));
  for (const key of Object.keys(baseline)) {
    if (key === '__meta') continue;
    if (liveKeys.has(key)) continue;
    violations.push(`ORPHANED LEDGER ROW: baseline names "${key}", which no longer exists. `
      + 'Either the document was deleted (remove the row deliberately) or the harvest '
      + 'REGRESSED and this gate is about to go green by going blind.');
  }

  // 8 — THE ROOT EXEMPTION IS CAPPED AT ONE.
  // GUIDE-STANDARD.md's own §6 flags this as the live risk to AS-733: the root claims the
  // one privilege of being authored rather than derived. Uncapped, that privilege is the
  // loophole that swallows the slot rule.
  const roots = guides.filter((g) => g.standing?.authority === 'authored-root');
  if (roots.length > 1) {
    violations.push('MULTIPLE AUTHORED ROOTS: '
      + `${roots.map((r) => r.key).join(', ')} all claim \`authority: authored-root\`. `
      + 'Exactly one document may be authored rather than derived. A second root is the slot '
      + 'rule with an opt-out.');
  }

  // ── §INERT — the half a conformance gate cannot see ──
  const derived = guides.filter((g) => g.standing?.authority !== 'authored-root');
  const inertDeadline = meta.inert_deadline;
  if (derived.length === 0) {
    if (inertDeadline && daysSince(inertDeadline) > 0) {
      violations.push(`STANDARD INERT: the guide form has ZERO derived instances and the grace `
        + `period expired on ${inertDeadline} (owner: ${meta.inert_owner ?? 'unowned'}).\n`
        + '      A standard with no instances passes every conformance check and prints a green '
        + 'tick.\n'
        + '      Either emit a Guide, or retire the form deliberately — but it may not sit '
        + 'inert and green.');
    }
  }

  // ── AS-732, executed rather than described ──
  const totalUnexamined = guides.reduce(
    (n, g) => n + Number(g.standing?.census?.unexamined ?? 0), 0,
  );
  const refs = refsFn();
  if (totalUnexamined > AS732_ROWS && refs < AS732_MIN_QUEUE_REFS) {
    violations.push(`AS-732 FALSIFIED: ${totalUnexamined} standing \`unexamined\` rows against `
      + `only ${refs} queue item(s) referencing them (threshold: >${AS732_ROWS} rows with `
      + `<${AS732_MIN_QUEUE_REFS} items).\n`
      + '      The founder ruled that holes become the work queue. They are not becoming the '
      + 'work queue.\n'
      + '      Either file the items, or mark AS-732 falsified in prog-guide-authority.yaml — '
      + 'unhedged.');
  }

  return { violations, guides, derived, totalUnexamined, refs };
};

// ─── run ─────────────────────────────────────────────────────────────────────
//
// Guarded so the pure functions above can be imported by a test without the CLI
// firing and calling process.exit. The gate itself is unchanged when run as a
// script — same argv handling, same exit codes.
const isMain = process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {

  let result;
  try {
    result = harvest();
  } catch (err) {
    console.error(`❌ check-guide-ledger: harvest failed — ${err.message}`);
    process.exit(2);
  }

  // VACUITY. Narrowing scope is how a ledger goes green without anyone deciding it should.
  if (result.missingRoot) {
    console.error('❌ check-guide-ledger: HARVEST VACUOUS — docs/guides/ does not exist.');
    console.error('   A sweep that sees nothing must fail, not pass.');
    process.exit(1);
  }
  if (result.files === 0) {
    console.error('❌ check-guide-ledger: HARVEST VACUOUS — docs/guides/ contains no .md files.');
    console.error('   A sweep that stopped seeing things reports zero violations, which is');
    console.error('   indistinguishable from compliance.');
    process.exit(1);
  }

  const prior = existsSync(BASELINE) ? JSON.parse(readFileSync(BASELINE, 'utf8')) : {};

  if (has('--update')) {
    const out = { __meta: prior.__meta ?? {} };
    for (const row of result.rows) {
      const before = prior[row.key];
      out[row.key] = { ledger: before ? before.ledger : null };
      if (before?.since) out[row.key].since = before.since;
      if (before?.ticket) out[row.key].ticket = before.ticket;
    }
    writeFileSync(BASELINE, `${JSON.stringify(out, null, 2)}\n`, 'utf8');
    const nulls = Object.values(out).filter((r) => r && r.ledger === null).length;
    console.log(`✅ Guide ledger baseline re-snapshotted at ${BASELINE}`);
    console.log(`   ${result.files} document(s).`);
    if (nulls) {
      console.log(`   ${nulls} carry ledger: null and WILL STILL FAIL the gate — that is the`);
      console.log('   point. --update records that a document exists; it does not decide');
      console.log('   anything about it.');
    }
    process.exit(0);
  }

  if (!existsSync(BASELINE)) {
    console.error(`❌ check-guide-ledger: no baseline at ${BASELINE}`);
    console.error('   Create it with --update, decide each row, then commit it.');
    process.exit(1);
  }

  if (has('--undecided')) {
    const pending = result.rows.filter((r) => !prior[r.key] || prior[r.key].ledger == null);
    console.log(`${pending.length} document(s) awaiting a ledger decision:\n`);
    for (const r of pending) console.log(`  ${r.key}`);
    process.exit(0);
  }

  const { violations, guides, derived, totalUnexamined, refs } = compare(prior, result.rows);

  if (has('--observe')) {
    const row = {
      date: new Date().toISOString().slice(0, 10),
      documents: result.files,
      guides: guides.length,
      derived: derived.length,
      unexamined: totalUnexamined,
      queueRefs: refs,
      violations: violations.length,
    };
    appendFileSync(OBSERVANCE, `${JSON.stringify(row)}\n`, 'utf8');
    console.log(`✅ Observance row appended to ${relative(REPO, OBSERVANCE)}`);
    console.log(`   ${JSON.stringify(row)}`);
    process.exit(violations.length ? 1 : 0);
  }

  if (violations.length) {
    console.error('❌ GUIDE LEDGER VIOLATION');
    console.error('');
    for (const v of violations) console.error(`   - ${v}`);
    console.error('');
    console.error('Authority is EARNED by conditioning, not borrowed by deletion.');
    console.error('Form: docs/guides/GUIDE-STANDARD.md · Program: prog-guide-authority');
    console.error('');
    console.error('   What needs a decision?  node scripts/standardOfRecord/check-guide-ledger.mjs --undecided');
    console.error('   Legitimate new doc?     node scripts/standardOfRecord/check-guide-ledger.mjs --update');
    process.exit(1);
  }

  const meta = prior.__meta ?? {};
  console.log('✅ Guide Authority observance: OK');
  console.log(`   - ${result.files} document(s) in docs/guides/, all decided.`);
  console.log(`   - ${guides.length} Guide(s): ${derived.length} derived, `
    + `${guides.length - derived.length} authored root.`);
  console.log(`   - ${totalUnexamined} standing \`unexamined\` row(s), ${refs} queue item(s) `
    + 'referencing them (AS-732).');
  if (derived.length === 0 && meta.inert_deadline) {
    console.log(`   - ⚠ INERT: zero derived instances. Grace expires ${meta.inert_deadline} `
      + `(owner: ${meta.inert_owner ?? 'unowned'}), after which this gate FAILS.`);
  }
}
