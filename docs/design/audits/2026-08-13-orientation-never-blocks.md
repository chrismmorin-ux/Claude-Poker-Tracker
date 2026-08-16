# Orientation never blocks — auto-rotate fallback replaces the rotate wall

**Audit-id:** AUDIT-2026-08-13-ORIENTATION
**Type:** Defect-class removal on an existing cross-cutting mechanism (follows up Cross-Cutting #1 of `2026-06-19-responsive-layout-audit.md`).
**Trigger:** Founder ruling 2026-08-13: *"The 'please rotate to landscape' is a terrible design element. It makes the screen unusable, and when pulled up in a browser for Ignition, it is completely unusable there too. The app needs to work properly in landscape and portrait, and either fix itself into landscape for things like tableview, not disable the whole interface because you turn the phone wrong."*
**Work item:** WS-440 (P0, design program; founder device-verified 2026-07-31).

---

## Gate 1 (Entry)

- **Scope classification:** Cross-cutting layout mechanism (every landscape canvas view: Table, Showdown, HandReplay, Homebase, Stats, Analysis, Tournament, Online, Preflop/Postflop/Presession drills). No new surface; no new widget; removes one (RotateDeviceHint).
- **Personas:** Live-session founder at the table (phone, possibly OS-rotation-locked portrait); online grinder running the app in a browser window beside the Ignition client (tall/narrow viewport, mouse). Both existing, both primary. No underserved persona introduced.
- **JTBD:** "Record this hand *right now*" and "keep the HUD beside my table" — both were being hard-blocked by a full-screen overlay whenever the viewport was portrait-aspect.
- **Gap analysis:** **GREEN.** The job, personas, and surfaces are all established; the change removes an interaction blocker rather than introducing an interaction. Gate 2 (Blind-Spot Roundtable) not triggered: no new surface, no new persona, no product-line crossing.

## The ruling, as mechanism

1. **Nothing may cover the app because of orientation.** `RotateDeviceHint.jsx` is deleted (was `fixed inset-0 z-[200]` — it blocked hand entry with no dismiss and no recovery; WS-440's founding defect).
2. **Landscape canvases fix themselves into landscape.** When the viewport is portrait **and** the primary pointer is coarse (touch device), every 1600×720 canvas renders `rotate(90deg) scale(s)` with `s` fitted against the **swapped** viewport dimensions (`src/hooks/useCanvasFit.js`). On a 720×1600 phone viewport that is scale ≈ 0.95 — full-size landscape content; the user just holds the phone sideways. Previously: scale ≈ 0.21 letterbox behind a blocking wall.
3. **Fine-pointer viewports never rotate.** A tall desktop window (the Ignition side-by-side workflow) gets plain scale-to-fit — usable with a mouse, respects the chosen window shape, and is no longer covered by the wall.
4. **The installed PWA is unchanged.** `useScreenOrientationLock` still locks per-view orientation there; the fallback only engages where the lock cannot fire (plain browser tab, OS rotation lock).
5. **Rotation and scale are one CSS transform** applied at the four canvas sites (`ScaledContainer.jsx`, TableView, ShowdownView, HandReplayView inline canvases). Hit testing, centering, and internal scroll regions all map through the transform — no layout change, no per-view rework.
6. Measurement (visualViewport preference, `orientationchange` settle re-measure at rAF/50ms/300ms) is ported from the recovered WS-315 fix (commit 954972df) — rotate-away/rotate-back mid-entry self-recovers, pinned by test.

## Chrome rotates too (founder ruling, same day)

The first version left fixed chrome (NavShell, HealthIndicator, UpdateBanner, toasts, voice
overlay, loading screens) screen-upright — reading sideways in rotated mode. Founder:
*"make them rotate … It needs to function properly ALWAYS."* No residual remains:

- **`RotatedViewport`** (`src/components/ui/RotatedViewport.jsx`) renders chrome inside a
  full-screen rotated *virtual landscape viewport* (100dvh × 100dvw, `rotate(90deg)`,
  `flexShrink: 0` — the flex-shrink trap was caught by measurement, the pill anchored 440px
  off until the box stopped shrinking). A CSS transform is the containing block for fixed
  descendants, so each piece's own `fixed top-3 left-3` re-anchors to the user's visual
  frame with no positioning changes.
- **Chrome rotates only when the content does:** the predicate is (canvas fallback active)
  AND (active view landscape-classified, or Showdown open) — a toast on the portrait-native
  Sessions screen stays upright. Verified live in both directions.
- **Tap-through is pinned by test**: the wrapper is `pointer-events-none` (a full-screen
  fixed layer that swallowed taps would dead-screen the app); each interactive chrome root
  carries `pointer-events-auto`. Verified live: canvas tiles tappable beneath five wrappers,
  rotated Home pill navigates.
- `ToastProvider` moved inside `UIProvider` (no `useToast` consumer exists above the new
  position — verified) so the toast layer can read the active view's orientation.
  `RotatedViewport` degrades to unrotated without a UIProvider instead of throwing.
- Loading screens (`AuthLoadingScreen`, `ViewLoadingFallback`) switched from `h-dvh` to
  `fixed inset-0`, which fills the real viewport and the rotated viewport identically.

- Rotation direction is fixed at +90° (turn the phone left-edge-up). If the founder habitually turns the other way, flip to `-90deg` — one constant in `canvasTransform`.

## The rotation-scroll defect the sweep caught, and the bridge that fixes it

An independently dispatched sweep refuted the first version of this fix, and the refutation
was **measured, not argued**: Chromium maps touch panning in **screen space**, not through CSS
transforms. Verified with CDP `Input.synthesizeScrollGesture` on a `rotate(90deg)` fixture —
the gesture axis that should scroll (the user's visual vertical, phone turned) moved nothing,
while the perpendicular axis scrolled. Rotation alone would have traded "blocked" for
"scrolls on the wrong axis" on every rotated view with an internal scroller.

**Fix:** `src/hooks/useRotatedTouchScroll.js` — a document-level touch bridge, active only in
rotated mode, scoped to touches starting inside `[data-canvas-rotated="true"]`. It suppresses
native panning and remaps the gesture through the rotation (finger along screen X →
`scrollTop`; along screen Y → `scrollLeft`), with momentum on release. Verified end-to-end
with CDP touch dispatch: visual-vertical swipes scroll correctly, including fling.

## The scroll sweep (same session) — every found instance fixed

The founder's "not all pages are scrollable" report was swept by a dispatched agent across
all views, overlays, modals, and error surfaces. Ten defect sites found, all fixed:

1. **CollapsibleSidebar** (TableView) — nav list overflowed the 720px canvas with no scroll; tail nav buttons clipped. → `min-h-0 overflow-y-auto`.
2. **ShowdownView/CardGrid** — `items-center justify-center` on the scroller made start-edge columns (A/K/Q) unreachable; the prior F5 "fix" had only moved the clipping edge. → center via `m-auto` on the child.
3. **DrillFlashcards / DrillRetryQueue** — same centered-scroller antipattern. → `m-auto`.
4. **ViewErrorBoundary / ErrorBoundary** — crash cards taller than a landscape phone viewport, centered, no scroll: recovery buttons unreachable exactly when recovery matters. → outer scroller + `min-h-full` centering.
5. **CameraCaptureModal** — no scroll region at all; Save unreachable at 90vh on a landscape phone. → stage bodies scroll, `90dvh`.
6. **PrintConfirmationModal / SuppressConfirmModal / RetirementConfirmModal** — no height bound. → `maxHeight: 90dvh` + `overflowY: auto`.
7. **AnchorObservationModal** — `90vh` inside the transformed canvas mixes coordinate systems (vh = real viewport, containing block = canvas) → rendered ~150 physical px. → `maxHeight: 90%`.
8. **ExtensionPanel** — hard `w-[400px]` clipped on 360–390px portrait phones. → `w-full max-w-[400px]` (side-panel and desktop rendering unchanged).
9. **CalibrationDashboardView** — dormant `minHeight: 100dvh` root (the original bug shape, invisible to the guard because the view is `deferred`). → bounded + scrolling.
10. **Small confirm modals** (ConfirmDelete, VersionMismatch, Straddle, RuleChip ×2, ImportConfirm, ExplorerMode dialog, PlayersView replace prompt) — height bounds added; `90%` inside the canvas, `90dvh` outside.

**Guard extension** (`src/test/viewScrollContainers.test.js`, 68 → 82 tests): non-registry
surfaces now scanned (Showdown, both error boundaries, loading screens, deferred views);
a centered-scroller detector (per-className, so outer-scroll/inner-center stays legal); a
`*Modal*` file sweep requiring a height bound on every fixed-inset dialog; and the
PresessionDrill exemption now pins the DrillReveal wrap relation. The new modal sweep caught
a live offender the agent's inventory had missed (AddSightingModal's backdrop) before fixes.

## Verification

- `src/hooks/__tests__/useCanvasFit.test.js` — 7 tests: rotation predicate (portrait × pointer), swapped-dim scale math, transform string, portrait→landscape→portrait recovery, late-settling `orientationchange`.
- `INV-VIEW-SCROLL` extended guard — 82 tests green after fixes.
- Visual/runtime: dev-server Playwright pass — portrait rotated canvas full-size with correct tap targets; tall fine-pointer window unrotated and unblocked; rotated-mode touch scrolling verified via CDP touch dispatch (correct axis, momentum); TableView sidebar nav reachable.

## Change log
- 2026-08-13 — Created. RotateDeviceHint deleted; `useCanvasFit` auto-rotate fallback shipped across all four canvas sites; `useScale` now a wrapper over it (gains the orientationchange settle fix app-wide).
