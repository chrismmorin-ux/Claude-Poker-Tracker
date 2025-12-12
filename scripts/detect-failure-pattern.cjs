#!/usr/bin/env node
/**
 * detect-failure-pattern.cjs - Detect if a task failure matches known patterns
 *
 * Usage:
 *   const { detectPattern, updatePatternOccurrence } = require('./detect-failure-pattern.cjs');
 *   const match = detectPattern(taskLogEntry);
 *   if (match) updatePatternOccurrence(match.pattern_id, taskId);
 */

const fs = require('fs');
const path = require('path');

const PATTERNS_FILE = path.join(process.cwd(), '.claude', 'learning', 'failure-patterns.json');

/**
 * Load failure patterns from file
 * @returns {object} Patterns data or empty patterns array
 */
function loadPatterns() {
  try {
    if (!fs.existsSync(PATTERNS_FILE)) {
      return { patterns: [] };
    }
    return JSON.parse(fs.readFileSync(PATTERNS_FILE, 'utf8'));
  } catch (e) {
    console.error('Failed to load patterns:', e.message);
    return { patterns: [] };
  }
}

/**
 * Save patterns to file
 * @param {object} data - Patterns data to save
 */
function savePatterns(data) {
  try {
    data.updated_at = new Date().toISOString();
    data.stats = {
      total_patterns: data.patterns.length,
      mitigated: data.patterns.filter(p => p.mitigation_status === 'implemented' || p.mitigation_status === 'verified').length,
      unmitigated: data.patterns.filter(p => p.mitigation_status === 'none' || p.mitigation_status === 'proposed').length
    };
    fs.writeFileSync(PATTERNS_FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save patterns:', e.message);
  }
}

/**
 * Detect if a task failure matches a known pattern
 * @param {object} taskLog - Task log entry with status, output, failure_classification, etc.
 * @returns {object|null} Matching pattern or null
 */
function detectPattern(taskLog) {
  if (!taskLog || taskLog.status !== 'failed') {
    return null;
  }

  const data = loadPatterns();
  const errorText = [
    taskLog.failure_classification || '',
    taskLog.output?.stderr || '',
    taskLog.output?.stdout || '',
    taskLog.test_result?.failure_summary || ''
  ].join(' ').toLowerCase();

  for (const pattern of data.patterns) {
    if (!pattern.signature) continue;

    // Check error_contains matches
    if (pattern.signature.error_contains) {
      const matches = pattern.signature.error_contains.some(term =>
        errorText.includes(term.toLowerCase())
      );
      if (matches) {
        return pattern;
      }
    }

    // Check task_type matches
    if (pattern.signature.task_type && taskLog.task_type === pattern.signature.task_type) {
      return pattern;
    }
  }

  return null;
}

/**
 * Update pattern with new occurrence
 * @param {string} patternId - Pattern ID (e.g., 'FP-001')
 * @param {string} taskId - Task ID that failed
 * @param {string} outcome - 'failed', 'mitigated', or 'success'
 */
function updatePatternOccurrence(patternId, taskId, outcome = 'failed') {
  const data = loadPatterns();
  const pattern = data.patterns.find(p => p.pattern_id === patternId);

  if (!pattern) {
    console.error(`Pattern not found: ${patternId}`);
    return;
  }

  // Add occurrence
  if (!pattern.occurrences) {
    pattern.occurrences = [];
  }

  const today = new Date().toISOString().split('T')[0];

  // Check if this task already recorded today
  const existing = pattern.occurrences.find(o => o.task_id === taskId && o.date === today);
  if (!existing) {
    pattern.occurrences.push({
      task_id: taskId,
      date: today,
      outcome: outcome
    });
    pattern.last_seen = today;
  }

  savePatterns(data);
  console.log(`📊 Pattern ${patternId} updated with occurrence: ${taskId}`);
}

/**
 * Get pattern statistics
 * @returns {object} Stats summary
 */
function getPatternStats() {
  const data = loadPatterns();
  return {
    total: data.patterns.length,
    mitigated: data.stats?.mitigated || 0,
    unmitigated: data.stats?.unmitigated || 0,
    patterns: data.patterns.map(p => ({
      id: p.pattern_id,
      name: p.name,
      occurrences: p.occurrences?.length || 0,
      status: p.mitigation_status
    }))
  };
}

module.exports = {
  detectPattern,
  updatePatternOccurrence,
  getPatternStats,
  loadPatterns,
  savePatterns
};

// CLI mode
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === 'stats') {
    const stats = getPatternStats();
    console.log('\n=== Failure Pattern Statistics ===\n');
    console.log(`Total patterns: ${stats.total}`);
    console.log(`Mitigated: ${stats.mitigated}`);
    console.log(`Unmitigated: ${stats.unmitigated}`);
    console.log('\nPatterns:');
    stats.patterns.forEach(p => {
      console.log(`  ${p.id}: ${p.name} (${p.occurrences} occurrences) [${p.status}]`);
    });
  } else {
    console.log('Usage: node detect-failure-pattern.cjs stats');
  }
}
