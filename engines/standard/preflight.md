---
name: preflight
description: "Pre-commit verification — checks for common problems in changed files before committing"
user-invocable: false
---

# Preflight Engine

Pre-commit verification that checks changed files for common problems before they're committed. Designed to catch issues early and prevent them from entering the codebase.

## Focus Area

$ARGUMENTS (or auto-detect from git diff)

---

## PHASE 0 — GATHER CONTEXT

1. Run `git diff --name-only --staged` — files about to be committed
2. Run `git diff --name-only` — unstaged changes
3. If no staged changes, use unstaged changes as the scope
4. Read `system/invariants.md` — rules to verify
5. Read `CLAUDE.md` — project patterns and constraints

---

## PHASE 1 — CHECK SUITES

Run these checks against all changed files:

### Suite 1: Secrets & Sensitive Data
- Scan for: API keys, passwords, tokens, connection strings
- Patterns: `password=`, `secret=`, `token=`, `api_key=`, `-----BEGIN`, base64 strings > 40 chars
- Check: `.env` files not in `.gitignore`
- Check: credentials files being tracked
- Severity: CRITICAL if found

### Suite 2: Import & Dependency Health
- Check for: broken imports (importing from deleted/moved files)
- Check for: circular imports
- Check for: unused imports
- Check for: new dependencies added without explanation
- Severity: HIGH for broken imports, MEDIUM for unused

### Suite 3: Error Handling
- Check for: empty catch/except blocks
- Check for: swallowed errors (catch without re-throw or logging)
- Check for: generic error catching (catch Exception, catch(e))
- Check for: TODO/FIXME in error handling paths
- Severity: MEDIUM

### Suite 4: Data Integrity
- Check for: raw SQL queries with string interpolation
- Check for: unvalidated user input used in queries/commands
- Check for: missing null checks on external data
- Check for: type coercion in comparisons
- Severity: HIGH for injection risks, MEDIUM for null checks

### Suite 5: Test Coverage
- Check: did changed source files have corresponding test changes?
- Check: are new functions/classes tested?
- Check: are edge cases covered (empty, null, boundary)?
- Severity: MEDIUM for missing tests on changed code

### Suite 6: Code Quality
- Check for: functions > 50 lines
- Check for: deeply nested code (> 4 levels)
- Check for: magic numbers/strings
- Check for: copy-pasted code blocks (> 10 similar lines)
- Check for: inconsistent naming patterns
- Severity: LOW

### Suite 7: Documentation
- Check: public APIs have descriptions
- Check: complex logic has explanatory comments
- Check: CLAUDE.md is consistent with changes
- Severity: LOW

### Suite 8: Git Hygiene
- Check: commit scope (are unrelated changes mixed?)
- Check: large files being added (> 1MB)
- Check: binary files that should use LFS
- Check: merge conflict markers in files
- Severity: HIGH for conflict markers, MEDIUM for scope

### Suite 9: Invariant Compliance
- For each invariant in `system/invariants.md` that relates to changed files:
  - Run the check command or pattern
  - Verify the invariant still holds
- Severity: HIGH for violations

### Suite 10: Burden Detection (INV-F1 enforcement)

Purpose: make constitutional invariant INV-F1 ("no unnecessary burden") falsifiable. Flags components that exist but aren't being exercised — structural asymmetry between install cost and demonstrated value.

**Threshold resolution** (at suite start):
Read `.cwos-config.yaml → preflight.burden_thresholds`. Use these values; fall back to defaults for any missing keys:
- `engine_warn_days`: 90 (default)
- `engine_high_days`: 180 (default)
- `program_cadence_multiplier_warn`: 2 (default)
- `program_cadence_multiplier_high`: 3 (default)

**Check A — Engine zero-run / stale-run audit:**
1. Read `.claude/workstream/engines/registry.yaml`. Collect every active entry (skip entries that are commented out).
2. Scan `.claude/workstream/runs/run-*/manifest.yaml`. For each `engine` field, track the most recent `started_at` (or `completed_at`, whichever is later).
3. For each registered engine, compute `days_since_last_run`. Engines never run = infinity.
4. Classify:
   - `days_since_last_run < engine_warn_days` → OK (no finding)
   - `engine_warn_days ≤ days_since_last_run < engine_high_days` → **MEDIUM** finding
   - `days_since_last_run ≥ engine_high_days` OR never run → **HIGH** finding (suggest retire or refresh)
