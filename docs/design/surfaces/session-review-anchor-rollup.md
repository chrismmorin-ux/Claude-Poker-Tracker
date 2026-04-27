# Surface — Session Review (Anchor Rollup)

**ID:** `session-review-anchor-rollup`
**Parent surface:** top-level routed view (`SCREEN.SESSION_REVIEW`, new route added in Phase 5).
**Product line:** Main app.
**Tier placement:** Plus+ (inherits the calibration-framework's tier gating). Flag-gated via `ENABLE_SESSION_REVIEW`.
**Last reviewed:** 2026-04-24 (Gate 4, Session 5)

**Code paths (future — Phase 5 of exploit-anchor-library project):**
- `src/components/views/SessionReviewView/SessionReviewView.jsx` (new — route root)
- `src/components/views/SessionReviewView/AnchorRollupSection.jsx` (new — anchors fired this session)
- `src/components/views/SessionReviewView/SessionSummaryHeader.jsx` (new — session metadata: date / duration / hands / result)
- `src/components/views/SessionReviewView/ReviewEmptyState.jsx` (new — no anchors fired this session)
- `src/hooks/useSessionReview.js` (new — loads session + filters observations/firings scoped to the session)
- `src/utils/anchorLibrary/sessionRollupSelectors.js` (new — `selectAnchorsFiredInSession(sessionId, anchors, observations)`, split by origin per AP-08)

**Related docs:**
- `docs/projects/exploit-anchor-library/schema-delta.md` §3.1 (`AnchorObservation.handId` + scoping to session via hand→session link)
- `docs/projects/exploit-anchor-library/anti-patterns.md` §AP-04 (no scalar score), §AP-06 (graded-work trap), §AP-08 (no auto-fused signals)
- `docs/design/personas/core/chris-live-player.md` §Autonomy constraint red lines
- `docs/design/surfaces/sessions-view.md` (parent — SessionReview is reachable from SessionsView SessionCard via deep-link)
- `docs/design/surfaces/calibration-dashboard.md` (cross-link target — tap an anchor to deep-dive in dashboard)
- `docs/design/surfaces/anchor-library.md` (secondary cross-link target)

---

## Purpose

Post-session summary of anchor activity scoped to one session. Answers the question: **"which anchors fired this session, what did the model predict, and what did my actual observations look like — for this session only?"** Cross-links to `calibration-dashboard` for deep-dive and `anchor-library` for cross-session context.

This surface is the **per-session vertical slice** of the cumulative Calibration Dashboard. The dashboard shows all-time data; the review shows just this session. Different cognitive goals: dashboard is "is the model well-calibrated?"; review is "what happened tonight?"

**Entry points:**
1. **Auto-open post-cashout** — after `CashOutModal` commits a session, the owner is routed here (skippable via "Skip" button — respecting `post-session-chris` autonomy).
2. **SessionCard deep-link** — in SessionsView's past-sessions list, each SessionCard gains a "View session review" button (Phase 5 SessionsView amendment).

Non-goals (explicit):
- **Not a cumulative calibration surface.** All-time data + primitive validity + cross-session trends live on `calibration-dashboard`.
- **Not a grading surface.** Never evaluates the owner's play quality or observation accuracy. Session review is observational, like a game log.
- **Not a scalar scoreboard.** No "session grade" or "calibration score for tonight" (AP-04).
- **Not a retirement surface.** Override actions are NOT available here. If owner decides an anchor should retire based on session data, they navigate to Calibration Dashboard or Anchor Library to act.
- **Not an intermediate mid-session surface.** `mid-hand-chris` excluded entirely. This is strictly post-cashout / post-session.

---

## Decision — new route vs SessionsView extension

**Decision: new route (`SCREEN.SESSION_REVIEW`).** Rationale:

1. **SessionsView density.** SessionsView at 419 LOC already handles 8 JTBDs (SM-17 through SM-22 + DE-72 + DE-75). Adding an anchor-rollup tab would push the surface past its current-health threshold; recent DCOMP-W4 audits already flagged density concerns on analogous surfaces.
2. **Cognitive separation.** SessionsView is "session lifecycle + bankroll control." Session Review is "what did I learn from that session." Different cognitive goals; different personas (session lifecycle is between-hands + post-session; review is strictly post-session).
3. **Auto-open-post-cashout requires a distinct route.** Reusing SessionsView as the post-cashout destination would require routing to a tab-within-view, which is more complex than routing to a sibling view. Post-cashout is a state transition; distinct route matches distinct state.
4. **Dashboard-sprawl concern from S2 applies inversely.** We refused the "two calibration dashboards" (per-project) split because cognitive unity favored one view. Here, cognitive separation favors two views (lifecycle vs review). The two patterns aren't contradictory: merge when cognitive intent is unified; separate when it's distinct.

**Flag for owner override:** if owner prefers session review as a SessionsView tab (e.g., to keep all session context in one destination), the spec is reversible — extract `SessionReviewView.jsx` logic into a SessionsView tab panel; main component becomes the tab renderer. All spec below describes the view regardless of route/tab hosting.

---

## JTBD served

Primary:
- **`JTBD-DS-58`** — Validate-confidence-matches-experience (observed-vs-predicted transparency). Session-scoped vertical slice of the JTBD.
- **(implicit)** Post-session review as trust-building — "the model honestly tracked itself tonight; here's what it said, here's what happened." Inherits from `exploit-deviation/calibration.md` §8.2 design intent.

Secondary:
- **`JTBD-SR-23`** — Highlight worst-EV spots. Session review includes a per-anchor EV summary; owner can tap into hand-replay for any flagged hand.
- **`JTBD-DS-59`** — Retire-advice-that-stopped-working (indirect). Session data may motivate retirement decisions; owner routes to Calibration Dashboard or Anchor Library to act. Not actionable from this surface.

Not served (explicit non-goals):
- **`JTBD-DS-47`** — Skill map / mastery grid. That's `anchor-library`.
- **`JTBD-DS-57`** — Capture-the-insight. That's `hand-replay-observation-capture`.

---

## Personas served

**Primary:**
- **`post-session-chris`** — canonical persona. Session-just-ended; generous budget; reflective mode. Auto-open-post-cashout is the canonical entry.

**Secondary:**
- **`scholar-drills-only`** — may revisit past sessions via SessionCard deep-link during study block.

**Explicitly excluded:**
- **`mid-hand-chris`** — never rendered mid-hand.
- **`between-hands-chris`** — NOT a target. Session review is post-session, not between-hands. Auto-open skip-path respects this distinction.
- **`presession-preparer`** — Session review of PRIOR sessions is pre-session-safe (no drift-in-current-session concern applies — last session's anchors that fired are historical fact). However, the surface **hides Tier 3 auto-retirement banners** when `referrer === PRESESSION` to match `calibration-dashboard` presession-exclusion pattern.

---

## Anatomy

```
┌── SessionReviewView ────────────────────────────────────────┐
│  [← Back]  Session Review                        (Esc key)  │
├─────────────────────────────────────────────────────────────┤
│  SessionSummaryHeader                                       │
│   2026-04-24 Cash, $1/2 · 3h 45m · 87 hands · +$215        │
├─────────────────────────────────────────────────────────────┤
│  AnchorRollupSection                                        │
│  "3 anchors fired this session. 14 total firings."           │
│                                                             │
│  ┌── Anchor row ───────────────────────────────────────── ┐ │
│  │  Nit Over-Fold to River Overbet (4-Flush)             │ │
│  │  ● active  · river · overfold                          │ │
│  │  Fired 6× this session                                 │ │
│  │  Session observed: 83% (5 of 6)                        │ │
│  │  Session predicted: 68%  · all-time predicted: 65%    │ │
│  │  Evidence: 5 matcher + 1 owner-captured                │ │
│  │  [ Open in Dashboard → ]  [ See hands (6) ]            │ │
│  └─────────────────────────────────────────────────────── ┘ │
│  ┌── Anchor row ───────────────────────────────────────── ┐ │
│  │  LAG Over-Bluff on River Probe after Turn XX          │ │
│  │  ● active  · river · overbluff · drill-only            │ │
│  │  Fired 5× this session                                 │ │
│  │  Session observed: 40% (2 of 5)                        │ │
│  │  Session predicted: 65%  · all-time predicted: 65%    │ │
│  │  Evidence: 4 matcher + 1 owner-captured                │ │
│  │  Δ note: Session observation diverged from prediction  │ │
│  │  by -25 pt. Evaluate in Calibration Dashboard.         │ │
│  │  [ Open in Dashboard → ]  [ See hands (5) ]            │ │
│  └─────────────────────────────────────────────────────── ┘ │
│  ┌── Anchor row ───────────────────────────────────────── ┐ │
│  │  Fish Over-Call on Turn Double Barrel (dry paired)    │ │
│  │  ● active  · turn · overcall · drill-only              │ │
│  │  Fired 3× this session                                 │ │
│  │  Session observed: 67% (2 of 3)                        │ │
│  │  Session predicted: 70%                                │ │
│  │  Evidence: 3 matcher                                   │ │
│  │  [ Open in Dashboard → ]  [ See hands (3) ]            │ │
│  └─────────────────────────────────────────────────────── ┘ │
│                                                             │
│  Owner-captured observations this session: 7               │
│   · "Big sizing tell on 2♠ river" — Hand 47                │
│   · "Snap-call without thought" — Hand 63                  │
│   · ... (5 more)                                            │
│   [ View all observations → ]                              │
├─────────────────────────────────────────────────────────────┤
│  [ Open Calibration Dashboard ]  [ Open Anchor Library ]   │
│  [ Done ]                                                   │
└─────────────────────────────────────────────────────────────┘
```

### Session summary header — `SessionSummaryHeader`

- **Date + Stakes + Game type.** `2026-04-24 Cash, $1/2` / `2026-04-24 Tournament $220 MTT`.
- **Duration** (if known).
- **Hands played** (count).
- **Result** — monetary P/L for cash; finish for tournament. Uses existing `sessionsStorage` computed fields.
- **No "session grade" / "session quality score."** AP-04 refused.

### Anchor rollup section — `AnchorRollupSection`

**Summary count** — `"N anchors fired this session. M total firings."` No emoji/celebration/gamification. Factual line.

**Per anchor row** (ordered by firing-count descending; alphabetical tiebreaker):

- Archetype name.
- Status dot + chip (matching `anchor-library` convention).
- Street + polarity chips.
- **Fired N× this session** — count scoped to this session.
- **Session observed: X% (N of M)** — observed rate scoped to this session's firings.
- **Session predicted: Y%  ·  all-time predicted: Z%** — session-scoped predicted rate vs all-time (they MAY differ if model conditions varied mid-session).
- **Evidence breakdown: N matcher + M owner-captured** — **AP-08 signal-separation enforced** even in compact row. Counts shown separately, never summed.
- **Δ note (conditional)** — rendered only when `|session observed − session predicted| > 15pt` with sufficient sample (`n >= 5`). Copy template: `"Δ note: Session observation diverged from prediction by -25 pt. Evaluate in Calibration Dashboard."` Matter-of-fact; never `"your read was off"` / `"prediction failed"`.
- **Deep-link buttons:**
  - `[ Open in Dashboard → ]` — navigate to `calibration-dashboard` with anchor deep-link.
  - `[ See hands (N) ]` — modal-list of hand IDs where this anchor fired this session; tap hand → open `hand-replay-view` for that hand.

### Observations list — secondary section

- **Owner-captured observations this session** — list from `anchorObservations` filtered by session's `handId`s.
- Each line: note text (truncated if long) + hand link.
- Observations **incognito-flagged** appear with a subtle incognito badge (contributed or not to calibration). Red line #9 visibility preserved.
- `[ View all observations → ]` link opens full modal if count > 5.

### Footer actions

- `[ Open Calibration Dashboard ]` — full deep-dive.
- `[ Open Anchor Library ]` — cross-session context.
- `[ Done ]` — close session review; routes to `SessionsView` (or back to post-cashout origin).

### Empty state — `ReviewEmptyState`

- **No anchors fired.** Copy: `"No anchors fired this session. This can happen when the session's villains didn't hit the anchor library's triggers — normal, not a gap."` Factual; no nag.
- **Owner-captured observations still visible** — even if no anchors fired, any Tier 0 captures this session are listed.
- **Both empty.** Copy: `"No anchor activity or captures this session. Tap to start a new session, or open the Anchor Library to browse."` No implied failure state.

---

## State

- **UI (`useUI`):** `currentScreen === SCREEN.SESSION_REVIEW`; `sessionIdForReview` from UI state.
- **Session (`useSession`):** load session by ID; compute summary fields.
- **Anchor library (`useAnchorLibrary`):** anchors scoped to session via observations/firings.
- **Observation-driven scoping (`useSessionReview`):**
  - `firings` = `selectAnchorFiringsInSession(sessionId)` — join `anchorObservations` (origin=matcher-system) with session's `handId`s.
  - `ownerCaptures` = `selectOwnerCapturesInSession(sessionId)` — origin=owner-captured observations scoped to session hands.
  - `rollup` = aggregate firings into per-anchor rows with session-scoped statistics.
- **No persistence writes from this surface.** Read-side only.

### Environment assumptions

- `AnchorLibraryProvider` + `SessionProvider` + `UIProvider` mounted.
- Session exists in `sessions` store (deep-link target must be valid ID).
- Phase 5 may ship before anchor-library has seeded data; empty-state handles gracefully.

---

## Props / context contract

### `SessionReviewView` props
- `scale: number`.

### Context consumed
- `useSessionReview()`, `useAnchorLibrary()`, `useUI()`.

---

## Key interactions

1. **Auto-open post-cashout.** After `CashOutModal` commits → `uiReducer` sets `currentScreen === SESSION_REVIEW` + `sessionIdForReview = justClosedSessionId` + adds a `[ Skip ]` button next to `[ Done ]` in footer (auto-open context only). Skip immediately routes to `SessionsView`.
2. **Deep-link from SessionCard.** User taps `[ View session review ]` on a past SessionCard → same route with that session's ID.
3. **Tap anchor row `[ Open in Dashboard → ]`.** Navigate to `calibration-dashboard` Anchors tab scrolled/expanded to that anchor.
4. **Tap anchor row `[ See hands (N) ]`.** Opens modal listing hand IDs for this anchor's session firings; tap hand → `hand-replay-view` with that `handId`.
5. **Tap observation row.** Opens `hand-replay-view` scrolled to the observation's `actionIndex` (if set).
6. **Footer `[ Done ]`.** Close session review; route to `SessionsView` (or back to post-cashout origin with preserved state).
7. **Footer `[ Open Calibration Dashboard ]` / `[ Open Anchor Library ]`.** Deep-link to those surfaces without anchor-specific scoping.
8. **Back navigation / Escape.** Same as Done.

### Keyboard / accessibility
- Anchor rows are `aria-labelled` regions with clear summary.
- `[ See hands (N) ]` has explicit accessible label including hand count.
- Δ-note is semantically `role="note"` (advisory not alert).
- Footer action buttons are grouped with ARIA.

---

## Anti-patterns refused at this surface

- **AP-02 — Auto-surfacing push.** Post-cashout auto-open is explicit state transition, not a notification. Owner opted into the session; review is a natural continuation.
- **AP-04 — "Calibration score" / "session grade."** No scalar summary. Multi-dimensional per-anchor breakdown or nothing.
- **AP-05 — Retirement reconsidered-nudges.** Δ notes suggest evaluating in Dashboard but NEVER say "reconsider retirement of X." Retirement actions aren't on this surface.
- **AP-06 — "Your observations accuracy."** Δ-note copy is model-accuracy framing. `"Session observation diverged from prediction by -25 pt"` evaluates the prediction, not the observer.
- **AP-08 — Auto-fused signals.** Evidence breakdown shows `N matcher + M owner-captured` separately. Never summed.

---

## Red-line compliance checklist (Gate 5 → EAL-G5-RL)

- **#1 Opt-in enrollment** — if `not-enrolled`, rollup shows a banner `"Calibration off — session firing counts visible, observation-model comparison requires enrollment"`. Factual.
- **#2 Full transparency on demand** — all session data visible by default (this surface is inherently observational; no gated data).
- **#3 Durable overrides** — N/A (no write actions here).
- **#4 Three-way reversibility** — N/A.
- **#5 No streaks / engagement-pressure** — no "sessions in a row" / "firing streak" / "best session ever" copy. Empty state is factual.
- **#6 Flat access** — retired anchors that fired this session ARE shown. Their retirement status doesn't hide them from a session they fired in (history preservation).
- **#7 Editor's-note tone** — Δ-note copy is factual. Empty state avoids praise/pressure.
- **#8 No cross-surface contamination** — no live-surface components; session summary only.
- **#9 Incognito observation mode** — incognito captures shown with incognito badge (not hidden — part of session history regardless of calibration contribution).

---

## Known behavior notes

- **Session-scoped predicted rate vs all-time.** Session-scoped predicted rate is the mean of per-firing predicted rates as they were at firing-time (not recomputed). This preserves the snapshot: "what did the model say at the time each firing happened, averaged across firings this session." All-time predicted rate is a current-model-snapshot reference. Divergence between session-predicted and all-time-predicted indicates Tier 2 model drift.
- **Retired anchors visible in rollup.** If an anchor fired this session and retired before session-close (Tier 3 auto-retirement mid-session is impossible per H-N05 session-close deferral; could only happen via manual retire), the anchor row still renders with retired status. Session firings are historical fact; retirement is forward-looking.
- **Observation-list truncation at 5.** First 5 observations shown inline; rest behind `[ View all observations → ]` modal. Modal has virtualized scroll for high-observation sessions.
- **Auto-open with zero activity.** Even if a session had zero anchor firings + zero captures, auto-open still routes here (empty state). Owner gets a consistent post-cashout flow; skippable via `[ Skip ]` button.
- **Δ-note threshold.** `|session observed − session predicted| > 15pt` AND `n >= 5`. Both conditions required; prevents noisy flag on 1-2 firings.
- **SessionCard deep-link placement.** In SessionsView's past-session cards, `[ View session review ]` is a secondary action (not primary). Primary action on past cards remains "Delete / Edit / Resume as applicable."

---

## Known issues

None at creation.

---

## Test coverage

### Unit tests (Phase 5 target)
- `AnchorRollupSection.test.jsx` — row layout, session-scoped statistics, Δ-note conditional rendering, AP-08 signal-separation assertion.
- `SessionSummaryHeader.test.jsx` — cash/tournament formatting.
- `ReviewEmptyState.test.jsx` — 3 empty-state variants (no anchors + captures, no captures + anchors, both empty).
- `useSessionReview.test.js` — selector correctness; session-scoping filters.
- `sessionRollupSelectors.test.js` — origin-split correctness (AP-08 assertion).

### Integration tests (Phase 5)
- `SessionReviewView.e2e.test.jsx` — auto-open-post-cashout flow; SessionCard deep-link flow; [Done] routes back.
- Red-line assertion suite — 9 assertions.

### Visual verification (Playwright)
- `EVID-PHASE5-EAL-S4-AUTOOPEN-POSTCASHOUT` — auto-open flow with 3 anchors + 7 captures.
- `EVID-PHASE5-EAL-S4-EMPTY` — zero anchors fired.
- `EVID-PHASE5-EAL-S4-DELTA-NOTE` — Δ-note rendered on one row (divergence > 15pt).
- `EVID-PHASE5-EAL-S4-NOT-ENROLLED` — enrollment banner visible.

---

## Cross-surface dependencies

- **`sessions-view`** — parent for deep-link entry (SessionCard `[ View session review ]` action added Phase 5).
- **`CashOutModal`** — post-commit trigger for auto-open flow.
- **`calibration-dashboard`** — deep-link target for per-anchor deep-dive.
- **`anchor-library`** — deep-link target for cross-session context.
- **`hand-replay-view`** — deep-link target from per-hand links in observation list + "See hands" modal.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Session 5 artifact (EAL-G4-S4). Decision: new route `SCREEN.SESSION_REVIEW` (not SessionsView extension) — rationale documented, owner-reversible. Full anatomy + session-scoped rollup + per-anchor row layout + AP-04/06/08 refusals + 9 red-line compliance + Phase 5 code-path plan + 4 Playwright evidence placeholders. Zero code.
