# Blind-Spot Roundtable — 2026-05-02 — Player Identification v2

**Type:** Gate 2 Blind-Spot audit (design lifecycle per [`docs/design/LIFECYCLE.md`](../LIFECYCLE.md))
**Trigger:** Gate 1 verdict **RED** ([`docs/design/audits/2026-05-02-entry-player-identification-v2.md`](2026-05-02-entry-player-identification-v2.md)) — 4 RED dimensions (sighting-log schema, stability-flags-and-ranking, wardrobe/jewelry/age/logo dimensions, phone-camera-capture lifecycle) trigger Gate 2 mandatorily per LIFECYCLE.md.
**Sprint / WS:** SPR-015 / WS-005 (Master Plan §A, Phase 2 stagger alternation — alternates with SPR-014 SCF-G2).

**Inherited prior art (NOT re-litigated this session):**

- [Table-build Gate 1 (entry)](2026-04-26-entry-table-build.md) — RED verdict; cold-read-chris persona authored as Proto.
- [Table-build Gate 2 (blind-spot)](2026-04-26-blindspot-table-build.md) — YELLOW verdict; ratified cold-read-chris assumptions, stability-flag defaults, clothing-promotion rule, possible-matches threshold. PIO-G2 inherits these as settled.

**Participants (4 voices, integrative pattern per SPR-014 SCF-G2 precedent):**

| Voice | Lens | Stage(s) led | Stance |
|-------|------|--------------|--------|
| V1 — UX | Surface ergonomics, persona-fit, situational time budgets | A, C | Standard |
| V2 — Failure | 9 red lines compliance, AP-PIO catalog, casino-policy variation, misidentification handling | E (+ cross-stage) | Standard |
| V3 — Data-modeling | Sighting-log schema, PEO-reuse boundary stress-test, EAL precedent, IDB v22 migration | D | Standard |
| V4 — Cultural-sensitivity | Pattern-quality concerns on ethnicity tags, wardrobe taxonomy, age framing | Reviewing across all stages | **Reviewing voice ONLY — does NOT block identification-useful labels per owner override** |

**BINDING owner stance (decided 2026-05-02 plan-mode AskUserQuestion):** *"Cultural sensitivity is secondary to identification. If labeling ethnicity or features within an ethnicity assists with identifying the player, then we are going to use it."* This audit's Cultural-sensitivity voice raises taxonomy-quality concerns (e.g., sub-culture collapse, missing regional variants) but does NOT refuse demographic categories as a class. Identification utility is the binding criterion. AP-PIO refusals (Stage E) are scoped narrowly to patterns that don't aid identification.

**Owner-ratified scope (4 decision flags resolved this session):**

