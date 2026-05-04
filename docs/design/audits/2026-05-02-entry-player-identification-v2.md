# Gate 1 Entry — 2026-05-02 — Player Identification v2 (PIO)

**Feature working name:** Player Identification v2 (PIO)
**Proposed by:** Master Plan ratified 2026-04-30 (`.claude/projects/master-plan-2026-04-30.md` §A); A-line Gate 1 is the natural Phase 2 stagger move per binding ratification #6 (*A and D Gates 1→5 staggered*). D-G1 (SCF) shipped in SPR-012.
**Gate:** 1 (Entry) — mandatory
**Next gate:** 2 (Blind-Spot Roundtable) — required per verdict below
**Status:** OPEN — this document is the Gate 1 artifact. No production code written. Audit-only per `docs/design/LIFECYCLE.md` Gate 1 contract.
**Sprint:** SPR-013 / WS-004.

---

## Feature summary

Player Identification v2 covers the full umbrella the Master Plan named: **sighting log + wardrobe/jewelry/age/logo entities + dynamic recognition search + phone-camera-capture (`<input capture>`)**. Per Master Plan §3 binding ratifications: A absorbs PlayersView scaling/persistence/PhysicalSection; A reuses PEO infra; A is standalone (not a PEO patch); phone-camera via web-native `<input capture>`.

**Owner-decided scope** (2026-05-02 plan-mode AskUserQuestion):

| Decision | Answer |
|----------|--------|
| Recognition-under-uncertainty temporal scope | **Across-session at same venue.** Sighting log spans sessions in the same physical venue. Cross-venue / cross-operator out of scope (amend in PIO-G2 if owner plays at 2+ venues). |
| PM-10/11/12 framing | **Sub-jobs of PIO's 3 named umbrella JTBDs.** PM-10/11 → PM-13 (describe-someone-into-existence); PM-12 → PM-14 (build-temporal-attribute-history). PIO-G1 authors PM-13/14/15 as the umbrellas. |
| Phone-camera-capture phase | **Gate 4 v1 — ships with first PIO surface.** Web-native `<input type="file" capture="environment">`. Photo on Player record (`photo: dataUrl | blobId`). Respects autonomy red lines #1 (opt-in) + #4 (reversibility — delete photo). |

---

## Critical scope-shifting discoveries

Five realities surfaced by Phase-1 codebase exploration that materially shape what "PIO" means today.

### Discovery 1 — Table-build is the entry surface, not the whole program; Gate 1 + Gate 2 already shipped for that subset

`docs/design/audits/2026-04-26-entry-table-build.md` shipped Gate 1 with **RED** verdict (Cold-Read Chris persona + 3 data shapes: stability flags + ethnicity tag array + clothing-as-seat-observation). `docs/design/audits/2026-04-26-blindspot-table-build.md` shipped Gate 2 with **YELLOW** verdict. PM-10 / PM-11 / PM-12 are formally authored in `docs/design/jtbd/domains/player-management.md` lines 369–541 with full job statement / dimensions / success criteria / failure modes.

**Implication.** Table-build covers the *session-start entry surface* of PIO — the 5–15-minute multi-seat cold-read flow. PIO is the **superset**: sighting log across sessions, wardrobe/jewelry/age/logo as first-class reusable entities, dynamic recognition search as standalone surface, phone-camera-capture. PIO-G1 references table-build's Gate 1 + Gate 2 as **prior art** and positions PM-10/11/12 as **sub-jobs** of three new umbrella JTBDs (PM-13/14/15). PIO does NOT re-author cold-read-chris; that persona is sufficient for the table-build sub-surface and inherits forward to PIO. PIO does NOT re-litigate Gate 2 stages already covered by table-build's blind-spot audit.

### Discovery 2 — Sighting log requires across-session schema, beyond table-build's per-session-per-seat clothing observations

Per owner decision (across-session at same venue scope), the sighting log is the **master temporal record** keyed on `(playerId, sessionId, seenAt, attrs)`. Per-seat-per-session observations (PM-12, table-build) are **one write source** into the sighting log, not a parallel structure. The relationship:

