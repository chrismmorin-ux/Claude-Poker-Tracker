---
name: discover
description: "Probe an external repo (read-only report) OR configure capability state in the current repo (writes to .cwos-onboarding.yaml)"
user-invocable: true
argument-hint: "[<path to target repo>]  (omit path to configure capabilities for the current repo)"
---

# /discover — Probe or Configure

This command runs in one of two modes based on arguments:

| Invocation | Mode | What happens |
|------------|------|--------------|
| `/discover <path>` | **probe** | Read-only analysis of an external repo — shows what exists, what CWOS would add, trade-offs. Writes nothing. |
| `/discover` (no path) | **configure** | Walks the user through a capability interview against the current repo. Writes the answers to `.cwos-onboarding.yaml` (ADR-016). |

## Steps

### Step 1: Parse & Dispatch

Inspect `$ARGUMENTS`:

- **Empty AND `.cwos-onboarding.yaml` exists in cwd with `schema_version >= 2`** → enter **configure mode** (jump to Step 5).
- **Empty AND no/older onboarding file** → output: `No capability state to configure. Run /adopt first, or pass a path to probe an external repo.` Stop.
- **Non-empty path** → enter **probe mode** (continue with Step 1 validation below).

#### Probe-mode validation (only when a path was provided)

- Validate the path exists and is a project directory (has at least one of: `package.json`, `requirements.txt`, `Cargo.toml`, `go.mod`, `*.sln`, `CLAUDE.md`, `.git/`, `src/`, `app/`)
- If path is invalid: "That doesn't look like a project directory. Check the path and try again."

### Step 2: Analyze the Repo

Run the same analysis as `/adopt` Steps 2a-2f, but purely read-only:

**2a. Project Documentation**
- Read `CLAUDE.md` if it exists. Note:
  - Size (lines)
  - Whether it has session protocol instructions
  - Whether it has rules or commands listed
  - Whether it references a system model, invariants, or constraints
- Read `README.md` if it exists (note project description)

**2b. Existing .claude/ Infrastructure**
Scan for:
- `.claude/commands/` — count and list command names
- `.claude/agents/` — count and list agent/persona names
- `.claude/skills/` — count and list skill names
- `.claude/workstream/` — check for queue/, programs/, config.yaml, usage.yaml
- `.claude/rules/` — count and list rule files
- `.claude/context/` — list context files
- `.claude/hooks/` — list hook files
- `.claude/failures/` — count failure mode entries
- `.claude/handoffs/` — check for session continuity files
- `settings.json` or `settings.local.json` — note existence

**2c. Tech Stack Detection**
Check for:
- `package.json` → Node.js (read `dependencies` for React/Vue/Svelte/Next.js)
- `requirements.txt` / `pyproject.toml` / `Pipfile` → Python
- `manage.py` → Django
- `Cargo.toml` → Rust
- `go.mod` → Go
- `*.sln` / `*.csproj` → .NET
- Frontend signals: `src/`, `app/`, `pages/`, `components/`
- Test framework: look for `jest.config*`, `vitest.config*`, `pytest.ini`, `conftest.py`, `cargo test` in CI
- CI/CD: `.github/workflows/`, `.gitlab-ci*`, `Jenkinsfile`

**2d. Work Tracking**
Scan for:
- `BACKLOG.md`, `TODO.md`, `ROADMAP.md` (root and `.claude/`)
- `backlog/`, `tasks/` directories
- `.claude/workstream/queue/` — count WS-*.yaml files
- GitHub Issues (via `gh issue list --limit 5 --json title` if `gh` CLI available)
- Count `TODO` and `FIXME` comments: `grep -rn "TODO\|FIXME" --include="*.py" --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" -l | wc -l`

**2e. Governance & State Files**
Check ALL possible locations:
- `system/` directory (CWOS standard)
- `docs/` — INVARIANTS.md, CONSTRAINTS.md, SYSTEM_MODEL.md, decisions/, failures/
- `.claude/context/` — INVARIANTS.md, CONSTRAINTS.md, SYSTEM_MODEL.md
- Root — INVARIANTS.md, CONSTRAINTS.md
- `.cwos-version` or `.cwos-onboarding.yaml` (already adopted?)

**2f. Git History**
- `git log --oneline -10` for recent activity
- `git log --oneline --since="30 days ago" | wc -l` for monthly activity level
- `git log --format='%H' --follow CLAUDE.md 2>/dev/null | wc -l` for maturity signal

