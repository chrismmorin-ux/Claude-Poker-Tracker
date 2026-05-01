---
name: next
description: "Compose and execute sprint-based work — batches of prioritized items approved as a unit"
user-invocable: true
---

# /next — Sprint-Based Work

Organize work into sprints — coherent batches with a clear goal that the user approves once. CWOS prioritizes, sequences, and classifies items. The user approves the sprint, then CWOS executes without interruption (pausing only for design decisions on complex items).

## Output Shape

**Sprint arc:** `<active | proposed | resuming>` — `<one-clause status>` (e.g., "Active SPR-NNN, 2 of 5 items done").

`<Delta line: what this invocation did — composed a new sprint, resumed an active one, or executed N items.>`

`<Remainder: the Items table — # / Title / Mode / Effort / Decisions Needed — never prose-only.>`

### Why this sprint?
`<Value-rationale: cite program_focus, context boost, dependency cluster, or fleet-rotation rationale. Reference repo_goal, an invariant, or a finding ID. If no repo-specific token applies, declare it: "(No captured repo goal yet — Value falls back to operational context.)">`

**Do next:** Numbered options — `1. Approve` / `2. Tighten the plan` / `3. Adjust manually`.

## Step 1: Check for Active Sprint

Read `.claude/workstream/sprint-index.yaml`. Look for a sprint with `status: active`.

**If an active sprint exists:**
Read the sprint file from `.claude/workstream/sprints/SPR-NNN.yaml`.
Find the first item with `status: pending`. Skip to **Step 6: Execute Sprint** to resume.

Show sprint progress first:
```
## Active Sprint: SPR-NNN — [title]

Progress: N of M items done.
Next up: WS-NNN — [title] ([mode])
```

**If no active sprint:** Continue to Step 1b.

---

## Step 1b: Read Config

Read `.cwos-config.yaml` from the repo root (if it exists). Extract:
- `ceremony` — determines sprint caps if explicit values aren't set
- `sprints.max_items` — override for sprint item cap
- `sprints.max_effort_sessions` — override for sprint effort cap
- `priority.context_boosts` — whether to apply context boosts (Step 2b)
- `priority.auto_promote` — thresholds for finding auto-promotion
- `backlog.source` — where to read work items from (default: `yaml`)

**Ceremony defaults** (used when explicit sprint values aren't set):
| Ceremony | max_items | max_effort_sessions |
|----------|-----------|---------------------|
| minimal | 3 | 1 |
| standard | 5 | 2 |
| strategic | 8 | 4 |

If `.cwos-config.yaml` is missing, use `standard` defaults for all values.

---

## Step 1c: Shadow Backlog Sync (if applicable)

**Skip this step if `backlog.source` is `yaml` (default).** Only run for `markdown` or `github-issues`.

### For `markdown` source:

1. Determine the backlog file path:
   - If `backlog.path` is set in config, use that path
   - Otherwise, auto-detect: check `BACKLOG.md`, `TODO.md`, `ROADMAP.md` in repo root
   - If no file found, report: "No backlog file found. Set `backlog.path` in `.cwos-config.yaml` or create a `BACKLOG.md`."
2. Read the backlog file. Parse `### ` headings as work items.
3. For each item, extract fields from bullet points below the heading:
   - `**Priority:**` or `**P0-P3:**` → map to score using priority_map (P0=30, P1=22, P2=15, P3=8, default=12)
   - `**Effort:**` → S, M, or L (default M)
   - `**Status:**` → map `done`/`complete` to `done`, `in-progress` to `in_progress`, everything else to `backlog`
   - `**Tags:**` or `**Category:**` → category
   - `**Blocked by:**` → blocked_by list
   - `**Description:**` or remaining text below bullets → description
4. Generate `source_id` from heading: `heading:` + slugified title (lowercase, hyphens for spaces)
5. Generate `shadow_id`: `SH-NNN` (sequential)

### For `github-issues` source:

1. Run `gh issue list --state open --json number,title,body,labels,assignees --limit 50`
2. If `gh` CLI unavailable, report: "GitHub CLI not available. Install `gh` or switch to `backlog.source: markdown`."
3. For each issue:
   - `source_id`: `gh:<number>`
   - `title`: issue title
   - Map labels to priority: `P0`/`critical`/`urgent` → 30, `P1`/`high` → 22, `P2`/`medium` → 15, `P3`/`low` → 8, no match → 12
   - Map labels to effort: `effort:S`/`small` → S, `effort:L`/`large` → L, default → M
   - Map labels to category: use first label that isn't a priority/effort label
   - `description`: issue body (first 500 chars)

### Sync to shadow index:

1. Read `.claude/workstream/shadow-index.yaml` (create from template if missing)
2. For each parsed item:
   - If `source_id` exists in shadow index: update title, description, priority_score (but preserve CWOS status, sprint_id, claimed_at)
   - If `source_id` is new: add with `status: backlog`
   - If a shadow item's `source_id` no longer appears in the source: keep it (don't delete — source may have been reorganized)
