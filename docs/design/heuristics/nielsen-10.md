# Nielsen 10 — Adapted to this app

The canonical Jakob Nielsen usability heuristics, each restated in the context of this poker tracker. The original definitions are in the [Nielsen Norman Group heuristic overview](https://www.nngroup.com/articles/ten-usability-heuristics/); this file reframes each in terms the audit can actually apply to live-poker surfaces.

Reference IDs: `H-N01` through `H-N10`.

---

## H-N01 — Visibility of system status

> The app keeps the user informed about what is going on.

**In this app, that means:**
- Seat state is always unambiguous: empty / assigned / dealer / hero are visually distinct at a glance.
- Advice freshness is always visible — stale advice is visually degraded (see sidebar doctrine).
- Batch-mode or modal-mode is obvious from any surface the user might see while in it.
- Save / saving / saved / error states are not ambiguous.

**Common violations in this app's history:**
- Advice that "looked current" but was from the prior hand (SRT-2 / STP-1 failure mode).
- Batch-mode entered silently because ribbon not yet visible.

---

## H-N02 — Match between system and the real world

> The app speaks the user's language and maps to real-world concepts.

**In this app, that means:**
- "Seat 4" means the same thing in the app and at the physical table.
- Action labels match how the user describes the action ("Check," "Bet," "Raise"), not developer shorthand.
- Bet sizes use natural units (BB, pot fraction, or chips as appropriate to session type).
- Player features match how the user recognizes humans (face, build, clothing, not demographic taxonomy).

**Common violations:**
- Label abbreviations that make sense to developers but are opaque at a glance.
- Showing hand ranges in notation the user doesn't naturally use.

---

## H-N03 — User control and freedom

> Users often perform actions by mistake; they need a clearly marked 'emergency exit'.

**In this app, that means:**
- Undo must exist for any reversible destructive action (retro-link undo is the gold standard).
- Closing a modal / leaving a view should not discard in-progress input without warning.
- Back buttons always visible, never cleverly-placed.
- Keyboard users (rare here but real) have Escape to close.

**Common violations:**
- Clear Player without undo.
- Modals that dismiss input on backdrop-tap without confirmation.

---

## H-N04 — Consistency and standards

> Follow platform conventions.

**In this app, that means:**
- Destructive actions are red. Primary actions are clear. Secondary are neutral. Applied uniformly across surfaces.
- Navigation patterns (fullscreen route vs. modal vs. panel) are consistent per surface type.
- Tailwind classes vs. inline style usage follows the project's established convention (see CLAUDE.md: action colors are inline styles; structural is Tailwind).
- Font sizing and spacing scale consistently with `scale` prop.

**Common violations:**
- One surface using a modal pattern, an adjacent surface using a fullscreen route for the same kind of interaction.
- Inline styles in some places, Tailwind classes in others for the same visual concept.

---

## H-N05 — Error prevention

> Better than good error messages is a careful design which prevents a problem from occurring.

**In this app, that means:**
- Destructive actions are not adjacent to common benign actions.
- Destructive actions have visual distinction (color, divider, spacing).
- Forms validate as-you-type for known failure modes (duplicate names, invalid ranges).
- Taps on ambiguous targets (e.g., a seat with a player) don't default to destructive interpretations.

**Common violations:**
- "Clear Player" placement next to "Assign" increases misclick rate.
- Tapping an existing assigned player might be interpretable as "change" or "clear" — any default interpretation is wrong 50% of the time.

---

## H-N06 — Recognition rather than recall

> Minimize the user's memory load by making elements, actions, and options visible.

**In this app, that means:**
- Picker shows player avatars + names simultaneously; user recognizes the face, confirms the name.
- Recent / recently-used items surface in context menus for one-tap recall.
- Villain reads surface passively near seats, not in a separate "profile" screen that requires recall of where to look.
- Primary recommendations don't hide behind "click to see."

**Common violations:**
- Requiring the user to remember a player's name to find them (PEO solved this via feature filters).
- Hiding critical stats behind expanders.

---

## H-N07 — Flexibility and efficiency of use

> Accelerators, unseen by the novice, may speed the interaction for the expert.

**In this app, that means:**
- Keyboard shortcuts or tap-and-hold accelerators exist for common actions.
- Batch mode exists for bulk operations.
- Power features (direct seat assignment, preset bet sizes) are available without trading off beginner usability.

**Common violations:**
- No fast path for clear-all-seats at session end.
- Batch mode always requires entering through a specific control, even for users who know they always want it at session start.

---

## H-N08 — Aesthetic and minimalist design

> Interfaces should not contain information which is irrelevant or rarely needed.

**In this app, that means:**
- Sidebar doctrine (see `SIDEBAR_DESIGN_PRINCIPLES.md`) enforces density ceiling.
- Menus show only actions relevant to the current seat state.
- Fields are grouped; advanced-only controls are collapsible.
- Visual debris (decorative borders, redundant labels) is minimized.

**Common violations:**
- Context menus that show "Clear" even when the seat is empty (PEO-3 handles this correctly via conditional render — audit to confirm).
- Forms that ask for optional data with the same visual weight as required data.

---

## H-N09 — Help users recognize, diagnose, and recover from errors

> Error messages should be expressed in plain language, precisely indicate the problem, and constructively suggest a solution.

**In this app, that means:**
- Save errors show what went wrong and what to do ("Could not assign player: [reason]" — includes next step).
- Invariant-violation badges explain which invariant failed and why that matters.
- When retro-link fails, the user sees specifically what was attempted and what to try.

**Common violations:**
- Generic "Save failed" without specific cause.
- Silent failures (action appears to succeed but didn't).

---

## H-N10 — Help and documentation

> It may be necessary to provide help and documentation.

**In this app, that means:**
- In-app help is *rarely* needed for a single-user expert; but when it is, it should be contextual, not a separate "Help" section.
- Tooltips on non-obvious controls (e.g., fold curve indicators).
- First-time use of a new feature (e.g., batch mode) could introduce itself inline.

**Common violations:**
- Relying on the user to have read docs that aren't committed or kept current.
- Tooltips that repeat the label instead of adding information.

---

## Applying these in an audit

For each surface walk-through, run through H-N01 → H-N10 in order. Not every heuristic applies to every surface. Capture violations as findings with:
- Heuristic ID
- Specific evidence (what exactly is wrong)
- JTBD impact (which job degrades and for which persona)
- Proposed fix

Weight: a violation of H-N03 or H-N05 on a mid-hand surface is always more severe than an H-N08 violation on a post-session surface.

---

## Change log

- 2026-04-21 — Created.
