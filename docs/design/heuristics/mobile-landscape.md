# Platform Heuristics — Mobile Landscape

Heuristics specific to rendering and interacting on a phone in landscape orientation. The app's design target is Samsung Galaxy A22 landscape (1600x720 CSS pixels post-browser-chrome). But real devices deviate — smaller phones may render at 640×360; larger at 844×390. This set captures the constraints that are independent of content.

Reference IDs: `H-ML01` through `H-ML07`.

---

## H-ML01 — Works on the full viewport range, not just the reference device

Target: 640×360 (minimum) to 1600×720 (reference) and larger. Anything that renders only at 1600×720 is a bug.

**Implications:**
- `min-h-screen` + `transform: scale()` composition needs careful math. Scale shrinks visual size but `100vh` is unaffected; bottom content may render below fold on small viewports.
- Flex-basis + overflow-auto must be tested on minimum viewport.
- Fixed-pixel sizes (e.g., `h-96`) may exceed small viewport heights.

**Violated when:**
- A form view works at 1600×720 but is cut off on a 900×400 phone landscape. [EVID-2026-04-21-LANDSCAPE-SCROLL]
- Scroll doesn't engage on the container that holds overflowing content.

---

## H-ML02 — Scroll containers are obvious and reachable

When content exceeds the viewport, scrolling must visibly work. Users must not be confused about *what* scrolls.

**Implications:**
- Only one primary vertical scroll container per view when possible.
- Sticky headers and footers should not steal scroll from a body that needs it.
- Touch targets at the bottom of the visible region should indicate more content below (scroll hint if needed).

**Violated when:**
- An `overflow-auto` container has `flex-1` but its parent doesn't allow it to actually expand.
- A `transform: scale()` on a parent causes visual compression that masks a scroll region.

---

## H-ML03 — Virtual keyboard doesn't obscure primary inputs

When the keyboard opens, the focused input must remain visible. The keyboard can claim ~50% of a phone landscape viewport.

**Implications:**
- Inputs near the bottom of the viewport should scroll into view on focus.
- Fixed footers with submit buttons can overlap the keyboard — move them or make them float above.
- Use `env(safe-area-inset-bottom)` if supported; respect `visualViewport` API for keyboard-height-aware layout.

**Violated when:**
- Typing in the bottom input of a form, the user can't see what they're typing.
- Submit button is hidden behind the keyboard with no way to scroll to it.

---

## H-ML04 — Respect the `scale` transform convention

This app applies `transform: scale(...)` to view root elements (see `useScale` hook). The scale compresses visual size but **does not change DOM measurements**. `min-h-screen` remains 100vh even at scale 0.5 — resulting content is visually half-height but still occupies full viewport vertically.

**Implications:**
- `min-h-screen` on a scaled container is usually wrong — the scaled content may not fill or may overshoot the viewport visually.
- Scroll containers inside scaled roots behave as if the root were full-size — they scroll DOM-space, not visual-space.
- Sticky positioning interacts with transforms in non-intuitive ways.

**This heuristic is load-bearing for the Session 2 landscape scroll finding.**

**Violated when:**
- Layout math assumes pixels-visible when the transform is active.
- Sticky headers disappear under scale > 1 on small viewports.

---

## H-ML05 — No horizontal scroll on primary paths

Horizontal scroll on mobile is for carousels and galleries. Data-entry and navigation paths should never require it.

**Implications:**
- Form fields don't exceed viewport width.
- Primary nav is reachable without horizontal scroll.
- Text wraps or truncates — never bleeds off-screen.

**Violated when:**
- A player name input on the editor overflows the right edge on a narrow phone.
- Sidebar panels extend past the visible area without clear scroll affordance.

---

## H-ML06 — Touch targets are ≥ 44×44 (scaled) CSS pixels

Apple HIG + Material: 44×44 and 48×48 minimum respectively. After the `scale` transform, effective tap size shrinks. Account for that.

**Implications:**
- If scale is 0.5, a 44px target is visually 22px — too small. Start with 88px DOM-size or rethink layout.
- Dense menus (like the seat context menu) should have ≥ 48 DOM-px row height.
- Adjacent touch targets need non-trivial gap to prevent miss-tap adjacent-item selection.

**Violated when:**
- Context menu rows are 40 DOM-px tall at scale 0.5 — effective 20-px targets, unacceptable.

---

## H-ML07 — Orientation changes preserve state

Rotating from landscape to portrait should not discard user input or reset the view. It's uncommon at the table but inevitable when the user steps away or checks the app at home post-session.

**Implications:**
- Controlled inputs survive orientation change.
- Scroll position persists or is restored to something meaningful.
- Modal dismissal is NOT a side effect of rotation.

**Violated when:**
- A mid-entry form clears on rotation.
- Modals pop unexpectedly on rotation.

---

## Testing note

Audits that cite H-ML01, H-ML02, or H-ML04 require visual verification at two viewport sizes minimum:
- Small phone landscape: ~700×320 to 850×390
- Reference device: 1600×720

Ideally also tested at 1024×600 (tablet landscape).

Use Playwright MCP `browser_resize` to simulate viewport sizes if automated; manual device testing for final sign-off.

---

## Change log

- 2026-04-21 — Created.
