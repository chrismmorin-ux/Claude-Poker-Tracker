# Journey — Anchor Retirement

**ID:** `anchor-retirement`
**Last reviewed:** 2026-04-24 (Gate 4, Session 4 — EAL-G4-J)
**Status:** SPEC (design artifact; Phase 5 of exploit-anchor-library project implements)

---

## Purpose

The retirement journey is the multi-step flow through which an `ExploitAnchor` transitions from `active` to a less-active state (`retired`, `suppressed`, or `active`-with-reset-calibration). Retirement can be:

- **User-initiated** from either `anchor-library` (transparency panel override actions) or `calibration-dashboard` (row-expanded override actions).
- **System-initiated** via Tier 3 auto-retirement (retirement condition fires per `schema-delta.md` §2.6; status transitions `active → expiring → retired` at session-close).

The journey spec enforces **copy-discipline** against the graded-work trap (AP-06). This is the strongest autonomy concern in the project: retirement conversations slide easily into "you should retire this because your observations weren't accurate" (grades observer) rather than "the model's prediction and your observations have diverged enough that the model is likely miscalibrated for this archetype" (evaluates model).

**Principle: retirement is model lifecycle, never user evaluation.**

---

## Primary JTBD

- **`JTBD-DS-59`** — Retire-advice-that-stopped-working (lifecycle override).

## Secondary JTBD along the journey

- **`JTBD-DS-58`** — Validate-confidence-matches-experience. The observed-vs-predicted diagnosis motivates retirement; the journey threads through dashboard's model-accuracy view on the way to the retirement confirm step.
- **`JTBD-MH-13`** — Dismiss or downrank a live-cited assumption (silent override). Different scope from DS-59 — MH-13 is single-decision-in-one-hand; DS-59 is anchor-level persistent. Journey never conflates.

## Personas

- **`post-session-chris`** — primary. Retirement is a post-session reflective action, not mid-session.
- **`scholar-drills-only`** — primary for study-block retirement decisions.
- **`chris-live-player`** (when post-session) — inherits post-session-chris.

