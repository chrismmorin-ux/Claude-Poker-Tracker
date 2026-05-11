# UNTRACKED_IMPORT_BUILD_BREAK

**Status:** GUARDED 2026-05-11 by `scripts/check-untracked-imports.mjs` + CI preflight + CLAUDE.md staging-hygiene rule.

## Trigger

A commit lands on `main` that builds successfully on the author's machine but fails on CI with a Rollup / Vite resolver error such as:

```
[vite-plugin-pwa:build] Could not resolve "./components/views/CalibrationDashboardView" from "src/PokerTracker.jsx"
```

The deploy workflow aborts at the `npm run build` step. The deployed site does not reflect the latest commit.

**Origin incident:** 2026-05-11. Commit `582a417` ("WS-181: Voice Card Entry spike") swept 4 chunks of an unrelated in-flight workstream into `src/PokerTracker.jsx` while the assistant was authoring the VCE feature. Three of the four chunks added a `lazy(() => import('./components/views/CalibrationDashboardView'))` reference. The corresponding folder was UNTRACKED in git (it existed in the author's working tree but had never been `git add`-ed). Local build passed; CI build failed with a Rollup resolver error in ~7s. Fixed forward in commit `18a031d` by reverting the four unrelated chunks while preserving the 2 VCE-only lines.

## Pattern

A working tree carries in-flight modifications from N independent workstreams. Some of those modifications introduce imports whose target files are untracked (committed-pending) or whose owning folder is staged-but-incomplete.

A `git add <shared-file>` of a file that crosses multiple workstreams (typically a router, a context-provider, or an index module) sweeps in ALL the diff hunks present in the working tree — not just the hunks belonging to the workstream the commit is meant to deliver.

The build passes locally because the working tree HAS the untracked targets. The build fails on CI because CI clones only what is committed.

## Mechanism

1. Tree has File A in workstream X (untracked: depends on File A.helper which is also untracked).
2. Same tree has File B (modified) in workstream Y. File B has an unrelated diff hunk added by workstream X that imports `./A.helper`.
3. Workstream Y intends to ship File B's *Y-related* changes only.
4. `git add B` stages the entire B diff — including X's import hunk.
5. Commit + push lands on `main` with B referencing `./A.helper`.
6. CI checkout has no `./A.helper`. Build fails.

The failure surface is exactly: shared files (routers, index barrels, root mount points) cross-edited by multiple in-flight workstreams in a single working tree.

## Symptom signals

- Local `npm run build` succeeds.
- CI `npm run build` fails with `Could not resolve "X" from "Y"`.
- `git ls-files | grep X` returns nothing for the path X that resolved locally.
- The shared file's diff contains imports + JSX usages that don't belong to the workstream the commit message describes.

## Root cause

Two compounding factors:

1. **`git add <file>` is whole-file by default.** When a file has hunks from multiple workstreams, the only safe operation is `git add -p <file>` (interactive selection) — but interactive add is hard to run in an automated harness. The default whole-file add silently bundles unrelated changes.

2. **CI is the first reliable detector of "untracked target referenced by a tracked file."** No local check verifies that every relative import in modified files resolves to a tracked path. Local builds use the working tree (which has the untracked file present), so they don't catch the gap.

The bug class is structurally invisible to local builds. It can only be caught by either CI or a dedicated local script.

## Prevention (in force 2026-05-11)

### Layer 1 — Pre-commit / pre-push: `npm run preflight`

`scripts/check-untracked-imports.mjs` parses every changed source file's `import` / `import()` / `require()` statements and verifies each relative-path import resolves to a file tracked in git. Exits non-zero with a clear report if any target is untracked.

Modes:
- `npm run preflight` — compare branch tip against `origin/main`.
- `npm run preflight:staged` — check only staged files (before `git commit`).
- `node scripts/check-untracked-imports.mjs --since=HEAD~1` — check the most recent commit (CI mode).
- `node scripts/check-untracked-imports.mjs --all` — full-repo scan.

### Layer 2 — CI gate

`.github/workflows/deploy.yml` runs `node scripts/check-untracked-imports.mjs --since=HEAD~1` BEFORE `npm run build`. The preflight fails in <2s with a clear "TARGET NOT TRACKED" message rather than waiting ~7s for Vite to surface a generic resolver error.

### Layer 3 — CLAUDE.md staging-hygiene rule

Under "Proactive Automation" in `CLAUDE.md`: when committing in a tree with substantial in-flight modifications outside the current workstream's scope, run `npm run preflight:staged` before `git commit`. If any shared file (router, root mount, index barrel) is part of the commit, ALWAYS `git diff --cached <file>` to verify the staged hunks belong to the current workstream — not someone else's in-flight work.

## How to recover if a build breaks anyway

1. Confirm failure mode: read the CI log for `Could not resolve "X" from "Y"`.
2. Identify the untracked target: `git ls-files | grep <X>` returns nothing.
3. Decide:
   - If X belongs to the current workstream: `git add` the X file(s) and amend the commit (or push a fix commit).
   - If X belongs to another workstream: revert the offending hunks. The safe path:
     ```
     git show <last-green-commit>:<shared-file> > /tmp/clean.jsx
     cp /tmp/clean.jsx <shared-file>
     # Re-apply ONLY the current workstream's hunks via Edit, then:
     git add <shared-file> && git commit + git push
     ```
4. Verify the deploy workflow turns green (`gh run list --workflow deploy.yml`).
5. The author's working tree retains the un-committed in-flight work; it can be staged later when its dependent files are ready.

## Related

- ADR-equivalent: no formal ADR; the failure file IS the canonical record.
- Touches programs: `engineering` (process), `change-management` (commit hygiene).
- Linked commits: `582a417` (original break), `18a031d` (fix), (forthcoming guard commit).

## Change log

- 2026-05-11 — Created after incident on commit 582a417. Three-layer prevention installed.
