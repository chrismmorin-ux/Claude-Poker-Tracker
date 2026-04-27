# Surface — Hand-Replay Observation Capture (Tier 0)

**ID:** `hand-replay-observation-capture`
**Parent surface:** `hand-replay-view` — this is Section G of `ReviewPanel.jsx` plus a modal overlay routed via the shared toast/modal layer.
**Product line:** Main app. No extension-side (sidebar) equivalent — capture is a post-decision reflective affordance, not a live-surface control.
**Tier placement:** Plus+ (inherits `hand-replay-view` tier). Flag-gated via `ENABLE_ANCHOR_CAPTURE` for the Phase 5 ship.
**Last reviewed:** 2026-04-24 (Gate 4, Session 3)

**Code paths (future — Phase 5 of exploit-anchor-library project):**
- `src/components/views/HandReplayView/ReviewPanel.jsx` (existing — gains Section G slot below `VillainAnalysisSection`)
- `src/components/views/HandReplayView/AnchorObservationButton.jsx` (new — Section G entry affordance)
- `src/components/views/HandReplayView/AnchorObservationModal.jsx` (new — capture form)
- `src/components/views/HandReplayView/AnchorObservationList.jsx` (new — inline list of existing observations for this hand, below the button)
- `src/hooks/useAnchorObservationCapture.js` (new — orchestrator: modal state, draft autosave, game-state-change auto-dismiss, save → W-AO-1 writer call)
- `src/hooks/useAnchorObservationDraft.js` (new — draft-sidecar state; 400ms debounced writes to `anchorObservationDrafts` store — a sub-store of `anchorObservations` with keypath `draft:<handId>`)
- `src/utils/anchorLibrary/captureObservation.js` (new — W-AO-1 writer per `WRITERS.md` §`anchorObservations`)
- `src/utils/anchorLibrary/observationTags.js` (new — fixed-enum + free-text normalizer; kebab-case lowercase at write)
- `src/constants/anchorLibraryConstants.js` (new — `OBSERVATION_TAG_ENUM` constant, 8 seed values per schema-delta §3.1.1)

**Related docs:**
- `docs/projects/exploit-anchor-library/schema-delta.md` §3.1 (`AnchorObservation` record shape) + §3.1.1 (tag vocabulary)
- `docs/projects/exploit-anchor-library/WRITERS.md` §`anchorObservations` → W-AO-1 (writer contract)
- `docs/projects/exploit-anchor-library/anti-patterns.md` §AP-09 (capture framing) + §AP-06 (graded-work trap carry-across)
- `docs/projects/exploit-anchor-library/gate3-owner-interview.md` §Q2 (opt-out incognito default) + §Q3 (long-press transparency — NOT applied here; capture-modal Incognito is primary-visible by design)
- `docs/design/personas/core/chris-live-player.md` §Observation-capture attribute (write-side + read-side rules + persona-action budgets + framing rule)
- `docs/design/personas/core/chris-live-player.md` §Autonomy constraint red line #9 (incognito observation mode non-negotiable)
- `docs/design/surfaces/hand-replay-view.md` (parent surface; this spec extends it)
- `docs/design/jtbd/domains/drills-and-study.md` §DS-57 (capture-the-insight — primary JTBD)

---

## Purpose

A one-tap capture affordance inside `ReviewPanel.jsx` that lets the owner flag a pattern noticed during hand review — villain tell, recurring spot, deviation worth remembering — in ≤10s without navigating away. Captured observations persist as Tier 0 `AnchorObservation` records and, when the owner is enrolled, feed the anchor-library calibration loop as an owner-captured signal (kept separate from system-matcher-generated observations per AP-08).

This surface is the **highest-priority single surface of the Exploit Anchor Library project** because DS-57 is the highest-priority single JTBD — capture has standalone value independent of whether any observation ever promotes to a Tier 1 candidate anchor (closes the notebook-app / memory-loss failure mode regardless of Phase 2 tier-1 implementation).

Fulfills the **insight-preservation bridge** — the moment between noticing a pattern in review and losing it to the next thing that competes for attention.

