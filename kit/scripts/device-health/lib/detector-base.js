/**
 * detector-base — shared contract + helpers for device-health detectors.
 *
 * Each detector module exports an object matching DetectorContract:
 *   {
 *     id: 'DEV-INV-001',
 *     rule_type: 'invariant' | 'best_practice',
 *     description: '<short technical statement>',
 *     platforms: ['win32', 'darwin', 'linux'],   // detector skipped if current platform not listed
 *     default_severity: 'critical' | 'high' | 'medium' | 'low',
 *     run: async (ctx) => DetectorResult,
 *   }
 *
 * DetectorResult shape:
 *   {
 *     status: 'passing' | 'violating' | 'unknown',
 *     severity: 'critical' | 'high' | 'medium' | 'low',  // can override default for context
 *     evidence: { ... },                                  // structured machine-readable data
 *     message: string,                                    // single-sentence human summary
 *   }
 *
 * Per AS-PL-1 / AS-107: detectors must NOT use AI/LLM in the read path.
 * Pure deterministic Node.js + child_process is the budget.
 */

'use strict';

const RULE_TYPES = ['invariant', 'best_practice'];
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const STATUSES = ['passing', 'violating', 'unknown'];

function ok(evidence, message) {
  return { status: 'passing', severity: 'low', evidence: evidence || {}, message: message || '' };
}

function violate(severity, evidence, message) {
  return { status: 'violating', severity, evidence: evidence || {}, message: message || '' };
}

function unknown(evidence, message) {
  return { status: 'unknown', severity: 'low', evidence: evidence || {}, message: message || '' };
}

/**
 * Validate a detector module shape at load time.
 * Returns array of issues (empty = valid).
 */
function validateContract(detector) {
  const issues = [];
  if (!detector || typeof detector !== 'object') return ['detector is not an object'];
  if (!/^DEV-(INV|BP)-\d{3}$/.test(detector.id || '')) issues.push(`invalid id: ${detector.id}`);
  if (!RULE_TYPES.includes(detector.rule_type)) issues.push(`invalid rule_type: ${detector.rule_type}`);
  if (typeof detector.description !== 'string' || !detector.description) issues.push('missing description');
  if (!Array.isArray(detector.platforms) || detector.platforms.length === 0) issues.push('platforms must be non-empty array');
  if (!SEVERITIES.includes(detector.default_severity)) issues.push(`invalid default_severity: ${detector.default_severity}`);
  if (typeof detector.run !== 'function') issues.push('run must be a function');
  return issues;
}

/**
 * Validate a detector result at runtime.
 */
function validateResult(result) {
  const issues = [];
  if (!result || typeof result !== 'object') return ['result is not an object'];
  if (!STATUSES.includes(result.status)) issues.push(`invalid status: ${result.status}`);
  if (!SEVERITIES.includes(result.severity)) issues.push(`invalid severity: ${result.severity}`);
  if (typeof result.evidence !== 'object') issues.push('evidence must be object');
  if (typeof result.message !== 'string') issues.push('message must be string');
  return issues;
}

module.exports = {
  RULE_TYPES,
  SEVERITIES,
  STATUSES,
  ok,
  violate,
  unknown,
  validateContract,
  validateResult,
};
