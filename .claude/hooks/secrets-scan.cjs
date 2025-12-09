#!/usr/bin/env node
/**
 * Secrets Scanner Hook - Prevents committing sensitive files
 *
 * Blocks commits that include:
 * - .env files (except .env.example)
 * - Files with credentials, keys, tokens
 * - Private keys (.pem, .key)
 *
 * See engineering_practices.md Section 7: Security & Secrets Handling
 *
 * Exit codes:
 * - 0: Allow
 * - 2: Block
 */

const readline = require('readline');

async function main() {
  let input = '';
  const rl = readline.createInterface({ input: process.stdin });

  for await (const line of rl) {
    input += line;
  }

  let data;
  try {
    data = JSON.parse(input);
  } catch (e) {
    process.exit(0);
  }

  const command = data?.tool_input?.command || '';

  // Only check git add and git commit commands
  if (!/git\s+(add|commit)/.test(command)) {
    process.exit(0);
  }

  // Patterns for sensitive files
  const sensitivePatterns = [
    /\.env(?!\.example)/,           // .env but not .env.example
    /\.env\.local/,
    /\.env\.\w+\.local/,
    /credentials\.json/,
    /secrets\.json/,
    /\.pem$/,
    /\.key$/,
    /id_rsa/,
    /id_ed25519/,
    /\.p12$/,
    /\.pfx$/,
    /apikey/i,
    /api_key/i,
    /secret_key/i,
    /private_key/i,
  ];

  // Check if any sensitive files are being added
  for (const pattern of sensitivePatterns) {
    if (pattern.test(command)) {
      console.log('BLOCKED: Potential secret or sensitive file detected in git command.');
      console.log(`Pattern matched: ${pattern}`);
      console.log('');
      console.log('See engineering_practices.md Section 7: Security & Secrets Handling');
      console.log('');
      console.log('Never commit:');
      console.log('  - API keys, tokens, credentials');
      console.log('  - .env files with real values');
      console.log('  - Private keys (.pem, .key)');
      console.log('');
      console.log('If this is intentional and safe, run the command manually.');
      process.exit(2);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0);
});
