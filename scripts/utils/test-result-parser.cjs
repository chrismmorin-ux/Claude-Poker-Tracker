/**
 * test-result-parser.cjs - Parse test output for detailed failure info
 *
 * Handles vitest and npm test output formats
 */

/**
 * Parse test output to extract detailed results
 * @param {string} stdout - Test command stdout
 * @param {string} stderr - Test command stderr
 * @param {number} exitCode - Process exit code
 * @returns {object|null} Parsed test results or null if unparseable
 */
function parseTestOutput(stdout, stderr, exitCode) {
  const combined = `${stdout || ''}\n${stderr || ''}`;

  // Try vitest format first
  const vitestResult = parseVitestOutput(combined);
  if (vitestResult) return vitestResult;

  // Try npm test error format
  const npmResult = parseNpmError(combined);
  if (npmResult) return npmResult;

  // Try generic test output (look for pass/fail counts)
  const genericResult = parseGenericTestOutput(combined, exitCode);
  if (genericResult) return genericResult;

  // Unparseable - return basic result
  return {
    tests_run: null,
    tests_passed: null,
    tests_failed: null,
    failure_summary: exitCode !== 0 ? truncate(combined, 500) : null,
    error_type: exitCode !== 0 ? 'unknown' : null
  };
}

/**
 * Parse vitest output format
 */
function parseVitestOutput(content) {
  // Match vitest summary: "Tests  5 passed (5)"
  const passMatch = content.match(/Tests?\s+(\d+)\s+passed/i);
  const failMatch = content.match(/Tests?\s+(\d+)\s+failed/i);
  const skipMatch = content.match(/Tests?\s+(\d+)\s+skipped/i);

  // Alternative format: "✓ 5 passed" or "× 2 failed"
  const altPassMatch = content.match(/[✓✔]\s*(\d+)\s+passed/);
  const altFailMatch = content.match(/[×✗]\s*(\d+)\s+failed/);

  const passed = parseInt(passMatch?.[1] || altPassMatch?.[1] || '0');
  const failed = parseInt(failMatch?.[1] || altFailMatch?.[1] || '0');
  const skipped = parseInt(skipMatch?.[1] || '0');

  if (passed === 0 && failed === 0) return null;

  // Extract first error message
  let failureSummary = null;
  let errorType = null;

  if (failed > 0) {
    // Look for AssertionError, TypeError, etc.
    const errorMatch = content.match(/(AssertionError|TypeError|ReferenceError|SyntaxError|Error):\s*([^\n]+)/);
    if (errorMatch) {
      errorType = errorMatch[1].toLowerCase().replace('error', '_error');
      failureSummary = truncate(errorMatch[2], 500);
    } else {
      // Look for FAIL block
      const failBlock = content.match(/FAIL\s+[\s\S]*?(?=\n\n|\nTests|\n\s*$)/);
      if (failBlock) {
        failureSummary = truncate(failBlock[0], 500);
      }
    }
    errorType = errorType || 'test_failure';
  }

  return {
    tests_run: passed + failed + skipped,
    tests_passed: passed,
    tests_failed: failed,
    failure_summary: failureSummary,
    error_type: errorType
  };
}

/**
 * Parse npm error output
 */
function parseNpmError(content) {
  if (!content.includes('npm ERR!')) return null;

  const errorLines = content.split('\n')
    .filter(line => line.includes('npm ERR!'))
    .map(line => line.replace('npm ERR!', '').trim())
    .filter(line => line.length > 0);

  const summary = truncate(errorLines.join('; '), 500);

  return {
    tests_run: null,
    tests_passed: null,
    tests_failed: null,
    failure_summary: summary,
    error_type: 'npm_error'
  };
}

/**
 * Parse generic test output looking for pass/fail patterns
 */
function parseGenericTestOutput(content, exitCode) {
  // Look for "X passing", "X failing" patterns (mocha style)
  const passingMatch = content.match(/(\d+)\s+passing/i);
  const failingMatch = content.match(/(\d+)\s+failing/i);

  // Look for "Tests: X passed, Y failed"
  const testsMatch = content.match(/Tests?:\s*(\d+)\s*passed(?:,\s*(\d+)\s*failed)?/i);

  let passed = parseInt(passingMatch?.[1] || testsMatch?.[1] || '0');
  let failed = parseInt(failingMatch?.[1] || testsMatch?.[2] || '0');

  if (passed === 0 && failed === 0 && exitCode !== 0) {
    // No test counts found but exit code indicates failure
    return {
      tests_run: null,
      tests_passed: null,
      tests_failed: null,
      failure_summary: truncate(content, 500),
      error_type: 'execution_error'
    };
  }

  if (passed === 0 && failed === 0) return null;

  return {
    tests_run: passed + failed,
    tests_passed: passed,
    tests_failed: failed,
    failure_summary: failed > 0 ? truncate(content, 500) : null,
    error_type: failed > 0 ? 'test_failure' : null
  };
}

/**
 * Truncate string to max length
 */
function truncate(str, maxLen) {
  if (!str) return null;
  str = str.trim();
  return str.length > maxLen ? str.slice(0, maxLen - 3) + '...' : str;
}

module.exports = { parseTestOutput };