### Step 3: Classify Repo

Map to archetype based on analysis:

| Archetype | Signals |
|-----------|---------|
| **SaaS App** | Django/Rails/Express + DB config + auth patterns |
| **Frontend App** | React/Vue/Svelte + components directory |
| **Data Platform** | DB-heavy, importers, scrapers, data pipelines |
| **Developer Tool** | CLI entry point, SDK structure, library pattern |
| **Research Project** | Markdown-heavy, data analysis, notebooks |
| **API Service** | REST/GraphQL endpoints, no frontend |

### Step 4: Produce Report

Output in three sections. Use plain language — the reader is a non-technical founder.

```
## Discovery Report: [Repo Name]

**Path:** <path>
**Type:** <archetype>
**Tech Stack:** <summary>
**Activity:** <N commits in last 30 days>

---

### What You Already Have

| Area | Status | Details |
|------|--------|---------|
| Project documentation | strong/basic/none | CLAUDE.md (N lines), README exists, ... |
| Session protocol | strong/basic/none | Mandatory read-before-code / informal / none |
| System model | strong/basic/none | SYSTEM_MODEL.md at .claude/context/ / none |
| Invariants & rules | strong/basic/none | N invariants tracked / none |
| Constraints | strong/basic/none | Documented at docs/CONSTRAINTS.md / none |
| Decision log | strong/basic/none | N ADRs in docs/decisions/ / none |
| Failure library | strong/basic/none | N failure modes documented / none |
| Work tracking | strong/basic/none | BACKLOG.md (N items) + GitHub Issues (N) / TODO comments only / none |
| Commands | strong/basic/none | N commands in .claude/commands/ / none |
| Expert agents | strong/basic/none | N personas in .claude/agents/ / none |
| Programs | strong/basic/none | N governance programs / none |
| Hooks & guards | strong/basic/none | git-guard, secrets-scan, etc. / none |
| Tests | strong/basic/none | Test framework detected / no test config found |
| CI/CD | strong/basic/none | GitHub Actions / none |

**Existing Infrastructure Score:** N/14 areas have at least basic coverage
```

```
### What CWOS Would Add

> CWOS preserves everything you already have. These are additions, not replacements.
> Capabilities are independently configurable after `/adopt` — you decide which to enable.

#### Core capability — Session Discipline (always installed by `/adopt`)
<List ONLY items the repo doesn't already have>
- /status command — project health dashboard showing vital signs, queue, programs
- system/ directory — standardized location for invariants, constraints, decisions, failures
- Session protocol — adaptive ceremony (quick fix vs full session)

#### Workstream capability — Queue Management
<List ONLY new items>
- /next command — auto-picks highest priority work from your backlog
- /workstream command — queue management (claim, complete, prioritize)
- RICE scoring — formula-based prioritization with context boosts
- Would import: <N items from BACKLOG.md> + <N from TODO.md> + <N from GitHub Issues>

#### Engines capability — Analysis Framework
<List ONLY new items>
- /engine command — run structured multi-expert analysis
- <N new personas> to complement your existing <N>
- Archetype engines: <list based on type, e.g., ux-audit for frontend>
- Engine registry connecting your existing engines with new ones

#### Governance capability — Program Health
<List ONLY new items>
- /pulse command — program health dashboard
- /audit command — drift detection, staleness monitoring
- <N new programs> based on your project type

#### Autonomous capability — Strategic Cycles
- /plan — multi-expert strategic planning
- /verify — comprehensive verification
- /decide — architectural decision recording

> **Dependency chain:** `core → workstream → engines → (governance, autonomous)`. You don't have to enable everything — `/discover` (configure mode, post-adoption) walks you through the choice.
```

```
### Adoption Assessment

**Overlap:** <N commands, N agents> already exist and would be preserved
**Conflicts:** <any name collisions, or "None detected">
**Migration:** <N work items across N sources could be imported>

**Effort Estimate:**
<If repo has rich existing infrastructure>
Your repo already has strong process management. Adoption would mainly 
standardize locations and add cross-repo visibility. Estimated ~3 sessions 
to full steady state.

<If repo has minimal infrastructure>
Your repo would benefit significantly from structured work management. 
Estimated ~5-7 sessions to full steady state, with value starting immediately.

**Suggested starting capabilities:** <core (always) + N more, e.g., "workstream, engines">
**Reason:** <one sentence why these fit this repo>
```

