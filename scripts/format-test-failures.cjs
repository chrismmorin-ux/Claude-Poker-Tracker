#!/usr/bin/env node
/**
 * Format Test Failures - Compact, token-efficient test failure output
 * Parses Vitest text output and shows only essential debugging info.
 *
 * Rewritten 2026-08-13: the original matched the first "N failed" in the
 * output — the Test FILES line — and reported "Failed: 1 tests" for a
 * 13-test failure, and it scanned for ❌/✖ markers Vitest v4 does not emit,
 * so it printed no per-test detail at all. A failure summary that
 * undercounts is worse than none: it reads as "almost green".
 */

const fs = require('fs');

const ANSI = /\[[0-9;]*m/g;

function formatTestFailures(outputFile) {
  let output;
  try {
    output = fs.readFileSync(outputFile, 'utf8').replace(ANSI, '');
  } catch (error) {
    console.error('⚠️  Error reading test output:', error.message);
    return;
  }

  try {
    const lines = output.split('\n');

    // The TESTS line, not the Test Files line — the two both say "N failed".
    const testsLine = output.match(/^\s*Tests\s+(\d+) failed \|\s*(\d+) passed/m);
    const filesLine = output.match(/^\s*Test Files\s+(\d+) failed \|\s*(\d+) passed/m);
    if (testsLine) {
      const files = filesLine ? ` across ${filesLine[1]} file(s)` : '';
      console.log(`Failed: ${testsLine[1]} test(s)${files} (${testsLine[2]} passed)\n`);
    }

    // Vitest v4 failure recap lines: "FAIL  <project>? <file> > <suite> > <test>".
    // Each is followed within a few lines by the error message and a
    // "❯ file:line:col" frame.
    let printed = 0;
    for (let i = 0; i < lines.length; i++) {
      const m = lines[i].match(/^\s*FAIL\s+(?:\S+\s+)?(\S+\.test\.[jt]sx?)\s*>\s*(.+)$/);
      if (!m) continue;

      console.log(`📍 ${m[1]}`);
      console.log(`   ✗ ${m[2].trim()}`);

      // Scan ahead for the first error line and the first source frame.
      let error = null;
      let frame = null;
      for (let j = i + 1; j < Math.min(i + 25, lines.length); j++) {
        if (/^\s*FAIL\s/.test(lines[j])) break; // next failure's recap
        if (!error) {
          const e = lines[j].match(/^\s*((?:AssertionError|\w*Error|expected)\b.*)$/);
          if (e && e[1].length < 300) error = e[1].trim();
        }
        if (!frame) {
          const f = lines[j].match(/^\s*❯\s+(\S+:\d+(?::\d+)?)/);
          if (f) frame = f[1];
        }
        if (error && frame) break;
      }
      if (error) console.log(`   ${error}`);
      if (frame) console.log(`   📄 ${frame}`);
      console.log('');
      printed++;
    }

    if (testsLine && printed === 0) {
      // Format drift guard: if Vitest's recap shape changes again, degrade to
      // raw output rather than to silence — silence is what hid 13 failures.
      console.log('⚠️  Could not locate per-test FAIL recap lines; last 60 lines of raw output:\n');
      console.log(lines.slice(-60).join('\n'));
    }

    console.log(`\n💡 Full output preserved in .test-output.tmp for this failed run`);
  } catch (error) {
    console.error('⚠️  Error parsing test output:', error.message);
    console.error('Showing last 50 lines of output:\n');
    console.log(output.split('\n').slice(-50).join('\n'));
  }
}

// Main execution
const outputFile = process.argv[2];

if (!outputFile) {
  console.error('Usage: node format-test-failures.cjs <test-output-file>');
  process.exit(1);
}

if (!fs.existsSync(outputFile)) {
  console.error(`File not found: ${outputFile}`);
  process.exit(1);
}

formatTestFailures(outputFile);