5. Evidence format: `evidence.file: engines/standard/<name>.md` (or the engine's skill_path), `evidence.snippet: "last run: <date or 'never'>"`, finding title prefixed with `Engine burden: `.

**Check B — Program protocol staleness:**
1. Scan `.claude/workstream/programs/prog-*.yaml`. Skip programs with `monitor_only: true` (system programs) or `tier: dormant`.
2. For each remaining program, read `last_run_by_protocol` and the `cadence_days` for each protocol.
3. Compute per-protocol `days_since_last_run`. A protocol is overdue if `days_since_last_run > cadence_days`.
4. Classify:
   - At least one protocol current (days_since ≤ cadence) → OK (program is in active use; no finding)
   - **Every** protocol overdue by < 2× cadence → OK (normal drift, accountability handles it)
   - **Every** protocol overdue by ≥ `program_cadence_multiplier_warn × cadence_days` → **WARN / MEDIUM** finding
   - **Every** protocol overdue by ≥ `program_cadence_multiplier_high × cadence_days` → **HIGH** finding
5. Evidence format: `evidence.file: .claude/workstream/programs/prog-<id>.yaml`, `evidence.snippet: "all_protocols_overdue: [<list>]"`, finding title prefixed with `Program burden: `.

**Check C — Orphan engine files:**
1. Glob `engines/standard/*.md` and `engines/library/*/SKILL.md`.
2. For each file, check whether any registry entry's `skill_path` references it. A file is an orphan if no active registry entry points at it.
3. Classify: orphan → **HIGH** finding (install cost with zero registered value).
4. Evidence format: `evidence.file: <orphan path>`, `evidence.snippet: "no registry.yaml entry references this file"`, finding title prefixed with `Orphan engine file: `.

**Severity:** MEDIUM / HIGH per classifications above.

**Graceful degradation:**
- If `runs/` directory is missing or empty → skip Check A silently. Add one line to report: "Suite 10 Check A: no run history yet — engine usage analysis skipped."
- If `programs/` is empty or all dormant/`monitor_only` → skip Check B silently with a matching note.
- If `engines/standard/` and `engines/library/` are both missing → skip Check C silently.
- If `.claude/workstream/engines/registry.yaml` is missing → skip all of Suite 10 with a single note (no inventory to audit against).

---

**Error Handling:**
- If git diff returns no changed files: report "Nothing to check — no changes detected", exit cleanly
- If a check suite errors internally (not "finds issues" but the check itself fails): skip that suite, note in report, continue with remaining suites
- If `system/invariants.md` does not exist: skip Suite 9, note in report
- Suite 10 is **not gated by the git-diff check** — burden detection runs against the full inventory regardless of what changed in this commit, since burden is a repo-wide structural property, not a per-diff concern.

---

## PHASE 2 — ANALYSIS

For each check that found issues:
1. Classify: is this a real problem or a false positive?
2. Assess: can this be auto-fixed safely?
3. Rate: what's the actual severity in context?

---

## PHASE 3 — AUTO-FIX (Safe Issues Only)

Auto-fixable issues (apply fix, re-check):
- Unused imports → remove
- Missing trailing newline → add
- Inconsistent formatting → format

NOT auto-fixable (create finding):
- Logic errors, missing tests, security issues, broken imports

---

## PHASE 4 — FINDINGS

Create findings for all issues that weren't auto-fixed.
Write to `.claude/workstream/findings/`.

---

## PHASE 5 — REPORT

```
## Preflight Check Results

### Changed Files: N files
### Checks Run: 10 suites

### Results
| Suite | Status | Issues | Auto-Fixed |
|-------|--------|--------|------------|
| Secrets | PASS/FAIL | N | — |
| Imports | PASS/FAIL | N | N |
| Error Handling | PASS/FAIL | N | — |
| Data Integrity | PASS/FAIL | N | — |
| Test Coverage | PASS/WARN | N | — |
| Code Quality | PASS/WARN | N | — |
| Documentation | PASS/WARN | N | — |
| Git Hygiene | PASS/FAIL | N | — |
| Invariants | PASS/FAIL | N | — |
| Burden Detection | PASS/WARN/FAIL | N | — |

### Overall: ✅ CLEAR TO COMMIT / ⚠ WARNINGS / ❌ BLOCKED

### Issues Requiring Attention
[list of issues that need fixing before commit]

### Auto-Fixes Applied
[list of fixes applied automatically]
```

If any CRITICAL or HIGH issues found: recommend NOT committing until resolved.
