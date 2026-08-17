#!/usr/bin/env node
/**
 * check-required-equity-seam.mjs — WS-450 (FIND-112) gate.
 *
 * Bans inline re-derivation of pot-odds / required-equity thresholds in the engine.
 * The shape `X / (Y + X)` (same identifier twice) is the bluffer's breakeven s/(1+s);
 * used as a CALLER's required equity it demands ~double the correct price (§13.4) and
 * this exact substitution shipped five times before this gate existed. The one legal
 * source for a caller's price is `villainRequiredEquity` (foldEquityCalculator.js).
 *
 * A match is allowed only when the line carries one of the explicit annotations:
 *   - "bluffer-breakeven"    — a genuine §6.3 fold-frequency use
 *   - "pot-includes-bet"     — c/(p+c) where p already contains the outstanding bet,
 *                              which makes it algebraically the caller's s/(1+2s)
 *   - "balanced-bluff-ratio" — bluff:value = s/(1+s) in balanced-range construction
 * Annotating a line is a claim reviewed at merge time, not a free pass.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = ['src/utils/exploitEngine', 'src/utils/liveAdvisor', 'src/utils/rangeEngine'];
const PATTERN = /\b(\w+)\s*\/\s*\(\s*\w+(?:\.\w+)*\s*\+\s*\1\s*\)/;
const ALLOW = /bluffer-breakeven|pot-includes-bet|balanced-bluff-ratio/;

const files = [];
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === '__tests__' || name === 'node_modules') continue;
      walk(p);
    } else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\./.test(name)) {
      files.push(p);
    }
  }
};
const missingRoots = [];
ROOTS.forEach((r) => {
  try { walk(r); } catch { missingRoots.push(r); }
});

/**
 * ANTI-VACUITY (WS-445). Until this existed, a missing root was swallowed silently: rename the
 * engine directories and the gate printed "✓ 0 files clean" and exited 0, defending nothing.
 * A check that cannot fail is worse than no check, because it reports success.
 *
 * Same guard as `tests/playwright/touch-floor.spec.js:104` ("derived roster went vacuous") and
 * the per-area floors in `scripts/standardOfRecord/harvestLabelConstructs.mjs`. The floor is
 * deliberately far below the ~90 files these roots hold, so it catches a broken walk without
 * becoming a ratchet on legitimate deletion.
 */
const FILE_FLOOR = 40;
if (missingRoots.length || files.length < FILE_FLOOR) {
  console.error('❌ check-required-equity-seam: VACUOUS SCAN — the gate stopped seeing things.');
  if (missingRoots.length) {
    console.error(`   Root(s) not found: ${missingRoots.join(', ')}`);
    console.error('   A renamed or moved engine directory silently empties this gate.');
  }
  if (files.length < FILE_FLOOR) {
    console.error(`   Only ${files.length} files scanned, floor is ${FILE_FLOOR}.`);
  }
  process.exit(1);
}

const violations = [];
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  let inBlockComment = false;
  lines.forEach((line, i) => {
    const t = line.trim();
    if (inBlockComment) { if (t.includes('*/')) inBlockComment = false; return; }
    if (t.startsWith('/*') && !t.includes('*/')) { inBlockComment = true; return; }
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) return;
    if (PATTERN.test(line) && !ALLOW.test(line)) {
      violations.push(`${f}:${i + 1}: ${t}`);
    }
  });
}

if (violations.length) {
  console.error('❌ check-required-equity-seam: inline pot-odds arithmetic found.');
  console.error('   Use villainRequiredEquity (foldEquityCalculator.js), or annotate a');
  console.error('   genuine bluffer-breakeven / pot-includes-bet use. Sites:');
  violations.forEach((v) => console.error('   ' + v));
  process.exit(1);
}
console.log(`✓ check-required-equity-seam: ${files.length} files clean`);
