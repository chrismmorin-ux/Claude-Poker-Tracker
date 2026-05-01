# Body-of-Work (BoW) Contract Schema

**Status:** v1 (executable). Source: ADR-015. Used by SPR-045/046 (retrofit) and SPR-047 (validation).

The BoW contract is the required output shape for first-touch commands that advance the user through a state arc. Replaces today's implicit assumption that the in-repo AI will reconstruct state from kit files.

## Schema design decision

**Per-arc schemas sharing a common envelope.** The adoption arc, sprint arc, and program arc are structurally different (linear milestones vs. bounded batch vs. tier ladder). Forcing one schema collapses meaningful distinctions. Common envelope keeps the user-facing shape consistent.

## Common envelope (always emitted)

```yaml
arc: <arc-name>                 # "adoption" | "sprint" | "program" | <future>
current: <state-id>             # current state in the arc
advanced_by_invocation: <text>  # what this command call did, or "diagnostic-only"
next_action: <text>             # concrete recommended next action with rationale
```

These four fields satisfy FRS dimensions Location, Delta, and Next action.

## Conditional fields (emitted on first encounter / state transition / --full)

```yaml
states: [<state-id>, ...]       # ordered list of states in this arc
done_looks_like: <text>         # how user recognizes completion of `current`
remaining: [<text>, ...]        # what stands between current and next state
```

Required when entering an arc for the first time, on transition, or on explicit request. See FRS rubric "Progressive disclosure policy."

## Per-arc shapes

### Adoption arc

```yaml
arc: adoption
states: [M1, M2, M3, M4, M5]
current: M2
advanced_by_invocation: "Captured 2 of 3 invariants; context.md still empty."
remaining:
  - "Capture context.md (5 min)"
  - "Confirm last invariant (trial-signup latency)"
done_looks_like: "All four system files (vital_signs, invariants, constraints, context) populated and confirmed."
next_action: "Run /session-start and answer the context prompt; unblocks goal-weighted /next."
```

State definitions live in `kit/templates/cwos-onboarding.yaml` L67–131 (already authoritative).

### Sprint arc

```yaml
arc: sprint
states: [draft, approved, in-progress, completed]
current: in-progress
sprint_id: SPR-043
items_total: 2
items_done: 1
advanced_by_invocation: "Composed sprint, captured user approval."
remaining:
  - "WS-100: flesh out FRS rubric + BoW schema"
done_looks_like: "All items in the sprint at status: done."
next_action: "Pick up WS-100; resolve three decision flags before writing specs."
```

Lifts directly from `/next`'s existing model (`kit/commands/next.md` L227–430).

### Program arc

```yaml
arc: program
states: [dormant, watch, active, critical]
current: active
program_id: kit-quality
health_score: 87
advanced_by_invocation: "Ran sweep protocol; 0 new findings."
remaining:
  - "Schedule next sweep (in 5 days per cadence)"
done_looks_like: "Program reaches and holds tier `active` with health ≥80 across two sweep cycles."
next_action: "No action required this session. Tier escalates to critical if health drops below 70."
```

Lifts from program-tier machinery (`kit/templates/system/health-scoring.md`).

## Rendering

- Position: leading block of the response, before any narrative.
- Form: human-readable prose that maps 1:1 to the schema fields, *not* a YAML dump. The YAML form above is the contract; the rendering is its presentation.
- Reference rendering: see the worked example in `docs/frs-rubric.md`.

## Machine-readable form for `/sim` + `/replay`

Validation runs parse the response and check for the schema fields. Two acceptable strategies:

1. **Implicit parsing.** Auto-scorer locates state names from the arc's `states` list, the `advanced_by_invocation` sentence, and the `next_action` recommendation via pattern matching. Used by default — no command changes required beyond emitting good prose.
2. **Explicit comment block.** Commands optionally append a hidden HTML comment `<!-- bow: ... -->` containing the YAML envelope. Used when implicit parsing is unreliable for a command. Optional, not required.

## Migration pattern

For a command whose current output doesn't map cleanly:
1. Identify which arc(s) the command operates within. (`/status` touches adoption + program arcs simultaneously.)
2. For each, decide which envelope fields apply.
3. Refactor the command's prose to lead with the envelope fields, then carry on with whatever else it does.
4. Run the command in `/sim` against ≥1 fixture repo and confirm the auto-scorer extracts the fields.

