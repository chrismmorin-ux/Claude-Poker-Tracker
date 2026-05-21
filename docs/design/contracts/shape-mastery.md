# Contract — Shape Language Mastery State (cross-surface)

**ID:** `shape-mastery`
**Status:** DOCUMENTED 2026-05-11 (SPR-073 Shape Language Gate 4); planned runtime enforcement at Stream D implementation (per `docs/projects/poker-shape-language.project.md` Stream D — IDB v17→v18 migration + reducer + context + transparency screen).
**Scope:** the shape, ownership, and invariants of the `shapeMastery` user-skill state that the Shape Language adaptive layer reads from and writes to across multiple surfaces. Documents the read-API contract (what consumers can rely on), the write-API contract (which mutations are valid from which surfaces), and the separation-of-signals invariants inherited from the broader `skillAssessment/` module proposal.
**Last reviewed:** 2026-05-11
**Surfaced:** [WS-039 / SLS-G4](../../../.claude/workstream/queue/WS-039.yaml) — Shape Language Gate 4 design spec; ratified by SPR-073.

---

## Why this contract matters

The Shape Language adaptive layer's mastery state is consumed by **at least four surfaces** with different intent-mode behavior:

- **[shape-language-study-home.md](../surfaces/shape-language-study-home.md)** — reads posteriors + `userMuteState` to render the Deliberate-mode schedule and Discover-mode seeder rec.
- *Planned (SPR-074):* **shape-skill-map.md** — full transparency screen; reads posteriors + `lastValidatedAt` + declared vs data signals (Q4) for the per-descriptor mastery grid.
- *Planned (SPR-074):* **lesson-runner.md** — reads/writes drill outcomes; the only surface that mutates posteriors via observed-behavior signal.
- *Planned (future):* **shape-language-enrollment** journey — writes Q7 self-declaration seeds via a different signal path than drill outcomes.

If the contract is implicit, four surfaces independently invent rules for: when does decay apply? Can a surface read the fused signal or only the separated ones? Does a recommendation surface get to see drill data when the user has declared a descriptor already-known? These questions were answered at SLS Gate 3 ([gate3-decision-memo.md](../../projects/poker-shape-language/gate3-decision-memo.md)) — this contract binds the answers into a single read-API + write-API specification.

The contract sits alongside `persisted-hand-schema.md`, `tournament-to-table.md`, and `sidebar-to-online-view.md` as the fourth cross-surface contract in the design framework. It is the first user-skill contract (the prior three are engine-state contracts); future user-skill contracts (Range Lab mastery, Presession Drill assumption-mastery) should follow this pattern.

---

## Canonical shape — `shapeMastery` state

The Shape Language reducer (`shapeMasteryReducer`, planned at Stream D) owns this slice. The IDB store `shapeMastery` (additive at v17→v18) persists it. The shape is:

```
ShapeMasteryState = {
  enrolled: boolean,           // master toggle (Q2 verdict)
  enrolledAt: number | null,   // ms since epoch when enrolled (null if not)
  schemaVersion: number,       // I-AE-5 convention; bumps on shape change

  descriptors: {
    [descriptorId: string]: DescriptorMastery
  }
}

DescriptorMastery = {
  // Behavioral posterior (drill data only — observed, not declared)
  posterior: {
    alpha: number,             // >= 1; success-count + 1
    beta: number,              // >= 1; failure-count + 1
  },

  // Declarative signal (user-asserted; separate from posterior — Q4 verdict)
  declaredLevel: 'unknown' | 'known' | null,
                              // null = user has not declared either way
                              // 'known' = user marked "I already know this" (Q7 seed or skip-time disambiguation)
                              // 'unknown' = user expressed "not today" (skip-time disambiguation)

  // Mute state (Q2 verdict — per-descriptor opt-out)
  userMuteState: 'none' | 'already-known' | 'not-interested',
  mutedAt: number | null,

  // Temporal anchors (Q3 verdict — decay computed on read)
  lastValidatedAt: number | null,    // ms since epoch of last drill (graded session)
  lastInteractedAt: number | null,   // ms since epoch of last touch (any mode, including Reference)

  // Q4 transparency anchor — declared vs data both visible, never fused
  // (no field for "fused score" — refusing the composite is the invariant)
}
```

