#!/usr/bin/env node
/**
 * echo-meter.mjs — attributable echo over Claude Code session transcripts.
 *
 * WHAT THIS MEASURES, AND WHY THE CONTROL IS NOT OPTIONAL
 * -------------------------------------------------------
 * Raw overlap between what a session SAID and what it READ is meaningless on its
 * own, because a poker repo talks about poker: any two documents in this tree
 * share vocabulary by construction. So the instrument is a DIFFERENCE:
 *
 *   E(O,R)  fraction of the output's content 5-grams that appear verbatim in the
 *           session's actual read-set R
 *   E(O,D)  the same measure against D — a size-matched sample of repo markdown
 *           that this session did NOT read (the coincidental-overlap control)
 *   A       = E(O,R) - E(O,D)          <-- attributable echo
 *
 * A is the part of the overlap attributable to having actually read the thing.
 *
 * CITED-BUT-UNREAD is computed alongside and is the cheaper, sharper signal:
 * a file cited as a source in the output that never appears in R. That is the
 * exact signature of the 2026-08-05 failure — a conclusion reproduced in
 * structure while its mechanism was wrong, i.e. recalled rather than read.
 *
 * DELIBERATE ASYMMETRY, STATED: R is reconstructed from tool_result CONTENT in
 * the transcript (what actually entered the context window at the time), while D
 * is sampled from the repo on disk TODAY. Using the transcript for R is the more
 * faithful choice — it is immune to files having changed since — but it means R
 * and D are drawn from two different points in time. This inflates neither term
 * systematically, and it is recorded here rather than hidden.
 *
 * Usage:
 *   node scripts/context/echo-meter.mjs --sessions 30 [--json out.json]
 *   node scripts/context/echo-meter.mjs --transcript <file.jsonl>
 */

import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const TRANSCRIPT_DIR = path.join(
  process.env.USERPROFILE || process.env.HOME || '',
  '.claude', 'projects', 'C--Users-chris-repos-claude-poker-tracker'
);

const NGRAM = 5;

// Deliberately small stopword list. A large one would strip the domain terms
// that are the whole point of the measurement.
const STOPWORDS = new Set(`a an the and or but if then of to in on at by for with from as is are was
were be been being it its this that these those there here what which who whom how why when where
i you he she they we me him her them us my your his their our not no yes do does did done can could
should would will shall may might must have has had having so than too very just also into over
under again further once about against between during before after above below up down out off`
  .split(/\s+/).filter(Boolean));

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/`{3}[\s\S]*?`{3}/g, ' ')      // strip fenced code blocks
    .replace(/`[^`\n]*`/g, ' ')             // strip inline code
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !STOPWORDS.has(w));
}

function ngrams(tokens, n = NGRAM) {
  const out = new Set();
  for (let i = 0; i + n <= tokens.length; i++) out.add(tokens.slice(i, i + n).join(' '));
  return out;
}

/** Walk one transcript, returning { outputText, readText, readPaths, citedPaths }. */
async function walkTranscript(file) {
  const outputChunks = [];
  const readChunks = [];
  const readPaths = new Set();

  const rl = readline.createInterface({
    input: fs.createReadStream(file, { encoding: 'utf8' }),
    crlfDelay: Infinity,
  });

  // tool_use id -> path, so a tool_result can be attributed to the file it read
  const pendingReads = new Map();

  for await (const line of rl) {
    if (!line.trim()) continue;
    let rec;
    try { rec = JSON.parse(line); } catch { continue; }

    const msg = rec.message;
    if (!msg || !Array.isArray(msg.content)) continue;

    for (const block of msg.content) {
      if (!block || typeof block !== 'object') continue;

      // --- assistant prose = the OUTPUT O ---
      if (msg.role === 'assistant' && block.type === 'text' && block.text) {
        outputChunks.push(block.text);
      }

      // --- reads issued ---
      // NB: Bash is included deliberately. In this repo Bash outnumbers Read ~5:1
      // (cat / grep / git / head), and its stdout enters the context window exactly
      // as a Read result does. Counting only Read/Grep/Glob undercounts the read-set
      // badly and therefore deflates E(O,R) and A. Any file path named in the command
      // is credited as read, which is what cited-but-unread needs.
      if (block.type === 'tool_use' && block.name) {
        const n = block.name;
        if (n === 'Read' || n === 'Grep' || n === 'Glob' || n === 'NotebookRead') {
          const p = block.input?.file_path || block.input?.path || block.input?.pattern || '';
          if (p) readPaths.add(String(p));
          pendingReads.set(block.id, String(p));
        } else if (n === 'Bash') {
          const cmd = String(block.input?.command || '');
          const pathRe = /(?:^|[\s"'`=(])((?:\.?\/)?(?:src|docs|scripts|kit|system|\.claude)\/[A-Za-z0-9._\/*-]+)/g;
          let pm;
          while ((pm = pathRe.exec(cmd)) !== null) readPaths.add(pm[1]);
          pendingReads.set(block.id, cmd.slice(0, 120));
        }
      }

      // --- read RESULTS = the read-set R (what actually entered the window) ---
      if (block.type === 'tool_result' && pendingReads.has(block.tool_use_id)) {
        const c = block.content;
        if (typeof c === 'string') readChunks.push(c);
        else if (Array.isArray(c)) {
          for (const sub of c) if (sub?.type === 'text' && sub.text) readChunks.push(sub.text);
        }
        pendingReads.delete(block.tool_use_id);
      }
    }
  }

  const outputText = outputChunks.join('\n');

  // Files cited AS SOURCES in the output: repo-relative-looking paths.
  const citedPaths = new Set();
  const citeRe = /(?:^|[\s(`"'])((?:src|docs|scripts|kit|system|\.claude)\/[A-Za-z0-9._\/-]+\.[A-Za-z]{2,5})/g;
  let m;
  while ((m = citeRe.exec(outputText)) !== null) citedPaths.add(m[1].replace(/\\/g, '/'));

  return { outputText, readText: readChunks.join('\n'), readPaths, citedPaths };
}

/** All repo markdown, for building the decoy corpus. */
function repoMarkdown() {
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.venv']);
  (function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (skip.has(e.name)) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.md')) {
        let size = 0;
        try { size = fs.statSync(full).size; } catch { continue; }
        out.push({ path: full, rel: path.relative(REPO_ROOT, full).replace(/\\/g, '/'), size });
      }
    }
  })(REPO_ROOT);
  return out;
}

