#!/usr/bin/env node
/**
 * retreat-detector.cjs — Stop hook. Scans the response the AI just finished writing
 * for the vocabulary of scope-retreat, and BLOCKS so it has to be re-derived.
 *
 * WHY BLOCKING AND NOT WARNING. The founder, 2026-08-05: "It has to be an in-your-face
 * correction mechanism to your thinking." A warning printed after the fact is another
 * passive artifact, and passive artifacts are exactly what has failed here for months.
 * The first instinct when writing this hook was to make it warn-only "so it doesn't get
 * disabled" — which is the very bias the hook exists to catch, one level up. It blocks.
 *
 * WHY IT CAN BE WRONG AND THAT IS FINE. A false positive costs one re-read of a
 * paragraph. A false negative costs a recommendation that quietly shrinks the work, and
 * the founder has been paying that cost for months. The asymmetry justifies the noise.
 *
 * PRECISION. Only phrases that are near-diagnostic in a RECOMMENDATION to this founder
 * are in the blocking set. Words that are usually legitimate ("defer", "not blocking",
 * "for now") are reported but do not block, because blocking on them would make the
 * hook unusable and a disabled hook protects nothing.
 *
 * FAILS OPEN. Any error — unreadable transcript, changed schema — exits 0 silently.
 */

const fs = require('fs');

// Near-diagnostic. Seeing these in a recommendation is almost always the failure.
const BLOCKING = [
  'easier to measure', 'easier to verify', 'easiest to measure',
  'good enough for now', 'good enough to start',
  'route around', 'routing around',
  'settle for',
  'lower the bar', 'lower our bar',
  'scope this down', 'scope it down', 'narrow the scope', 'narrower scope',
  'simpler configuration', 'weaker configuration',
  'start simple', 'start simpler',
  'the pragmatic choice', 'pragmatic option', 'pragmatic path',
];

// Often legitimate. Reported for self-review, never blocks on its own.
const SOFT = [
  'for now', 'good enough', 'not blocking', 'defer this', 'defer that',
  'in the meantime', 'simpler path', 'simpler option', 'cheaper option',
  'punt on', 'live with',
];

function lastAssistantText(transcriptPath) {
  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    let row;
    try { row = JSON.parse(lines[i]); } catch { continue; }
    const msg = row && (row.message || row);
    if (!msg || msg.role !== 'assistant') continue;
    const content = msg.content;
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
      const text = content.filter((b) => b && b.type === 'text').map((b) => b.text).join('\n');
      if (text.trim()) return text;
    }
  }
  return '';
}

try {
  const raw = fs.readFileSync(0, 'utf8');
  const input = JSON.parse(raw || '{}');

  // Never re-block a turn that was already produced in response to this hook.
  if (input.stop_hook_active) process.exit(0);

  const path = input.transcript_path;
  if (!path || !fs.existsSync(path)) process.exit(0);

  const text = lastAssistantText(path);
  if (!text) process.exit(0);
  const hay = text.toLowerCase();

  const hard = BLOCKING.filter((p) => hay.includes(p));
  const soft = SOFT.filter((p) => hay.includes(p));

  if (hard.length === 0) process.exit(0);

  const reason = [
    'RETREAT DETECTED — .claude/rules/improvement-default.md',
    '',
    `Your response contains: ${hard.map((p) => `"${p}"`).join(', ')}`,
    soft.length ? `Also present (soft): ${soft.map((p) => `"${p}"`).join(', ')}` : '',
    '',
    'This is the vocabulary of scope-retreat, and this repo has a months-long documented',
    'pattern of it. Re-derive before answering:',
    '',
    '  1. What limitation prompted that phrasing? Name it with file:line.',
    '  2. What does REMOVING it cost? An unestimated cost is a reason to estimate,',
    '     not a reason to accommodate.',
    '  3. Rewrite the recommendation as removal. That is the default and needs no',
    '     justification.',
    '  4. If accommodation is genuinely right, ASK — present both paths with costs.',
    '     Do not pre-empt the founder\'s choice by recommending the smaller one.',
    '',
    'STRUCTURAL TEST: does your response leave the system LESS capable than the analysis',
    'showed it needs to be? If yes, the analysis failed, not the target.',
    '',
    'If the phrase was genuinely legitimate — quoting the founder, describing a rejected',
    'option, or naming a real dependency ordering — say so explicitly in one line and',
    'continue. Do not silently rephrase to evade the check.',
  ].filter(Boolean).join('\n');

  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
  process.exit(0);
} catch {
  process.exit(0);
}
