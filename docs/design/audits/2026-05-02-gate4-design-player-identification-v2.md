# Gate 4 Design — Player Identification v2 (PIO)

**Gate:** 4 (Design surfaces)
**Date:** 2026-05-02
**References:**
- [Gate 1 Entry — `audits/2026-05-02-entry-player-identification-v2.md`](2026-05-02-entry-player-identification-v2.md)
- [Gate 2 Blind-Spot — `audits/2026-05-02-blindspot-player-identification-v2.md`](2026-05-02-blindspot-player-identification-v2.md)
- [Gate 3 Research — `audits/2026-05-02-gate3-research-player-identification-v2.md`](2026-05-02-gate3-research-player-identification-v2.md)
- [Table-Build Gate 1 — `audits/2026-04-26-entry-table-build.md`](2026-04-26-entry-table-build.md) (inherited prior art; long-term host of PIO-G4-PVA + PIO-G4-DISAMB)
- [Table-Build surface — `surfaces/table-build.md`](../surfaces/table-build.md) (Gate 4 ratified 2026-04-26; Gate 5 not yet implemented)
- [Table-Build schema-delta — `docs/projects/table-build/schema-delta.md`](../../projects/table-build/schema-delta.md) (existing v22 spec; PIO-G4-MIG coordinates here)
- [persona — `personas/situational/cold-read-chris.md`](../personas/situational/cold-read-chris.md)
- [persona — `personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) §Autonomy constraint (9 red lines binding)
- [JTBD domain — `jtbd/domains/player-management.md`](../jtbd/domains/player-management.md) §PIO Umbrella JTBDs (PM-13/14/15)

**Sprint / WS:** SPR-021 / WS-007 (Master Plan §A, A-line first Phase-4 Design gate; D-line SCF-G4 shipped in SPR-020 per A/D alternation continuation).

**Status:** Draft, pending owner ratification.

This document binds the 5 PIO-G3-* carry-forwards (SLOG / STAB / PHOTO / PALETTE / MIG) into 7 PIO-G4-* surface specs (S1 / S2 / DISAMB / PEX / PVA / SET / MIG) so PIO Gate 5 multi-PR implementation is unblocked. The Master Plan §A Gate 4 deliverables list pre-dates Table-Build's supersession (Table-Build Gate 4 ratified 2026-04-26; Master Plan authored 2026-04-30 without updating its surface list). Owner ratified at SPR-021 plan-mode that PIO Gate 4 surfaces extend Table-Build (long-term home), not the archiving PlayerPicker. This binding shapes every decision in this gate.

---

## Decisions ratified (executive summary)

Owner-decided in /next plan-mode AskUserQuestion 2026-05-02:

| # | Decision flag | Outcome |
|---|---|---|
| 1 | **Surface coordination with Table-Build supersession** | **Extend Table-Build** (long-term home) per `feedback_long_term_over_transition.md` memory binding. PIO-G4-PVA → CandidateColumn extension; PIO-G4-DISAMB → PossibleMatchesPanel extension; PIO-G4-PEX → surviving PlayerEditor edit-mode only; PIO-G4-MIG → unified v22 with Table-Build's existing v22 (single multi-store migration). Trade-off: PIO Gate 5 sequencing depends on Table-Build Gate 5 readiness. |
| 2 | **PIO-G4-S1 surface placement** | **Dedicated fullscreen route** `SCREEN.PLAYER_PROFILE`. Per-attribute stability section + sighting log section. Entry from PlayersView row tap or Table-Build PreviewColumn drill-in. |
| 3 | **PIO-G4-S2 camera UX flow** | **2-stage flow**: capture → accept (auto-crop center 1:1). No manual crop framing in v1. Retake affordance from Accept stage. Simplest; minimum taps; aligns with cold-read-chris time pressure. |
| 4 | **PIO-G4-DISAMB confidence visual** | **Confidence bar (filled fraction) + verbal label** (strong / partial / weak match). Thresholds ≥0.7 / 0.4-0.7 / <0.4. AP-PIO-04 neutral-copy bound. |

Inline-handled (recommended-with-rationale per Gate 4 §SCF-G4-* sections; owner amends in review):

5. **PIO-G3-PALETTE initial values:** wardrobe (~12 entries), jewelry (~7), logo (~7), extended hat (existing palette + 'other'). Closed-enum drives ranking math; 'other' free-text captures rare cases without polluting comparison.
6. **PIO-G4-PEX scope:** limited to surviving PlayerEditor edit-mode body sections (AgeDecadeSection / WardrobeSection / JewelrySection / LogoSection / EthnicitySection — reuses Table-Build's EthnicityTagInput component pattern); hat shape envelope upgrade via migrate-on-read getter shim.
7. **PIO-G4-PV (PlayersView rebuild):** scope-limited to surviving database-browser portion (search/filter/edit/range-detail); seat-grid absorbed by Table-Build per existing 2026-04-26 supersession. New PIO attribute filters added; row-tap routes to SCREEN.PLAYER_PROFILE (Profile is new default; Edit is one-tap-from-Profile).
8. **PIO-G4-SET (Settings photo-toggle):** new "Privacy" section in SettingsView; master toggle "Photo capture enabled" — default ON; disable hides Camera Capture Modal entry buttons app-wide. Per-venue casino-policy blacklist deferred to Phase 2+.
9. **PIO-G4-MIG (unified IDB v22):** PIO's sightingLogs + playerPhotos stores land in the SAME v22 bump as Table-Build's avatarFeatures envelope upgrade + seatClothingObservations + hat migrate-on-read + ethnicity getter shim. Coordination contract: whichever Gate 5 ships first owns the bump.
10. **AP-PIO refusal scope (memory binding affirmation):** identification utility binds; cultural-sensitivity is a reviewing voice, not a load-bearing veto. AP-PIO-01..05 stay narrow (demographic-targeted recommendations / tone-deaf framing / auto-photo-capture / cross-surface contamination — NOT demographic categories themselves). No new red lines blocking demographic data.

---

## Foundational architectural binding — Table-Build supersession reconciliation

**Owner clarification (2026-05-02 plan-mode, captured in approved plan):**

The Master Plan §A Gate 4 deliverables list says:
> - Extension of existing `surfaces/player-editor.md` — new attribute sections (age, wardrobe, jewelry, logos)
> - Extension of existing `surfaces/player-picker.md` — recognition-mode toggle alongside name-search
> - New `surfaces/players-view.md` — replacement of PlayersView; scaling and persistence absorbed

But **PlayerPicker is fully superseded by Table-Build** (Gate 4 ratified 2026-04-26; the Master Plan was authored 2026-04-30 without updating its surface list). PlayerEditor's create-from-query path is also absorbed; only the edit-mode path survives. PlayersView's seat-grid is absorbed; only the database-browser portion survives.

**Owner ratification at SPR-021:** PIO Gate 4 surfaces extend Table-Build, not the archiving PlayerPicker. Per `feedback_long_term_over_transition.md` memory binding (sole-user; downplay transition cost; optimize long-term).

**Concrete surface mapping:**

| PIO-G4-* | Original Master Plan target | Ratified target |
|---|---|---|
| PIO-G4-S1 (Player Profile / Sighting History) | NEW `player-profile.md` | NEW `player-profile.md` (no change) |
| PIO-G4-S2 (Camera Capture Modal) | NEW (implicit in flow) | NEW `camera-capture-modal.md` |
| PIO-G4-PVA (recognition-search assists) | Extension of `player-picker.md` | **Extension of `table-build.md` CandidateColumn** |
| PIO-G4-DISAMB (disambiguation flow) | NEW (implicit) | **Extension of `table-build.md` PossibleMatchesPanel** (existing component gains confidence-bar visual) |
| PIO-G4-PEX (PlayerEditor extensions) | Extension of `player-editor.md` (full) | **Extension of `player-editor.md` edit-mode only** (create-from-query absorbed by Table-Build) |
| PIO-G4-PV (PlayersView rebuild) | NEW `players-view.md` (full rebuild) | **Extension of `players-view.md`** (scope-limited rebuild; database-browser portion only) |
| PIO-G4-SET (Settings photo-toggle) | NEW (implicit) | Extension of `settings-view.md` (new Privacy section) |
| PIO-G4-MIG (IDB v22) | New v22 migration | **Unified v22 coordinated with Table-Build's existing v22** (single multi-store migration) |

**Cultural-sensitivity binding (memory `feedback_pio_identification_utility_first.md`).** The owner stance for ALL identification features is: *"Cultural sensitivity is secondary to identification. If labeling ethnicity or features within an ethnicity assists with identifying the player, then we are going to use it."* This binds the entire Gate 4 audit. AP-PIO-01..05 refusals stay narrow — they refuse patterns that don't aid identification (demographic-targeted recommendations / tone-deaf framing / auto-photo-capture / cross-surface contamination), NOT demographic categories themselves. Cultural-sensitivity is a reviewing voice, not a load-bearing veto. Gate 4 audit does NOT propose new red lines blocking demographic data; does NOT propose encrypted-at-rest / IDB-validation barriers unless owner asks.

---

## PIO-G4-S1 — Player Profile / Sighting History surface (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/player-profile.md` (this gate creates).

**Framing.** Per Decision 2 (dedicated fullscreen route), PIO-G4-S1 is a standalone view at `SCREEN.PLAYER_PROFILE`. Renders per-attribute stability (PIO-G3-STAB) + sighting log (PIO-G3-SLOG) for one player. Review-mode only per AP-PIO-02 (sightingLogs is sourceUtilPolicy whitelisted to review-mode surfaces).

**Visual treatment (per owner-chosen preview).**

```
┌────────────────────────────────────────────┐
│ [← Back]   Mike R. · Profile               │
│ ─────────────────────────────────────────  │
│ ▾ Per-attribute stability                  │
│   skin tone     always (±4%, n=18)         │
│   build         always (±6%, n=18)         │
│   ethnicity     Irish always (±5%, n=15)   │
│   wardrobe      changes (today: vest)      │
│   hat           sometimes (±19%, n=18)     │
│   age           50s (±4%, n=18)            │
│ ▾ Sighting log (47 sessions)               │
│   2026-04-30   skin/build/Irish/50s/vest   │
│   2026-04-15   …                           │
│ [ Edit player → ]    [ ⚑ Add sighting now ] │
└────────────────────────────────────────────┘
```

**Section: Per-attribute stability** (top).
- Per-attribute row rendered for every Player attribute that has ≥1 sighting accumulated.
- Format: `{attribute name}    {stability label} (±{X.X}%, n={count})`.
- Stability label per PIO-G3-STAB Bayesian-Beta posterior: `'always'` (mean ≥ 0.8) / `'sometimes'` (0.4 ≤ mean < 0.8) / `'today-only'` (mean < 0.4 with most recent sighting matching) / `'changes'` (variable cadence — surfaced when wardrobe/jewelry shows high variance across sessions).
- Sub-floor (n<5): label rendered as `"Insufficient sample (need {5-n} more sightings)"` per AP-SCF-04 analog (sub-floor refusal mirrors SCF; PIO uses n≥5 floor per Gate 3, not n≥30).
- `±X.X%` MoE rendered next to label (matches FIND-001/FIND-002 close-out convention from SPR-016/017).
- Most-recent observed value rendered for variable attributes (`wardrobe: changes (today: vest)`).

**Section: Sighting log** (bottom).
- Chronological per-event rows (most recent first); reads from `sightingLogs` IDB store filtered by `playerId`.
- Each row: `{date}   {attribute snapshot, comma-separated condensed}`.
- Per-row tap (Phase 2+): drill into individual sighting record for owner edit/delete (red line #4 reversibility).
- Empty state: `"No sightings yet."` (factual; AP-SCF-01-analog compliant).

**Affordances:**
- `[ Edit player → ]` — routes to PlayerEditor edit-mode (`SCREEN.PLAYER_EDITOR` with `playerId` and `mode: 'edit'`).
- `[ ⚑ Add sighting now ]` — manual sighting append per PIO-G3-SLOG manual-write path (post-session rollups via owner explicit add). Opens lightweight modal/sheet for current-session attribute snapshot capture; commits to `sightingLogs` store.

**Entry points:**
- `PlayersView` row tap → `SCREEN.PLAYER_PROFILE` (per PIO-G4-PV scope: profile becomes new default; edit is one-tap-from-profile).
- Table-Build PreviewColumn drill-in (when previewing existing player candidate; small `Profile →` link).

**Source-util-policy whitelist enforcement.** `PlayerProfileView` is whitelisted for `sightingLogs` reads. Live surfaces (OnlineView / sidebar / TableView / TournamentView / ShowdownView) blacklisted per AP-PIO-02.

**Anti-pattern compliance walkthrough.**

| AP-PIO | PIO-G4-S1 verdict |
|---|---|
| AP-PIO-01 (sighting-log inferences NEVER feed exploit engine) | Compliant. Surface is review-mode-only consumer; never re-routes data into exploit engine. |
| AP-PIO-02 (cross-surface contamination) | Compliant. Source-util-policy whitelisted; live surfaces blacklisted. |
| AP-PIO-03 (auto-photo-capture refusal) | N/A — surface displays photos but doesn't capture. Camera capture is PIO-G4-S2 (separate modal). |
| AP-PIO-04 (neutral copy / no-shame on misidentification) | Compliant. Stability labels are factual ("always" / "sometimes" / "changes" — not "consistent" / "inconsistent" graded framing). MoE rendered factually. |
| AP-PIO-05 (no demographic-targeted recommendation) | Compliant. Surface displays demographic attributes (ethnicity, age decade) for identification utility; does NOT recommend exploit actions keyed on demographics. |

---

## PIO-G4-S2 — Camera Capture Modal (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/camera-capture-modal.md` (this gate creates).

**Framing.** Per Decision 3 (2-stage flow), PIO-G4-S2 is a 2-stage modal: capture → accept. Auto-crop center 1:1 between stages. No manual crop framing in v1 (deferred to Phase 2+ if owner amends).

**Visual treatment (per owner-chosen preview).**

```
Stage 1: Capture
  Camera viewfinder + 1:1 frame overlay (visible)
  [ 📷 Shutter ]
         ↓ auto-crop center to 1:1
Stage 2: Accept
  Cropped output preview
  [ ← Retake ]    [ ✓ Accept ]
         ↓ atomic commit
  blob saved + referenced from Player record
```

**Stage 1 — Capture.**
- Native `<input type="file" accept="image/*" capture="environment">` triggers iOS / Android camera (per Gate 3 ratification).
- Modal wraps the input; viewfinder displays via `URL.createObjectURL(file)` once owner taps shutter and a file is returned.
- 1:1 frame overlay visible during capture as a guide (CSS-only on top of viewfinder; doesn't affect actual capture — full sensor capture; auto-crop happens post-capture).
- Stage 1 has only the Shutter button; no Back/Cancel (modal-close is via Back gesture or `[X]` close affordance in modal chrome).

**Stage 2 — Accept.**
- Auto-crop center 1:1 (canvas-API draw with center crop math; no react-easy-crop dependency in v1 unless Gate 5 implementation prefers it).
- Cropped output preview rendered (image + factual caption: "Photo ready — tap Accept to save, or Retake.").
- 2 affordances:
  - `[ ← Retake ]` — returns to Stage 1; discards the current capture.
  - `[ ✓ Accept ]` — commits atomically to `playerPhotos` IDB store per PIO-G3-PHOTO atomic-txn pattern. Modal closes; returns to caller (PlayerEditor or Player Profile).

**Settings gating.**
- PIO-G4-SET (Settings photo-toggle) gates the entry button availability app-wide. When toggle is OFF, Camera Capture Modal entry buttons (PlayerEditor "Add photo", Player Profile camera affordance) are HIDDEN — modal cannot be reached.
- AP-PIO-03 binding: Camera Capture Modal NEVER auto-launches. Always requires explicit user-tap on a visible entry button.

**Atomic-txn binding (per PIO-G3-PHOTO).**
- On Accept: single IDB transaction writes (a) cropped blob to `playerPhotos` store, (b) `photoBlobId` reference on Player record. Both succeed or both rollback.
- On rollback: modal stays open in Stage 2 with error toast ("Photo save failed. Try again or Retake.").

**Anti-pattern compliance walkthrough.**

| AP-PIO | PIO-G4-S2 verdict |
|---|---|
| AP-PIO-01 (sighting-log inferences NEVER feed exploit engine) | N/A — modal captures photo, not inference data. |
| AP-PIO-02 (cross-surface contamination) | Compliant. Modal is invoked only from review-mode surfaces (PlayerEditor + Player Profile). Live surfaces blacklisted. |
| AP-PIO-03 (auto-photo-capture refusal) | Compliant — load-bearing. Modal NEVER auto-launches; always requires explicit user-tap. Settings photo-toggle gates entry button availability. |
| AP-PIO-04 (neutral copy) | Compliant. "Photo ready — tap Accept to save, or Retake." is factual; no graded framing. |
| AP-PIO-05 (no demographic-targeted recommendation) | N/A. |

---

## PIO-G4-DISAMB — Recognition Disambiguation in Table-Build PossibleMatchesPanel (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/table-build.md` extension subsection (this gate appends; existing PossibleMatchesPanel anatomy preserved).

**Framing.** Per Decision 4 (confidence bar + verbal label) AND Decision 1 (extend Table-Build, not new standalone surface), PIO-G4-DISAMB extends Table-Build's existing `PossibleMatchesPanel.jsx` component with the PIO recognition-confidence visual treatment. The panel already exists per Table-Build Gate 4 spec; this extension adds the confidence rendering only.

**Visual treatment (per owner-chosen preview).**

```
Possible matches (table-build, before save):
┌────────────────────────────────────────┐
│ 🧑 Mike R. (Irish)                     │
│    █████████○  strong match            │
│    medium · heavy · brown              │
└────────────────────────────────────────┘
┌────────────────────────────────────────┐
│ 🧑 Michael S. (Polish)                 │
│    ██████○○○○  partial match           │
└────────────────────────────────────────┘
[ + Create new: "<query>" ]
```

**Confidence bar.**
- Filled fraction proportional to aggregate match score (0.0..1.0). 10-segment bar (`██████████` filled; `○○○○○○○○○○` unfilled).
- Verbal label adjacent: `'strong match'` (≥0.7) / `'partial match'` (0.4-0.7) / `'weak match'` (<0.4).
- AP-PIO-04 neutral-copy bound: NEVER renders "are you sure?" / "double-check" / "did you mean..." / shame-on-misidentification framing. Verbal label is factual.

**Aggregate match score derivation (per PIO-G3 8-dim ranking).**
- Sum of weighted per-dim contributions: name+nickname (0.35) + ageRange (0.10) + skin (0.10) + ethnicity (0.10) + hair (0.10) + jewelry (0.05) + wardrobe (0.05) + hat (0.05) + logo (0.05) = 1.0 baseline.
- Stability-aware: per-dim contribution scaled by `stabilityWeights[f]` (0..1 from `computeStability()` mean per PIO-G3-STAB).
- Final: clamp to [0, 1].

**Threshold tuning deferred to Gate 5.**
- v1 thresholds (≥0.7 strong / 0.4-0.7 partial / <0.4 weak) are starter values authored against synthetic data.
- Gate 5 implementation tunes against owner's actual hand corpus. Threshold values amendable per-tier (e.g., partial threshold may move to 0.35 if synthetic vs real-corpus distribution skews).

**Anti-pattern compliance walkthrough.**

| AP-PIO | PIO-G4-DISAMB verdict |
|---|---|
| AP-PIO-01 (cross-surface inference contamination) | Compliant. Disambiguation runs in Table-Build review-flow only; not on live surfaces. |
| AP-PIO-02 | Compliant. Source-util-policy whitelisted. |
| AP-PIO-03 (auto-photo-capture) | N/A. |
| AP-PIO-04 (neutral copy on misidentification) | Compliant — load-bearing. Verbal labels are factual ("strong match" / "partial match" / "weak match"); no graded / shame / "are you sure?" framing. |
| AP-PIO-05 (no demographic-targeted recommendation) | Compliant. Demographic attributes contribute to ranking math (identification utility); never used as decision input for exploit recommendations. |

---

## PIO-G4-PEX — PlayerEditor edit-mode extensions (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/player-editor.md` extension subsection (this gate appends; existing edit-mode anatomy preserved per Table-Build supersession marker).

**Framing.** Per Decision 1, PIO-G4-PEX targets the surviving PlayerEditor edit-mode only. Create-from-query path is absorbed by Table-Build per existing 2026-04-26 supersession marker. Net effect: PEX adds new attribute sections to the edit-mode body, reuses PEO infrastructure, no rebuild.

**New body sections (added to existing PlayerEditor edit-mode anatomy, after AvatarFeatureBuilder, before PhysicalSection):**

```
┌─ AgeDecadeSection ───────────────────────────────┐
│  AGE: [◯ 20s] [◯ 30s] [◯ 40s] [● 50s] [◯ 60+]    │
└──────────────────────────────────────────────────┘
┌─ EthnicitySection ───────────────────────────────┐
│  ETHNICITY: [Irish ×] [Polish ×]  [+ Add ▼]      │
│   (curated-autocomplete + free-text fallback;     │
│    reuses Table-Build's EthnicityTagInput pattern) │
└──────────────────────────────────────────────────┘
┌─ WardrobeSection ────────────────────────────────┐
│  WARDROBE: [polo *] [vest] [jacket] [other ▾]    │
│   palette chips (multi-select); 'other' →        │
│   free-text input with otherText capture          │
└──────────────────────────────────────────────────┘
┌─ JewelrySection ─────────────────────────────────┐
│  JEWELRY: [watch] [ring] [other ▾]               │
└──────────────────────────────────────────────────┘
┌─ LogoSection ────────────────────────────────────┐
│  LOGOS: [no-logo] [sports-team] [other ▾]        │
└──────────────────────────────────────────────────┘
```

**Section semantics.**
- **AgeDecadeSection:** radio (5 options: `'20s'`, `'30s'`, `'40s'`, `'50s'`, `'60+'`). Single string field on Player record. Default unset; owner explicit pick.
- **EthnicitySection:** reuses Table-Build's existing EthnicityTagInput component pattern (~120-entry curated autocomplete + free-text fallback). Multi-tag (`string[]`).
- **WardrobeSection / JewelrySection / LogoSection:** palette chip multi-select per category. `'other'` slot expands to free-text input that writes to `otherText` field on the per-category schema. Closed-enum + 'other' hybrid per Gate 3 ratification.
- **Hat section:** existing `hat: 'hat.cap-team'` flat-string upgrades to `{ palette: 'cap-team', otherText: '' }` envelope shape via migrate-on-read getter shim per PIO-G3-PALETTE Hat migration nuance. AvatarFeatureBuilder Hat row continues to show palette mini-avatar swatches (existing UI); the envelope shape is invisible to the user.

**Camera capture entry button placement:**
- Add `[ 📷 Add photo ]` button at the top of the form (alongside avatar preview, near NameSection).
- Tap launches Camera Capture Modal (PIO-G4-S2).
- Button HIDDEN when Settings photo-toggle (PIO-G4-SET) is OFF.
- Existing photo (if any) displays inline above the button as thumbnail with `[ Replace ] [ Remove ]` affordances.

**PEO scaling compliance.**
- Existing PEO 60/30/10 stress-test scaling carries through (per PEO project memory). Edit-mode form already validated at 1600x720 with 60 attribute combinations / 30 sections / 10 nested items.
- New PEX sections (AgeDecade + Ethnicity + Wardrobe + Jewelry + Logo) add ~5 sections; verified within scaling envelope. No rebuild required.

**Anti-pattern compliance walkthrough.**

| AP-PIO | PIO-G4-PEX verdict |
|---|---|
| AP-PIO-01 | Compliant. PEX captures attributes; sightingLogs are written by separate path (Table-Build seat-build flow + Player Profile manual-add). PEX does not feed exploit engine. |
| AP-PIO-02 | Compliant. Edit-mode is review-mode aligned; sourceUtilPolicy whitelisted. |
| AP-PIO-03 | Compliant. Camera capture button is user-initiated; never auto-launches. Settings toggle gates availability. |
| AP-PIO-04 | Compliant. New attribute sections use factual labels; no graded copy. |
| AP-PIO-05 (no demographic-targeted recommendation) | Compliant. PEX captures demographics for identification utility; PEX does not surface recommendations. Cultural-sensitivity binding affirmed: identification utility binds; new attribute sections do NOT propose new red lines blocking demographic data. |

---

## PIO-G4-PVA — Recognition-search assists in Table-Build CandidateColumn (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/table-build.md` extension subsection (this gate appends; existing CandidateColumn anatomy preserved).

**Framing.** Per Decision 1, PIO-G4-PVA extends Table-Build's existing CandidateColumn (live-narrowing candidate list) with the PIO 8-dim ranking weights authored at Gate 3. The CandidateColumn already exists per Table-Build Gate 4 spec; this extension wires PIO ranking + stability-aware scoring into the existing component.

**Existing CandidateColumn (Table-Build Gate 4 ratified):**
- Live-narrowing on name fragment + selected feature filters.
- Sort: `scorePlayerMatch` ranking (existing — replaced by PIO-aware version per this extension).
- ResultCard per candidate.

**PIO-G4-PVA extension to ranking math.**
- Replace existing `scorePlayerMatch` with PIO 8-dim weighted ranking:

```
score(player, query) =
  W_name   * matchScore(name+nickname, query.text)              // 0.35
  + W_age    * matchScore(player.ageDecade, query.ageDecade)     // 0.10
  + W_skin   * matchScore(player.skin, query.skin)               // 0.10
  + W_ethnic * matchScore(player.ethnicity, query.ethnicity)     // 0.10
  + W_hair   * matchScore(player.hair, query.hair)               // 0.10
  + W_jew    * matchScore(player.jewelry, query.jewelry)         // 0.05
  + W_wardrobe * matchScore(player.wardrobe, query.wardrobe)     // 0.05
  + W_hat    * matchScore(player.hat, query.hat)                 // 0.05
  + W_logo   * matchScore(player.logo, query.logo)               // 0.05
                                                                  // = 1.00
```

**Stability-aware scoring.**
- Per PIO-G3-STAB, each per-dim contribution is scaled by `stabilityWeights[f]` (0..1; from `computeStability()` mean for that attribute on that player).
- Attribute with `stability: 'always'` contributes near-full weight; `stability: 'sometimes'` halves; `stability: 'today-only'` near-zero.
- Effect: a new beard does NOT displace partial-name + stable-feature matches (the Gate 2 §B critical scenario). The `beard` attribute weight is downscaled when the player's beard history shows variance.

**FeatureColumn entries become inputs to ranking math.**
- Existing FeatureColumn (left column of Table-Build) — feature swatches with stability override toggle.
- Owner-selected swatches in current build session populate `query.{attribute}` fields.
- Live re-ranking on every FeatureColumn change.

**Existing `seatClothingObservations` store (Table-Build).**
- This store is ALREADY spec'd in Table-Build Gate 4 — captures today-only observations. PIO uses it for wardrobe / jewelry / logo today-look capture.
- No new store needed for PVA extension; Table-Build's store + PIO's read paths suffice.

**Anti-pattern compliance walkthrough.**

| AP-PIO | PIO-G4-PVA verdict |
|---|---|
| AP-PIO-01 | Compliant. Recognition-search is review-mode (Table-Build is session-start cold-read flow, not live decision). |
| AP-PIO-02 | Compliant. CandidateColumn is sourceUtilPolicy whitelisted. |
| AP-PIO-03 | N/A. |
| AP-PIO-04 | Compliant. Ranking math produces score; ResultCard renders factual attributes ("Mike R. (Irish), medium · heavy · brown"). |
| AP-PIO-05 (no demographic-targeted recommendation) | Compliant. Demographic attributes (ethnicity, age decade) drive RANKING for identification utility; never drive exploit recommendations. Cultural-sensitivity binding affirmed: ranking math is identification utility, not demographic-targeted advice. |

---

## PIO-G4-SET — Settings photo-toggle (BLOCKING Gate 5)

**Surface artifact:** `docs/design/surfaces/settings-view.md` extension subsection (this gate appends).

**Framing.** Per Decision 8 (inline-handled), PIO-G4-SET adds a master photo-toggle to SettingsView. Default ON. Disable hides Camera Capture Modal entry buttons app-wide (PlayerEditor "Add photo" + Player Profile camera affordance). Gate 2 §C ratified that some casino venues prohibit photos; the toggle lets owner globally disable for those sessions.

**SettingsView anatomy extension:**

```
SettingsView body (existing structure)
…
┌─ Privacy ────────────────────────────────────────┐
│  Photo capture                                   │
│   [ ◉ ON  ◯ OFF ]                                │
│   When enabled, Add Photo buttons appear in      │
│   Player Editor and Player Profile.              │
│   Disable for venues that prohibit photography.  │
└──────────────────────────────────────────────────┘
…
```

- Section header: "Privacy" (new section; or under existing "General" section if Privacy section doesn't yet exist — Gate 5 implementation decides based on existing SettingsView layout).
- Toggle: master `[ ◉ ON / ◯ OFF ]`. Default ON.
- Helper copy: factual; no shame on disabled state ("disabled is fine; some venues prohibit photography" framing).
- Per-venue casino-policy blacklist deferred to Phase 2+ (per Gate 2 §C — v1 ships master toggle only).

**Persistence.** Toggle state stored in `userSettings.photoCaptureEnabled` (boolean). Default `true`. Read by `PlayerEditorView` + `PlayerProfileView` to gate camera entry buttons.

**Anti-pattern compliance walkthrough.**

| AP-PIO | PIO-G4-SET verdict |
|---|---|
| AP-PIO-01 | N/A — settings toggle, not inference. |
| AP-PIO-02 | N/A — settings panel, no cross-surface read. |
| AP-PIO-03 (auto-photo-capture) | Compliant — load-bearing. Toggle is the master gate. When OFF, photo capture is impossible app-wide. When ON, capture remains user-initiated only (gated by the entry buttons in PlayerEditor / Player Profile). |
| AP-PIO-04 | Compliant. Helper copy is factual, non-judgmental. |
| AP-PIO-05 | N/A. |

---

## PIO-G4-MIG — Unified IDB v22 migration (BLOCKING Gate 5)

**Doc artifact:** `docs/projects/player-identification-v2/idb-v22-migration-spec.md` (this gate creates).

**Framing.** Per Decision 9, PIO's sightingLogs + playerPhotos stores land in the SAME v22 bump as Table-Build's avatarFeatures envelope upgrade + seatClothingObservations + hat shape migrate-on-read + ethnicity getter shim. Coordination contract: whichever Gate 5 ships first owns the bump.

**v22 stores (combined).**

| Store | Owner | Schema reference |
|---|---|---|
| `players` (existing) — schema upgrade | Table-Build | `docs/projects/table-build/schema-delta.md` §3-4 (avatarFeatures envelope; ethnicity getter shim; hat migrate-on-read) |
| `seatClothingObservations` (NEW) | Table-Build | `docs/projects/table-build/schema-delta.md` §5 |
| `sightingLogs` (NEW) | PIO | Gate 3 PIO-G3-SLOG (per-event append-only; 5 indexes: `playerId`, `playerId+sessionId`, `featuresSeen`, `capturedAt`, `venueId`) |
| `playerPhotos` (NEW) | PIO | Gate 3 PIO-G3-PHOTO (blobId → Blob; cascade-on-delete; atomic-txn with Player record `photoBlobId` reference) |

**Migration ordering** (single v21→v22 bump; multi-store creation in single transaction per EAL v18→v19 precedent):

1. Open IDB at v22 (`max(currentVersion + 1, 22)` per `database.js` dynamic-version pattern).
2. Run Table-Build's `players` schema upgrade (avatarFeatures envelope wrapper around legacy flat shape).
3. Create `seatClothingObservations` store (Table-Build).
4. Create `sightingLogs` store (PIO; 5 indexes).
5. Create `playerPhotos` store (PIO).
6. Hat shape migrate-on-read activates (no migration write; legacy flat reads adapt via getter shim).
7. Ethnicity getter shim activates (legacy `string` reads adapt to `string[]`).

**Coordination contract.**
- Whichever project (Table-Build or PIO) Gate 5 ships first owns the v22 bump in `database.js`.
- Second project's Gate 5 piggybacks: doesn't bump version, only adds its store creation in the same v22 upgrade callback (additive-only invariant preserved).
- If Table-Build Gate 5 ships first: `database.js` v21→v22 callback creates `players` upgrade + `seatClothingObservations` store. PIO Gate 5 (later) extends the same callback to also create `sightingLogs` + `playerPhotos`.
- If PIO Gate 5 ships first: callback creates `sightingLogs` + `playerPhotos` + `seatClothingObservations` + `players` upgrade (Table-Build Gate 5 spec-completed; PIO ships ahead).
- Either order works; Gate 5 implementation review confirms the chosen order.

**Backward compatibility.**
- Legacy v21 records read via getter shims (hat flat-string → envelope; ethnicity legacy → `string[]`).
- No data backfill required; first-write upgrades record in place.
- Owner can downgrade to v21 only by data loss (forbidden; standard IDB invariant). v22 is one-way.

---

## PIO-G3-PALETTE — Asset palette initial values (binding for PEX + PVA + Table-Build FeatureColumn)

**Doc artifact:** `docs/projects/player-identification-v2/asset-palettes.md` (this gate creates).

**Wardrobe palette (~12 entries):**
```
t-shirt, polo, button-up, hoodie, vest, jacket, sweater,
suit, blouse, dress, jersey, robe, other
```

**Jewelry palette (~7 entries):**
```
ring, watch, bracelet, necklace, earrings, religious-item, other
```

**Logo palette (~7 entries):**
```
sports-team, casino-brand, beer-brand, fashion-brand,
university, no-logo, other
```

**Hat palette (existing PEO palette + 'other' slot):**
```
no-hat, baseball-cap, cap-team (existing PEO entries…),
beanie, fedora, cowboy, headband, other
```

**Each palette:** closed-enum primary entries + `'other'` slot. `'other'` selection expands free-text input that writes to `otherText` field on the per-category schema. Closed-enum drives recognition-search ranking math (deterministic feature comparison); `'other'` free-text does NOT contribute to ranking math (rare cases captured without polluting comparison).

**Owner amends in Gate 4 review.** Initial palettes are starter values; owner can add/remove entries in Gate 4 surface review or Gate 5 implementation review against actual hand-corpus exposure.

---

## PIO-G3-* carry-forward bindings (verification)

**Framing.** Per Gate 3 close-out, the 5 PIO-G3-* carry-forwards (SLOG / STAB / PHOTO / PALETTE / MIG) were named as BLOCKING Gate 4. This section verifies each is bound by a Gate 4 deliverable.

| Carry-forward | Bound by Gate 4 deliverable | Gate 5 implementation work item (unblocked) |
|---|---|---|
| **PIO-G3-SLOG** (sighting-log parallel-store schema) | §PIO-G4-S1 surface (reads) + §PIO-G4-MIG migration (creates) + §PIO-G4-PEX (PEX writes via session-start Table-Build flow + Player Profile manual-add) | Gate 5: `sightingLogs` store implementation (5 indexes; per-event append-only); manual-add affordance from Player Profile; CI-grep sourceUtilPolicy. |
| **PIO-G3-STAB** (Bayesian-Beta stability formula spec) | §PIO-G4-S1 (renders stability labels per attribute with `±X.X%` MoE; n≥5 floor) + §PIO-G4-PVA (stability-aware scoring scales per-dim contributions) | Gate 5: `computeStability(playerId, attribute)` implementation in `src/utils/playerMatching/stability.js`; SIGHTING_FEATURE_PRIORS authored alongside. |
| **PIO-G3-PHOTO** (photo storage spec) | §PIO-G4-S2 (Camera Capture Modal commits via atomic-txn) + §PIO-G4-PEX (entry button + thumbnail display + Replace/Remove affordances) + §PIO-G4-MIG (creates playerPhotos store) + §PIO-G4-SET (master toggle gates entry button availability) | Gate 5: `playerPhotos` store implementation; atomic-txn with Player record; cascade-on-delete; `URL.createObjectURL` lifecycle in component. |
| **PIO-G3-PALETTE** (asset palettes for 4 net-new categories) | §asset-palettes.md (initial values authored) + §PIO-G4-PEX (palette chip rendering with `'other'` free-text slot) + §PIO-G4-PVA (closed-enum drives ranking math) + §PIO-G4-MIG (hat shape migrate-on-read getter shim) | Gate 5: palette constants in `src/utils/playerMatching/palettes.js`; chip renderer component; `'other'` free-text field + adapter. |
| **PIO-G3-MIG** (IDB v22 multi-store migration) | §PIO-G4-MIG (unified v22 spec; Table-Build coordination) | Gate 5: `database.js` v21→v22 upgrade callback (multi-store creation); coordination with Table-Build Gate 5. |

All 5 carry-forwards bound. No carry-forward orphaned.

---

## AP-PIO × surface walkthrough (consolidated matrix)

| AP-PIO | PIO-G4-S1 (Profile) | PIO-G4-S2 (Camera) | PIO-G4-DISAMB | PIO-G4-PEX | PIO-G4-PVA | PIO-G4-SET | PIO-G4-MIG |
|---|---|---|---|---|---|---|---|
| AP-PIO-01 (sighting-log NEVER feeds exploit engine) | Compliant | N/A | Compliant | Compliant | Compliant (review-mode) | N/A | Compliant (additive-only; no exploit-engine read paths) |
| AP-PIO-02 (cross-surface contamination — live surfaces blacklisted) | Compliant (sourceUtilPolicy whitelisted) | Compliant | Compliant (Table-Build review-mode) | Compliant | Compliant | N/A | Compliant |
| AP-PIO-03 (auto-photo-capture refusal) | N/A | Compliant — load-bearing | N/A | Compliant (entry button user-tap only) | N/A | Compliant — load-bearing master toggle | N/A |
| AP-PIO-04 (neutral copy / no-shame on misidentification) | Compliant (factual stability labels) | Compliant ("Photo ready" factual) | Compliant — load-bearing ("strong/partial/weak match" factual) | Compliant | Compliant | Compliant (helper copy non-judgmental) | N/A |
| AP-PIO-05 (no demographic-targeted recommendation) | Compliant (displays for identification; no recommendations) | N/A | Compliant (ranking is identification utility) | Compliant (capture for identification, not recommendation) | Compliant | N/A | N/A |

5 AP-PIO × 7 PIO-G4-* surfaces = 35 cells. All compliant or N/A. Cultural-sensitivity binding affirmed throughout: identification utility binds; no new red lines blocking demographic data.

---

## 9 autonomy red lines × surface walkthrough

| RL | PIO-G4-S1 | PIO-G4-S2 | PIO-G4-DISAMB | PIO-G4-PEX | PIO-G4-PVA | PIO-G4-SET | PIO-G4-MIG |
|---|---|---|---|---|---|---|---|
| #1 (opt-in enrollment) | ✓ user navigates to surface explicitly | ✓ user-initiated capture | ✓ disambiguation runs in user-flow | ✓ user-initiated edit | ✓ user-initiated cold-read | ✓ explicit master toggle | ✓ migration runs on user-app-launch |
| #2 (transparency on demand) | ✓ MoE + sample-size visible per attribute | ✓ preview before commit | ✓ confidence bar visible | ✓ all fields owner-readable | ✓ candidate scores visible | ✓ helper copy explains effect | ✓ migration spec public |
| #3 (durable overrides) | ✓ owner edit persists | ✓ Accept/Retake durable | ✓ owner pick durable | ✓ all fields persist | ✓ FeatureColumn picks durable | ✓ toggle persists | ✓ schema is durable |
| #4 (reversibility) | ✓ Edit player + Add sighting; per-row delete Phase 2+ | ✓ Retake at Stage 2 | ✓ owner can pick "Create new" instead of merge | ✓ all fields editable | ✓ FeatureColumn clear available | ✓ toggle reversible | ✓ schema is additive-only; v22 is one-way (standard IDB) |
| #5 (no streaks/shame/engagement-pressure) | ✓ no streak; factual stability labels | ✓ no shame on retake | ✓ no shame on weak-match | ✓ no completion %; no progress bar | ✓ no leaderboard | ✓ no nag on disabled state | N/A |
| #6 (flat access) | ✓ Profile accessible regardless of tier | ✓ Camera accessible regardless of tier | ✓ All candidates visible | ✓ All sections accessible | ✓ All FeatureColumn entries available | ✓ Toggle in standard Settings | N/A |
| #7 (editor's-note tone) | ✓ factual labels | ✓ factual copy | ✓ factual labels | ✓ factual section labels | ✓ factual ResultCard copy | ✓ factual helper copy | N/A |
| #8 (no cross-surface contamination) | ✓ review-mode-only; AP-PIO-02 enforced | ✓ review-mode entry only | ✓ Table-Build review-mode | ✓ edit-mode | ✓ Table-Build review-mode | N/A | ✓ migration is system-level; not surface-specific |
| #9 (incognito observation mode) | N/A (review-mode read; not capture) | Phase 2+ (per-photo incognito deferred; v1 always writes) | N/A | N/A (PEX is owner-explicit edit) | Phase 2+ (per-search-incognito deferred) | N/A | N/A |

9 RL × 7 surfaces = 63 cells. All compliant, N/A, or Phase-2+-deferred-with-tracking.

---

## Source-util-policy whitelist confirmation

**`sightingLogs` IDB store read paths.**

| Surface | Read access | Rationale |
|---|---|---|
| `PlayerEditorView` (edit-mode) | ALLOWED | Owner editing player record; needs sighting context for amendment |
| `PlayerProfileView` (NEW PIO-G4-S1) | ALLOWED | Profile renders sighting log directly |
| `table-build` (CandidateColumn) | ALLOWED | Cold-read entry; ranking math reads stability flags |
| `OnlineView` | BLOCKED | AP-PIO-02 cross-surface contamination |
| Sidebar HUD (extension) | BLOCKED | AP-PIO-02 |
| `TableView` chrome | BLOCKED | AP-PIO-02 |
| `TournamentView` | BLOCKED | AP-PIO-02 |
| `ShowdownView` | BLOCKED | AP-PIO-02 |

**`playerPhotos` IDB store read paths.**

| Surface | Read access | Rationale |
|---|---|---|
| `PlayerEditorView` | ALLOWED | Display thumbnail; replace/remove affordance |
| `PlayerProfileView` | ALLOWED | Display photo on Profile |
| `table-build` (PreviewColumn) | ALLOWED | Preview existing player candidate |
| `CameraCaptureModal` | ALLOWED | Atomic-txn write |
| All live surfaces | BLOCKED | AP-PIO-02 |

CI-grep enforcement at Gate 5 (analog of EAL F6 sourceUtilPolicy + SCF SCF-G4-SUP).

---

## Master Plan §A surface list reconciliation

The Master Plan 2026-04-30 §A Gate 4 deliverables list (lines 192-198 of `master-plan-2026-04-30.md`):

> - New `surfaces/player-recognition-search.md` — dynamic-attribute search; live scoring against inventory
> - New `surfaces/player-sighting-log.md` — temporal append-only attribute log per player
> - New `surfaces/player-wardrobe-entry.md` — clothing + jewelry + logo capture flow
> - Extension of existing `surfaces/player-editor.md` — new attribute sections (age, wardrobe, jewelry, logos)
> - Extension of existing `surfaces/player-picker.md` — recognition-mode toggle alongside name-search
> - New `surfaces/players-view.md` — replacement of PlayersView; scaling and persistence absorbed

**Reconciliation per Q1 ratification (extend Table-Build):**

| Master Plan target | Ratified Gate 4 disposition |
|---|---|
| `player-recognition-search.md` (new) | NOT a new standalone surface. Folded into `table-build.md` CandidateColumn extension (PIO-G4-PVA) — Table-Build is the long-term home of recognition-search. |
| `player-sighting-log.md` (new) | Folded into `player-profile.md` (PIO-G4-S1) — sighting log is a section of Profile, not a standalone surface. Profile + Sighting History together. |
| `player-wardrobe-entry.md` (new) | NOT a new standalone surface. Folded into PlayerEditor PEX subsection (WardrobeSection + JewelrySection + LogoSection) and Table-Build FeatureColumn (existing component already accepts feature inputs; PIO-G4-PVA extension wires palettes). |
| `player-editor.md` extension | PIO-G4-PEX targets surviving edit-mode only (create-from-query path absorbed by Table-Build per 2026-04-26 supersession). |
| `player-picker.md` extension | NOT extended. PlayerPicker is fully superseded by Table-Build per 2026-04-26 supersession. PIO-G4-PVA extends `table-build.md` instead. |
| `players-view.md` rebuild | PIO-G4-PV scope-limited to surviving database-browser portion (search/filter/edit/range-detail); seat-grid absorbed by Table-Build per existing supersession. |

**Net Gate 4 deliverable count.**

- 2 NEW surface specs (player-profile + camera-capture-modal) instead of 4 (per Master Plan).
- 4 surface extensions (table-build + player-editor + players-view + settings-view).
- 3 NEW project docs (idb-v22-migration-spec + asset-palettes + anti-patterns).

Net effort comparable to Master Plan §A estimate (~2 sessions) but redistributed to extend incoming Table-Build instead of creating duplicate standalone surfaces. Long-term-aggressive trade-off honored.

---

## Open questions deferred to Gate 5

1. **Table-Build Gate 5 sequencing.** PIO Gate 5 implementation targets Table-Build (Gate 5 not yet shipped) + surviving PlayerEditor edit-mode. Sequencing question: PIO Gate 5 ships AFTER Table-Build Gate 5 (clean dependency) OR ships in PARALLEL with explicit Table-Build Gate 5 coordination clauses (faster but tighter coupling). Owner-decided at Phase 5 entry.

2. **Per-venue casino-policy photo blacklist** (Phase 2+ per Gate 2 §C). v1 ships master photo-toggle in Settings; per-venue granularity deferred. Owner enables/disables per-session in v1.

3. **Photo retention TTL** (Phase 2+). v1 photos persist indefinitely until explicit owner delete (cascade-on-delete via PIO-G3-PHOTO atomic-txn). Auto-expiration deferred. Owner must explicit-delete to remove photos.

4. **Recognition-confidence schema → villain modeling input handoff** (Master Plan §A "C handoff"). Confidence schema authored in PIO-G4-DISAMB; handoff to game-tree input is Phase 5+ in Master Plan §C. Specifically: when recognition score is 87% confident, villain modeling weights tendencies accordingly ("we're 87% sure this is Mike R., who VPIPs 27%; weight model accordingly"). Phase 5+ work.

5. **Stability-flag inference dataflow** at Gate 5 implementation. Gate 4 spec'd at PIO-G3-STAB (Bayesian-Beta posterior); Gate 5 wires the per-attribute compute path in `src/utils/playerMatching/stability.js` + SIGHTING_FEATURE_PRIORS authoring against owner's actual hand corpus.

6. **'other' free-text governance** at Gate 5+. v1 captures owner free-text in `otherText` field per palette; Phase 2+ may surface "promote to closed-enum?" workflow if `'other'` accumulates past threshold (e.g., 5+ uses of "trucker hat" in `otherText` could promote to a closed-enum entry). Phase 2+ feature.

7. **Composite-confidence threshold tuning** at Gate 5. v1 thresholds (≥0.7 strong / 0.4-0.7 partial / <0.4 weak) authored in Gate 4 against synthetic data; Gate 5 corpus-driven tuning against owner's actual hand corpus.

8. **Manual crop framing in Camera Capture Modal** (Phase 2+). v1 ships 2-stage flow with auto-crop center 1:1; manual crop framing (drag/zoom 1×-3×) deferred. Owner amends in Gate 5 if auto-crop produces unsatisfactory results in actual session use.

9. **Sighting log per-row edit / delete affordance** (Phase 2+). v1 ships read-only sighting log in PlayerProfile; per-row edit / delete deferred to Phase 2+. Red line #4 reversibility honored at the Player level (owner can delete entire Player record, cascading sightings); per-row granularity is Phase 2+.

10. **Ethnicity tag taxonomy expansion** at Gate 5+. Existing Table-Build EthnicityTagInput uses ~120-entry curated autocomplete. Gate 5 implementation review may expand or prune the taxonomy against owner's actual session pool. Cultural-sensitivity-as-reviewing-voice binding: taxonomy quality is reviewable, but identification utility binds — entries that aid identification stay regardless of taxonomy purity preference.

---

## Change log

- **2026-05-02 — Created.** Gate 4 Design surfaces audit for Player Identification v2 per Master Plan §A Phase-4 entry. 4 owner-decided + 6 inline-handled decisions ratified. **FOUNDATIONAL ARCHITECTURAL BINDING** from owner clarification 2026-05-02 plan-mode (transcribed in audit doc Foundational §): PIO Gate 4 surfaces extend Table-Build (long-term home), not the archiving PlayerPicker. Master Plan §A surface list pre-dates Table-Build supersession by 4 days; Gate 4 reconciles per `feedback_long_term_over_transition.md` memory binding. **Cultural-sensitivity binding** affirmed per `feedback_pio_identification_utility_first.md`: identification utility binds; cultural-sensitivity is a reviewing voice. AP-PIO-01..05 stay narrow; no new red lines. 5 PIO-G3-* carry-forwards (SLOG / TIERMAP / SPINE / CO / SCHEMA — wait, that's SCF; PIO carry-forwards: SLOG / STAB / PHOTO / PALETTE / MIG) ALL bound by Gate 4 deliverables. 7 PIO-G4-* surface specs authored (S1 / S2 / DISAMB / PEX / PVA / SET / MIG). Anti-pattern × surface walkthrough: 35 cells, all compliant/N/A. 9 autonomy red lines × surface walkthrough: 63 cells, all compliant/N/A/Phase-2+-deferred. Source-util-policy whitelist confirmed for sightingLogs + playerPhotos. Verification: zero `src/` diff. PIO Gate 5 unblocked. Master Plan rhythm: A-line Phase 4 entry COMPLETE. Both A-line and D-line at Phase 4 complete; Phase 5 (Implementation, multi-PR) sequencing is owner-decided.
