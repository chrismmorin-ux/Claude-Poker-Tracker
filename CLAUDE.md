# CWOS Session Protocol

**You can ALWAYS just describe what you want in plain English.** Commands below are optional shortcuts — if you say "fix that bug" or "make the homepage faster", Claude does it.

## Adaptive Session Protocol

Claude matches ceremony to task weight automatically.

### Quick Fix Mode
**When:** Bug, error, small change. Trigger: "fix", "broken", "error", "customer says", single-file scope.
- Read ONLY: `CLAUDE.md` + `system/state.md` (vital signs)
- If fix touches a program's `scope_paths` — mention it. If `failures.md` has a related pattern — mention it.
- No session file. No verification unless financial/security code.
- After: one line in Recent Sessions (`quick-fix` tag). Append Heavy/Medium implicit decisions to `decisions.md`. Update `usage.yaml` counters silently.

### Standard Mode (default)
**When:** Feature work, "what's next", multi-file changes. **Default when intent unclear.**
- **Fast orient:** Read `system-summary.yaml` first (if exists). Escalate to full reads only if vitals failing, programs stale, or critical findings.
- **Sprint check:** Read `sprint-index.yaml` — lead with active sprint progress if one exists.
- **Fallback:** Read `system/state.md` + `context.md` + top 3 unclaimed from `queue-index.yaml` + stale programs.
- Skip `invariants.md`, `decisions.md`, `failures.md` at start (read on-demand).
- Note project phase from `state.md` — affects priority scoring.
- **Program alert:** If any program is RED or has stale findings, one-line alert.
- Track work items. Run `/verify` before done. Update `state.md` after. Append implicit decisions. Update `usage.yaml` silently.

### Strategic Mode
**When:** User runs `/plan`, `/engine`, `/audit`, says "full session", or invokes `/session-start full`. (Bare `/session-start` is adaptive — lean by default, full when state signals escalation.)
- Full ceremony: all system files, programs, recommendations, previous handoff. Session YAML. Full verification + state update + GC.

### Mode Rules
- **Default:** Standard. **Override:** "quick fix" or "full session" forces mode.
- **Escalation:** Quick Fix touching 3+ files or multiple programs → suggest Standard.
- **No de-escalation.** Strategic stays Strategic. **Maturity:** Orient less as project matures — targeted intelligence, not comprehensive surveys.

## Engine Selection (Proactive Suggestions)

Claude should **proactively suggest the right engine** for the situation rather than waiting for the user to guess. Before executing a non-trivial task, check whether an engine fits better than ad-hoc analysis.

### Situation → Engine Map

| User Signal | Suggest Engine | Config |
|-------------|---------------|--------|
| "Is this ready to ship?" / pre-launch anxiety | `eng-engine` | 6-persona, focus=full |
| "Review this module / PR / feature" | `eng-engine` | 6-persona, focus=<area> |
| "I want to refactor X" | `refactor-prep` | default |
| "I need to upgrade dep X" | `upgrade-prep` | default |
| "I'm planning a schema change" | `migration-prep` | default |
| "Should I do A or B?" | `decide` → `decision-enhance` | default |
| "Is my plan any good?" | `plan-enhance` | default |
| "Something is broken in prod" | `incident-response` | default |
| "Something feels off but I can't name it" | `eng-engine` | budget trio, focus=full |
| "Financial logic concerns" | `financial-audit` | default |
| "UX doesn't feel right" | `ux-audit` | default |
| "Legal/compliance question" | `legal-safety` | default |
| "Tests are weak" | `eng-engine` | focus="testing" |
| "Priorities are unclear" | `traction` | default |
| "What's the strategic play?" | `business-engine` | default |

### After-action Engine Chains

When one engine completes, proactively suggest the next step if findings warrant:

| After Running | Suggest Next | When |
|---------------|-------------|------|
| `eng-engine` | `traction` | Any HIGH/CRITICAL findings — re-score backlog |
| `eng-engine` | `financial-audit` | Findings touched payment/money code |
| `eng-engine` | `ux-audit` | product-ux persona flagged 3+ UX issues |
| `eng-engine` | `context-curator` | Findings feel generic or miss obvious issues |
| `plan-enhance` | `decision-enhance` | Plan contains unresolved tradeoffs |
| `refactor-prep` | `eng-engine` (focus=area) | After refactor completes |
| `upgrade-prep` | `verify` | Before merging upgrade PR |
| Any engine | `/decide` | Engine surfaced an architectural question |

