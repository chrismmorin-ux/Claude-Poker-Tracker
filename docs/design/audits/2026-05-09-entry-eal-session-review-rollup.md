# Gate 1 Entry — 2026-05-09 — EAL Session-Review Anchor Rollup

**Feature working name:** EAL Stream D — Session-Review Anchor Rollup (`WS-171`, sprint `SPR-061`)
**Proposed by:** Workstream-driven (`WS-015` decomposition, third and final child)
**Gate:** 1 (Entry) — mandatory
**Next gate:** none (Gate 4 spec authored 2026-04-24; this sprint adds variant fragment)
**Status:** GREEN — implementation of authored design; placement variant ratified by founder

---

## Feature summary (as proposed)

Session-review anchor rollup — when the founder opens SessionsView, each past-session row gets an expand affordance. Tapping it reveals a per-session anchor activity bundle:

- **Matcher-fired anchors** — system-origin observations (origin: 'matcher-system') captured during the session
- **Owner-captured observations** — owner-origin observations (origin: 'owner-captured') captured during the session
- **Auto-retired anchors** — anchors transitioned by the Tier-3 evaluator (SPR-060) during this session's window

AP-08 signal-separation enforced at selector + component level. Tier-1 candidate-promotion placeholder OMITTED per founder Q1c (Phase 2 scope per CLAUDE.md core principle 3).

---

## Prior-art note (no scope-shifting discovery)

Before authoring this Gate 1, I confirmed:

1. **Surface spec authored 2026-04-24.** `docs/design/surfaces/session-review-anchor-rollup.md` (312 lines) covers anatomy + JTBD + personas + cross-surface deps + AP-08 enforcement.
2. **Substrate is shipped + clean.**
   - `selectAllAnchors` + `selectObservationsByHand` available via `useAnchorLibrary()`.
   - `getHandsBySessionId(sessionId)` at `src/utils/persistence/handsStorage.js:234` provides hand→session linkage.
   - `useAnchorAutoRetire` (SPR-060) stamps `operator.lastOverrideAt` ISO timestamps; auto-retire transitions are filterable by session window via `sessionState.startTime/endTime`.
   - `AnchorObservationList` is pure presentational — reusable at session level.
   - `SessionsView` past-sessions `.map()` at line 469 renders `<SessionCard>` flatly — wrappable.
3. **Spec line 46-55 explicitly flags placement variant.** "New route (`SCREEN.SESSION_REVIEW`) vs SessionsView extension" is a documented decision point in the spec; founder picked the latter at sprint approval.
4. **Gate 2 already ran on this surface class.** 2026-04-24 EAL Blind-Spot Roundtable + rerun bound AP-06 / AP-07 / AP-08 constraints. No re-run needed.

These facts establish the constraint envelope. This Gate 1 codifies the variant placement; it does not introduce a new persona, JTBD, or design pattern.

---

## Output 1 — Scope classification

**Primary classification:** **Implementation of authored design (variant placement).** Existing spec, existing personas, existing JTBD, existing AP refusal set. The shipped placement (SessionsView row-expand) is the spec's documented Q1a alternative to a new SessionReviewView route.

**Secondary classification considerations:**

- **Net-new affordance class on an existing study surface.** Per-row expand panel with 3 inline sections (matcher / owner / auto-retire). Not previously used on SessionsView.
- **Reuses existing surface chrome.** `<SessionCard>` is unchanged; the wrapper composes it with an expand affordance + collapsed rollup panel.
- **Lazy-mount on expand.** Rollup component does not render until row is expanded. Default-collapsed; per-row state (no localStorage).
- **No live-surface impact.** SessionsView is study-mode-only.
- **No new IDB store / migration.** Rollup is read-only over existing stores.

**NOT a new routed view.** No `SCREEN.*` constant added. (`SCREEN.SESSION_REVIEW` remains a future-option per spec variant note.)
**NOT a new persona.** Reuses `post-session-chris` (primary in journey) + `scholar-drills-only` + `chris-live-player` (when post-session).

---

## Output 2 — Personas identified

### In scope

| Persona | Role | Core/Situational |
|---|---|---|
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Primary; reviews session activity post-game | Situational — primary |
| [Scholar Drills Only](../personas/core/scholar-drills-only.md) | Primary for study-block session decisions | Core |
| [Chris (live player)](../personas/core/chris-live-player.md) | Inherits post-session-chris when reviewing post-session | Core |

### Out of scope (explicitly excluded by spec)

| Persona | Why excluded |
|---|---|
| Mid-Hand Chris | No mid-hand session review; rollup is study-mode only |
| Between-Hands Chris | Rollup is post-session, not between-hands |
| Presession-Preparer | Pre-session entry hides session activity per spec; presession nav-context cannot expand rollup |

All personas listed above are pre-existing.

---

## Output 3 — JTBD identified