Non-goals (explicit):
- **Not a self-evaluation surface.** Framing is note-taking. AP-09 refuses "How did this hand go?" / "Rate this play" copy explicitly.
- **Not a live-surface control.** `mid-hand-chris` is excluded — capture affordance never renders on `TableView` live surfaces (separation per autonomy red line #8).
- **Not a promotion surface.** Owner captures; clustering + promotion to Tier 1 candidate is Phase 2 scope (W-AO-3 / W-AC-2 writers are registered but Phase 2 only).
- **Not a tag-authoring surface.** Owner picks from 8 fixed-enum tags + optional free-text. Full tag-vocabulary management is out of Phase 1 scope.
- **Not a rich-text surface.** 280-char plain-text note (I-EAL-8). No formatting, no media attachment.

---

## JTBD served

Primary:
- **`JTBD-DS-57`** — **Capture-the-insight** (flag a pattern without losing focus). Section G button + modal form is the entire surface path for this JTBD.

Secondary:
- **`JTBD-SR-26`** — Flag disagreement + add reasoning (Proposed). Capture covers the "add reasoning" half when observation targets a hero decision the owner disagrees with after review. Distinct from SR-26's full scope (SR-26 would also surface disagreements in a queue — out of this surface's scope).
- **`JTBD-SR-23`** — Highlight worst-EV spots. Capture can optionally pin to a specific `actionIndex` within the hand (Section G modal's "Anchor to action" field) — low-EV steps are the natural capture targets, though the surface is not ranked around EV.

Not served (explicit non-goals):
- **`JTBD-MH-*`** — mid-hand decision jobs. Live-surface only. Capture is post-hand.
- **`JTBD-DS-58`** — validate-confidence-matches-experience. That's the Calibration Dashboard (separate surface S2).
- **`JTBD-DS-59`** — retire-advice-that-stopped-working. That's the retirement journey (separate spec J).

---

## Personas served

**Primary:**
- **`post-session-chris`** — generous cognitive budget. Review is the primary context. Capture can accept the full two-step flow (tag selection + free-text note).
- **`chris-live-player`** (via the `observation_capture_active: boolean` attribute) — the owner may enter capture mode during review. `observation_capture_active = true` suspends competing app notifications (no toasts, no banner refreshes during an open modal).

**Secondary:**
- **`between-hands-chris`** — strict ≤10s budget. Must complete capture with one tag + no note + Save within 10s OR auto-dismiss on game-state change (next-hand-starts) with draft persisted. Draft resumption on next review session is automatic.
- **`scholar-drills-only`** — captures observations from HandReplayView during off-table study; generous budget; same modal.

**Explicitly excluded:**
- **`mid-hand-chris`** — no capture affordance on TableView live surfaces (red line #8 + AP-07). Capture lives in review / between-hands / post-session contexts only.
- **`newcomer-first-hand`** — disqualifying persona (inherited from Shape Language). Capture affordance hidden until the newcomer-hand-threshold is crossed (threshold TBD per EAL-G4-NC; probably 20–50 hands seen).
- **`seat-swap-chris`** — capture UI banned from seat-context-menu-adjacent surfaces (`[EVID-2026-04-21-CLEAR-PLAYER]`). Capture is inside HandReplayView, so this constraint is honored by placement; no additional work needed.

---

## Anatomy

```
┌── ReviewPanel.jsx ──────────────────────────────────────┐
│  Section A — step headline                              │
│  Section B — HeroCoachingCard                           │
│  Section C — VillainAnalysisSection                     │
│  Section D — per-decision EV annotations                │
│  Section E — equity breakdown                           │
│  Section F — cited assumptions (if Pro tier)            │
│  ┌── Section G — Anchor Observations ──────────────────┐│
│  │  [ 🏷  Tag pattern ]                     (44×44 btn)││
│  │                                                     ││
│  │  ── Captured for this hand ──────────── (if any) ──││
│  │  · Nit scare-fold  ·villain-overfold  · 2d ago      ││
│  │  · Unusual sizing  ·unusual-sizing    · today       ││
│  │  ... (flat, chronological, newest first)            ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### Section G entry button — `AnchorObservationButton`

- **Copy:** "🏷 Tag pattern"  (tag-emoji optional per tokens; primary text "Tag pattern").
- **Alternative copy strings evaluated at Gate 3 + rejected (per AP-09):** ✗ "Rate this hand", ✗ "How did this go?", ✗ "Note your play", ✗ "Review this hand." Ship copy is "Tag pattern" or (variant) "Note this hand" or "Flag this moment."
- **Size:** ≥44×44 DOM px (H-ML06 mobile touch target). Scaled-up on wider viewports per `useScale` convention.
- **Placement:** below `VillainAnalysisSection`, above any Pro-tier citation panel. Persistent; never depends on observation count (visible even with zero existing observations for the hand).
- **Disabled state:** when `observation_capture_active` is already true (modal open), the button enters a loading-like state to prevent double-invocation. Does NOT gray out when enrollment is `not-enrolled` — capture works without enrollment; only the Tier 2 calibration contribution is gated (per I-WR-5).

### Modal — `AnchorObservationModal`

Opens as a bottom-sheet on narrow viewports, centered modal on wide. `observation_capture_active` set to `true` on mount; cleared on unmount. 1600×720 landscape target is the binding layout constraint.

```
┌── Tag pattern ───────────────────── (✕ close) ──┐
│                                                  │
│  Choose one or more tags:                        │
│  [ villain-overfold ]  [ villain-overbluff ]    │
│  [ villain-overcall ]  [ hero-overfolded ]       │
│  [ unusual-sizing ]    [ perception-gap ]       │
│  [ style-mismatch ]    [ session-context ]      │
│                                                  │
│  (+ Custom tag: free-text, optional)             │
│  [  _______________________________________  ]   │
│                                                  │
│  Anchor to street (optional):                    │
│  ( ) whole hand  ( ) preflop  ( ) flop           │
│  ( ) turn  ( ) river                             │
│                                                  │
│  Anchor to action (optional, only if street):    │
│  [ dropdown ▾ of actions in that street ]        │
│                                                  │
│  Note (optional, 280 chars max):                 │
│  [                                            ]  │
│  [                                            ]  │
│                                         [0/280]  │
│                                                  │
│  ┌────────────────────────────────────────────┐ │
│  │ [ ] Incognito — this observation won't    │ │
│  │     contribute to calibration              │ │
│  └────────────────────────────────────────────┘ │
│                                                  │
│  [ Cancel ]                            [ Save ]  │
└──────────────────────────────────────────────────┘
```

**Modal field contract:**

- **Tags:** 8-chip grid + custom free-text field. ≥1 tag required to enable Save. Chips are toggle (tap to add/remove). Custom field is normalized to `kebab-case-lowercase` on Save; if identical to an enum after normalization, deduplicated. Max 5 custom tags (soft limit; UI-only).
- **Street (optional):** 5-way radio — `whole hand` (default) or one of the 4 streets. Streets the hand didn't reach are disabled in the radio (e.g., if hand ended preflop, turn/river are disabled).
- **Action (optional, only if street selected):** dropdown of actions in that street for the replay's current step context. If the ReviewPanel was open to a specific step when capture began, that action is preselected.
- **Note (optional):** 280-char plain-text textarea. Live char counter `N/280`. 280-char hard limit enforced at writer (I-EAL-8) — UI soft-limits at 280 with no submit past it.
- **Incognito toggle:** primary-visible checkbox. Default **off** when `observation_enrollment_state === 'enrolled'` (per Q2-A opt-out). Default **on** (and disabled — can't turn off) when `not-enrolled` (capture still works, but can never contribute when no global enrollment exists — explanatory text visible below the checkbox). Toggle is ALWAYS visible regardless of enrollment state (red line #9 non-negotiable).
- **Save button:** disabled until ≥1 tag is selected. On tap, calls `captureAnchorObservation` (W-AO-1 writer) with payload, closes modal, fires 5s toast "Pattern tagged — [first tag name]" with a link to Anchor Library (if enrolled and observation contributes) or "Pattern tagged — not contributing to calibration" (if incognito). Toast has **Undo** action for the 5s window; after that, observation is durable (delete requires Anchor Library surface action, not handled on this surface).
- **Cancel button:** dismisses modal. If draft is non-empty (tags selected OR note typed OR street/action chosen), shows a 2-option confirm sheet: "Discard draft" or "Keep draft for later" (second option persists the draft to `anchorObservationDrafts` and closes modal). Matches the existing SessionForm dirty-state backdrop guard pattern (SV-F6).

### Inline list — `AnchorObservationList`

- **Filter:** observations where `handId === currentHandId`, ordered by `createdAt DESC`.
- **Row density:** one line per observation — `· <first tag> · <tag pill> · <relative time>`. Full note visible on row tap (expand-in-place, not modal). Tap on tag pill filters by that tag (opens Anchor Library filtered — Phase 5 deep-link).
- **Empty state:** no list rendered. Button alone.
- **Count soft limit:** if >10 observations exist on a hand, list shows 10 + "See all (N)" link (rare at MVP but possible post-Phase-8).

---

## State

- **UI (`useUI`):** `currentScreen === SCREEN.HAND_REPLAY` is the hosting screen; `replayHand` / `replayHandId` identify the hand.
- **Anchor library (`useAnchorLibrary`, new context per Phase 5):**
  - `observation_capture_active: boolean` — mirrors persona attribute; `true` while modal is open.
  - `observation_enrollment_state: 'enrolled' | 'not-enrolled'` — from global settings.
- **Draft state (`useAnchorObservationDraft`, new hook):** per-hand draft persisted to `anchorObservationDrafts` store with keypath `draft:<handId>`. 400ms debounce on writes during editing. Draft is cleared on Save success. Draft auto-persists on modal close-via-keep-draft and on game-state change (see Auto-dismiss below).
- **Existing observations (`useAnchorObservations`, new hook):** selector `selectObservationsByHand(handId)` against `anchorObservations` store.

### Mutations

- **Save** → W-AO-1 writer (`captureAnchorObservation`) — single IDB transaction that writes observation record + deletes corresponding draft.
- **Keep draft for later** → `anchorObservationDrafts` put — single-write.
- **Discard draft** → `anchorObservationDrafts` delete + modal close — no observation created.

### Environment assumptions

- Hosting surface is `HandReplayView`. If `replayHand` is null/undefined, Section G renders nothing (defensive — should never happen while HAND_REPLAY screen is active but protects against race at screen-transition).
- `handId` must exist in `hands` store (Section G is only rendered after `loadHandById` resolves successfully).
- `useAnchorLibrary` context must be mounted at app root (Phase 5 task — `AnchorLibraryProvider` added alongside existing provider stack).

---

## Props / context contract

### `AnchorObservationButton` props
- `handId: string` — from parent ReviewPanel.
- `currentStreetKey?: 'preflop' | 'flop' | 'turn' | 'river'` — pre-fill hint for the modal's street radio, from the ReviewPanel's current step.
- `currentActionIndex?: number` — pre-fill hint for action dropdown.

### `AnchorObservationModal` props
- `handId: string`
- `initialStreetKey?: string`
- `initialActionIndex?: number`
- `onClose: () => void`
- `onSave: (observation: AnchorObservation) => void`

### Context consumed
- `useAnchorLibrary()` — for enrollment state + `observation_capture_active` setter.
- `useUI()` — for toast dispatch (success feedback).
- `useHandReview()` — for `currentStepKey` and `currentActionIndex` pre-fill values.

---

## Key interactions

1. **Open capture.** User taps "🏷 Tag pattern" → `observation_capture_active = true` → modal opens → draft loaded if exists (resume banner shown: "Resume tagged draft from [2 min ago]?") → focus on first tag chip.
2. **Pick tag(s).** User taps enum chips; Save enables after ≥1. Optional: custom free-text; optional: street/action pickers; optional: note; optional: Incognito toggle.
3. **Auto-save draft.** Any field edit triggers 400ms debounce → draft write to `anchorObservationDrafts`. User sees no explicit "draft saved" UI (drafts are silent) but the persist is real.
4. **Save pattern.** Tap Save → W-AO-1 write → modal closes → 5s toast "Pattern tagged — [first tag]" with Undo action + deep-link. Toast Undo reverses the W-AO-1 write within its 5s window (deferred-delete pattern; observation is not persisted permanently until the Undo window expires).
5. **Cancel with dirty draft.** Tap Cancel → 2-option sheet → "Discard" deletes draft + closes; "Keep for later" persists draft + closes.
6. **Auto-dismiss on game-state change.** If user is in `between-hands-chris` context and next hand deals while modal is open: modal auto-closes (no confirm sheet — the state change is forced by the game), draft auto-persists. User returns to the hand's capture next time they open HandReplayView for that hand and see the draft-resume banner.
7. **Phone-sleep survival.** Phone goes to sleep with modal open: `observation_capture_active` persists via draft mechanism; on resume, modal reopens in prior state (if less than 30 min elapsed) or draft-resume banner shows (if more).
8. **List interaction.** Existing observation row tap → expand to show full note + metadata (who tagged / when / incognito status / anchor-to-street-action if set). Row has no delete affordance at this surface — delete requires Anchor Library surface (keeps this surface's complexity scoped to capture).

### Keyboard / accessibility
- Modal is focus-trapped; Escape closes (triggers dirty-draft sheet if dirty).
- Tag chips are standard buttons, reachable by Tab.
- Save button is announced with enabled/disabled state via `aria-disabled`.
- Note textarea char-count has `aria-live="polite"` when crossing 260 chars (approaching limit).
- Incognito checkbox has an accessible label: "Incognito — this observation will not contribute to calibration. Your note is always private regardless."

---

## Anti-patterns refused at this surface

Cross-reference to `anti-patterns.md`:

- **AP-09 — "How did this hand go?" capture framing.** Ship copy is "Tag pattern" / "Note this hand" / "Flag this moment." Forbidden copy enumerated in the anti-patterns file. Any future PR that renames the button must pass persona-level review.
- **AP-06 — "Your observations accuracy" graded-work trap.** This surface never displays calibration deltas, accuracy scores, or comparison to predicted rates. Capture is one-directional: owner → observation record. Display of observed-vs-predicted lives on the Calibration Dashboard (S2), never here.
- **AP-07 — Cross-surface calibration state leakage.** No live-surface echo. No anchor-badge rendering on this surface. The Inline list shows owner-captured observations only (origin=`owner-captured`); system-matcher-generated observations do NOT appear here (they appear in the Calibration Dashboard as a separate series per AP-08 signal-separation).
- **AP-08 — Auto-fused signals.** The inline list explicitly filters by `origin === 'owner-captured'`. System observations live on the Calibration Dashboard with visual distinction.

---

## Red-line compliance checklist (Gate 5 test targets)

Every red line has a testable assertion on this surface. These map to EAL-G5-RL (in-app test assertions for 9 red lines) in backlog:

- **#1 Opt-in enrollment** — capture works when `not-enrolled` but the observation's `contributesToCalibration` is forced `false` + UI shows explanatory text; no silent enrollment.
- **#2 Full transparency on demand** — Incognito toggle's accessible label explains exactly what it does; no hidden state.
- **#3 Durable overrides** — N/A directly on this surface (retirement lives on S2/Journey); but observation records themselves are immutable post-capture per autonomy contract (owner must delete + re-capture to revise contribution state).
- **#4 Three-way reversibility** — Incognito per-observation guarantee (this red line's third leg) satisfied by the modal toggle.
- **#5 No streaks / engagement-pressure** — no capture-count / streak UI ever. List shows chronological observations without ranking or gamification.
- **#6 Flat access** — N/A (library-level concern; capture surface is write-side).
- **#7 Editor's-note tone** — copy ladder: "Tag pattern" ✓; "Rate play" ✗ (enforced by AP-09 refusal list + visual review). Save confirmation toast: "Pattern tagged — X" (not "Good observation!" or "Great catch!").
- **#8 No cross-surface contamination** — capture surface renders no live-surface elements; no anchor badge; no calibration state.
- **#9 Incognito observation mode non-negotiable** — Incognito toggle is primary-visible on every render of the modal, regardless of enrollment state. Gate 5 test asserts the DOM element exists and is reachable.

---

## Known behavior notes

- **Draft-resume banner ambiguity.** If owner has a draft on Hand A and opens Hand B, the Hand A draft is NOT surfaced on Hand B (drafts are per-hand keyed). This prevents cross-hand capture-draft confusion. The banner only shows on return to Hand A.
- **Incognito toggle + enrollment transitions.** If owner enrolls mid-capture (changes global enrollment from `not-enrolled` → `enrolled` while modal is open), the Incognito toggle becomes interactive. If the reverse (enrolled → not-enrolled with an open modal), the toggle forces `on` and disables (matching the initial-render behavior for not-enrolled state).
- **Tag chip state ≠ disabled state.** When `not-enrolled`, tags are fully interactive — capture works. Only the calibration contribution is blocked. This is intentional per DS-57 standalone value.
- **First-time discoverability.** On first render of Section G after v18 migration (no observations ever captured), a one-shot tooltip points at the button: "Noticed a pattern? Tag it here." Dismissable; localStorage-gated to fire once. Never re-shows.
- **280-char boundary behavior.** At 270 chars, counter turns amber. At 280, user can't type more. No auto-truncate; input simply stops accepting.

---

## Known issues

None at creation — new surface. First audit will be the Gate 4 design-review pass prior to Phase 5 implementation kickoff.

Placeholder for future audit findings:
- [HRV-OBS-CAP-TBD-*] — findings to be added as they surface in Gate 4 design-review.

---

## Test coverage

### Unit tests (Phase 5 target — EAL-Stream-D)
- `AnchorObservationButton.test.jsx` — renders; disabled when capture-active; tap opens modal.
- `AnchorObservationModal.test.jsx` — tag selection, save button enable state, cancel dirty-draft flow, Incognito toggle visibility across enrollment states, 280-char boundary.
- `AnchorObservationList.test.jsx` — renders ordered; empty state; row expand.
- `useAnchorObservationCapture.test.js` — orchestrator: open/close, save, game-state-change auto-dismiss.
- `useAnchorObservationDraft.test.js` — 400ms debounce, per-hand keying, resume-banner logic.
- `captureObservation.test.js` — W-AO-1 writer contract: field whitelist, `contributesToCalibration` gate, `origin: 'owner-captured'` always set.

### Integration tests (Phase 5)
- `HandReplayView.anchor-capture.e2e.test.jsx` — full flow: open replay → tap button → select tag → save → toast appears → observation visible in list on re-open.
- Red-line assertion suite (EAL-G5-RL) — 9 assertions per red-line compliance checklist above.

### Visual verification
- Playwright MCP 1600×720 screenshot, 3 scenarios:
  1. Section G empty state (button only, no observations).
  2. Modal open with 2 tags selected + partial note + Incognito checked.
  3. Section G with 5 captured observations (list visible with time-ago formatting).

### Playwright evidence pending
- `EVID-PHASE5-EAL-S3-G-BUTTON` — Section G button placement + size verification.
- `EVID-PHASE5-EAL-S3-MODAL-ENROLLED` — modal with enrollment = enrolled (Incognito toggle default-off).
- `EVID-PHASE5-EAL-S3-MODAL-NOT-ENROLLED` — modal with enrollment = not-enrolled (Incognito forced on + explanatory text).
- `EVID-PHASE5-EAL-S3-DRAFT-RESUME` — draft-resume banner on second open.
- `EVID-PHASE5-EAL-S3-LIST-POPULATED` — inline list with 5+ observations.

---

## Cross-surface dependencies

- **`HandReplayView` (`ReviewPanel.jsx`)** — hosting surface. Adds a non-removable Section G slot; other ReviewPanel sections unaffected.
- **`AnchorLibraryView` (future, S1)** — receives deep-link from capture toast success. Toast action "View in library" opens `AnchorLibraryView` filtered by the first tag of the just-captured observation.
- **Settings (future, EAL-G4-ACP-referenced)** — enrollment toggle lives in Settings. Settings change propagates to this surface via `useAnchorLibrary` context; capture modal reacts to live changes.
- **Toast container (`ToastContext`)** — reuses existing toast infrastructure (per `CLAUDE.md` ToastContext convention). Success toast has a 5s Undo window per existing pattern.

---

## Change log

- 2026-04-24 — v1.0 authored as Gate 4 Session 3 artifact (EAL-G4-S3). Full anatomy + state + interactions + red-line-compliance-checklist + anti-pattern refusal cross-references + Phase 5 code-path plan + test-coverage spec. Zero code changes (surface-spec only).
