# System-Coherence Audit — 2026-06-19 — Responsive / Layout

**Type:** System-coherence audit (per `LIFECYCLE.md` — a *concept* (here: how a view sizes/scrolls/orients) is rendered inconsistently across surfaces).
**Trigger:** Owner report — "screens don't scale or behave well together — mis-sizings." Surfaced while fixing a Sessions/Settings scroll bug.
**Method:** two parallel passes — architecture (scaling system + scaled landscape views) + product-ux (portrait-native fluid views). Read-only; no code changed except correcting two misleading comments.
**Device reality:** owner uses the **installed PWA** on a phone (Samsung Galaxy A22). Browser-tab users are worse off (see Cross-Cutting #1).

---

## The core problem — two paradigms that don't cohere

The app has **two layout systems**, and the friction is that views are assigned to the wrong one, or implement the right one inconsistently:

1. **Scaled-landscape** (`ScaledContainer`): a fixed **1600×720** box, CSS-`transform: scale()`-d to fit. Correct for *spatial, multi-seat game-flow* surfaces. On a portrait phone it scales to **~0.225** (postage-stamp; ~10px touch targets; ~7px text) — usable **only** if the OS orientation lock forces landscape.
2. **Portrait-native fluid**: reflows at real size, scrolls inside the body lock. Correct for *field-entry / list / form* surfaces. The pattern is **bounded height + `overflow-y-auto`** (`h-[100dvh]`/`h-dvh`).

**The seams (where "mis-sizing" lives):** views that *should* be fluid are still scaled (unusable on a phone), fluid views that forgot a scroll container (content silently clipped), and a body-lock that punishes any view that grows past the viewport.

### The coherent rule (the fix direction)

> **Spatial game-flow** (the poker table, showdown, replay, drills, live online/tournament HUDs) → **scaled-landscape** (the fixed canvas is load-bearing). **Everything else — forms, lists, settings, study/coach reading surfaces, auth** → **portrait-native fluid.**

Most defects below are a view sitting on the wrong side of that line, or a fluid view not implementing the standard scroll container.

---

## Per-view findings (merged)

Paradigm: **S** = scaled-landscape, **F** = fluid-portrait. "Should-be" flags misclassification.

| View | Now | Should be | Key defect | Sev |
|---|---|---|---|---|
| **PlayersView** | S | **F** | Player search/list/forms rendered in a scaled 1600px box → 6-col table ~130px wide, ~10px targets. Never migrated (no `orientation` flag). **Worst offender.** `PlayersView.jsx:456-458` | 4 |
| **LoginView / SignupView / PasswordResetView** | S | **F** | Auth *forms* in ScaledContainer → ~10px fields. First-run phone (browser tab) sees login at 22.5%. `LoginView.jsx:99` etc. | 3 |
| **SelfCoachView** | F (broken) | F | `minHeight:100dvh` + **no scroll container** → content past viewport silently clipped (body `overflow:hidden`). No `orientation` flag → landscape-locked over a portrait layout. `SelfCoachView.jsx:34` | 3 |
| **AnchorLibraryView** | F (broken) | F | Same `minHeight:100dvh`-no-scroll clip. `AnchorLibraryView.jsx:177` | 3 |
| **PrintableRefresherView** | F (broken) | F | Same clip class. `index.jsx:314` | 3 |
| **LessonDetailView** | F | F | Accepts `scale` prop, never uses it; fluid but landscape-locked (no `orientation`). `LessonDetailView.jsx:45` | 2 |
| **SettingsView** | F ✓ | F | Main render correct (`h-[100dvh]`); **loading branch** still `min-h-dvh` (the clip bug) `SettingsView.jsx:62` | 2 |
| **VoiceTimelineSandbox** | F (broken) | F | Root `min-h-dvh overflow-y-auto` → clip bug; also uses `window.alert()`. Prototype surface. `:178` | 2 |
| **PlayerProfileView** | F ✓ | F | Correct scroll; "Edit" (`:143`) + "+Add sighting" (`:168`) below 44px | 2 |
| **PlayerFinderView** | F ✓ | F | Correct scroll; camera overlay button 24px (`:616`) | 2 |
| **SessionsView** | F ✓ | F | Correct (fixed 2026-06-19); header 4-button row can wrap to 3 rows on 360px | 1 |
| **TableView / ShowdownView / HandReplayView** | S ✓ | S | Correct paradigm; each *re-implements* ScaledContainer inline (3 copies). Phone needs landscape lock. | 2 |
| **StatsView / AnalysisView / OnlineView / TournamentView** | S | S* | Correct-ish, but list/stat-heavy → internal `overflow-y-auto` scrolls at 0.225 scale (unusable scrollbar). Reconsider Stats/Analysis as F. | 2 |
| **Preflop/Postflop/Presession Drills** | S ✓ | S | Correct; inner div **double-hardcodes** `width:1600,height:720` (drifts if LAYOUT changes) | 1 |
| **HomebaseView** | S | S | Nav tiles ~10px in portrait; depends on landscape lock | 3 |

\* Stats/Analysis/Online/Tournament are borderline — data-dense reading surfaces that *might* serve the phone better as fluid; flagged for owner judgment, not auto-migrated.

---

## Cross-cutting defects (the systemic ones)

1. **Orientation lock silently fails in browser tabs (Sev 4 for non-PWA).** `screen.orientation.lock()` only works in `display:standalone` PWA; in a normal tab it rejects silently, with **no CSS `@media (orientation: portrait)` fallback**. So every scaled view degrades to 22.5% with no "rotate your device" hint. *Owner uses the installed PWA, so this bites new/browser users more than the owner.* `useScreenOrientationLock.js:45-65`
2. **The `minHeight:100dvh`-no-scroll clip class.** Any fluid view that sets `minHeight` (not a bounded height) + lacks its own `overflow-y-auto` clips content under the body lock. Hits SelfCoach, AnchorLibrary, PrintableRefresher, Settings-loading, VoiceSandbox. **This is the same bug we just fixed in Sessions/Settings — it recurs because there's no shared fluid-view wrapper.**
3. **Touch targets below the 44px floor, app-wide in modals.** AddSightingModal (every button ~26-30px), SessionForm/CashOut/ImportConfirm/SessionDetail footers (~32-36px), PlayerProfile Edit (~30px), camera overlay (24px). Newer code (DataAndAbout, PlayerFinder) uses `min-h-[44px]`; it was never backfilled to the modal layer.
4. **Modals aren't virtual-keyboard-aware.** `max-h-screen` / `max-h-[90vh]` use the static viewport; on Android the keyboard overlaps the bottom (Save button hidden, unreachable). Only `max-h-[90dvh]` is keyboard-safe (SessionForm/SessionDetail do it right; **AddSightingModal + CashOutModal don't**; CashOut has *no* height bound at all → can clip buttons).
5. **`ScaledContainer` hygiene.** (a) pattern duplicated **inline 4×** (Table/Showdown/HandReplay + the component); (b) missing `shrink-0` (HandReplay patched it locally); (c) `useScale` ships `min(vw/1600, vh/720, 1)` — **no 0.95 margin** (docs/CLAUDE.md say 0.95) → scaled views touch viewport edges / browser chrome overlaps; (d) drill views double-hardcode the dimensions.
6. **NavShell overlap.** The fixed home button renders at full size over scaled views — at 0.225 scale it can cover content. `NavShell.jsx:46`

