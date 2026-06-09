---
name: upgrade-prep
description: "Scan for breaking changes, compatibility issues, and affected code paths before upgrading a dependency — zero impact guaranteed"
user-invocable: false
default_mode: build-best
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: upgrade-prep` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: build-best`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Upgrade Preparation Protocol

**SAFETY: This engine is READ-ONLY. It makes NO code changes, NO dependency changes, and NO file modifications. It only reads and documents.**

You are preparing the user for a safe, well-informed dependency upgrade. Your job is to identify exactly what will break, what's safe, and what needs to change — without changing anything.

## Focus Area

$ARGUMENTS — should describe the upgrade (e.g., "upgrade React from 17 to 18", "update prisma to 6.x", "upgrade Python from 3.10 to 3.12").

If no argument given, ask: "What dependency are you planning to upgrade, and to what version?"

---

## PHASE 0 — GATHER CONTEXT

Read these to understand the current dependency landscape:

1. `CLAUDE.md` — project patterns, tech stack
2. `system/constraints.md` — version constraints, compatibility requirements
3. `system/decisions.md` — prior decisions about dependency choices
4. Identify package manifests:
   - Glob for `package.json`, `requirements.txt`, `Pipfile`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `Gemfile`, `pom.xml`, `build.gradle`
   - Read the manifest to find the current version of the target dependency
5. Read lock files if they exist (`package-lock.json`, `yarn.lock`, `poetry.lock`, `Cargo.lock`, `go.sum`)
6. `git log --oneline -10 -- <manifest files>` — recent dependency changes

Parse from arguments:
- **Package name** — what's being upgraded
- **Current version** — from the manifest
- **Target version** — from arguments

---

## PHASE 1 — PARALLEL IMPACT SCAN

Launch 3 agents in parallel using the Agent tool. Each agent MUST be read-only.

### Agent 1: Usage Scanner (senior-engineer persona)

