#!/usr/bin/env node
/**
 * cwos-asn-validate.js — AS-N / Market Dynamics Assessment structural validator.
 *
 * Enforces framework-spec.md §1-3. Seven stages, all deterministic. Zero LLM
 * calls. Zero external deps. Uses kit/scripts/lib/cwos-utils parseYAML.
 *
 * Invocations:
 *   node cwos-asn-validate.js --adr <path>      # validate one ADR markdown
 *   node cwos-asn-validate.js --program <path>  # validate one program yaml
 *   node cwos-asn-validate.js --charter <path>  # validate one program charter md
 *   node cwos-asn-validate.js --stdin           # read yaml from stdin
 *   node cwos-asn-validate.js --all             # sweep every ADR + program + charter
 *
 * Exit codes:
 *   0 = valid
 *   1 = structural failure (missing block / required field / empty string)
 *   2 = type-specific failure (wrong falsifies_if shape, or stage-5 blacklist)
 *   3 = MDA failure (missing where required, or insufficient-data without surface)
 *   4 = stale (revisit date passed, only in --all mode)
 *
 * If multiple stages fail, exit is min(codes) — lower code = more fundamental.
 *
 * Output: JSON object to stdout ({ ok, exit_code, artifacts_checked, findings }).
 * Human messages go to stderr.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { parseYAML, readYAMLFile, globFiles, todayISO, findRepoRoot } = require('./lib/cwos-utils');

// ─── Constants ──────────────────────────────────────────────────────────────

const VALID_TYPES = new Set(['empirical', 'strategic', 'methodological']);
const VALID_STATUSES = new Set([
  'proposed', 'active', 'at_risk', 'validated', 'contradicted', 'retired',
]);
const VALID_SUBSUMPTION = new Set(['low', 'medium', 'high', 'insufficient-data']);

// Schema v5 (WS-MD-024, 2026-04-22) — optional severity + history fields.
// severity: one of {critical, high, medium}. Missing = medium (default).
// history: array of {date, from, to, reason} transition records.
const VALID_SEVERITIES = new Set(['critical', 'high', 'medium']);
const VALID_TRANSITIONS = new Set([
  'proposed', 'active', 'at_risk', 'validated', 'contradicted', 'retired',
]);

// Per framework-spec §3.4 Stage 5 — four known-anti-pattern strings.
const BLACKLIST = new Set([
  're-test quarterly',
  'review periodically',
  'check later',
  'tbd',
]);

const ID_RE = /^AS-\d+$/;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ─── Finding helpers ────────────────────────────────────────────────────────

function mkFinding(artifact, asnId, stage, exitCode, message) {
  return {
    artifact,
    asn_id: asnId || null,
    stage,
    severity: exitCode === 4 ? 'stale' : 'block',
    exit_code: exitCode,
    message,
  };
}

// ─── Markdown fenced-block extraction ───────────────────────────────────────

/**
 * Extract the first fenced yaml block after a heading that matches `headingRe`.
 * Returns { text, startLine } or null if no match.
 */
function extractFencedYaml(md, headingRe) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let inSection = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^##\s+/.test(line)) {
      inSection = headingRe.test(line);
      continue;
    }
    if (!inSection) continue;
    // Look for fenced yaml block opener
    const openMatch = /^```(?:yaml|yml)?\s*$/.exec(line);
    if (openMatch) {
      const buf = [];
      let j = i + 1;
      while (j < lines.length && !/^```\s*$/.test(lines[j])) {
        buf.push(lines[j]);
        j++;
      }
      return { text: buf.join('\n'), startLine: i + 1 };
    }
  }
  return null;
}

/**
 * Extract the Impact line from an ADR's `## Impact & Reversibility` section.
 * Returns 'high' | 'medium' | 'low' | null.
 */
function extractImpact(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+/.test(line)) {
      inSection = /^##\s+Impact\s*&\s*Reversibility/i.test(line);
      continue;
    }
    if (!inSection) continue;
    const m = /^\s*-\s*\*\*Impact:?\*\*\s*(high|medium|low)/i.exec(line);
    if (m) return m[1].toLowerCase();
  }
  return null;
}

// ─── Validation stages ──────────────────────────────────────────────────────

