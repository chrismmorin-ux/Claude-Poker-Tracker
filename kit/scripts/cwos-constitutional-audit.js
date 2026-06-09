#!/usr/bin/env node
/**
 * cwos-constitutional-audit — Self-audit engine data layer.
 *
 * Scores the CWOS repo against its own constitution (system/intention.md):
 * 3 principles (P1-P3), 1 founder invariant (INV-F1), 10 failed states
 * (#1-#10), plus the 21 system invariants INV-001..INV-021 already
 * covered by cwos-verify.js.
 *
 * Each item carries a detector function. Detectors return:
 *   { status: 'pass' | 'fail' | 'infeasible' | 'no-detector',
 *     evidence: string, severity: 'critical'|'high'|'medium'|'low' }
 *
 * Aggregates into:
 *   compliance_score  = passing / total_items       (headline)
 *   coverage_score    = with_detector / total_items
 *   pass_rate         = passing / with_detector
 *
 * Usage:
 *   node cwos-constitutional-audit.js                  # full run, emit JSON
 *   node cwos-constitutional-audit.js --only P1        # single item
 *   node cwos-constitutional-audit.js --suite principles
 *   node cwos-constitutional-audit.js --persist <run-id> # also write score file + trend
 *
 * The /engine constitutional-audit skill invokes this script and
 * promotes detector output into FIND-*.yaml per the standard engine
 * pipeline (engine.md Step 5).
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { runNode } = require('./lib/shell-safe');
const { tokenize, tokenJaccard, loadCorpus, findRepoRoot, findWorkstreamDir } = require('./lib/cwos-utils');

// ─── Input sanitization (WS-273) ───────────────────────────────────────────
//
// --check-text accepts free-text from sprint goals and item titles. Today
// the matcher is pure token-Jaccard (no AI subagent), but defense-in-depth:
// length-cap + control-char stripping prevent a future AI-using path from
// inheriting injection surface. Inputs over the cap fail closed (exit 2)
// rather than being silently truncated.

const CHECK_TEXT_MAX_LEN = 4096;

function sanitizeCheckText(raw) {
  if (raw == null) raw = '';
  if (typeof raw !== 'string') raw = String(raw);
  if (raw.length > CHECK_TEXT_MAX_LEN) {
    return { ok: false, reason: `input length ${raw.length} exceeds cap ${CHECK_TEXT_MAX_LEN}` };
  }
  // Strip C0 controls except \t (0x09), \n (0x0A), \r (0x0D); also DEL (0x7F).
  const cleaned = raw.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return { ok: true, text: cleaned };
}

function readStdinSync() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// ─── Repo Root Discovery ────────────────────────────────────────────────────

function resolveRepoRoot() {
  // CLAUDE.md is the only marker that ships to both HomeBase and adopted
  // repos. kit/ exists only in HomeBase; requiring it broke the engine
  // in 100% of L4 adoptions (FIND-278 / WS-419).
  const dir = findRepoRoot(process.cwd(), { markers: ['CLAUDE.md'], requireAll: true, maxDepth: 8 });
  if (!fs.existsSync(path.join(dir, 'CLAUDE.md'))) {
    throw new Error('Could not find repo root (CLAUDE.md not found in any ancestor)');
  }
  return dir;
}

const ROOT = resolveRepoRoot();
const rp = (...segments) => path.join(ROOT, ...segments);

// ─── Utility: read file, grep, count ────────────────────────────────────────

function readText(file) {
  try { return fs.readFileSync(rp(file), 'utf8'); } catch { return null; }
}

function fileExists(file) {
  return fs.existsSync(rp(file));
}

function grepInFiles(globDirs, pattern, fileFilter) {
  const regex = new RegExp(pattern, 'm');
  const matches = [];
  for (const dir of globDirs) {
    const full = rp(dir);
    if (!fs.existsSync(full)) continue;
    walk(full, (f) => {
      if (fileFilter && !fileFilter(f)) return;
      try {
        const content = fs.readFileSync(f, 'utf8');
        if (regex.test(content)) matches.push(path.relative(ROOT, f));
      } catch {}
    });
  }
  return matches;
}

function walk(dir, cb) {
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(p, cb);
      else cb(p);
    }
  } catch {}
}

// ─── Phrasing corpus (Jaccard near-miss layer for P2/P3) ────────────────────
//
// WS-226 / FAIL-016: detectP2/detectP3 hardcoded regex patterns miss
// paraphrased violations. The corpus at kit/data/constitutional-detector-corpus.yaml
// supplements regex with token-Jaccard similarity (with stopword removal).
// Founder extensible: add new phrasings as paraphrases are identified.
//
// WS-227: tokenize / tokenJaccard / loadCorpus moved to lib/cwos-utils.js
// so /next Step 4a's anti-goal cross-check (--check-text mode) can share
// the same implementation.

let _corpusCache = null;
function loadAuditCorpus() {
  if (_corpusCache !== null) return _corpusCache;
  _corpusCache = loadCorpus(rp('kit/data/constitutional-detector-corpus.yaml'));
  return _corpusCache;
}

// Returns { matched: bool, phrase: string|null, similarity: number, match_type: 'exact'|'near-match'|'none' }
// Used by P2/P3 detectors to fall through from regex to Jaccard.
//
// Line filter: skip lines that can't carry violation semantics meaningfully —
// markdown code fences, table separators, very short lines. The constraints
// below were tuned against the kit/commands/ surface to suppress false
// positives from "```yaml" and other markdown noise. Token-set size ≥ 3
// after stopword removal is the load-bearing constraint: short corpus
// phrases like "validate the yaml" tokenize to {validate, yaml} and would
// otherwise match any line containing "yaml".
function jaccardScanFile(content, detectorId) {
  const corpus = loadAuditCorpus();
  const det = corpus.detectors[detectorId];
  if (!det || !det.canonical_phrases || det.canonical_phrases.length === 0) {
    return { matched: false, phrase: null, similarity: 0, match_type: 'none' };
  }
  const threshold = det.similarity_threshold;
  const stop = corpus.stopwords;

  // Pre-filter lines to skip markdown noise + content-light lines
  const lines = content.split('\n').filter(l => {
    const t = l.trim();
    if (t.length < 15) return false;                        // too short to carry a sentence
    if (/^```/.test(t)) return false;                       // code fence
    if (/^[|+\-=:]+$/.test(t)) return false;                // table separator
    if (/^#{1,6}\s/.test(t)) return false;                  // heading
    if (/^[-*+]\s+/.test(t) && t.length < 40) return false; // short bullet
    return true;
  });

  let bestSim = 0;
  let bestPhrase = null;
  let bestLine = null;
  for (const line of lines) {
    const lineTokens = tokenize(line, stop);
    // Require enough discriminating tokens in the input line to avoid
    // 2-token corpus phrases trivially matching.
    if (lineTokens.size < 3) continue;
    for (const phrase of det.canonical_phrases) {
      const sim = tokenJaccard(line, phrase, stop);
      if (sim > bestSim) {
        bestSim = sim;
        bestPhrase = phrase;
        bestLine = line.trim().slice(0, 80);
      }
    }
  }
  if (bestSim >= threshold) {
    return { matched: true, phrase: bestPhrase, similarity: bestSim, match_type: 'near-match', line: bestLine };
  }
  return { matched: false, phrase: bestPhrase, similarity: bestSim, match_type: 'none' };
}

// ─── Detector: INV-F1 (No Unnecessary Burden) ───────────────────────────────

function detectInvF1() {
  // Proxy: burden manifests as low-relevance components. Run component-alignment
  // or reuse its last-run output. For MVP: check if any installed engines map
  // to repo_goal. HomeBase uses CLAUDE.md declared purpose.
  const claude = readText('CLAUDE.md');
  if (!claude) return noDetector('CLAUDE.md missing — cannot check goal-alignment');
  const hasPurpose = /## Purpose|product repo for CWOS/i.test(claude);
  if (!hasPurpose) return {
    status: 'fail', severity: 'high',
    evidence: 'CLAUDE.md has no Purpose section — cannot enforce proportional-value rule on components',
  };
  // Count active programs without recent protocol runs — a proxy for ceremony-without-work
  const registry = readText('.claude/workstream/programs/registry.yaml');
  if (!registry) return noDetector('programs/registry.yaml missing');
  const activeCount = (registry.match(/tier:\s*(watch|active|critical)/g) || []).length;
  if (activeCount === 0) return {
    status: 'fail', severity: 'high',
    evidence: 'Zero active programs — either under-instrumented or over-instrumented; cannot judge burden ratio',
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `CLAUDE.md declares purpose; ${activeCount} active programs — proxy burden signal within expected range`,
  };
}

// ─── Detector: P1 (The Repo's Goal Is Supreme) ──────────────────────────────

function detectP1() {
  const onboarding = readText('.cwos-onboarding.yaml');
  const claude = readText('CLAUDE.md');
  // HomeBase has no .cwos-onboarding.yaml (self-hosting). Fall back to CLAUDE.md purpose.
  const hasGoal = (onboarding && /repo_goal:\s*\S+/.test(onboarding)) ||
                  (claude && /## Purpose|product repo for CWOS/i.test(claude));
  if (!hasGoal) return {
    status: 'fail', severity: 'critical',
    evidence: 'No repo_goal in .cwos-onboarding.yaml and no Purpose in CLAUDE.md',
  };
  // Check for a program scoped to goal advancement
  const programsDir = rp('.claude/workstream/programs');
  if (!fs.existsSync(programsDir)) return {
    status: 'fail', severity: 'high',
    evidence: 'No programs directory — cannot check goal-scoped program',
  };
  const progFiles = fs.readdirSync(programsDir).filter(f => f.startsWith('prog-') && f.endsWith('.yaml') && f !== 'prog-template.yaml');
  let goalScoped = 0;
  for (const f of progFiles) {
    const text = fs.readFileSync(path.join(programsDir, f), 'utf8');
    if (/goal|purpose|adopt|product/i.test(text)) goalScoped++;
  }
  if (goalScoped === 0) return {
    status: 'fail', severity: 'high',
    evidence: `${progFiles.length} programs exist but none reference the repo goal in contract/scope`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `Repo goal declared; ${goalScoped}/${progFiles.length} programs reference goal-advancement concepts`,
  };
}

// ─── Detector: P2 (Non-Technical Founders Not Asked to Be Technical) ───────

function detectP2() {
  const techPatterns = [
    /confirm\s+(the\s+)?schema/i,
    /validate\s+(the\s+)?yaml/i,
    /resolve\s+agent\s+disagreement/i,
    /debug\s+(the\s+)?(config|yaml)/i,
    /fix\s+the\s+json\s+(parse|syntax)/i,
  ];
  const offenders = [];        // exact-regex matches
  const nearMatches = [];      // Jaccard near-miss matches (WS-226)
  walk(rp('kit/commands'), (f) => {
    if (!f.endsWith('.md')) return;
    try {
      const content = fs.readFileSync(f, 'utf8');
      let regexHit = false;
      for (const pat of techPatterns) {
        if (pat.test(content)) {
          offenders.push(`${path.relative(ROOT, f)} matches ${pat.source}`);
          regexHit = true;
          break;
        }
      }
      // If regex didn't match, fall through to Jaccard near-miss layer
      if (!regexHit) {
        const r = jaccardScanFile(content, 'P2');
        if (r.matched) {
          nearMatches.push(`${path.relative(ROOT, f)} ≈"${r.phrase}" (sim=${r.similarity.toFixed(2)}, line="${r.line}")`);
        }
      }
    } catch {}
  });
  if (offenders.length > 0 || nearMatches.length > 0) {
    const parts = [];
    if (offenders.length > 0) parts.push(`${offenders.length} regex-exact: ${offenders.slice(0, 2).join('; ')}`);
    if (nearMatches.length > 0) parts.push(`${nearMatches.length} near-match: ${nearMatches.slice(0, 2).join('; ')}`);
    return {
      status: 'fail',
      severity: offenders.length > 0 ? 'high' : 'medium',
      evidence: `${offenders.length + nearMatches.length} command(s) ask for technical judgment — ${parts.join(' | ')}`,
      match_type: offenders.length > 0 ? (nearMatches.length > 0 ? 'mixed' : 'exact') : 'near-match',
    };
  }
  return {
    status: 'pass', severity: 'low',
    evidence: 'No kit commands ask founder to validate schemas, debug YAML, or resolve agent conflicts (regex + Jaccard near-miss layer both clean)',
    match_type: 'none',
  };
}

// ─── Detector: P3 (Progressive Over Prescriptive) ──────────────────────────

function detectP3() {
  // Hard-block patterns signal prescriptive UX
  const blockPatterns = [
    /must\s+configure\s+\w+\s+(first|before)/i,
    /you\s+must\s+complete\s+M\d/i,
    /STOP.*configure\s+before/i,
    /cannot\s+proceed\s+until\s+M\d/i,
  ];
  const offenders = [];
  const nearMatches = [];
  walk(rp('kit/commands'), (f) => {
    if (!f.endsWith('.md')) return;
    try {
      const content = fs.readFileSync(f, 'utf8');
      let regexHit = false;
      for (const pat of blockPatterns) {
        if (pat.test(content)) {
          offenders.push(`${path.relative(ROOT, f)} matches ${pat.source}`);
          regexHit = true;
          break;
        }
      }
      if (!regexHit) {
        const r = jaccardScanFile(content, 'P3');
        if (r.matched) {
          nearMatches.push(`${path.relative(ROOT, f)} ≈"${r.phrase}" (sim=${r.similarity.toFixed(2)}, line="${r.line}")`);
        }
      }
    } catch {}
  });
  if (offenders.length > 0 || nearMatches.length > 0) {
    const parts = [];
    if (offenders.length > 0) parts.push(`${offenders.length} regex-exact: ${offenders.slice(0, 2).join('; ')}`);
    if (nearMatches.length > 0) parts.push(`${nearMatches.length} near-match: ${nearMatches.slice(0, 2).join('; ')}`);
    return {
      status: 'fail',
      severity: 'medium',
      evidence: `${offenders.length + nearMatches.length} command(s) have hard-block prescriptive patterns — ${parts.join(' | ')}`,
      match_type: offenders.length > 0 ? (nearMatches.length > 0 ? 'mixed' : 'exact') : 'near-match',
    };
  }
  return {
    status: 'pass', severity: 'low',
    evidence: 'No kit commands hard-block on milestone/configuration completion (regex + Jaccard near-miss layer both clean)',
    match_type: 'none',
  };
}

// ─── Detector: Failed state #1 (Ceremony theater) ──────────────────────────

function detectFS1() {
  // Proxy: were /session-start / /status / /pulse invocations followed by
  // concrete work-item advancement? Inspect recent sprints — if sprints
  // exist with items_done > 0, rituals translated into action.
  //
  // kit-v3.7.0: require ≥5 recent sprints before scoring. Pre-3.7.0 a fresh
  // adopted repo (zero sprints) was scored with ratio 0/0 = 0.00, which
  // tripped the < 0.40 threshold and surfaced a high-severity "ceremony
  // theater" failure. False positive — there's no ceremony to have
  // theater AROUND when no sprints have run. Now: insufficient sprints
  // → no-detector. Threshold is conservative: 5 sprints corresponds to
  // ~2-3 weeks of regular session use at typical cadence.
  const MIN_SPRINTS_FOR_SCORING = 5;
  const index = readText('.claude/workstream/sprint-index.yaml');
  if (!index) return noDetector('sprint-index.yaml missing');
  // Count last 5 sprints; ratio of those with items_done > 0
  const sprintBlocks = index.split(/\n(?=\s*-\s*id:)/).filter(b => /items_done:\s*\d+/.test(b));
  if (sprintBlocks.length < MIN_SPRINTS_FOR_SCORING) {
    return {
      status: 'no-detector', severity: 'low',
      evidence: `Only ${sprintBlocks.length} sprint(s) with recorded items_done; need ≥${MIN_SPRINTS_FOR_SCORING} for ceremony-theater scoring. Re-evaluate after more sprint history accumulates.`,
    };
  }
  const recent = sprintBlocks.slice(-5);
  const withAction = recent.filter(b => /items_done:\s*[1-9]/.test(b)).length;
  const ratio = recent.length === 0 ? 0 : withAction / recent.length;
  if (ratio < 0.4) return {
    status: 'fail', severity: 'high',
    evidence: `Only ${withAction}/${recent.length} recent sprints translated ritual into item completion (ratio ${ratio.toFixed(2)} < 0.40)`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `${withAction}/${recent.length} recent sprints completed items (ratio ${ratio.toFixed(2)}) — rituals drove action`,
  };
}

// ─── Detector: Failed state #2 (Tool-shaped hammer) ────────────────────────

function detectFS2() {
  // Reuse INV-F1's burden proxy but sharpen: check /adopt recent runs or
  // component-alignment last-run results. Since component-alignment just
  // shipped (SPR-069), look for its output under runs/.
  const runsDir = rp('.claude/workstream/runs');
  if (!fs.existsSync(runsDir)) return noDetector('runs/ directory missing');
  const caRuns = fs.readdirSync(runsDir).filter(d => d.startsWith('run-component-alignment'));
  if (caRuns.length === 0) return {
    status: 'infeasible', severity: 'low',
    evidence: 'component-alignment engine has never run — cannot quantify tool-shaped-hammer risk (run /engine component-alignment to populate signal)',
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `component-alignment engine has ${caRuns.length} run(s); latest-run review needed to surface any low-relevance installs (automated threshold check deferred to detector v2)`,
  };
}

// ─── Detector: Failed state #3 (Compliance over value) ─────────────────────

function detectFS3() {
  // HomeBase is self-hosting, not an adopted repo; skip the L5-without-value check.
  const onboarding = readText('.cwos-onboarding.yaml');
  if (!onboarding) return {
    status: 'infeasible', severity: 'low',
    evidence: 'HomeBase has no .cwos-onboarding.yaml (self-hosting repo). This detector fires on adopted repos where capabilities_enabled ≥ 3 AND goal-advancement ratio < 0.25.',
  };
  return noDetector('goal-progress engine not yet run; adoption-level unknown');
}

// ─── Detector: Failed state #4 (Fleet as lock-in) ──────────────────────────

function detectFS4() {
  const registry = readText('fleet/registry.yaml');
  if (!registry) return noDetector('fleet/registry.yaml missing');
  // Parse: repos with last_session_date > 90 days ago AND still in fleet
  const today = new Date('2026-04-24');
  const dateMatches = [...registry.matchAll(/last_session_date:\s*"?(\d{4}-\d{2}-\d{2})"?/g)];
  if (dateMatches.length === 0) return {
    status: 'pass', severity: 'low',
    evidence: 'Fleet registry has no last_session_date entries populated — no dormant lock-in detectable (only SYN adopted so far)',
  };
  const stale = dateMatches.filter(m => {
    const d = new Date(m[1]);
    return (today - d) / (1000 * 60 * 60 * 24) > 90;
  });
  if (stale.length > 0) return {
    status: 'fail', severity: 'medium',
    evidence: `${stale.length} fleet repo(s) dormant >90 days but still tier-critical`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `${dateMatches.length} fleet repo(s), none dormant >90 days`,
  };
}

// ─── Detector: Failed state #5 (AI-session dependency) ─────────────────────

function detectFS5() {
  // Founder-facing file legibility: state.md, intention.md, top backlog item
  const checks = [
    { path: 'system/state.md', label: 'state.md' },
    { path: 'system/intention.md', label: 'intention.md' },
  ];
  const failures = [];
  for (const c of checks) {
    const content = readText(c.path);
    if (!content) { failures.push(`${c.label} missing`); continue; }
    if (!/^#\s+/m.test(content)) failures.push(`${c.label} has no top-level heading`);
    // Jargon markers that suggest files are AI-conversation-dependent
    if (/\brun-\d+\.yaml\b|\bev-\d+[a-z0-9-]+\b/.test(content.slice(0, 2000))) {
      failures.push(`${c.label} leads with runtime-ID jargon in first 2KB`);
    }
  }
  if (failures.length > 0) return {
    status: 'fail', severity: 'medium',
    evidence: `Founder-facing files fail standalone-legibility checks: ${failures.join('; ')}`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `Founder-facing files (${checks.map(c => c.label).join(', ')}) are standalone-legible`,
  };
}

// ─── Detector: Failed state #6 (Founder becomes CWOS operator) ─────────────

function detectFS6() {
  // Ratio of program-maintenance work items vs product-advancing in recent backlog
  const queue = readText('.claude/workstream/queue-index.yaml');
  if (!queue) return noDetector('queue-index.yaml missing');
  const items = [...queue.matchAll(/-\s+id:.*?(?=\n-|\n*$)/gs)].slice(-20);
  if (items.length < 10) return {
    status: 'infeasible', severity: 'low',
    evidence: `Only ${items.length} items in queue — need ≥10 for ratio signal`,
  };
  const maintenance = items.filter(m => /category:\s*(program-maintenance|engines|fleet)\b/.test(m[0])).length;
  const ratio = maintenance / items.length;
  if (ratio > 0.5) return {
    status: 'fail', severity: 'high',
    evidence: `${maintenance}/${items.length} recent items are CWOS-maintenance (ratio ${ratio.toFixed(2)} > 0.50) — founder feeds CWOS more than product`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `${maintenance}/${items.length} recent items are maintenance (ratio ${ratio.toFixed(2)} ≤ 0.50)`,
  };
}

// ─── Detector: Failed state #7 (Findings noise) ────────────────────────────

function detectFS7() {
  // Scan runs/ for any run in last 30 days producing ≥15 findings
  const runsDir = rp('.claude/workstream/runs');
  if (!fs.existsSync(runsDir)) return noDetector('runs/ missing');
  const today = new Date('2026-04-24');
  const offenders = [];
  for (const d of fs.readdirSync(runsDir)) {
    const manifestPath = path.join(runsDir, d, 'manifest.yaml');
    if (!fs.existsSync(manifestPath)) continue;
    const m = fs.readFileSync(manifestPath, 'utf8');
    const dateMatch = m.match(/started_at:\s*"?(\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) continue;
    const age = (today - new Date(dateMatch[1])) / (1000 * 60 * 60 * 24);
    if (age > 30) continue;
    const fMatch = m.match(/findings_count:\s*(\d+)/);
    if (fMatch && parseInt(fMatch[1], 10) >= 15) {
      offenders.push(`${d}: ${fMatch[1]} findings`);
    }
  }
  if (offenders.length > 0) return {
    status: 'fail', severity: 'medium',
    evidence: `${offenders.length} run(s) in last 30d produced ≥15 findings: ${offenders.slice(0, 3).join('; ')}`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: 'No engine runs in last 30 days produced ≥15 findings — finding_cap is holding',
  };
}

// ─── Detector: Failed state #8 (Silent drift between kit and fleet) ────────

function detectFS8() {
  const version = readText('kit/VERSION');
  if (!version) return noDetector('kit/VERSION missing');
  const currentVersion = version.trim();
  const registry = readText('fleet/registry.yaml');
  if (!registry) return noDetector('fleet/registry.yaml missing');
  // TODO (WS-406 follow-up): kit_version in fleet/registry.yaml is deprecated as
  // a cache. This detector still works against existing entries that carry the
  // field, but should be migrated to read each repo's .cwos-version directly.
  const kvMatches = [...registry.matchAll(/kit_version:\s*"?([\d.]+)"?/g)];
  if (kvMatches.length === 0) return {
    status: 'pass', severity: 'low',
    evidence: `Kit at v${currentVersion}; no adopted repos have kit_version field populated yet (only SYN adopted)`,
  };
  const currentMajor = parseInt(currentVersion.split('.')[0], 10);
  const stale = kvMatches.filter(m => currentMajor - parseInt(m[1].split('.')[0], 10) >= 2);
  if (stale.length > 0) return {
    status: 'fail', severity: 'high',
    evidence: `${stale.length} adopted repo(s) are ≥2 major kit versions behind v${currentVersion}`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `Kit at v${currentVersion}; ${kvMatches.length} adopted repo(s) all within 1 major version`,
  };
}

// ─── Detector: Failed state #9 (same as P2) ────────────────────────────────

function detectFS9() {
  const result = detectP2();
  return { ...result, evidence: `[shared detector with P2] ${result.evidence}` };
}

// ─── Detector: Failed state #10 (Self-aggrandizing complexity) ─────────────

function detectFS10() {
  // For each active program, check if it has a contract referencing intention.md
  const programsDir = rp('.claude/workstream/programs');
  if (!fs.existsSync(programsDir)) return noDetector('programs/ missing');
  const progFiles = fs.readdirSync(programsDir).filter(f =>
    f.startsWith('prog-') && f.endsWith('.yaml') && f !== 'prog-template.yaml');
  const orphans = [];
  for (const f of progFiles) {
    const text = fs.readFileSync(path.join(programsDir, f), 'utf8');
    const hasContract = /\b(contract|rationale|purpose):/i.test(text);
    const referencesIntention = /intention\.md|failed\s*state|principle|invariant/i.test(text);
    if (!hasContract || !referencesIntention) orphans.push(f);
  }
  if (orphans.length >= 2) return {
    status: 'fail', severity: 'high',
    evidence: `${orphans.length} programs lack contract OR fail to trace to intention.md: ${orphans.slice(0, 4).join(', ')}`,
  };
  if (orphans.length === 1) return {
    status: 'fail', severity: 'medium',
    evidence: `1 program lacks traceable contract: ${orphans[0]}`,
  };
  return {
    status: 'pass', severity: 'low',
    evidence: `All ${progFiles.length} programs have contract + trace to intention.md concepts`,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function noDetector(reason) {
  return { status: 'no-detector', severity: 'low', evidence: reason };
}

// ─── Registry ──────────────────────────────────────────────────────────────
//
// `homebase_only: true` marks detectors that depend on HomeBase-internal
// surfaces (fleet/registry.yaml, kit/VERSION, component-alignment runs)
// and are not meaningful in adopted repos. When this audit runs in an
// adopted-repo context, those detectors return status: 'skipped' and are
// excluded from every denominator (compliance / coverage / pass-rate).
// kit-v3.6.1: introduced as part of the Bug 3 plumbing fix — before this
// flag, FS-4 / FS-7 / FS-8 surfaced as no-detector noise in adopted-repo
// runs and contaminated the trend file with phantom failures.
//
// FS-2 is also flagged because the component-alignment engine it scores
// against is HomeBase-only; an adopted repo never runs it.

const REGISTRY = {
  'INV-F1': { title: "No Unnecessary Burden", suite: 'founder-invariants', detect: detectInvF1 },
  'P1':     { title: "The Repo's Goal Is Supreme", suite: 'principles', detect: detectP1 },
  'P2':     { title: "Non-Technical Founders Not Asked to Be Technical", suite: 'principles', detect: detectP2 },
  'P3':     { title: "Progressive Over Prescriptive", suite: 'principles', detect: detectP3 },
  'FS-1':   { title: "Ceremony theater", suite: 'failed-states', detect: detectFS1 },
  'FS-2':   { title: "Tool-shaped hammer", suite: 'failed-states', detect: detectFS2, homebase_only: true },
  'FS-3':   { title: "Compliance over value", suite: 'failed-states', detect: detectFS3 },
  'FS-4':   { title: "Fleet as lock-in", suite: 'failed-states', detect: detectFS4, homebase_only: true },
  'FS-5':   { title: "AI-session dependency", suite: 'failed-states', detect: detectFS5 },
  'FS-6':   { title: "Founder becomes CWOS operator", suite: 'failed-states', detect: detectFS6 },
  'FS-7':   { title: "Findings noise", suite: 'failed-states', detect: detectFS7 },
  'FS-8':   { title: "Silent drift between kit and fleet", suite: 'failed-states', detect: detectFS8, homebase_only: true },
  'FS-9':   { title: "Non-technical founder asked to be technical", suite: 'failed-states', detect: detectFS9 },
  'FS-10':  { title: "Self-aggrandizing complexity", suite: 'failed-states', detect: detectFS10 },
};

// Context detection: an adopted repo carries .cwos-onboarding.yaml and
// does NOT carry kit/MANIFEST.yaml (HomeBase's distinguishing marker).
// We cache the result because runAudit may be called multiple times in
// one process (e.g., during test harness invocations).
let _isAdoptedRepoCache = null;
function isAdoptedRepoContext() {
  if (_isAdoptedRepoCache !== null) return _isAdoptedRepoCache;
  const hasOnboarding = fileExists('.cwos-onboarding.yaml');
  const hasManifest = fileExists('kit/MANIFEST.yaml');
  _isAdoptedRepoCache = hasOnboarding && !hasManifest;
  return _isAdoptedRepoCache;
}

function skippedHomebaseOnly() {
  return {
    status: 'skipped',
    severity: 'low',
    evidence: 'HomeBase-only detector — depends on fleet/registry.yaml, kit/VERSION, or a HomeBase-only engine. Not applicable in adopted repos; excluded from compliance + coverage denominators.',
    applicable_to_adopted_repos: false,
  };
}

// ─── Finding promotion (Bug 3 / kit-v3.6.1) ────────────────────────────────
//
// The engine markdown `engines/standard/constitutional-audit.md` declares:
//
//   "creates findings for failures and uncovered items, and appends to a
//   long-running trend file"
//
// Until kit-v3.6.1 the script honored the trend half but skipped the finding
// half entirely — runAudit returned JSON, the AI orchestrator was supposed
// to hand-format YAML, and in practice no FIND-NNN.yaml ever landed in
// adopted repos. /next gate passed against an empty queue and the audit
// produced no actionable state.
//
// Promotion rules (mirror engine markdown):
//   - For each item with status ∈ {fail, infeasible, no-detector},
//     create or update FIND-CA-<item-id>.yaml.
//   - `skipped` items (homebase_only in adopted repo) never produce
//     findings — they're not constitution failures.
//   - status: pass never produces a finding.
//   - dedup_key: constitutional-audit-<item-id>-<status>. When the same
//     dedup_key already exists with status: open, UPDATE the existing
//     finding (preserves history); otherwise create new.

const FINDING_DIR_PARTS = ['.claude', 'workstream', 'findings'];

function writeFindings(result, runId) {
  const findingsDir = path.join(ROOT, ...FINDING_DIR_PARTS);
  if (!fs.existsSync(findingsDir)) {
    return { ok: false, reason: 'findings_dir_missing', dir: findingsDir, written: [], updated: [] };
  }

  const written = [];
  const updated = [];
  const skipped = [];

  for (const item of result.items) {
    const decision = decideFindingFromAuditItem(item);
    if (!decision.shouldWrite) { skipped.push({ id: item.id, reason: decision.reason }); continue; }

    const findingId = `FIND-CA-${item.id}`;
    const findingPath = path.join(findingsDir, `${findingId}.yaml`);
    const payload = buildFindingPayload(findingId, item, decision, runId, result.run_timestamp);

    if (fs.existsSync(findingPath)) {
      const existing = fs.readFileSync(findingPath, 'utf8');
      if (/^status:\s*resolved\b/m.test(existing)) {
        const resurfacedId = `${findingId}-resurfaced-${result.run_timestamp.slice(0, 10).replace(/-/g, '')}`;
        const resurfacedPath = path.join(findingsDir, `${resurfacedId}.yaml`);
        fs.writeFileSync(resurfacedPath, serializeFinding(buildFindingPayload(resurfacedId, item, decision, runId, result.run_timestamp)));
        written.push(resurfacedId);
      } else {
        fs.writeFileSync(findingPath, serializeFinding(payload));
        updated.push(findingId);
      }
    } else {
      fs.writeFileSync(findingPath, serializeFinding(payload));
      written.push(findingId);
    }
  }
  return { ok: true, written, updated, skipped };
}

function decideFindingFromAuditItem(item) {
  if (item.status === 'pass') return { shouldWrite: false, reason: 'pass' };
  if (item.status === 'skipped') return { shouldWrite: false, reason: 'skipped_homebase_only' };

  let severity = item.severity || 'low';
  let priority = 20;
  let recommendedAction = '';

  if (item.status === 'fail') {
    if (severity === 'critical') { priority = 70; recommendedAction = `Fix now — run \`node kit/scripts/cwos-constitutional-audit.js --only ${item.id}\` to re-verify after fix`; }
    else if (severity === 'high') { priority = 55; recommendedAction = `Fix now — run \`node kit/scripts/cwos-constitutional-audit.js --only ${item.id}\` to re-verify after fix`; }
    else if (severity === 'medium') { priority = 40; recommendedAction = 'Fix or defer to next sprint; schedule the fix'; }
    else { priority = 20; recommendedAction = 'Low-severity violation; address opportunistically'; }
  } else if (item.status === 'infeasible') {
    severity = 'low';
    priority = 20;
    recommendedAction = `Build detector — see kit/scripts/cwos-constitutional-audit.js \`detect${item.id.replace(/-/g, '')}()\` for the current implementation + rationale`;
  } else if (item.status === 'no-detector') {
    severity = 'low';
    priority = 20;
    recommendedAction = `Design detector for ${item.id} — currently unscored`;
  } else {
    return { shouldWrite: false, reason: `unknown_status:${item.status}` };
  }

  const wouldPromote = severity === 'critical' || severity === 'high';
  return { shouldWrite: true, severity, priority, recommendedAction, wouldPromote };
}

function buildFindingPayload(findingId, item, decision, runId, runTimestamp) {
  const titleStatus = item.status.toUpperCase();
  return {
    id: findingId,
    title: `${titleStatus}: ${item.id} — ${item.title}`,
    engine: 'constitutional-audit',
    persona: 'constitutional-audit',
    run_id: runId,
    date: (runTimestamp || new Date().toISOString()).slice(0, 10),
    severity: decision.severity,
    priority_score: decision.priority,
    category: 'self-compliance',
    description: item.evidence || '(no evidence)',
    recommended_action: decision.recommendedAction,
    files_involved: [],
    dedup_key: `constitutional-audit-${item.id}-${item.status}`,
    status: 'open',
    promoted_to: '',
    program: 'kit-quality',
    source: { engine: 'constitutional-audit', run_id: runId, audit_item: item.id, audit_status: item.status },
    proposed_route: { would_promote_to_queue: decision.wouldPromote },
  };
}

function serializeFinding(payload) {
  const lines = [];
  lines.push(`id: "${payload.id}"`);
  lines.push(`title: ${yamlEscape(payload.title)}`);
  lines.push(`engine: ${payload.engine}`);
  lines.push(`persona: ${payload.persona}`);
  lines.push(`run_id: "${payload.run_id}"`);
  lines.push(`date: "${payload.date}"`);
  lines.push(`severity: ${payload.severity}`);
  lines.push(`priority_score: ${payload.priority_score}`);
  lines.push(`category: ${payload.category}`);
  lines.push(`description: ${yamlEscape(payload.description)}`);
  lines.push(`recommended_action: ${yamlEscape(payload.recommended_action)}`);
  lines.push(`files_involved: []`);
  lines.push(`dedup_key: ${yamlEscape(payload.dedup_key)}`);
  lines.push(`status: ${payload.status}`);
  lines.push(`promoted_to: "${payload.promoted_to}"`);
  lines.push(`program: ${payload.program}`);
  lines.push(`source:`);
  lines.push(`  engine: ${payload.source.engine}`);
  lines.push(`  run_id: "${payload.source.run_id}"`);
  lines.push(`  audit_item: "${payload.source.audit_item}"`);
  lines.push(`  audit_status: ${payload.source.audit_status}`);
  lines.push(`proposed_route:`);
  lines.push(`  would_promote_to_queue: ${payload.proposed_route.would_promote_to_queue}`);
  return lines.join('\n') + '\n';
}

// ─── System-invariants suite — delegate to cwos-verify ─────────────────────

function runSystemInvariants() {
  try {
    const r = runNode(path.join(ROOT, 'kit/scripts/cwos-verify.js'), ['--json'], {
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    if (!r.ok) return [];
    const parsed = JSON.parse(r.stdout);
    // Expected shape: { checks: [ { id, status } ] }
    const items = (parsed.checks || []).map(c => ({
      id: c.id,
      title: c.title || c.id,
      suite: 'system-invariants',
      status: c.status === 'pass' ? 'pass' : c.status === 'fail' ? 'fail' : 'no-detector',
      severity: c.severity || (c.status === 'fail' ? 'high' : 'low'),
      evidence: c.evidence || c.message || '',
    }));
    return items;
  } catch {
    // cwos-verify.js may not support --json yet. Mark suite as infeasible
    // for MVP — this can be improved later by extending cwos-verify.
    return [{
      id: 'SYS-INV-all',
      title: 'System invariants (delegated to cwos-verify)',
      suite: 'system-invariants',
      status: 'infeasible',
      severity: 'low',
      evidence: 'cwos-verify.js does not yet support --json output; detector deferred. Run `node kit/scripts/cwos-verify.js` directly for now.',
    }];
  }
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

function runAudit(opts = {}) {
  const adopted = isAdoptedRepoContext();
  const results = [];
  for (const [id, spec] of Object.entries(REGISTRY)) {
    if (opts.only && opts.only !== id) continue;
    if (opts.suite && opts.suite !== spec.suite) continue;
    let detector;
    if (spec.homebase_only && adopted) {
      detector = skippedHomebaseOnly();
    } else {
      try { detector = spec.detect(); }
      catch (e) { detector = { status: 'no-detector', severity: 'low', evidence: `Detector threw: ${e.message}` }; }
    }
    results.push({ id, title: spec.title, suite: spec.suite, ...detector });
  }
  if (!opts.only && (!opts.suite || opts.suite === 'system-invariants')) {
    results.push(...runSystemInvariants());
  }

  // Skipped items are excluded from every denominator — they describe
  // detector applicability, not constitution compliance.
  const scorable = results.filter(r => r.status !== 'skipped');
  const total = scorable.length;
  const withDetector = scorable.filter(r => r.status !== 'no-detector' && r.status !== 'infeasible').length;
  const passing = scorable.filter(r => r.status === 'pass').length;
  const compliance_score = total === 0 ? 0 : passing / total;
  const coverage_score = total === 0 ? 0 : withDetector / total;
  const pass_rate = withDetector === 0 ? 0 : passing / withDetector;

  const by_suite = {};
  for (const r of results) {
    by_suite[r.suite] = by_suite[r.suite] || { total: 0, passing: 0, failing: 0, infeasible: 0, no_detector: 0, skipped: 0 };
    by_suite[r.suite].total++;
    if (r.status === 'pass') by_suite[r.suite].passing++;
    else if (r.status === 'fail') by_suite[r.suite].failing++;
    else if (r.status === 'infeasible') by_suite[r.suite].infeasible++;
    else if (r.status === 'skipped') by_suite[r.suite].skipped++;
    else by_suite[r.suite].no_detector++;
  }

  return {
    schema_version: 2,
    run_timestamp: new Date().toISOString(),
    repo_context: adopted ? 'adopted' : 'homebase',
    compliance_score: round2(compliance_score),
    coverage_score: round2(coverage_score),
    pass_rate: round2(pass_rate),
    total_items: total,
    items_with_detector: withDetector,
    items_passing: passing,
    items_skipped: results.length - total,
    by_suite,
    items: results,
  };
}

function round2(n) { return Math.round(n * 100) / 100; }

// ─── CLI ────────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const opts = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--only') opts.only = args[++i];
    else if (args[i] === '--suite') opts.suite = args[++i];
    else if (args[i] === '--persist') opts.persist = args[++i] || 'run-constitutional-audit-latest';
    else if (args[i] === '--json') opts.json = true;
    else if (args[i] === '--write-findings') opts.writeFindings = true;
    else if (args[i] === '--no-write-findings') opts.writeFindings = false;
    else if (args[i] === '--check-text') opts.checkText = args[++i];
    else if (args[i] === '--check-text-file') opts.checkTextFile = args[++i];
    else if (args[i] === '--check-text-stdin') opts.checkTextStdin = true;
  }
  // --persist implies --write-findings unless the caller passed
  // --no-write-findings. Bug 3 / kit-v3.6.1: previously the engine markdown
  // contract said "creates findings for failures" but no code actually
  // wrote FIND-NNN.yaml files. /next gate passed against an empty queue.
  if (opts.persist && opts.writeFindings === undefined) {
    opts.writeFindings = true;
  }
  // Resolve check-text source. File and stdin paths exist so callers can
  // pass untrusted text without it ever appearing on the command line.
  if (opts.checkText === undefined) {
    if (opts.checkTextFile) {
      try {
        opts.checkText = fs.readFileSync(opts.checkTextFile, 'utf8');
      } catch (e) {
        console.error(`cwos-constitutional-audit: cannot read --check-text-file ${opts.checkTextFile}: ${e.message}`);
        process.exit(2);
      }
    } else if (opts.checkTextStdin) {
      opts.checkText = readStdinSync();
    }
  }
  if (opts.checkText !== undefined) {
    const sanitized = sanitizeCheckText(opts.checkText);
    if (!sanitized.ok) {
      console.error(`cwos-constitutional-audit: ${sanitized.reason}`);
      process.exit(2);
    }
    opts.checkText = sanitized.text;
  }
  // WS-227: --check-text mode for /next Step 4a anti-goal cross-check.
  // Reads anti_goals + failed_states sections of the corpus, runs both
  // token-Jaccard AND phrase-coverage against the input text. Phrase-coverage
  // (|input ∩ phrase| / |phrase|) catches cases where the input is a longer
  // sentence that contains the corpus phrase but Jaccard would dilute below
  // threshold. Exit 0 if no matches; exit 1 if any match clears either
  // metric's threshold.
  if (opts.checkText !== undefined) {
    const corpus = loadAuditCorpus();
    const stop = corpus.stopwords;
    const inputTokens = tokenize(opts.checkText, stop);
    const matches = [];
    const scopes = [
      { key: 'anti_goals', label: 'anti-goal' },
      { key: 'failed_states', label: 'failed-state' },
    ];
    // Phrase-coverage threshold: a corpus phrase counts as "found in input" if
    // ≥70% of its tokens appear in the input. Tighter than Jaccard threshold
    // because we're asserting containment, not similarity. Adjust if AS-700
    // quarterly seeding shows under-firing.
    const COVERAGE_THRESHOLD = 0.70;
    for (const scope of scopes) {
      const block = corpus[scope.key];
      if (!block || !Array.isArray(block.canonical_phrases)) continue;
      const jaccardThreshold = block.similarity_threshold;
      for (const phrase of block.canonical_phrases) {
        const phraseTokens = tokenize(phrase, stop);
        if (phraseTokens.size === 0) continue;
        // Metric A: symmetric Jaccard (matches when input + phrase are similar)
        const sim = tokenJaccard(opts.checkText, phrase, stop);
        // Metric B: phrase coverage (matches when input contains most of phrase)
        let inter = 0;
        for (const t of phraseTokens) if (inputTokens.has(t)) inter++;
        const coverage = inter / phraseTokens.size;
        const matchedBy = sim >= jaccardThreshold
          ? 'jaccard'
          : (coverage >= COVERAGE_THRESHOLD ? 'phrase-coverage' : null);
        if (matchedBy) {
          matches.push({
            corpus: scope.key,
            label: scope.label,
            phrase,
            similarity: Math.round(sim * 100) / 100,
            coverage: Math.round(coverage * 100) / 100,
            matched_by: matchedBy,
            jaccard_threshold: jaccardThreshold,
            coverage_threshold: COVERAGE_THRESHOLD,
          });
        }
      }
    }
    // Keep only the strongest match per corpus to avoid flooding output.
    // Sort key: prefer higher coverage, break ties on similarity.
    const dedup = {};
    for (const m of matches) {
      const score = m.coverage + m.similarity / 2;
      const existing = dedup[m.corpus];
      const existingScore = existing ? existing.coverage + existing.similarity / 2 : -1;
      if (score > existingScore) dedup[m.corpus] = m;
    }
    const out = {
      input: opts.checkText,
      pass: Object.keys(dedup).length === 0,
      matches: Object.values(dedup),
    };
    console.log(JSON.stringify(out, null, 2));
    process.exit(out.pass ? 0 : 1);
  }
  const result = runAudit(opts);
  if (opts.persist) {
    const scoresDir = path.join(findWorkstreamDir(ROOT), 'compliance-scores');
    if (!fs.existsSync(scoresDir)) fs.mkdirSync(scoresDir, { recursive: true });
    const scoreFile = path.join(scoresDir, `score-${opts.persist}.yaml`);
    fs.writeFileSync(scoreFile, yamlify(result));
    appendTrend(result, opts.persist);
  }
  if (opts.writeFindings) {
    const writeReport = writeFindings(result, opts.persist || 'run-constitutional-audit-adhoc');
    result.findings_written = writeReport;
  }
  if (opts.json || !process.stdout.isTTY) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    prettyPrint(result);
  }
  process.exit(0);
}

function yamlify(result) {
  // Minimal YAML writer — result is a known shape, not arbitrary.
  const lines = [];
  lines.push(`schema_version: ${result.schema_version}`);
  lines.push(`run_timestamp: "${result.run_timestamp}"`);
  lines.push(`compliance_score: ${result.compliance_score}`);
  lines.push(`coverage_score: ${result.coverage_score}`);
  lines.push(`pass_rate: ${result.pass_rate}`);
  lines.push(`total_items: ${result.total_items}`);
  lines.push(`items_with_detector: ${result.items_with_detector}`);
  lines.push(`items_passing: ${result.items_passing}`);
  lines.push(`by_suite:`);
  for (const [suite, counts] of Object.entries(result.by_suite)) {
    lines.push(`  ${suite}:`);
    for (const [k, v] of Object.entries(counts)) lines.push(`    ${k}: ${v}`);
  }
  lines.push(`items:`);
  for (const item of result.items) {
    lines.push(`  - id: "${item.id}"`);
    lines.push(`    title: ${yamlEscape(item.title)}`);
    lines.push(`    suite: ${item.suite}`);
    lines.push(`    status: ${item.status}`);
    lines.push(`    severity: ${item.severity}`);
    lines.push(`    evidence: ${yamlEscape(item.evidence)}`);
  }
  return lines.join('\n') + '\n';
}

function yamlEscape(s) {
  if (s == null) return '""';
  const str = String(s).replace(/"/g, '\\"').replace(/\n/g, ' ');
  return `"${str}"`;
}

function appendTrend(result, runId) {
  const trendFile = path.join(findWorkstreamDir(ROOT), 'compliance-trends.yaml');
  let trend;
  if (fs.existsSync(trendFile)) {
    // Rough parse — read existing file and append a new score entry
    const existing = fs.readFileSync(trendFile, 'utf8');
    // Just append a score entry; full rewrite preserves header
    const entry = [
      `  - date: "${result.run_timestamp.slice(0, 10)}"`,
      `    run_id: "${runId}"`,
      `    compliance_score: ${result.compliance_score}`,
      `    coverage_score: ${result.coverage_score}`,
      `    pass_rate: ${result.pass_rate}`,
      `    critical_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'critical').length}`,
      `    high_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'high').length}`,
      `    medium_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'medium').length}`,
      `    low_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'low').length}`,
    ].join('\n') + '\n';

    if (existing.includes('scores_over_time:')) {
      const updated = existing.replace(/scores_over_time:\n/, `scores_over_time:\n${entry}`);
      fs.writeFileSync(trendFile, updated);
    } else {
      fs.writeFileSync(trendFile, existing.trimEnd() + '\nscores_over_time:\n' + entry);
    }
  } else {
    // New trend file
    const lines = [
      'schema_version: 1',
      `last_updated: "${result.run_timestamp}"`,
      `runs_evaluated: 1`,
      'latest:',
      `  compliance_score: ${result.compliance_score}`,
      `  coverage_score: ${result.coverage_score}`,
      `  pass_rate: ${result.pass_rate}`,
      `  run_id: "${runId}"`,
      `  date: "${result.run_timestamp.slice(0, 10)}"`,
      'scores_over_time:',
      `  - date: "${result.run_timestamp.slice(0, 10)}"`,
      `    run_id: "${runId}"`,
      `    compliance_score: ${result.compliance_score}`,
      `    coverage_score: ${result.coverage_score}`,
      `    pass_rate: ${result.pass_rate}`,
      `    critical_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'critical').length}`,
      `    high_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'high').length}`,
      `    medium_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'medium').length}`,
      `    low_findings: ${result.items.filter(i => i.status === 'fail' && i.severity === 'low').length}`,
      `weakest_suite: "${weakestSuite(result)}"`,
      `strongest_suite: "${strongestSuite(result)}"`,
      'trend: insufficient_data',
      '',
    ].join('\n');
    fs.writeFileSync(trendFile, lines);
  }
}

function weakestSuite(r) {
  let worst = null, worstScore = 2;
  for (const [s, c] of Object.entries(r.by_suite)) {
    const score = c.total === 0 ? 1 : c.passing / c.total;
    if (score < worstScore) { worstScore = score; worst = s; }
  }
  return worst || '';
}
function strongestSuite(r) {
  let best = null, bestScore = -1;
  for (const [s, c] of Object.entries(r.by_suite)) {
    const score = c.total === 0 ? 0 : c.passing / c.total;
    if (score > bestScore) { bestScore = score; best = s; }
  }
  return best || '';
}

function prettyPrint(r) {
  console.log(`\nConstitutional Audit — compliance_score: ${(r.compliance_score * 100).toFixed(0)}% (coverage ${(r.coverage_score * 100).toFixed(0)}%, pass-rate ${(r.pass_rate * 100).toFixed(0)}%)`);
  console.log(`Items: ${r.items_passing}/${r.total_items} passing, ${r.items_with_detector}/${r.total_items} have detectors`);
  console.log('\nBy suite:');
  for (const [s, c] of Object.entries(r.by_suite)) {
    console.log(`  ${s}: ${c.passing}/${c.total} passing (${c.failing} fail, ${c.infeasible} infeasible, ${c.no_detector} no-detector)`);
  }
  console.log('\nDetails:');
  for (const i of r.items) {
    const marker = i.status === 'pass' ? '✓' : i.status === 'fail' ? '✗' : i.status === 'infeasible' ? '?' : '-';
    console.log(`  ${marker} [${i.id}] ${i.title} (${i.status}, ${i.severity})`);
    console.log(`    ${i.evidence}`);
  }
}

module.exports = {
  runAudit, REGISTRY,
  sanitizeCheckText, CHECK_TEXT_MAX_LEN,
  isAdoptedRepoContext,
  decideFindingFromAuditItem,
  buildFindingPayload,
  writeFindings,
};