- Cold-read at session start → captures seat observations (table-build PM-12) → those write into the sighting log → sighting log accumulates across sessions per player → enables PM-14 (build-temporal-attribute-history)

The sighting log store is net-new but has a strong precedent: **EAL's `anchorObservationsStore.js`** has the same conceptual shape (per-instance observation that may aggregate to a stable signal). PIO-G3 will specify whether to reuse EAL's store with a discriminator field, or author a parallel `sightingLogsStore.js` mirroring its pattern. Table-build's blind-spot audit Stage B already considered this for clothing observations and recommended **parallel** (per Q6 in table-build Gate 1 open questions). PIO inherits that recommendation.

### Discovery 3 — Wardrobe / jewelry / age / logo are first-class `avatarFeatures` dimensions, not seat observations

Master Plan §A names these as **entities**, not observations. The distinction matters: today's clothing IS a seat observation (PM-12), but a player's typical wardrobe pattern (`always wears designer logos`, `never wears a hat`) is a stable attribute belonging on the player record. Same for jewelry (chain, ring, watch — high stability), age estimate (very high stability per session), and logo affinity (team gear, Greek letters, casino loyalty pins).

Net-new for PIO Gate 4-5:
- Extend `src/constants/avatarFeatureConstants.js` with 4 new categories (`wardrobe`, `jewelry`, `ageEstimate`, `logoTeam`)
- Add asset palettes (likely SVG layers) for each
- Extend `AvatarRenderer.jsx` layer ordering
- Player record's `avatarFeatures` object grows naturally (IDB tolerates new keys)

The clothing-as-seat-observation (PM-12) is a *separate* short-term-observation surface that may *promote* an observation into the stable wardrobe attribute after repeat-occurrence (per table-build Gate 2 Q3 — N=2 sessions promotion threshold proposed).

### Discovery 4 — Dynamic recognition search needs stability-weighted ranking; `scorePlayerMatch` is extensible

`scorePlayerMatch` in `src/hooks/usePlayerFiltering.js` is the existing search-ranking primitive shipped by PEO. It returns `{ nameMatchStart, nameMatchEnd, matchedFeatures, unmatchedFeatureFilters, allFiltersMatch, passesFilters }`. The function is parameter-extensible — PIO Gate 4 adds a `stabilityWeights` parameter so matches on `always`-stability features rank above matches on `today`-stability features.

Net-new is the **stability concept** itself: per-feature stability score derived from sighting-log frequency. PIO Gate 3 is the natural home for the stability formula spec (simple frequency / EWMA / Bayesian-Beta — Open Question §Q1).

### Discovery 5 — Phone-camera-capture is web-native + small-effort; lifecycle is the harder problem

`<input type="file" capture="environment">` is supported in modern mobile browsers (Samsung Galaxy A22 target per chris-live-player). The capture mechanic is a small-effort component. The harder problems are:

- **Storage:** dataUrl in Player record (large, in-band) vs blobId in separate `playerPhotos` store (small, out-of-band). Recommend blobId.
- **Lifecycle:** photo capture must respect 9 autonomy red lines. Especially #1 (opt-in) — never auto-capture on detection events. #4 (reversibility) — one-tap delete photo, no system retention.
- **Permission UX:** casinos vary on photo policy. The capture must be unambiguous and user-initiated to avoid policy violations.
- **Privacy framing:** photos of strangers in a public venue raise consent questions. Open Question §Q5/Q7 below.

The implementation is small; the surface design is medium because of these constraints.

---

## Output 1 — Scope classification

**Primary classification:** **Cross-surface journey change + system-coherence audit + new interaction patterns.**

- **Cross-surface journey change:** PIO spans table-build (existing audited entry surface), a new Player Profile / Sighting History surface (TBD Gate 4), camera capture modal, plus extensions to PlayerEditorView and PlayerPickerView.
- **System-coherence audit:** PIO introduces sighting-log + stability concepts that ripple through search ranking, drill scheduler (potentially), refresher, and any future read-side display. Coherence between sighting-log, per-seat observations, and stable avatar attributes is load-bearing.
- **New interaction patterns:** stability-weighted ranking, sighting-history scroll, recognition disambiguation flow, camera capture, photo display and delete are all new patterns.