/**
 * Stage 1-5 on an assumptions array.
 * @param {Array} asns
 * @param {string} artifact
 * @returns {{ findings: Array, exitCodes: Set<number> }}
 */
function validateAsnArray(asns, artifact) {
  const findings = [];
  const exitCodes = new Set();

  // Stage 1 — block present, ≥1 entry
  if (!Array.isArray(asns) || asns.length === 0) {
    findings.push(mkFinding(artifact, null, 1, 1,
      'Stage 1: assumptions block missing or empty; require ≥1 AS-N entry.'));
    exitCodes.add(1);
    return { findings, exitCodes };
  }

  for (const asn of asns) {
    if (!asn || typeof asn !== 'object') {
      findings.push(mkFinding(artifact, null, 1, 1,
        'Stage 1: AS-N entry is not a mapping.'));
      exitCodes.add(1);
      continue;
    }

    const id = asn.id || null;

    // Stage 2 — required fields present
    const required = ['id', 'type', 'claim', 'falsifies_if', 'revisit', 'status'];
    const missing = required.filter(f => asn[f] === undefined || asn[f] === null || asn[f] === '');
    if (missing.length) {
      findings.push(mkFinding(artifact, id, 2, 1,
        `Stage 2: missing required field(s): ${missing.join(', ')}.`));
      exitCodes.add(1);
      continue;
    }

    // Stage 3 — field sanity
    if (!ID_RE.test(String(asn.id))) {
      findings.push(mkFinding(artifact, id, 3, 1,
        `Stage 3: id "${asn.id}" does not match ^AS-\\d+$.`));
      exitCodes.add(1);
    }
    if (!VALID_TYPES.has(String(asn.type))) {
      findings.push(mkFinding(artifact, id, 3, 1,
        `Stage 3: type "${asn.type}" must be one of empirical|strategic|methodological.`));
      exitCodes.add(1);
    }
    if (!VALID_STATUSES.has(String(asn.status))) {
      findings.push(mkFinding(artifact, id, 3, 1,
        `Stage 3: status "${asn.status}" must be one of ${[...VALID_STATUSES].join('|')}.`));
      exitCodes.add(1);
    }
    const claim = String(asn.claim || '').trim();
    if (claim.length < 20) {
      findings.push(mkFinding(artifact, id, 3, 1,
        `Stage 3: claim is ${claim.length} chars (trimmed); require ≥20.`));
      exitCodes.add(1);
    }
    const revisit = String(asn.revisit || '').trim();
    if (!revisit) {
      findings.push(mkFinding(artifact, id, 3, 1,
        'Stage 3: revisit is empty; require ISO date or trigger-event string.'));
      exitCodes.add(1);
    }

    // Stage 3b — optional severity (v5, WS-MD-024). If present, must be in set.
    if (asn.severity !== undefined && asn.severity !== null && asn.severity !== '') {
      if (!VALID_SEVERITIES.has(String(asn.severity))) {
        findings.push(mkFinding(artifact, id, 3, 1,
          `Stage 3: severity "${asn.severity}" must be one of critical|high|medium (v5).`));
        exitCodes.add(1);
      }
    }

    // Stage 3c — optional history (v5, WS-MD-024). If present, must be array of
    // {date, from, to, reason}. Each entry's from/to must be a valid status.
    if (asn.history !== undefined && asn.history !== null) {
      if (!Array.isArray(asn.history)) {
        findings.push(mkFinding(artifact, id, 3, 1,
          'Stage 3: history must be an array if present.'));
        exitCodes.add(1);
      } else {
        for (let hi = 0; hi < asn.history.length; hi++) {
          const h = asn.history[hi];
          if (!h || typeof h !== 'object') {
            findings.push(mkFinding(artifact, id, 3, 1,
              `Stage 3: history[${hi}] must be a mapping.`));
            exitCodes.add(1);
            continue;
          }
          if (!h.date || !ISO_DATE_RE.test(String(h.date))) {
            findings.push(mkFinding(artifact, id, 3, 1,
              `Stage 3: history[${hi}].date must be ISO date YYYY-MM-DD.`));
            exitCodes.add(1);
          }
          if (h.from && !VALID_TRANSITIONS.has(String(h.from))) {
            findings.push(mkFinding(artifact, id, 3, 1,
              `Stage 3: history[${hi}].from "${h.from}" must be a valid status.`));
            exitCodes.add(1);
          }
          if (!h.to || !VALID_TRANSITIONS.has(String(h.to))) {
            findings.push(mkFinding(artifact, id, 3, 1,
              `Stage 3: history[${hi}].to "${h.to || ''}" must be a valid status.`));
            exitCodes.add(1);
          }
          if (!h.reason || String(h.reason).trim().length < 5) {
            findings.push(mkFinding(artifact, id, 3, 1,
              `Stage 3: history[${hi}].reason must be a non-empty string (≥5 chars).`));
            exitCodes.add(1);
          }
        }
      }
    }

    // Stage 4 — type-specific falsifies_if shape
    const f = asn.falsifies_if;
    const type = String(asn.type);
    if (f === null || typeof f !== 'object' || Array.isArray(f)) {
      findings.push(mkFinding(artifact, id, 4, 2,
        `Stage 4: falsifies_if must be a mapping for type "${type}".`));
      exitCodes.add(2);
    } else if (type === 'empirical') {
      if (!f.threshold || String(f.threshold).trim().length < 1) {
        findings.push(mkFinding(artifact, id, 4, 2,
          'Stage 4: type=empirical requires falsifies_if.threshold (non-empty string).'));
        exitCodes.add(2);
      }
      if (!f.window || String(f.window).trim().length < 1) {
        findings.push(mkFinding(artifact, id, 4, 2,
          'Stage 4: type=empirical requires falsifies_if.window (non-empty string).'));
        exitCodes.add(2);
      }
    } else if (type === 'strategic') {
      if (!Array.isArray(f.watch_surfaces) || f.watch_surfaces.length === 0) {
        findings.push(mkFinding(artifact, id, 4, 2,
          'Stage 4: type=strategic requires falsifies_if.watch_surfaces (array, ≥1 entry).'));
        exitCodes.add(2);
      } else {
        const bad = f.watch_surfaces.filter(s => !s || String(s).trim().length < 5);
        if (bad.length) {
          findings.push(mkFinding(artifact, id, 4, 2,
            `Stage 4: type=strategic watch_surfaces entries must be ≥5 chars; ${bad.length} too short.`));
          exitCodes.add(2);
        }
      }
      const trig = String(f.trigger_event || '').trim();
      if (trig.length < 20) {
        findings.push(mkFinding(artifact, id, 4, 2,
          `Stage 4: type=strategic requires falsifies_if.trigger_event ≥20 chars (got ${trig.length}).`));
        exitCodes.add(2);
      }
    } else if (type === 'methodological') {
      const cc = String(f.control_case || '').trim();
      if (cc.length < 20) {
        findings.push(mkFinding(artifact, id, 4, 2,
          `Stage 4: type=methodological requires falsifies_if.control_case ≥20 chars (got ${cc.length}).`));
        exitCodes.add(2);
      }
      if (!f.pass_criterion || String(f.pass_criterion).trim().length < 1) {
        findings.push(mkFinding(artifact, id, 4, 2,
          'Stage 4: type=methodological requires falsifies_if.pass_criterion (non-empty string).'));
        exitCodes.add(2);
      }
    }

    // Stage 5 — blacklist on joined falsifies_if content
    if (f && typeof f === 'object') {
      const joined = flattenToText(f).toLowerCase().trim();
      if (BLACKLIST.has(joined)) {
        findings.push(mkFinding(artifact, id, 5, 2,
          `Stage 5: falsifies_if equals blacklisted anti-pattern "${joined}".`));
        exitCodes.add(2);
      }
    }
  }

  return { findings, exitCodes };
}

