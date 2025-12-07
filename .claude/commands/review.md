---
description: Review code changes for bugs, patterns, and quality
argument-hint: [scope: "staged" | "all" | "file:path"]
---

Use the **code-reviewer** subagent to review code changes.

## Review Scope

$ARGUMENTS

If no scope specified, review all uncommitted changes.

## Process

1. Identify changed files based on scope:
   - `staged` - Only staged changes (`git diff --cached`)
   - `all` - All uncommitted changes (`git diff HEAD`)
   - `file:path` - Specific file only

2. Read `CLAUDE.md` for project patterns

3. Apply the code review checklist

4. Output structured review with:
   - Summary and risk level
   - Critical/Important/Minor issues table
   - Pattern verification checklist
   - Positive observations

## Expected Output

A structured review that can be used to decide whether to commit or what to fix first.
