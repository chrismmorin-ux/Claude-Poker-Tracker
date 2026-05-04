# Player Identification v2 — Anti-pattern catalog (audit-doc-only tier)

**Created:** 2026-05-02 (PIO Gate 4 / WS-007 / SPR-021; cross-references AP-PIO-01..05 enumerated inline at Gate 2 audit doc)
**Status:** Affirmed; cultural-sensitivity-as-reviewing-voice stance binding.
**Tier:** Audit-doc-only (no CI-grep enforcement; lighter than SCF's CD-1..5 + CI-grep tier per Gate 2 §Stage E ratification).

**Sibling docs:**
- [Gate 2 audit — `docs/design/audits/2026-05-02-blindspot-player-identification-v2.md`](../../design/audits/2026-05-02-blindspot-player-identification-v2.md) §Stage E (original AP-PIO enumeration)
- [Gate 4 audit — `docs/design/audits/2026-05-02-gate4-design-player-identification-v2.md`](../../design/audits/2026-05-02-gate4-design-player-identification-v2.md) §AP-PIO walkthrough (5 AP-PIO × 7 PIO-G4-* surfaces)
- Memory: `feedback_pio_identification_utility_first.md` (binding stance — identification utility binds, not cultural-sensitivity veto)

---

## Why this catalog exists at audit-doc-only tier

PIO carries autonomy risks at every recognition surface (sighting log, camera capture, recognition disambiguation, demographic capture). The 9 autonomy red lines on `chris-live-player.md` bind every PIO surface, but red lines are general — PIO-specific failure modes need named refusals.

PIO's anti-pattern catalog is **lighter than SCF's** because:

1. **Identification utility binds** (per `feedback_pio_identification_utility_first.md` memory). Owner stance: *"Cultural sensitivity is secondary to identification. If labeling ethnicity or features within an ethnicity assists with identifying the player, then we are going to use it."* This narrows the refusal scope.
2. **No CI-grep tier needed.** SCF needs CI-lint enforcement of forbidden strings ("score" / "grade" / "did you do" / "streak") because hero-leak surfaces have many entry points + content-build CI risk. PIO's surface count is smaller (7 PIO-G4-*); audit-doc-only enforcement at Gate 4 spec review + Gate 5 PR review suffices.
3. **Refusals are scoped narrowly.** AP-PIO-01..05 refuse PATTERNS that don't aid identification (auto-photo-capture / cross-surface contamination / tone-deaf framing / silent merge / demographic-targeted recommendations) — NOT demographic categories themselves.

This catalog AFFIRMS the AP-PIO-01..05 enumeration from Gate 2 + extends with binding clarifications from owner stance per memory.

---

## AP-PIO-01 — Sighting-log inference NEVER feeds exploit engine

**Refused.** `sightingLogs` IDB store output (per-feature stability flags, recognition-confidence scores, demographic attributes) MUST NOT feed exploit engine modules (`weaknessDetector.js`, `decisionAccumulator.js`, `gameTreeEvaluator.js`, `villainDecisionModel.js`, `preflopAdvisor.js`, `postflopNarrower.js`). The exploit engine reads only behavioral observations (VPIP, PFR, AF, fold rates from `tendencyMap`); it does NOT read demographic / appearance data.

**Why.** Red line #8 (no cross-surface contamination) is structural: study-mode inference stays in study mode; live surfaces render only behavioral classifier output. Demographic / appearance attributes are identification utility, not decision input. Conflating them risks AP-CD-4 (labels-as-inputs anti-pattern from `copy-discipline.md` §CD-4) — using ethnicity / age / wardrobe as decision inputs is poker-wrong AND autonomy-violating.

**Allowed alternative.** `sightingLogs` reads ONLY from review-mode whitelisted surfaces (PlayerEditorView, PlayerProfileView, table-build CandidateColumn). Recognition-search ranking math (PIO-G4-PVA) uses demographic attributes for IDENTIFICATION (which player is at this seat?); recognition output feeds villain modeling only as `playerId` confirmation, never as demographic-coefficient.

**Cultural-sensitivity binding (per memory).** Demographic capture for identification utility is permitted; demographic capture for recommendation-generation is refused. The line is between "this player is Mike R., who VPIPs 27%" (allowed: identification → behavioral lookup) and "this player is Irish, so adjust tendencies" (refused: demographic → behavioral inference).

---

## AP-PIO-02 — Cross-surface contamination of sighting-log into live surfaces

**Refused.** Sighting log + recognition data + photos MUST NOT render on `OnlineView`, sidebar HUD, `TableView` chrome, `TournamentView`, `ShowdownView`, or any live-decision surface. The `mid-hand-chris` situational persona is excluded from any PIO affordance. SourceUtilPolicy whitelist (Gate 5 CI-grep deliverable) enforces structurally — read paths blacklisted at the source.

**Why.** Red line #8 (no cross-surface contamination — study-mode inference stays in study mode) is non-negotiable. Recognition-search runs at session-start cold-read (review-mode); rendering recognition data during live play creates the bot-judges-me-mid-hand failure mode + breaks the cold-read flow boundary.

**Allowed alternative.** PIO read paths whitelisted to: `PlayerEditorView` (edit-mode), `PlayerProfileView` (PIO-G4-S1), `table-build` (cold-read entry), `PlayersView` (database-browser portion). All review-mode. Live surfaces remain blacklisted regardless of context.

---

## AP-PIO-03 — Auto-photo-capture (no user-initiation)

**Refused.** Photo capture MUST be user-initiated. Camera Capture Modal NEVER auto-launches on session start, on player-create, on disambiguation, on any system event. Always requires explicit user-tap on a visible entry button. Settings master toggle (PIO-G4-SET) is the additional gate for casino venues that prohibit photography.

**Why.** Red line #1 (opt-in enrollment) at the photo-capture grain. Casino venues vary on photo policy (some prohibit entirely; some allow with consent). The capture affordance must be unambiguous — clear photo button, no auto-launch — so the user retains policy responsibility. Gate 2 §C ratification: master Settings toggle for users in always-prohibited venues.

**Allowed alternative.** Camera Capture Modal entry buttons in PlayerEditor (`[ 📷 Add photo ]`) and PlayerProfile (Phase 2+ replace affordance). Settings master toggle gates entry button visibility globally (default ON; OFF for prohibited-venue sessions).

---

## AP-PIO-04 — Tone-deaf framing on misidentification / weak-match surfaces

**Refused.** Recognition disambiguation surfaces MUST NOT use shame / verification-pressure copy. Forbidden patterns: `'are you sure?'`, `'double-check'`, `'don't get this wrong'`, `'verify carefully'`, `'did you mean...'`, `'this might be wrong'`, `'caution: low confidence'`. Any framing that reads as "the system thinks you might mess this up" violates AP-PIO-04.

**Why.** Red line #7 (editor's-note tone — factual statements only). Misidentification is a normal review event; the surface treats it factually, not as user error. Recognition is probabilistic; weak match is a NORMAL OUTCOME, not a verdict.

**Allowed alternative.** Factual labels: `'strong match'` (≥0.7), `'partial match'` (0.4-0.7), `'weak match'` (<0.4), or numeric `'87% match'`. Confidence bar visual treatment per PIO-G4-DISAMB. The user reads the score + decides; no framing nudges them.

---

## AP-PIO-05 — Demographic-targeted recommendation generation

**Refused.** Demographic attributes (ethnicity, age decade, wardrobe / jewelry / logo palettes) MUST NOT drive exploit recommendations OR drill scheduling OR any decision-generating surface output. Demographics are IDENTIFICATION utility — they help the system recognize WHO is at the table; they do NOT generate WHAT to recommend.

**Why.** Conflating demographics with recommendations is the canonical autonomy-failure pattern in poker tracking (and broader). It risks: (a) AP-CD-4 labels-as-inputs (demographic labels as decision inputs is poker-wrong; behavioral observation is the correct input); (b) cultural-sensitivity exposure (recommending differently based on ethnicity is the failure mode external products fail); (c) red line #8 cross-surface contamination (demographics are identification metadata; recommendations are decision-engine output; the two domains must NOT mix).

**Cultural-sensitivity binding (per memory).** Owner stance permits demographic CAPTURE and DISPLAY for identification utility. Owner stance REFUSES demographic-targeted recommendation. The line is structural: demographic data flows into `players` schema + recognition-search ranking math + PlayerProfile rendering. It does NOT flow into `tendencyMap` / `weaknessDetector` / `gameTree` / `preflopAdvisor`.

**Allowed alternative.** Demographic display in identification surfaces (PlayerProfile per-attribute stability section; PlayerEditor edit body; Table-Build CandidateColumn ranking math; PlayersView filter chips). Behavioral recommendations driven by `tendencyMap` only — name-anchored after recognition resolves.

---

## EAL-inherited anti-patterns (transitive)

When PIO surfaces share infrastructure with EAL (notably the `seatClothingObservations` store reuse — PIO-G3-SLOG schema mirrors `anchorObservations` shape), EAL's parent-project anti-patterns apply transitively.

| Inherited ID | Pattern | PIO applicability |
|---|---|---|
| AP-09 (capture framing — "how did this hand go?") | Forbidden framing on capture surfaces | Direct: PIO Camera Capture Modal copy is "Photo ready" / "Tap Accept" — never "How did this player look?" / "Rate this read." |

---

## Cultural-sensitivity binding (memory-affirmed)

Per `feedback_pio_identification_utility_first.md` (2026-05-02):

> Owner stance: *"Cultural sensitivity is secondary to identification. If labeling ethnicity or features within an ethnicity assists with identifying the player, then we are going to use it."*

**Binding for Gate 4 + all future PIO + identification work:**

1. **Identification utility binds.** Recognition-search uses ethnicity, age decade, wardrobe, jewelry, logo, hat as identification inputs. Closed-enum entries that aid identification stay regardless of taxonomy purity preference.

2. **Cultural-sensitivity is a reviewing voice, not a load-bearing veto.** Reviewers may flag taxonomy-quality concerns (e.g., sub-culture collapse, missing regional variants); reviewers do NOT refuse demographic categories as a class.

3. **Refusals stay narrow.** AP-PIO-01..05 refuse patterns that DON'T aid identification (auto-capture / cross-surface contamination / tone-deaf framing / silent merge / demographic-targeted recommendations). Refusals do NOT block demographic data capture or display.

4. **No new red lines blocking demographic data.** Future Gates (4 v2, 5, Phase 2+) MUST NOT propose new red lines blocking demographic categories. Encrypted-at-rest / IDB-validation barriers NOT proposed unless owner explicitly asks.

5. **Stance is PIO-specific.** Does NOT extend to SCF or other features — identification features are the specific class where this binding applies.

---

## Relationship to copy-discipline (lighter for PIO)

PIO does NOT have a separate `copy-discipline.md` file with CD-1..5 + CI-lint forbidden-string list (unlike SCF, which has both). PIO's copy discipline is enforced inline:

- AP-PIO-04 covers tone-deaf framing (the equivalent of SCF's CD-2 self-evaluation refusal at the recognition-confidence surface).
- Other CD-style rules (factual / no-imperative / no-engagement-copy / labels-as-outputs / assumptions-explicit) are inherited from `chris-live-player.md` 9 red lines + general project-wide voice; not formalized at PIO-specific tier.

If PIO surfaces drift into copy-discipline territory at Gate 5+ (e.g., recognition-search results render imperative copy), Gate 6+ may amend this catalog with PIO-CD-1..N rules. Not in v1 scope.

---

## Layered enforcement

- **Anti-patterns** caught at **Gate 4 spec review + Gate 5 PR review** — does the surface concept ship a refused feature? AP-PIO-01..05 walkthrough table in audit doc verifies all surfaces × all APs (35 cells in PIO-G4 audit; all compliant or N/A).
- **No content-build CI** for PIO copy (lighter than SCF's CI-grep tier per Gate 2 §Stage E ratification).
- **Cultural-sensitivity reviewing voice** activates at Gate 2 blind-spot roundtable + Gate 4 spec review + Gate 5 PR review. Voice is advisory; identification utility binds.

---

## Change log

- **2026-05-02 — Created (PIO Gate 4 / WS-007 / SPR-021).** Audit-doc-only tier per Gate 2 §Stage E ratification (lighter than SCF's CI-grep tier). AP-PIO-01..05 affirmed from Gate 2 enumeration. **Cultural-sensitivity binding** explicitly captured per memory `feedback_pio_identification_utility_first.md`: identification utility binds; cultural-sensitivity is a reviewing voice. Refusals stay narrow (5 named anti-patterns refuse patterns that don't aid identification — NOT demographic categories themselves). No new red lines blocking demographic data; no encrypted-at-rest / IDB-validation barriers proposed. Stance is PIO-specific; does NOT extend to SCF or other features.