```
### What Might Feel Different (Honest Trade-offs)

Adopting CWOS changes how Claude works in your repo. Here's what to expect:

**Session startup takes a moment longer.**
Claude reads system files at the start of each session to orient itself. For quick 
fixes this adds ~5 seconds. For deep sessions, the orientation is the point — but 
if you're used to "just start coding," the brief pause is noticeable.
→ *This is configurable. Quick Fix mode skips most of it. And the orientation 
prevents Claude from making changes that conflict with your project's rules.*

**More files in your repo.**
CWOS adds 10-20 files to `.claude/` and `system/`. If you like a clean repo, 
this feels cluttered. The files are all in dedicated directories and gitignored 
where appropriate — they won't show up in your code reviews.
→ *These files ARE the system's memory. Without them, Claude starts fresh every 
session and loses context about your project.*

<If repo has existing commands/agents/backlog:>
**Your existing workflow shares space with new commands.**
You already have <N commands>. CWOS adds <N more>. Both work — nothing is replaced. 
But your command list gets longer, and some commands may overlap in purpose 
(e.g., your `/health-check` and CWOS's `/status` both show project health).
→ *Overlapping commands are preserved as-is. Over onboarding sessions, Claude will 
suggest consolidating where it makes sense — but only if you want to.*

<If repo has existing backlog system:>
**Your backlog format may feel pressured to change.**
CWOS has its own work queue (YAML files with RICE scoring). Your existing 
<BACKLOG.md / GitHub Issues / etc.> works fine and won't be deleted. But some 
CWOS features (auto-generated work items from engines, priority boosting from 
business context) work best with the CWOS queue format.
→ *You can keep your existing format indefinitely. Shadow mode (coming soon) will 
let CWOS read your format without converting. Migration is always optional.*

<If repo has no existing governance:>
**It might feel like overhead at first.**
If you're used to "just open the repo and start coding," the system files, 
commands, and progressive suggestions can feel like bureaucracy. The first few 
sessions have a "getting to know you" quality.
→ *This fades quickly. By session 3-4, Claude knows your project and the suggestions 
stop. The overhead pays for itself the first time Claude catches a bug it would 
have missed, or picks up exactly where you left off without you explaining anything.*

**Claude's responses reference the system.**
You'll occasionally see Claude mention programs, findings, or vital signs. If you 
don't care about governance, this can feel like noise.
→ *With just core or workstream enabled, this is minimal. Once engines or 
governance is on, the references are there because they caught something worth 
mentioning. You can always say "skip the system stuff" and Claude will.*

---

Ready to try it? Run: `/adopt "<path>"` (installs core only — no level needed).
Then, in the adopted repo, run `/discover` to choose which other capabilities get configured.
Or ask me anything about what you saw above.
```

### Step 5: Read State (configure mode only)

Read `.cwos-onboarding.yaml` from cwd. Confirm `schema_version >= 2`. If older, output: `Onboarding schema is v<N>; capability configuration requires v2. Run /adopt to upgrade.` Stop.

Read the existing `capabilities:` block. For each of the five capabilities, hold the current `state` and `note` so they can be surfaced as the suggested default.

Run a quiet detection pass against cwd (reuse Steps 2b/2c/2d signal logic, no output) and compute a **detection-derived suggestion** per capability:

| Capability | Detection signal → suggestion |
|------------|--------------------------------|
| `core` | Always `enabled` (installed by `/adopt`) |
| `workstream` | `.claude/workstream/queue/` exists with WS-*.yaml → `enabled`; else `intended` |
| `engines` | `engines/` populated AND `.claude/workstream/engines/registry.yaml` has entries → `enabled`; else `intended` |
| `governance` | `.claude/workstream/programs/` has prog-*.yaml AND any program has `last_run_by_protocol.baseline` set → `enabled`; else `intended` |
| `autonomous` | `.claude/commands/plan.md` exists AND `system/decisions.md` has non-template entries → `enabled`; else `intended` |

**Precedence rule:** if the existing onboarding state is `enabled`, `intended`, or `declined`, surface that as the suggested default — never silently overwrite a user choice. Only surface the detection-derived suggestion when the existing state is `unconfigured`.

### Step 6: Catalog Interview (configure mode only)

For each capability in dependency order — `core, workstream, engines, governance, autonomous` — present this block and collect a response. Use repo-specific prose for "What it adds" if `repo_goal` is set in onboarding (substitute the goal language); otherwise use generic prose.