Explicitly excluded:
- **`mid-hand-chris`** — no retirement actions mid-hand. Even the silent override (MH-13) is NOT on this journey; it's a distinct flow with its own JTBD.
- **`presession-preparer`** — retirement decisions pre-session would introduce decision-hesitation (Gate 2 Stage C #5). Presession-preparer sees anchor-library filtered without drift, cannot enter retirement journey from presession nav-context.

---

## Entry triggers

**User-initiated (3 entry points):**
1. **From `anchor-library` transparency panel** — tap `[ Retire ]` / `[ Suppress ]` / `[ Reset calibration ]` on an expanded anchor card.
2. **From `calibration-dashboard` anchor row** — tap same actions on an expanded anchor detail.
3. **From automatic retirement confirmation** — Tier 3 auto-retirement fires during session-close; next open of `anchor-library` or `calibration-dashboard` surfaces a one-time confirmation banner: `"N anchor(s) auto-retired this session. [ Review ]"` — tap enters the journey at step 3 (review) not step 2 (confirm), because the retirement already happened.

**System-initiated (1 entry, implicit):**
4. **Session-close hook** — retirement evaluator runs at session-close, transitions any anchor whose `retirementCondition` fires from `active → expiring → retired` without user interaction. The journey doesn't surface UI at this moment; the surfacing happens on next dashboard/library open (entry point 3).

## Exit conditions

- **Success:** anchor status persisted to desired terminal state (`retired`, `suppressed`, or `active`-with-reset).
- **Abort:** user cancels confirm sheet at any step; anchor state unchanged.
- **Partial (undo window):** user saw toast, did not tap Undo in 12s; status is durable. Durability per red line #3.
- **Partial (undo taken):** user tapped Undo within 12s; W-EA-3 reverses the write atomically; anchor returns to prior status.

---

## Steps

### Primary path — Retire (user-initiated)

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `anchor-library` or `calibration-dashboard` | User taps `[ Retire ]` on anchor row/card | modal opens with anchor context; `observation_capture_active` unaffected | ≤1s |
| 2 | retirement confirm sheet (modal overlay) | User sees: **"Retire [archetype-name]?"** + sub-text + confirm/cancel | no persistence until confirm | ≤3s (reading + decision) |
| 3 | retirement confirm sheet | User taps **[ Retire ]** button | W-EA-3 writer fires: `status: 'retired'` + `operator.lastOverrideAt` + `operator.lastOverrideBy: 'owner'` + `operator.overrideReason: 'manual-retire'` | instant |
| 4 | `anchor-library` or `calibration-dashboard` (returned-to) | Anchor row re-renders with `retired` status chip; 12s undo toast appears | status visible on row | ≤1s post-dispatch |
| 5 | (optional) toast | User taps **[ Undo ]** within 12s | W-EA-3 reverse transaction: status back to prior + origin-stamp removed | instant |
| 6 | (after 12s) | Toast auto-dismisses; no further ceremony | retirement is now durable (red line #3) | n/a |

Total target time (happy path): **~6s**. Undo window: additional 12s.

### Variation — Suppress

Step 2 modal copy differs: **"Suppress [archetype-name]?"** + sub-text: *"Suppressed anchors don't fire on live surfaces but remain in the library. You can un-suppress from the Anchor Library flat-list at any time."* Step 3 writes `status: 'suppressed'`. Rest of flow identical. Suppress is the less-destructive variant; used when the owner wants the anchor out of active advice but not erased from library memory.

### Variation — Reset calibration

Step 2 modal copy: **"Reset calibration for [archetype-name]?"** + sub-text: *"Resetting drops accumulated observations and restarts Tier 2 calibration from seed priors. Evidence history is preserved but no longer contributes to the posterior. This action cannot be auto-undone after the 12s toast window."*

**Reset is destructive.** Confirmation is 2-tap per step 2; first tap enables an "I understand" checkbox; second tap on `[ Reset ]` commits. Undo toast still present for 12s. After 12s, reset is durable; un-reset requires re-authoring the anchor (W-EA-1 seeding reapplied — dev-only in Phase 1).

### Variation — Tier 3 auto-retirement (system-initiated, user-reviewed)

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1s | retirement-evaluator (session-close) | System evaluates all active anchors' retirement conditions | `status: 'active' → 'expiring'` at session N (one session before retirement) | no UI |
| 2s | retirement-evaluator (session N+1 close) | System confirms retirement condition still holds | `status: 'expiring' → 'retired'`; origin-stamp: `'auto-retire'` | no UI |
| 3s | `anchor-library` or `calibration-dashboard` (next open) | Banner: **"N anchor(s) auto-retired since you last looked. [ Review ]"** | banner visible; no auto-expand | ≤1s render |
| 4s | review flow | User taps **[ Review ]** → opens `anchor-library` filtered by `status: 'retired'` + `lastStatusChangeAt > sessionCloseAt` | filter applied | ≤1s |
| 5s | per-anchor review | User can: (a) accept retirement (dismiss review badge); (b) un-retire via explicit override (writes `status: 'active'` via W-EA-3, new origin-stamp `'owner-un-retire'`); (c) convert to suppress or reset | durable changes per action | ≤10s per anchor |

### Variation — Un-retirement (owner-initiated reversal)

The system NEVER proactively suggests un-retirement (AP-05). User can un-retire via explicit action on `anchor-library` flat-list:

| # | Surface | Action | State change | Time target |
|---|---------|--------|--------------|-------------|
| 1 | `anchor-library` | User filters to `status: 'retired'` | no persistence | ≤2s |
| 2 | `anchor-library` transparency panel | User taps `[ Re-enable ]` on expanded retired card | confirmation sheet | ≤1s |
| 3 | confirm sheet | User sees: **"Re-enable [archetype-name]?"** + sub-text: *"Re-enabling resumes Tier 2 calibration with preserved evidence history. Origin marked as owner un-retire."* + 2-tap confirm | no persistence until confirm | ≤3s |
| 4 | confirm sheet | User taps **[ Re-enable ]** | W-EA-3 writer fires: `status: 'active'` + `origin: 'owner-un-retire'` | instant |
| 5 | library re-renders | Anchor moves to active filter | undo toast 12s | ≤1s |

**Note:** un-retirement is explicit per red line #3. The system never posts a banner saying "consider re-enabling X." The flat-list is the only path.

---

## Copy discipline rules (enforced at every step)

AP-06 refusal applies to every text node in this journey. Copy generator `src/utils/anchorLibrary/retirementCopy.js` (Phase 5) implements the ladder:

### ✓ Allowed copy patterns

- **Describing the model's state.** `"The model's prediction for this archetype has diverged from observed data."` → evaluates model.
- **Describing the retirement condition.** `"Observed rate credible interval has converged with the GTO baseline — retirement condition met."`
- **Describing consequences.** `"Retired anchors don't fire on live surfaces. Evidence history is preserved."`
- **Action framing.** `"Retire this anchor"` / `"Suppress this anchor"` / `"Reset calibration"`.
- **Reversibility acknowledgment.** `"You can re-enable this anchor from the Anchor Library at any time."`

### ✗ Forbidden copy patterns

- **Grading observer.** `"Your observations didn't match the model's prediction."` ✗ (evaluates the observer)
- **Dunning-Kruger trap.** `"Your confidence in this spot may have been misplaced."` ✗ (evaluates observer's self-assessment)
- **Nagging / engagement pressure.** `"You haven't retired any anchors lately. Want to clean up?"` ✗ (AP-02 auto-surfacing)
- **Scoring.** `"This anchor has a 34% calibration mismatch."` ✗ (AP-04 scalar score) — use `"Observed rate 74%, predicted 68%, difference 6 pt"` instead.
- **Retirement-as-failure.** `"This anchor underperformed."` ✗ (implies a score). Use `"Model was miscalibrated for this archetype."`
- **Retirement-as-defeat.** `"Giving up on this exploit?"` ✗ (emotional framing).
- **Reconsider-nudge.** `"You retired 3 anchors this session. [ Reconsider ]"` ✗ (AP-05 refused).

### Discretion calls (AI-authored copy generator)

When `retirementCopy.js` generates natural-language retirement summaries, it must pass AP-06 linter. Forbidden-strings match + CI check on the copy generator's output. Generator is deterministic from (anchor state, event type); no free-form LLM generation at runtime.

---

## Variations summary

- **A — User-initiated Retire** (primary path). ~6s + 12s undo.
- **B — User-initiated Suppress** (less-destructive variant).
- **C — User-initiated Reset calibration** (destructive; 2-tap confirm).
- **D — Tier 3 auto-retirement + user review** (system-initiated, user-reviewed).
- **E — Un-retirement** (owner-initiated reversal; no system nudging).
- **F — Abort at confirm sheet** (happens at step 2 of any path; no persistence).
- **G — Undo within 12s toast window** (reversal of write; atomic).

---

## Failure / abort paths

- **Abort at step 2 (confirm sheet).** User taps Cancel or Escape → modal dismisses, no persistence, no toast. Zero side effect.
- **Undo within 12s.** User taps Undo on success toast → W-EA-3 reverses the write; UI updates; toast replaced with "Undone" confirmation for 3s.
- **Undo after 12s.** Action is durable (red line #3). User who wants to reverse must use the un-retirement flow (Variation E) — explicit + 2-tap.
- **Offline / IDB error mid-write.** W-EA-3 transaction fails → UI shows error toast ("Couldn't save change. Please try again.") + anchor row unchanged. Matches existing persistence error-surface pattern.
- **Concurrent retire on same anchor (race).** User taps Retire twice in 50ms. Writer idempotence: second write is dropped with a logged warning (see `WRITERS.md` §W-EA-3 failure mode). UI converges on single toast.
- **Tier 3 auto-retirement fires on an anchor the owner just manually un-retired mid-session.** Retirement evaluator respects user overrides (red line #3); `operator.lastOverrideAt` after `expiring` state entry suppresses the auto-transition. System never overrides user.

---

## Observations

- **Undo window 12s.** Same as Design Compliance Wave 1 destructive-action pattern (SDV-F3, SV-F4, PV-F2, etc.). Matches owner familiarity + muscle memory across the app.
- **Suppress vs Retire distinction.** Suppress is "hide from live" (preserves library entry); Retire is "archive" (visible in flat-list with retired chip; does not fire anywhere). Both reversible via un-retirement flow. Distinction matters because `anchor-library` surfaces retired anchors for review; suppressed anchors are also surfaced but the "reason for state" differs cognitively.
- **Reset is categorically more destructive** than retire/suppress because it drops Tier 2 calibration posterior; requires re-accumulation of observations to rebuild confidence. The 2-tap confirm + explicit "I understand" checkbox matches destructive-action pattern severity.
- **No bulk retirement** in Phase 1. If owner wants to retire 5 anchors, they retire 5 times. Bulk-retire adds dangerous-action multiplier for no clear JTBD (DS-59 serves per-anchor decisions). Defer to Phase 8 if owner-use patterns demand it.
- **Cross-surface consistency.** Retirement action on `anchor-library` OR `calibration-dashboard` enters the same journey with same confirm sheet + copy + toast. Single source of truth: `RetirementConfirmModal.jsx` (Phase 5) is used by both entry points. No drift.
- **System-initiated retirement never pops a modal mid-session.** Tier 3 evaluator is session-close only; review banner appears on next open of library/dashboard. Nielsen H-N05 error prevention — no mid-session surprise state transitions.

---

## Linked audits

- `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` (Gate 2) — Stage E graded-work-trap concern is the origin of this journey's copy-discipline rule.
- `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library-rerun.md` (Gate 2 re-run GREEN) — Stage E resolution maps to this journey + `anti-patterns.md`.

Placeholder for future:
- [AR-TBD-*] — findings from Phase 5 implementation review.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Session 4 artifact (EAL-G4-J). Full 5-variation journey spec + copy-discipline rule ladder (AP-06 refusal at runtime via CI-linted copy generator) + cross-surface consistency note + H-N05 session-close deferral. Primary path ≤6s + 12s undo window. Zero code.
