#!/usr/bin/env node
/**
 * improvement-default.cjs — UserPromptSubmit hook. Fires before EVERY response.
 *
 * WHY THIS EXISTS. The founder, 2026-08-05: "It is very difficult to get you to not
 * accept incomplete work. This is an area you have ridiculous amount of blind spots...
 * It has to be an in-your-face correction mechanism to your thinking." He was explicit
 * that this is not a session problem — it is "every single session for months, and
 * almost the theme of the repo."
 *
 * WHY A HOOK AND NOT A DOCUMENT. A rules file was written first and the founder
 * correctly identified that as the same failure one level up: producing a passive
 * artifact instead of a mechanism. `.claude/rules/improvement-default.md` and CLAUDE.md
 * have been readable for months and the pattern persisted. Reading is not the
 * intervention. This fires whether or not anything was read.
 *
 * WHY IT ROTATES. `readiness-gate.cjs` in this directory records the lesson: "A banner
 * shown every session is a banner nobody reads by week three." A fixed block becomes
 * wallpaper. So the invariant half stays short and a DIFFERENT recorded instance of the
 * real failure is foregrounded each turn — concrete, specific, and hard to skim past,
 * because each one is a thing that actually happened in this repo.
 *
 * FAILS OPEN. Any error exits 0 silently. A broken nag must never block the founder.
 */

// Real recorded instances. Each: what the AI did, and what it should have done.
// Add to this list when a new instance is caught — the rotation is the memory.
const INSTANCES = [
  {
    did: 'Ran an inline single-threaded audit where the protocol declared a multi-agent roundtable.',
    should: 'Spawn the declared agents, or STOP and say why you cannot. Never substitute a weaker method.',
    date: '2026-08-05',
  },
  {
    did: 'Reported an EV interval straddling zero as a terminal finding.',
    should: 'State the n that would resolve it, and note that the per-decision decomposition carries signal the aggregate does not.',
    date: '2026-08-05',
  },
  {
    did: 'Described the range-update scalar cancellation as a property of the system.',
    should: 'Name it as a defect to remove. Founder: "that sounds like a limit on the engine that needs to be expanded."',
    date: '2026-08-05',
  },
  {
    did: 'Recommended baselining on the depth-1 arm BECAUSE it is the only reproducible configuration.',
    should: 'Recommend fixing depth-2 determinism. Founder: "Depth 2 is correct and we HAVE to do it, and if it isn\'t good enough yet, that\'s our fault."',
    date: '2026-08-05',
  },
  {
    did: 'Answered "we need a protocol" by writing a markdown file.',
    should: 'Build a mechanism that fires at the moment of the error. A document you are supposed to have read is not a control.',
    date: '2026-08-05',
  },
  {
    did: 'Filed 12 findings into a run record and never created the finding files, leaving 12 orphan refs.',
    should: 'Finish the artifact. A partial that looks complete is worse than a gap that is named.',
    date: '2026-08-05',
  },
];

try {
  const pick = INSTANCES[Math.floor(Math.random() * INSTANCES.length)];

  const context = [
    'IMPROVEMENT DEFAULT (standing rule — .claude/rules/improvement-default.md):',
    'A limitation found by analysis is REMOVED by default. Recommending accommodation —',
    'deferral, scope reduction, routing around, a weaker configuration, "measure the easy',
    'thing instead" — is the FOUNDER\'S decision, never yours. You may ASK, with the cost',
    'stated. You may not RECOMMEND it.',
    '',
    'STRUCTURAL TEST: an analysis that ends in a NARROWER scope than it started with has',
    'FAILED. The output of an engine run is a list of things to BUILD, not to avoid.',
    '',
    'The mechanism is measurability bias: preferring what you can cleanly verify, then',
    'shrinking the work to fit the instrument instead of building the instrument to fit',
    'the work. It wears the costume of rigor, which is why you do not catch it.',
    '',
    `PAST INSTANCE (${pick.date}) — this actually happened here:`,
    `  DID:    ${pick.did}`,
    `  SHOULD: ${pick.should}`,
  ].join('\n');

  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'UserPromptSubmit',
      additionalContext: context,
    },
  }));
  process.exit(0);
} catch {
  process.exit(0);
}
