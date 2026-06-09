#!/usr/bin/env node
/**
 * cwos-events-fsck — integrity verifier for the shadow event log.
 *
 * ADR-018 step 1, WS-170. Walks every chunk in `.claude/workstream/events/`,
 * verifies each event parses + validates + re-hashes + chains, and checks
 * the anchor file for drift. Exits non-zero if any issue is found.
 *
 * Usage:
 *   cwos-events-fsck              # verify, pretty print
 *   cwos-events-fsck --json       # machine-readable output
 *   cwos-events-fsck --quiet      # only print on failure
 *   cwos-events-fsck --workstream-dir <p>
 */

'use strict';

require('../lib/preflight');

const path = require('path');
const { fsck } = require('./events');

function parseArg(args, flag, fallback) {
  const i = args.indexOf(flag);
  if (i === -1 || i === args.length - 1) return fallback;
  return args[i + 1];
}

function main() {
  const args = process.argv.slice(2);
  const workstreamDir = parseArg(args, '--workstream-dir', null);
  const asJson = args.includes('--json');
  const quiet = args.includes('--quiet');

  const result = fsck(workstreamDir ? { workstreamDir } : {});

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else if (!(quiet && result.ok)) {
    process.stdout.write(`events fsck: ${result.ok ? 'OK' : 'FAIL'}\n`);
    process.stdout.write(`  events:      ${result.event_count}\n`);
    process.stdout.write(`  chain head:  ${result.chain_head || '(empty)'}\n`);
    if (result.issues.length > 0) {
      process.stdout.write(`  issues:\n`);
      for (const it of result.issues) {
        const loc = it.index ? `${it.chunk}:${it.index}` : it.chunk;
        process.stdout.write(`    - [${it.type}] ${loc} — ${it.message}\n`);
      }
    }
  }

  process.exit(result.ok ? 0 : 1);
}

if (require.main === module) main();