**Secondary classification considerations:**

- **Schema impact:** new `sightingLogsStore` IDB store; new player record fields (`sightingObservations[]`, `stabilityScore`, `confidenceFlags`, `photo`, `ethnicityTags`); IDB v22 migration. New `avatarFeatures` categories (wardrobe/jewelry/age/logo).
- **Cross-surface ripples:** PlayersView absorbs PhysicalSection rework + scaling + persistence (per Master Plan §3). DCOMP-W4-A1 F13 (seed avatarFeatures) carries forward as Phase-0 prerequisite from table-build audit.
- **PEO reuse:** clearly bounded — see PEO Reuse Inventory below.

**Drills Consolidation HOLD:** not applicable (player-management domain, not study/drills).

---

## Output 2 — Personas identified

### In scope

| Persona | Role | Core/Situational | Status |
|---|---|---|---|
| [Chris (live player)](../personas/core/chris-live-player.md) | Primary user | Core | Existing |
| [Cold-Read Chris](../personas/situational/cold-read-chris.md) | Sitting at a new table, populating seats | Situational — primary for table-build sub-surface | Existing (Proto, authored 2026-04-26) |
| [Post-Session Chris](../personas/situational/post-session-chris.md) | Post-session sighting-log review + record cleanup | Situational — primary for sighting-history surface | Existing |
| [Between-Hands Chris](../personas/situational/between-hands-chris.md) | Mid-session quick observation update | Situational — secondary | Existing |
| [Ringmaster (home host)](../personas/core/ringmaster-home-host.md) | Home-game host, regular-heavy database | Core — secondary | Existing |

### Out of scope