```
[N/5] <capability>
  Purpose: <one-line>
  What it adds:
    - <bullet 1, repo-specific or generic>
    - <bullet 2>
  Detected today: <existing-systems summary, e.g., "BACKLOG.md (12 items), .claude/workstream/queue/ has 0 files">
  What breaks without it: <one line>
  Depends on: <prior capabilities, or "none">

  Current: <existing state>    Suggested: <suggested state>
  > [enabled / intended / declined / skip]   (free text after the choice becomes the note)
```

**Per-capability text** (use these as the basis for the `Purpose` / `What it adds` / `What breaks without it` / `Depends on` lines):

- **core** — Session discipline. Status, session-start, session-end, system/ skeleton. Without it: nothing else works. Depends on: none.
- **workstream** — Queue and sprint management. /next, /workstream, RICE scoring. Without it: priorities live in your head; sessions don't carry forward work. Depends on: core.
- **engines** — Multi-expert structured analysis. /engine, persona library. Without it: no automated deep analysis; findings stay implicit. Depends on: workstream.
- **governance** — Program health and accountability. /pulse, /audit, programs/. Without it: no drift detection; quality silently degrades. Depends on: engines.
- **autonomous** — Strategic cycles. /plan, /verify, /decide. Without it: no formal planning or decision recording; verification stays manual. Depends on: engines.

**Response handling:**
- `skip` → keep existing state unchanged for this capability (no overwrite, no `captured_at` update)
- `enabled` / `intended` / `declined` → record as the new state for the summary
- Free-text appended to the choice (e.g., `intended — waiting until we have a real backlog`) → text after the keyword becomes the `note`
- If user picks `enabled` for a capability whose dependencies are not `enabled` or `intended`: output a one-line warning (`Note: <prior> isn't enabled — this may not work as expected.`) but accept the choice. User judgment wins.

### Step 7: Summary & Confirm (configure mode only)

After all five questions, output a summary table:

```
Capability     Current        New             Note
─────────────────────────────────────────────────────────────────
core           enabled        enabled         (no change)
workstream     unconfigured   intended        waiting until real backlog
engines        unconfigured   declined        not interested
governance     unconfigured   intended        (no note)
autonomous     unconfigured   skipped         (no change)

Write to .cwos-onboarding.yaml? [yes / edit <N> / cancel]
```

- `yes` → write back. For each capability whose state changed, update `state`, set `captured_at: <today's ISO date>`, set `note` (or null if empty). Preserve `captured_at` on capabilities that didn't change. Do not touch `skip`-ed entries.
- `edit N` → re-run Step 6 for capability N only, then re-show the summary.
- `cancel` → exit without writing.

### Step 8: Footer (configure mode only)

After a successful write, output:

```
Capability state captured.

What you intended (not yet enabled):
  - <capability> — <note or "no note">
  ...

→ /next will surface setup work for these capabilities, scored by intention age.
→ Re-run /discover any time to revisit.
```

If no capabilities are in `intended` state, replace the body with: `All capabilities are either enabled, declined, or unconfigured. /next will compose sprints from your queue normally.`

---

### Important Rules for This Command

1. **In probe mode (path provided): NEVER write any files.** This is read-only. If you catch yourself about to create or modify a file, stop. In configure mode (no path), the only file written is `.cwos-onboarding.yaml`, and only after explicit user confirmation in Step 7.
2. **Be honest about overlap.** If the repo already has 90% of what CWOS offers, say so. Don't oversell.
3. **Score each area fairly.** "strong" means the repo has a mature implementation. "basic" means something exists but it's informal. "none" means nothing.
4. **Recommend the RIGHT capability footprint**, not the maximum. A weekend project with `core` enabled is better than an overwhelmed install with `governance` and `autonomous` on.
5. **Use plain language.** "This command auto-picks your most important work item" not "RICE-scored priority queue with context-boosted work items."
6. **The trade-offs section must be honest and specific to THIS repo.** Include only the trade-offs that actually apply:
   - Repo with existing commands → include the "shares space" trade-off
   - Repo with existing backlog → include the "format pressure" trade-off
   - Repo with no governance → include the "overhead at first" trade-off
   - Always include "session startup" and "more files" (these apply to every repo)
   - Every trade-off must have a `→` reassurance that addresses the specific concern with a concrete mitigation, not a dismissal
7. **Never minimize real concerns.** If the repo has a sophisticated existing system (like 10 agents and 4 programs), acknowledge that CWOS adds complexity on top of something that already works. The value proposition for mature repos is cross-repo visibility and standardization, not "we're better than what you have."