/**
 * Stage 6 on a market_dynamics block.
 */
function validateMda(mda, artifact) {
  const findings = [];
  const exitCodes = new Set();

  if (!mda || typeof mda !== 'object' || Array.isArray(mda)) {
    findings.push(mkFinding(artifact, null, 6, 3,
      'Stage 6: market_dynamics block missing or not a mapping.'));
    exitCodes.add(3);
    return { findings, exitCodes };
  }

  const subsump = String(mda.subsumption_risk || '');
  if (!VALID_SUBSUMPTION.has(subsump)) {
    findings.push(mkFinding(artifact, null, 6, 3,
      `Stage 6: subsumption_risk "${subsump}" must be low|medium|high|insufficient-data.`));
    exitCodes.add(3);
  }

  const selfPref = String(mda.self_preference || '');
  if (!/^(ours|would_switch_to:.+|insufficient-data)$/.test(selfPref)) {
    findings.push(mkFinding(artifact, null, 6, 3,
      `Stage 6: self_preference "${selfPref}" must match ^(ours|would_switch_to:.+|insufficient-data)$.`));
    exitCodes.add(3);
  }

  const durable = String(mda.durable_ground || '').trim();
  if (durable.length < 20) {
    findings.push(mkFinding(artifact, null, 6, 3,
      `Stage 6: durable_ground is ${durable.length} chars; require ≥20.`));
    exitCodes.add(3);
  }

  const lastReviewed = String(mda.last_reviewed || '');
  if (!ISO_DATE_RE.test(lastReviewed)) {
    findings.push(mkFinding(artifact, null, 6, 3,
      `Stage 6: last_reviewed "${lastReviewed}" must be ISO date YYYY-MM-DD.`));
    exitCodes.add(3);
  }

  // Conditional: if any insufficient-data, require watch_surfaces + trigger_event.
  const hasInsufficient = subsump === 'insufficient-data' || selfPref === 'insufficient-data';
  if (hasInsufficient) {
    if (!Array.isArray(mda.watch_surfaces) || mda.watch_surfaces.length === 0) {
      findings.push(mkFinding(artifact, null, 6, 3,
        'Stage 6: insufficient-data value requires watch_surfaces (array, ≥1 entry).'));
      exitCodes.add(3);
    } else {
      const bad = mda.watch_surfaces.filter(s => !s || String(s).trim().length < 5);
      if (bad.length) {
        findings.push(mkFinding(artifact, null, 6, 3,
          `Stage 6: watch_surfaces entries must be ≥5 chars; ${bad.length} too short.`));
        exitCodes.add(3);
      }
    }
    const trig = String(mda.trigger_event || '').trim();
    if (trig.length < 20) {
      findings.push(mkFinding(artifact, null, 6, 3,
        `Stage 6: insufficient-data value requires trigger_event ≥20 chars (got ${trig.length}).`));
      exitCodes.add(3);
    }
  }

  return { findings, exitCodes };
}

