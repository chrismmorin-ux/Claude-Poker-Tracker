#!/usr/bin/env node
/**
 * auto-project-create.cjs - Auto-create project from approved plan
 *
 * Triggers on ExitPlanMode when a plan file exists with:
 * - 3+ files to modify
 * - Multiple phases/steps
 * - No existing project for this work
 *
 * Creates project file and registers in projects.json
 */

const fs = require('fs');
const path = require('path');

const PROJECTS_DIR = path.join(__dirname, '..', '..', 'docs', 'projects');
const PROJECTS_JSON = path.join(__dirname, '..', 'projects.json');
const PLANS_DIR = path.join(process.env.USERPROFILE || process.env.HOME, '.claude', 'plans');

function getLatestPlanFile() {
  try {
    const files = fs.readdirSync(PLANS_DIR)
      .filter(f => f.endsWith('.md'))
      .map(f => ({
        name: f,
        path: path.join(PLANS_DIR, f),
        mtime: fs.statSync(path.join(PLANS_DIR, f)).mtime
      }))
      .sort((a, b) => b.mtime - a.mtime);

    return files[0] || null;
  } catch {
    return null;
  }
}

function analyzePlan(content) {
  // Count files to modify
  const fileMatches = content.match(/`[^`]+\.(js|jsx|ts|tsx|json|md)`/g) || [];
  const uniqueFiles = [...new Set(fileMatches)];

  // Count phases/steps
  const phaseMatches = content.match(/^##\s*(Phase|Step)\s+\d+/gim) || [];
  const stepMatches = content.match(/^###\s*(Step|Phase)\s+\d+/gim) || [];

  // Extract project name from title
  const titleMatch = content.match(/^#\s*(?:Plan:?\s*)?(.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Unnamed Project';

  return {
    title,
    fileCount: uniqueFiles.length,
    phaseCount: phaseMatches.length + stepMatches.length,
    isSubstantial: uniqueFiles.length >= 3 || phaseMatches.length >= 2
  };
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 40);
}

function projectExists(slug) {
  try {
    const files = fs.readdirSync(PROJECTS_DIR);
    return files.some(f => f.includes(slug));
  } catch {
    return false;
  }
}

function getNextSequence(priority) {
  try {
    const files = fs.readdirSync(PROJECTS_DIR);
    const sameP = files.filter(f => f.startsWith(`${priority}.`));
    const sequences = sameP.map(f => {
      const match = f.match(/^\d+\.(\d+)\./);
      return match ? parseInt(match[1]) : 0;
    });
    return Math.max(0, ...sequences) + 1;
  } catch {
    return 1;
  }
}

function createProject(analysis, planPath) {
  const slug = slugify(analysis.title);

  // Check if project already exists
  if (projectExists(slug)) {
    return { created: false, reason: 'Project already exists' };
  }

  const priority = 1; // Default to P1 for auto-created projects
  const sequence = getNextSequence(priority);
  const date = new Date().toISOString().slice(5, 7) + new Date().toISOString().slice(8, 10);
  const filename = `${priority}.${String(sequence).padStart(3, '0')}.${date}-${slug}.project.md`;
  const projectPath = path.join(PROJECTS_DIR, filename);

  // Create project content
  const content = `---
id: ${slug}
name: ${analysis.title}
status: active
priority: P${priority}
created: ${new Date().toISOString().split('T')[0]}
plan_file: ${planPath}
---

# Project: ${analysis.title}

## Quick Start for New Chats

1. Read this file first
2. Find the current phase (marked with \`<- CURRENT\`)
3. **DECOMPOSE** - Break work into atomic tasks (see below)
4. Read the "Context Files" for that phase
5. Execute via local models using dispatcher
6. Update status when complete

---

## Overview

Auto-generated from plan file. See plan for details.

**Plan file**: \`${planPath}\`

---

## Task Decomposition (MANDATORY)

**All implementation work must be decomposed into atomic tasks.**

### Atomic Criteria
| Criterion | Limit |
|-----------|-------|
| files_touched | ≤ 3 |
| est_lines_changed | ≤ 300 |
| test_command | Required |
| est_local_effort_mins | ≤ 60 |

### Workflow
1. **Decompose**: Break phase into atomic tasks using ///LOCAL_TASKS format
2. **Add to backlog**: \`node scripts/dispatcher.cjs add-tasks < tasks.json\`
3. **Execute**: \`node scripts/dispatcher.cjs assign-next\`
4. **Review**: Verify output, integrate changes
5. **Repeat**: Until phase complete

**See**: \`.claude/DECOMPOSITION_POLICY.md\` for full details

---

## Context Files

Files to read before starting work:
- See plan file for file list
- \`.claude/DECOMPOSITION_POLICY.md\` - Decomposition rules

---

## Phases

| Phase | Status | Description |
|-------|--------|-------------|
| 1 | [ ] | Implementation (see plan) |

---

## Phase 1: Implementation <- CURRENT

### Goal
Implement the approved plan.

### Files to Modify
See plan file: \`${planPath}\`

### Atomic Task Decomposition
(Tasks will be added here in ///LOCAL_TASKS format)

### Verification
- [ ] All atomic tasks completed
- [ ] Tests pass
- [ ] Build succeeds
- [ ] Feature works as expected

---

## Session Log

| Date | Session | Phase | Work Done |
|------|---------|-------|-----------|
| ${new Date().toISOString().split('T')[0]} | Initial | Planning | Auto-created from approved plan |

---

## Completion Checklist

Before marking project complete:
- [ ] All phases marked [x] COMPLETE
- [ ] All atomic tasks completed
- [ ] Tests passing
- [ ] Documentation updated
- [ ] Committed with descriptive message
`;

  fs.writeFileSync(projectPath, content);

  // Update projects.json
  try {
    const registry = JSON.parse(fs.readFileSync(PROJECTS_JSON, 'utf8'));
    registry.active.unshift({
      id: slug,
      name: analysis.title,
      file: `docs/projects/${filename}`,
      priority: `P${priority}`,
      phases: 1,
      phasesComplete: 0,
      description: `Auto-created from plan: ${analysis.title}`
    });
    registry.lastUpdated = new Date().toISOString();
    fs.writeFileSync(PROJECTS_JSON, JSON.stringify(registry, null, 2));
  } catch (e) {
    // Registry update failed, but project file was created
  }

  return {
    created: true,
    filename,
    path: projectPath
  };
}

function main() {
  // Get tool info from environment
  const toolName = process.env.CLAUDE_TOOL_NAME || '';

  // Only trigger on ExitPlanMode
  if (toolName !== 'ExitPlanMode') {
    process.exit(0);
    return;
  }

  // Find latest plan file
  const planFile = getLatestPlanFile();
  if (!planFile) {
    process.exit(0);
    return;
  }

  // Check if plan was recently modified (within last 5 minutes)
  const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
  if (planFile.mtime.getTime() < fiveMinutesAgo) {
    process.exit(0);
    return;
  }

  // Analyze plan
  const content = fs.readFileSync(planFile.path, 'utf8');
  const analysis = analyzePlan(content);

  // Only create project for substantial plans
  if (!analysis.isSubstantial) {
    process.exit(0);
    return;
  }

  // Create project
  const result = createProject(analysis, planFile.path);

  if (result.created) {
    console.log(`\n📁 Auto-created project: ${result.filename}`);
    console.log(`   Run \`/project resume ${slugify(analysis.title)}\` to view details\n`);
  }
}

main();