/**
 * Size-matched decoy: repo markdown NOT read this session, sampled
 * deterministically (seeded by session index) until it matches R's byte size.
 */
function buildDecoy(allMd, readPaths, targetBytes, seed) {
  const readNorm = new Set([...readPaths].map(p => p.replace(/\\/g, '/').toLowerCase()));
  const candidates = allMd.filter(f => {
    const rel = f.rel.toLowerCase();
    for (const r of readNorm) if (r.endsWith(rel) || rel.endsWith(r.replace(/^.*?\//, ''))) return false;
    return true;
  });
  // deterministic shuffle (mulberry32)
  let s = seed >>> 0;
  const rand = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const shuffled = [...candidates].sort(() => rand() - 0.5);

  const chunks = [];
  let acc = 0;
  for (const f of shuffled) {
    if (acc >= targetBytes) break;
    try { chunks.push(fs.readFileSync(f.path, 'utf8')); acc += f.size; } catch { /* skip */ }
  }
  return chunks.join('\n');
}

function mean(xs) { return xs.reduce((a, b) => a + b, 0) / xs.length; }
function stdev(xs) {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

async function main() {
  const argv = process.argv.slice(2);
  const nSessions = Number(argv[argv.indexOf('--sessions') + 1]) || 30;
  const jsonOutIdx = argv.indexOf('--json');
  const jsonOut = jsonOutIdx >= 0 ? argv[jsonOutIdx + 1] : null;

  const files = fs.readdirSync(TRANSCRIPT_DIR)
    .filter(f => f.endsWith('.jsonl'))
    .map(f => ({ f, full: path.join(TRANSCRIPT_DIR, f), mtime: fs.statSync(path.join(TRANSCRIPT_DIR, f)).mtimeMs, size: fs.statSync(path.join(TRANSCRIPT_DIR, f)).size }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, nSessions);

  const allMd = repoMarkdown();
  const rows = [];

  for (let i = 0; i < files.length; i++) {
    const { f, full, size } = files[i];
    process.stderr.write(`[${i + 1}/${files.length}] ${f} (${(size / 1e6).toFixed(1)}MB)\n`);

    let walked;
    try { walked = await walkTranscript(full); } catch (e) { process.stderr.write(`   skip: ${e.message}\n`); continue; }

    const oTokens = tokenize(walked.outputText);
    if (oTokens.length < 500) { process.stderr.write('   skip: output too short\n'); continue; }

    const oGrams = ngrams(oTokens);
    if (oGrams.size === 0) continue;

    const rTokens = tokenize(walked.readText);
    const decoyText = buildDecoy(allMd, walked.readPaths, Buffer.byteLength(walked.readText, 'utf8'), i + 1);
    const dTokens = tokenize(decoyText);

    const rGrams = ngrams(rTokens);
    const dGrams = ngrams(dTokens);

    let hitR = 0, hitD = 0;
    for (const g of oGrams) { if (rGrams.has(g)) hitR++; if (dGrams.has(g)) hitD++; }

    const eR = hitR / oGrams.size;
    const eD = hitD / oGrams.size;

    // Sensitivity check at n=3. If the n=5 signal is noise-dominated purely because
    // verbatim 5-content-word runs are rare, n=3 will be markedly less noisy; if both
    // are equally noisy the noise is intrinsic to session granularity, not gram size.
    const o3 = ngrams(oTokens, 3), r3 = ngrams(rTokens, 3), d3 = ngrams(dTokens, 3);
    let h3r = 0, h3d = 0;
    for (const g of o3) { if (r3.has(g)) h3r++; if (d3.has(g)) h3d++; }
    const A3 = o3.size ? (h3r - h3d) / o3.size : 0;

    // cited-but-unread
    const readNorm = [...walked.readPaths].map(p => p.replace(/\\/g, '/').toLowerCase());
    const unread = [...walked.citedPaths].filter(c => {
      const cl = c.toLowerCase();
      return !readNorm.some(r => r.endsWith(cl) || r.includes(cl));
    });

    rows.push({
      session: f.slice(0, 8),
      outputGrams: oGrams.size,
      readBytes: Buffer.byteLength(walked.readText, 'utf8'),
      decoyBytes: Buffer.byteLength(decoyText, 'utf8'),
      eR: +eR.toFixed(5),
      eD: +eD.toFixed(5),
      A: +(eR - eD).toFixed(5),
      A3: +A3.toFixed(5),
      cited: walked.citedPaths.size,
      citedButUnread: unread.length,
    });
  }

  const As = rows.map(r => r.A);
  const sd = stdev(As), mu = mean(As);

  console.log('\n=== ATTRIBUTABLE ECHO — retrospective, per session ===\n');
  console.log('session   O-grams   read KB   decoy KB    E(O,R)    E(O,D)         A   cited  unread');
  for (const r of rows) {
    console.log(
      `${r.session}  ${String(r.outputGrams).padStart(8)}  ${String(Math.round(r.readBytes / 1024)).padStart(8)}  ${String(Math.round(r.decoyBytes / 1024)).padStart(9)}  ${r.eR.toFixed(5).padStart(8)}  ${r.eD.toFixed(5).padStart(8)}  ${r.A.toFixed(5).padStart(8)}  ${String(r.cited).padStart(6)}  ${String(r.citedButUnread).padStart(6)}`
    );
  }

  const A3s = rows.map(r => r.A3);
  const sd3 = stdev(A3s), mu3 = mean(A3s);

  console.log(`\nn sessions scored:        ${rows.length}`);
  console.log(`mean A      (n=5 grams):  ${mu.toFixed(5)}`);
  console.log(`session-to-session SD:    ${sd.toFixed(5)}`);
  console.log(`coefficient of variation: ${mu !== 0 ? (sd / Math.abs(mu)).toFixed(3) : 'n/a'}`);
  console.log(`mean A      (n=3 grams):  ${mu3.toFixed(5)}   SD ${sd3.toFixed(5)}   CV ${mu3 !== 0 ? (sd3 / Math.abs(mu3)).toFixed(3) : 'n/a'}`);

  // Power: two-sample, 80% power, alpha .05 -> n per arm ~ 15.7 * (SD/delta)^2
  console.log('\n--- what this instrument can detect at session granularity ---');
  for (const rel of [0.5, 0.3, 0.2, 0.1]) {
    const delta = Math.abs(mu) * rel;
    const nPerArm = delta > 0 ? Math.ceil(15.7 * (sd / delta) ** 2) : Infinity;
    console.log(`  detect a ${(rel * 100).toFixed(0).padStart(2)}% relative change (delta=${delta.toFixed(5)}): ${Number.isFinite(nPerArm) ? nPerArm : '-'} sessions per arm`);
  }

  const totalCited = rows.reduce((a, r) => a + r.cited, 0);
  const totalUnread = rows.reduce((a, r) => a + r.citedButUnread, 0);
  console.log(`\ncited-but-unread: ${totalUnread}/${totalCited} citations (${totalCited ? (100 * totalUnread / totalCited).toFixed(1) : '0'}%) across ${rows.length} sessions`);

  if (jsonOut) {
    fs.writeFileSync(jsonOut, JSON.stringify({ rows, mean: mu, sd, n: rows.length }, null, 2));
    console.log(`\nwrote ${jsonOut}`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
