---
name: verify
description: "Self-verification — run build, tests, invariant checks, and visual verification based on what changed"
user-invocable: true
argument-hint: "[layer: build|invariants|visual|behavioral|regression|all]"
---

# /verify — Self-Verification

Verify that the system is healthy and recent changes haven't broken anything. Runs verification layers appropriate to what changed.

## Output Shape

**Verify arc:** `<scanning | layer-running | report-ready>` — `<one-clause status>` (e.g., "All N invariants checked, M PASS, K FAIL").

`<Delta line: what this invocation did — ran L layers covering F files. If clean: "Diagnostic-only — no state change.">`

`<Remainder: per-layer results table — Layer / Status / Detail — with FAIL rows highlighted at the top. Cite invariant IDs explicitly.>`

### Why these layers ran
`<Value-rationale: cite the changed-files heuristic that selected each layer, the invariant or repo_goal each layer protects, and any failure-mode token motivating coverage. If no changes: declare it.>`

**Do next:** Single-line action — `Fix FAIL items before proceeding` (or `All clear — continue current work` when all PASS).

## Steps

### 1. Determine What Changed
- Run `git diff --name-only HEAD` for unstaged changes
- Run `git diff --name-only --staged` for staged changes  
- Run `git diff --name-only HEAD~1..HEAD` for last commit
- Combine into `changed_files` list
- Categorize changes: code, tests, config, UI, data, docs

### 2. Select Verification Layers

Based on `$ARGUMENTS` or auto-detect from changes:

| If changed... | Run layers... |
|---------------|---------------|
| Any code | Build, Test, Regression |
| UI/frontend files | Build, Test, Visual, Regression |
| Data/schema files | Build, Test, Behavioral, Regression |
| Config files | Build, Behavioral |
| Tests only | Test |
| Docs only | (skip verification) |
| `$ARGUMENTS = all` | All 5 layers |

### 3. Layer 1 — Build/Test Verification

Read vital signs from `system/state.md` for the check commands to run.

Run each check command:
- Test suite (e.g., `pytest`, `npm test`, `cargo test`)
- Build (e.g., `npm run build`, `python manage.py check`)
- Lint/type check if configured

Record: pass/fail, output summary, duration.

### 4. Layer 2 — Invariant Verification

Read `system/invariants.md`. For each invariant with a `check_command`:
- Run the command
- Record pass/fail
- If fail: flag with the invariant name and expected behavior

### 5. Layer 3 — Visual Verification (UI repos only)

If the project has UI components and UI files changed:
- Use Playwright MCP to navigate to affected pages
- Take screenshots of key states
- Present screenshots to user for visual review
- Check for: layout breaks, missing elements, style regressions

If no Playwright available, note: "Visual verification skipped — no browser automation configured"

### 6. Layer 4 — Behavioral Verification

If behavioral checks are configured in `system/state.md`:
- Start the application (if not running)
- Run configured endpoint/flow checks
- Verify responses match expectations

If no behavioral checks configured, note: "Behavioral verification skipped — no checks configured"

### 7. Layer 5 — Regression Check

- Review `git diff` for unintended changes:
  - Files modified that weren't part of the current work item
  - Deleted code that shouldn't have been removed
  - New dependencies added
- Cross-reference with current work item's `files_involved` — flag any files changed that aren't listed

### 8. Output Results

```
## Verification Results

### Summary
| Layer | Status | Details |
|-------|--------|---------|
| Build/Test | PASS/FAIL | X/Y tests passing, build clean |
| Invariants | PASS/FAIL | N/M invariants verified |
| Visual | PASS/FAIL/SKIP | [details] |
| Behavioral | PASS/FAIL/SKIP | [details] |
| Regression | PASS/FAIL | [details] |

### Overall: ✅ PASS / ❌ FAIL

### Failures (if any)
[detailed failure information with file paths and error messages]

### Unintended Changes (if any)
[files changed outside the current work item scope]
```

### 9. On Failure

If any layer fails:
1. Attempt auto-fix if the issue is straightforward (missing import, lint error)
2. Re-run the failed layer
3. If still failing after 1 auto-fix attempt: report to user, do NOT mark work item as done
4. Create a finding if the failure reveals a systemic issue


---

## Shadow-event envelope (ADR-018 step 1)

After your final output, run:

`node kit/scripts/cwos-event.js append command_completed --track T11:vital-signs --tag /verify --payload '{"command":"/verify"}'`

Non-fatal. Do not gate any output on the exit status.
