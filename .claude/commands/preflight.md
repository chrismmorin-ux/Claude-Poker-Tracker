---
name: preflight
description: "Pre-commit verification — checks for common problems in changed files before committing"
procedure: suite-check
extends: context-gather
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: preflight` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

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
- Invariant checking is the canonical checker's job, not AI read-work. Run
  `node kit/scripts/cwos-verify.js` (the same harness `/verify` uses) and consume
  its PASS/FAIL output rather than re-implementing each invariant's check pattern.
- Surface any `[FAIL]` whose invariant relates to the changed files.
- Severity: HIGH for violations.

### Suite 10: Burden Detection (INV-F1 enforcement)

Purpose: make constitutional invariant INV-F1 ("no unnecessary burden") falsifiable. Flags components that exist but aren't being exercised — structural asymmetry between install cost and demonstrated value.

This suite is pure parse-and-compare (registry × run-manifest × program-YAML date math + threshold classification) — it ships as a script, not AI read-work (determinism-first; `INV-readpath-determinism`). Run:

```bash
node kit/scripts/cwos-burden-scan.js --json    # findings + skips
node kit/scripts/cwos-burden-scan.js --human   # readable list
```

`cwos-burden-scan.js` performs all three checks and reads thresholds from
`.cwos-config.yaml → preflight.burden_thresholds` (defaults: `engine_warn_days` 90,
`engine_high_days` 180, `program_cadence_multiplier_warn` 2,
`program_cadence_multiplier_high` 3):

- **Check A** — engine zero-run / stale-run: never-run or ≥ `engine_high_days` → HIGH; within the warn band → MEDIUM. Title `Engine burden: <name>`.
- **Check B** — program protocol staleness: a program with at least one current protocol is OK; if *every* protocol is overdue, classify by the least-overdue ratio (≥ high-multiplier → HIGH, ≥ warn-multiplier → MEDIUM). Title `Program burden: <id>`.
- **Check C** — orphan engine files: an engine `.md` with no `registry.yaml` `skill_path` reference → HIGH. Title `Orphan engine file: <path>`.

Each finding carries `{check, severity, title, file, snippet}` — file these directly. The script handles graceful degradation (missing `runs/`, `programs/`, engine dirs, or registry are reported in `result.skips`, not errors). Consume its output; do NOT re-scan the registry/manifests/programs by hand.

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

---

## Contract Alignment (ADR-038)

The briefing/output phase MUST emit this block (per ADR-038 Decision #6):

```
### Contract Alignment
- mode: <honored | departed (reason)>
- stretch: <honored | departed (reason)>
- success_shape: <honored — list which target items hit | departed (reason)>
- scope_ceiling: <complied — items skipped: [list] | violated (reason)>
```
