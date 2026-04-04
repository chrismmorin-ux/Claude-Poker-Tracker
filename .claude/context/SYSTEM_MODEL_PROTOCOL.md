# System Model — Update Protocol, Integration & Quality Standard

---

## PART 3: Update Protocol

### 3.1 When to Update

| Trigger | What Changes | Who Updates |
|---------|-------------|-------------|
| **New component added** | Architecture §1 (components, dependency graph) | Developer or architect agent |
| **New invariant discovered** (bug revealed a rule that wasn't documented) | Invariants §4 | CTO-review agent or post-mortem |
| **Architectural decision made** | Decision Log §11 | Developer at decision time |
| **Data flow changed** (new pipeline stage, changed persistence) | Data Flow §2, State Model §3 | Developer making the change |
| **Bug traced to hidden coupling** | Hidden Coupling §6 | Developer fixing the bug |
| **Performance issue discovered** | Scaling §7, Failure Surfaces §5 | Developer or reviewer |
| **Security boundary changed** (new external integration, auth change) | Security §8 | Developer + security review |
| **Technical debt incurred knowingly** | Tech Debt §10 | Developer (document at creation) |
| **Post-roundtable** | Any section flagged by personas | Roundtable orchestrator |

### 3.2 Update Rules

**Rule 1: Update at the point of change, not retroactively.**
When you change architecture, update the model in the same commit. Retroactive updates drift.

**Rule 2: Every invariant must name its enforcer.**
`enforcedBy` is required. An invariant without enforcement is a wish, not a guarantee. If you can't name the file/test/lint rule, the invariant isn't real yet.

**Rule 3: Failure surfaces require likelihood AND impact.**
"This might break" is not useful. "This breaks when X (likelihood: medium) and causes Y (impact: critical)" is actionable.

**Rule 4: Hidden coupling entries require a breaking scenario.**
"A depends on B" is not enough. "If you change B's key format from `{id}_{pos}` to `{id}:{pos}`, A silently produces wrong lookups" — that's useful.

**Rule 5: Decision log entries require rationale AND alternatives considered.**
"We chose X" without "because Y, not Z" provides no future guidance. The rationale is what prevents the next developer from re-evaluating the same alternatives.

### 3.3 Preventing Drift

| Mechanism | How It Works |
|-----------|-------------|
| **Version bump** | Increment patch for section updates, minor for structural changes, major for rewrites |
| **Date stamp** | `updated` field in header changes on every edit |
| **Staleness check** | If `updated` is >30 days old and significant commits have landed, flag for review |
| **Invariant audit** | Monthly: for each INV-*, grep codebase for violations. For each NEV-*, verify detection method exists |
| **Cross-reference** | System Model references should match STATE_SCHEMA.md, PERSISTENCE_OVERVIEW.md. If they diverge, one is wrong |

### 3.4 Merging Conflicting Updates

When two agents/sessions update the System Model concurrently:

1. **Additive changes merge cleanly**: New invariant + new failure surface → both apply.
2. **Contradictory changes require resolution**:
   - Compare the `rationale` field. The update with stronger evidence wins.
   - If evidence is equal, the more conservative (risk-reducing) interpretation wins.
   - Log the conflict in the Decision Log with both perspectives.
3. **Structural changes (section rewrite)**: Later timestamp wins, but must incorporate any additive items from the earlier version.

---

## PART 4: Integration with Roundtable Engine

### 4.1 Roundtable Personas

Seven personas participate in each roundtable. Each has a defined focus, reads specific System Model sections, and has scoped write permissions.

| # | Persona | Focus | Runs |
|---|---------|-------|------|
| 1 | **SYSTEMS ARCHITECT** | Architecture, invariants, coupling, long-term structure | Parallel (round 1) |
| 2 | **SENIOR ENGINEER** | Implementation reality, maintainability, developer experience | Parallel (round 1) |
| 3 | **FAILURE ENGINEER** | How the system breaks, edge cases, cascading failures | Parallel (round 1) |
| 4 | **PERFORMANCE ENGINEER** | Latency, scaling, resource efficiency | Parallel (round 1) |
| 5 | **SECURITY ENGINEER** | Attack surface, data integrity, trust boundaries | Parallel (round 1) |
| 6 | **PRODUCT / UX THINKER** | Unintended user behavior, UX-driven system stress | Parallel (round 1) |
| 7 | **FACILITATOR** | Synthesis, conflict resolution, depth enforcement | Runs LAST (round 2) — does NOT propose new ideas initially |

### 4.2 Pre-Run Context Loading

Before any multi-agent roundtable begins, the orchestrator loads:

```
Required reading (injected into ALL 7 personas):
├── SYSTEM_MODEL.md §4 (Invariants)     — hard constraints on reasoning
├── SYSTEM_MODEL.md §6 (Hidden Coupling) — implicit dependency awareness
└── SYSTEM_MODEL.md §1.2 (Dependency Graph) — structural context

Persona-specific loading:
├── SYSTEMS ARCHITECT:     §1 (full), §2, §3, §7, §11 (decision log)
├── SENIOR ENGINEER:       §1.1 (components), §3, §5, §6, §10 (tech debt)
├── FAILURE ENGINEER:      §5 (full), §6 (full), §7.2 (bottlenecks), §9 (observability gaps)
├── PERFORMANCE ENGINEER:  §7 (full), §2 (data flows), §5, §9
├── SECURITY ENGINEER:     §8 (full), §5, §6, §3.3 (consistency guarantees)
├── PRODUCT / UX THINKER:  §2 (data flows), §5, §7.1 (scaling assumptions), §9
└── FACILITATOR:           ALL sections (full model) + all prior persona outputs
```

### 4.3 Persona Reasoning Integration

Each persona MUST check their reasoning against the System Model before speaking:

**SYSTEMS ARCHITECT — before proposing structural changes:**
1. Check invariants (§4) — does this proposal violate any INV-* or NEV-*?
2. Check dependency rules (§1.2) — does this introduce a forbidden import direction?
3. Check decision log (§11) — was this already decided and rejected?

**SENIOR ENGINEER — before proposing implementation:**
1. Check hidden coupling (§6) — does this touch a coupled component?
2. Check tech debt (§10) — does this add or resolve a debt item?
3. Check state ownership (§3.2) — does this mutate state through the correct owner?

**FAILURE ENGINEER — before flagging risks:**
1. Check existing failure surfaces (§5) — is this already documented?
2. Check hidden coupling (§6) — does this create a new cascading failure path?
3. Check observability gaps (§9) — would this failure be detectable?

**PERFORMANCE ENGINEER — before flagging bottlenecks:**
1. Check scaling assumptions (§7) — are current numbers still accurate?
2. Check data flows (§2) — which critical path is affected?
3. Check existing bottlenecks (§7.2) — is this a known vs new issue?

**SECURITY ENGINEER — before flagging vulnerabilities:**
1. Check trust zones (§8.1) — which boundary is crossed?
2. Check input validation (§8.3) — is the entry point already validated?
3. Check consistency guarantees (§3.3) — can this corrupt state?

**PRODUCT / UX THINKER — before flagging UX-driven stress:**
1. Check data flows (§2) — which user-facing path is affected?
2. Check failure surfaces (§5) — does user behavior trigger a known fragile area?
3. Check scaling assumptions (§7) — does user behavior at scale break assumptions?

**FACILITATOR — runs last, after reading all persona outputs:**
1. Check for contradictions between persona proposals
2. Check for gaps — which System Model sections were NOT referenced by any persona?
3. Check for depth — did any persona give a shallow assessment where the model has deep detail?
4. Does NOT propose new findings initially — synthesizes, resolves conflicts, enforces rigor

**Format for invariant-aware reasoning (all personas):**
```
Proposal: Add style-conditioned multiplier to fold equity calculation
INV-07 check: Style labels are outputs, not inputs ← VIOLATION
NEV-05 check: Style adjustments stacked on defining stats ← VIOLATION
Decision: REJECT — use villain model hierarchy (layer 1-4) instead
```

### 4.4 Post-Run Updates

After a roundtable completes, the Facilitator:

1. **Collects model update proposals** from each persona's output
2. **Validates** each proposal against update rules (§3.2)
3. **Resolves** conflicts between personas per §3.4
4. **Applies** non-conflicting updates
5. **Bumps version** and updates timestamp

**What each persona CAN modify:**

| Persona | Can Add | Can Modify | Cannot Touch |
|---------|---------|-----------|-------------|
| **SYSTEMS ARCHITECT** | Components, dependency rules, decision log | Architecture §1, data flows §2, state model §3 | Security §8 (propose only) |
| **SENIOR ENGINEER** | Tech debt items, hidden coupling entries | Tech debt §10, hidden coupling §6, observability §9 | Architecture §1 (propose only) |
| **FAILURE ENGINEER** | Failure surfaces, anti-invariants (NEV-*) | Failure surfaces §5, hidden coupling §6 | Architecture §1, scaling §7 |
| **PERFORMANCE ENGINEER** | Bottlenecks, scaling assumptions | Scaling §7, failure surfaces §5 | Invariants §4 (propose only) |
| **SECURITY ENGINEER** | Trust zones, exposure risks, input validation | Security §8 | Architecture §1, decision log §11 |
| **PRODUCT / UX THINKER** | Failure surfaces (UX-driven), observability gaps | Failure surfaces §5, observability §9 | Architecture §1, invariants §4 |
| **FACILITATOR** | Decision log entries (conflict resolutions) | Any section (synthesis/corrections only) | Must not add new findings — only refine existing proposals |

### 4.5 Roundtable Prompt Template

```markdown
## System Context (auto-injected to all 7 personas)

You are operating on a codebase governed by a System Model.
The following invariants are HARD CONSTRAINTS on your reasoning:

{invariants.mustBeTrue | format as numbered list}

The following are FORBIDDEN patterns:

{invariants.mustNeverHappen | format as numbered list}

Known fragile areas (extra care required):

{failureSurfaces | where impact in ['critical', 'high'] | format as table}

Hidden coupling relevant to this task:

{hiddenCoupling | where from or to matches changed files | format as table}

Your proposal MUST include:
1. Which invariants you verified (by ID)
2. Which failure surfaces you assessed
3. Any new coupling introduced
4. Any model updates you recommend
```

### 4.6 Facilitator Protocol

The Facilitator runs LAST after all 6 expert personas have produced their analysis. The Facilitator:

1. **Reads all 6 persona outputs** before producing anything
2. **Identifies contradictions** — where two personas disagree, name both positions and resolve with evidence
3. **Identifies gaps** — which System Model sections were NOT referenced by any persona? Flag as potential blind spots
4. **Enforces depth** — if a persona gave a surface-level assessment on a section where the model has deep detail, call it out and demand specifics
5. **Synthesizes** — produce a unified priority-ranked list of findings, tagging each with the originating persona
6. **Proposes model updates** — based on what the roundtable revealed, recommend specific additions/changes to SYSTEM_MODEL.md
7. **Does NOT introduce new technical findings** — the Facilitator's job is synthesis and quality enforcement, not original analysis. If the Facilitator notices something no persona caught, they flag it as "gap requiring follow-up" rather than analyzing it themselves

---

## PART 5: Quality Standard

### 5.1 What a Good System Model Looks Like

| Dimension | Good | Shallow | Over-engineered |
|-----------|------|---------|----------------|
| **Invariants** | Specific, testable, with named enforcer | "The system should be consistent" | 50+ invariants covering trivial guarantees |
| **Failure surfaces** | Named file + scenario + likelihood + impact | "Things might break" | FMEA-level analysis of every function |
| **Hidden coupling** | Breaking scenario described | "A depends on B" | Listing every import as "coupling" |
| **Decision log** | Rationale + alternatives rejected | "We chose X" | Meeting minutes for every standup |
| **Data flows** | Steps map to real code paths | Generic "user → system → database" | Sequence diagrams for button clicks |
| **Scaling** | Concrete numbers at current + 10x + 100x | "Should scale well" | Load test results for hypothetical traffic |

### 5.2 Depth Requirements

**Minimum viable model** (for any codebase):
- [ ] ≥5 components with clear boundaries
- [ ] ≥3 critical data flows with steps
- [ ] ≥5 invariants with enforcers
- [ ] ≥3 anti-invariants with risk descriptions
- [ ] ≥3 failure surfaces with likelihood/impact
- [ ] ≥3 hidden coupling entries with breaking scenarios
- [ ] ≥1 scaling dimension with bottleneck identified
- [ ] ≥1 security boundary defined
- [ ] ≥1 observability gap identified

**Mature model** (after 3+ iterations):
- Components cover entire codebase (no orphan directories)
- Every critical path has a named failure surface
- Invariants have `testCoverage: "full"` or explicit `"none"` with justification
- Hidden coupling entries have been verified by actual breakage or near-miss
- Decision log captures all non-obvious architectural choices
- Tech debt items have severity AND resolution path

### 5.3 Signs the Model Is Too Shallow

- Invariants use words like "should," "generally," "usually" instead of "must," "always," "never"
- Failure surfaces don't name specific files or functions
- Hidden coupling section is empty (every system has hidden coupling)
- No anti-invariants (NEV-*) — means you haven't thought about what must NOT happen
- Decision log has no "alternatives considered" — means decisions weren't actually analyzed
- Scaling section says "should handle" without numbers

### 5.4 Anti-Patterns to Avoid

| Anti-Pattern | Why It's Bad | What to Do Instead |
|-------------|-------------|-------------------|
| **Mirror of code structure** | Duplicates what `tree` and imports already show | Focus on WHY boundaries exist, not WHERE files are |
| **Aspirational invariants** | "We plan to enforce X" isn't an invariant — it's a wish | Only list invariants that are currently enforced |
| **Stale decision log** | Decisions from 6 months ago with no recent entries | Add entries at decision time, not retroactively |
| **Generic security section** | "We validate input" without specifying where/how | Name the validation function, the boundary, the attack vector |
| **Empty observability section** | "We have good test coverage" | Test coverage ≠ observability. What can't you see at runtime? |
| **Coupling without scenarios** | "gameConstants affects many files" | Describe the specific change that would break things |
| **Model as documentation** | Writing prose about how things work | This is a REASONING TOOL, not a wiki. Every entry should change how you think about a proposed change |

### 5.5 Validation Checklist (Run Monthly)

```
For each INV-*:
  □ Grep codebase for violations
  □ Verify enforcedBy file/test still exists
  □ Verify testCoverage claim is accurate

For each NEV-*:
  □ Verify detectionMethod is still active
  □ Check recent commits for near-violations

For each failure surface:
  □ Verify file still exists at named path
  □ Check if likelihood/impact have changed

For each hidden coupling:
  □ Verify both sides still exist
  □ Check if coupling has been resolved

For each scaling assumption:
  □ Check current numbers against "current" column
  □ Flag if 10x threshold is approaching

Cross-reference:
  □ SYSTEM_MODEL state model matches STATE_SCHEMA
  □ SYSTEM_MODEL persistence matches PERSISTENCE_OVERVIEW
```

---

## Appendix: Quick-Start for New Codebases

To bootstrap a System Model for a new project:

1. **Read the codebase for 30 minutes.** Don't write anything yet.
2. **Start with invariants.** What MUST be true? What would break everything if violated? These are the highest-value entries.
3. **Add failure surfaces.** Where have bugs actually occurred? Where do you feel nervous making changes?
4. **Document hidden coupling.** What surprised you? What required reading 3 files to understand?
5. **Add the architecture section last.** Components and data flows are the easiest to derive from code — they're the least valuable to write first.
6. **Skip sections that aren't relevant yet.** An empty security section is better than a fictional one.
7. **Iterate.** The first version will be wrong. Update it when reality contradicts it.
