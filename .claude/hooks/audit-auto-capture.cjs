#!/usr/bin/env node
/**
 * audit-auto-capture.cjs - Auto-capture audits from known commands
 *
 * PostToolUse hook that detects audit-generating commands and saves findings.
 * Runs after: /cto-review, /process-audit, /audit-component, /efficiency-analysis
 */

const fs = require('fs');
const path = require('path');

const AUDIT_COMMANDS = [
  'cto-review',
  'cto-debt',
  'process-audit',
  'process-review',
  'process-system-audit',
  'process-maturity',
  'process-slim',
  'audit-component',
  'efficiency-analysis',
  'review'  // code-reviewer
];

const COMMAND_TO_TYPE = {
  'cto-review': 'cto-review',
  'cto-debt': 'cto-review',
  'process-audit': 'process-specialist',
  'process-review': 'process-specialist',
  'process-system-audit': 'process-specialist',
  'process-maturity': 'process-specialist',
  'process-slim': 'token-optimization',
  'audit-component': 'component-audit',
  'efficiency-analysis': 'efficiency',
  'review': 'code-review'
};

const AUDIT_DIR = path.join(__dirname, '..', 'audits');
const REGISTRY_PATH = path.join(AUDIT_DIR, 'registry.json');
const PENDING_DIR = path.join(AUDIT_DIR, 'pending');

function readRegistry() {
  try {
    return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
  } catch {
    return { audits: [], stats: { pending: 0, actioned: 0, dismissed: 0 }, nextId: 1 };
  }
}

function writeRegistry(registry) {
  registry.stats.lastUpdated = new Date().toISOString();
  fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function getNextSequenceForType(registry, type) {
  // Count existing audits of this type to get next sequence
  const typeAudits = registry.audits.filter(a => a.type === type);
  return typeAudits.length + 1;
}

function getDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${month}${day}`;
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')  // Remove special chars
    .replace(/\s+/g, '-')           // Spaces to dashes
    .replace(/-+/g, '-')            // Collapse multiple dashes
    .substring(0, 40)               // Limit length
    .replace(/-$/, '');             // Remove trailing dash
}

function generateAuditId(registry, type, title) {
  const seq = String(getNextSequenceForType(registry, type)).padStart(3, '0');
  const date = getDateString();
  const titleSlug = slugify(title);
  // Format: {type}.{sequence}.{MMDD}-{title} (e.g., cto-review.001.1211-architecture-concerns)
  return `${type}.${seq}.${date}-${titleSlug}`;
}

function detectSeverity(output) {
  const lowerOutput = (output || '').toLowerCase();
  if (lowerOutput.includes('critical') || lowerOutput.includes('security') || lowerOutput.includes('urgent')) {
    return 'critical';
  }
  if (lowerOutput.includes('high') || lowerOutput.includes('important') || lowerOutput.includes('significant')) {
    return 'high';
  }
  if (lowerOutput.includes('minor') || lowerOutput.includes('low') || lowerOutput.includes('optional')) {
    return 'low';
  }
  return 'medium';
}

function extractTitle(command, output) {
  // Try to extract a meaningful title from output
  const lines = (output || '').split('\n').filter(l => l.trim());

  // Look for summary or title patterns
  for (const line of lines.slice(0, 10)) {
    if (line.includes('Summary:') || line.includes('Title:')) {
      return line.split(':').slice(1).join(':').trim().substring(0, 60);
    }
    // First non-empty line that looks like a title
    if (line.length > 10 && line.length < 80 && !line.startsWith('#') && !line.startsWith('-')) {
      return line.trim().substring(0, 60);
    }
  }

  return `${command} audit - ${new Date().toLocaleDateString()}`;
}

function createAuditReport(auditId, type, title, severity, output, command) {
  const timestamp = new Date().toISOString();

  return `# Audit Report: ${auditId}

**Type**: ${type}
**Status**: pending
**Created**: ${timestamp}
**Severity**: ${severity}
**Source**: /${command}

---

## Executive Summary
Auto-captured from \`/${command}\` command.

## Findings
${output ? output.substring(0, 5000) : 'No output captured'}

## Recommendations
Review the findings above and determine actionable items.

## Actionable Items
- [ ] Review findings
- [ ] Create backlog items for actionable recommendations
- [ ] Link to relevant projects if applicable

---

**To review**: \`/audit-review ${auditId}\`
**To dismiss**: \`/audit-review ${auditId} --dismiss\`
`;
}

async function main() {
  // Read stdin for hook event data
  let inputData = '';

  // Check if there's data on stdin
  if (!process.stdin.isTTY) {
    try {
      inputData = fs.readFileSync(0, 'utf8');
    } catch {
      // No stdin data
    }
  }

  // Parse event data
  let event = {};
  try {
    event = JSON.parse(inputData);
  } catch {
    // Not JSON input, might be direct invocation
    process.exit(0);
  }

  // Check if this is a SlashCommand tool use
  const tool = event.tool || '';
  const input = event.input || {};
  const output = event.output || '';

  if (tool !== 'SlashCommand') {
    process.exit(0);
  }

  // Extract command name from input
  const command = (input.command || '').replace(/^\//, '').split(' ')[0];

  if (!AUDIT_COMMANDS.includes(command)) {
    process.exit(0);
  }

  // This is an audit command - capture it
  const registry = readRegistry();
  const type = COMMAND_TO_TYPE[command] || 'general';
  const severity = detectSeverity(output);
  const title = extractTitle(command, output);

  // Generate audit ID: {type}.{sequence}.{MMDD}-{title}
  const auditId = generateAuditId(registry, type, title);

  // Create audit report
  const report = createAuditReport(auditId, type, title, severity, output, command);
  const reportPath = path.join(PENDING_DIR, `${auditId}.md`);

  // Ensure pending directory exists
  if (!fs.existsSync(PENDING_DIR)) {
    fs.mkdirSync(PENDING_DIR, { recursive: true });
  }

  // Save report
  fs.writeFileSync(reportPath, report);

  // Update registry
  registry.audits.push({
    id: auditId,
    type: type,
    status: 'pending',
    severity: severity,
    created: new Date().toISOString(),
    title: title,
    file: reportPath,
    source: `/${command}`,
    linkedTo: [],
    reviewedDate: null
  });

  // Update stats (sequence is tracked per-type, not globally)
  registry.stats.pending = registry.audits.filter(a => a.status === 'pending').length;
  registry.stats.actioned = registry.audits.filter(a => a.status === 'actioned').length;
  registry.stats.dismissed = registry.audits.filter(a => a.status === 'dismissed').length;

  writeRegistry(registry);

  // Output notification
  console.log(`\n📋 Audit captured: ${auditId} (${severity}) - ${title.substring(0, 40)}...`);
  console.log(`   Review with: /audit-review ${auditId}\n`);
}

main().catch(err => {
  console.error('Audit capture error:', err.message);
  process.exit(0); // Don't block on errors
});
