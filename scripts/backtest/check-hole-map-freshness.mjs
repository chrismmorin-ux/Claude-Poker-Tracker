#!/usr/bin/env node
/**
 * check-hole-map-freshness.mjs — read-time freshness for the Hole Map readout.
 *
 * WHY A SEPARATE COMMAND FROM THE GENERATOR. The generator can only stamp what was true when
 * it ran. Staleness is a property of the moment you READ the artifact: it is the count of
 * engine commits between generation and now, and that number grows without anyone touching
 * the file. So the banner has to be re-derivable cheaply, without the 3-minute corpus pass.
 * This command is that: pure git, no corpus, no engine load, sub-second.
 *
 *   node scripts/backtest/check-hole-map-freshness.mjs            # check + restamp the HTML
 *   node scripts/backtest/check-hole-map-freshness.mjs --no-stamp # report only
 *   npm run hole-map:check                                        # the founder-facing form
 *
 * EXIT CODES. 0 current · 1 stale (or dirty-source) · 2 unknown/missing artifact. Non-zero on
 * stale is deliberate: it makes the check usable as a gate in a runbook step or a CI job
 * without anyone having to parse the output.
 *
 * WHY THIS IS NOT A SessionStart HOOK. `.claude/hooks/readiness-gate.cjs` records the lesson —
 * "a banner shown every session is a banner nobody reads by week three". An engine-commit
 * staleness signal would fire on most sessions in an active engine sprint, which is precisely
 * the frequency that trains the founder to skip it. The signal belongs at the point of READING
 * the artifact (the banner at the top of the page) and at the point of PRODUCING a new one
 * (the runbook's post-run step), not on every session start.
 */

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import {
  classifyFreshness, renderFreshnessLine, stampFreshnessIntoHtml,
  FRESHNESS_STATE, WATCHED_PATHS,
} from './holeMapFreshness.mjs';
import { readEngineCommits } from './holeMapGit.mjs';

const arg = (name, dflt) => {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : (process.argv[i + 1] ?? dflt);
};
const flag = (name) => process.argv.includes(`--${name}`);

const jsonPath = arg('json', 'out/hole-map.json');
const htmlPath = arg('html', 'out/hole-map.html');

if (!existsSync(jsonPath)) {
  console.error(`No Hole Map at ${jsonPath}. Generate one first:\n  npm run hole-map`);
  process.exit(2);
}

const doc = JSON.parse(readFileSync(jsonPath, 'utf8'));
const manifest = doc.manifest ?? null;

if (!manifest) {
  console.error(
    `${jsonPath} carries no \`manifest\` block, so it cannot state which engine produced it\n`
    + '(SCORED-READOUT-SPEC.md §9bis.11). Regenerate:\n  npm run hole-map',
  );
  process.exit(2);
}

// The UNION of what the artifact stamped and what we watch today, deliberately.
//   · Its own list, because an older generator may have depended on something we no longer do.
//   · Today's list, because when we LEARN that a path moves a number, every artifact predating
//     that discovery should immediately read as stale — judging an old artifact only by what it
//     knew at the time is how a known-bad input keeps looking current.
// A union can only ever widen the stale set, which is the direction a freshness check should err.
const paths = [...new Set([...(manifest.watchedPaths ?? []), ...WATCHED_PATHS])];
const commits = readEngineCommits(manifest.engineCommit, { paths });
const verdict = { ...classifyFreshness(manifest, commits), checkedAt: new Date().toISOString() };

console.log('\nHOLE MAP FRESHNESS');
console.log(renderFreshnessLine(verdict));
console.log(`  watching    ${paths.join(', ')}`);

if (!flag('no-stamp') && existsSync(htmlPath)) {
  const { html, replaced } = stampFreshnessIntoHtml(readFileSync(htmlPath, 'utf8'), verdict);
  if (replaced) {
    writeFileSync(htmlPath, html);
    console.log(`\n  restamped   ${htmlPath}`);
  } else {
    console.log(`\n  NOT restamped — ${htmlPath} has no freshness slot (rendered by an older`
      + ' generator). Regenerate to get one.');
  }
}

console.log('');
if (verdict.state === FRESHNESS_STATE.CURRENT) process.exit(0);
if (verdict.state === FRESHNESS_STATE.UNKNOWN) process.exit(2);
process.exit(1);
