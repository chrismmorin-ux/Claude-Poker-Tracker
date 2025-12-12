#!/usr/bin/env node

/**
 * Invariant Test Generator
 *
 * Auto-generates test tasks for persistence/reducer/hydration changes.
 *
 * Usage:
 *   node scripts/invariant-test-generator.cjs <task-object-json>
 *   echo '<task-json>' | node scripts/invariant-test-generator.cjs
 *
 * Returns:
 *   - null if no invariant test needed
 *   - Test task object if invariant test required
 */

const fs = require('fs');
const path = require('path');

// Patterns that require invariant tests
const CRITICAL_FILE_PATTERNS = [
  /src\/reducers\/.*\.jsx?$/,
  /src\/utils\/persistence.*\.jsx?$/,
  /src\/utils\/hydration.*\.jsx?$/,
  /src\/contexts\/.*\.jsx?$/,  // Context providers can affect state
];

// File patterns that should be tested
const REQUIRES_INVARIANT_TEST = (filePath) => {
  return CRITICAL_FILE_PATTERNS.some(pattern => pattern.test(filePath));
};

/**
 * Generate assertions based on file type
 */
function generateAssertions(filePath, taskDescription) {
  const assertions = [];

  if (filePath.includes('reducers/')) {
    assertions.push('Reducer returns valid state shape');
    assertions.push('Reducer handles all required actions');
    assertions.push('Reducer maintains immutability');
    assertions.push('Invalid actions return unchanged state');
  }

  if (filePath.includes('persistence')) {
    assertions.push('Persistence saves data correctly');
    assertions.push('Persistence loads data correctly');
    assertions.push('Handles missing/corrupt data gracefully');
    assertions.push('Migration paths preserve data integrity');
  }

  if (filePath.includes('hydration')) {
    assertions.push('Hydration restores complete state');
    assertions.push('Missing fields use correct defaults');
    assertions.push('Legacy data formats upgrade correctly');
  }

  if (filePath.includes('contexts/')) {
    assertions.push('Context provides all required values');
    assertions.push('Context updates propagate correctly');
    assertions.push('Context handles edge cases');
  }

  return assertions;
}

/**
 * Determine test file path from source file
 */
function getTestFilePath(sourceFile) {
  const parsed = path.parse(sourceFile);

  // If source is in src/, put test in src/__tests__/
  if (sourceFile.startsWith('src/')) {
    const relativePath = sourceFile.substring(4); // Remove 'src/'
    const testDir = path.join('src', '__tests__', path.dirname(relativePath));
    const testFile = `${parsed.name}.test${parsed.ext}`;
    return path.join(testDir, testFile).replace(/\\/g, '/');
  }

  // Otherwise, put test in same directory
  return path.join(parsed.dir, `${parsed.name}.test${parsed.ext}`).replace(/\\/g, '/');
}

/**
 * Generate next test task ID
 */
function generateTestTaskId(parentId) {
  // Extract prefix and number: T-P5-001 -> T-P5 and 001
  const match = parentId.match(/^(T-[A-Z0-9]+)-(\d{3})$/);
  if (!match) {
    throw new Error(`Invalid parent task ID format: ${parentId}`);
  }

  const prefix = match[1];
  const number = parseInt(match[2], 10);
  const testNumber = number + 1000; // Tests start at +1000

  return `${prefix}-${String(testNumber).padStart(3, '0')}`;
}

/**
 * Generate invariant test task for a given task
 */
function generateInvariantTest(task) {
  // Check if any files require invariant testing
  const criticalFiles = task.files_touched.filter(REQUIRES_INVARIANT_TEST);

  if (criticalFiles.length === 0) {
    return null; // No invariant test needed
  }

  // Use first critical file as primary target
  const primaryFile = criticalFiles[0];
  const testFile = getTestFilePath(primaryFile);
  const assertions = generateAssertions(primaryFile, task.description);

  // Generate test task
  const testTask = {
    id: generateTestTaskId(task.id),
    parent_id: task.id,
    title: `Invariant tests for ${path.basename(primaryFile)}`,
    description: `Auto-generated invariant tests for changes to ${primaryFile}. Validates: ${assertions.join(', ')}.`,
    files_touched: [testFile],
    est_lines_changed: Math.min(assertions.length * 20, 200), // ~20 lines per assertion
    est_local_effort_mins: Math.min(assertions.length * 10, 45), // ~10 min per assertion
    test_command: 'npm test -- ' + testFile.replace(/\\/g, '/'),
    assigned_to: 'local:qwen',
    priority: task.priority,
    status: 'open',
    inputs: [
      `Source file: ${primaryFile}`,
      `Parent task: ${task.id}`,
      'Test assertions: ' + assertions.join('; ')
    ],
    outputs: [
      `Comprehensive test suite for ${primaryFile}`,
      'All invariant assertions validated'
    ],
    constraints: [
      'Use Vitest framework',
      'Test all critical code paths',
      'Mock external dependencies',
      'Achieve 90%+ coverage for modified code'
    ],
    needs_context: [
      {
        path: primaryFile,
        lines_start: 1,
        lines_end: 9999 // Request full file for test generation
      }
    ],
    invariant_test: {
      target: primaryFile,
      assertions: assertions
    }
  };

  return testTask;
}

/**
 * Main execution
 */
async function main() {
  try {
    let input = '';

    // Read from stdin or file
    if (process.argv[2]) {
      const taskJson = process.argv[2];
      input = taskJson;
    } else {
      // Read from stdin
      input = fs.readFileSync(0, 'utf-8');
    }

    const task = JSON.parse(input);

    // Validate task has required fields
    if (!task.id || !task.files_touched || !Array.isArray(task.files_touched)) {
      console.error('Invalid task object: missing id or files_touched');
      process.exit(1);
    }

    // Generate invariant test
    const testTask = generateInvariantTest(task);

    if (testTask) {
      console.log(JSON.stringify(testTask, null, 2));
      process.exit(0);
    } else {
      // No test needed
      console.log('null');
      process.exit(0);
    }

  } catch (error) {
    console.error('Error generating invariant test:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  generateInvariantTest,
  REQUIRES_INVARIANT_TEST,
  generateAssertions,
  getTestFilePath,
  generateTestTaskId
};
