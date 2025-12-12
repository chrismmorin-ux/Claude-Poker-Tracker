#!/usr/bin/env node
/**
 * Plan Mode Edit Check Hook
 *
 * Requires user approval for Edit/Write operations when in plan mode.
 * Outside of plan mode, defers to the permissions configuration.
 */

const fs = require('fs');

let input = '';

process.stdin.on('data', chunk => {
  input += chunk;
});

process.stdin.on('end', () => {
  try {
    const data = JSON.parse(input);

    // Check if we're in plan mode
    if (data.permission_mode === 'plan') {
      // In plan mode, require confirmation for edits/writes
      const output = {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'ask',
          permissionDecisionReason: 'Editing files requires confirmation in Plan Mode'
        }
      };
      console.log(JSON.stringify(output));
      process.exit(0);
    }

    // Outside plan mode, defer to permissions config (auto-approve)
    process.exit(0);
  } catch (e) {
    console.error(`Error in plan-mode-edit-check hook: ${e.message}`);
    process.exit(1);
  }
});