Frame suggestions as business outcomes, not engine names: "Your API has critical security issues. Want a deeper attack chain analysis?" — not "Run security-deep-dive."

**Do NOT suggest an engine** for narrow lookups, single-line fixes, or when the user already specified exact scope.

**Engine Intent Contract pre-flight (ADR-038 Layer 3, WS-277).** When `/engine <id>` runs, `cwos-frame compose` resolves mode/readiness/success_shape/scope_ceiling/stretch before tokens burn. If the founder signals impatience ("just go", "skip the framing", "I know what I want") OR has clearly already locked the framing in the previous turn (explicit mode + target + scope all stated), surface the **`--just-run`** escape valve verbatim: "Use `/engine <id> --just-run` to skip pre-flight (will record bypass + go directly to engine execution)." Do NOT default to `--just-run` proactively — the contract has real value when framing is ambiguous; only surface the escape when friction signals are clear.

## Sprint Protocol
Work is organized into **sprints** — small batches (3-8 items) with a clear goal, approved once.
1. **Compose:** `/next` selects items from queue, groups by program/dependencies, classifies as "Just do it" or "Design first"
2. **Approve:** User reviews goal + items + decisions needed, approves once
3. **Execute:** "Just do it" = autonomous, brief note, no pause. "Design first" = plan mode, user decisions, then execute.
4. **Complete:** Run `/next` for next sprint
- One active sprint at a time. `/next` resumes before proposing new. Mid-session end preserves sprint. User can skip items or cancel.

## Progressive Onboarding & Deferred Installation
If `.cwos-onboarding.yaml` exists and M5 not complete:
- Read silently. Suggest ONE natural improvement per session ("Want me to..." not "You need to..."). Never advance 2+ milestones per session. Never show milestone names or YAML to user.

If user invokes an uninstalled command:
- Check `deferred_commands` manifest. If the command's capability is enabled (or intended) in `.cwos-onboarding.yaml`: install the group silently + dependencies, then run. If the capability is not enabled: explain what's missing and suggest enabling it via `/discover`.

### First Session
If `.cwos-version` exists and `usage.yaml` shows `welcome_completed` false → run `/welcome` first.

## Graceful Degradation

Commands must work at any milestone. When encountering missing state:

| Severity | Action | Examples |
|----------|--------|----------|
| **BLOCKING** | Auto-scaffold silently, proceed | No `queue-index.yaml` → create structure. No `engines/registry.yaml` → install from HomeBase. |
| **DEGRADED** | Use defaults, mention once | No `invariants.md` → skip checks. No `context.md` → no boosts. |
| **OPTIONAL** | Skip silently | No custom personas → default analysis. No `usage.yaml` → skip telemetry. |

- Never show YAML paths or milestone names to user. Never say "you need to reach M3 first."
- When auto-scaffolding: prefer minimal creation. Log to `.cwos-feedback.yaml` friction_log. Read HomeBase path from `.cwos-version.homebase_path`.

## Friction & Feedback
- If a command fails or needs a workaround: fix silently, log to `.cwos-feedback.yaml` at session end.
- If user expresses frustration or preference about CWOS: log to `.cwos-feedback.yaml` under `user_feedback`, acknowledge briefly, don't argue.
- Platform (from `.cwos-onboarding.yaml`): on Windows, prefer Python for datetime, avoid `set -euo pipefail` in hooks, avoid `$$` for PID.

## Standard Commands

| Command | Purpose |
|---------|---------|
| `/status` | Health dashboard — vital signs, queue, programs |
| `/next` | Compose or resume a sprint — batched, prioritized work |
| `/plan` | Multi-persona deliberation to plan next work bundle |
| `/engine <name>` | Run a named analysis engine |
| `/build-engine` | Create a new analysis engine |
| `/audit` | System self-audit — drift, staleness, invariant violations |
| `/verify` | Self-verification — build, test, visual, behavioral checks |
| `/session-start` | Begin session with full orientation |
| `/session-end` | End session cleanly with state update |
| `/decide` | Record an architectural decision |
| `/pulse` | Program dashboard — project areas needing attention |
| `/workstream` | Queue management (14 subcommands) |
| `/autopilot` | Schedule hours of autonomous work |

## Command Routing — Use the Envelope

When you need information that a CWOS command produces, **invoke the command**. Do not bypass to underlying scripts or YAML files when a command exists for the same operation. FIND-119 measured AI reading `prog-*.yaml` directly across 10 days while never invoking `/pulse` — defeating ADR-037's projected token savings and its observability story.

