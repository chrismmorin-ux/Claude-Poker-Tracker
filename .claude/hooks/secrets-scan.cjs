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

async function readStdin() {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({ input: process.stdin });

    // Timeout to prevent hanging if stdin never closes
    const timeout = setTimeout(() => {
      rl.close();
      resolve('');
    }, 100);

    rl.on('line', (line) => {
      clearTimeout(timeout);
      input += line;
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(input);
    });

    rl.on('error', () => {
      clearTimeout(timeout);
      resolve('');
    });
  });
}

async function main() {
  const input = await readStdin();

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
  // Note: Exit code 2 requires stderr for error message per Claude Code docs
  for (const pattern of sensitivePatterns) {
    if (pattern.test(command)) {
      console.error('BLOCKED: Potential secret or sensitive file detected in git command.');
      console.error(`Pattern matched: ${pattern}`);
      console.error('');
      console.error('See engineering_practices.md Section 7: Security & Secrets Handling');
      console.error('');
      console.error('Never commit:');
      console.error('  - API keys, tokens, credentials');
      console.error('  - .env files with real values');
      console.error('  - Private keys (.pem, .key)');
      console.error('');
      console.error('If this is intentional and safe, run the command manually.');
      process.exit(2);
    }
  }

  process.exit(0);
}

main().catch(err => {
  console.error('Hook error:', err.message);
  process.exit(0);
});
