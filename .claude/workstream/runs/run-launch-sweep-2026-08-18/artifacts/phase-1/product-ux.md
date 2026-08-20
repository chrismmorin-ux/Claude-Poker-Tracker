### PRODUCT & UX ENGINEER -- Launch Readiness Sweep 2026-08-18

Ran the app for real: `npm run env:local` (placeholder .env.local, no Firebase creds) then
`npm run dev` (Vite, http://127.0.0.1:5173) then `npm run devshot` at both the design canvas
(1600x720) and the founder's actual device CSS viewport (1170x540, S22 at DPR2 per
`tests/playwright/deviceProfiles.mjs:26-34`). Ran `tests/playwright/touch-floor.spec.js`.
Then wrote three short Playwright probes (deleted after use, not committed) to measure
elements the shipped instrument does not cover -- the numbers below are all rendered
`boundingBox()` CSS px, post-canvas-transform, at the S22 profile, not declared px.

---

#### Key Concerns (top 5)

1. CRITICAL -- the highest-frequency touch target in the whole app is the smallest, and it is not a semantic control. Every hand requires tapping hole-card and community-card slots. Measured on the S22 profile: hole-card slots render at 27.8x40.3px, community-card slots at 38.9x55.6px -- both below the 44px floor, the hole-card slot on both axes. Source: `src/components/ui/CardSlot.jsx:63-67` -- the slot is a plain `<div onClick={...}>` with no `role`, no `tabIndex`, no `aria-label`, no `onKeyDown`. Declared sizes at `CardSlot.jsx:27-28` (`table`: 56x80, `hole-table`: 40x58) confirm the arithmetic: 56x0.6947=38.9, 40x0.6947=27.8, matching devshot's measured scale factor of 0.694687 exactly. This is not covered by `touch-floor.spec.js` at all -- that spec's roster is scoped to `[data-testid="command-column"]` (`touch-floor.spec.js:102`), and CardSlot lives on the table surface, outside that container. The instrument that exists cannot see the defect that matters most.

2. CRITICAL -- the persistent global navigation renders at 28x28px on the founder's device, on every screen. Measured directly: all 12 left-rail nav buttons (Home, Sessions, Players, Hand Review, Stats, Analysis, Study, Self Coach, Refresher, Online, Extension, Settings) render at 28x28 CSS px. They carry `title` attributes only (`title="Home"` etc.) -- no `aria-label`, and `title` tooltips require hover, which does not exist on a touchscreen. This is not the mid-hand action grid where WS-441 already applied an interim raise; it is the app's own navigation chrome, unaddressed by any tracked ticket found (WS-441/WS-489 scope is the TableView command column per `touch-floor.spec.js:1-30`).

3. HIGH -- the automated touch-floor gate skips the exact controls a founder taps under time pressure. `touch-floor.spec.js:131-134` is `test.fixme(...)`, not `test.skip` with a passing baseline -- it is explicitly not implemented: "mid-hand controls (action grid, sizing panel) + HandReplay transport measured e2e." That state was measured manually since the fixme leaves it dark: `Call $2` / `Fold` render 148x69 (fine), bet-sizing presets ($5/$8/$10/$20) render 69x47 (fine) -- but `ALL IN` renders 301x39, `Deselect`/`Absent`/`Reset Street` render at height 33, and `Reset Hand` -- the one irreversible action in the row -- renders at 73x28, the smallest control in the entire command column. These are all in `touch-floor.spec.js:45-48`'s `PINNED` regression-lock list (accepted-as-known, deferred to WS-489), which means the team already knows about the general pattern, but the specific inversion -- the most destructive action has the smallest target and no confirmation step (see item 4) -- is not named anywhere found.

4. HIGH -- "Reset Hand" is one tap, no confirmation, smallest target in the row, sitting directly above the primary "Next Hand" CTA. In the S22 screenshot (`.devshots-s22/03-table.png`) the control-zone row reads: Deselect, Absent, Reset Street, Reset Hand, immediately above the full-width gold "Next Hand" button. `Reset Hand` at 73x28px sits adjacent to `Reset Street` at 71x33px -- two visually near-identical dark buttons of similar size, one of which discards the entire hand's recorded actions. Under one-handed play at a live table (the app's own stated usability bar), a slipped tap here has no visible undo path in the surrounding UI -- no confirm-before-commit dialog wrapping this specific control was found (a `2026-07-31-entry-confirm-before-commit.md` audit does exist in `docs/design/audits/`, which is itself a signal this exact class of risk was flagged, and, per the open design findings below, may not have closed the loop on every destructive control).

