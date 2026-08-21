#!/usr/bin/env node
/**
 * claim-corpus-extract.mjs — build the scoreable claim corpus from session transcripts.
 *
 * WHY THIS EXISTS, AND WHY IT IS RETROSPECTIVE.
 *
 * `docs/context-retrieval-protocol.md` §3 pre-registers a falsifier requiring the
 * "wrong, and I had the info" rate "measured before, and after, on the same instrument."
 * Its proposed instrument was `cwos-capture friction` at the moment of occurrence. That
 * cannot satisfy its own falsifier, for two reasons that are structural rather than
 * fixable:
 *
 *   1. A FORWARD-ONLY INSTRUMENT HAS NO BEFORE. Installed today, it can only measure
 *      from today. The pre-period is unobtainable, so the design is unfalsifiable as
 *      written.
 *   2. SELF-REPORT CANNOT MEASURE UNRECOGNISED ERROR. The class under study is
 *      *confidently wrong*. An agent that knew it was wrong would not have made the
 *      claim. The repo has already measured this exact instrument's yield: per
 *      `CLAUDE.md`, `/session-end` runs ~12% of the time, and `system/decisions.md`
 *      held 47 entries with ZERO produced by the passive path.
 *
 * The corpus is already on disk: 123 transcripts, ~584 MB, months of history. Mining it
 * yields a before-period today, at zero founder effort, and it is the only form that can
 * produce the pre-period the seeded-coin channel experiment (founder ruling 2026-08-20)
 * needs for its arms.
 *
 * WHAT THIS SCRIPT DOES AND DELIBERATELY DOES NOT DO.
 *
 * It EXTRACTS and it ATTRIBUTES. It does not judge. Whether a claim is true is decided
 * by a fresh-context agent that did not produce it (`claim-corpus-adjudicate.mjs`), per
 * `.claude/projects/accuracy-program-handoff.md:260-263`. Keeping extraction and
 * judgement in separate processes is the whole point: an extractor that also scored
 * would be the same context deciding both what counts and whether it was right.
 *
 * THE DEFINITION OF A CLAIM IS NOT MINE TO CHOOSE. `docs/context-shift-prereg.md:136-138`
 * froze it: a load-bearing claim is a `file:line`, a measured quantity, or a capability
 * assertion. This script implements that and nothing wider. Widening it later is a
 * change to a frozen pre-registration and must be recorded as one.
 *
 * SCORING HAPPENS AT THE COMMIT THAT CREATED THE ARTIFACT, never at HEAD. A claim made
 * on 2026-08-06 about a file that changed on 2026-08-12 is not wrong; scoring it against
 * HEAD would call it wrong and manufacture a rate out of ordinary repo movement. This is
 * the baseline-leakage channel named at `accuracy-program-handoff.md:274-278`.
 *
 * Usage:
 *   node scripts/context/claim-corpus-extract.mjs                 # write corpus + summary
 *   node scripts/context/claim-corpus-extract.mjs --limit 20      # first N transcripts
 *   node scripts/context/claim-corpus-extract.mjs --out <path>
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import readline from 'node:readline';
import { execFileSync } from 'node:child_process';

const REPO_ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'), '..', '..');
const TRANSCRIPT_DIR = path.join(
  os.homedir(), '.claude', 'projects', 'C--Users-chris-repos-claude-poker-tracker',
);
const DEFAULT_OUT = path.join(REPO_ROOT, '.claude', 'workstream', 'evidence', 'claim-corpus.jsonl');

/**
 * THE PUSH SET — content that arrives without anyone retrieving it.
 *
 * This is the cell that makes the four-way attribution meaningful. A claim citing
 * `CLAUDE.md` is NOT an un-retrieved claim: those bytes are in the window before any
 * hook runs. A checker that flags them is measuring its own blind spot, which is
 * exactly the spec bug that produced the discarded "0/11 precision" result on
 * 2026-08-20 (design-critique Phase 2).
 */
const PUSH_SET = new Set([
  'claude.md',
  'memory.md',
]);
const PUSH_PREFIXES = ['.claude/rules/'];

