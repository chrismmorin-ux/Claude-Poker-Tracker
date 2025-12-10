/**
 * Shared stdin utilities for Windows-compatible hook stdin handling
 *
 * All hooks should use these functions instead of direct stdin access
 * to prevent hanging/timeout issues on Windows.
 */

const readline = require('readline');
const { execSync } = require('child_process');

const STDIN_TIMEOUT_MS = 100; // 100ms timeout for stdin check

/**
 * Safely read JSON from stdin with timeout
 * Returns parsed JSON or null if timeout/parse error
 * @returns {Promise<object|null>}
 */
async function readStdinJson() {
  return new Promise((resolve) => {
    let input = '';
    let hasData = false;

    const timeout = setTimeout(() => {
      if (!hasData) {
        resolve(null);
      }
    }, STDIN_TIMEOUT_MS);

    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    rl.on('line', (line) => {
      hasData = true;
      clearTimeout(timeout);
      input += line;
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      try {
        resolve(input ? JSON.parse(input) : null);
      } catch (e) {
        resolve(null);
      }
    });

    rl.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });
  });
}

/**
 * Safely read lines from stdin with timeout
 * Returns array of lines or empty array if timeout
 * @returns {Promise<string[]>}
 */
async function readStdinLines() {
  return new Promise((resolve) => {
    const lines = [];
    let hasData = false;

    const timeout = setTimeout(() => {
      if (!hasData) {
        resolve([]);
      }
    }, STDIN_TIMEOUT_MS);

    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    rl.on('line', (line) => {
      hasData = true;
      clearTimeout(timeout);
      lines.push(line);
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(lines);
    });

    rl.on('error', () => {
      clearTimeout(timeout);
      resolve([]);
    });
  });
}

/**
 * Get staged files from git diff (no stdin required)
 * @returns {string[]} Array of staged file paths
 */
function getStagedFiles() {
  try {
    const output = execSync('git diff --cached --name-only', {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'] // Suppress stderr
    });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

/**
 * Get recent commit messages (no stdin required)
 * @param {number} count - Number of commits to retrieve
 * @returns {string[]} Array of commit messages
 */
function getRecentCommits(count = 10) {
  try {
    const output = execSync(`git log --oneline -${count}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    });
    return output.trim().split('\n').filter(Boolean);
  } catch (e) {
    return [];
  }
}

/**
 * Check if a command contains a specific pattern
 * @param {string} command - The bash command
 * @param {string[]} patterns - Array of patterns to check
 * @returns {boolean}
 */
function commandMatches(command, patterns) {
  if (!command) return false;
  return patterns.some(pattern => command.includes(pattern));
}

module.exports = {
  readStdinJson,
  readStdinLines,
  getStagedFiles,
  getRecentCommits,
  commandMatches,
  STDIN_TIMEOUT_MS
};