> **Task:** Find every place the target dependency is used in the codebase.
>
> 1. Search for ALL imports of the package:
>    - Direct imports: `import X from '<package>'`, `from <package> import X`, `require('<package>')`
>    - Sub-path imports: `import X from '<package>/sub/path'`
>    - Type imports: `import type { X } from '<package>'`
> 2. For each import, document:
>    - What is imported (specific functions, classes, types, or entire module)
>    - Where it's used (file:line)
>    - How it's used (direct call, extended, wrapped, re-exported)
> 3. Check for INDIRECT usage:
>    - Does this package provide CLI tools used in scripts?
>    - Does it provide build/transform plugins? (babel plugins, webpack loaders, etc.)
>    - Does it provide types that other packages depend on?
>
> Output:
> - Complete import map (file:line → what's imported)
> - Usage patterns (which APIs are actually used)
> - Indirect usage (CLI, plugins, types)
> - Total touchpoints count

### Agent 2: Breaking Change Analyzer (architect persona)

> **Task:** Identify breaking changes between current and target version.
>
> 1. Read the package's CHANGELOG, MIGRATION.md, or UPGRADING.md if present in node_modules, vendor, or site-packages
> 2. If no changelog found, check for version-specific migration patterns:
>    - For major version bumps: assume breaking changes
>    - For minor/patch: assume backwards compatible
> 3. Look for KNOWN MIGRATION PATTERNS for popular packages:
>    - React 17→18: createRoot, automatic batching, Suspense changes
>    - Next.js major versions: app router, middleware, config changes
>    - Prisma major versions: client API changes, migration format
>    - Express major versions: middleware signature changes
>    - (Use your knowledge of popular package upgrade paths)
> 4. For each breaking change identified:
>    - Does this codebase USE the affected API? (cross-reference with Agent 1's import map)
>    - If yes: what specifically needs to change?
>    - If no: safe to ignore
>
> Output:
> - Breaking changes that AFFECT this codebase (with file:line references)
> - Breaking changes that DON'T affect this codebase (safe)
> - Deprecation warnings (not broken yet, but will be in future versions)
> - New features available after upgrade (optional, for context)

### Agent 3: Compatibility Checker (failure-engineer persona)

> **Task:** Check for compatibility issues with the rest of the dependency tree.
>
> 1. Find PEER DEPENDENCIES of the target package at the target version
>    - Do current peer dependency versions satisfy the new requirements?
>    - Will other packages need upgrading too? (cascade effect)
> 2. Check for CONFLICTING VERSIONS:
>    - Do other packages require a specific version range that excludes the target version?
>    - Are there duplicate package issues that would be created?
> 3. Check RUNTIME COMPATIBILITY:
>    - Does the target version require a newer Node.js/Python/etc.?
>    - Does it require new system dependencies?
>    - Does it change the minimum browser support?
> 4. Check BUILD COMPATIBILITY:
>    - Does the target version require build tool changes? (webpack config, tsconfig, etc.)
>    - Does it change the output format? (ESM vs CJS, etc.)
>
> Output:
> - Peer dependency conflicts (if any)
> - Cascade upgrades needed (other packages that must upgrade too)
> - Runtime/platform requirements
> - Build configuration changes needed

Wait for all 3 agents to complete. Collect their outputs.

---

## PHASE 2 — VERIFICATION

With all scan data collected, verify preconditions for safe upgrade:

### Precondition Checklist
For each, determine pass/fail/unknown:

1. **No peer dependency conflicts** — or conflicts have known resolutions
2. **All breaking changes mapped** — every affected API usage is identified
3. **Tests exist for affected code** — code paths using changed APIs have test coverage
4. **No cascade upgrades block this** — or cascade plan is clear
5. **Runtime compatible** — current Node/Python/etc. version meets requirements
6. **Build config compatible** — or config changes are documented

### Impact Classification
For each breaking change that affects this codebase:
- **Must change:** The code will break at runtime without modification
- **Should change:** The code uses a deprecated API that still works but will break later
- **Optional:** New API available but old one still works

---

## PHASE 3 — UPGRADE PLANNING

Produce a step-by-step upgrade procedure:

### Migration Steps
For each step, include:
- Description of what to change
- Risk level (low/medium/high)
- Verification (how to confirm it worked — usually "run tests")
- Estimated effort

Order:
1. Build/config changes first (if any)
2. Cascade dependency upgrades (if any)
3. Code changes for "must change" items
4. The actual version bump
5. Run tests
6. Code changes for "should change" items
7. Final verification

---

## PHASE 4 — READINESS REPORT

Compile the readiness report in the standard format (processed by `/engine` Step 5f):

- `target`: "Upgrade <package> from <current> to <target>"
- `status`: `ready` if no blockers, `blocked` if incompatible peer deps or missing runtime, `needs-review` if unknowns
- `preconditions`: the checklist from Phase 2
- `blast_radius`: files that import the package, build config files, peer dependencies
- `rollback_plan`: "Revert package.json/lock file changes and run install"
- `migration_steps`: the sequenced procedure from Phase 3
- `safe_stop_points`: after each migration step (each should leave code working)
- `estimated_effort`: S (< 30 min, no breaking changes), M (30 min - 2 hours, some code changes), L (2+ hours, significant refactoring)

---

## PHASE 5 — BRIEFING

Present to the user in plain language:

1. **Scope:** "This upgrade affects [N] files across [N] imports"
2. **Breaking changes:** "[N] breaking changes affect your code, [N] don't" (or "No breaking changes for your usage")
3. **Effort:** "You'll need to change [specific things]" or "It's a clean upgrade — just bump the version"
4. **Risk:** "The biggest risk is [X]" or "Low risk — good test coverage on affected code"
5. **Readiness:** "Overall: [ready/blocked/needs-review]" with specific blockers if any

End with the safety confirmation: "No files were modified by this analysis."

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