function isPushChannel(p) {
  const n = String(p).replace(/\\/g, '/').toLowerCase().replace(/^\.\//, '');
  if (PUSH_SET.has(n) || PUSH_SET.has(n.split('/').pop())) return true;
  return PUSH_PREFIXES.some((pre) => n.startsWith(pre));
}

// ── claim shapes: the frozen definition, and only that ──────────────────────

const FILE_EXT = 'js|jsx|mjs|cjs|ts|tsx|md|yaml|yml|json|py|sh|ps1|html|css';
// A path with an explicit line or line-range. The strongest shape: it names a location.
const RE_FILE_LINE = new RegExp(`([A-Za-z0-9_./\\-]+\\.(?:${FILE_EXT})):(\\d+)(?:-(\\d+))?`, 'g');
// A bare path, no line. Weaker, still a capability-ish locational claim.
const RE_FILE_BARE = new RegExp(`(?:^|[\\s"'\`(\\[])([A-Za-z0-9_./\\-]{3,}\\.(?:${FILE_EXT}))(?![:\\w])`, 'g');
// A number carrying a unit. Excludes bare integers, which are not claims on their own.
// Units carry boundaries. Without them `**WS-270 filed**` extracts as the quantity
// "270 file" -- caught in the first smoke run, and the same shape of false positive
// that made the discarded 0/11 prototype unusable on 2026-08-20. `x` is handled
// separately from the word list because `7x` has no word boundary before the x.
const RE_QUANTITY = /(\d[\d,]*(?:\.\d+)?)\s*(%|×|x(?![A-Za-z])|\b(?:bb|ms|s|KB|MB|GB|tokens?|bytes?|chars?|lines?|files?|hands?|sessions?|commits?|turns?|tests?)\b)/g;
// Capability assertions — the class an interval-overlap checker structurally cannot see,
// and the class carrying this repo's most expensive recorded error (a false impossibility
// claim inherited by a third party; see cwos-context-bundle-validate.cjs header).
const RE_CAPABILITY = /\b(?:does not exist|do not exist|doesn't exist|nothing reads|nothing consumes|no consumer|there is no|there are no|has never|have never|never ran|never fired|was never|were never|is not implemented|are not implemented|cannot be|is impossible|no such file|not wired|zero occurrences|not measured anywhere)\b/gi;

function extractClaims(text) {
  const out = [];
  const push = (kind, raw, extra = {}) => out.push({ kind, raw, ...extra });

  for (const m of text.matchAll(RE_FILE_LINE)) {
    push('file-line', m[0], { cited_path: m[1], cited_line: Number(m[2]), cited_line_end: m[3] ? Number(m[3]) : null, index: m.index });
  }
  for (const m of text.matchAll(RE_FILE_BARE)) {
    // Skip if this path was already captured with a line number at the same spot.
    if (out.some((c) => c.kind === 'file-line' && c.cited_path === m[1])) continue;
    push('file-bare', m[1], { cited_path: m[1], cited_line: null, index: m.index });
  }
  for (const m of text.matchAll(RE_QUANTITY)) {
    push('quantity', m[0], { value: m[1], unit: m[2], index: m.index });
  }
  for (const m of text.matchAll(RE_CAPABILITY)) {
    push('capability', m[0], { index: m.index });
  }
  return out;
}

/** The sentence around an offset — what a judge needs to know what was actually asserted. */
function sentenceAt(text, index) {
  const start = Math.max(0, text.lastIndexOf('\n', index) + 1);
  let s = text.lastIndexOf('. ', index);
  if (s > start) s += 2; else s = start;
  let e = text.indexOf('\n', index);
  const dot = text.indexOf('. ', index);
  if (dot !== -1 && (e === -1 || dot < e)) e = dot + 1;
  if (e === -1) e = Math.min(text.length, index + 300);
  return text.slice(s, e).trim().slice(0, 600);
}

// ── git: which commit was HEAD when this claim was made ─────────────────────

/**
 * WHICH COMMIT WAS HEAD WHEN THIS CLAIM WAS MADE — PER BRANCH, NOT GLOBALLY.
 *
 * The first version of this indexed `git log --all` and took the latest commit whose
 * committer date preceded the claim. That is wrong on a repo with concurrent branches,
 * and the error is not small: measured over the first 60-claim sample, 12% (7 of 60)
 * were assigned a commit that is NOT an ancestor of the branch the session was on.
 * Those claims were being checked against a tree that session never had.
 *
 * It was caught by a judge, not by me: an independent verifier refuted a claim about
 * `layout-doctrine.md` and noted the file arrived on an ORPHAN commit that `--all`
 * happily returned. A wrong commit produces confident REFUTED verdicts on true claims,
 * which is the worst possible failure for a baseline instrument -- it manufactures an
 * error rate out of branch topology.
 *
 * So: one ordered list per branch, and a claim resolves against the branch its own
 * transcript recorded. A branch that no longer exists falls back to the global index
 * and the record says so, because a silent fallback is the same defect wearing a fix.
 */
function buildCommitIndex() {
  const parse = (raw) => raw.trim().split('\n').filter(Boolean).map((l) => {
    const sp = l.indexOf(' ');
    return { sha: l.slice(0, sp), t: Date.parse(l.slice(sp + 1)) };
  }).filter((r) => Number.isFinite(r.t)).sort((a, b) => a.t - b.t);

  const all = parse(execFileSync('git', ['log', '--all', '--format=%H %cI'], {
    cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
  }));

  const branches = execFileSync('git', ['for-each-ref', '--format=%(refname:short)', 'refs/heads'], {
    cwd: REPO_ROOT, encoding: 'utf8',
  }).trim().split('\n').filter(Boolean);

  const byBranch = new Map();
  for (const b of branches) {
    try {
      byBranch.set(b, parse(execFileSync('git', ['log', '--format=%H %cI', b], {
        cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      })));
    } catch { /* a ref that cannot be walked is simply absent from the map */ }
  }
  return { all, byBranch };
}

function pickCommit(list, tsMs) {
  let lo = 0, hi = list.length - 1, best = null;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (list[mid].t <= tsMs) { best = list[mid]; lo = mid + 1; } else hi = mid - 1;
  }
  return best ? best.sha : null;
}

/** Returns [sha, basis] — basis is the branch used, or 'all-fallback' when it is gone. */
function commitAt(index, tsMs, branch) {
  if (branch && index.byBranch.has(branch)) {
    const sha = pickCommit(index.byBranch.get(branch), tsMs);
    if (sha) return [sha, branch];
  }
  return [pickCommit(index.all, tsMs), branch ? 'all-fallback' : 'no-branch-recorded'];
}

// ── transcript walking ──────────────────────────────────────────────────────

/** Paths this tool call caused to enter the window. Read/Grep/Glob plus shell reads. */
function readsFromToolUse(block) {
  const inp = block.input || {};
  const out = [];
  for (const k of ['file_path', 'path', 'notebook_path']) {
    if (typeof inp[k] === 'string') out.push(inp[k]);
  }
  if (typeof inp.pattern === 'string' && inp.pattern.includes('/')) out.push(inp.pattern);
  if (typeof inp.command === 'string') {
    for (const m of inp.command.matchAll(new RegExp(`[A-Za-z0-9_./\\-]+\\.(?:${FILE_EXT})`, 'g'))) out.push(m[0]);
  }
  return out.map((p) => String(p).replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase());
}

/**
 * A real founder turn: a user record carrying FOUNDER PROSE.
 *
 * Three things wear a user record  clothes and are not founder turns. Measured over
 * 123 transcripts: 1323 user-prose records, of which only 1175 are founder prose.
 *
 *   - SLASH-COMMAND ECHOES (132). The harness writes the command and its output back
 *     as a user record. Nobody typed it as a message.
 *   - INTERRUPTS (16). Treating one as a turn boundary is actively wrong: it cuts the
 *     assistant off MID-FLIGHT and files the fragment as an end-of-turn text the
 *     founder supposedly read to completion. That manufactures claims out of
 *     half-finished sentences.
 *   - SYSTEM REMINDERS and hook injections. Machine text in a user envelope.
 *
 * Counting these inflates the denominator and, worse, SPLITS one real turn into two,
 * so a claim gets attributed to a turn that never happened.
 */
const NOT_FOUNDER_PROSE = [
  '<system-reminder>',
  '<local-command-caveat>',
  '<command-name>',
  'Caveat: The messages below were generated by the user while running local commands',
  '[Request interrupted',
];

function founderProse(rec) {
  if (rec.type !== 'user' || rec.isSidechain) return null;
  const c = rec.message && rec.message.content;
  let t = null;
  if (typeof c === 'string') t = c;
  else if (Array.isArray(c)) {
    if (c.some((b) => b && b.type === 'tool_result')) return null;
    t = c.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
  }
  if (!t || !t.trim()) return null;
  const head = t.trimStart();
  if (NOT_FOUNDER_PROSE.some((m) => head.startsWith(m))) return null;
  return t;
}

function isFounderTurn(rec) {
  return founderProse(rec) !== null;
}

function founderText(rec) { return founderProse(rec) || ''; }

async function walkTranscript(file, commitIndex, emit, stats) {
  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  const readSet = new Set();
  let pendingText = [];        // assistant text since the last founder turn
  let pendingTs = null;
  let turnIndex = 0;
  let sessionId = null;
  let branch = null;

  for await (const line of rl) {
    const s = line.trim();
    if (!s) continue;
    let rec;
    try { rec = JSON.parse(s); } catch { stats.unparseable++; continue; }

    sessionId = rec.sessionId || sessionId;
    branch = rec.gitBranch || branch;

    if (rec.type === 'assistant' && !rec.isSidechain) {
      const blocks = (rec.message && rec.message.content) || [];
      for (const b of blocks) {
        if (!b || typeof b !== 'object') continue;
        // `thinking` is deliberately excluded: the founder never sees it, so a claim
        // there was never delivered and cannot have misled anyone.
        if (b.type === 'text' && String(b.text || '').trim()) {
          pendingText.push(b.text);
          pendingTs = rec.timestamp || pendingTs;
        } else if (b.type === 'tool_use') {
          for (const p of readsFromToolUse(b)) readSet.add(p);
        }
      }
      continue;
    }

    if (rec.type === 'user' && !rec.isSidechain && founderProse(rec) === null) {
      const cc = rec.message && rec.message.content;
      const isToolResult = Array.isArray(cc) && cc.some((x) => x && x.type === 'tool_result');
      if (!isToolResult && cc) stats.skippedNonProse++;
    }

    if (isFounderTurn(rec)) {
      if (!pendingText.length) stats.founderTurnsNoText++;
      // The assistant text immediately before a founder turn is what the founder read.
      if (pendingText.length) {
        turnIndex += 1;
        const text = pendingText.join('\n\n');
        const tsMs = Date.parse(pendingTs || rec.timestamp || '');
        emitClaims({
          text, sessionId, file, turnIndex,
          ts: pendingTs || rec.timestamp || null,
          tsMs, branch,
          readSet: new Set(readSet),
          nextFounderTurn: founderText(rec).slice(0, 1200),
          commitIndex, emit, stats,
        });
      }
      pendingText = [];
      pendingTs = null;
      continue;
    }
    // tool_result user records: not founder turns, and they carry no assistant claim.
  }
  rl.close();
}

function emitClaims(ctx) {
  const { text, sessionId, file, turnIndex, ts, tsMs, branch, readSet, nextFounderTurn, commitIndex, emit, stats } = ctx;
  stats.turns++;
  const claims = extractClaims(text);
  if (!claims.length) return;
  stats.turnsWithClaims++;

  const [commit, commitBasis] = Number.isFinite(tsMs)
    ? commitAt(commitIndex, tsMs, branch)
    : [null, 'no-timestamp'];

  for (const c of claims) {
    stats.claims++;
    stats.byKind[c.kind] = (stats.byKind[c.kind] || 0) + 1;

    let provenance = 'n/a';
    if (c.cited_path) {
      const norm = c.cited_path.replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
      const leaf = norm.split('/').pop();
      const wasRead = readSet.has(norm)
        || [...readSet].some((r) => r === norm || r.endsWith('/' + norm) || r.endsWith('/' + leaf) || r === leaf);
      if (isPushChannel(norm)) provenance = 'push';
      else if (wasRead) provenance = 'read';
      else provenance = 'neither';
      stats.byProvenance[provenance] = (stats.byProvenance[provenance] || 0) + 1;
    }

    emit({
      claim_id: `${path.basename(file, '.jsonl').slice(0, 8)}-t${turnIndex}-${stats.claims}`,
      session: sessionId,
      transcript: path.basename(file),
      turn_index: turnIndex,
      timestamp: ts,
      commit,
      commit_basis: commitBasis,
      branch,
      kind: c.kind,
      claim: c.raw,
      cited_path: c.cited_path || null,
      cited_line: c.cited_line ?? null,
      cited_line_end: c.cited_line_end ?? null,
      value: c.value ?? null,
      unit: c.unit ?? null,
      provenance,
      read_set_size: readSet.size,
      sentence: sentenceAt(text, c.index || 0),
      founder_reply: nextFounderTurn,
    });
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const limit = argv.includes('--limit') ? Number(argv[argv.indexOf('--limit') + 1]) : Infinity;
  const out = argv.includes('--out') ? argv[argv.indexOf('--out') + 1] : DEFAULT_OUT;

  if (!fs.existsSync(TRANSCRIPT_DIR)) {
    console.error(`No transcript directory at ${TRANSCRIPT_DIR}`);
    process.exit(1);
  }

  const files = fs.readdirSync(TRANSCRIPT_DIR)
    .filter((f) => f.endsWith('.jsonl'))
    .map((f) => path.join(TRANSCRIPT_DIR, f))
    .sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs)
    .slice(0, limit === Infinity ? undefined : limit);

  const commitIndex = buildCommitIndex();
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const sink = fs.createWriteStream(out, { encoding: 'utf8' });

  const stats = {
    files: 0, turns: 0, turnsWithClaims: 0, claims: 0, unparseable: 0,
    skippedNonProse: 0, founderTurnsNoText: 0,
    byKind: {}, byProvenance: {},
  };

  for (const f of files) {
    stats.files++;
    try {
      await walkTranscript(f, commitIndex, (rec) => sink.write(JSON.stringify(rec) + '\n'), stats);
    } catch (e) {
      console.error(`  ! ${path.basename(f)}: ${e.message}`);
    }
    if (stats.files % 20 === 0) process.stderr.write(`  ${stats.files}/${files.length} transcripts…\n`);
  }
  await new Promise((r) => sink.end(r));

  const pct = (n, d) => (d ? ((100 * n) / d).toFixed(1) + '%' : '—');
  console.log('');
  console.log(`claim corpus -> ${path.relative(REPO_ROOT, out)}`);
  console.log(`  transcripts        ${stats.files}   (commit index: ${commitIndex.all.length} commits, ${commitIndex.byBranch.size} branches)`);
  console.log(`  scoreable turns      ${stats.turns}   (a founder turn PRECEDED by assistant text)`);
  console.log(`  non-prose skipped    ${stats.skippedNonProse}   (slash echoes, interrupts, system reminders)`);
  console.log(`  founder turns with no preceding assistant text: ${stats.founderTurnsNoText}`);
  console.log(`  turns with >=1 claim ${stats.turnsWithClaims}  (${pct(stats.turnsWithClaims, stats.turns)})`);
  console.log(`  claims extracted     ${stats.claims}`);
  console.log(`  by kind              ${JSON.stringify(stats.byKind)}`);
  console.log('');
  console.log('  PROVENANCE of claims that cite a path — the four-cell attribution:');
  const P = stats.byProvenance;
  const tot = (P.push || 0) + (P.read || 0) + (P.neither || 0);
  console.log(`    read     ${String(P.read || 0).padStart(6)}  ${pct(P.read || 0, tot)}   the file was opened in this session before the claim`);
  console.log(`    push     ${String(P.push || 0).padStart(6)}  ${pct(P.push || 0, tot)}   always-injected; NOT an un-retrieved claim`);
  console.log(`    neither  ${String(P.neither || 0).padStart(6)}  ${pct(P.neither || 0, tot)}   <- the estimand: asserted without opening the file`);
  console.log('');
  console.log('  NOT AN ACCURACY RATE. Provenance says where content came from, never');
  console.log('  whether the claim was true. Truth is decided by a fresh-context judge');
  console.log('  that did not produce the claim: claim-corpus-adjudicate.mjs.');
  if (stats.unparseable) console.log(`  (${stats.unparseable} unparseable transcript lines skipped)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