**Authoritative source:** the reducer + store implementations once Stream D ships. Until then, this doc is canonical for design. Update both in same commit when shape changes.

---

## Writers

| Writer | Surface / journey | What it writes | Trigger |
|---|---|---|---|
| `ENROLL_SHAPE_MASTERY` | enrollment journey Step 1 | `enrolled = true; enrolledAt = now()` | User taps "Enable" master toggle |
| `DISENROLL_SHAPE_MASTERY` | Settings → Shape Language → disable | `enrolled = false; enrolledAt = null` | User explicitly disenrolls; data preserved per Q6 |
| `SEED_DESCRIPTOR_DECLARATION` | enrollment journey Step 2 | For each declared descriptor: `posterior = {alpha:8, beta:2}; declaredLevel='known'; userMuteState='already-known'` | User taps "Continue" with selections in Q7 seed |
| `RECORD_DRILL_OUTCOME` | [lesson-runner.md](../surfaces/lesson-runner.md) — Deliberate + Discover variants only (Reference variant structurally cannot dispatch per I-SM-3) | `posterior` update via `updateBetaPosterior()`; `lastValidatedAt = now()`; `lastInteractedAt = now()` | User completes a drill in Deliberate/Discover (non-incognito). Partial completion (≥50% spots answered) writes partial; <50% discards. |
| `MUTE_DESCRIPTOR` | [shape-language-study-home.md](../surfaces/shape-language-study-home.md) Discover mute affordance + [lesson-runner.md](../surfaces/lesson-runner.md) Discover variant pre-first-answer + [shape-skill-map.md](../surfaces/shape-skill-map.md) "Mark as already known" | `userMuteState = 'already-known'`; `mutedAt = now()` | User taps a "Mute" or "Mark as already known" affordance |
| `RECORD_SKIP_DISAMBIGUATION` | [shape-language-study-home.md](../surfaces/shape-language-study-home.md) Discover skip + [lesson-runner.md](../surfaces/lesson-runner.md) Discover variant `[Not this one]` popover | If "already know": `userMuteState='already-known'; declaredLevel='known'`. If "not today": `userMuteState='not-interested'` (transient, cleared on next session). | User skips a Discover rec and answers the one-tap question |
| `UNMUTE_DESCRIPTOR` | [shape-skill-map.md](../surfaces/shape-skill-map.md) per-row `[Unmute]` button | `userMuteState = 'none'; mutedAt = null` | User explicitly unmutes |
| `RECALIBRATE_DESCRIPTOR` | [shape-skill-map.md](../surfaces/shape-skill-map.md) per-row `[Recalibrate]` button (confirm-modal gated) | `posterior = {alpha:1, beta:1}; declaredLevel = null; userMuteState = 'none'; lastValidatedAt = null` | User explicitly recalibrates a single descriptor (Q3 + red line #3) |
| `RESET_SHAPE_MASTERY` | [shape-skill-map.md](../surfaces/shape-skill-map.md) footer `[Start fresh]` (confirm-modal gated) | All descriptors reset to charter defaults; `enrolled` preserved | User explicitly resets all data (red line #4) |
| `TOGGLE_SESSION_INCOGNITO` | [shape-skill-map.md](../surfaces/shape-skill-map.md) footer + [shape-language-study-home.md](../surfaces/shape-language-study-home.md) Deliberate header + [lesson-runner.md](../surfaces/lesson-runner.md) Deliberate + Discover variant header | Flips session-scoped `sessionIncognito` boolean | User taps incognito toggle anywhere it's exposed |

**Writers that DO NOT exist (refused by design):**

- ❌ **No decay-write action.** Decay is read-time only (Q3 verdict). There is no `APPLY_DECAY` reducer action; computing decay during render does not call dispatch.
- ❌ **No fused-score writer.** No `UPDATE_MASTERY_SCORE` action. The reducer does not compute or store a single "mastery score" — separation of signals is the invariant (Q4 verdict).
- ❌ **No mode-violating writer.** Reference-mode actions cannot dispatch any of the writers above. Enforced at the reducer entry by reading `currentIntent` from the studyHomeReducer slice and asserting (`if (state.currentIntent === 'reference') return state;`).

---

## Readers

| Reader | Surface / hook | What it consumes |
|---|---|---|
| [shape-language-study-home.md](../surfaces/shape-language-study-home.md) | `useShapeMastery()` hook | All `descriptors[*]` data; `enrolled` flag for gating Deliberate/Discover routes. |
| [shape-skill-map.md](../surfaces/shape-skill-map.md) | `useShapeMastery()` + `useShapeMasteryDecay()` + `useShapeMasterySignalComposition()` | All `descriptors[*]` data + computed decay + signal-composition breakdown; renders the full transparency grid (declared vs data separately, never fused — Q4). Single-scrollable-page IA. Authored at SPR-074. |
| [lesson-runner.md](../surfaces/lesson-runner.md) | `useShapeMastery()` (read) + dispatch (write) | Per-descriptor posterior (read); writes drill outcomes via `RECORD_DRILL_OUTCOME` (Deliberate + Discover variants only — Reference variant structurally cannot write per I-SM-3). Discover variant also dispatches `RECORD_SKIP_DISAMBIGUATION` + `MUTE_DESCRIPTOR`. Authored at SPR-074. |
| Adaptive seeder (Discover mode body) | `useShapeMasteryDecay()` + `useShapeMasterySeederRanking()` | Computed seeder ranking (lowest confidence × longest gap × non-muted × non-declared); writes nothing. |
| Settings → Shape Language sub-panel | `useShapeMastery()` | Full state; renders enrollment status + per-descriptor management affordances. |
| Welcome-back banner (in study-home embed) | `useShapeMastery()` for `enrolledAt` + most recent `lastInteractedAt` | Computes "≥28 days since last interaction" gate; dispatches nothing (read-only signal). |
| Export writer (Q6 — Settings → Export) | Full state via persistence layer | Serializes `shapeMastery` store as part of standard export; "study data only" export is a sub-slice. |

---

## Invariants

The contract's binding invariants. Each one comes from a Gate 3 verdict or a Gate 2 red line; violation is a design-program failure.

### I-SM-1 — Separation of signals (Q4 verdict)

`declaredLevel` and `posterior` are independent state. No fused metric ever exists in storage or in any reader's API surface. A reader that needs both gets both as separate fields (e.g., `{declared: 'known', posterior: {alpha:5, beta:3}}`), never `{masteryScore: 0.65}`.

**Test target (SPR-074 conformance matrix):** grep for forbidden composite field names (`masteryScore`, `fusedMastery`, `confidenceLevel`) across `src/utils/skillAssessment/**` + render assertion that transparency screen renders both signals side-by-side.

**Reused from:** `src/utils/assumptionEngine/CLAUDE.md` I-AE-7 ("DO NOT combine epistemic signals with behavioral signals via arithmetic"). This contract imports the rule from the villain-modeling stack; the user-skill side is the second consumer.

### I-SM-2 — Decay is read-time only (Q3 verdict)

Decay (the recognition-latency adjustment applied to `posterior` over time since `lastValidatedAt`) is computed via `applyTemporalDecay(posterior, lastValidatedAt, now, profile)` at read time. There is no decay writer, no decay-stored field, no "apply decay" scheduled job.

**Test target:** grep for `dispatch({type: 'APPLY_DECAY'})` patterns; assertion that `shapeMasteryReducer` has no decay-mutation case.

### I-SM-3 — Reference mode never writes (Q5 verdict + Pattern 1)

When `studyHomeReducer.currentIntent === 'reference'`, all `shapeMasteryReducer` writer actions return state unchanged (no-op). Enforced at reducer entry by reading the intent and short-circuiting.

**Test target:** for each of the 8 writer actions, assert a no-op result when `currentIntent === 'reference'`.

### I-SM-4 — User-declared signal overrides data-derived signal for recommendations (Q4 verdict)

The Discover-mode seeder ranking uses `declaredLevel` as a master gate: if `declaredLevel === 'known'`, the descriptor is excluded from the seeder pool regardless of `posterior`. Data remains visible in transparency screen, but recommendations honor the declaration.

**Test target:** assert seeder rank function never returns a descriptor with `declaredLevel === 'known'` (or `userMuteState === 'already-known'`).

### I-SM-5 — Recalibrate is single-click, reversible, and never silently re-mutes (red line #3)

`RECALIBRATE_DESCRIPTOR` resets `posterior`, `declaredLevel`, `userMuteState`, and `lastValidatedAt` atomically. No subsequent process re-applies a mute or declared-known. The user's recalibrate intent is durable until the next user action.

**Test target:** assert the recalibrated descriptor stays at `{alpha:1, beta:1, declaredLevel: null, userMuteState: 'none'}` across 100 simulated render cycles (no implicit re-mute).

### I-SM-6 — Data preserved across enrollment toggle (Q6 + red line #4)

`DISENROLL_SHAPE_MASTERY` flips only `enrolled = false` + `enrolledAt = null`. All `descriptors[*]` data is preserved. Re-enrolling (Variation A in enrollment journey) defaults to "keep previous data" with explicit "Start fresh" as opt-in.

**Test target:** assert disenroll → re-enroll round-trip preserves `descriptors[*]` shape.

### I-SM-7 — Posterior bounds are enforced (Bayesian sanity)

`alpha >= 1 && beta >= 1` at all times. Updates from `RECORD_DRILL_OUTCOME` add observation counts; `RECALIBRATE_DESCRIPTOR` resets to 1/1; `SEED_DESCRIPTOR_DECLARATION` sets to 8/2. No path produces α<1 or β<1.

**Test target:** assert post-update posterior bounds across 1000 random observation sequences.

### I-SM-8 — `schemaVersion` is per-record (I-AE-5)

Each `DescriptorMastery` record carries `schemaVersion` for forward migration. The store reader runs per-record validation + migration; absent or mismatched schemaVersion is a recoverable migration path, not a hard error.

**Test target:** assert migration path from v17 → v18 → (future) reads cleanly.

### I-SM-9 — Engagement-pressure / streak fields are not in the shape (red line #5)

`ShapeMasteryState` and `DescriptorMastery` do NOT contain `currentStreak`, `longestStreak`, `daysActive`, `consecutiveCorrectCount`, or any field whose only purpose is engagement-pressure framing. Per-descriptor `lastInteractedAt` exists for welcome-back gating but is **never rendered as a streak counter** — only as a one-time banner.

**Test target:** grep for forbidden field names in the type definition + UI render assertion.

---

## Read-API contract (hooks)

Consumers read state through React hooks, not by importing the reducer directly. The hooks live in the planned `src/utils/skillAssessment/shapeLanguage/` (per gate3-decision-memo §architectural-proposal). At design-time, the contract is:

```
useShapeMastery() : ShapeMasteryState
  // Direct slice access. Re-renders on any mutation.

useShapeMastery(descriptorId: string) : DescriptorMastery | null
  // Per-descriptor access. Re-renders only on mutations to that descriptor.

useShapeMasteryDecay(descriptorId: string, now?: number) : {
  decayedAlpha: number,
  decayedBeta: number,
  daysSinceValidated: number | null,
}
  // Computes decay-adjusted posterior at read time. `now` defaults to Date.now();
  // overrideable for testing.

useShapeMasterySeederRanking() : DescriptorId[]
  // Returns ordered list of descriptors for Discover-mode seeder.
  // Excludes muted + declared-known. Ranks by:
  //   1. credibleIntervalLowerBound(decayedPosterior) ascending (lowest confidence first)
  //   2. daysSinceValidated descending (longest gap first)
  //   3. catalog order ascending (tie-breaker per roundtable.md)

useIsShapeMasteryEnrolled() : boolean
  // Convenience for gating routes / surfaces.
```

**No imperative API** beyond these hooks for reads. Mutations flow through `dispatch()` only.

---

## Code enforcement (planned)

- **Reducer:** `src/reducers/shapeMasteryReducer.js` (planned at Stream D) — owns the writer actions.
- **Store:** `src/utils/persistence/shapeMasteryStorage.js` (planned) — IDB store `shapeMastery` at v18.
- **Hooks:** `src/utils/skillAssessment/shapeLanguage/hooks.js` (planned) — read-API.
- **Pure math:** `src/utils/skillAssessment/core/` (planned per gate3-decision-memo §architectural-proposal Phase A) — `updateBetaPosterior`, `applyTemporalDecay`, `betaCredibleInterval`, `assertIndependentSignals`.
- **Tests:** `src/reducers/__tests__/shapeMasteryReducer.test.js` + `src/utils/skillAssessment/**/__tests__/`.
- **Conformance matrix:** SPR-074 ships the per-surface red-line conformance test catalog; each invariant above gets at least one test target.

Until Stream D ships, this contract is the design canonical. Any new surface registering with study-home that wants to mutate `shapeMastery` must align with the writer list above; PRs that introduce new writers must update this doc in the same commit.

---

## Known drift

- **Read-side runtime landed 2026-05-14 (SPR-081 / WS-040).** Reducer + context + IDB v26 stores + pure-math sub-module + read-only transparency surface (ShapeSkillMapPanel) all ship. I-SM-1 / I-SM-2 / I-SM-6 / I-SM-7 / I-SM-8 / I-SM-9 are ENFORCED via reducer + panel tests. I-SM-3 / I-SM-4 / I-SM-5 stay DOCUMENTED pending fast-follow WS.
- **Write-side deferred to fast-follow WS.** 8 of the 11 writers (`SEED_DESCRIPTOR_DECLARATION`, `RECORD_DRILL_OUTCOME`, `MUTE_DESCRIPTOR`, `RECORD_SKIP_DISAMBIGUATION`, `UNMUTE_DESCRIPTOR`, `RECALIBRATE_DESCRIPTOR`, `RESET_SHAPE_MASTERY`, `TOGGLE_SESSION_INCOGNITO`) are reducer no-op stubs with `// TODO(WS-NEXT)` markers. Action constants are stable so the fast-follow only adds case bodies + the matching surface affordances.
- **Recovery affordances render as disabled buttons.** `[Recalibrate]` / `[Mark as already known]` / `[Unmute]` show "Coming soon" tooltips on the ShapeSkillMapPanel — layout is preserved so the fast-follow swap-in is a label + onClick change, not a re-layout.
- **Settings deep-link not yet wired.** ShapeSkillMapPanel is mounted but unlinked from any nav entry point. Developer access via Playwright at the route during verification.
- **Shared skillAssessment module: `shapeLanguage/` subdir landed.** `src/utils/skillAssessment/shapeLanguage/` houses pure-math (`betaPosterior.js`, `temporalDecay.js`) + the consumer hook (`useShapeMasteryDecay`). The proposed `skillAssessment/core/` shared layer per gate3 memo Phase A is NOT yet built — SLS uses its own pure-math files. Cross-cutting villain-skill consumer parity (Phase B) tracked separately.
- **Seeder ranking deferred.** `useShapeMasterySeederRanking` not implemented this sprint — depends on `declaredLevel` + `userMuteState` writers landing first (I-SM-4 enforcement requires them).

---

## Change protocol

To change this contract safely:

1. **Adding a field to `DescriptorMastery`:** update the canonical shape above; bump `schemaVersion`; add migration path in `shapeMasteryStorage.js`; audit every reader to decide whether the new field affects them.
2. **Adding a writer action:** add to the Writers table; document trigger surface + invariants the writer must respect (especially I-SM-1, I-SM-2, I-SM-3); add a test target for the new mutation.
3. **Removing or renaming a field:** bump `schemaVersion`; audit every reader; provide a migration path; update this doc + change log entry.
4. **Loosening or tightening an invariant:** opens a design-program ticket. I-SM-1 through I-SM-9 are load-bearing; changing any of them probably means a Gate 2 blind-spot roundtable for the consequences (e.g., introducing a fused score would re-litigate Q4 across SLS + villain modeling + future user-skill consumers).
5. **Adding a new reader:** if the reader only consumes existing fields via existing hooks, no change to this doc. If the reader needs a new hook, add to the Read-API contract section. If the reader needs to mutate, follow rule #2.

---

## Relationship to neighboring contracts

- **[persisted-hand-schema.md](./persisted-hand-schema.md)** — different domain (per-hand record); same retention-as-user-data principle (Q6 verdict here mirrors `hands` store treatment in export).
- **[tournament-to-table.md](./tournament-to-table.md)** — different domain (tournament read surface); same "writers + readers + invariants" pattern.
- **[sidebar-to-online-view.md](./sidebar-to-online-view.md)** — different domain (cross-process bridge); same "deliberate no-handoffs" pattern (the explicit declared-vs-data separation here is the analog of pinnedVillain↔selectedSeat no-handoff there).
- **`src/utils/assumptionEngine/CLAUDE.md`** — the precedent for the I-SM-1 separation rule (I-AE-7) and the I-SM-2 read-time decay (assumption staleness). The user-skill side imports these patterns; the proposed shared `skillAssessment/` module is the place where the imports become explicit.
- **`docs/projects/poker-shape-language/gate3-decision-memo.md`** — Q1-Q7 verdicts that bind this contract.

---

## Change log

- 2026-05-11 — Created at SPR-073 (Shape Language Gate 4, WS-039). 4th cross-surface contract; first user-skill contract (the prior three are engine-state contracts). Implements Gate 3 Q1-Q7 verdicts as a binding read/write API. Runtime enforcement deferred to Stream D code phase + SPR-074 conformance matrix.
- 2026-05-11 — Amended at SPR-074 (Shape Language Gate 4 close-out, WS-180). Writers + Readers tables updated to reference newly-authored sibling surfaces ([shape-skill-map.md](../surfaces/shape-skill-map.md) + [lesson-runner.md](../surfaces/lesson-runner.md)). New writer `TOGGLE_SESSION_INCOGNITO` added (was implicit in session-scoped state; now explicit since 3 surfaces dispatch it). `MUTE_DESCRIPTOR` triggering surfaces expanded from study-home-only to all 3 (study-home Discover + lesson-runner Discover + skill-map "Mark as already known"). Runtime enforcement still deferred to Stream D code phase; conformance test catalog now exists at [`docs/design/audits/2026-05-11-sls-g4-redline-conformance.md`](../audits/2026-05-11-sls-g4-redline-conformance.md).
- 2026-05-14 — **Read-side runtime landed at SPR-081 / WS-040 (Stream D)**. IDB v26 migration (`shapeMastery` + `shapeLessons` stores per Decision 2-B per-user completion history), `shapeMasteryReducer` with 3 active writers (HYDRATED / ENROLL / DISENROLL) + 8 deferred no-op stubs, `ShapeMasteryContext` mounted as sibling of `AnchorLibraryProvider`, `src/utils/skillAssessment/shapeLanguage/` pure-math sub-module (Beta + temporal decay + `useShapeMasteryDecay` hook), and read-only `ShapeSkillMapPanel` surface with I-SM-1 separated DOM regions + disabled recovery affordances + I-SM-9 forbidden-field grep. Per owner-ratified scope B (foundation + read-only transparency); recovery writers + I-SM-4/5/6 enforcement deferred to fast-follow WS. I-SM-1 / I-SM-2 / I-SM-6 / I-SM-7 / I-SM-8 / I-SM-9 status flipped to ENFORCED in `system/invariants.md`.
