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

Claude should **proactively suggest the right engine** for the situation rather than waiting for the user to guess. Reference `kit/engine-selection-protocol.md` for the full decision guide.

**Quick triggers:**
- "Is this ready to ship?" / pre-launch anxiety → `eng-engine` focus=full
- "Review this X" → `eng-engine` focus=X (budget trio for scoped, 6-persona for broad)
- About to refactor / migrate / upgrade → `refactor-prep` / `migration-prep` / `upgrade-prep` FIRST
- Multiple viable paths → `/decide` + `decision-enhance`
- "Something feels off" but can't name it → `eng-engine` budget trio, focus=full
- Production issue → `incident-response`

**After any engine run** — suggest the next engine in the chain if findings warrant it (see `kit/engine-selection-protocol.md` → Engine Chains). Frame suggestions as business outcomes, not engine names: "Your API has critical security issues. Want a deeper attack chain analysis?" not "Run security-deep-dive."

**Do NOT suggest an engine** for narrow lookups, single-line fixes, or when the user already specified exact scope.

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

<!-- CWOS Preamble End -->
<!-- Override: project-specific sections below take precedence over preamble defaults -->


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

### Always (every session)
1. Read `.claude/STATUS.md` — understand project state, active sessions, alerts
2. Read ALL files in `.claude/handoffs/` — know what other sessions own, avoid file conflicts
3. Before editing any file: verify no other ACTIVE session owns it (check handoff "Files I Own" sections)

### If multi-file or structural work
4. Read `.claude/context/SYSTEM_MODEL.md` — architecture, invariants, failure surfaces
5. Create or update your handoff file in `.claude/handoffs/` when you claim work

### If touching engine code (exploitEngine/, rangeEngine/, pokerCore/)
6. Read `.claude/context/POKER_THEORY.md`
7. Read the sub-directory `CLAUDE.md` in the engine you're editing

### If resuming a project
8. Read the project file referenced in STATUS.md

Do NOT start coding until applicable steps are complete.

## Context Loading Guide

| Task Type | Read | Skip |
|-----------|------|------|
| One-file UI fix | STATUS, handoffs/ | SYSTEM_MODEL, POKER_THEORY |
| Multi-file feature | STATUS, handoffs/, SYSTEM_MODEL §1-§3 | POKER_THEORY (unless engine) |
| Engine work | STATUS, handoffs/, SYSTEM_MODEL, POKER_THEORY, engine CLAUDE.md | STATE_SCHEMA |
| Reducer/state change | STATUS, handoffs/, SYSTEM_MODEL §3, STATE_SCHEMA | POKER_THEORY |
| Persistence/IndexedDB | STATUS, handoffs/, SYSTEM_MODEL §2, PERSISTENCE_OVERVIEW | POKER_THEORY |
| Extension work | STATUS, handoffs/, ignition CLAUDE.md | Main SYSTEM_MODEL |
| Architecture review | Everything | — |
| Bug fix (unknown scope) | STATUS, handoffs/, SYSTEM_MODEL §5-§6, failures/ | Expand as needed |

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
1. Follow Session Start Protocol above (STATUS.md + handoffs)
2. Check `.claude/BACKLOG.md` — claim item with `/backlog claim <id>`
3. `/project start <name>` for multi-file tasks
4. Read `.claude/context/SYSTEM_MODEL.md` for architectural context, then read affected files
5. Write `/handoff` before ending your session
6. 4+ files changed → `EnterPlanMode`

### Handoff Proportionality
- **Single-file fix, no multi-session risk:** No handoff needed. Update STATUS.md if state changed.
- **Multi-file change, single session:** Create handoff, list owned files, close before session ends.
- **Multi-session project:** Full ceremony — `/project start`, claim in BACKLOG, `/handoff` at end.

## Work Discovery (When Backlog Is Empty)
1. Run `/health-check` — scan for staleness, regressions, drift
2. Run `/eng-engine` — roundtable audit producing prioritized findings
3. Check SYSTEM_MODEL.md tech debt register (§11) for items with resolution paths
4. Ask the user — they may have requests not captured in governance
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
