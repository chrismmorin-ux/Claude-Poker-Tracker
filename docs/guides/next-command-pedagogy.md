# /next — Pedagogy & Rationale Companion

This doc explains **why** the `/next` command's prioritization formulas are
shaped the way they are. It exists because `kit/commands/next.md` is now a
~120-line skeleton that calls the cwos-next.js CLI quartet (per ADR-037
Phase 2 / SPR-105–107). The skeleton intentionally omits the WHY-text to
stay under its line cap; this doc is where that prose lives.

Read this between sessions when you want to understand a value, change a
threshold, or extend the formulas. Every value below is also configurable
via `.cwos-config.yaml` (see § "Tuning" at the end).

---

## 1. Sprint composition: ceremony caps + effort math

The `/next` CLI composes a sprint from the candidate backlog under two caps:
**item count** and **total effort sessions**. Both caps come from the
ceremony level in `.cwos-config.yaml`:

| Ceremony | max_items | max_effort_sessions |
|----------|-----------|---------------------|
| minimal | 3 | 1 |
| standard | 5 | 2 |
| strategic | 8 | 4 |

Effort math:
- **S** = 0.5 sessions
- **M** = 1.5 sessions
- **L** = 3 sessions

When composition adds items, it stops the moment effort would exceed the
cap. **Why these particular numbers?** They align with how a non-technical
solo founder actually paces work: minimal = 1 focused stretch with no
context-switching; standard = a typical day's deep work with two natural
breakpoints; strategic = a multi-session push you commit to over 1–2 days.
Going over a cap is the founder's call (recent SPR-098..SPR-107 frequently
ran 1–2 sessions over standard cap when the cluster justified it).

---

## 2. Soft-block damping: 0.25× when `blocked_by_note` is set

Work items can be blocked by either:
- **Structured deps** (`blocked_by: [WS-NNN, ...]`) — handled by Step 2
  filter (depended-on items must be `done`).
- **Soft prereqs** (`blocked_by_note: "<text>"`) — free-form prose
  describing an unmet condition (e.g., "needs 2 more eng-engine runs",
  "waiting on SYN /checkpoint init session").

Step 2-prereq applies a **soft-block damping factor of 0.25** to any
candidate with `blocked_by_note` non-empty:

```
soft_block_factor = (blocked_by_note && blocked_by_note.length > 0) ? 0.25 : 1.0
adjusted_score = priority_score × capability_boost × context_boost × source_damping × soft_block_factor
```

**Why 0.25 (vs 0.7 for source-class damping)?** Source-class damping
discourages pattern-anchoring; `blocked_by_note` signals an actual unmet
prereq. Stronger demotion (P=64 → 16) is correct because the item
literally cannot deliver until the note's condition resolves. Items
still appear in the candidate list — never silently excluded — but rank
below most workable founder-driven work (typically P=40+).

**Visibility requirement:** When `cwos-next.js compose --human` renders
its composition_notes, soft-blocked candidates that were demoted MUST
appear in this format:

```
Deferred (unmet prereq):
  - WS-090 (was P=64, soft-blocked → 16): Requires 2 more eng-engine runs before meta-engine can analyze cross-run patterns
  - WS-091 (was P=64, soft-blocked → 16): [note text]
```

This surfaces the deferred set so the founder can clear the underlying
prereq if they want the item to anchor.

**Re-evaluation:** Soft-blocking is reversible. When the note's condition
is satisfied, clearing `blocked_by_note` (set to empty string or remove
the field) restores full priority on the next /next invocation. SPR-105,
SPR-106, and SPR-107 all cleared stale soft-block notes as deterministic
prerequisites to composition.

---

## 3. Source-class damping: 0.7× for saturated machine-emitted classes

Two priority-drift failures motivate this rule: machine-emitted items
(auto-recommendations from Step 1e + auto-promoted findings with high
RICE scores) saturate the top of the candidate list, anchoring sprint
after sprint. The constitution names this — Failed State #3 ("compliance
over value") + #10 ("self-aggrandizing complexity"). Damping fires only
**after** the pattern is established; founder-driven classes are never
damped.

**Source-class taxonomy** (priority order — first match wins):

| `source` field shape | source-class | Damped? |
|---|---|---|
| `auto-recommendation` (string) | `auto-rec` | YES (0.7×) |
| `{ engine: ... }` | `engine-finding` | YES (0.7×) |
| `{ pre_mortem_id: ... }` | `pre-mortem` | NO |
| `{ parent_ws: ... }` | `spr-followup` | NO |
| `{ plan: ... }` | `plan-internal` | NO |
| `{ conversation: ... }` | `conversation` | NO |
| absent / null / unrecognized | `untagged` | NO |