- [Mid-Hand Chris](../personas/situational/mid-hand-chris.md) — PIO is not a live-decision surface (red line #8: no cross-surface contamination — sighting-log inferences must NOT bleed into live-decision surfaces).
- [Newcomer](../personas/core/newcomer.md) — PIO assumes an established player workflow; first-cold-read overlaps with Cold-Read Chris but is covered by table-build's progressive-disclosure pattern.
- All study / drill / coaching personas — wrong domain.

### Persona-sufficiency check

> *"Does our current cast actually cover this feature, or do we need a new persona?"*

**Answer: 🟢 GREEN — `chris-live-player` (existing, primary) + `cold-read-chris` (existing situational, Proto from 2026-04-26) + `post-session-chris` (existing) cover PIO's persona surface.**

No new persona authored. Cold-Read Chris, authored alongside the table-build entry audit, was originally scoped to the session-start cold-read flow but extends naturally to the broader PIO program: "describe someone into existence" is a generalization of cold-read; "build temporal attribute history" is what cold-read enables across sessions.

Cold-Read Chris remains Proto-status. Table-build Gate 2 ratified the persona's load-bearing assumptions (stability-flag default table; clothing-promotion rule). PIO Gate 2 does NOT need to re-litigate; it inherits.

---

## Output 3 — JTBDs identified

### Already served (existing JTBDs that PIO inherits or sub-jobs)

| Existing JTBD | Domain | Relationship to PIO |
|---|---|---|
| PM-01..09 | player-management | Existing capability; PEO covers fully |
| PM-10 — Cold-read mixed match-or-create | player-management | **Sub-job** of PM-13 (describe-someone-into-existence) |
| PM-11 — Duplicate detection + manual merge | player-management | **Sub-job** of PM-13 |
| PM-12 — Today-only observations as per-seat-per-session records | player-management | **Sub-job** of PM-14 (build-temporal-attribute-history); the per-session observations are the write source into the sighting log |

### Proposed (new umbrella JTBDs — author in player-management.md alongside this audit)

These three umbrella JTBDs are the load-bearing PIO scope. PM-10/11/12 are sub-jobs (table-build serves them); PIO covers the umbrellas.

1. **PM-13 (proposed)** — *Describe someone into existence*
   > When I sit at a table with a player I half-recognize or have never seen, I want to capture them as a record from any combination of partial signals (name fragment, half-stable visual features, today's wardrobe, a photo) — without forcing a complete identity I don't actually know yet.
   - Sub-jobs: PM-10 (cold-read mixed match-or-create), PM-11 (dup-detect + manual merge).
   - Net-new behaviors: photo capture as a partial-signal source (face when the rest is unknown).
   - Distinct from PM-03 (create new and assign): PM-03 assumes complete identity; PM-13 explicitly supports partial-information case.

2. **PM-14 (proposed)** — *Build temporal attribute history*
   > When I observe a player across sessions at the same venue, I want their attribute observations (clothing today, wardrobe trends, age estimate, jewelry) to accumulate as a temporal record — so that "always wears the silver chain" becomes a stable feature and "today wearing a Dolphins jersey" is one session's observation.
   - Sub-jobs: PM-12 (per-seat-per-session observations as sighting-log feeders).
   - Net-new behaviors: cross-session aggregation, stability formula, sighting-log read-side surface.
   - **Scope per owner decision 2026-05-02:** across-session at same venue. Cross-venue / cross-operator deferred (PIO-G2 amendment if owner plays at 2+ venues).

3. **PM-15 (proposed)** — *Convert uncertain sighting to known player*
   > When I have an uncertain sighting (a player I think I recognize from past sessions), I want a recognition disambiguation flow — comparing my current observation against candidate matches in the temporal history — so I can confidently link the sighting to an existing player or commit it as a new record.
   - Sub-jobs: net-new disambiguation interactions (Gate 4 design).
   - Distinct from PM-09 (find a player by visual features): PM-09 is direct lookup; PM-15 is *probabilistic comparison*.
   - **Load-bearing constraint:** red line #1 (opt-in) — system surfaces candidates with confidence; never auto-merges.

### JTBD-coverage check

> *"Does any proposed outcome not map to an existing JTBD?"*

**Answer: 🟡 YELLOW — 3 net-new umbrella JTBDs (PM-13/14/15) in existing `player-management.md` domain. PM-10/11/12 reframed as sub-jobs (their content unchanged; cross-refs added).**

No new domain required.

---

## Output 4 — Gap analysis verdict

| Dimension | Verdict | Notes |
|-----------|---------|-------|
| Personas | 🟢 GREEN | chris-live-player + cold-read-chris (Proto, table-build Gate 2 ratified) + post-session-chris cover PIO |
| JTBDs | 🟡 YELLOW | 3 net-new umbrella PM-13/14/15; PM-10/11/12 reframed as sub-jobs |
| Sighting-log schema | 🔴 RED | Net-new IDB store; precedent in EAL `anchorObservationsStore.js`; parallel-store recommended (per table-build Q6 verdict) |
| Stability flags / weighted ranking | 🔴 RED | Net-new concept; `scorePlayerMatch` is parameter-extensible but stability formula doesn't exist today |
| Wardrobe/jewelry/age/logo dimensions | 🔴 RED | 4 net-new `avatarFeatures` categories + asset palettes + AvatarRenderer layer additions |
| Phone-camera capture | 🔴 RED | Net-new component; photo lifecycle + autonomy compliance |
| Ethnicity flat string → tag array | 🟡 YELLOW | Migration; legacy reads as 1-element array; aligned with table-build's Q5 verdict |
| PEO reuse | 🟢 GREEN | Routes + AvatarRenderer + hooks + atomic ops + I-PEO-1..4 invariants all reusable; clearly bounded — see inventory below |
| Player record extensions | 🟡 YELLOW | New fields: sightingObservations[], stabilityScore, confidenceFlags, photo, ethnicityTags. IDB v22 migration. |
| Surfaces | 🟡 YELLOW | Table-build entry (existing audit, Gate 2 shipped); plus new "Player Profile / Sighting History" (TBD PIO Gate 4); plus camera modal |
| Autonomy compliance | 🟡 YELLOW | 9 red lines bind PIO surfaces — especially #1 opt-in, #4 reversibility (photos), #5 no shame for misidentification, #8 no cross-surface contamination |
| Cross-program interaction with EAL | 🟡 YELLOW | Sighting log uses EAL's anchorObservation precedent; recommend parallel store (table-build Q6 verdict). PIO Gate 2 confirms. |

### Overall Gate 1 verdict: 🔴 **RED**

**4 RED + 7 YELLOW + 1 GREEN dimensions.** Gate 2 (Blind-Spot Roundtable) is **mandatory** for PIO's broader umbrella concerns (sighting-log schema, stability formula, photo lifecycle, demographic-data ethics, cross-venue future-proofing). Gate 3 (Research) likely required for stability-formula spec + sighting-log schema + camera-UX failure modes.

---

## PEO Reuse Inventory (per WS-004 acceptance criteria)

PEO closed 2026-04-16 (4 sessions PEO-1..PEO-4). The following inventory is ratified as reusable infrastructure for PIO. Master Plan §3 binding ratification: *"A reuses PEO infra"*.

| PIO need | Reuse status | Path | Notes |
|----------|-------------|------|-------|
| Fullscreen entry routes | ✅ As-is | `src/components/views/PlayerEditorView/` + `PlayerPickerView/` | Table-build's Gate 4 surface extends these |
| Avatar rendering | ✅ As-is | `src/components/ui/AvatarRenderer.jsx` + `PlayerAvatar.jsx` + `AvatarMonogram.jsx` | Add layers for wardrobe/jewelry/age/logo |
| Avatar feature picker UI pattern | ✅ Extend | `src/components/views/PlayerEditorView/AvatarFeatureBuilder.jsx` | Add category rows |
| Avatar constants + palettes | ✅ Extend | `src/constants/avatarFeatureConstants.js` + `src/assets/avatarFeatures/` | Add wardrobe / jewelry / age / logo palettes |
| Draft persistence | ✅ As-is | `playerDrafts` IDB store + `usePlayerDraft` hook | Extends naturally to new fields |
| Atomic player commit | ✅ As-is | `commitDraft()` in `draftsStorage.js` | I-PEO-1 invariant covers expanded record |
| Retroactive linking | ✅ As-is | `linkPlayerToPriorSeatHands` + `batchUpdateSeatPlayers` + `useRetroactiveLinking` | I-PEO-2/3/4 invariants cover expanded record |
| Search ranking primitive | ✅ Extend | `scorePlayerMatch` in `usePlayerFiltering.js` | Add `stabilityWeights` parameter |
| Player schema | 🟡 Extend | `src/utils/persistence/playersStorage.js` + `database.js` v22 | Add: sightingObservations[], stabilityScore, confidenceFlags, photo, ethnicityTags |
| Sighting log store | 🔴 Net-new | `src/utils/persistence/sightingLogsStore.js` (new) | Mirror EAL `anchorObservationsStore.js` pattern |
| Camera capture | 🔴 Net-new | `src/components/views/PlayerEditorView/CameraCapture.jsx` (new) | `<input type="file" capture="environment">` |
| Player Profile / Sighting History surface | 🔴 Net-new | TBD Gate 4 surface artifact location | Read-side display of sighting log |

**Inventory verdict:** PEO covers ~60% of PIO's infrastructure as-is; ~30% extends existing modules (additive); ~10% net-new (sighting log + camera + new read surface). Bounded.

---

## Recommended Gate 2 (Blind-Spot Roundtable) scope

PIO's Gate 2 covers the broader umbrella concerns NOT addressed by table-build's already-shipped Gate 2. Five stages:

- **Stage A — Sighting-log schema sufficiency.** Validate parallel-store recommendation (per table-build Q6 verdict). Per-seat-per-session observations write to BOTH a clothing-observation store (table-build) AND the sighting log? Or write to sighting log, with clothing observations being one specialization? Resolve ambiguity.
- **Stage B — Stability formula sufficiency.** Walk three formulas: simple frequency, EWMA, Bayesian-Beta. Pick one for Gate 3 specification.
- **Stage C — Photo lifecycle stress.** Casino photo policy variation; photo display in cold-read flow (do you see the saved photo when sighting someone?); delete-photo affordance discovery; photo update vs replacement (most recent? all kept?).
- **Stage D — Cross-program / cross-surface ripples.** EAL anchor coordination; ethnicity migration legacy data; PlayersView scaling absorption; sighting-log read surface placement (own view? Player Profile sub-flow?).
- **Stage E — Heuristic + autonomy red-line pre-check.** All 9 red lines applied to PIO specifically. Especially #1 (opt-in for sighting-log inference), #4 (reversibility — delete photo + sighting), #5 (no shame for misidentification — when system suggests wrong candidate), #8 (no cross-surface contamination — sighting-log NEVER renders on live-decision surfaces).

**Note:** PIO Gate 2 does NOT re-litigate table-build Gate 2 stages (Cold-Read Chris persona, stability-flag defaults, clothing-promotion rule, possible-matches threshold). Those are ratified.

---

## Required follow-ups (blocking Gate 4)

- [ ] **Gate 2 — Blind-Spot Roundtable** — author at `audits/2026-05-XX-blindspot-player-identification-v2.md` covering 5 stages above. Verdict drives Gate 3 scope.
- [ ] **Gate 3 — Research** (likely required given 4 RED dimensions):
  - Stability formula spec.
  - Sighting-log schema (record shape, indexes, write paths).
  - Photo storage decision (dataUrl vs blobId — recommend blobId).
  - Wardrobe / jewelry / age / logo asset palettes.
  - Cross-venue future-proofing (graceful schema for if-and-when the scope expands).
- [ ] **Gate 4 — Design**:
  - Player Profile / Sighting History surface artifact at `surfaces/player-profile.md` (new).
  - Camera capture modal artifact (likely embedded in player-editor.md).
  - Schema delta document (IDB v22 migration).
  - PlayersView absorption decisions per Master Plan §3.
- [ ] **Phase-0 prerequisite (engineering, post-Gate 4):** DCOMP-W4-A1 F13 — seed `avatarFeatures` in dev data (already a prerequisite carried from table-build audit). Phase-0 status unchanged.

---

## Open questions for owner (before Gate 2)

1. **Stability formula.** Stability score per-feature aggregates "how often was this feature observed across N recent sightings". Pick: (a) simple frequency (count(observed) / count(sessions)); (b) EWMA (recent observations weighted higher); (c) Bayesian-Beta (with prior). Recommend (c) for principled MoE-style confidence; (a) is cheapest. Defer to Gate 3.

2. **Ethnicity migration.** Flat string → tag array migration. Legacy reads as 1-element array. For owner-curated ethnicity values that should split (e.g., "Greek" remaining single, "Greek-Italian" splitting to ["Greek", "Italian"]), is it acceptable to do a one-time migration prompt at v22 boot, or do it silently and let user re-tag manually?

3. **Photo storage location.** dataUrl in Player record (large, in-band) vs blobId in separate `playerPhotos` store (small reference, out-of-band). Recommend blobId for record bloat reasons.

4. **Gate 4 surface count.** Table-build entry (existing) + Player Profile / Sighting History (new for PIO). Are these two distinct surfaces, or one surface with two modes (entry-mode for cold-read, profile-mode for sighting-history review)?

5. **Anti-bias check.** Does PIO recording demographic data (age estimate, ethnicity tags, build) raise concerns about how the data shapes the user's *own* play decisions? Or is it strictly a recognition/memory aid? Owner reviews the framing — system never feeds these tags to the exploit engine.

6. **Tournament players.** Tournament play sees players from many venues; cross-venue scope was deferred. Does photo capture (face-as-identity) compensate? Should PIO have a "tournament mode" toggle that downweights venue-specific sightings? Recommend deferring this question — ship single-venue v1; revisit when tournament play exposes the gap.

7. **Privacy / autonomy.** Photo capture and demographic tags are sensitive. Does PIO need explicit per-record opt-in (red line #1), or is enrollment at the app level enough? Recommend per-record opt-in for photos (each capture is user-initiated); enrollment-level for tags (since the whole avatar system is opt-in by default).

8. **Cold-read-chris persona ratification.** Persona is Proto from 2026-04-26 table-build audit. Ratify as authored, or amend in PIO Gate 2? Recommend ratify-as-authored — table-build Gate 2 already validated load-bearing assumptions.

---

## Links

- Feature lifecycle: [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md)
- Methodology: [`docs/design/METHODOLOGY.md`](../METHODOLOGY.md)
- Roundtable template: [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md)
- Master Plan: [`.claude/projects/master-plan-2026-04-30.md`](../../../.claude/projects/master-plan-2026-04-30.md) §A, §3 binding ratifications
- PEO project file: [`.claude/projects/player-entry-overhaul.md`](../../../.claude/projects/player-entry-overhaul.md)
- Table-build prior art:
  - [Gate 1 entry audit](./2026-04-26-entry-table-build.md) — RED verdict
  - [Gate 2 blind-spot audit](./2026-04-26-blindspot-table-build.md) — YELLOW verdict
  - PM-10/11/12 in [`jtbd/domains/player-management.md`](../jtbd/domains/player-management.md) lines 369–541
- Persona: [`personas/situational/cold-read-chris.md`](../personas/situational/cold-read-chris.md) (existing Proto; inherited by PIO)
- JTBD additions this session: PM-13/14/15 in [`jtbd/domains/player-management.md`](../jtbd/domains/player-management.md) (PIO Umbrella JTBDs section)
- ATLAS update: [`jtbd/ATLAS.md`](../jtbd/ATLAS.md) — PM domain header bumps from `PM-01..09` to `PM-01..15` (with PM-10/11/12 already present from 2026-04-26)
- EAL precedent for sighting-log store: `src/utils/persistence/anchorObservationsStore.js`
- PEO modules referenced (R/Y/G inventory):
  - Routes: `src/components/views/PlayerEditorView/` + `src/components/views/PlayerPickerView/`
  - Avatar: `src/components/ui/AvatarRenderer.jsx` + `PlayerAvatar.jsx` + `AvatarMonogram.jsx`
  - Constants: `src/constants/avatarFeatureConstants.js`
  - Hooks: `usePlayerDraft` / `usePlayerEditor` / `usePlayerPicker` / `useRetroactiveLinking` / `useScreenFocusManagement`
  - Atomic ops: `linkPlayerToPriorSeatHands` (handLinking.js) / `batchUpdateSeatPlayers` (handsStorage.js) / `commitDraft` (draftsStorage.js)
  - Search ranking: `scorePlayerMatch` in `src/hooks/usePlayerFiltering.js`
  - Schema: `src/utils/persistence/playersStorage.js` + `database.js`
- PEO invariants: I-PEO-1..4 in `system/invariants.md` lines 34–37
- Phase-0 prerequisite carried from table-build: DCOMP-W4-A1 F13 (seed `avatarFeatures` in dev data)

---

## Change log

- 2026-05-02 — Created. Authored from Master Plan §A + §3 binding ratification #6 (A and D Gates 1→5 staggered). Verdict 🔴 RED — 4 RED dimensions (sighting-log schema, stability flags/ranking, wardrobe/jewelry/age/logo dimensions, phone-camera capture) trigger Gate 2 + Gate 3. Reconciled with prior table-build Gate 1 + Gate 2 audits (2026-04-26): PIO is the **superset umbrella**; table-build covers the session-start entry surface; PM-10/11/12 reframed as **sub-jobs** of new umbrella JTBDs PM-13/14/15. PEO reuse inventory ratified — ~60% as-is, ~30% extend, ~10% net-new. Cold-read-chris persona inherited from table-build (Proto, ratified by table-build Gate 2). 8 open questions for owner. Owner-decided scope (across-session at same venue + PM-10..12 as sub-jobs + camera in Gate 4 v1) ratified in plan-mode AskUserQuestion 2026-05-02.