3. Update `last_synced` timestamp
4. Write `.claude/workstream/shadow-index.yaml`

---

## Step 1d-pre: Program Activation Gate

**Before any per-program block check, verify at least one program is active.** A repo with program definitions installed but none activated cannot prioritize or validate work — CWOS has no accountability surface. This gate catches the adoption failure mode where programs physically exist in `.claude/workstream/programs/` but `registry.yaml` shows `programs: []` or every entry has `tier: dormant`.

1. Read `.claude/workstream/programs/registry.yaml`.
2. Count **physically installed** programs: files matching `.claude/workstream/programs/prog-*.yaml` (excluding `prog-template.yaml`).
3. Count **active** programs in the registry: entries in the `programs:` list where `tier` is one of `watch`, `active`, `critical` (exclude `dormant` and any entry missing a `tier` field).
4. **If installed count > 0 AND active count == 0, gate trips:**

```
⚠ Program Activation Gate: no programs are active.

[N] program definition(s) exist in .claude/workstream/programs/ but
registry.yaml shows no active programs (all dormant or programs: []).
CWOS cannot prioritize or validate work without at least one active program.

To activate a program, choose one and run:
  /pulse escalate engineering watch          (code quality baseline)
  /pulse escalate domain-correctness active  (core domain logic)

Or run /pulse to see all installed programs and pick one.

After activation, run /next again to compose your sprint.
```

**STOP.** Do NOT proceed to Step 1d, 1e, or sprint composition.

**Escape hatch:** `/pulse escalate <program-id> <tier>` moves a program from `dormant` to `watch`/`active`/`critical`, which adds it to `registry.yaml` `programs:` list and clears this gate.

