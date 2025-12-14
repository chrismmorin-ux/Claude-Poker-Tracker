/**
 * hook-utils.cjs - Shared utilities for Claude Code hooks
 *
 * Provides:
 * - Severity levels with exit code mapping
 * - Common stdin reading with timeout
 * - Metrics tracking helpers
 * - Box drawing utilities
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// =============================================================================
// SEVERITY LEVELS
// =============================================================================

/**
 * Severity levels for hook messages
 * Maps to exit codes: INFO/WARNING = 0 (allow), ERROR = 1 (block)
 */
const SEVERITY = {
  INFO: { level: 'info', exitCode: 0, icon: 'ℹ️', color: 'blue' },
  WARNING: { level: 'warning', exitCode: 0, icon: '⚠️', color: 'yellow' },
  ERROR: { level: 'error', exitCode: 1, icon: '❌', color: 'red' },
  SUCCESS: { level: 'success', exitCode: 0, icon: '✅', color: 'green' },
};

/**
 * Exit with appropriate code based on severity
 * @param {Object} severity - SEVERITY constant
 * @param {string} message - Optional message to log
 */
function exitWithSeverity(severity, message = null) {
  if (message) {
    const stream = severity.exitCode === 0 ? console.log : console.error;
    stream(`${severity.icon} ${message}`);
  }
  process.exit(severity.exitCode);
}

// =============================================================================
// STDIN UTILITIES
// =============================================================================

/**
 * Read stdin with timeout (prevents hanging)
 * @param {number} timeoutMs - Timeout in milliseconds (default 1000)
 * @returns {Promise<string>} - Input string or empty if timeout
 */
async function readStdinWithTimeout(timeoutMs = 1000) {
  return new Promise((resolve) => {
    let input = '';
    const rl = readline.createInterface({
      input: process.stdin,
      terminal: false
    });

    const timeout = setTimeout(() => {
      rl.close();
      resolve(input);
    }, timeoutMs);

    rl.on('line', (line) => {
      input += line;
    });

    rl.on('close', () => {
      clearTimeout(timeout);
      resolve(input);
    });

    rl.on('error', () => {
      clearTimeout(timeout);
      resolve(input);
    });
  });
}

/**
 * Parse tool input from stdin
 * @param {string} input - Raw stdin input
 * @returns {Object|null} - Parsed tool input or null
 */
function parseToolInput(input) {
  if (!input || !input.trim()) return null;

  try {
    const data = JSON.parse(input);
    return data.tool_input || data;
  } catch (e) {
    // Not JSON, return as-is
    return { raw: input.trim() };
  }
}

// =============================================================================
// METRICS UTILITIES
// =============================================================================

const METRICS_DIR = path.join(process.cwd(), '.claude');

/**
 * Load metrics file (creates if doesn't exist)
 * @param {string} filename - Metrics file name
 * @param {Object} defaultData - Default data if file doesn't exist
 * @returns {Object} - Loaded data
 */
function loadMetrics(filename, defaultData = {}) {
  const filepath = path.join(METRICS_DIR, filename);
  try {
    if (fs.existsSync(filepath)) {
      return JSON.parse(fs.readFileSync(filepath, 'utf8'));
    }
  } catch (e) {}
  return { ...defaultData, lastUpdate: new Date().toISOString() };
}

/**
 * Save metrics file
 * @param {string} filename - Metrics file name
 * @param {Object} data - Data to save
 */
function saveMetrics(filename, data) {
  const filepath = path.join(METRICS_DIR, filename);
  try {
    data.lastUpdate = new Date().toISOString();
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  } catch (e) {}
}

/**
 * Increment a counter in metrics file
 * @param {string} filename - Metrics file name
 * @param {string} key - Counter key
 * @param {number} amount - Amount to add (default 1)
 */
function incrementMetric(filename, key, amount = 1) {
  const data = loadMetrics(filename, { counters: {} });
  if (!data.counters) data.counters = {};
  data.counters[key] = (data.counters[key] || 0) + amount;
  saveMetrics(filename, data);
}

// =============================================================================
// BOX DRAWING UTILITIES
// =============================================================================

const BOX_WIDTH = 61; // Standard box width

/**
 * Draw a box with title and content lines
 * @param {Object} options - Box options
 * @param {string} options.title - Box title
 * @param {string[]} options.lines - Content lines
 * @param {string} options.style - 'info', 'warning', 'error', 'success'
 * @param {boolean} options.useStderr - Output to stderr (for blocking hooks)
 */
function drawBox({ title, lines, style = 'info', useStderr = false }) {
  const output = useStderr ? console.error : console.log;
  const innerWidth = BOX_WIDTH - 4; // Account for borders and padding

  output('');
  output('┌' + '─'.repeat(BOX_WIDTH - 2) + '┐');

  if (title) {
    const icon = SEVERITY[style.toUpperCase()]?.icon || '';
    const titleWithIcon = icon ? `${icon}  ${title}` : title;
    const padding = innerWidth - titleWithIcon.length;
    output(`│  ${titleWithIcon}${' '.repeat(Math.max(0, padding))}│`);
    output('├' + '─'.repeat(BOX_WIDTH - 2) + '┤');
  }

  for (const line of lines) {
    if (line === '---') {
      output('├' + '─'.repeat(BOX_WIDTH - 2) + '┤');
    } else if (line === '') {
      output('│' + ' '.repeat(BOX_WIDTH - 2) + '│');
    } else {
      const padding = innerWidth - line.length;
      output(`│  ${line}${' '.repeat(Math.max(0, padding))}│`);
    }
  }

  output('└' + '─'.repeat(BOX_WIDTH - 2) + '┘');
  output('');
}

// =============================================================================
// PROJECT FILE UTILITIES
// =============================================================================

const PROJECTS_FILE = path.join(process.cwd(), '.claude', 'projects.json');

/**
 * Get the active project file path
 * @returns {string|null} - Project file path or null
 */
function getActiveProjectFile() {
  try {
    if (!fs.existsSync(PROJECTS_FILE)) return null;
    const projects = JSON.parse(fs.readFileSync(PROJECTS_FILE, 'utf8'));
    if (projects.active?.length > 0) {
      return projects.active[0].file;
    }
  } catch (e) {}
  return null;
}

/**
 * Read active project file content
 * @returns {string|null} - Project file content or null
 */
function readActiveProjectContent() {
  const projectFile = getActiveProjectFile();
  if (!projectFile) return null;

  const projectPath = path.join(process.cwd(), projectFile);
  if (!fs.existsSync(projectPath)) return null;

  return fs.readFileSync(projectPath, 'utf8');
}

// =============================================================================
// EXPORTS
// =============================================================================

module.exports = {
  SEVERITY,
  exitWithSeverity,
  readStdinWithTimeout,
  parseToolInput,
  loadMetrics,
  saveMetrics,
  incrementMetric,
  drawBox,
  getActiveProjectFile,
  readActiveProjectContent,
  BOX_WIDTH,
};
