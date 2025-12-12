const fs = require('fs');
const path = require('path');

function formatErrorMessage(filename, taskId, assignedModel, dispatcherCommands, policyReference) {
  const boxWidth = 80;
  const errorIcon = '🚫';
  const padding = ' '.repeat(2);

  return `
┌${'─'.repeat(boxWidth)}┐
│ ${errorIcon} DELEGATION VIOLATION DETECTED                          │
├${'─'.repeat(boxWidth)}┤
│ File: ${filename}                                               │
│ Task ID: ${taskId}                                              │
│ Assigned Model: ${assignedModel}                                │
│ Dispatcher Commands: ${dispatcherCommands.join(', ')}           │
│ Policy Reference: ${policyReference}                            │
└${'─'.repeat(boxWidth)}┘
`;
}

async function main() {
  // Get the filename from environment or stdin
  let input = '';
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin });
  for await (const line of rl) { input += line; }

  let filename;
  try {
    const data = JSON.parse(input);
    filename = data.tool_input?.file_path || data.file_path;
  } catch (e) {
    // If not JSON, might be raw path
    filename = input.trim();
  }

  if (!filename) {
    process.exit(0);
  }

  // Skip non-source files
  if (!filename.match(/\.(jsx?|tsx?|cjs|mjs)$/)) {
    process.exit(0);
  }

  // Get active project file
  const projectFile = getActiveProjectFile();
  if (!projectFile) {
    process.exit(0);
  }

  const projectPath = path.join(process.cwd(), projectFile);
  if (!fs.existsSync(projectPath)) {
    process.exit(0);
  }

  const projectContent = fs.readFileSync(projectPath, 'utf8');

  // Check if this file should have been delegated
  if (checkDelegationTable(projectContent, filename)) {
    const basename = path.basename(filename);
    const taskId = '12345'; // Replace with actual task ID
    const assignedModel = 'ChatGPT-4';
    const dispatcherCommands = ['dispatch', 'redelegate'];
    const policyReference = 'DECOMPOSITION_POLICY.md#section-10';

    const errorMessage = formatErrorMessage(basename, taskId, assignedModel, dispatcherCommands, policyReference);
    console.log(errorMessage);

    // Block the write operation
    process.exit(1);
  }
}

main();
