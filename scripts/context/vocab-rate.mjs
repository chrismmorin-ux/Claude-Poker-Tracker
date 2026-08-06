#!/usr/bin/env node
/**
 * vocab-rate.mjs — the PRIMARY instrument of the WS-424 pre-registration.
 *
 * Scores, per 1,000 words, the rate at which TREATMENT vocabulary (terms the
 * compact tier carries) and CONTROL vocabulary (terms drawn from the same heavy
 * tier and deliberately WITHHELD from the compact tier) appear in artifacts.
 *
 * The reported statistic is the DIFFERENCE:
 *
 *     V = rate(treatment) - rate(control)
 *
 * The control exists because this repo's artifacts talk about poker and method
 * regardless of what any injection does. A rise in treatment terms alone would be
 * indistinguishable from the repo simply getting busier on that subject. Only the
 * difference isolates the injection.
 *
 * POPULATION IS ATTRIBUTED BY created_at, NEVER BY mtime. mtime moves when a file
 * is touched, reformatted, or checked out; it would silently re-date the entire
 * baseline on any bulk operation. Artifacts without a created_at are excluded and
 * counted as excluded, not silently dropped.
 *
 * Usage:
 *   node scripts/context/vocab-rate.mjs --since 2026-07-22 [--until 2026-08-05]
 *   node scripts/context/vocab-rate.mjs --terms      # print the frozen lists
 */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);