**Saturation rule:**
1. Read the last 3 completed sprints from `sprint-index.yaml` (skip
   `status: abandoned`). For each, classify its anchor's source-class.
2. Count anchors per class. If `auto-rec` count ≥ 2 OR `engine-finding`
   count ≥ 2 (in the 3-sprint window), that class is **saturated**.
3. For each candidate whose class is saturated, multiply its score by
   **0.7**:

   ```
   adjusted_score = priority_score × capability_boost × context_boost × source_damping × soft_block_factor
   ```

**Why these values:**
- **0.7×** knocks a priority-64 auto-rec down to 44.8 — below typical
  founder-driven items (50–60) but not zero. The damped item still
  appears; it just doesn't anchor.
- **3-sprint window** is responsive enough to catch saturation early
  without flapping (a single anomaly doesn't trigger).
- **Threshold of 2** gives engine-findings a 1-sprint grace period
  before damping kicks in (legitimate clusters survive).

In practice, SPR-105/106/107 all triggered engine-finding damping
because their last 3 anchors were WS-262, WS-261, WS-264 — all engine-
finding source-class. The damping correctly pulled high-score
engine-findings (WS-266, WS-267, WS-268 at P=88, P=84, P=84) down to
adjusted scores of ~60, where they still anchored because there were
no founder-driven candidates above ~50.

---

## 4. Context boost matrix

Read `system/context.md` for active items. Apply boosts to candidates:

| Context Type | Boost |
|---|---|
| `customer_issue` | 2.0× |
| `deadline` (7d away) | 1.5× |
| `deadline` (3d away) | 2.0× |
| `deadline` (1d away) | 3.0× |
| `deadline` (overdue) | 4.0× |
| `opportunity` | 1.5× |
| `risk` | 1.5× |
| `goal` | 1.2× |
| `program_health_critical` | 2.5× |
| `program_health_active` | 1.5× |

The `program_health_*` boosts apply ONLY to auto-recommendation items
whose program is at the matching tier. They do NOT apply to regular
user-created items.

**Apply the highest applicable context boost only** — don't stack within
context. So a candidate that matches BOTH `customer_issue` (2.0×) and
`risk` (1.5×) gets 2.0×, not 3.0×.

**Why escalating deadline scaling?** A 7-day-away deadline has time for
deliberation; a 1-day-away deadline needs immediate work. The 4.0× for
overdue is intentionally extreme — overdue items should anchor every
sprint until cleared.

---

## 5. Capability boost: staleness-scaled `intended` capabilities

Read `.cwos-onboarding.yaml` `capabilities:` block. For each candidate,
look up its `capability` field and apply state-based handling:

| Capability state | Effect |
|---|---|
| `declined` | **Suppress entirely** — remove from candidates |
| `intended` | Apply staleness-scaled boost (see below) |
| `enabled` | Normal scoring (no change) |
| `unconfigured` | Normal scoring |
| (no capability or capability not in onboarding block) | Normal scoring |

**Staleness boost for `intended`** — measured from `captured_at` to today:

| Age of `intended` state | Capability boost |
|---|---|
| ≤ 7 days | 1.2× |
| 8–30 days | 1.5× |
| 31–90 days | 2.0× |
| > 90 days | 2.5× (cap) |

**Why older intentions climb?** Stating an intent and then letting it sit
is a form of debt. The boost ensures intentions don't rot unaddressed —
the longer they sit, the more they nag the prioritization. Capping at
2.5× prevents pathological climbing (an item can't be more important
than 2.5× its raw score, no matter how stale the intention).

Capability boost is **orthogonal to context boost** — both apply:
`adjusted_score = priority_score × capability_boost × context_boost × source_damping × soft_block_factor`

---

## 6. Fleet-anchor rotation invariant

The CLI's anchor selection (`#1 by adjusted_score`) is **overridden** when
the fleet has been starved.

1. Read the last 4 completed sprints. Classify each anchor by program
   category:
   - **fleet/repo-goal** — anchor's `program` is `fleet-health`, OR
     `files_involved` touches `fleet/`, `kit/MANIFEST.yaml`,
     `engines/INDEX.md`, or `kit/templates/workstream/engines/registry.yaml`.
   - **internal-infra** — every other program (kit-quality,
     engine-reliability, program-integrity, self-compliance, etc.).
2. If 0 of those 4 anchors were `fleet/repo-goal`, the fleet is starved.
   Override the #1 anchor:
   - Walk the candidate list top-to-bottom (post-damping order).
   - Pick the first candidate whose program/files mark it
     `fleet/repo-goal`.
   - If found, that candidate becomes the anchor instead.

**Override escape — `internal-investment-phase`:**

If the founder is intentionally in an internal-investment phase, they
can pre-set `override_class: "internal-investment-phase"` in
`system/context.md` with a reason. When that's active, the rotation
invariant is suppressed and INV-037 (verify-side check) excludes the
affected sprints from its rolling window.

This is how SPR-094..SPR-107 ran without forced fleet rotation —
the override was set on 2026-04-29 with the reason "SYN-side
`/checkpoint init` not possible right now; continuing internal
close-out."

---

## 7. Anti-goal corpus matching

Step 4a runs anti-goal detection against the composed sprint goal +
each item title using `kit/scripts/cwos-constitutional-audit.js
--check-text`. The script loads the corpus at
`kit/data/constitutional-detector-corpus.yaml` (sections `anti_goals`
+ `failed_states`) and applies token-Jaccard + phrase-coverage matching.

**Why this is a guardrail, not a hard gate:** The check exists to make
the constitutional implication visible before approval, not to block
work. The founder retains the call. The point is friction at the
right moment.

When matches surface, the founder sees:
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

If the founder picks option 4, they're prompted for the exemption reason
(free text). Sprint YAML write (Step 5) sets:
```yaml
anti_goal_check:
  status: exempted
  reviewed_at: <iso>
  reason: "<founder text>"
  matches: [{corpus, phrase, similarity, coverage}, ...]
```

INV-038 reads this field to verify post-WS-227 sprints are accountable
to the constitution.

---

## 8. Token-budget gate (WS-272)

`cwos-token-budget.js --check` is invoked by `cwos-next.js gate`. Per
ADR-037 Decision #5, it exits 1 (BLOCK) when:

> 3 consecutive monotonic increases on `tokens_derived` for one tag
> AND latest > earliest × (1 + threshold_pct)

Default `threshold_pct = 0.15` (tunable via `.cwos-config.yaml`
`token_budget.regression_threshold`). Per-tag scoped (today only `/next`
is checked; future iterations extend per-tag for /pulse, /audit).

**Why 15% pct floor?** Pure 3-consecutive without a floor would block on
tiny-fluctuation noise (100→102→105 is 3 monotonic but only 5% over
baseline). The 15% floor prevents flapping while still catching real
regressions (100→115→135 is 35% over baseline — that's a real creep).

**Why 3-consecutive (not single-shot)?** A single high-token invocation
can be a legitimate complex sprint composition. Three in a row is a
trend.

**Why per-tag scoping?** /next regressions shouldn't affect /pulse
(different command, different reasonable token budget). Today only /next
is monitored because it's the most-invoked command; per-tag extension
follows when other commands grow consistent telemetry baselines.

**Founder ack flow** when the gate blocks:
```
/next gate --override-token-budget "<rationale ≥20 chars>"
```

The flag must include a rationale of at least 20 characters. This:
- Forces the founder to articulate WHY the regression is acceptable
- Logs a `budget_regression_acknowledged` event with the rationale
  verbatim (permanent audit trail)
- Must re-type rationale every gate invocation — no persistent
  override state. The friction is by design.

A bare `--force` flag would erase the blocking mechanism's credibility.
The flag name's length and the typed rationale create just enough
friction to discourage casual bypasses without making the override
impossible.

---

## Tuning (`.cwos-config.yaml`)

All values above can be tuned per-repo:

```yaml
ceremony: standard            # minimal | standard | strategic
sprints:
  max_items: 5                # overrides ceremony default
  max_effort_sessions: 2      # overrides ceremony default
priority:
  context_boosts: true        # enable Step 2b
  auto_promote:
    rice_threshold: 60        # auto-promote findings above this
backlog:
  source: yaml                # yaml | markdown | github-issues
  path: BACKLOG.md            # for markdown source
token_budget:
  regression_threshold: 0.15  # 15% pct floor on token-budget gate
  window_size: 3              # how many invocations the rule looks at
```

If `.cwos-config.yaml` is absent, all values fall back to the standard
defaults documented above. Most repos never need to tune anything.

---

## See also

- `kit/commands/next.md` — the ≤120-line skeleton that calls the CLI
  quartet (this companion explains the formulas it invokes)
- `docs/adrs/ADR-037.md` — the
  architectural decision that drove the WS-269 refactor
- `system/invariants.md` — INV-cli-subcommand-cap (5-cap rule for
  cwos-next/pulse/audit), INV-token-budget-blocking (gate semantics),
  INV-037 (fleet-rotation), INV-038 (anti-goal accountability)
- `kit/scripts/cwos-{next,pulse,audit,token-budget}.js` — the four
  CLI scripts that operationalize everything above