**Why this gate (not just Step 1d's block_sprint):** Step 1d only fires for programs that exist AND have `block_sprint: true` AND are stale. That check is useless when the registry is empty — there are no programs for Step 1d to scan. This gate specifically catches the "installed but never activated" state that Step 1d misses.

**If the gate passes** (at least one program is active): Continue to Step 1d.

---

## Step 1d: Check Sprint Blocks

Scan all program files (`.claude/workstream/programs/prog-*.yaml`) for programs where `block_sprint: true`. **Skip programs with `monitor_only: true`** — system programs never block sprints. For each remaining program, check if the program is stale: last protocol run date + effective cadence < today.

**If any blocking programs are stale:**
```
Sprint blocked by stale program(s):

- **[program name]** — last checked [N] days ago (overdue by [N] days)
  To unblock: /pulse run [program-id]

Run the command(s) above to clear the block, then run /next again.
```

Do NOT proceed to sprint composition. The user must clear the block first.

**If no sprint blocks:** Continue to Step 1e.

---

## Step 1e: Replenish Auto-Recommendations (MANDATORY)

**This step runs EVERY TIME — do not skip it.** It is the mechanism that keeps the queue populated. If this step doesn't run, the queue starves and the self-optimization loop breaks.

1. Scan `.claude/workstream/programs/prog-*.yaml` for all non-dormant programs. **Skip programs with `monitor_only: true`** — system programs never generate auto-recommendations or work items.
2. For each program, read its `health_score` and `health_ceiling` from the program file
3. Look up the program's tier and its `target_ceiling` from `kit/templates/system/health-scoring.md`
4. If `health_score < 10` OR `health_ceiling < target_ceiling_for_tier`:
   - Check if a `source: auto-recommendation` work item with `status: backlog` already exists for this program in queue-index.yaml
   - If one already exists: skip (don't duplicate)
   - If not: generate one using the **priority waterfall** from health-scoring.md (§ Auto-Recommendation Priority Waterfall)
   - Compute its `priority_score`: `(target_ceiling - health_score) * tier_weight * phase_relevance_multiplier`
   - Write to `queue/WS-NNN.yaml` and update `queue-index.yaml`
5. If any auto-recommendations were generated, report:
   ```
   Auto-replenished: N program(s) below target → N new work items added to queue.
   ```

This ensures the queue is **never empty** while any program is below its target health. Auto-recommendations expire and regenerate when health scores change (see `/pulse` run step 5).

---

## Step 2: Gather Candidates

**If `backlog.source` is `yaml` (default):**

**Preferred read path (ADR-020 step 2):** query the typed-API state-store for deterministic O(1)/O(n) lookups:

```bash
node kit/scripts/cwos-state-store.js queue by-status backlog   # returns JSON array of backlog items
```

The `cwos-state-store` CLI reads from `.claude/workstream/state/queue.json`, which the T6:workstream reducer keeps in sync with `queue/WS-*.yaml` files. This path is preferred because it's deterministic (no AI interpretation needed) and O(1) on index keys.

**Fallback** (pre-step-2 repos or when state-store is unavailable): read `.claude/workstream/queue-index.yaml` directly. If missing or mismatched with `queue/WS-*.yaml` file count, rebuild.

Envelope context (last sprint invocation, active commands) also comes from the typed-API:

```bash
node kit/scripts/cwos-state-store.js envelope recent 5   # last 5 completed commands
node kit/scripts/cwos-state-store.js envelope active     # currently-active commands
```

**If `backlog.source` is `markdown` or `github-issues`:**
Read `.claude/workstream/shadow-index.yaml` (synced in Step 1c). Use shadow items as candidates instead of queue items. The same fields are available: `shadow_id` (used as item ID), `title`, `status`, `priority_score`, `effort`, `category`, `blocked_by`.

Filter for `status: backlog` (unclaimed) items. **Exclude items where `program` references a `monitor_only: true` program** (system programs never enter sprints). For the top 10 by `priority_score`, check `blocked_by` — skip items where blocking items are not yet `done`.

### 2-prereq. Soft Block: blocked_by_note (FIND-106 / WS-243)

`blocked_by` (structured array) handles work-item dependencies. `blocked_by_note` (free-text string) handles soft prerequisites that aren't expressible as a work-item dep — e.g., auto-recs that need N more engine runs first, or items waiting on external state. Step 2's structured-only filter doesn't see these notes, so pseudo-blocked items surface at full priority and anchor sprints they can't actually complete.

For each candidate with `blocked_by_note` set to a non-empty string (length > 0, not `null`), apply a **soft-block damping factor of 0.25**:

```
soft_block_factor = (blocked_by_note && blocked_by_note.length > 0) ? 0.25 : 1.0
adjusted_score = priority_score × capability_boost × context_boost × source_damping × soft_block_factor
```

Why 0.25 (vs 0.7 for source-class damping in Step 2d): source-class damping discourages pattern-anchoring; `blocked_by_note` signals an actual unmet prereq. Stronger demotion (P=64 → 16) is correct because the item literally cannot deliver until the note's condition resolves. Items still appear in the candidate list — never silently excluded — but rank below most workable founder-driven work (typically P=40+).

**Visibility requirement:** when composing the sprint (Step 4), if any soft-blocked candidates were demoted, list them in `composition_notes` with their notes. Format:

```
Deferred (unmet prereq):
  - WS-090 (was P=64, soft-blocked → 16): Requires 2 more eng-engine runs before meta-engine can analyze cross-run patterns
  - WS-091 (was P=64, soft-blocked → 16): [note text]
```

This surfaces the deferred set so the founder can clear the underlying prereq if they want the item to anchor.

**Re-evaluation:** soft-blocking is reversible. When the note's condition is satisfied, clearing `blocked_by_note` (set to empty string or remove the field) restores full priority on the next /next invocation.

### 2a. Capability Filter & Boost (ADR-016)

Read `.cwos-onboarding.yaml` `capabilities:` block (skip this sub-step if the file is absent or has `schema_version < 2`). For each candidate, look up its `capability` field (derived by `cwos-index` if missing) and apply state-based handling:

| Capability state | Effect |
|------------------|--------|
| `declined` | **Suppress entirely** — remove from candidates |
| `intended` | Apply staleness-scaled boost (see below) — older intentions climb |
| `enabled` | Normal scoring (no change) |
| `unconfigured` | Normal scoring (no change) |
| (no capability or capability not in the onboarding block) | Normal scoring |

**Staleness boost for `intended`:** measured from `captured_at` to today.

| Age of `intended` state | Capability boost |
|-------------------------|------------------|
| ≤ 7 days | 1.2x |
| 8–30 days | 1.5x |
| 31–90 days | 2.0x |
| > 90 days | 2.5x (cap) |

Capability boost is **orthogonal to context boost** (Step 2b) — both apply: `adjusted_score = priority_score × capability_boost × context_boost`. If a candidate has no `intended` capability boost, treat capability_boost as 1.0.

### 2b. Context Boost

Read `system/context.md`. If it has active items, apply boosts to candidates:

| Context Type | Boost |
|-------------|-------|
| `customer_issue` | 2.0x |
| `deadline` (7d away) | 1.5x |
| `deadline` (3d away) | 2.0x |
| `deadline` (1d away) | 3.0x |
| `deadline` (overdue) | 4.0x |
| `opportunity` | 1.5x |
| `risk` | 1.5x |
| `goal` | 1.2x |
| `program_health_critical` | 2.5x |
| `program_health_active` | 1.5x |

The `program_health_*` boosts apply to auto-recommendation items whose program is at the matching tier. They do NOT apply to regular user-created items.

Apply the highest applicable context boost only (don't stack within context). Calculate `adjusted_score = priority_score × capability_boost × context_boost` (capability_boost from Step 2a defaults to 1.0 if not applied).

### 2c. Program Continuity

Read session file's `current_program`. If set, prefer items from that program. Also check which programs have 3+ unclaimed items — they're candidates for a focused sprint.

### 2d. Source-Class Damping (FAIL-009 / FAIL-011 counter-boost — WS-230)

Two priority-drift failures motivate this step: machine-emitted items (auto-recommendations from Step 1e + auto-promoted findings with high RICE scores) saturate the top of the candidate list, anchoring sprint after sprint. The constitution names this — Failed State #3 ("compliance over value") + #10 ("self-aggrandizing complexity"). Damping fires only after the pattern is established; founder-driven classes are never damped.

**Step:**

1. Read the last 3 completed sprints from `sprint-index.yaml` (skip `status: abandoned`). For each, read its first item from the sprint YAML — that's the anchor.
2. For each anchor, classify its source-class by reading the queue item's `source:` field:

   | source field shape | source-class |
   |---|---|
   | `auto-recommendation` (string) | `auto-rec` |
   | `{ engine: ... }` (dict with `engine`) | `engine-finding` |
   | `{ pre_mortem_id: ... }` | `pre-mortem` |
   | `{ parent_ws: ... }` | `spr-followup` |
   | `{ plan: ... }` | `plan-internal` |
   | `{ conversation: ... }` | `conversation` |
   | absent / null / unrecognized | `untagged` |

3. Count anchors per class. If `auto-rec` count ≥ 2 OR `engine-finding` count ≥ 2 (in the 3-sprint window), that class is **saturated**.
4. For each candidate, classify its source-class via the same map. If the candidate's class is saturated, multiply its score by **0.7** (damping factor):

   ```
   adjusted_score = priority_score × capability_boost × context_boost × source_damping × soft_block_factor
   ```

   `source_damping` is **0.7** if the candidate's source-class is saturated, else **1.0**. Founder-driven classes (`pre-mortem`, `plan-internal`, `conversation`, `spr-followup`, `untagged`) are never damped — they don't have a saturation rule at all. `soft_block_factor` is **0.25** if `blocked_by_note` is non-empty (Step 2-prereq), else **1.0**.
5. Re-rank candidates by `adjusted_score` after damping is applied.

**Why these values:** 0.7× knocks a priority-64 auto-rec down to 44.8 — below typical founder-driven items (50-60) but not zero. Window of 3 sprints is responsive enough to catch capture early without flapping. Threshold of 2 gives engine-findings a 1-sprint grace period before damping kicks in (legitimate clusters survive).

---

## Step 3: Compose Sprint

Build a sprint from the ranked candidates:

### 3a. Select the anchor item
The #1 adjusted-score item becomes the sprint anchor. Its program (if any) becomes the sprint's `program_focus`.

### 3a-rotation. Fleet-Anchor Rotation Invariant (WS-230)

The anchor selection above is overridden when the fleet has been starved.

1. Read the last 4 completed sprints from `sprint-index.yaml`. Classify each anchor by program category:

   - **fleet/repo-goal** — anchor's `program` is `fleet-health`, OR `files_involved` touches `fleet/`, `kit/MANIFEST.yaml`, `engines/INDEX.md`, or `kit/templates/workstream/engines/registry.yaml` (the distribution-surface paths that actually ship to adopted repos).
   - **internal-infra** — every other program: `kit-quality`, `engine-reliability`, `program-integrity`, `self-compliance`, `simulation-framework`, `product-evolution`, `design`, `documentation-accuracy`, `corrective`. (HomeBase's own meta-system.)

2. If 0 of those 4 anchors were `fleet/repo-goal`, the fleet is starved. Override the #1 anchor:
   - Walk the candidate list top-to-bottom (in adjusted_score order, post-damping).
   - Pick the first candidate whose program/files mark it `fleet/repo-goal`.
   - If found, that candidate becomes the anchor instead. Note in the sprint YAML's `composition_notes` field: `"fleet-rotation override: original anchor was <ID>, swapped to <NEW-ID> (last 4 sprints had 0 fleet anchors)"`.
   - If no `fleet/repo-goal` candidate exists in the candidate set, leave the original #1 anchor and add a `composition_notes` entry: `"fleet-rotation override skipped: no fleet/repo-goal candidate in current backlog"`.

3. If ≥1 of the last 4 anchors was `fleet/repo-goal`, no override — proceed with the original #1.

**Override escape:** if the founder is intentionally in an internal-investment phase, they can pre-set `override_class: "internal-investment-phase"` in `system/context.md` with a reason. When that is active, the rotation invariant is suppressed and INV-037 (verify-side check) excludes the affected sprints from its rolling window.

### 3b. Pull in related items
From the remaining candidates, add items that:
- Share the same `program` as the anchor (program continuity)
- Are in the anchor's `enables` or `blocked_by` chain (dependency cluster)
- Share `files_involved` overlap with the anchor (co-located work)

### 3c. Cap the sprint
Use the sprint caps from `.cwos-config.yaml` (Step 1b). Defaults by ceremony level:
- **minimal:** up to 3 items, total effort ≤ 1 session
- **standard:** up to 5 items, total effort ≤ 2 sessions
- **strategic:** up to 8 items, total effort ≤ 4 sessions
- Effort math: S=0.5 session, M=1.5 sessions, L=3 sessions

Explicit `sprints.max_items` and `sprints.max_effort_sessions` values in config override ceremony defaults.

Stop adding items when the effort cap is reached.

### 3d. Classify each item

**"Design first" (`plan-first`)** — if ANY of these are true:
- `effort` is M or L
- `category` is `architecture` or `ux`
- `type` is `improvement` (not `bug` or `finding`)
- `files_involved` spans 3+ distinct directories
- Item has `decision_flags` populated

**"Just do it" (`execute`)** — if ALL of these are true:
- `effort` is S
- `type` is `bug` or `finding`
- No `decision_flags`
- `files_involved` in 1-2 directories

When classifying as `plan-first`, infer `decision_flags` from the item's description and category if not already set. Examples:
- Architecture items: "Architecture: [what choices exist]"
- UX items: "UX: [what layout/interaction choices exist]"
- Multi-directory items: "Scope: [what approach to use across N areas]"

### 3e. Sequence items
Order the sprint items:
1. Items with no `depends_on` and mode `execute` first (quick wins up front)
2. Items with `depends_on` chains in dependency order
3. Items with mode `plan-first` after their dependencies but before items that depend on them
4. Within same priority tier, higher adjusted_score first

### 3f. Generate sprint goal
Write a one-sentence goal in plain language describing what the user gets when the sprint is done. Frame as an outcome, not a task list.
- Good: "Escrow allocation is fixed and auditable."
- Bad: "Fix WS-042, WS-038, and WS-041."

### 3g. Aggregate decisions needed
Collect all `decision_flags` from `plan-first` items into the sprint's `decisions_needed` list. Format as: "Item #N: [decision description]"

---

## Step 4: Present Sprint for Approval

### Step 4a: Anti-goal cross-check (mandatory — WS-227)

Before rendering the approval menu, run anti-goal detection against the composed sprint goal + each item title. The check uses `kit/scripts/cwos-constitutional-audit.js --check-text` which loads the corpus at `kit/data/constitutional-detector-corpus.yaml` (sections `anti_goals` + `failed_states`) and applies token-Jaccard + phrase-coverage matching.

```bash
node kit/scripts/cwos-constitutional-audit.js --check-text "<sprint-goal>; <item-1-title>; <item-2-title>"
```

Pass the sprint's `goal` field followed by each item's `title`, semicolon-separated. The script exits 0 (no matches → clean) or 1 (matches → founder must EXEMPT).

Behavior:
- **Exit 0 (clean):** Render approval menu as normal. Inline before the `Options:` block, show: `✓ Anti-goal check: clean.` Sprint YAML write (Step 5) sets `anti_goal_check: { status: passed, reviewed_at: <now-iso> }`.
- **Exit 1 (matches):** Render the matches verbatim before the approval menu, with the constitutional clause they map to. Add a 4th approval option:
  ```
  ⚠ Anti-goal cross-check surfaced 1+ match(es):
    • [anti-goal | failed-state] match — corpus phrase "<phrase>" (similarity X.XX, coverage X.XX)
      Maps to: <constitutional clause from system/intention.md>
  
  Options:
    1. Approve (yes) — proceed; founder is implicitly accepting the match (NOT recommended)
    2. Tighten the plan before starting (~2 min)
    3. Adjust manually or pick a different focus
    4. Approve with EXEMPTION — accept the constitutional risk; founder provides a reason that gets recorded in the sprint YAML
  ```
  If founder picks option 4, prompt for the exemption reason (free text). Sprint YAML write (Step 5) sets `anti_goal_check: { status: exempted, reviewed_at: <now-iso>, reason: "<founder text>", matches: [...] }`.

The check is a guardrail, not a hard gate. The founder retains the call. The point is making the constitutional implication visible before approval, not blocking work.

```
## Proposed Sprint: SPR-NNN

### Goal
[One sentence: what you get when this is done]

### Items (in order)
| # | Title | Mode | Effort | Decisions Needed |
|---|-------|------|--------|-----------------|
| 1 | [title] | Just do it | S | None |
| 2 | [title] | Design first | M | [flags] |
| 3 | [title] | Just do it | S | None |

### Total effort: [human-readable sum]

### Decisions I'll need from you before executing:
[Only shown if any plan-first items exist]
- #2: [decision description]
- #4: [decision description]

### Why this sprint?
[If sprint has a program_focus, show program context:]
This sprint focuses on the **[program name]** program — [first sentence of contract].

[1-3 bullet points explaining the prioritization logic]
- [What context boost or program focus drove the selection]
- [What dependency or co-location grouped these items]

[Anti-goal check result inline here — see Step 4a above]

Options:
  1. Approve (yes)
  2. Tighten the plan before starting (~2 min)
  3. Adjust manually or pick a different focus
  [4. Approve with EXEMPTION — only shown when Step 4a found matches]
```

### Step 4b: Choice-Point Protocol (ADR-011)

The menu above is the founder-facing surface — three action-outcome options, no internal engine names. Internally, option 2 routes to whichever refinement engine fits the sprint shape (a flagged decision goes to `decision-enhance`; otherwise `sprint-enhance`).

Engine availability check (silent — never leak names to founder):

1. Check `.claude/workstream/engines/registry.yaml` for engines with `choice_point.accepts: sprint`
2. Note whether `sprint-enhance` is registered (controls option 2 availability for sprints with no flagged decisions)
3. Note whether `decision-enhance` is registered AND any items have `decision_flags` (overrides option 2 routing for those sprints)
4. If neither refinement engine is available, omit option 2 entirely — present a 2-option prompt (Approve / Adjust)

**Rules:**
- "Approve" is always option 1 — refinement is an upgrade, not a gate
- No nesting: a refinement engine's output replaces the sprint and returns to this same choice point with "Approve refined sprint? (yes / revert to original / adjust)"

**User responses:**
- **"yes" / "approve" / "1"** → Write sprint YAML, proceed to Step 5
- **"tighten" / "refine" / "2"** → Internally select the refinement engine: if any item has `decision_flags` and `decision-enhance` is registered, ask which flagged decision to refine and run `decision-enhance`; otherwise run `sprint-enhance` on the composed sprint data. Present the refined output at this same step with options: "Approve refined sprint? (yes / revert to original / adjust)"
- **"adjust" / "different focus" / "one item" / "3"** → Ask what to change. Founder may name a different program/area to focus on, request a single-item sprint, or describe specific edits (add/remove items, reorder, change scope). Recompose accordingly.

---

## Step 5: Write Sprint

### 5a. Generate sprint ID
Scan `.claude/workstream/sprints/SPR-*.yaml` for max numeric ID. Use max + 1. Update `config.yaml` cache.

### 5b. Create sprint directory
Create `.claude/workstream/sprints/` if it doesn't exist.

### 5c. Write sprint file
Write `.claude/workstream/sprints/SPR-NNN.yaml` using the sprint-template schema with all composed data. Set `status: approved`, `approved_at: <timestamp>`.

**Persist the Step 4a anti-goal check result in the sprint YAML** under a top-level `anti_goal_check:` block:
- If founder approved with no matches: `anti_goal_check: { status: passed, reviewed_at: <iso> }`
- If founder picked option 4 (EXEMPTION): `anti_goal_check: { status: exempted, reviewed_at: <iso>, reason: "<founder text>", matches: [{ corpus, phrase, similarity, coverage }, ...] }`
- If founder picked option 1 despite matches (implicit accept — discouraged): `anti_goal_check: { status: accepted_implicit, reviewed_at: <iso>, matches: [...] }` and surface a warning row in Step 5 summary

INV-038 reads this field to verify post-WS-227 sprints are accountable to the constitution.

### 5d. Update queue index
For each item in the sprint, update its entry in `queue-index.yaml`: add `sprint_id: "SPR-NNN"`.

### 5e. Update sprint index
Add the sprint summary to `sprint-index.yaml`.

### 5f. Claim all items
Update each item's YAML: `status: claimed`, `claimed_by: <session-id>`, `claimed_at: <timestamp>`.

Now proceed to Step 6.

---

## Step 6: Execute Sprint

Work through sprint items in sequence. The execution protocol depends on each item's `mode`.

### For each item in order:

**Announce the item:**
```
--- Item N of M: [title] [[mode label]] ---
```

**If `mode: execute` ("Just do it"):**
1. Read the full work item YAML (description, accept_criteria, files_involved)
2. Update item status in sprint YAML: `status: in_progress`
3. Update queue item: `status: in_progress`, `started_at: <timestamp>`
4. **Do the work.** Make code changes, following accept_criteria.
5. Run verification (tests, lint, type checks from vital signs)
6. If verification passes:
   - Update queue item: `status: done`, `completed_at: <timestamp>`
   - Update sprint item: `status: done`, add completion notes
   - **Resolve linked finding** (Step 6b below)
   - Brief completion note to user: `✓ Done. [one-line summary of what changed]`
   - **Continue to next item without pausing**
   - (Index updates and archival happen via `cwos-reconcile.js` + `cwos-gc.js` at end of sprint, not per-item)
7. If verification fails:
   - Report the failure to the user
   - Offer: "Fix it (I'll try again) / Skip (move to next item) / Stop (pause sprint)"

**If `mode: plan-first` ("Design first"):**
1. Read the full work item YAML
2. Update item status in sprint YAML: `status: in_progress`
3. **Enter plan mode** (use the EnterPlanMode tool)
4. In plan mode:
   - Explore the relevant code
   - Design the implementation approach
   - Present the design with the item's `decision_flags` explicitly called out
   - Ask the user for decisions on each flag
5. On user approval of the design: exit plan mode (ExitPlanMode)
6. Execute the approved design
7. Run verification
8. Same completion/failure flow as `execute` items above

### Step 6b: Resolve Linked Finding & Recalculate Health

**This step runs automatically after each work item is marked done.** It closes the finding→health pipeline so that health scores stay current.

1. Check if the completed work item has a `finding_id` field
2. If yes:
   a. Read `findings/FIND-NNN.yaml`
   b. If `status` is not already `resolved`:
      - Set `status: resolved`
      - Set `resolved_at: <timestamp>`
      - Set `resolved_by: <work-item-id>`
   c. (findings-index.yaml is regenerated by cwos-reconcile at end of sprint — do not hand-patch)
3. If the completed work item has a `program` field:
   a. Recount open findings for this program: scan `findings-index.yaml` for entries where `program` matches AND `status` is not `resolved` or `dismissed`
   b. Recount open work items: scan `queue-index.yaml` for entries where `program` matches AND `status` is `backlog` or `in_progress`
   c. Recompute `health_score` using the formula from `kit/templates/system/health-scoring.md`:
      ```
      finding_health = max(0.0, 1.0 - (open_critical * 0.4) - (open_high * 0.2) - (open_medium * 0.1))
      protocol_currency = average of (min(1.0, cadence / days_since_run)) for each active protocol
      problem_class_coverage = checked_classes / total_classes
      maturity_progress = maturity.level / 4
      raw = (finding_health * 0.35) + (protocol_currency * 0.25) + (problem_class_coverage * 0.25) + (maturity_progress * 0.15)
      earned_score = round(raw * ceiling)
      health_score = min(earned_score, ceiling) with hard cap penalties applied
      ```
   d. Update the program file: `health_score`, `findings_open`, `work_items_open`, `health_breakdown`, `health_updated_at`
   e. If health score changed AND an auto-recommendation exists for this program with `status: backlog`:
      - Delete the stale auto-recommendation (it was based on old health data)
      - Step 1e will regenerate a fresh one on the next `/next` invocation

**Skip this step** if the work item has neither `finding_id` nor `program` (e.g., ad-hoc tasks).

---

### After all items complete:

Update sprint: `status: completed`, `completed_at: <timestamp>`.

**Reconcile state (MANDATORY):**

```
node kit/scripts/cwos-reconcile.js --quiet
```

This rebuilds queue-index, findings-index, sprint-index, and reconciles all counters in config.yaml. It also runs cross-reference integrity checks. If integrity violations are reported, STOP and surface them to the user before showing the sprint summary.

```
--- Sprint SPR-NNN Complete ---
[Goal] ✓

Items completed: N/M
[One sentence summary of what was accomplished]

Run /next to compose the next sprint, or describe what you'd like to work on.
```

---

## Step 7: Edge Cases

### Session ends mid-sprint
The sprint stays `active`. Handoff notes in the session YAML reference the sprint ID and remaining items. Next session's `/next` will resume it (Step 1).

### User wants to skip an item
Say "skip [item]" during execution. Update the sprint item: `status: skipped`, `notes: [reason]`. Release the queue item: `status: backlog`, clear `claimed_by`. Continue to next item.

### User wants to cancel the sprint
Say "cancel sprint". Update sprint: `status: abandoned`. Release all `pending` and `in_progress` items back to `status: backlog`. Items already `done` stay done.

### Many small items in queue (automation opportunity)
If during Step 3, ALL candidates are classified as `execute` ("Just do it") AND there are 5 or more eligible items:

After presenting the sprint for approval in Step 4, add a note:

```
Tip: You have <N> small "Just do it" items. Want to run these autonomously instead?
Run `/autopilot <N>h` to schedule <N> hours of unattended work — one item per hour,
verified and committed automatically. You approve once, then walk away.
```

This is informational only — proceed with the normal sprint flow if the user approves the sprint.

### Queue is empty
If no unclaimed items exist after Step 1e (auto-recommendations already ran):

**This means ALL programs are at target ceiling.** No auto-recommendations were generated because nothing is below target.
```
All programs are at target health. The system is self-optimized.

To push further:
1. Run `/pulse escalate <program> critical` to unlock deeper analysis (blind-spot, meta-engine)
2. Run `/engine product-ideation` to generate new improvement ideas
3. Run `/engine meta-engine` for cross-program pattern analysis
4. Build a new analysis tool for an uncovered domain
```

Check `engines/styles/signals.yaml` for the `queue-empty-exploring` signal. If it matches, suggest the signal's recommended style.

### No sprint-index.yaml exists (backward compatibility)
If `.claude/workstream/sprint-index.yaml` doesn't exist, create it (empty). Then proceed with sprint composition normally. This handles repos adopted before the sprint system existed.

### User says "just one item"
Fall back to individual mode: present top 3 candidates by adjusted_score. User picks one. Claim it. Show work brief. This is the pre-sprint behavior, preserved as an escape hatch.

---

## Business-First Communication

When presenting sprints, always:
- Frame the goal as a user outcome, not a task list
- Label items as "Business Priority" or "Technical Maintenance"
- Put decisions in plain language: "How should allocations be grouped?" not "Select data partitioning strategy"
- Explain WHY items are prioritized: "This is boosted because of [customer issue / deadline / risk]"
- Use "Just do it" and "Design first" labels, not "execute" and "plan-first"

---

## Shadow-event envelope (ADR-018 step 1)

At the end of your final output — after the sprint is presented or the
sprint-complete summary has been rendered — run:

```
node kit/scripts/cwos-event.js append command_completed --track T10:compose-sprint --tag /next --payload '{"command":"/next"}'
```

This appends a `command_completed` event to the shadow log. Per-mutation
events (queue-item claims, sprint writes, etc.) fire from the invoked
scripts, not from this command. The CLI is non-fatal — do not gate any
output on it.
