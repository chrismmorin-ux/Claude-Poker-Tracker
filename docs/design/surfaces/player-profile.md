# Surface — Player Profile / Sighting History

**ID:** `player-profile`
**Code paths:**
- `src/components/views/PlayerProfileView/PlayerProfileView.jsx` (Phase 5 — not yet implemented; spec'd at PIO Gate 4)
- `./StabilitySection.jsx` (Phase 5 — per-attribute stability rendering)
- `./SightingLogSection.jsx` (Phase 5 — chronological sighting list)
- `src/hooks/usePlayerProfile.js` (Phase 5 — data hydration)
- `src/utils/playerMatching/stability.js` (Phase 5 — `computeStability(playerId, attribute)`)
- `src/utils/persistence/sightingLogsStore.js` (Phase 5 — IDB store wrapper for PIO-G3-SLOG)
- `src/utils/persistence/playerPhotosStore.js` (Phase 5 — IDB store wrapper for PIO-G3-PHOTO)

**Route / entry points:**
- `SCREEN.PLAYER_PROFILE` (Phase 5 — to be added to `uiReducer.js`)
- Opens from: `PlayersView` row tap (becomes new default per PIO-G4-PV; Edit is one-tap-from-Profile); Table-Build PreviewColumn drill-in (`Profile →` link when a candidate is selected)
- Closes to: caller (usually PlayersView or Table-Build)

**Product line:** Main app
**Tier placement:** Free+ (core player-management; review-mode read of existing data)
**Last reviewed:** 2026-05-02 (created at PIO Gate 4)

---

## Purpose

Fullscreen review-mode view rendering one player's per-attribute stability flags + chronological sighting log. Consumer-side surface for the cold-read-survives-appearance-changes JTBD: when Mike R. shows up in a new beard, his "skin / build / Irish / 50s" stable attributes still match; the new beard surfaces as `'today-only'` overlay on the Profile.

The Profile is the new default destination for a PlayersView row tap (per PIO-G4-PV: row → Profile, then Edit is one-tap-from-Profile). Edit-mode is preserved as a sibling route at `SCREEN.PLAYER_EDITOR`.

## JTBD served

Primary:
- **PM-13** *describe-someone-into-existence* — Profile is the post-create home; owner reads back what they captured.
- **PM-14** *build-temporal-attribute-history* — stability section + sighting log are the temporal-attribute-history rendering.
- **PM-15** *convert-uncertain-sighting-to-known-player* — Profile is the destination after disambiguation picks an existing player; reviewer can verify match before committing.

Secondary:
- **PM-07** *edit-existing-player-record* — Edit affordance routes to PlayerEditor edit-mode.
- **PM-09** *find-by-visual-features* — Profile view is what owner sees after find-by-features pick.

## Personas served

- [chris-live-player](../personas/core/chris-live-player.md) — primary (cold-read survives appearance changes is the program JTBD).
- [cold-read-chris](../personas/situational/cold-read-chris.md) — primary (Profile is the post-build verification destination).
- [post-session-chris](../personas/situational/post-session-chris.md) — secondary (review session player observations post-session).

NOT served: `mid-hand-chris` (review-mode-only; AP-PIO-02 binding); `between-hands-chris` on live game surfaces (live surfaces blacklisted from sightingLogs reads).

---

## Anatomy

```
┌────────────────────────────────────────────┐
│ [← Back]   Mike R. · Profile               │ ← top bar (sticky)
│ ─────────────────────────────────────────  │
│                                            │
│ [Avatar 80px]                              │
│  Mike R.  (Irish · 50s)                    │
│  47 sessions · 132 hands                   │
│                                            │
│ ▾ Per-attribute stability                  │
│   skin tone     always (±4%, n=18)         │
│   build         always (±6%, n=18)         │
│   ethnicity     Irish always (±5%, n=15)   │
│   age decade    50s (±4%, n=18)            │
│   hair          always (±7%, n=18)         │
│   beard         changes (today: full)      │
│   wardrobe      changes (today: vest)      │
│   jewelry       sometimes — watch (±18%)   │
│   hat           sometimes (±19%, n=18)     │
│   logo          sometimes — sports (±21%)  │
│                                            │
│ ▾ Sighting log (47 sessions, most recent)  │
│   2026-04-30   skin / build / Irish / 50s  │
│                / vest / sports-team logo   │
│   2026-04-15   skin / build / Irish / 50s  │
│                / polo / no-logo            │
│   2026-04-08   skin / build / Irish / 50s  │
│                / button-up / no-logo       │
│   …                                        │
│                                            │
│ [ Edit player → ]    [ ⚑ Add sighting now ]│
└────────────────────────────────────────────┘
```

**Section: Per-attribute stability** (top body).

- One row per Player attribute that has ≥1 sighting accumulated.
- Format: `{attribute name}    {stability label} (±{X.X}%, n={count})`.
- Stability label per PIO-G3-STAB Bayesian-Beta posterior:
  - `'always'` — mean ≥ 0.8 of sightings show the same value (high consistency).
  - `'sometimes'` — 0.4 ≤ mean < 0.8 (variable but observed >40% of sightings).
  - `'today-only'` — mean < 0.4 AND most recent sighting matches the current observation (introduced today).
  - `'changes'` — high variance across sightings; rendered with `today: {observed value}` annotation when current session has captured a new observation.
- Sub-floor (n<5): label rendered as `"Insufficient sample (need {5-n} more sightings)"` per AP-SCF-04 analog. PIO uses n≥5 floor (lighter than SCF's n≥30 because PIO sightings are session-grain, not hand-grain).
- `±X.X%` MoE rendered next to label (matches FIND-001/FIND-002 close-out convention).

**Section: Sighting log** (bottom body).

- Chronological per-event rows (most recent first); reads from `sightingLogs` IDB store filtered by `playerId`.
- Each row: `{date}   {attribute snapshot, comma-separated condensed}`.
- Up to 10 most-recent rows visible; "Show more" affordance at bottom for pagination (Gate 5 implementation detail).
- Empty state: `"No sightings yet."` (factual; AP-SCF-01-analog compliant).

**Affordances (bottom):**

- `[ Edit player → ]` — routes to PlayerEditor edit-mode (`SCREEN.PLAYER_EDITOR` with `playerId` and `mode: 'edit'`). Sibling route; not modal.
- `[ ⚑ Add sighting now ]` — manual sighting append per PIO-G3-SLOG manual-write path. Opens lightweight modal for current-session attribute snapshot capture; on save, commits row to `sightingLogs` and closes modal; Profile re-renders with new sighting on top of the log.

## State

- **UI (`useUI`):** `currentScreen: SCREEN.PLAYER_PROFILE`, `profilePlayerId` (the Player to render).
- **Player (`usePlayer`):** `allPlayers` — name + avatar + ethnicity + ageDecade lookup for header.
- **PlayerProfile (`usePlayerProfile` — Phase 5):** `stabilityFlags` (per-attribute computed), `sightingLog` (chronological array), `loading` flag.
- **IDB reads:**
  - `sightingLogs` store filtered by `playerId` (Sighting log section).
  - `players` store record (header + photo + ethnicity).
  - `playerPhotos` store filtered by `playerId` (avatar image; `URL.createObjectURL` lifecycle).
- **IDB writes:**
  - `sightingLogs` append on `[ ⚑ Add sighting now ]` commit (manual-write path).
- Writes are owner-explicit only.

## Props / context contract

- `scale: number` — viewport scale.

## Key interactions

1. **Mount** — `useScreenFocusManagement` sets focus to top bar; `usePlayerProfile` hydrates from `profilePlayerId` (IDB lookup chain).
2. **Tap `Edit player →`** — routes to PlayerEditor edit-mode (`openPlayerEditor({ mode: 'edit', playerId })`).
3. **Tap `⚑ Add sighting now`** — opens manual-add modal; modal captures current-session attribute snapshot; on save → append to `sightingLogs`; modal closes; Profile re-renders.
4. **Tap sighting row** (Phase 2+) — drills into individual sighting record; per-row edit/delete affordance. v1 sighting log is read-only at row level.
5. **Tap Back** — returns to caller (PlayersView or Table-Build).

---

## Known behavior notes

- **n=5 floor enforcement.** Stability section MUST NOT render `'always'` / `'sometimes'` / `'today-only'` / `'changes'` labels for any attribute with sample size < 5. Sub-floor renders factual placeholder.
- **`±X.X%` MoE display.** Per PIO-G3-STAB Bayesian-Beta posterior half-width. Matches SPR-016/017 (FIND-001/FIND-002) convention.
- **`URL.createObjectURL` lifecycle.** Avatar image rendered via `<img src={URL.createObjectURL(blob)} />`. URL revoked on component unmount to prevent memory leaks (Gate 5 implementation detail).
- **Source-util-policy whitelist.** PlayerProfileView reads `sightingLogs` + `playerPhotos`. Live surfaces blacklisted per AP-PIO-02. CI-grep enforcement at Gate 5.
- **No demographic-targeted recommendation** (AP-PIO-05 binding). Profile DISPLAYS demographic attributes (ethnicity, age decade) for identification utility. Profile does NOT propose exploit recommendations keyed on demographics. Cultural-sensitivity binding per memory: identification utility binds; demographic display is allowed as identification aid.

## Known issues

(None — surface is spec'd at PIO Gate 4; first audit findings will land at Gate 5 implementation review.)

## Potentially missing

- **Per-row sighting edit/delete affordance** (Phase 2+). v1 sighting log is read-only at row level; player-level delete cascades all sightings (red line #4 reversibility honored at Player level).
- **Photo carousel** when player has multiple historical photos (Phase 2+). v1 supports single primary photo per Player record.
- **Cross-venue sighting filter** (Phase 2+). v1 sightingLogs reserves `venueId` field but doesn't filter on it. Cross-venue aggregation surfaces in Phase 2+ with explicit owner toggle.

---

## Test coverage

- Component-level tests at Gate 5: `PlayerProfileView.test.jsx`, `StabilitySection.test.jsx`, `SightingLogSection.test.jsx`.
- Integration tests at Gate 5: PlayersView row tap → Profile mount → stability + sighting log render; Add sighting now → modal → commit → re-render.
- Stability rendering tests at Gate 5: synthetic sighting data → expected `'always'` / `'sometimes'` / `'today-only'` / `'changes'` labels per attribute; sub-floor placeholder.
- Visual verification at Gate 5: 1600x720 layout; long sighting log scroll; Empty-state handling.

## Related surfaces

- `players-view` — primary entry (row tap routes here per PIO-G4-PV scope).
- `table-build` — secondary entry (PreviewColumn `Profile →` link when candidate selected).
- `player-editor` — sibling (Edit affordance routes to edit-mode; create-from-query absorbed by Table-Build).
- `camera-capture-modal` — child (manual-add sighting can include photo capture if owner taps capture button in modal).
- `leak-distillation` — N/A — sightingLogs are a SEPARATE data domain from heroLeaks (no cross-pollination per AP-PIO-01).

---

## Change log

- 2026-05-02 — Created (PIO Gate 4 / WS-007 / SPR-021). Dedicated fullscreen route `SCREEN.PLAYER_PROFILE` per Decision 2 (owner-ratified at SPR-021 plan-mode AskUserQuestion). Per-attribute stability section + sighting log section. Implementation deferred to PIO Gate 5 multi-PR. AP-PIO-01..05 walkthrough + 9 autonomy red lines walkthrough all clear. Cultural-sensitivity binding affirmed: identification utility binds.