5. MEDIUM/HIGH -- the live advice surface gives no signal for which of its two answers the founder is looking at. `SYSTEM_MODEL.md:132-149` documents the two-phase evaluator: Phase 1 (unbudgeted, ~200-400ms) produces `onFastResult(depth-1 answer) <- founder acts on this`, then Phase 2 (budgeted, up to 2000ms) silently replaces it with a refined answer. `FIND-067` (`.claude/workstream/findings/FIND-067.yaml`, open, severity HIGH) confirms: "no shallow-vs-refined marker exists... the founder acts on [the fast result]" with zero UI distinction between a depth-1 guess and a depth-2 refined number. The underlying non-determinism defect this was filed against is tracked as resolved elsewhere (WS-432, per project memory), but the finding itself -- the missing depth/confidence indicator on the single highest-consequence number in the app -- is still open and unaddressed.

---

#### Hidden Risks

- FIND-065 (open, HIGH, `.claude/workstream/findings/FIND-065.yaml`): a bystander or the described person can read their own ethnicity/physical-description tags off the screen at a live table. The finding's own evidence: player-editor renders `ETHNICITY: [Irish x] [Polish x]` in plain legible text; `table-build` (the surface built specifically for typing these tags at the table, Gate 4-ratified 2026-04-26) has no CATALOG row and has been invisible to every design sweep since April. This is a live social-safety concern specific to the founder's actual use case (typing player notes at the table, in front of the people being described) -- not a hypothetical persona gap.

- The 44px enforcement instrument itself has a documented false-positive risk baked in: `deviceProfiles.mjs:9-12` flags the S22 DPR as provisional -- never measured on the real phone -- with a plausible range (DPR 2 giving scale approx 0.695, or DPR 2.625 giving scale approx 0.48-0.53) that would push more controls below the floor, not fewer, if the higher DPR is correct. Every rendered-px number in this report inherits that uncertainty; the true numbers on the founder's actual phone could be worse.

- `CardSlot.jsx` has no keyboard path at all (no `tabIndex`, no `onKeyDown`), which also means it is unreachable by any accessibility-tooling automated check that walks the tab order -- the defect is invisible to more than just `touch-floor.spec.js`.

- 97% of UX-touching commits carry no surface/audit/spec reference (`FIND-062`, open, HIGH) -- meaning the Gate 4/5 discipline that is supposed to catch exactly the kind of drift in items 1-4 above (CardSlot never being added to the touch-floor roster, nav rail never being audited) has been running at 3% compliance for 60 days. The gate exists; it is not being used.

- CATALOG drift (`FIND-059`, open, HIGH): the surface catalog marks 4 shipped+routed views as "not yet implemented" and omits 8+ surface files and 6 routed screens -- meaning any inventory-based UX audit (including this one, if it had trusted the catalog instead of the live app) would undercount what is actually shipped and miss real surfaces.

---

#### Likely Missing Elements

- No staleness/depth indicator on live advice (confirmed via FIND-067 + SYSTEM_MODEL section 2.3) -- the founder cannot tell a 200ms guess from a 2000ms refined answer by looking at the screen.

- No confirmation step distinguishable from routine controls on `Reset Hand` -- verified only by absence in the rendered control zone; no modal/confirm wrapper was found in the TableView command-column measurement pass.

- No `aria-label` on any of the 12 primary navigation buttons, or on either CardSlot variant -- screen-reader users get either a bare `title` (nav) or nothing at all (cards).

- No accessible-name coverage check anywhere in the touch-floor or design test suite -- the suite measures geometry, not semantics, so items 1 and 2 above would pass CI cleanly even after a purely geometric fix.

- First-run empty state is present and reasonably designed -- worth stating plainly since not everything here is a gap: booting a fresh IndexedDB profile (`.devshots-s22/01-boot.png`) shows a clean home screen with a real empty-state message ("No completed sessions yet. Start a live session or import online hands to see your dashboard here.") rather than a blank screen or console error, and a "52 concepts to work on" study-queue teaser that gives the new user something to do besides play. `ErrorBoundary.jsx` and `ViewErrorBoundary.jsx` both exist and are wired into `PokerTracker.jsx`, so a per-view crash has a documented containment path rather than a blank white screen -- no evidence this was scoped-out; it is a real, checked-in safety net.

---

#### Dangerous Assumptions

- That "the CI gate enforces the 44px floor" means the floor is enforced. It enforces it for one container (`command-column`) in one state (no seat selected, no card dialog open). The three heaviest-traffic controls in the app -- card entry, primary navigation, and the actual mid-hand action grid -- are either explicitly `test.fixme`'d or structurally outside the measured root. A reader of CLAUDE.md's line stating rendered-size enforcement lives in `tests/playwright/touch-floor.spec.js` would reasonably assume full coverage; it is not full coverage.

