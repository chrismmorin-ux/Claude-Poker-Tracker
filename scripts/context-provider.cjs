#!/usr/bin/env node
/**
 * context-provider.cjs - Extracts exact line ranges from files for local model context
 *
 * This script implements the needs_context protocol, providing local models with
 * ONLY the specific line ranges they request instead of full files.
 *
 * Usage:
 *   node scripts/context-provider.cjs <needs-context-json>
 *
 * Input format (JSON):
 *   [
 *     {"path": "src/utils/foo.js", "lines_start": 10, "lines_end": 50},
 *     {"path": "src/constants/bar.js", "lines_start": 1, "lines_end": 30}
 *   ]
 *
 * Output format (markdown):
 *   ### File: src/utils/foo.js (lines 10-50)
 *   ```javascript
 *   [extracted lines]
 *   ```
 *
 * Exit codes:
 *   0 - Success
 *   1 - Invalid input or missing files
 *   2 - File read errors
 */

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.join(__dirname, '..');

/**
 * Extract specific line range from a file
 * @param {string} filePath - Relative path from project root
 * @param {number} startLine - Start line (1-indexed, inclusive)
 * @param {number} endLine - End line (1-indexed, inclusive)
 * @returns {Object} { success: boolean, lines: string[], error?: string }
 */
function extractLineRange(filePath, startLine, endLine) {
  const fullPath = path.join(PROJECT_ROOT, filePath);

  // Validate file exists
  if (!fs.existsSync(fullPath)) {
    return {
      success: false,
      error: `File not found: ${filePath}`
    };
  }

  try {
    // Read file
    const content = fs.readFileSync(fullPath, 'utf8');
    const allLines = content.split('\n');

    // Validate line range
    if (startLine < 1 || startLine > allLines.length) {
      return {
        success: false,
        error: `Invalid start line ${startLine} (file has ${allLines.length} lines)`
      };
    }

    if (endLine < startLine) {
      return {
        success: false,
        error: `End line ${endLine} is before start line ${startLine}`
      };
    }

    // Extract range (convert to 0-indexed)
    const extractedLines = allLines.slice(startLine - 1, endLine);

    return {
      success: true,
      lines: extractedLines,
      totalLines: allLines.length
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to read file: ${error.message}`
    };
  }
}

/**
 * Detect language from file extension
 * @param {string} filePath - File path
 * @returns {string} Language identifier for code fence
 */
function detectLanguage(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const langMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.cjs': 'javascript',
    '.mjs': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.md': 'markdown',
    '.sh': 'bash',
    '.css': 'css',
    '.html': 'html',
    '.yml': 'yaml',
    '.yaml': 'yaml'
  };
  return langMap[ext] || '';
}

/**
 * Format extracted context as markdown section
 * @param {Object} contextRequest - { path, lines_start, lines_end }
 * @param {string[]} extractedLines - Lines of code
 * @param {number} totalLines - Total lines in file
 * @returns {string} Formatted markdown section
 */
function formatContextSection(contextRequest, extractedLines, totalLines) {
  const { path: filePath, lines_start, lines_end } = contextRequest;
  const lang = detectLanguage(filePath);
  const lineRange = `lines ${lines_start}-${lines_end}`;
  const ofTotal = totalLines ? ` of ${totalLines}` : '';

  return `
### File: ${filePath} (${lineRange}${ofTotal})
\`\`\`${lang}
${extractedLines.join('\n')}
\`\`\`
`;
}

/**
 * Process all context requests and generate formatted output
 * @param {Array} contextRequests - Array of { path, lines_start, lines_end }
 * @returns {Object} { success: boolean, output: string, errors: string[] }
 */
function processContextRequests(contextRequests) {
  const errors = [];
  const sections = [];

  for (const req of contextRequests) {
    // Validate request structure
    if (!req.path || typeof req.lines_start !== 'number' || typeof req.lines_end !== 'number') {
      errors.push(`Invalid context request: ${JSON.stringify(req)}`);
      continue;
    }

    // Extract lines
    const result = extractLineRange(req.path, req.lines_start, req.lines_end);

    if (!result.success) {
      errors.push(`${req.path}: ${result.error}`);
      continue;
    }

    // Format section
    const section = formatContextSection(req, result.lines, result.totalLines);
    sections.push(section);
  }

  return {
    success: errors.length === 0,
    output: sections.join('\n'),
    errors
  };
}

// Main execution
function main() {
  // Read input from stdin or args
  let input = '';

  if (process.argv.length > 2) {
    // From command line argument
    input = process.argv[2];
  } else {
    // From stdin (not supported in sync mode, show usage)
    console.error('Usage: node scripts/context-provider.cjs <needs-context-json>');
    console.error('Example: node scripts/context-provider.cjs \'[{"path":"src/foo.js","lines_start":1,"lines_end":10}]\'');
    process.exit(1);
  }

  // Parse JSON
  let contextRequests;
  try {
    contextRequests = JSON.parse(input);
    if (!Array.isArray(contextRequests)) {
      contextRequests = [contextRequests];
    }
  } catch (e) {
    console.error('Error: Invalid JSON input');
    console.error(e.message);
    process.exit(1);
  }

  // Process requests
  const result = processContextRequests(contextRequests);

  // Output results
  if (result.success) {
    console.log(result.output);
    process.exit(0);
  } else {
    console.error('Errors encountered:');
    result.errors.forEach(e => console.error(`  - ${e}`));
    console.error('\nPartial output:');
    console.log(result.output);
    process.exit(2);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

// Export for testing
module.exports = {
  extractLineRange,
  detectLanguage,
  formatContextSection,
  processContextRequests
};
