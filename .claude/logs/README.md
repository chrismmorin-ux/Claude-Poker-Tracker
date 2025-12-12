# Local Model Task Execution Logs

This directory contains execution logs for tasks delegated to local models.

## Log Format

**File:** `local-model-tasks.log` (JSONL - one JSON object per line)

### Entry Schema

```json
{
  "timestamp": "ISO 8601 datetime",
  "task_id": "T-XXX-NNN",
  "model": "qwen|deepseek",
  "status": "in_progress|success|failed",
  "execution": {
    "start": "ISO datetime",
    "end": "ISO datetime or null",
    "duration_ms": "number or null"
  },
  "test_result": {
    "exit_code": "number",
    "tests_run": "number",
    "tests_passed": "number",
    "tests_failed": "number",
    "failure_summary": "string or null",
    "error_type": "string or null"
  },
  "failure_classification": "string or null"
}
```

## Retention Policy

- Logs are local-only (added to .gitignore)
- Keep last 1000 entries (older entries rotated)
- Logs used for learning engine pattern detection

## Usage

View logs with: `node scripts/view-task-log.cjs [options]`

Options:
- `--status=success|failed` - Filter by status
- `--model=qwen|deepseek` - Filter by model
- `--last=N` - Show last N entries
- `--verbose` - Show full details