/**
 * Stage 7 — freshness. Called per AS-N in --all mode only.
 */
function validateFreshness(asns, artifact, today) {
  const findings = [];
  const exitCodes = new Set();
  if (!Array.isArray(asns)) return { findings, exitCodes };
  for (const asn of asns) {
    if (!asn || asn.status !== 'active') continue;
    const rev = String(asn.revisit || '').trim();
    if (!ISO_DATE_RE.test(rev)) continue; // trigger-event form — can't sweep
    if (rev <= today) {
      findings.push(mkFinding(artifact, asn.id, 7, 4,
        `Stage 7: AS-N ${asn.id} is overdue (revisit: ${rev}, today: ${today}).`));
      exitCodes.add(4);
    }
  }
  return { findings, exitCodes };
}

// ─── Flatten helper for stage 5 blacklist ───────────────────────────────────

function flattenToText(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(flattenToText).join(' ');
  if (typeof v === 'object') {
    return Object.entries(v).map(([k, val]) => `${k} ${flattenToText(val)}`).join(' ');
  }
  return '';
}

// ─── Per-artifact validators ────────────────────────────────────────────────

function validateAdr(adrPath, opts = {}) {
  const findings = [];
  const exitCodes = new Set();

  let md;
  try {
    md = fs.readFileSync(adrPath, 'utf8');
  } catch (err) {
    findings.push(mkFinding(adrPath, null, 0, 1, `Cannot read ADR: ${err.message}`));
    exitCodes.add(1);
    return { findings, exitCodes, artifactsChecked: 0 };
  }

  const impact = extractImpact(md);

  // Grandfather: ADRs with no Impact field AND no AS-N section are legacy.
  // Only enforce on ADRs that have declared impact: high or that already
  // contain a Load-Bearing Assumptions section.
  const asnBlock = extractFencedYaml(md, /^##\s+Load-Bearing\s+Assumptions/i);
  if (impact !== 'high' && !asnBlock) {
    // Not subject to validation — legacy or low-impact ADR.
    return { findings, exitCodes, artifactsChecked: 1 };
  }

  // Require AS-N block for high-impact ADRs
  if (!asnBlock) {
    findings.push(mkFinding(adrPath, null, 1, 1,
      'Stage 1: impact:high ADR missing "## Load-Bearing Assumptions" section with fenced yaml block.'));
    exitCodes.add(1);
  } else {
    const parsed = tryParseYaml(asnBlock.text);
    if (parsed.error) {
      findings.push(mkFinding(adrPath, null, 1, 1,
        `Stage 1: AS-N yaml block does not parse: ${parsed.error}`));
      exitCodes.add(1);
    } else {
      // Support either top-level array (bare list) or { assumptions: [...] }
      const asns = Array.isArray(parsed.data) ? parsed.data
        : parsed.data && Array.isArray(parsed.data.assumptions) ? parsed.data.assumptions
        : null;
      if (asns === null) {
        findings.push(mkFinding(adrPath, null, 1, 1,
          'Stage 1: AS-N yaml block must be either a top-level array or contain an "assumptions:" array.'));
        exitCodes.add(1);
      } else {
        const r = validateAsnArray(asns, adrPath);
        findings.push(...r.findings);
        r.exitCodes.forEach(c => exitCodes.add(c));
      }
    }
  }

  // Stage 6 — MDA required for impact: high
  if (impact === 'high') {
    const mdaBlock = extractFencedYaml(md, /^##\s+Market\s+Dynamics/i);
    if (!mdaBlock) {
      findings.push(mkFinding(adrPath, null, 6, 3,
        'Stage 6: impact:high ADR missing "## Market Dynamics" section with fenced yaml block.'));
      exitCodes.add(3);
    } else {
      const parsed = tryParseYaml(mdaBlock.text);
      if (parsed.error) {
        findings.push(mkFinding(adrPath, null, 6, 3,
          `Stage 6: MDA yaml block does not parse: ${parsed.error}`));
        exitCodes.add(3);
      } else {
        const mda = parsed.data && parsed.data.market_dynamics
          ? parsed.data.market_dynamics
          : parsed.data; // allow bare block without wrapper
        const r = validateMda(mda, adrPath);
        findings.push(...r.findings);
        r.exitCodes.forEach(c => exitCodes.add(c));
      }
    }
  }

  return { findings, exitCodes, artifactsChecked: 1 };
}

function validateProgram(progPath, opts = {}) {
  const findings = [];
  const exitCodes = new Set();

  const { ok, data, error } = readYAMLFile(progPath);
  if (!ok) {
    findings.push(mkFinding(progPath, null, 0, 1, `Cannot parse program YAML: ${error}`));
    exitCodes.add(1);
    return { findings, exitCodes, artifactsChecked: 0 };
  }

  const tier = String(data.tier || '').trim();
  const hasAsnKey = Array.isArray(data.assumptions);
  const hasMdaKey = data.market_dynamics && typeof data.market_dynamics === 'object';
  const required = tier === 'active' || tier === 'critical';

  // Grandfather: tier=watch|dormant with no assumptions/market_dynamics → skip.
  if (!required && !hasAsnKey && !hasMdaKey) {
    return { findings, exitCodes, artifactsChecked: 1 };
  }

  // If present or required, validate.
  if (required && !hasAsnKey) {
    findings.push(mkFinding(progPath, null, 1, 1,
      `Stage 1: tier=${tier} program missing required "assumptions:" array.`));
    exitCodes.add(1);
  } else if (hasAsnKey) {
    const r = validateAsnArray(data.assumptions, progPath);
    findings.push(...r.findings);
    r.exitCodes.forEach(c => exitCodes.add(c));
  }

  if (required && !hasMdaKey) {
    findings.push(mkFinding(progPath, null, 6, 3,
      `Stage 6: tier=${tier} program missing required "market_dynamics:" block.`));
    exitCodes.add(3);
  } else if (hasMdaKey) {
    const r = validateMda(data.market_dynamics, progPath);
    findings.push(...r.findings);
    r.exitCodes.forEach(c => exitCodes.add(c));
  }

  return { findings, exitCodes, artifactsChecked: 1 };
}

function validateCharter(charterPath, opts = {}) {
  const findings = [];
  const exitCodes = new Set();

  let md;
  try {
    md = fs.readFileSync(charterPath, 'utf8');
  } catch (err) {
    findings.push(mkFinding(charterPath, null, 0, 1, `Cannot read charter: ${err.message}`));
    exitCodes.add(1);
    return { findings, exitCodes, artifactsChecked: 0 };
  }

  // Charters accept any of:
  //   ## Load-Bearing Assumptions (AS-N)  [canonical post-framework]
  //   ## Load-Bearing Assumptions
  //   ## Assumptions
  //   ## Assumptions being tracked  [legacy]
  const asnBlock = extractFencedYaml(md,
    /^##\s+(Load-Bearing\s+Assumptions|Assumptions(\s+being\s+tracked)?)/i);
  // Grandfather: charters with no assumptions section and no MDA section — skip.
  const mdaBlock = extractFencedYaml(md, /^##\s+Market\s+Dynamics/i);

  if (!asnBlock && !mdaBlock) {
    return { findings, exitCodes, artifactsChecked: 1 };
  }

  if (!asnBlock) {
    findings.push(mkFinding(charterPath, null, 1, 1,
      'Stage 1: charter has Market Dynamics section but no Load-Bearing Assumptions section.'));
    exitCodes.add(1);
  } else {
    const parsed = tryParseYaml(asnBlock.text);
    if (parsed.error) {
      findings.push(mkFinding(charterPath, null, 1, 1,
        `Stage 1: charter AS-N yaml block does not parse: ${parsed.error}`));
      exitCodes.add(1);
    } else {
      const asns = Array.isArray(parsed.data) ? parsed.data
        : parsed.data && Array.isArray(parsed.data.assumptions) ? parsed.data.assumptions
        : null;
      if (asns === null) {
        findings.push(mkFinding(charterPath, null, 1, 1,
          'Stage 1: charter AS-N block must be an array or contain an "assumptions:" array.'));
        exitCodes.add(1);
      } else {
        const r = validateAsnArray(asns, charterPath);
        findings.push(...r.findings);
        r.exitCodes.forEach(c => exitCodes.add(c));
      }
    }
  }

  if (mdaBlock) {
    const parsed = tryParseYaml(mdaBlock.text);
    if (parsed.error) {
      findings.push(mkFinding(charterPath, null, 6, 3,
        `Stage 6: charter MDA yaml block does not parse: ${parsed.error}`));
      exitCodes.add(3);
    } else {
      const mda = parsed.data && parsed.data.market_dynamics
        ? parsed.data.market_dynamics
        : parsed.data;
      const r = validateMda(mda, charterPath);
      findings.push(...r.findings);
      r.exitCodes.forEach(c => exitCodes.add(c));
    }
  }

  return { findings, exitCodes, artifactsChecked: 1 };
}

function validateStdin(stdinText) {
  const findings = [];
  const exitCodes = new Set();

  const parsed = tryParseYaml(stdinText);
  if (parsed.error) {
    findings.push(mkFinding('<stdin>', null, 0, 1, `Cannot parse stdin yaml: ${parsed.error}`));
    exitCodes.add(1);
    return { findings, exitCodes, artifactsChecked: 0 };
  }

  const data = parsed.data || {};
  const asns = Array.isArray(data) ? data
    : Array.isArray(data.assumptions) ? data.assumptions
    : null;

  if (asns !== null) {
    const r = validateAsnArray(asns, '<stdin>');
    findings.push(...r.findings);
    r.exitCodes.forEach(c => exitCodes.add(c));
  }

  if (data.market_dynamics) {
    const r = validateMda(data.market_dynamics, '<stdin>');
    findings.push(...r.findings);
    r.exitCodes.forEach(c => exitCodes.add(c));
  }

  if (asns === null && !data.market_dynamics) {
    findings.push(mkFinding('<stdin>', null, 0, 1,
      'stdin contained neither assumptions[] nor market_dynamics block.'));
    exitCodes.add(1);
  }

  return { findings, exitCodes, artifactsChecked: 1 };
}

function validateAll(repoRoot) {
  const findings = [];
  const exitCodes = new Set();
  let artifactsChecked = 0;
  const today = todayISO();

  const adrDir = path.join(repoRoot, 'docs', 'adrs');
  const progCharterDir = path.join(repoRoot, 'docs', 'programs');
  const progYamlDir = path.join(repoRoot, '.claude', 'workstream', 'programs');

  const collect = (dir, pattern, validator) => {
    if (!fs.existsSync(dir)) return;
    for (const f of globFiles(dir, pattern)) {
      const r = validator(f);
      findings.push(...r.findings);
      r.exitCodes.forEach(c => exitCodes.add(c));
      artifactsChecked += r.artifactsChecked;

      // Stage 7 freshness sweep on program yaml and charters
      if (f.endsWith('.yaml')) {
        const { ok, data } = readYAMLFile(f);
        if (ok && Array.isArray(data.assumptions)) {
          const s = validateFreshness(data.assumptions, f, today);
          findings.push(...s.findings);
          s.exitCodes.forEach(c => exitCodes.add(c));
        }
      } else if (f.endsWith('.md')) {
        const md = fs.readFileSync(f, 'utf8');
        const block = extractFencedYaml(md,
          /^##\s+(Load-Bearing\s+Assumptions|Assumptions(\s+being\s+tracked)?)/i);
        if (block) {
          const parsed = tryParseYaml(block.text);
          if (!parsed.error) {
            const asns = Array.isArray(parsed.data) ? parsed.data
              : parsed.data && Array.isArray(parsed.data.assumptions) ? parsed.data.assumptions
              : null;
            if (asns) {
              const s = validateFreshness(asns, f, today);
              findings.push(...s.findings);
              s.exitCodes.forEach(c => exitCodes.add(c));
            }
          }
        }
      }
    }
  };

  collect(adrDir, 'ADR-*.md', validateAdr);
  collect(progYamlDir, 'prog-*.yaml', validateProgram);
  collect(progCharterDir, '*.md', validateCharter);

  return { findings, exitCodes, artifactsChecked };
}

// ─── Try-parse wrapper ──────────────────────────────────────────────────────

function tryParseYaml(text) {
  try {
    const data = parseYAML(text);
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

function computeExit(exitCodes) {
  if (exitCodes.size === 0) return 0;
  return Math.min(...exitCodes);
}

function emit(findings, exitCode, artifactsChecked) {
  const out = {
    ok: exitCode === 0,
    exit_code: exitCode,
    artifacts_checked: artifactsChecked,
    findings,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + '\n');
  if (!out.ok) {
    for (const f of findings) {
      process.stderr.write(`  ${f.artifact}${f.asn_id ? `#${f.asn_id}` : ''} [stage ${f.stage}]: ${f.message}\n`);
    }
  }
  process.exit(exitCode);
}

function readStdin() {
  return new Promise((resolve, reject) => {
    let buf = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', d => { buf += d; });
    process.stdin.on('end', () => resolve(buf));
    process.stdin.on('error', reject);
  });
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.length === 0) {
    process.stderr.write('Usage: cwos-asn-validate.js [--adr <path> | --program <path> | --charter <path> | --stdin | --all]\n');
    process.exit(1);
  }

  const flag = argv[0];
  const arg = argv[1];

  let result;
  if (flag === '--adr') {
    if (!arg) { process.stderr.write('--adr requires a path\n'); process.exit(1); }
    result = validateAdr(arg);
  } else if (flag === '--program') {
    if (!arg) { process.stderr.write('--program requires a path\n'); process.exit(1); }
    result = validateProgram(arg);
  } else if (flag === '--charter') {
    if (!arg) { process.stderr.write('--charter requires a path\n'); process.exit(1); }
    result = validateCharter(arg);
  } else if (flag === '--stdin') {
    const text = await readStdin();
    result = validateStdin(text);
  } else if (flag === '--all') {
    const repoRoot = findRepoRoot(process.cwd(), { markers: ['.git', 'kit'], requireAll: false });
    result = validateAll(repoRoot);
  } else {
    process.stderr.write(`Unknown flag: ${flag}\n`);
    process.exit(1);
  }

  const exitCode = computeExit(result.exitCodes);
  emit(result.findings, exitCode, result.artifactsChecked);
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n${err.stack}\n`);
  process.exit(1);
});
