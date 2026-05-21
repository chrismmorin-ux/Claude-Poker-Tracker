# Gate 1 Entry — 2026-05-09 — EAL Tier-3 Auto-Retirement Banner

**Feature working name:** EAL Stream D — Tier-3 Auto-Retirement Banner (`WS-170`, sprint `SPR-060`)
**Proposed by:** Workstream-driven (parent `WS-015` decomposed; child `WS-170` ships first)
**Gate:** 1 (Entry) — mandatory
**Next gate:** none (Gate 4 already shipped — see disposition below)
**Status:** GREEN — implementation of authored design; no new surface, no new persona

---

## Feature summary (as proposed)

The retirement evaluator (`src/utils/anchorLibrary/retirementEvaluator.js`) is fully implemented and tested but has **zero callers**. No session-close hook invokes it; no banner exists. This work wires the evaluator into `endCurrentSession()` and ships the `AutoRetireBanner` UI specified at `docs/design/journeys/anchor-retirement.md` Variation D step 3s.

When the retirement condition fires for one or more anchors at session-close, the evaluator transitions them through `active → expiring → retired` per spec. On the next open of `AnchorLibraryView`, a one-time banner surfaces:

> `N anchor(s) auto-retired since you last looked.   [ Review ]   [ Dismiss ]`

Tap **Review** filters the library to retired anchors changed since last banner-dismissal. Tap **Dismiss** persists the dismissal timestamp. Reopen → banner stays cleared.

---

## Prior-art note (no scope-shifting discovery)

Before authoring this Gate 1, I confirmed:

1. **`anchor-retirement` journey is fully specified.** `docs/design/journeys/anchor-retirement.md` Variation D (Tier 3 auto-retirement, system-initiated + user-reviewed) covers steps 1s–5s end-to-end, including banner copy template, review-flow filter spec, AP-06 copy-discipline ladder, and H-N05 mid-session-deferral rule.
2. **Retirement evaluator is shipped + tested.** `evaluateAllAnchors(anchors, context)` returns `{ transitions, skipped, errors }`. Owner-override durability (red line #3) is in-evaluator. Pure module; caller applies writes via existing W-EA-3.
3. **Retirement copy generator is shipped.** `src/utils/anchorLibrary/retirementCopy.js` implements AP-06 forbidden-pattern detector (`FORBIDDEN_PATTERNS` regex array; CI-grep target). The new `autoRetireBannerCopy.js` will reuse the same pattern array — no duplicate AP-06 ladder.
4. **W-EA-3 writer is shipped.** `ANCHOR_OVERRIDDEN` action + reducer used by manual retirement (SPR-021, S21). Same writer accepts the auto-retire payload; only the operator stamp differs (`lastOverrideBy: 'system'`, `overrideReason: 'auto-retire'` vs `'owner'` / `'manual-retire'`).
5. **Banner copy template is fixed by spec.** Journey Variation D step 3s prescribes the template verbatim. Generator deterministic from `count`. No design re-litigation.

These facts establish the constraint envelope. This Gate 1 codifies an implementation of an authored journey; it does not introduce a new surface, journey, persona, or design decision.

---

## Output 1 — Scope classification

**Primary classification:** **Implementation of authored design.** A specified-but-unbuilt portion of the existing `anchor-retirement` journey ships. No new routed view, no new persona, no new copy patterns.

**Secondary classification considerations:**

- **Net-new affordance class on an existing study surface.** A one-time top-of-view banner with two primary actions (Review / Dismiss). Banner pattern not previously used on `AnchorLibraryView`. Slot location: between header and filters per spec.
- **Wires a substrate-clean primitive.** Retirement evaluator is a shipped pure-util with zero callers; the wiring is the load-bearing change.
- **No live-surface impact.** Banner is study-mode only. The session-close hook runs after game-state has flushed; no in-game render path is touched.
- **No mid-session UI.** Per journey doc + CLAUDE.md anti-pattern, Tier 3 evaluator runs at session-close ONLY. Banner appears on the *next* open of the study surface, not when retirement fires.

**NOT a new routed view.** No `SCREEN.*` constant added.
**NOT a new persona.** Reuses `post-session-chris` (primary in journey) + `scholar-drills-only` (secondary).

---

## Output 2 — Personas identified

### In scope (banner reviewers)

| Persona | Role | Core/Situational |
|---|---|---|
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Primary; reviews retirements during reflective post-session study | Situational — primary |
| [Scholar Drills Only](../personas/core/scholar-drills-only.md) | Primary for study-block retirement decisions | Core |
| [Chris (live player)](../personas/core/chris-live-player.md) | Inherits post-session-chris when reviewing post-session | Core |

### Out of scope (explicitly excluded by journey spec)

| Persona | Why excluded |
|---|---|
| Mid-Hand Chris | No retirement actions mid-hand. Banner cannot surface mid-session per H-N05 deferral. |
| Presession-preparer | Retirement decisions pre-session would introduce decision-hesitation (Gate 2 Stage C #5). Pre-session nav-context cannot enter retirement journey. |

All personas listed above are pre-existing — no new persona authored or amended.

---

## Output 3 — JTBD identified

| JTBD | Source | Coverage |
|---|---|---|
| **`JTBD-DS-59`** Retire-advice-that-stopped-working (lifecycle override) | `docs/design/jtbd/discover-and-study.md` | Primary — Tier 3 system-side fulfillment |
| **`JTBD-DS-58`** Validate-confidence-matches-experience | `docs/design/jtbd/discover-and-study.md` | Secondary — banner surfaces the model-divergence finding |

No new JTBD authored or amended. The banner is the system-initiated counterpart to user-initiated retirement actions on the same JTBD chain.

---

## Output 4 — Gap analysis

| Question | Result | Notes |
|---|---|---|
| Does this introduce a new surface class? | **No** | Banner slot on existing `AnchorLibraryView`. |
| Does this introduce new copy patterns requiring AP-06 audit? | **No** | Reuses `FORBIDDEN_PATTERNS` from `retirementCopy.js`. New generator (`autoRetireBannerCopy.js`) emits text bound to the same forbidden-pattern set. |
| Does this introduce a new IDB store / migration / schema field? | **No** | Reuses existing `exploitAnchors` store + W-EA-3 writer. Banner-dismissal timestamp lives in localStorage (transient client preference). |
| Does this introduce new red-line risk? | **No** | Owner-override durability (red line #3) already in-evaluator. Mid-session deferral (H-N05) preserved by hook trigger point. AP-05 reconsider-nudge avoidance: banner displays only when retirements actually happened, dismissable, no proactive prompt. |
| Does this require Gate 2 Blind-Spot Roundtable? | **No** | 2026-04-24 EAL Blind-Spot Roundtable (`audits/2026-04-24-blindspot-exploit-anchor-library.md` + rerun) Stage E (graded-work-trap) + Stage A (live-surface-clarity) + Stage C (decision-hesitation) bound this work. The journey copy ladder is a direct output of Stage E. |
| Does this require a new Gate 4 surface artifact? | **No** | `docs/design/journeys/anchor-retirement.md` Variation D is the spec. This sprint adds a §AutoRetireBanner slot fragment to `docs/design/surfaces/anchor-library.md` documenting the slot location, but the design content lives in the journey. |

**Verdict: 🟢 GREEN.** Implementation of authored design with substrate-clean upstream. Proceed to Gate 4 surface fragment + implementation.

---

## Gate 2 disposition

**ALREADY COVERED.** The 2026-04-24 EAL Blind-Spot Roundtable + rerun documented the full constraint envelope this banner implements. Critical findings already encoded:

- **Stage E** (graded-work-trap) → AP-06 + `retirementCopy.js` `FORBIDDEN_PATTERNS` + this work's `autoRetireBannerCopy.js` reuse-of-same-set.
- **Stage A** (live-surface-clarity) → study-mode-only banner; no live-surface impact.
- **Stage C** (decision-hesitation) → banner is one-time per dismissal; no recurrent nag; presession-preparer explicitly excluded.

No re-run needed.

---

## Gate 4 disposition

**Existing artifact:** `docs/design/journeys/anchor-retirement.md` Variation D (steps 1s–5s) authored 2026-04-24. Step 3s prescribes the banner copy template + slot location + Review handler behavior.

**This sprint adds:** §AutoRetireBanner slot fragment in `docs/design/surfaces/anchor-library.md` documenting:
- Slot location (between header and filter row)
- Conditional rendering (`pendingBannerCount > 0`)
- Review handler (filter to retired-since-dismissal)
- Dismissal handler (localStorage timestamp; banner stays cleared on reopen)

The fragment is housekeeping — it links the journey spec to the surface for traceability. No new design content.

---

## Acceptance criteria (carried into implementation)

1. Tier-3 evaluator wired into `endCurrentSession()` via `useAnchorAutoRetire` orchestrator.
2. No mid-session firing — orchestrator triggers on `sessionState.currentSession.endTime` transition (null → set), not on every render.
3. Banner renders on next `AnchorLibraryView` open after at least one auto-transition occurred.
4. Review action filters list to `status: 'retired'` AND `lastStatusChangeAt > lastBannerDismissedAt`.
5. Dismiss action persists `lastBannerDismissedAt` to localStorage; banner stays cleared on reopen.
6. AP-06 forbidden patterns absent from banner copy at every count value (1, 2, N+); CI-asserted at component level + via `validateRetirementCopy()` in copy generator tests.
7. Owner-override durability preserved — manual retire/un-retire on an anchor mid-session blocks subsequent auto-retire on that anchor (already in evaluator).
8. Zero regressions in 10338-test baseline.

---

## Linked artifacts

- `docs/design/journeys/anchor-retirement.md` — primary spec (Variation D)
- `docs/design/surfaces/anchor-library.md` — host surface (this sprint adds §AutoRetireBanner fragment)
- `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` + rerun — Gate 2 coverage
- `docs/projects/exploit-anchor-library/anti-patterns.md` AP-05 / AP-06 / AP-07 — copy + surface refusals
- `src/utils/anchorLibrary/retirementEvaluator.js` — pure substrate
- `src/utils/anchorLibrary/retirementCopy.js` — AP-06 forbidden-pattern source
- `src/hooks/useAnchorRetirement.js` — sibling pattern (manual W-EA-3 caller)

---

## Change log

- 2026-05-09 — v1.0 authored as Gate 1 Entry artifact for SPR-060 / WS-170. GREEN verdict. Gate 2 disposition: ALREADY COVERED. Gate 4 disposition: existing journey artifact + housekeeping fragment to surface artifact.