- That `title` attributes serve as accessible labels. They provide a hover tooltip only; on a touchscreen there is no hover, so the 12 nav buttons are effectively unlabeled for both screen-reader and touch users simultaneously.

- That a shipped `docs/design/audits/2026-07-31-entry-confirm-before-commit.md` audit means every destructive control got a confirm step. This was not independently verified per-control against that audit within this pass; given FIND-062's 97 percent uncited-commit rate and FIND-063's 19 audits stuck at Draft past SLA, "an audit exists" is a weaker signal here than it would be in a repo with normal gate compliance.

- That the S22 DPR of 2 (scale approximately 0.695, used for every number above) is correct. It is provisional by the test-suite's own admission (`deviceProfiles.mjs:9-12`). If the real device probe returns DPR 2.625, every rendered-px figure in this report shrinks further.

---

#### Verdict on H1-H4

H3 -- SUPPORTED, but narrower than the brief's framing, and the falsifier's inverse of what was expected was found. The brief's falsifier for H3 was: "product-ux runs the app and finds a core flow actually broken end-to-end." No broken end-to-end flow was found -- the session-seat-act-showdown-save-stats chain traces cleanly through `useGameHandlers.js` calling `recordSeatAction`/`recordShowdownAction`, dispatching `GAME_ACTIONS` into `gameReducer.js` (`rawGameReducer` switch at line 95), reaching `usePersistence.js:211` (`saveHand`), exactly as documented at `SYSTEM_MODEL.md:74-85`, and the running app rendered a live, interactive table with real seat/action state (screenshot evidence: `.devshots-s22/03-table.png`). So the flow is not broken. But "not broken" and "usable at the stated bar -- one-handed, live, under time pressure" are different claims, and the second one fails on measured evidence: the highest-frequency control (card entry) and the persistent navigation both render below the accessibility floor with zero remediation in flight, and the one automated instrument that exists to prevent exactly this was left `test.fixme` on the state that matters most. A shippable subset exists (the core recording flow itself is functionally shippable), but "core user flows work end-to-end" as stated in the program's problem-class 2 is a claim about usability, not just wiring -- and on that reading it does not hold without qualification.

H1 -- cannot determine from this lens; partially corroborated. `cwos-pulse.js` and the launch aggregation logic were not opened (that is the infra/methodology-integrity lens), so the `blocking_programs: []` mechanism claim cannot be independently confirmed. What can be said: the design program specifically (read in full) has a working, documented gate structure (`LIFECYCLE.md`) that is being bypassed in practice at a 97 percent rate (`FIND-062`) -- so even if the launch gate did have a contract, the program feeding it design-health data is self-reporting compliance it does not have. That is evidence for a version of H1 one level down: not that the top-level gate is empty, but that a gate wired to a real contract could still be fed bad inputs.

H2 -- cannot determine; outside this lens (the arithmetic/scale-comparison question belongs to the infra/methodology reviewer who opened `cwos-pulse.js`).

H4 -- cannot determine directly, but consistent with what was observed. The design program's own file states `health_score: 0` with an explicit reason at `prog-design.yaml:216`: "Baseline complete... No CWOS-format /pulse run yet -- score will populate on first run." That is a documented never-run, not a documented failure, for this one program -- consistent with H4's claim, at least for `design`. The other nine programs at health 0 were not checked.

Not on the H-list but load-bearing for the launch call: the open design findings read (FIND-058 through FIND-070, 13 total) skew toward measurement/governance failures (protocol clocks null, catalog drift, SLA tracking broken) rather than product defects -- except FIND-065 (live privacy leak of player descriptors) and FIND-067 (no depth indicator on the advice the founder acts on), both of which are genuine user-facing defects, both HIGH severity, both open, and neither is what four generic "NOT READY" verdicts would have surfaced without someone actually running the app.

---

Files opened and cited in this report: `CardSlot.jsx:16-75`, `touch-floor.spec.js` (full), `deviceProfiles.mjs` (full), `SeatComponent.jsx:97-102`, `gameConstants.js:127`, `useGameHandlers.js:1-100`, `gameReducer.js:68,95-96`, `usePersistence.js:14,46,211,220`, `SYSTEM_MODEL.md:1-150`, `LIFECYCLE.md` (full), `prog-design.yaml` (full), `findings-index.yaml:330-469`, `FIND-062.yaml`, `FIND-065.yaml`, `FIND-067.yaml` (full each), `ErrorBoundary.jsx`/`ViewErrorBoundary.jsx` (existence confirmed via find), plus three ad-hoc Playwright probes run against the live dev server at 1170x540 (S22 CSS viewport) and screenshots at `.devshots-s22/` and `.devshots/`.