const REPO_ROOT = path.resolve(new URL('../..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

/**
 * FROZEN 2026-08-05, BEFORE THE COMPACT TIER SHIPPED.
 * Editing either list after the change ships invalidates the study. Both lists are
 * drawn from the SAME heavy tier so they are exchangeable under the null.
 */
export const TREATMENT = [
  // repo method — the behaviour the compact tier carries (founder's closing requirement)
  'dispatch', 'pre-register', 'prereg', 'falsifier', 'falsified',
  'contamination', 'contradiction', 'replication', 'withheld', 'derive',
  // poker doctrine promoted into the compact tier
  'spr', 'blocker', 'per-combo', 'equity', 'range-based',
];

export const CONTROL = [
  // heavy-tier vocabulary DELIBERATELY EXCLUDED from the compact tier.
  // Same document, same register, no injection — the exchangeability control.
  'intransitive', 'intransitivity', 'antisymmetric', 'icm', 'malmuth',
  'harville', 'bubble', 'ante', 'straddle', 'rake',
  'realization', 'quantile', 'donk', 'squeeze', 'multiway',
];

function words(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(Boolean);
}

function rate(wordList, terms) {
  if (wordList.length === 0) return 0;
  const joined = ' ' + wordList.join(' ') + ' ';
  let hits = 0;
  for (const t of terms) {
    const re = new RegExp(`(?<![a-z0-9-])${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![a-z0-9])`, 'g');
    hits += (joined.match(re) || []).length;
  }
  return (hits / wordList.length) * 1000;
}

/**
 * Creation date. NEVER mtime — mtime moves on touch, reformat, or checkout and
 * would silently re-date the whole baseline on any bulk operation.
 *
 * Two legitimate sources, in order:
 *   1. `created_at:` frontmatter (queue items, findings)
 *   2. the file's FIRST-COMMIT date from git
 *
 * (2) satisfies the population rule's intent exactly — it is a creation date, not
 * a modification date — and it is what opens docs/, system/, and .claude/context/
 * to the baseline arm. Without it the baseline caps near 120 blocks, because
 * `created_at` frontmatter exists almost exclusively on artifacts written in the
 * last two weeks, and that cap is what limits the whole study's resolution.
 */
function createdAtFrontmatter(file) {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
  const m = text.match(/^created_at:\s*"?(\d{4}-\d{2}-\d{2})/m);
  return m ? m[1] : null;
}

/** Batch git first-commit dates: one process for the whole corpus, not one per file. */
function gitFirstCommitDates(relPaths) {
  const out = new Map();
  const { execFileSync } = require('node:child_process');
  for (const rel of relPaths) {
    try {
      const res = execFileSync('git',
        ['log', '--diff-filter=A', '--follow', '--format=%ad', '--date=short', '--', rel],
        { cwd: REPO_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      const lines = res.trim().split('\n').filter(Boolean);
      if (lines.length) out.set(rel, lines[lines.length - 1]);
    } catch { /* untracked or unreadable — excluded, not dated by mtime */ }
  }
  return out;
}

function walkDir(dir, exts, acc) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'archive') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walkDir(full, exts, acc);
    else if (exts.some(x => e.name.endsWith(x))) acc.push(full);
  }
}

function collectArtifacts(useGit) {
  const yamlDirs = ['.claude/workstream/queue', '.claude/workstream/findings'];
  const proseDirs = ['docs', 'system', '.claude/context', '.claude/workstream/sessions'];
  const out = [];

  for (const d of yamlDirs) {
    const full = path.join(REPO_ROOT, d);
    let entries;
    try { entries = fs.readdirSync(full); } catch { continue; }
    for (const e of entries) {
      if (!e.endsWith('.yaml')) continue;
      const p = path.join(full, e);
      out.push({ path: p, rel: `${d}/${e}`, created: createdAtFrontmatter(p) });
    }
  }

  if (useGit) {
    const files = [];
    for (const d of proseDirs) walkDir(path.join(REPO_ROOT, d), ['.md'], files);
    const rels = files.map(f => path.relative(REPO_ROOT, f).replace(/\\/g, '/'));
    const dates = gitFirstCommitDates(rels);
    for (let i = 0; i < files.length; i++) {
      out.push({ path: files[i], rel: rels[i], created: dates.get(rels[i]) || null });
    }
    // queue/findings without frontmatter can still be dated by git
    const undated = out.filter(a => !a.created).map(a => a.rel);
    if (undated.length) {
      const more = gitFirstCommitDates(undated);
      for (const a of out) if (!a.created && more.has(a.rel)) a.created = more.get(a.rel);
    }
  }
  return out;
}

function main() {
  const argv = process.argv.slice(2);
  if (argv.includes('--terms')) {
    console.log('TREATMENT (' + TREATMENT.length + '):', TREATMENT.join(', '));
    console.log('CONTROL   (' + CONTROL.length + '):', CONTROL.join(', '));
    return;
  }
  const since = argv[argv.indexOf('--since') + 1] || '0000-00-00';
  const until = argv.includes('--until') ? argv[argv.indexOf('--until') + 1] : '9999-99-99';

  const useGit = !argv.includes('--no-git');
  const all = collectArtifacts(useGit);
  const noDate = all.filter(a => !a.created);
  const inWindow = all.filter(a => a.created && a.created >= since && a.created <= until);

  let tW = 0, cW = 0, totalWords = 0;
  const perArtifact = [];
  for (const a of inWindow) {
    let text;
    try { text = fs.readFileSync(a.path, 'utf8'); } catch { continue; }
    const w = words(text);
    if (w.length < 50) continue;
    const rt = rate(w, TREATMENT), rc = rate(w, CONTROL);
    perArtifact.push({ rel: a.rel, created: a.created, words: w.length, rt, rc, v: rt - rc });
    totalWords += w.length;
  }

  // pooled rates (weight by length — an artifact is not a unit of vocabulary)
  const pooledT = perArtifact.reduce((s, a) => s + a.rt * a.words, 0) / (totalWords || 1);
  const pooledC = perArtifact.reduce((s, a) => s + a.rc * a.words, 0) / (totalWords || 1);

  const vs = perArtifact.map(a => a.v);
  const mu = vs.reduce((a, b) => a + b, 0) / (vs.length || 1);
  const sd = vs.length > 1
    ? Math.sqrt(vs.reduce((s, x) => s + (x - mu) ** 2, 0) / (vs.length - 1)) : 0;

  console.log(`window:            ${since} .. ${until}`);
  console.log(`artifacts scored:  ${perArtifact.length}`);
  console.log(`excluded (no created_at): ${noDate.length}   <-- excluded, NOT dated by mtime`);
  console.log(`total words:       ${totalWords}`);
  console.log('');
  console.log(`pooled treatment rate / 1k words: ${pooledT.toFixed(4)}`);
  console.log(`pooled control   rate / 1k words: ${pooledC.toFixed(4)}`);
  console.log(`pooled V = treatment - control:   ${(pooledT - pooledC).toFixed(4)}`);
  console.log('');
  console.log(`per-artifact V: mean ${mu.toFixed(4)}  SD ${sd.toFixed(4)}  CV ${mu !== 0 ? Math.abs(sd / mu).toFixed(3) : 'n/a'}`);

  for (const rel of [0.5, 0.3, 0.2]) {
    const delta = Math.abs(mu) * rel;
    const n = delta > 0 ? Math.ceil(15.7 * (sd / delta) ** 2) : Infinity;
    console.log(`  detect ${(rel * 100).toFixed(0)}% relative change: ${Number.isFinite(n) ? n : '-'} artifacts per arm`);
  }

  // ---- unit of analysis: the 1,000-WORD BLOCK, not the artifact ----
  // The statistic is defined per 1,000 words, so the artifact was never its
  // natural unit. A 60-word finding and a 4,000-word ticket are not exchangeable
  // draws: the short one produces a wild rate (one term hit = 16/1k) and inflates
  // the variance without carrying information. Blocks are homogeneous by
  // construction. Artifact boundaries are preserved (no block spans two files).
  const BLOCK = 1000;
  const blockVs = [];
  for (const a of inWindow) {
    let text;
    try { text = fs.readFileSync(a.path, 'utf8'); } catch { continue; }
    const w = words(text);
    for (let i = 0; i + BLOCK <= w.length; i += BLOCK) {
      const chunk = w.slice(i, i + BLOCK);
      blockVs.push(rate(chunk, TREATMENT) - rate(chunk, CONTROL));
    }
  }
  if (blockVs.length > 1) {
    const bm = blockVs.reduce((a, b) => a + b, 0) / blockVs.length;
    const bsd = Math.sqrt(blockVs.reduce((s, x) => s + (x - bm) ** 2, 0) / (blockVs.length - 1));
    console.log('');
    console.log(`per-1k-word-block V: n ${blockVs.length}  mean ${bm.toFixed(4)}  SD ${bsd.toFixed(4)}  CV ${bm !== 0 ? Math.abs(bsd / bm).toFixed(3) : 'n/a'}`);
    for (const rel of [0.5, 0.3, 0.2]) {
      const delta = Math.abs(bm) * rel;
      const n = delta > 0 ? Math.ceil(15.7 * (bsd / delta) ** 2) : Infinity;
      console.log(`  detect ${(rel * 100).toFixed(0)}% relative change: ${Number.isFinite(n) ? n : '-'} blocks per arm (${Number.isFinite(n) ? Math.ceil(n / 1) : '-'}k words)`);
    }
  }
}

main();