| JTBD | Source | Coverage |
|---|---|---|
| **`JTBD-DS-58`** Validate-confidence-matches-experience | `docs/design/jtbd/discover-and-study.md` | Primary — rollup surfaces session-scoped evidence |
| **`JTBD-SR-23`** Worst-EV spots from session | `docs/design/jtbd/session-review.md` | Secondary — links to per-hand replay via observation list |
| **`JTBD-DS-59`** Retire-advice-that-stopped-working | `docs/design/jtbd/discover-and-study.md` | Tertiary — auto-retire summary surfaces session-scoped retirement decisions |

No new JTBD authored or amended.

---

## Output 4 — Gap analysis

| Question | Result | Notes |
|---|---|---|
| Does this introduce a new surface class? | **No** | Row-expand variant on existing SessionsView; spec Q1a explicitly flags this alternative. |
| Does this introduce new copy patterns requiring AP-06 audit? | **No** | Auto-retire summary copy reuses `FORBIDDEN_PATTERNS` from `retirementCopy.js`. Other sections are pure data render (counts + reused AnchorObservationList). |
| Does this introduce a new IDB store / migration / schema field? | **No** | Read-only over existing `exploitAnchors` + `anchorObservations` + `hands` stores. |
| Does this introduce new red-line risk? | **No** | Study-mode-only (red line #8 N/A); auto-retire surfacing is durable record (red line #3 preserved); AP-05 reconsider-nudge avoidance — rollup shows what happened, not what to reconsider. |
| Does this require Gate 2 Blind-Spot Roundtable? | **No** | 2026-04-24 EAL Roundtable + rerun bound the constraint envelope (Stage A/C/E coverage). |
| Does this require a new Gate 4 surface artifact? | **No** | Existing spec serves; this sprint appends a §SessionsView row-expand variant fragment documenting the shipped placement. |

**Verdict: 🟢 GREEN.** Implementation of authored design with substrate-clean upstream. Proceed.

---

## Gate 2 disposition

**ALREADY COVERED.** The 2026-04-24 EAL Blind-Spot Roundtable + rerun documented the full constraint envelope. Critical findings already encoded:

- **Stage E** (graded-work-trap) → AP-06 + retirementCopy reuse + this sprint's auto-retire summary forbidden-pattern check.
- **Stage A** (live-surface-clarity) → study-mode-only rollup; SessionsView is post-session.
- **Stage C** (decision-hesitation) → expand is opt-in (default-collapsed); presession-preparer cannot expand; AP-05 reconsider avoidance via record-only framing.

No re-run needed.

---

## Gate 4 disposition

**Existing artifact:** `docs/design/surfaces/session-review-anchor-rollup.md` (312 lines, 2026-04-24).

**This sprint adds:** §SessionsView row-expand variant fragment to the surface artifact:
- Documents shipped placement (SessionsView wrapper vs new SessionReviewView route)
- Notes the SessionReviewView route remains a future-option (reversibility per spec line 46-55)
- Captures the 3-section anatomy (matcher / owner / auto-retire) + Tier-1 omission

The fragment is housekeeping — it links the variant to the canonical surface artifact for traceability.

---

## Acceptance criteria (carried into implementation)

1. `selectAnchorActivityForSession` returns AP-08-separated arrays (matcherFired / ownerCaptured never summed at selector layer).
2. Auto-retire filter correctly bounds transitions to session start/end window.
3. SessionRowWithRollup wraps `<SessionCard>`; ActiveSessionCard untouched (live session has no closed activity to roll up).
4. Rollup default-collapsed; expand affordance has ≥44×44 tap target.
5. AP-06 forbidden patterns absent from auto-retire summary copy at every count value.
6. AP-08 signal separation DOM-asserted at component level (no combined-count element).
7. Tier-1 candidate-promotion placeholder NOT rendered.
8. Zero new regressions vs SPR-060 baseline.

---

## Linked artifacts

- `docs/design/surfaces/session-review-anchor-rollup.md` — primary spec (variant fragment added this sprint)
- `docs/design/journeys/anchor-retirement.md` Variation D — auto-retire summary cross-references
- `docs/design/audits/2026-04-24-blindspot-exploit-anchor-library.md` + rerun — Gate 2 coverage
- `docs/projects/exploit-anchor-library/anti-patterns.md` AP-05 / AP-06 / AP-08 — refused patterns
- `src/utils/anchorLibrary/retirementEvaluator.js` — auto-retire substrate (SPR-060 wired)
- `src/utils/persistence/handsStorage.js:234` — getHandsBySessionId (hand→session linkage)
- `src/components/views/HandReplayView/AnchorObservationList.jsx` — reusable presentational

---

## Change log

- 2026-05-09 — v1.0 authored as Gate 1 Entry artifact for SPR-061 / WS-171. GREEN verdict. Variant placement (SessionsView row-expand vs SessionReviewView route) ratified by founder Q1a. Gate 2 disposition: ALREADY COVERED. Gate 4 disposition: existing spec + variant fragment.
