#!/usr/bin/env node
/**
 * Format Test Failures - Compact, token-efficient test failure output
 * Parses Vitest text output and shows only essential debugging info
 */

const fs = require('fs');
const path = require('path');

function formatTestFailures(outputFile) {
  try {
    const output = fs.readFileSync(outputFile, 'utf8');
    const lines = output.split('\n');

    // Extract summary info
    const failMatch = output.match(/(\d+) failed/);
    const passMatch = output.match(/(\d+) passed/);
    const totalMatch = output.match(/Test Files.*?(\d+) failed.*?(\d+) passed/);

    if (failMatch) {
      const failed = failMatch[1];
      const passed = passMatch ? passMatch[1] : '?';
      console.log(`Failed: ${failed} tests (${passed} passed)\n`);
    }

    // Find all FAIL markers and extract details
    let inFailure = false;
    let currentTest = null;
    let currentFile = null;
    let errorLines = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Detect test file with failures
      if (line.includes('FAIL') && line.includes('.test.')) {
        const fileMatch = line.match(/FAIL\s+(.+\.test\.[jt]sx?)/);
        if (fileMatch) {
          currentFile = fileMatch[1];
        }
      }

      // Detect individual failing test
      if (line.includes('❌') || line.match(/^\s*✖\s+/)) {
        if (currentTest && errorLines.length > 0) {
          printFailure(currentFile, currentTest, errorLines);
        }
        currentTest = line.replace(/[❌✖]/g, '').trim();
        errorLines = [];
        inFailure = true;
      }

      // Collect error details
      if (inFailure && (
        line.includes('Expected:') ||
        line.includes('Received:') ||
        line.includes('AssertionError') ||
        line.match(/Error:/)
      )) {
        errorLines.push(line.trim());
      }

      // Extract file location
      if (inFailure && line.match(/at\s+.*\((.+):(\d+):(\d+)\)/)) {
        const locationMatch = line.match(/at\s+.*\((.+):(\d+):(\d+)\)/);
        if (locationMatch && !errorLines.some(l => l.includes(locationMatch[1]))) {
          errorLines.push(`📄 ${locationMatch[1]}:${locationMatch[2]}`);
        }
      }
    }

    // Print last failure
    if (currentTest && errorLines.length > 0) {
      printFailure(currentFile, currentTest, errorLines);
    }

    console.log(`\n💡 Tip: Use Read tool with file paths above to debug`);
    console.log(`💡 Full output saved temporarily in .test-output.tmp`);

  } catch (error) {
    console.error('⚠️  Error parsing test output:', error.message);
    console.error('Showing last 50 lines of output:\n');
    const output = fs.readFileSync(outputFile, 'utf8');
    const lines = output.split('\n');
    console.log(lines.slice(-50).join('\n'));
  }
}

function printFailure(file, testName, errorLines) {
  if (file) {
    console.log(`📍 ${file}`);
  }
  console.log(`   ✗ ${testName}`);

  // Show only the most relevant error lines (max 5)
  const relevantLines = errorLines
    .filter(l => l && l.length < 200)
    .slice(0, 5);

  relevantLines.forEach(line => {
    console.log(`   ${line}`);
  });

  console.log(''); // Blank line
}

// Main execution
const outputFile = process.argv[2];

if (!outputFile) {
  console.error('Usage: node format-test-failures.js <test-output-file>');
  process.exit(1);
}

if (!fs.existsSync(outputFile)) {
  console.error(`File not found: ${outputFile}`);
  process.exit(1);
}

formatTestFailures(outputFile);