| Need | Use this | Don't |
|------|----------|-------|
| Program health / status | `/pulse` or `/status` | grep `prog-*.yaml` |
| Sprint composition | `/next` | hand-rank `queue/WS-*.yaml` |
| Drift / staleness check | `/audit drift` | run `cwos-reconcile.js` directly |
| Verify before merge | `/verify` | run individual INV scripts |
| Record a decision | `/decide` | hand-edit `decisions.md` |
| Workstream changes | `/workstream done|defer|claim|...` | hand-edit queue YAMLs |

**Exceptions** — read freely:
- `cwos-state-store.js <domain> <op>` — the typed-API path commands themselves use.
- `cwos-event.js append ...` — event emission is mandatory at command boundaries.
- One-off file reads when no command exists for the operation. (If you find yourself doing this regularly, that's a gap — flag it rather than normalizing the bypass.)

INV-cli-bypass-via-command monitors compliance from envelope telemetry; sustained bypass routes a finding to `prog-self-compliance`.

## Catch-state suggestions (ADR-040 / WS-299)

A `UserPromptSubmit` hook (`cwos-catch-state-hook.js`) runs the catch-state classifier on each founder turn. When the rule-tier (R1–R6) produces a suggestion clearing the 0.6 confidence gate, the hook injects an `additionalContext` line of the form:

> `Catch-state: consider /engine X on Y (R1,R3) conf=0.78. Founder may dismiss silently.`

When you see that line in your context, surface it to the founder in the WS-276 routing form ("Consider `/engine X on Y` — `<one-clause reason>`"). Do not insist; founder may dismiss silently or invoke a different engine. Bypass-without-friction per ADR-040 Decision #7.

If the founder invokes the suggested engine within ~30 minutes, Layer-3 `cwos-frame compose` automatically pre-fills its contract draft from the suggestion's `suggested_contract` (mode/stretch/success_shape/scope_ceiling). The provenance flows into `engine_intent_recorded.catch_state_prefill`.

## Path Resolution
Read `system_dir` from `.cwos-config.yaml` (default: `system`). Substitute in all `system/` file references. Example: `system_dir: .cwos` → `system/state.md` becomes `.cwos/state.md`.

## System State Files

| File | Location | Purpose |
|------|----------|---------|
| State | `system/state.md` | Vital signs, metrics, queue summary, sessions |
| Invariants | `system/invariants.md` | Rules that must always hold, with check commands |
| Constraints | `system/constraints.md` | Assumptions and boundaries, with verification dates |
| Decisions | `system/decisions.md` | ADR-style decision log |
| Failures | `system/failures.md` | Known failure modes — root cause, fix, prevention |
| Context | `system/context.md` | Active business context — issues, deadlines, opportunities |

The configured `system_dir` is the ONLY valid location. Legacy copies elsewhere are stale — flag via `/audit`.

## Communication Style
Non-technical founder. Lead with business impact, not technical details. Present 2 options max with clear recommendation. Label items "Business Priority" or "Technical Maintenance". Explain jargon on first use.

## Self-Verification
- After code changes: run vital sign checks (tests, lint, build)
- After UI changes: screenshots via Playwright
- Before commit: run preflight on diff
- Session end: full verification pass

## Decision Detection Protocol

During ALL work, watch for **implicit decisions** — choices made during implementation that shape product behavior but weren't explicitly recorded.

### Decision Signals
Flag a choice when it matches any pattern:

| Signal | Example |
|--------|---------|
| Behavioral choice | "Form auto-saves every 30s" |
| Business rule | "Free users get 3 projects" |
| Error/edge handling | "Retry button on timeout, not error page" |
| Data model choice | "Store allocations as percentages" |
| Integration pattern | "Webhook retries 3x with backoff" |
| Security/access | "Admins can delete but not purge" |
| UX pattern | "Tabs, not sidebar" |
| Omission | "No email confirmation for this flow" |
| Trade-off | "Speed over completeness for search" |

**Not decisions:** Routine code choices, following established patterns, implementing unambiguous specs, framework conventions.

### Detection Rules
- Flag inline: `**Decision noted:** [summary]` — don't stop working.
- If significant trade-offs: escalate with `**Decision with trade-offs:** [summary]. This means [consequence].`
- If multiple valid approaches and user hasn't specified: state choice + reasoning before implementing.
- Decisions accumulate; formalized at session end via `/session-end`. Weight classification (Heavy/Medium/Light) handled there.

## Proactive Automation
These rules run automatically, every session, without prompting.
- **After modifying code:** Run vital sign checks. If touching a program's `scope_paths`, mention it.
- **Before marking item done:** Run `/verify`.
- **Domain rules:** Always read `.claude/rules/` — they're mandatory and override general patterns.
- **Self-healing:** Stale program → auto-generate maintenance item. Failed vital sign → flag + suggest fix. Invariant check commands → run periodically. Kit version behind HomeBase → mention during `/status`.

## Autonomous Work Cycle
When working autonomously: active sprint → resume | no sprint → `/next` → approve | queue empty → `/audit` → compose | still empty → `/plan` | still empty → drift-detector questions.
**Always stop and ask user for:** sprint approval, design decisions, critical findings, invariant changes.

---
<!-- CWOS Preamble End — Project-specific content below -->

# CLAUDE.md - Poker Tracker

Live poker hand tracker and exploit engine for 9-handed games. Records actions, builds Bayesian player models, and surfaces maximally exploitative plays — compensating for human limitations in memory and pattern recognition at the table.

React + Vite + Tailwind, mobile-optimized (1600x720).

## Commands
```bash
npm run dev                          # Dev server (localhost:5173)
npm run build                        # Production build
bash scripts/smart-test-runner.sh    # Tests (token-optimized, use before commits)
npm test                             # Tests (verbose, for debugging)
```

## Session Start Protocol (MANDATORY)

CWOS-canonical. The CWOS preamble at the top of this file controls overall session ceremony; this section adds poker-tracker specifics.

### Always (every session)
1. Read `system/state.md` — vital signs, queue summary, program health, recent sessions
2. Read `.claude/workstream/queue-index.yaml` (top-priority unclaimed) — know what work is open
3. Check `.claude/workstream/sessions/` for any ACTIVE session — avoid file conflicts before editing

### If multi-file or structural work
4. Read `.claude/context/SYSTEM_MODEL.md` — architecture, invariants, failure surfaces
5. Claim work via `/workstream claim WS-NNN` (CWOS) before editing

### If touching engine code (exploitEngine/, rangeEngine/, pokerCore/)
6. Read `.claude/context/POKER_THEORY.md`
7. Read the sub-directory `CLAUDE.md` in the engine you're editing

### If resuming a project
8. Read the project file in `.claude/projects/` referenced from `system/state.md` Recent Sessions

Legacy `.claude/handoffs/` directory preserved for historical reference (pre-CWOS, frozen 2026-04-30). Do NOT write new handoffs there — use `/session-end` to write to CWOS sessions.

Do NOT start coding until applicable steps are complete.

## Context Loading Guide

`state` = `system/state.md`. `queue` = `.claude/workstream/queue-index.yaml`. `sessions` = `.claude/workstream/sessions/`.

| Task Type | Read | Skip |
|-----------|------|------|
| One-file UI fix | state, sessions | SYSTEM_MODEL, POKER_THEORY |
| Multi-file feature | state, queue, sessions, SYSTEM_MODEL §1-§3 | POKER_THEORY (unless engine) |
| Engine work | state, queue, sessions, SYSTEM_MODEL, POKER_THEORY, engine CLAUDE.md | STATE_SCHEMA |
| Reducer/state change | state, sessions, SYSTEM_MODEL §3, STATE_SCHEMA | POKER_THEORY |
| Persistence/IndexedDB | state, sessions, SYSTEM_MODEL §2, PERSISTENCE_OVERVIEW | POKER_THEORY |
| Extension work | state, sessions, ignition CLAUDE.md | Main SYSTEM_MODEL |
| Architecture review | Everything | — |
| Bug fix (unknown scope) | state, sessions, SYSTEM_MODEL §5-§6, system/failures.md | Expand as needed |

## System Model (Read Before Any Multi-File Change)
`.claude/context/SYSTEM_MODEL.md` is the single source of truth for architecture, invariants, failure surfaces, coupling, and system understanding. Read it before any structural change. Update it after any architectural shift.

Supporting references (unique detail not in System Model):
- `STATE_SCHEMA.md` — reducer shapes
- `PERSISTENCE_OVERVIEW.md` — IndexedDB API summary
- `INVARIANTS.md` — standalone invariant catalog with verification dates
- `POKER_THEORY.md` — **MANDATORY before editing `rangeEngine/` or `exploitEngine/`**

## Poker Analysis Guardrail
**Before editing ANY file in `src/utils/exploitEngine/` or `src/utils/rangeEngine/`:**
1. Read `.claude/context/POKER_THEORY.md` (poker theory reference)
2. Read the sub-directory `CLAUDE.md` in the engine you're editing (domain rules + anti-patterns)
3. Read `docs/RANGE_ENGINE_DESIGN.md` if touching range estimation logic
4. Verify your changes don't regress any poker concept listed in the anti-patterns section

Generic statistical reasoning (uniform priors, z-tests, linear assumptions) is almost always WRONG for poker. The codebase uses Bayesian methods, population priors, consequence-weighted confidence, and range-based thinking for specific theoretical reasons. Do not simplify.

**First-principles decision modeling (CRITICAL):** Villain decisions derive from equity, pot odds, SPR, and players remaining — NEVER from position labels, bucket labels, or style categories directly. Labels are outputs of the decision process, not inputs. Do not add `if (position === 'EP') foldRate *= 1.05` — compute from game state. Do not use `POP_CALLING_RATES[bucket]` when per-combo equity is available — use the logistic. Do not stack style adjustments on top of the stats that define the style — that's double-counting. See POKER_THEORY.md §7 and exploitEngine/CLAUDE.md anti-patterns.

## Design Program Guardrail
**Before any UX-touching change** (new views, new widgets, interaction changes, destructive actions, layout refactors, visible copy changes on primary controls):

1. Read `docs/design/LIFECYCLE.md` — the 5 feature gates (Entry → Blind-Spot → Research → Design → Implementation).
2. Complete **Gate 1 (Entry)** before anything else: scope classification, personas identified, JTBD identified, gap analysis output (GREEN / YELLOW / RED).
3. If Gate 1 is YELLOW or RED, or the work introduces a new surface / targets an underserved persona / crosses product lines: run **Gate 2 (Blind-Spot Roundtable)** per `docs/design/ROUNDTABLES.md` before specifying the design.
4. **Gate 4 (Design)** is not bypassable — a surface artifact in `docs/design/surfaces/` must exist (or be authored same-session) for any UX change.
5. Commits and PR descriptions must reference the audit-id, surface-id, or spec-id the change implements.

**The anti-pattern the program prevents:** "Feature X went to dev, design phase was skipped, and we assumed existing personas covered it." Gate 1 forces the explicit gap question. Gate 2 surfaces the things the framework itself can't see.

Framework entry points:
- [docs/design/README.md](docs/design/README.md) — framework overview
- [docs/design/METHODOLOGY.md](docs/design/METHODOLOGY.md) — 5-step audit process
- [docs/design/PROGRAM.md](docs/design/PROGRAM.md) — program charter
- [docs/design/LIFECYCLE.md](docs/design/LIFECYCLE.md) — feature gates
- [docs/design/ROUNDTABLES.md](docs/design/ROUNDTABLES.md) — blind-spot templates
- `.claude/programs/design.md` — program governance file

Do NOT write production code for a UX change without having passed Gates 1 and 4. This supersedes "Plan first, code second" with a stronger version for UX work specifically.

## Architecture (v123)
See `SYSTEM_MODEL.md` §1 for full component map, dependency graph, and extension boundary.
Quick ref: React + Vite + Tailwind, 8 reducers, 12 contexts, 33 hooks, 13 views, 4 engines, IndexedDB v13.

## Working Principles
- **Plan first, code second** — outline your approach before writing code. For non-trivial changes, present the plan and wait for approval
- **Root cause, not symptoms** — diagnose *why* something broke before writing a fix. Never patch around a bug
- **Minimal scope** — do exactly what was asked. Do not refactor nearby code, add features, or "improve" things unprompted
- **Follow existing patterns** — study how the codebase already solves similar problems before inventing a new approach
- **Verify visually** — launch dev server and confirm UI changes render correctly. Don't assume correctness from code alone
- **State verification criteria** — after any change, explain exactly how to confirm it works (which view, what interaction, what to look for)
- **Read before writing** — understand existing code fully before modifying. Never edit a file you haven't read this session
- **Don't be surprise-proactive** — take follow-up actions only when asked. Ask before adding anything beyond the immediate request
- **Update the System Model** — after any architectural change, update `SYSTEM_MODEL.md` in the same session. Stale models cause wrong reasoning.
- **Check failure library** — after fixing a non-trivial bug, check `.claude/failures/` for known failure modes. If it's new, create a failure file.

## Rules
- ALL action recordings use `ACTIONS.*` constants (from `src/constants/gameConstants.js`)
- Use `SEAT_ARRAY` for seat iteration, `CONSTANTS.NUM_SEATS` for limits — never hardcode
- State updates via reducer dispatch only, never direct setters
- `useCallback` for props-passed functions; define helpers BEFORE dependent callbacks
- Import UI components from `src/components/ui/`
- Utils use dependency injection (constants passed as parameters)

## Common Tasks

### Adding a New Action
1. Add to `ACTIONS` in `src/constants/gameConstants.js`
2. Add to `getActionDisplayName()` in `src/utils/actionUtils.js`
3. Add to `getActionBadgeStyle()` and `getActionSeatStyle()` in `src/constants/designTokens.js`

### Debug Mode
`DEBUG = false` at line 8 of `PokerTracker.jsx`

## Starting New Work
1. Follow Session Start Protocol above (`system/state.md` + queue-index + sessions)
2. Run `/next` — composes a sprint from `.claude/workstream/queue/` (CWOS, primary). Or run `/workstream` for direct queue management.
3. Read `.claude/context/SYSTEM_MODEL.md` for architectural context, then read affected files
4. Run `/session-end` before ending your session — writes a CWOS session file with handoff notes
5. 4+ files changed → `EnterPlanMode`

`.claude/BACKLOG-legacy.md` is the pre-CWOS backlog, preserved for historical reference. Active items were migrated to `.claude/workstream/queue/WS-*.yaml` on 2026-05-01 — read those, not the legacy file. `.claude/BACKLOG_ARCHIVE.md` is the completed-items archive and remains valid historical context. `.claude/handoffs/` (140+ files) is the pre-CWOS handoff archive, frozen — do not write new files there.

### Handoff Proportionality
- **Single-file fix, no multi-session risk:** No session file needed. Update `system/state.md` Recent Sessions row if state changed.
- **Multi-file change, single session:** Run `/session-end` with handoff notes; CWOS writes the session file.
- **Multi-session project:** Full ceremony — claim via `/workstream claim`, `/session-end` at session boundary, project file in `.claude/projects/`.

## Work Discovery (When Queue Is Empty)
1. Run `/next` — auto-replenishes from active programs below their target ceiling (Step 1e).
2. Run `/health-check` — scan for staleness, regressions, drift.
3. Run `/eng-engine` — roundtable audit producing prioritized findings.
4. Check SYSTEM_MODEL.md tech debt register (§11) for items with resolution paths.
5. Ask the user — they may have requests not captured in governance.
Do not invent work. If all checks pass and user has no requests, the project is healthy.

## Responsive Design
- Target: 1600x720 (Samsung Galaxy A22 landscape)
- Scale: `min(viewportWidth * 0.95 / 1600, viewportHeight * 0.95 / 720, 1.0)`

## Testing
- ~5,400+ tests across ~184 test files (Vitest + fake-indexeddb)
- Verify across views: Table, Showdown, Stats, Sessions, Players, Settings, Analysis, HandReplay, Tournament, Online

## Analytics Pipeline
See `SYSTEM_MODEL.md` §2.2 for the 3-layer analysis pipeline (Session Stats → Player Tendencies → Exploit Generation) and §2.3-2.4 for game tree and range profile flows.

## Ignition Extension (`ignition-poker-tracker/`)
Chrome MV3 extension — WebSocket capture, side panel HUD, app sync. Has its own `CLAUDE.md` with architecture, anti-patterns, and troubleshooting.

**Visual verification is mandatory for sidebar changes:**
```bash
cd ignition-poker-tracker
npm test                   # 824+ tests (logic regressions)
npm run harness            # Serve visual harness on localhost:3333
# Then use Playwright MCP tools to screenshot all 16 scenarios
```

Key modules: `render-orchestrator.js` (extracted pure render functions), `render-street-card.js` (street-adaptive), `side-panel.js` (orchestration IIFE). See `ignition-poker-tracker/CLAUDE.md` for full details.

## Docs
- `docs/QUICK_REF.md` — constants, hooks, utils
- `docs/DEBUGGING.md` — error codes
- `docs/CHANGELOG.md` — version history
- `docs/RANGE_ENGINE_DESIGN.md` — range engine design spec
