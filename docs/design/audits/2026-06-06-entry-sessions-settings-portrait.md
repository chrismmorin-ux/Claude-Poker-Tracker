# Gate 1 — Entry — 2026-06-06 — Sessions + Settings portrait-native (responsive entry surfaces)

**Date:** 2026-06-06
**Project:** Sessions View Improvement (responsive addendum, owner-requested mid-project)
**Author:** Claude (main)
**Format:** Per `docs/design/LIFECYCLE.md` Gate 1 (Entry).
**Verdict:** 🟢 **GREEN** — proceed; layout-only change to existing surfaces, strong in-repo precedent.

---

## Feature summary

Owner requirement (verbatim, 2026-06-06): *"We need to make sure the scaling and
shifting between landscape and portrait orientation allow the fields to be read
and entered properly, and not accidentally scaled down to very small size on a
phone screen."*

Root cause: every view except the player-identification screens is a fixed
1600×720 landscape design wrapped in `ScaledContainer`, scaled by
`useScale() = min(vw/1600, vh/720, 1)`. On a phone in portrait (~390×844) the
scale is ≈0.24, so the Sessions view, the New Session / Cash-Out forms, and the
Custom Venues fields all render at ~24% — illegible and un-tappable.

Fix: bring the Sessions + Settings data-entry surfaces into the existing
portrait-native pattern (already used by `PlayerFinder` / `PlayerProfile`):
- Add `SCREEN.SESSIONS` + `SCREEN.SETTINGS` to `VIEW_TO_ORIENTATION = 'portrait'`
  (`useScreenOrientationLock`, best-effort device lock).
- Drop `ScaledContainer` / fixed 1600×720 from `SessionsView` + `SettingsView`;
  render fluid single-column at real sizes (capped width, vertical scroll). The
  fluid layout — not the lock — is the load-bearing part (the lock no-ops on
  desktop and some browsers).
- `SessionForm` modal: remove the `transform: scale()` and size responsively
  (`w-full max-w-md max-h-[90dvh] overflow-y-auto`). `CashOutModal` /
  `ImportConfirmModal` were already responsive.

## Owner decisions (ratified 2026-06-06)

1. **Behavior:** lock to portrait (vs. dual landscape/portrait responsive). The
   fluid layout still reflows acceptably in landscape where the lock doesn't apply.
2. **Scope:** all Sessions + Settings entry surfaces (Sessions view, New Session
   form, Cash-Out form, Custom Venues panel). NOT a whole-app responsive pass —
   that remains a separate, larger effort.

## Scope classification

- **New surface?** No — layout refactor of two existing views + one modal.
- **New interaction modality?** No.
- **New persistent state class?** No.
- **Cross-product impact?** None. TableView / ShowdownView / HandReplay / drills
  keep their 1600×720 landscape design (per `feedback_portrait_mode_player_screens`).

## Gap analysis

| Dimension | Finding |
|---|---|
| Existing surface covers this? | 🟡 Surfaces exist but scale-shrink on phones. Layout fix. |
| Persona coverage | 🟢 Chris on a phone; no new persona. |
| Interaction novelty | 🟢 Reuses the PIO portrait-native pattern + `useScreenOrientationLock`. |
| Data model | 🟢 None. |
| Cognitive-load risk | 🟢 Improves legibility; fields render at real size. |

**Net:** GREEN. Established precedent, no new architecture, contained to two views + one modal.

## Verdict

🟢 **GREEN → proceed.** Surface change-logs updated in `sessions-view.md` and `settings-view.md`. Verified via Playwright at 390×844 (portrait), 844×390 (landscape phone), and wide desktop.
