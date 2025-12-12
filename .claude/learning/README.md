# Failure Patterns Learning System

This directory contains learned failure patterns from local model task execution.

## Purpose

Track recurring failure patterns to:
- Prevent repeat failures
- Guide task decomposition
- Measure mitigation effectiveness

## Files

- `failure-patterns.json` - Known failure patterns with signatures and mitigations

## Pattern Schema

```json
{
  "pattern_id": "FP-001",
  "name": "File Modification Anti-Pattern",
  "description": "Local models rewrite entire file instead of making incremental edits",
  "signature": {
    "error_contains": ["output too small", "size guard"],
    "task_type": "incremental_edit"
  },
  "occurrences": [
    {"task_id": "T-XXX", "date": "2025-12-12", "outcome": "failed"}
  ],
  "mitigation_status": "implemented|proposed|none",
  "effectiveness_rate": 0.85
}
```

## Usage

Pattern detection runs automatically after task failures via `scripts/detect-failure-pattern.cjs`.