## Rendering primitives (extracted from `/next`)

`/next` is the only first-touch command that scores 4/5 on the FRS rubric today. SPR-046 lifts its rendering shape as the shared template. Five primitives, in order:

1. **State banner** — the leading line names the arc and current state.
   - `/next`: `## Active Sprint: SPR-NNN — [title]` or `## Proposed Sprint: SPR-NNN`.
   - General form: `**<Arc> arc:** <state> — <one-clause status>`.

2. **Delta line** — one sentence on what this invocation did. If nothing changed, the literal phrase **"Diagnostic-only — no state change."** is the canonical declaration.
   - `/next`: `Progress: N of M items done.` (resume) or composition narrative (new sprint).

3. **Remainder block** — what stands between current state and the next transition. Renders as a table when items are enumerable, otherwise a short bullet list.
   - `/next`: the Items table (`# / Title / Mode / Effort / Decisions Needed`).
   - General form: structured list, never prose-only.

4. **Value-rationale block** — repo-specific justification. Cites captured `repo_goal`, an invariant, a finding ID, or an active context entry. Never generic.
   - `/next`: `### Why this sprint?` block citing program focus, context boost, or dependency cluster.
   - **This is the dimension most likely to fail.** If no repo-specific token can be cited, the command must say so explicitly: `(No captured repo goal yet — Value falls back to operational context.)`

5. **Numbered next-actions** — concrete options the user can pick, with rationale per option. Default option is always #1.
   - `/next`: `Options: 1. Approve / 2. Refine with sprint-enhance (~2 min) / 3. Adjust manually / ...`.
   - For non-interactive surfaces (`/status`, `/welcome` post-summary), reduce to a single line: `**Do next:** <command> — <one-clause rationale>.`

## Retrofit recipes

Per-target, what to lift and where it goes. All recipes assume the envelope is the **leading block** of the response. Existing prose carries on after.

### `/welcome` (currently 0/5)

- Replace the tour-style header with the state banner naming the **adoption arc** at the user's current M-state.
- Insert delta line citing what `/adopt` just installed (or, on repeat invocation, "Diagnostic-only — no state change").
- Render remainder as a table of M-states with done/current/upcoming markers. Cite `done_looks_like` for the current state.
- Value: cite the captured `repo_goal` from `system/onboarding-state.yaml`. If placeholder, declare it.
- Replace the generic "Daily Flow" close with a single numbered next-action.

### `/status` (currently 0/5)

- Multi-arc command per `bow-contract.md` migration pattern §1. Emit **adoption-arc envelope first**, then the existing program-arc dashboard.
- Adoption-arc state banner replaces the silent header. Diagnostic-only declaration is the default delta (status rarely advances state).
- Remainder: one sentence on what stands between current health and target. Reuse the existing `Next Action` per-program field.
- Value: lift one open critical finding or RED vital sign and tie it to the captured goal.
- Next-action: keep the existing `ACTION REQUIRED` format; add a fallback single-line directive when no critical state exists.

### `/session-start` (currently 1/5)

- Already strong on Next-action. Add adoption-arc state banner above the existing Program Accountability table.
- Add delta line citing what session-start did (read N system files, populated session ID, etc.) — usually "Diagnostic-only" for repeat sessions.
- Remainder reuses Program Accountability `Next Action` column. No separate block needed.
- Value: cite a fact from `system/context.md` (already read) tied to the captured `repo_goal`.

### `/onboard-check`

- Structural change first (see WS-110 decision). If inlined: emit the M-state banner inside `/status` and `/session-start`. If promoted: render the full envelope as the command output.
- Either way: state banner names current M-state, delta names which checks advanced this run, remainder names which checks remain in current M-state.
- Value: cite the specific check that's blocking advance, tied to the captured goal where possible.

### `/next` — no retrofit

- Already passes 4/5. Keep as-is. The Value PARTIAL becomes PASS automatically once `/adopt` (SPR-045) captures `repo_goal` and the "Why this sprint?" block can cite it.

## Out of scope (deferred)

- Multi-arc commands (e.g., `/status`) — render one envelope per arc; UX details handled in retrofit sprints.
- Schema versioning — handle on first breaking change.
- Persistent storage of envelope state — already covered by `system/onboarding-state.yaml`, sprint files, program files.
