# Session Handoff: sr-6-rebuild-batch-6

**Status:** CLOSED — SR-6.9 shipped 2026-04-14. Motion budget + `prefers-reduced-motion` honored. No visible UX change for default users; assistive-tech users get zero-motion. | **Written:** 2026-04-14 | **Closed:** 2026-04-14

## What shipped

1. **`side-panel/side-panel.html`**
   - `.street-card.fade-in { animation: streetFadeIn 0.15s ... }` → `0.2s` (R-6.1 floor).
   - `.deep-body { ... transition: max-height 0.35s ... }` → `0.3s` (R-6.2 ceiling).
   - New block appended to inline `<style>` (directly after the `.zone-zx` rule, before `</style>`):
     ```css
     @media (prefers-reduced-motion: reduce) {
       *, *::before, *::after {
         animation-duration: 0.01ms !important;
         animation-iteration-count: 1 !important;
         transition-duration: 0.01ms !important;
         scroll-behavior: auto !important;
       }
     }
     ```

2. **`side-panel/render-street-card.js`**
   - `scheduleTimer(TRANSITION_TIMER_KEY, ..., 150)` → `..., 200` to match new CSS floor. Comment updated: "matches .transitioning opacity transition (R-6.1 floor)". Prevents drift between JS-driven content swap and CSS fade.

3. **`side-panel/__tests__/motion-budget.test.js`** (new, 5 cases)
   - Pins `.street-card.fade-in` CSS duration = 0.2s.
   - Pins `.deep-body` CSS transition = 0.3s.
   - Asserts `@media (prefers-reduced-motion: reduce)` block exists and zeroes `animation-duration` + `transition-duration`.
   - Asserts JS fade timer uses 200 (regex-matched against scheduleTimer call with TRANSITION_TIMER_KEY).

## Design decisions

- **Global `*` selector in media block.** Rather than enumerate each keyframed/transitioned rule (`.street-card.fade-in`, `.deep-body`, all the `transition: ... var(--ease-*)` sites), the media block zeroes motion on every element via universal selector + `!important`. This is the standard cross-browser idiom; cheaper to maintain and catches new transitions automatically. Trade-off: essential motion (e.g. opacity state changes) also zeroes — acceptable since state change remains, only the interpolation is removed.
- **0.01ms, not 0.** Some browsers treat `animation-duration: 0` as "no animation" and skip `animationend` events. `render-street-card.js` attaches an `animationend` listener to clean up the `fade-in` class — using `0.01ms` preserves event firing. Pattern recommended by web.dev accessibility guidance.
- **JS timer follows CSS, not vice-versa.** CSS floor is authoritative (it's the user-visible motion); JS scheduleTimer is a content-swap race, not an animation. Bumping JS to 200ms means the content swap happens slightly later, still well before the fade-in animation completes.

## What is NOT in this PR

- No changes to `--ease-fast`/`--ease-base`/`--ease-slow` design tokens. Those names carry durations used by many other rules; changing them has cross-zone blast radius not in scope for R-6.1/6.2.
- No runtime JavaScript check of `matchMedia('(prefers-reduced-motion: reduce)')`. All motion suppression is CSS-only per the R-6.3 contract.
- No harness screenshots — motion changes don't produce static-diff-able UI.

## Acceptance — BACKLOG row

> Reduced-motion media query honored; all transition durations within spec bands; JS fade timer matches CSS

All three gates satisfied. Suite 1555 → 1560. Build clean (6 entry points).

## Next session: read this first

1. `.claude/STATUS.md`
2. This handoff.
3. Pick one of:
   - **SR-6.5 (L, FSM authoring)** — still highest-leverage unblock. 5 FSMs (recovery banner, seat popover, deep expander, between-hands X.1, street-card). Gates R-2/R-3 + SR-6.7/6.11/6.13/6.15. Reroutes 9 direct-DOM-mutation sites from §C2.
   - **SR-6.6 (M, freshness records)** — wrap coordinator values in `{value, timestamp, source, confidence}`; replace full-replace-on-push at `render-coordinator.js:482` with field-level merge. Fixes S1 partial-push regression. Gates SR-6.7.

## Files modified this session

- `ignition-poker-tracker/side-panel/side-panel.html` (2 duration edits + new @media block)
- `ignition-poker-tracker/side-panel/render-street-card.js` (150 → 200 timer)
- `ignition-poker-tracker/side-panel/__tests__/motion-budget.test.js` (new, 5 cases)
- `.claude/STATUS.md`, `.claude/BACKLOG.md`

## Closeout checklist

- [x] CSS durations within R-6.1/R-6.2 bands
- [x] @media (prefers-reduced-motion: reduce) block present
- [x] JS/CSS timer sync pinned by test
- [x] Full extension suite passes (1560)
- [x] `node build.mjs` clean
- [x] STATUS + BACKLOG updated
- [x] This handoff closed