**Corrections to the record:** Tailwind is **3.4.18** (not 3.3.6 — `^` resolved up); `h-dvh`/`min-h-dvh` are valid (build confirmed). The `useScale` formula doesn't match its CLAUDE.md/0.95 spec.

---

## Prioritized fix plan (phased, owner-impact-weighted)

**Phase 1 — stop the clipping + the worst phone screens (highest owner impact):**
- Add a shared **`<FluidView>`** wrapper (`h-[100dvh] overflow-y-auto`, capped width) and route fluid views through it — kills the recurring `minHeight`-no-scroll bug class at the root. Fix SelfCoach / AnchorLibrary / PrintableRefresher / Settings-loading / VoiceSandbox.
- Migrate **PlayersView** to fluid + `orientation:'portrait'` (the worst-broken screen; precedent = Sessions/Settings).

**Phase 2 — forms + modals on a phone:**
- Migrate **Login/Signup/PasswordReset** to fluid (auth is the first-run phone surface).
- Modal pass: `max-h-[90dvh]` (keyboard-aware) on AddSighting/CashOut; backfill **44px** touch targets across modal footers + the small profile/camera buttons.

**Phase 3 — scaled-view hygiene + the safety net:**
- Add the CSS **portrait fallback** ("rotate to landscape") so a failed lock degrades gracefully instead of 22.5%.
- Consolidate the 4 inline ScaledContainer copies into the component; add `shrink-0`; restore the **0.95** margin; de-dupe drill dimensions; fix NavShell overlap.
- Owner decision: do **Stats/Analysis/Online/Tournament** stay scaled, or become fluid reading surfaces?

**Standardize so it can't drift:** the two shared shells — `<FluidView>` and a single `<ScaledView>` — plus a shared `<Modal>` (44px footers + `90dvh`) are the structural fix; the per-view bugs are symptoms of not having them.

## Open questions for owner
1. **Stats/Analysis/Online/Tournament** — keep the fixed game-canvas (scaled), or reflow as fluid phone reading surfaces? (Determines Phase-3 scope.)
2. Browser-tab support — is the installed PWA the only target (lower the orientation-fallback priority), or do you want the app usable in a plain mobile browser tab too?
3. Phase 1 first (stop clipping + fix PlayersView), or a different priority?

## Links
- Source passes: architecture + product-ux (this run). Prior scroll fix: commit `2b612d8`.
- `ScaledContainer.jsx`, `useScale.js`, `useScreenOrientationLock.js`, `viewRegistry.jsx`, `index.css:22-30`.
- Heuristic refs: `heuristics/mobile-landscape.md` (44px / ML06).

## Change log
- 2026-06-19 — Created. Two-pass responsive audit. Core finding: two layout paradigms applied inconsistently; ~18 views catalogued. Worst: PlayersView (still scaled). Recurring clip-bug class (minHeight-no-scroll) in 5 surfaces → root fix = shared `<FluidView>`. Cross-cutting: orientation-lock-without-fallback, sub-44px modal targets, keyboard-unaware modals, ScaledContainer duplication + missing 0.95 margin. Tailwind-version correction recorded.
