# Gate 1 Entry — 2026-06-13 — Global anchor-library calibration reset (SettingsView)

**Surface working name:** "Reset calibration" danger-zone control in the SettingsView Anchor Calibration area (`AnchorCalibrationResetSection`)
**Proposed by:** WS-221 (authored during SPR-115 / WS-025 recon, 2026-06-10). Implementation claimed by SPR-126 (2026-06-13).
**Gate:** 1 (Entry) — surface-bound addition to an existing surface (`settings-view`).
**Next gate:** 4 (Design) — surface artifact update to `surfaces/settings-view.md` §EAL-G4-SET + journey note in `journeys/anchor-retirement.md`, same session.
**Status:** GREEN — verdict at SPR-126 plan approval (2026-06-13). Founder decisions locked in plan-mode: placement in the Settings danger zone; scope = anchors only (preserve observations).

---

## Why this audit exists

Red line #4 (three-way reversibility) promises (a) per-anchor reset, (b) **global library reset**, (c) per-observation incognito. Arms (a) and (c) shipped; (b) was ratified in the 2026-04-24 program Gate 2 audit but never built — the contract suite `autonomyRedLines.test.jsx` carries an `it.todo('(b) global library reset … see WS-221')` keeping the gap visible on every run. This change delivers (b).

This is the inverse of the anti-pattern the design program exists to prevent ("feature went to dev, design phase skipped"): the design phase ran (red line #4b is enumerated in the program Gate 2 audit and promoted to a persona-level invariant in `chris-live-player.md`), and only the dev slice realizing it was unscheduled. Gate 1 re-runs narrowly to confirm the existing persona/JTBD model covers the Settings-side global control and that no new interaction primitive is introduced.

## Output 1 — Scope classification

**Primary classification:** Surface-bound addition — one new danger-zone section card in the existing `settings-view` surface. No new route. **No new interaction primitive** — it reuses the existing 2-tap destructive confirm (`RetirementConfirmModal`) + 12s undo toast already shipped for per-anchor retire/suppress/reset. No product-line crossing, no underserved-persona target.

**Gate 2 triggers:** none fire. The destructive-action blind-spot risk (irreversibility, accidental data loss, graded-work framing, engagement pressure) was adversarially reviewed at EAL program-level Gate 2 (`2026-04-24-blindspot-exploit-anchor-library.md`), which is where red line #4b originates. The per-anchor reset journey (`journeys/anchor-retirement.md`) already established the confirm/undo pattern this control reuses.

**Verdict on Gate 2 requirement:** NOT required (per `LIFECYCLE.md` "Add new menu action → 1, 4, 5; Gate 2 only if a new interaction pattern is added" — none is).

## Output 2 — Personas served

- [chris-live-player](../personas/core/chris-live-player.md) — primary; carries the autonomy red lines including #4 (three-way reversibility) and #3 (durable override). This change completes red line #4's arm (b).
- [post-session-chris](../personas/situational/post-session-chris.md) — the realistic trigger: after a stretch of play against a changed pool (new venue, seat change), wanting a clean calibration slate without discarding raw observation history.
- Out-of-scope: mid-hand-chris (AP-07 — no live-table surface touched), newcomer-first-hand (Settings danger zone is inert until anchors exist — the button is disabled at 0 anchors).

## Output 3 — JTBD identified

- **JTBD-DS-58** — *validate-confidence-matches-experience* — a global reset is the coarse-grained control for "the model's accumulated calibration no longer reflects the table I'm now playing; restart it."
- **Anchor-management (existing)** — per-anchor retire/suppress/reset already serves the fine-grained case; the library reset is its all-at-once sibling, not new outcome space.

## Output 4 — Gap analysis

**Ready:** per-anchor reset semantics (`buildOverridePayload`, `operator.calibrationResetAt`) define exactly what "reset" means; shared pure-props `RetirementConfirmModal` (2-tap destructive); `useAnchorRetirement` undo-toast pattern to mirror; `AnchorLibraryProvider` + `ToastProvider` wrap the whole app, so a Settings child reaches `dispatchAnchorLibrary` + `selectAllAnchors` + `isReady` + `useToast`; WS-222 `AnchorCalibrationSection` establishes the Settings-side section-card precedent.

**Missing (the work):** `LIBRARY_CALIBRATION_RESET` reducer action (reset + undo-restore paths); `buildLibraryResetCopy()` in retirementCopy.js (AP-06 module); `useLibraryReset` orchestrator; `AnchorCalibrationResetSection.jsx` + SettingsView mount; W-EA-5 writer registry entry; contract-suite `it.todo` → real assertions.

**At risk:**
- **Irreversibility / accidental loss** — destructive action must be 2-tap (checkbox-gated confirm) AND undoable. Mitigation: shared `RetirementConfirmModal` destructive path + 12s undo toast restoring the exact prior anchors snapshot; button disabled at 0 anchors.
- **Red line #3 (evidence durability)** — reset must NOT delete observation records. Mitigation (founder decision): scope = anchors only; stamp `calibrationResetAt` and preserve `anchorObservations`, exactly as per-anchor reset. The matcher discounts pre-reset observations via the timestamp.
- **AP-06 graded-work trap / red line #5, #7** — all confirm + toast copy generated by `buildLibraryResetCopy` under `FORBIDDEN_PATTERNS`; added to the contract suite's tone sweeps (streak/proclamation). The section's own framing evaluates the model's posteriors, never the owner.

## Output 5 — Verdict

**GREEN.** All personas and JTBD covered by existing models; the change completes an already-ratified red line and reuses an existing interaction pattern rather than opening new design space. Gate 4 obligation: update `surfaces/settings-view.md` §EAL-G4-SET (new danger-zone control spec) + add a "Global library reset" note to `journeys/anchor-retirement.md` — done as companion edits to this audit.

**Founder decisions locked (SPR-126 plan-mode, 2026-06-13):**
1. Placement: Settings danger zone (in the Anchor Calibration area), not the Calibration Dashboard. Convention — global "reset all" lives in Settings; per-anchor reset stays on the anchor's surface.
2. Scope: anchors only — stamp `calibrationResetAt` across every anchor; preserve raw observation evidence. Fully undoable via snapshot restore.

## Links

- Work item: `.claude/workstream/queue/WS-221.yaml` (sprint SPR-126)
- Surface artifact amended: [`surfaces/settings-view.md`](../surfaces/settings-view.md) §EAL-G4-SET
- Journey reused: [`journeys/anchor-retirement.md`](../journeys/anchor-retirement.md)
- Sibling Settings-side Gate 1: [`2026-06-12-entry-anchor-enrollment-settings.md`](2026-06-12-entry-anchor-enrollment-settings.md)
- EAL program Gate 2 (origin of red line #4b): [`2026-04-24-blindspot-exploit-anchor-library.md`](2026-04-24-blindspot-exploit-anchor-library.md)

## Change log

- 2026-06-13 — Created. Verdict GREEN; Gate 2 not required (no new interaction primitive); founder placement + scope decisions recorded. Implementation proceeding under WS-221 / SPR-126.