1. **4 voices** with Cultural-sensitivity demoted to reviewing-only role per stance above.
2. **AP-PIO lock at audit-doc-only tier** — refusals enumerated inline in Stage E. No companion `copy-discipline.md` or `anti-patterns.md` files (lighter than SCF-G2's CI-grep tier).
3. **PEO-reuse boundary validation: stress-test in Stage D** — entry-by-entry walk of PIO-G1's 12 inventory rows.
4. **Phone-camera-capture lifecycle: capture-with-explicit-purge** — photo persists per Player record (blobId in `playerPhotos` store per PIO-G1 §Q3); user can delete per record at any time (red line #4 reversibility). No encryption-at-rest baseline (out of scope for v1).

**Status:** DRAFT — owner ratification closes WS-005 and unblocks Gate 3 (Research).

**Artifacts read (pre-audit):**

- [PIO Gate 1 entry audit](2026-05-02-entry-player-identification-v2.md) (source-of-truth: 5 discoveries, PEO Reuse Inventory, 8 open questions)
- [Table-build Gate 1](2026-04-26-entry-table-build.md) + [Table-build Gate 2](2026-04-26-blindspot-table-build.md) (inherited prior art)
- [`docs/design/ROUNDTABLES.md`](../ROUNDTABLES.md) (5-stage template)
- [SCF Gate 2](2026-05-02-blindspot-self-coach-foundation.md) (companion structural reference; same integrative pattern)
- [`personas/situational/cold-read-chris.md`](../personas/situational/cold-read-chris.md) (Proto, inherited)
- [`personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) §Autonomy constraint (9 red lines binding)
- [`jtbd/domains/player-management.md`](../jtbd/domains/player-management.md) (PM-10..15 already authored across Gate 1 + table-build + PIO-G1)
- [`src/utils/persistence/anchorObservationsStore.js`](../../../src/utils/persistence/anchorObservationsStore.js) (EAL precedent for sighting-log store)
- [`src/utils/persistence/playersStorage.js`](../../../src/utils/persistence/playersStorage.js) (Player schema baseline)
- [`src/hooks/usePlayerFiltering.js`](../../../src/hooks/usePlayerFiltering.js) (`scorePlayerMatch` parameter-extensibility)

---

## Executive summary

**Verdict: YELLOW — proceed to Gate 3 with named scope.**

Four voices converge: PIO is structurally tractable but carries three named structural risks plus owner-ratified resolutions on photo lifecycle + PEO-reuse boundaries. None are RED at the doctrine layer; all are gradable in Gate 3.

1. **Sighting-log schema parallel-store decision is load-bearing for Gate 3 (V3 LEAD).** Per PIO-G1 §Discovery 2 + table-build Q6, the recommended pattern is a parallel `sightingLogsStore.js` mirroring EAL's `anchorObservationsStore.js` rather than reusing EAL's store with a discriminator. V3 stress-tested against table-build's per-seat-per-session observation pattern: parallel keeps responsibility-clean (per-session observations write to clothing-observation store table-build's PM-12 surface uses; sighting-log accumulates the cross-session per-player record). Gate 3 ratifies the parallel-store schema spec (record shape + indexes + write paths).
2. **Photo lifecycle is bounded by red lines #1 + #4; Gate 4 surface design is the harder problem (V2 + V1).** Capture-with-explicit-purge ratified. Casino policy variation (some venues prohibit photos, even of players consenting) means the capture affordance MUST be unambiguous and user-initiated; AP-PIO-03 refuses auto-photo-capture. Photo display in cold-read flow (sighting next session) is high-utility; delete-photo affordance must be discoverable but not foot-gun-prone.
3. **PEO-reuse boundaries hold; 4 net-new categories (wardrobe/jewelry/age/logo) need Gate 4 lifecycle-distinct treatment (V3 + V4).** Stress-test of all 12 PEO Reuse Inventory rows (Stage D) confirms: 7 rows reusable as-is, 4 rows extend additively, 3 rows net-new (sighting-log store + camera capture + Player Profile surface). Cultural-sensitivity voice (V4) raised one taxonomy-quality concern on `ageEstimate` (ranges vs single values) — non-blocking but flagged for Gate 3.

**Photo lifecycle decision (Stage C, owner-ratified):** Capture-with-explicit-purge. Per-record delete affordance (red line #4); no system retention; blobId in `playerPhotos` store (per PIO-G1 §Q3); no encryption-at-rest baseline (v1 scope).

**AP-PIO lock decision (Stage E, owner-ratified):** Audit-doc-only tier. AP-PIO-01..05 enumerated inline — narrower scope than SCF's CI-grep tier because the binding identification-utility-over-cultural-sensitivity stance constrains refusals to patterns that don't aid identification.

**Top 3 Gate 3 deliverables:** (1) sighting-log schema spec (parallel-store record shape + indexes + write paths + cross-session aggregation logic), (2) stability formula spec (Bayesian-Beta recommended; Stage E walked alternatives), (3) wardrobe/jewelry/age/logo asset palettes + AvatarRenderer layer additions specification.

**Gate 4 unblocks** with 7 named carry-forwards (enumerated at audit foot). Cross-venue future-proofing deferred per PIO-G1.

---

## Feature summary

PIO is the umbrella for the Master Plan A-line: **sighting log + wardrobe/jewelry/age/logo entities + dynamic recognition search + phone-camera-capture (`<input capture>`)**. PIO-G1 ratified scope via owner AskUserQuestion: across-session-at-same-venue temporal scope; PM-10/11/12 framed as sub-jobs of net-new umbrella JTBDs PM-13/14/15; phone-camera-capture in Gate 4 v1; PEO Reuse Inventory at ~60% as-is + ~30% extend + ~10% net-new. Table-build (2026-04-26) covers the session-start entry sub-surface with its own Gate 1 + Gate 2 already shipped; PIO is the **superset umbrella** whose Gate 2 covers the broader concerns table-build's Gate 2 did not.

---

## Stage A — Persona sufficiency

**Output: ✅ Match — inherited from PIO-G1 + table-build Gate 2; no new authoring needed.**

### Findings (V1 UX lead)

PIO-G1 §Output 2 ratified the persona surface: `chris-live-player` (primary, existing) + `cold-read-chris` (situational primary for table-build sub-surface, Proto from 2026-04-26) + `post-session-chris` (situational primary for sighting-history surface, existing) + `between-hands-chris` (situational secondary, existing) + `ringmaster-home-host` (core secondary, existing). No new persona required.

Table-build Gate 2 (2026-04-26) already validated cold-read-chris's load-bearing assumptions (stability-flag default table; clothing-promotion rule; possible-matches threshold). PIO-G2 inherits the ratification and does NOT re-litigate the persona at this layer.

### Cross-voice resolution

V2 (Failure) noted cold-read-chris remains Proto-status. PIO-G1 explicitly recommended **ratify-as-authored** (Q8) per inherited table-build Gate 2 closure. No PIO-specific surface introduces a persona stress not already covered. V2 ✅.

V4 (Cultural-sensitivity) raised: does cold-read-chris's session-start cold-read flow assume cultural-recognition-fluency that varies across users? Owner is sole user; assumption is bounded; non-issue for this audit. ✅.

### Recommended follow-ups

- [ ] **Gate 3 (NON-BLOCKING):** if owner re-introspection during Gate 3 stability-formula walkthrough surfaces a persona stress not covered, revisit. Default: do not author.
- [ ] **Explicit Gate 3 non-goal:** no new persona. cold-read-chris stays Proto until owner decides to ratify or amend.

---

## Stage B — JTBD coverage

**Output: ✅ Match — PM-13/14/15 + PM-10/11/12 sub-jobs already authored across PIO-G1 + table-build; no Stage B amendments needed.**

### Findings (V1 UX lead, V3 Data-modeling annotation)

PIO-G1 §Output 3 + table-build's Gate 2 collectively shipped:

- PM-10/11 (sub-jobs of PM-13 *describe-someone-into-existence*) — ratified via table-build Gate 2.
- PM-12 (sub-job of PM-14 *build-temporal-attribute-history*) — ratified via table-build Gate 2.
- PM-13/14/15 (umbrella JTBDs, `state: Proposed`) — authored in `jtbd/domains/player-management.md` (PIO Umbrella JTBDs section).

V3 (Data-modeling) confirmation pass: PM-15 *convert-uncertain-sighting-to-known-player* was the most net-new JTBD in PIO-G1; the disambiguation flow it names has no analog in table-build (which is single-session cold-read). Gate 4 designs the disambiguation surface; Gate 3 ratifies the JTBD wording from `Proposed` to `Active`.

### Cross-voice resolution

V4 (Cultural-sensitivity) noted PM-13's "from any combination of partial signals" framing covers ethnicity + wardrobe + jewelry as legitimate signal classes. Aligned with owner's binding identification-utility-over-cultural-sensitivity stance. ✅.

### Recommended follow-ups

- [ ] **Gate 3 (BLOCKING Gate 4):** ratify PM-13/14/15 from `state: Proposed` → `state: Active` with success criteria + failure modes filled in.
- [ ] **Gate 4 constraint:** Player Profile / Sighting History surface (PIO-G4-S1 carry-forward below) is the primary host for PM-14 + PM-15.

---

## Stage C — Situational stress + photo lifecycle

**Output: ⚠️ Adjust — capture-with-explicit-purge ratified for photo lifecycle; per-context affordance constraints + casino-policy variation flagged for Gate 4.**

### Findings (V1 UX lead, V2 Failure annotation, V4 Cultural-sensitivity reviewing)

**Photo lifecycle ratification (decision flag #4).** Owner-ratified capture-with-explicit-purge:

- Photo persists on Player record as blobId in `playerPhotos` IDB store (per PIO-G1 §Q3 recommendation).
- User can delete photo per record at any time via Player Profile surface (red line #4 reversibility).
- No system retention beyond user-set lifetime (no auto-purge cadence; manual only).
- No encryption-at-rest baseline for v1 (out of scope; can be added in Phase 2 if device-sharing pattern changes).
- Capture is web-native via `<input type="file" capture="environment">` — supported on Samsung Galaxy A22 target per `chris-live-player`.

**Three-context situational walk:**

| Context | Persona | Time budget | Photo affordance permitted |
|---------|---------|-------------|----------------------------|
| Session-start cold-read | `cold-read-chris` | 5-15 min, multi-seat | Photo capture available per seat in PlayerEditorView extensions; capture is single-tap from seat-edit row; AP-PIO-03 refuses auto-capture (button must be user-initiated). |
| Mid-session quick observation update | `between-hands-chris` | ≤30s | Photo capture **PERMITTED but not recommended** at this time budget; existing photo display (if Player record has one) shown as inline thumbnail to confirm sighting. New capture defers to post-session. |
| Post-session sighting-log review | `post-session-chris` | 5-30 min, depth-over-speed | Full Player Profile surface; photo display + delete affordance + (optional) photo replacement. Sighting-log read access full. Photo delete is single-tap with confirm-modal (red line #4 reversibility). |

**Casino photo policy variation (V2 Failure binding constraint):** Casinos vary on photo policy — some prohibit photos in the gaming area entirely, some prohibit photos of other patrons, some allow with consent. The capture affordance MUST be unambiguous (clear photo button, no auto-capture) so the user retains policy responsibility. AP-PIO-03 (Stage E) operationalizes this. Gate 4 Settings spec adds a master "photo capture enabled" toggle so users in always-prohibited venues can disable the affordance entirely.

**Photo display in cold-read flow (V1 UX, high-utility pattern):** When cold-read-chris is filling seats and a partial-match search returns candidates, candidates with saved photos render the photo as the primary recognition affordance (face-recognition is faster than text-recognition under cold-read time pressure). This is the primary identification-utility argument for persisting photos at all.

### Cross-voice resolution

V4 (Cultural-sensitivity) raised: photo capture of strangers in public venues raises consent questions even when policy permits. Per binding identification-utility stance + owner-is-sole-user, photos are private to the owner's device + IDB. The autonomy red lines (#1 opt-in for the system; #4 reversibility per record) handle the user-side ethics. Casino policy + per-subject consent is the user's responsibility — system surfaces the affordance unambiguously and the user decides per capture event. V4 verdict: pattern-quality concern noted, NON-BLOCKING.

V2 (Failure) flagged: photo-replacement vs photo-history. v1 ships photo-replacement (one current photo per record; new capture overwrites). Photo-history (multiple photos with timestamps) is a Gate 4 Phase 2 concern. Acceptable for v1.

### Recommended follow-ups

- [ ] **Gate 3 (BLOCKING):** photo storage spec — blobId schema in `playerPhotos` IDB store; index on `playerId`; lifecycle hooks (onDelete cascades from Player record).
- [ ] **Gate 4 surface specs:** PlayerEditorView extension for in-line photo capture button; Player Profile surface with photo display + delete affordance (single-tap with confirm modal).
- [ ] **Gate 4 Settings binding:** master "photo capture enabled" toggle (default ON; disable hides all photo capture buttons app-wide for users in always-prohibited venues).
- [ ] **Gate 4 cold-read flow:** partial-match candidate cards render saved photo as primary recognition affordance when present (high-utility identification path per V1).

---

## Stage D — Cross-product / cross-surface (LARGEST stage)

**Output: ⚠️ Coordinate — PEO-reuse stress-test confirms 60/30/10 inventory; sighting-log parallel-store ratified; ethnicity migration scoped; cross-venue deferred; 9 red lines walk passes.**

### PEO-reuse boundary stress-test (decision flag #3, V3 Data-modeling lead, V4 Cultural-sensitivity reviewing)

Walking PIO-G1's 12-row PEO Reuse Inventory entry-by-entry. V4 raises pattern-quality concerns inline.

| Row | Reuse status | V4 concern | Verdict |
|-----|--------------|-----------|---------|
| Fullscreen entry routes (PlayerEditorView + PlayerPickerView) | ✅ As-is | None | ✅ Reusable as-is |
| Avatar rendering (AvatarRenderer + PlayerAvatar + AvatarMonogram) | ✅ As-is + add layers | Wardrobe layers may need cultural-context tooltips so user picking from palette knows what they represent (e.g., "kufi cap" vs generic "hat"). NON-BLOCKING. | ✅ Reusable + Gate 4 adds asset metadata for tooltips |
| Avatar feature picker UI (AvatarFeatureBuilder.jsx) | ✅ Extend (add 4 category rows) | Same — palette item labels matter for user comprehension. NON-BLOCKING. | ✅ Extends additively |
| Avatar constants + palettes (avatarFeatureConstants.js + assets) | ✅ Extend (add wardrobe/jewelry/age/logo categories) | **Pattern-quality concern (NOT blocking):** `ageEstimate` ranges (e.g., "20s / 30s / 40s") vs single values (e.g., "25"). Ranges are more honest for visual estimation; single values create false precision. Recommend ranges for Gate 3 spec. | ✅ Extends + Gate 3 picks range-vs-value |
| Draft persistence (playerDrafts + usePlayerDraft) | ✅ As-is | None | ✅ Reusable as-is |
| Atomic player commit (commitDraft + I-PEO-1 invariant) | ✅ As-is | None — invariant covers expanded record naturally | ✅ Reusable as-is |
| Retroactive linking (linkPlayerToPriorSeatHands + I-PEO-2/3/4 invariants) | ✅ As-is | None | ✅ Reusable as-is |
| Search ranking (scorePlayerMatch in usePlayerFiltering.js) | ✅ Extend (`stabilityWeights` parameter) | None — extension is parameter-extensible per existing pattern | ✅ Extends additively |
| Player schema (playersStorage.js + database.js v22) | 🟡 Extend (new fields) | Ethnicity flat-string → tag array migration: legacy reads as 1-element array. PIO-G1 §Q2 raised the question of one-time prompt vs silent migration with re-tag affordance. **Recommend silent migration + re-tag affordance in Gate 4 Player Profile surface** (less friction; user re-tags when they next edit a player). NON-BLOCKING. | ✅ Extends + Gate 4 carry-forward for re-tag UI |
| Sighting log store (NEW, sightingLogsStore.js) | 🔴 Net-new | None at structural level — schema is per-instance observation data, no demographic-classification baked into schema | ✅ Net-new with EAL precedent (parallel-store pattern) |
| Camera capture component (NEW, CameraCapture.jsx) | 🔴 Net-new | Casino-policy + per-subject-consent (handled in Stage C); structural OK | ✅ Net-new |
| Player Profile / Sighting History surface (NEW, TBD Gate 4) | 🔴 Net-new | Surface MUST clearly show edit affordances for ALL fields (delete photo, re-tag ethnicity, edit sighting observations) so user retains full control per red line #4. | ✅ Net-new + Gate 4 design constraint |

**Stress-test verdict:** PIO-G1's 60/30/10 split holds. 7 rows ✅ as-is, 5 rows extends additively (4 of these are extensions; 1 is the schema migration), 3 rows net-new. Inventory integrity confirmed.

### Sighting-log schema parallel-store decision (V3 Data-modeling lead)

Per PIO-G1 §Discovery 2 + table-build Q6, **parallel store** recommendation: PIO authors `src/utils/persistence/sightingLogsStore.js` mirroring EAL's `anchorObservationsStore.js` pattern. Per-seat-per-session observations (table-build PM-12) write into the clothing-observation store; sighting log accumulates the cross-session per-player record by aggregating reads from the clothing-observation store + manual adds from the Player Profile surface.

V3 confirms: parallel keeps responsibility-clean (per-session observations stay in the per-session-keyed store; cross-session aggregation lives in sighting-log). Sharing EAL's store with a discriminator field would conflate observation domains and complicate EAL's lifecycle (anchor retirement is anchor-scope; sighting-log entries don't retire). **Parallel ratified.**

Schema spec (record shape + indexes + write paths + aggregation logic) deferred to Gate 3 SCF-G3-equivalent carry-forward (PIO-G3-SLOG below).

### Cross-venue future-proofing (V3 lead, deferred)

PIO-G1 deferred cross-venue / cross-operator scope ("Sighting log spans sessions in the same physical venue"). PIO-G2 maintains the deferral. Schema spec at Gate 3 should leave a `venueId` field on sighting-log records so cross-venue is graceful future-amendment (not schema break) when owner plays at 2+ venues.

### 9-red-lines per-surface pre-check (V2 cross-stage)

All 9 red lines walked against every proposed PIO surface (table-build entry — INHERITED from table-build Gate 2; PlayerEditorView extensions; Player Profile / Sighting History surface; camera capture modal; Settings photo-toggle):

| Red line | PlayerEditorView ext. | Player Profile / Sighting | Camera modal | Settings toggle |
|----------|----------------------|---------------------------|--------------|-----------------|
| #1 Opt-in | ✅ extends existing opt-in (Settings enables avatar system) | ✅ inherits | ✅ user-initiated capture; no auto-capture (AP-PIO-03) | ✅ master toggle controls capture availability |
| #2 Transparency | ✅ shows full record on edit | ✅ shows sighting-log entries with timestamps | ✅ preview before save | ✅ toggle behavior documented in tooltip |
| #3 Durable overrides | ✅ user edits persist | ✅ delete-photo persists; re-tag persists | N/A | ✅ user-set toggle persists |
| #4 Reversibility | ✅ Settings purge | ✅ per-record delete (photo, sighting, ethnicity tag) | N/A | ✅ |
| #5 No streaks/shame | ✅ no progress indicator on field-completion | ✅ no "X% profile complete" widget; AP-PIO-04 forbids shame-on-misidentification copy | N/A | ✅ |
| #6 Flat access | ✅ no field-gating by user level | ✅ all sighting-log entries visible | N/A | N/A |
| #7 Editor's-note tone | ✅ field labels factual ("Ethnicity (multi-select)") | ✅ "Last seen: 2026-04-22" — never "X sessions since seen — reach out!" | ✅ "Take photo" — factual button label | ✅ |
| #8 No cross-surface contamination | ✅ sighting-log inferences NEVER feed exploit engine (AP-PIO-01) | ✅ Player Profile is review-mode only; never renders on live decision surfaces (AP-PIO-02) | ✅ camera modal is modal scope | ✅ |
| #9 Capture incognito | ✅ existing avatar-features incognito mode applies | ✅ inherits | ✅ photo capture has per-capture skip option (don't save to record); never silent | ✅ |

**No surface fails the 9-red-line walk.** ✅.

### Cross-voice resolution

V4 (Cultural-sensitivity) raised one Phase-2 concern: ethnicity tag taxonomy (which ethnicity values appear in the tag picker dropdown) shapes user-visible categories. Recommend Gate 3 ratifies the initial tag set with owner; tag set is editable by owner anytime per red line #4. NON-BLOCKING for Gate 2.

V2 (Failure) noted: PlayersView absorption per Master Plan §3 (PIO absorbs PlayersView scaling/persistence/PhysicalSection rework). Scaling + persistence are existing patterns; PhysicalSection rework is the only Gate 4 concern. Carry-forward to PIO-G4-PVA below.

### Recommended follow-ups

- [ ] **Gate 3 (BLOCKING):** sighting-log schema spec (record shape + indexes + write paths + cross-session aggregation; `venueId` field for future cross-venue).
- [ ] **Gate 3:** ethnicity tag set ratification with owner (initial values + editability affordance in Gate 4 surface).
- [ ] **Gate 4:** PlayersView absorption — PhysicalSection rework spec; scaling + persistence patterns inherited.
- [ ] **Gate 4:** Player Profile surface adds re-tag-ethnicity affordance for migrated legacy values.
- [ ] **Gate 4:** Settings master "photo capture enabled" toggle (default ON).

---

## Stage E — Heuristic + AP-PIO inline catalog + stability formula

**Output: ⚠️ Adjust — AP-PIO-01..05 enumerated inline (audit-doc-only tier per owner decision flag); Bayesian-Beta stability formula recommended; ML06 + N05 + PLT01 carry-forwards named.**

### AP-PIO refusal catalog (inline; audit-doc-only tier)

Per owner decision flag #2, AP-PIO refusals enumerated inline in this audit; no companion `copy-discipline.md` or `anti-patterns.md` files. Per-refusal field structure mirrors PRF/SCF (Refused / Why / Red-line / Allowed-alternative).

**AP-PIO-01 — Demographic data fed to exploit engine.**
- **Refused.** Sighting-log entries, ethnicity tags, age estimates, wardrobe/jewelry/logo features MUST NOT be passed as inputs to the exploit engine (`src/utils/exploitEngine/*`). The engine consumes hand-history derived stats (VPIP, PFR, AF, etc.) and observed bet-sizing patterns — never demographic attributes.
- **Why.** Demographic data is for hero recognition memory, not for decision modeling. Routing demographic inputs to the engine would create a population-correlation that is poker-irrelevant and ethically charged. PIO-G1 §Q5 explicitly anchored this stance.
- **Red line violated:** #8 (no cross-surface contamination — recognition data stays in recognition surfaces).
- **Allowed alternative.** Engine consumes only hand-history-derived signals. Player record demographic fields are read by recognition surfaces (search ranking, Player Profile, sighting-log views) and never touched by `exploitEngine/`, `rangeEngine/`, or `heroAnalysis/`.

**AP-PIO-02 — Cross-surface contamination of sighting-log into live surfaces.**
- **Refused.** Sighting-log entries, photo display, ethnicity tags, wardrobe/jewelry/age/logo features MUST NOT render on OnlineView seats, sidebar HUD, TableView seat chrome, TournamentView, or any live-decision surface. Player record reads on live surfaces are restricted to name + nickname + minimal avatar (existing PEO behavior).
- **Why.** Mirrors AP-SCF-02 / AP-EAL-07 (live-surface segregation). Recognition data is review-mode and entry-mode data; live decisions consume hand-history-derived signals + name/avatar only.
- **Red line violated:** #8.
- **Allowed alternative.** Read paths for full Player record fields whitelisted to: PlayerEditorView, PlayerPickerView, Player Profile / Sighting History surface, table-build entry (cold-read flow only). Live surfaces use the existing PEO read path (name + avatar minimal).

**AP-PIO-03 — Auto-photo-capture without explicit user initiation.**
- **Refused.** Photo capture button MUST be user-initiated per capture event. No auto-capture on detection events, no batch-capture across multiple players in one tap, no background capture using device camera without explicit user trigger.
- **Why.** Casino photo policy varies; the user retains responsibility for per-capture compliance (consent + venue rules). Auto-capture would shift responsibility to the system and create violation risk. Red line #1 (opt-in) at the per-event scope.
- **Red line violated:** #1 (opt-in — at per-event scope, not just per-app scope).
- **Allowed alternative.** Single-tap capture button per PlayerEditorView seat-edit row. Settings master "photo capture enabled" toggle for users in always-prohibited venues. Photo preview before save (red line #2 transparency).

**AP-PIO-04 — Shame framing on misidentification.**
- **Refused.** When PIO's recognition disambiguation flow (PM-15) suggests a candidate match and the user picks "no match — create new record," the surface MUST NOT use copy that shames the user for the mismatch. Forbidden copy: "Are you sure?", "We're confident this is X", "Why no match?", "This may be incorrect."
- **Why.** Misidentification is a normal state — the system's recognition is always probabilistic, not authoritative. Shame framing would erode user autonomy + trust. Red line #5 (no shame).
- **Red line violated:** #5.
- **Allowed alternative.** Factual neutral copy: "Create new record" / "Match X" — no judgment. The disambiguation flow shows candidate-match confidence (e.g., "75% match score") so the user has full transparency without shame framing.

**AP-PIO-05 — Demographic-targeted recommendations.**
- **Refused.** Recommendation surfaces (exploit briefings, lesson assignments, drill scheduler outputs, refresher card filters) MUST NOT use Player demographic data (ethnicity, age, wardrobe) as filter or weighting inputs. "Players like X get this recommendation" framing refused. Recommendations are based on hand-history-derived signals only.
- **Why.** Mirrors AP-PIO-01 at the recommendation surface layer. Demographic-targeted recommendations are population-correlation-driven, not poker-relevant. They also create the "users like you" social-proof framing AP-SCF-06 / AP-PRF refuses elsewhere.
- **Red line violated:** #8 + #5 (engagement-pressure via social-proof framing).
- **Allowed alternative.** Recommendations grounded in hand-history-derived per-player stats (VPIP, PFR, observed bet-sizing patterns) + range-derived advice. Demographic data is purely for hero recognition memory.

**EAL-inherited transitively (cited but not re-authored):** AP-01..09 from `docs/projects/exploit-anchor-library/anti-patterns.md`. PIO surfaces that reuse EAL infrastructure (sighting-log store mirrors EAL's anchorObservationsStore pattern; recognition disambiguation may reuse EAL's confidence-display primitives) inherit the parent project's anti-patterns.

### Stability formula 3-formula walk (V3 Data-modeling lead)

Per PIO-G1 §Q1, three candidate formulas for per-feature stability score:

| Formula | Pros | Cons | V3 verdict |
|---------|------|------|-----------|
| **Simple frequency** `count(observed) / count(sessions)` | Cheapest; transparent; easy to explain in tooltip | No prior; no MoE; "1/1 = 100% stable" overstates from single observation; equal weight to all sessions regardless of recency | Insufficient — overconfident on small samples |
| **EWMA** (exponentially weighted moving average; recent observations weighted higher) | Recency-weighted (clothing observations decay faster than wardrobe trends); cheap to compute incrementally | Lambda parameter is arbitrary (decay rate not principled); no MoE; single-feature only (doesn't borrow strength across related features) | Better than simple but still no MoE |
| **Bayesian-Beta** (Beta posterior with prior; renders mean + credible interval) | Principled MoE-style confidence (mirrors villain-side `weaknessDetector.js`); prior handles n=0 case gracefully; aligns with PIO-G1 §Q1 recommendation | Higher implementation cost (Beta math, prior-tuning) | **RECOMMENDED for Gate 3 spec.** |

**V3 recommendation: Bayesian-Beta** for Gate 3 spec. Mirrors villain-side convention (consistency across system); renders sample-size-aware confidence at the user-visible level; simple-frequency + EWMA carried as Gate 3 amendment options if Bayesian-Beta proves over-complex during spec authoring.

### Heuristic walk

- **Nielsen N03 (undo).** Photo delete + ethnicity tag re-tag + sighting-log entry edit all reversible (per-record + Settings purge). ✅
- **Nielsen N05 (error prevention).** Photo delete uses confirm modal (irreversible — actual blob delete); ethnicity tag changes use save-on-blur (no confirm; reversible). ⚠️ Adjust: confirm-on-photo-delete spec for Gate 4.
- **Mobile-Landscape ML04 (scale interaction).** Player Profile surface at 1600×720 reference viewport — Gate 4 surface spec respects scale math.
- **Mobile-Landscape ML06 (touch target ≥44).** Photo capture button + delete button + tag-edit button sized at Gate 4. ⚠️ Adjust: ML06 binding constraint per surface spec.
- **Poker-Live-Table PLT (glanceability, state-aware primary).** PIO is NOT a live-decision surface; PLT heuristics weaker. Cold-read entry surface (table-build) inherited PLT01 from table-build Gate 2; sighting log is post-session host (no PLT01 stress).
- **9 autonomy red lines.** Walked in Stage D table; all surfaces pass. ✅

### Cross-voice resolution

V4 (Cultural-sensitivity) noted: Stage E AP-PIO catalog correctly refuses demographic-targeted recommendations + cross-surface contamination + auto-photo-capture, while NOT refusing demographic categories themselves. Aligned with owner's binding identification-utility-over-cultural-sensitivity stance. ✅.

V2 (Failure) confirmed audit-doc-only tier is sufficient given the binding stance constrains the refusal scope. CI-grep tier would over-engineer for the narrow refusals here. ✅.

### Recommended follow-ups

- [ ] **Gate 3 (BLOCKING):** stability formula spec (Bayesian-Beta recommended; alternatives carried).
- [ ] **Gate 4 confirm-on-photo-delete:** N05 binding for Player Profile surface delete affordance.
- [ ] **Gate 4 ML06 binding:** Player Profile + camera modal touch-targets ≥44 DOM-px at 1600×720 reference scale.
- [ ] **Gate 4:** Settings master "photo capture enabled" toggle copy walked through V2 to ensure no shame framing on disable.

---

## Overall verdict

**YELLOW.** Three structural risks (sighting-log schema parallel-store ratification, photo lifecycle Gate 4 surface design, PEO-reuse boundaries with 4 net-new categories) are tractable in Gate 3/4. AP-PIO catalog at audit-doc-only tier with binding identification-utility-over-cultural-sensitivity stance documented. Photo lifecycle ratified (capture-with-explicit-purge). Stability formula recommended (Bayesian-Beta).

**Per-stage verdict table:**

| Stage | Voice lead(s) | Verdict | Closure |
|-------|--------------|---------|---------|
| A — Persona sufficiency | V1 | ✅ Match | Inherited from PIO-G1 + table-build Gate 2; no new authoring |
| B — JTBD coverage | V1 + V3 | ✅ Match | PM-13/14/15 + PM-10/11/12 sub-jobs already authored across PIO-G1 + table-build |
| C — Situational stress + photo lifecycle | V1 + V2 | ⚠️ Adjust | Capture-with-explicit-purge ratified; per-context affordance + casino-policy variation Gate 4 carry-forwards |
| D — Cross-product / cross-surface | V3 + V4 | ⚠️ Coordinate | PEO-reuse 60/30/10 confirmed; sighting-log parallel-store ratified; ethnicity migration Gate 4 carry-forward; cross-venue deferred |
| E — Heuristic + AP-PIO + stability formula | V2 + V3 + V4 | ⚠️ Adjust | AP-PIO-01..05 inline; Bayesian-Beta stability formula recommended; ML06 + N05 carry-forwards |

Gate 3 (Research) is unblocked. Gate 4 (Design) blocked on Gate 3 schema spec deliverables.

---

## Gate 3 carry-forwards (BLOCKING Gate 4)

| ID | Deliverable | Notes |
|---|-------------|-------|
| **PIO-G3-SLOG** | Sighting-log schema spec (parallel-store record shape + indexes + write paths + cross-session aggregation logic; `venueId` field for future cross-venue) | Mirrors EAL `anchorObservationsStore.js` pattern |
| **PIO-G3-STAB** | Stability formula spec (Bayesian-Beta recommended; simple-frequency + EWMA as amendment options) | Per PIO-G1 §Q1 |
| **PIO-G3-PHOTO** | Photo storage spec (blobId in `playerPhotos` IDB store; index on `playerId`; lifecycle hooks; cascade-on-delete from Player record) | Per PIO-G1 §Q3 + Stage C decision |
| **PIO-G3-PALETTE** | Wardrobe / jewelry / age / logo asset palettes ratification with owner; tag set values for ethnicity (initial + editability affordance) | Stage D V4 quality concerns folded in |
| **PIO-G3-MIG** | IDB v22 migration spec (Player schema extensions: sightingObservations[], stabilityScore, confidenceFlags, photo, ethnicityTags; ethnicity flat-string → tag array migration with silent-migration + re-tag affordance) | Inherits dynamic-max version pattern |

---

## Gate 4 carry-forwards (named at this audit; ratified at Gate 3)

| ID | Deliverable | Blocks |
|---|-------------|--------|
| **PIO-G4-S1** | `docs/design/surfaces/player-profile.md` — Player Profile / Sighting History surface (post-session host); photo display + delete affordance + sighting-log read view + re-tag affordance | All other Gate 4 items |
| **PIO-G4-S2** | `docs/design/surfaces/camera-capture-modal.md` (or embedded in player-editor.md) — capture component spec | — |
| **PIO-G4-PEX** | PlayerEditorView extensions — 4 new avatar-feature category rows (wardrobe/jewelry/age/logo) + inline photo capture button | — |
| **PIO-G4-PVA** | PlayersView absorption — PhysicalSection rework spec; scaling + persistence inherited per Master Plan §3 | — |
| **PIO-G4-DISAMB** | Recognition disambiguation flow design (PM-15 host) — candidate match cards + confidence display + AP-PIO-04 neutral copy | — |
| **PIO-G4-SET** | Settings master "photo capture enabled" toggle (default ON; disable hides all photo capture buttons app-wide) | — |
| **PIO-G4-MIG** | IDB migration script per PIO-G3-MIG | Gate 5 implementation |

No Gate 5 items scoped this session.

---

## Open questions

Inherited from PIO-G1 §Open questions, narrowed by this Gate 2:

**Closed by this audit:**
- Q3 (photo storage location) — blobId in `playerPhotos` store ratified (Stage C + Stage D PIO-G3-PHOTO).
- Q5 (anti-bias check) — CLOSED via owner's binding identification-utility-over-cultural-sensitivity stance + AP-PIO-01 demographic-data-out-of-engine refusal.
- Q7 (privacy / autonomy on photos and demographic tags) — CLOSED at v1: capture-with-explicit-purge per record (red line #4); Settings master toggle for venue-prohibition cases.
- Q8 (cold-read-chris persona ratification) — CLOSED: ratified-as-authored per PIO-G1 recommendation; table-build Gate 2 already validated load-bearing assumptions.

**Deferred to Gate 3 walkthrough:**
- Q1 (stability formula) — Bayesian-Beta recommended; Gate 3 spec ratifies.
- Q2 (ethnicity migration UX) — silent migration + re-tag affordance recommended; Gate 4 PIO-G4-S1 surface authors the affordance.
- Q4 (Gate 4 surface count) — recommend two distinct surfaces (table-build entry exists; Player Profile / Sighting History new). Gate 4 spec confirms.
- Q6 (tournament players) — deferred per PIO-G1 recommendation; revisit when tournament play exposes the gap.

---

## Change log

- 2026-05-02 — Created. Gate 2 Blind-Spot Roundtable for Player Identification v2 per Master Plan §A Phase 2 stagger alternation (alternates with SPR-014 SCF-G2). 4 voices integrative pattern (V1 UX / V2 Failure / V3 Data-modeling / V4 Cultural-sensitivity reviewing-only per owner override). Verdict YELLOW. Sighting-log parallel-store decision ratified. Photo lifecycle: capture-with-explicit-purge. AP-PIO lock: audit-doc-only tier with AP-PIO-01..05 enumerated inline (no companion files; narrower scope than SCF-G2's CI-grep tier per binding identification-utility-over-cultural-sensitivity stance). Stability formula: Bayesian-Beta recommended for Gate 3 spec. PEO Reuse Inventory 60/30/10 split confirmed via entry-by-entry stress-test. 5 Gate 3 + 7 Gate 4 carry-forwards enumerated. Audit-only: zero production code changes. SCF Gate 3 (WS-011 Research) is the next natural anchor in Master Plan A/D Phase 2 stagger alternation — D-line first Phase-2 Research gate.
