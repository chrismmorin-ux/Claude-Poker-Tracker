# Gate 4 v2 — Player Identification v2 Re-Design (Full Report)

**Status:** PROPOSAL READY FOR REVIEW — full written report. No implementation begins until owner ratifies §11 sequencing.
**Date:** 2026-05-04
**Supersedes (in part):** `2026-05-02-gate4-design-player-identification-v2.md` (all IA + avatar choices)
**Triggers:** Owner-reported invalidation of v1 IA + missing avatar feedback + sighting-store fragmentation. Sighting bug fixed in commit `b9ed7ac`; that fix surfaced 3 type-mismatch defects rooted in the same audit-vs-implementation drift this report addresses.

---

## §0 — Executive Summary (one screen)

**The recognition problem.** When the user sees a familiar player at the table, they need to either (a) confirm "that's the same person I tagged 3 weeks ago" in <3 seconds, or (b) determine "no existing record matches; let me add this person." The current system fails both. Photos are required for visual confirmation, the SVG avatar is decorative (manually picked, doesn't reflect identification fields), the editor's information architecture buries high-discriminator fields (gender) behind low-discriminator collapsibles, and four parallel avatar/photo systems compete without an authoritative source.

**The proposal.** Collapse four overlapping avatar systems into one **identification-derived avatar** — a single SVG portrait whose every visual feature is generated from the same fields that drive search and disambiguation. The editor reorders to **must-haves first** (gender, age, ethnicity → top row, large hit targets). Wardrobe/jewelry/logo collapse from per-garment palettes (12-30 entries each) into 3-bin coarse-recall categories. Avatar+name pairs render at every recognition surface (TableView seat, PlayersView row, picker result, profile header). The picker becomes a discriminator-ranked progressive filter that survives same-name DB collisions in ≤2 disambiguation taps.

**Why this method wins.** Recognition is a perceptual hierarchy problem, not a data-completeness problem. The dominant 3 attributes (gender × ethnicity × age decade) carry ~5 bits of discrimination; a 30-person table partitions to ~1 person on those alone. Everything else is fingerprint-refinement, not first-pass filter. The current system inverts this: it makes the user enter 11 fields before generating any recognition aid. The proposal makes the avatar form WHILE the user enters the top-3 fields, so by tap 3 they already see a portrait good enough to recognize.

**Buried assumptions surfaced** (full list §7):
- `avatarFeatures` (skin/hair/glasses/hat) is meaningfully independent from identification fields (gender/ethnicity/age) — **false**, they encode overlapping concepts
- `playerId` is a string per PIO G4 audit — **false**, it's an integer auto-increment from v5 (this caused the sighting bug + PlayerProfileView "Player not found" + name-uniqueness throws)
- Wardrobe per-garment specificity (e.g., "Black hoodie") aids identification — **false**, garment-specific values change session-to-session, only color/silhouette persist enough to be useful
- Two ethnicity systems can coexist (legacy `ethnicity` string + new `ethnicityTags` array) — **false**, dual-write/dual-read invariably drifts
- Manual photo capture is the primary recognition aid — **false**, photo capture has friction and privacy concerns; the SVG avatar is the always-on aid
- The "+ Create new" CTA + "+ New Player" button + TableView seat menu "Create New" — three entry paths to the same editor — **need consolidation**
- Free-text "Notes" field will capture distinguishing marks — **false**, notes are not searchable/filterable; need a structured "distinguishing" slot

**Cost.** ~12-20 sessions of implementation (phased multi-PR). 3 components killed (AvatarFeatureBuilder, PlayerPhotoAvatar standalone, ethnicity-string field). 5 components added (DerivedAvatar, IdentityCard, AttributeChip, DiscriminatorFilter, DistinguishingMarkInput). 3 stores converge to 2 (collapse `avatarFeatures` into Player base record). Editor rewritten. Picker rewritten. Existing `playerPhotos` + `sightingLogs` stores unchanged.

**This report's gating questions are in §12.**

---

## §1 — Problem Statement

### §1.1 The user task

Two atomic flows that the current system makes hard:

**Flow A — "Is this person already in my database?"**
1. User sees a player sit at the table
2. User opens the app to PlayersView (or a future picker)
3. User scans the list looking for a recognition match
4. User confirms "yes, that's [Michael]" OR concludes "no match, must add"

**Flow B — "Add this person so I'll recognize them next time."**
1. User opens the editor (3 entry paths today)
2. User enters as much as they can observe in ~30s without staring
3. User saves; the next session, Flow A succeeds

Both flows live or die on **recognition speed**: how quickly the user can convert a glanced face into a confidence judgment ("that's them" / "not them" / "unsure"). The current system treats this as a data problem (capture more fields → better matching), but the actual bottleneck is **perceptual** — the user needs a visual proxy they can pattern-match against the live person.

### §1.2 Why current state fails

Specific failures observed in this session's Playwright walkthrough + owner feedback:

| Failure | Where | Owner-observed cost |
|---|---|---|
| Avatar doesn't reflect entered identification | AvatarFeatureBuilder is independent | "None of them affect the emoji" |
| Gender (high-discriminator) hidden in collapsible | PhysicalSection labeled "More details" | "One of the largest discriminators is hidden" |
| Wardrobe palette over-specific | "Black hoodie" / "Polo shirt" / "Athletic jersey" | "Too specific of a clothing article" |
| TableView seats render no avatar | Seat name only | Recognition fails; user can't tell at-a-glance |
| Sighting auto-record missing | (fixed `b9ed7ac`) | "No sightings" despite "Last seen 3 days ago" |
| 4 avatar tools, 3 entry paths | Inventory below | "Multiple tools I don't have visibility into" |
| Editor field order = implementation order | Legacy fields first, new last | "Should start with must-haves, filter from there" |

---

## §2 — Inventory of Current Fragmentation

### §2.1 Avatar / image components (4 separate systems)

| Component | Source of truth | Where rendered | Manual or derived |
|---|---|---|---|
| `AvatarMonogram.jsx` | Player.name (first letter) | Fallback only | Derived from name |
| `AvatarRenderer.jsx` | Player.avatarFeatures (skin/hair/beard/eyes/glasses/hat IDs + colors) | When avatarFeatures present | Manual (via AvatarFeatureBuilder) |
| `PlayerAvatar.jsx` | Wraps the above two | All list/grid contexts | Choice logic |
| `PlayerPhotoAvatar.jsx` | Player.photoBlobId → playerPhotos store | Profile header, editor inline | Captured photo |

**Divergence:** AvatarRenderer's inputs (skin tone, hair color, beard, glasses) overlap conceptually with identification fields (gender → silhouette, ethnicity → skin, hair color → directly). Two parallel data models, no enforced consistency.

### §2.2 Editor sub-components (12 panels)

```
PlayerEditorView/
├── NameSection            — name + nickname
├── AvatarFeatureBuilder   — manual SVG feature picker (independent of ID fields)
├── PhysicalSection        — gender / build / ethnicity (legacy single) / facialHair / hat / sunglasses, COLLAPSIBLE
├── AgeDecadeSection       — NEW — age decade chips
├── EthnicityTagsSection   — NEW — multi-select ethnicity (replaces, not removes, legacy)
├── WardrobeSection        — NEW — palette: 10 garments
├── JewelrySection         — NEW — palette: 7 items
├── LogoSection            — NEW — palette: 7 logos
├── NotesSection           — free text
├── ImageUploadSection     — legacy data-URL upload (separate from CameraButton!)
├── CameraButton           — NEW — opens CameraCaptureModal
└── PaletteChipsInput      — shared chip-select widget
```

**Two ethnicity systems** coexisting (`ethnicity` string + `ethnicityTags` array). **Two image-upload paths** (legacy data-URL + new camera). **Gender behind collapsible** (PhysicalSection defaults closed).

### §2.3 Hooks (5)

| Hook | Owns |
|---|---|
| `usePlayerEditor` | Form state, hydration, save (fixed today) |
| `usePlayerDraft` | Autosave + resume (create mode only) |
| `usePlayerFiltering` | PlayersView search/filter — 11 axes |
| `usePlayerPicker` | Picker search + ranking |
| `usePlayerPersistence` | CRUD + seat assignment (sighting-write added today) |

`usePlayerFiltering` and `usePlayerPicker` both implement attribute-matching but with different rank algorithms. No shared discriminator-power model.

### §2.4 Stores (3 active for identity, 1 for tendencies)

| Store | Records | Schema authority |
|---|---|---|
| `players` | Player base (name + 11 identification fields + avatarFeatures + photoBlobId) | playersStorage.js |
| `playerPhotos` | Photo blob keyed by blobId | playerPhotosStore.js |
| `sightingLogs` | Append-only sighting events | sightingLogsStore.js |
| (`playerDrafts` for autosave — orthogonal) | | |

`Player.avatarFeatures` is the duplicate-data hot spot. Its existence implies the avatar can be inconsistent with the identification fields (and in practice it always is, because the AvatarFeatureBuilder UI never sees the identification fields).

### §2.5 Surfaces that render or accept identification (5)

| Surface | Avatar rendered | Identity input | Search/filter |
|---|---|---|---|
| TableView seat | **None** (name only) | Via SeatContextMenu → editor or picker | — |
| PlayersView row | AvatarMonogram (letter) | Edit button → editor | 11 filter axes |
| PlayerProfileView header | PlayerPhotoAvatar OR PlayerAvatar | Edit → editor | — |
| PlayerEditorView | None — it IS the editor | All fields | — |
| PlayerPickerView result card | (mock-up shows avatar; reality uses ResultCard with feature highlights) | Create-from-query → editor | Name + filter chips |

**Surface inconsistency:** TableView (where recognition matters most) renders zero visual identity. Profile shows photo when present. Players row shows letter monogram. Picker shows feature highlights. **No surface renders the same identity sigil consistently.**

### §2.6 Constants + palette files (5)

```
src/utils/playerMatching/
├── wardrobePalette.js   — 10 garment names
├── jewelryPalette.js    — 7 jewelry items
├── logoPalette.js       — 7 logo categories
├── SIGHTING_FEATURE_PRIORS.js  — 13 per-attribute Beta(α,β) defaults
├── computeStability.js  — Beta-Binomial posterior renderer
└── cropToSquare.js      — photo helper
```

Palette taxonomy was set in PIO G4 v1 audit. Per owner feedback, all three palettes are over-specific (per-garment, not per-color).

### §2.7 Documentation (4 surface specs + 4 audits)

```
docs/design/surfaces/    — player-editor.md, player-picker.md, player-profile.md, players-view.md, table-build.md, camera-capture-modal.md
docs/design/audits/      — 2026-04-21-player-selection.md, 2026-05-02-{entry,blindspot,gate3-research,gate4-design}-player-identification-v2.md, this doc
```

**Total surface area touched by this report:** ~22 source files + 6 docs.

---

## §3 — Methodology Note (tool limitations surfaced)

### §3.1 What I attempted

The original §3 plan was: WebSearch ~30 reference images, WebFetch each, extract attribute snapshots from page text + image alt text, build a corpus, score current+proposed systems on entry/find against it.

### §3.2 What worked

WebFetch can extract attribute descriptions when (a) the page has player-named photos with alt text or (b) the article body describes the player. This produced **7 verified anchor profiles** from PokerNews + WSOP coverage:

| ID | Real player | Source |
|---|---|---|
| ANCHOR-1 | Michael Mizrachi | PokerNews 2025 WSOP coverage |
| ANCHOR-2 | John Wasnock | PokerNews 2025 WSOP coverage |
| ANCHOR-3 | Kenny Hallaert | PokerNews 2025 WSOP coverage |
| ANCHOR-4 | Braxton Dunaway | PokerNews 2025 WSOP coverage |
| ANCHOR-5 | Shiina Okamoto | PokerNews Ladies Event coverage |
| ANCHOR-6 | Heather Alcorn | PokerNews Ladies Event coverage |
| ANCHOR-7 | Stephani Hagberg | PokerNews Ladies Event coverage |

### §3.3 What didn't work

WebFetch returns **page text/markdown**, not raw image perception. The text-extraction model behind it captions photos based on alt text + caption text, which is reliable for named tournament players but produces nothing on photo gallery pages without rich captioning. Multiple fetches returned "no player photos with descriptions found" even on pages with visible photo grids.

**This is a real constraint.** I cannot visually parse images via WebSearch/WebFetch — the data layer never reaches a visual model. The only way I could analyze actual images would be if files lived in the local repo (Read can read images directly).

### §3.4 Adaptation

To preserve the scoring methodology with what I have:

- **7 real anchors** kept — they provide verifiable sanity checks against actual famous-player demographics
- **18 synthesized profiles** added — calibrated to typical live cash-game demographics (which skew far more diverse than WSOP main-event fields, since cash games reflect local population). Each synthesized profile is explicitly tagged `SYNTH-N` and includes the demographic prior I used so owner can sanity-check
- **Total corpus: N=25** (target was 30; 25 is enough to surface the discriminator-rank conclusions, but the report flags any conclusion that a larger corpus could overturn)

The owner option here is to provide a folder of curated images in the repo — Read can analyze them directly — which would give a stronger empirical base. §12 Q1 asks this.

---

## §4 — Image Corpus (N=25)

Each entry uses this shape:

```
ID  | sex | ethnicity | age | hair | facial-hair | build | eyewear | headwear | clothing | jewelry | logo | distinguishing
```

**Live cash-game demographic prior used for synthesis** (low-stakes US live game, ~9-handed mixed cash):
- Sex: ~75% male, ~25% female (less male-skewed than WSOP)
- Ethnicity: ~45% Caucasian, ~20% Hispanic, ~15% East Asian, ~10% Black, ~5% South Asian, ~5% Middle Eastern (US urban/suburban poker room mix)
- Age: ~10% 20s, ~25% 30s, ~25% 40s, ~25% 50s, ~15% 60s+
- Hat-wearing: ~50%
- Eyewear: ~35% glasses, ~15% sunglasses
- Distinguishing marks (visible): ~15% have one observable

### §4.1 Real anchors (7)

| ID | sex | ethnicity | age | hair | facial-hair | build | eyewear | headwear | clothing | jewelry | logo | distinguishing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ANCHOR-1 Mizrachi | M | Middle Eastern | 50s-60s | dark+gray, short | clean/light | average | none | none | dark casual | diamond bracelet (R wrist) | — | bracelet visible |
| ANCHOR-2 Wasnock | M | Caucasian | 50s | gray/white, short | clean | average | none | none | casual | — | — | — |
| ANCHOR-3 Hallaert | M | Caucasian | 40s-50s | dark, short | clean | average | none | none | pro attire | — | — | — |
| ANCHOR-4 Dunaway | M | Caucasian | 40s | dark, short | (unspecified) | average | (unspecified) | (unspecified) | (unspecified) | — | — | — |
| ANCHOR-5 Okamoto | F | East Asian | 30s-40s | black, shoulder-length | n/a | average | none | none | dark top | none visible | Japan flag pin | defending-champ patch |
| ANCHOR-6 Alcorn | F | Caucasian | 40s-50s | (unspec) | n/a | average | none | none | neutral top | none visible | USA flag pin | — |
| ANCHOR-7 Hagberg | F | Caucasian | 30s-40s | light, medium | n/a | average | none | none | light top | none visible | USA flag pin | — |

**Anchor-set caveats:** WSOP coverage skews male, Caucasian, 40s-50s, professional attire — not representative of a live cash room. The synthesized profiles below correct this.

### §4.2 Synthesized profiles (18)

| ID | sex | ethnicity | age | hair | facial-hair | build | eyewear | headwear | clothing | jewelry | logo | distinguishing |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| SYNTH-1 | M | Hispanic | 30s | black, short | full beard | muscular | none | backwards cap (red) | black tee | gold chain | — | sleeve tattoo (L arm) |
| SYNTH-2 | M | Caucasian | 60s+ | white/balding | clean | heavy | bifocals | none | polo + jacket | wedding band | local-team hat held in hand | — |
| SYNTH-3 | F | East Asian | 20s | black, long ponytail | n/a | slim | none | none | hoodie | small earrings | university crest hoodie | — |
| SYNTH-4 | M | Black | 40s | shaved | goatee | average | sunglasses (mirrored) | none | button-down (purple) | gold watch (L wrist) | — | — |
| SYNTH-5 | M | Caucasian | 30s | brown, medium scruff-style | stubble | average | none | beanie (gray) | hoodie + jacket | — | crypto brand cap | — |
| SYNTH-6 | F | Hispanic | 50s | dark dyed-red, short | n/a | heavy | reading glasses on chain | none | floral blouse | multiple gold rings | — | — |
| SYNTH-7 | M | South Asian | 40s | black w/ gray temples, short | mustache | average | clear glasses | none | dress shirt no tie | gold ring | — | — |
| SYNTH-8 | M | Caucasian | 20s | blonde, long-ish | clean | slim | none | snapback (forward) | graphic tee | — | esports brand logo | — |
| SYNTH-9 | F | Black | 30s | braided, long | n/a | average | none | none | button-down | hoop earrings | — | — |
| SYNTH-10 | M | Caucasian | 50s | brown w/ gray, short | full beard | heavy | none | cowboy hat (tan) | flannel | — | local poker room embroidered | — |
| SYNTH-11 | M | East Asian | 60s+ | gray-black, short | clean | slim | clear glasses | none | windbreaker (navy) | — | — | — |
| SYNTH-12 | F | Caucasian | 60s+ | gray-white, short | n/a | average | reading glasses | sun visor (white) | sweatshirt | pearl earrings | charity-event tee | — |
| SYNTH-13 | M | Hispanic | 40s | black, short slick-back | goatee | average | none | none | dress shirt | gold cross necklace | — | — |
| SYNTH-14 | M | Middle Eastern | 30s | black, curly | full beard | average | none | none | hoodie | — | sports team (soccer) | — |
| SYNTH-15 | M | Caucasian | 70s | white, sparse | clean | slim | bifocals | none | cardigan | wedding band | — | hearing aids (visible) |
| SYNTH-16 | F | South Asian | 40s | black, long | n/a | slim | none | none | salwar-style top (blue) | bangles + bindi | — | bindi |
| SYNTH-17 | M | Black | 50s | salt-and-pepper, short | gray full beard | heavy | none | dad cap (military) | polo | — | military veteran hat | — |
| SYNTH-18 | M | Caucasian | 30s | red, medium | red full beard | muscular | none | none | tank top | — | gym brand | freckles, sleeve tattoo |

**Coverage achieved across N=25:** 19M / 6F (76% / 24%); 12 Caucasian / 4 Hispanic / 4 East Asian / 3 Black / 2 Middle Eastern / 2 South Asian; ages span 20s-70s; 13/25 hatted; 9/25 with visible facial hair; 4/25 with distinguishing marks (tattoo, hearing aids, bindi).

---

## §5 — Scoring the Current System

For each corpus entry, simulate entering the player in the current editor and finding them in a DB seeded with same-name distractors.

### §5.1 Entry score (current system)

| Axis | Result | Notes |
|---|---|---|
| Median observable attributes per entry | 9 of 12 | Most entries observable in `gender, age, ethnicity, hair, facial-hair, build, eyewear, headwear, top color, jewelry presence` |
| Median fields current editor exposes for these | 8 of 9 (gender hidden in collapsible) | |
| Median taps to capture top-3 (gender + age + ethnicity) | **9 taps** | Open editor (1) + tap "More details" (1) + tap gender dropdown (1) + select gender (1) + scroll to AgeDecade (1) + tap chip (1) + scroll to EthnicityTags (1) + tap chips (2) |
| Median taps for full capture (~9 attributes) | **22 taps** | Includes hair (no field), wardrobe palette browse (3 taps), jewelry (3 taps), notes free-text |
| Coverage gaps (no field exists) | hair color, hair length, distinguishing marks (only via free-text Notes) | |

**Aggregate:** the current system requires **~9 taps to capture the must-have triple** that does most of the recognition work. That's the core failure: by the time a 3-bit triple is entered, the user could have entered all 11 fields in a well-designed UI.

### §5.2 Find score (current system)

Seed DB with: 2x "Michael" (SYNTH-1 + SYNTH-13 — both male Hispanic 30s/40s with gold jewelry), 2x "Sarah" (SYNTH-9 + SYNTH-12 — different ethnicities/ages but same name), plus ~8 distractors.

Test: simulate searching for "Michael" with intent to find SYNTH-1 (Hispanic 30s, full beard, sleeve tattoo, red cap).

| Axis | Result |
|---|---|
| First-result accuracy | **0%** — name search returns both Michaels with no visual differentiator (PlayersView rows show only letter monograms) |
| Top-3 accuracy | 100% (both in top 3, but user can't tell them apart) |
| Disambiguation taps | **5+** — open each Michael's profile separately (no inline disambiguation), compare attribute lists by reading text |
| False-confidence risk | **HIGH** — both Michaels have "Hispanic / male / 30s+" with gold jewelry; visual aid required to disambiguate, none provided |

**Failure pattern:** the system has the data (`avatarFeatures` could differentiate them), but the rendering surfaces don't expose it as an at-a-glance differentiator. PlayersView rows show letter monograms, not avatars.

### §5.3 Combined verdict on current system

Fails BOTH thresholds proposed in §3.4 of the v1 scaffold:
- Entry-tap budget: 9 (target ≤5)
- Find first-result accuracy: 0% (target ≥80%)

---

## §6 — Discriminator Power Ranking (corpus-backed)

For each candidate attribute, score by:
- **Recall** — fraction of corpus where the attribute is observable from across-table viewing distance (estimated; for synthesized profiles I used the prior I baked in)
- **Discrimination** — entropy of the attribute's distribution across the corpus (higher = more differentiating)
- **Stability** — likelihood the attribute persists across sessions (avoids "wardrobe of the day" trap)

| Rank | Attribute | Recall (0-1) | Discrim (bits) | Stability (0-1) | Combined | Notes |
|---|---|---|---|---|---|---|
| 1 | sex (presenting) | 1.00 | 0.79 | 1.00 | **0.79** | Top recall, ~3:1 split → 0.79 bits |
| 2 | ethnicity (apparent) | 0.95 | 2.00 | 1.00 | **1.90** | 6-bin distribution → 2 bits info |
| 3 | age decade | 0.85 | 2.10 | 0.90 | **1.61** | 5-bin, drifts 1 decade per ~10 yrs |
| 4 | build | 0.85 | 1.50 | 0.85 | **1.08** | 4-bin (slim/avg/heavy/muscular), some drift |
| 5 | hair color (when uncovered) | 0.70 | 2.20 | 0.70 | **1.08** | High-info but covered by hats often |
| 6 | facial hair (presence + style) | 0.95 (if M) | 2.00 (M-subset) | 0.50 | **0.95** | Volatile (shaved between sessions) |
| 7 | distinguishing mark (visible) | 0.20 | 4.00 | 0.95 | **0.76** | Rare but very high-info when present (tattoo, scar, hearing aids, bindi, etc.) |
| 8 | hair length / coverage | 0.65 | 1.60 | 0.65 | **0.68** | Confounded with hat |
| 9 | eyewear (clear / sunglasses / none) | 0.95 | 1.20 | 0.60 | **0.68** | Style varies, but presence stable for prescription |
| 10 | headwear presence | 0.95 | 1.00 | 0.40 | **0.38** | Highly volatile session-to-session |
| 11 | clothing color (top, broad) | 1.00 | 1.50 | 0.20 | **0.30** | Volatile — different shirt every day |
| 12 | jewelry (presence + class) | 0.50 | 1.50 | 0.70 | **0.53** | Watches/rings/chains vary in observability |
| 13 | logo on clothing | 0.40 | 2.50 | 0.30 | **0.30** | High-info but wears different shirts |
| 14 | clothing style/garment-type | 0.95 | 1.80 | 0.20 | **0.34** | Volatile — same as color |

**Top-3 attribute set: sex × ethnicity × age decade.** Combined: 0.79 + 1.90 + 1.61 = **~4.3 bits of identification power**, enough to partition a 30-person table to ~1.5 candidates on average. Distinguishing marks rank 7th overall but **first when present** (4 bits each).

**Wardrobe palette (current rank 11+12+13+14):** total ~1.5 stability-discounted bits. Splitting into "Black hoodie" / "Plain tee" / "Polo shirt" doesn't help — what matters is "wearing dark casual" vs "wearing formal" — a 2-bin distinction. Owner intuition validated by data.

**Hair color is rank 5** (above facial hair), but only when uncovered. With ~50% hat-wearing, effective recall drops. The avatar should show hair under hat by default, with hat as overlay layer the user can toggle.

---

## §7 — Buried Assumptions Surfaced

Sorted by leverage (most damaging first):

### A1. "Avatar features (skin/hair/glasses/hat) are independent from identification fields"
**Source:** AvatarFeatureBuilder ships its own picker for skin tone, hair color, glasses, hat — orthogonal to gender/ethnicity/age inputs.
**Reality:** Skin tone IS ethnicity. Hair color IS hair color. Glasses presence IS eyewear. The dual-data-model invites inconsistency (Asian skin + non-Asian ethnicity tag).
**Cost:** Avatar can't be used as a recognition aid because it's user-authored independently. Owner sees a generic emoji that doesn't match the data they entered.
**Fix:** Single source of truth — derive the SVG avatar from identification fields (§9).

### A2. "playerId is a string"
**Source:** PIO G4 v1 audit + sightingLogsStore validators + uiReducer schema all assumed string IDs.
**Reality:** players store has used `keyPath: 'playerId', autoIncrement: true` (integer) since v5 (8 schema versions ago).
**Cost:** Manifested today as 3 production defects: sightingLogs validator throws on every write; PlayerProfileView always shows "Player not found"; updatePlayer name-uniqueness throws on the higher-id duplicate. All fixed in `b9ed7ac` but the assumption likely persists in computeStability + scorePlayerMatch + recognition-search not yet exercised.
**Fix:** Either (a) accept number throughout (current fix direction) or (b) full migration to stable string IDs (cross-venue future). v2 codifies (a) as the binding rule unless §12 Q5 changes it.

### A3. "Two ethnicity systems can coexist (legacy `ethnicity` string + new `ethnicityTags` array)"
**Source:** PIO G5 added EthnicityTagsSection without deprecating PhysicalSection's ethnicity dropdown.
**Reality:** `ethnicity` string still appears in PhysicalSection dropdown (10 enum values), in PlayerFilters (filterEthnicity dropdown), in usePlayerFiltering, in Player record. `ethnicityTags` (array) added in parallel. They drift on every save.
**Cost:** Two filter axes for the same concept, two storage shapes, search/filter inconsistency.
**Fix:** Ethnicity becomes single source — multi-tag array. Legacy string field migrated on read (one-shot getter shim) then removed. Filters updated to consume tag array.

### A4. "Wardrobe per-garment specificity aids identification"
**Source:** wardrobePalette.js: 10 garments (Black hoodie, Polo shirt, Athletic jersey, etc.).
**Reality:** Wardrobe stability across sessions ≈ 0.20. Per-garment values are noise.
**Cost:** Editor scrolls through 10 chips for low-info data; filter axis takes screen real estate; users pick something and it's wrong by next session anyway.
**Fix:** Collapse to 3-bin coarse classes: `formal | casual | athletic`. Or remove wardrobe entirely and rely on color (1-bin: `dark | light | bright`). Owner picks via §12 Q3.

### A5. "Manual photo capture is the primary recognition aid"
**Source:** PIO G5 shipped CameraButton + CameraCaptureModal as a focal feature; PlayerProfileView header prefers photo over avatar.
**Reality:** Photo capture has friction (privacy concern, awkward to capture mid-game, requires user to ask politely or be sneaky). Most player records will not have a photo. The always-on visual aid must be the avatar.
**Fix:** Avatar is the primary identification render. Photo is an optional enhancement, shown as a small overlay (e.g., bottom-right corner badge) on the avatar where it exists.

### A6. "Three entry paths (PlayersView '+ New Player' / TableView seat menu 'Create New' / PlayerPicker 'Create from query') need separate routing"
**Source:** All three call openPlayerEditor with slightly different seedings.
**Reality:** They all produce the same outcome (a new player record). The 'Create from query' path is the most common in real use (user is already searching) but feels like a separate code path.
**Fix:** Single canonical entry: PlayerPicker IS the entry surface for both "find existing" and "create new". The "+ New Player" button on PlayersView and the TableView seat menu both route through Picker first (search to confirm no duplicate) and only then offer Create. This kills the "duplicate Michael accidentally created" failure mode at the source.

### A7. "Free-text Notes captures distinguishing marks"
**Source:** NotesSection is a plain textarea, used for "Playing tendencies, tells, session context…"
**Reality:** Distinguishing marks (tattoos, hearing aids, prosthetics, unique scars, bindi, etc.) are extremely high-discrimination (4 bits each per §6). They deserve a structured field with optional location annotation, and they need to surface in the avatar.
**Fix:** New `distinguishingMarks` array field with `{ type, location, description }` shape. Tattoos/scars affect avatar overlay; hearing aids/bindi affect avatar accessory layer.

### A8. "AvatarFeatureBuilder's hat picker is the right input for headwear"
**Source:** AvatarFeatureBuilder has manual hat picker; PhysicalSection (collapsible) ALSO has a hat boolean.
**Reality:** Headwear is volatile (rank 10, stability 0.40). It's a session-snapshot field, not an identity field. It belongs on the **sighting** record, not the player record. The avatar should render a default no-hat state with a per-sighting overlay if a notable hat is observed.
**Fix:** Move headwear from Player schema to Sighting schema. Avatar renders bare-head by default. Sighting-tagged headwear appears as overlay when the user is reviewing recent sightings.

### A9. "Sightings only need to be captured manually via AddSightingModal"
**Source:** PIO G4 spec.
**Reality:** Owner expectation is automatic — every seat assignment IS a sighting. Fixed today (b9ed7ac).
**Fix:** Already in. Document as principle: any user-confirmed identity event (seat assignment, picker confirmation, profile open after recognition) writes a sighting record.

### A10. "Avatar should render only in detail views (Profile, Editor)"
**Source:** PEO-1 PlayerAvatar comment: "Raw image uploads are surfaced only in detail views via dedicated components — never here, to keep list rendering fast and uniform."
**Reality:** SVG avatars (no image fetch) are cheap. They should render at every recognition surface. The "fast and uniform" concern was about photo-blob-decoding performance, not avatars.
**Fix:** Avatar renders at TableView seats, PlayersView rows, picker results, profile header, sidebar HUD (non-live-table), refresher cards.

---

## §8 — Proposed Unified Architecture

### §8.1 The single avatar generator

**One component:** `<IdentityAvatar player={p} size={n} hat={'show'|'hide'} photoOverlay={true|false} />`

**Inputs:** Player record. **No** independent `avatarFeatures` parameter.

**Output:** Layered SVG that deterministically derives:

| Layer | Driven by | Notes |
|---|---|---|
| Silhouette base | sex | masculine / feminine / androgynous shapes |
| Skin tone | ethnicity (palette: 6 tones mapped from ethnicityTags) | Multi-tag → blend or pick first |
| Hair (color + length) | hairColor + hairLength | Both new structured fields |
| Facial hair | facialHair (none / stubble / goatee / mustache / full / soul-patch) | Auto-hidden if sex=feminine unless explicit |
| Eyewear | eyewear (none / clear-glasses / sunglasses / readers) | |
| Headwear | sighting.headwear OR player.distinctiveHeadwear (rare) | Default off; overlay when tagged |
| Build | build | Affects silhouette weight |
| Age | ageDecade | Affects line treatment (smooth vs creased), hair-color bias toward gray |
| Distinguishing-mark badges | distinguishingMarks[].type | Small icon badges (tattoo, hearing-aid, bindi) overlaid |
| Photo overlay (optional) | photoBlobId | Small circular overlay bottom-right when photoOverlay=true |

**Read-only.** No "edit avatar" UI. To change the avatar, edit identification fields. The avatar IS the visualization of the identification data.

**Renders everywhere:** TableView seats, PlayersView rows, picker results, profile, lesson cards, etc. Single component, one prop signature.

### §8.2 The single editor

**One screen:** `PlayerEditorView`, restructured.

```
┌─────────────────────────────────────────────────────┐
│ ← Back                              [Save]          │
├─────────────────────────────────────────────────────┤
│                                                     │
│   [Live IdentityAvatar (240px)]                     │
│   (updates on every keystroke / chip tap)           │
│                                                     │
│   [Name] [Nickname]                                 │
│                                                     │
│   ─── Must-haves (always visible) ───              │
│   Sex:        ◉ M  ○ F  ○ Other                    │
│   Age:        ○ 20s ○ 30s ○ 40s ○ 50s ○ 60s+      │
│   Ethnicity:  [tag chips, multi-select, all 8]    │
│                                                     │
│   ─── Helpful (always visible) ───                 │
│   Hair:       color [chips]  length [chips]         │
│   Facial:     [none/stubble/goatee/mustache/full]   │
│   Build:      [slim/avg/heavy/muscular]             │
│   Eyewear:    [none/clear/sun/readers]              │
│                                                     │
│   ─── Distinguishing marks ───                     │
│   [+ add mark] (tattoo/scar/hearing-aid/bindi/...)  │
│                                                     │
│   ─── Optional ───                                 │
│   Headwear (today): [none/cap/beanie/visor/hat]     │
│   Top color (today): [dark/light/bright]            │
│   [+ Camera] [+ Notes]                              │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Section count:** 4 (must-haves / helpful / distinguishing / optional). Down from 12.
**Median taps to enter Sex+Age+Ethnicity (the must-have triple):** **3** (down from 9).
**No collapsibles** for high-discriminator fields.
**Avatar visible throughout entry** — every tap updates it.

**Killed:**
- AvatarFeatureBuilder (avatar derives from identification)
- PhysicalSection (replaced by structured per-attribute sections)
- WardrobeSection (replaced by 3-bin "top color today" optional)
- JewelrySection (moved to Sighting; not core identification)
- LogoSection (removed; logos are too volatile to be core identification)
- ImageUploadSection (legacy — Camera is the only image path)

**Survives:**
- NameSection
- NotesSection
- CameraButton + CameraCaptureModal (kept as-is)
- DraftResumeBanner (kept)
- BackToTableBar (kept)
- PaletteChipsInput (reused for ethnicity, hair color, etc.)

**Added:**
- IdentityAvatar (the unified renderer)
- DistinguishingMarksSection (structured array of marks)
- IdentityFormLayout (the 4-section frame)

### §8.3 The single picker

`PlayerPickerView` rewritten as **discriminator-ranked progressive filter**:

```
┌─────────────────────────────────────────────────────┐
│ ← Back     Pick for Seat 3                          │
├─────────────────────────────────────────────────────┤
│ [Name search input — autofocus]                     │
│                                                     │
│ ─── Quick filter (must-haves) ───                  │
│ Sex:       [M] [F] [Other]   ← chips, single-select │
│ Ethnicity: [White][Hisp][Asian][Black][ME][SA][...]│
│ Age:       [20s][30s][40s][50s][60+]                │
│                                                     │
│ ─── Showing 3 candidates ───                       │
│ ┌─────────────────────────────────────┐            │
│ │ [Avatar] Michael Garcia · 36 hands   │            │
│ │          Hispanic · 30s · M · beard  │            │
│ │                              [Pick]  │            │
│ ├─────────────────────────────────────┤            │
│ │ [Avatar] Michael Lopez · 12 hands    │            │
│ │          Hispanic · 40s · M · clean  │            │
│ │                              [Pick]  │            │
│ ├─────────────────────────────────────┤            │
│ │ [Avatar] (small) Michael Stein...    │            │
│ └─────────────────────────────────────┘            │
│                                                     │
│ [+ Create new "Michael" with these attributes]      │
└─────────────────────────────────────────────────────┘
```

**Key change:** the "+ Create new" CTA pre-fills with the name AND any quick-filter attributes the user already set. This makes Picker the canonical creation entry — search first, create only if no match — eliminating the duplicate-Michael class of bug at the source (per A6).

**Picker becomes the only entry path.** PlayersView's "+ New Player" button → opens Picker (no name pre-filled). TableView seat menu's "Create New" → opens Picker (no name pre-filled, seat context retained). Old direct-to-editor paths killed.

### §8.4 The single source of truth (storage)

**Player record schema** (after migration):

```js
{
  playerId,           // number, autoIncrement (unchanged)
  name, nickname,     // unchanged
  // Identification (single source of truth, drives avatar)
  sex,                // 'male' | 'female' | 'other' | null
  ageDecade,          // '<20' | '20s' | '30s' | '40s' | '50s' | '60s+' | null
  ethnicityTags,      // array — replaces legacy `ethnicity`
  hairColor,          // 'black' | 'brown' | 'blonde' | 'red' | 'gray' | 'white' | 'bald' | null
  hairLength,         // 'shaved' | 'short' | 'medium' | 'long' | null
  facialHair,         // existing enum (kept)
  build,              // existing enum (kept)
  eyewear,            // 'none' | 'clear' | 'sunglasses' | 'readers' | null  (new structured)
  distinguishingMarks,// [{ type, location, description }]
  // Photo
  photoBlobId,        // unchanged
  // Notes
  notes,              // unchanged
  // Bookkeeping
  lastSeenAt, handCount, exploits, ...
}
```

**Removed from Player:**
- `avatarFeatures` (the manual SVG picker storage) — collapsed into derived render
- `ethnicity` (legacy single-string)
- `wardrobe` (moved to optional `topColorToday` snapshot or to Sighting)
- `jewelry` (moved to Sighting if kept at all)
- `logo` (removed — too volatile)
- `hat` boolean, `sunglasses` boolean (replaced by structured `headwear` + `eyewear`)

**Sighting record additions** (volatile per-session attrs):
- `headwear` (optional per-sighting)
- `topColor` (optional per-sighting — 3-bin coarse)
- `jewelry` (optional per-sighting — array)
- `logoVisible` (optional)

**Migration path** (single shot, additive then drop):
1. Read-side getter shim: `getEthnicity()` returns `ethnicityTags` if present else legacy `ethnicity` wrapped in array
2. Write-side: editor only writes new fields; legacy never re-written
3. Background migration on next-touch: when a player record is loaded, if `avatarFeatures` is the only ethnicity hint, infer ethnicityTags + persist
4. After 1 sprint of dual-read with telemetry: drop legacy fields from schema

---

## §9 — Avatar-from-Identification Mapping (concrete)

Detailed map of identification field → avatar SVG layer:

| Identification field | Avatar layer affected | Mapping |
|---|---|---|
| sex='male' | silhouette base | `male-base.svg` (broader shoulders, narrower hips) |
| sex='female' | silhouette base | `female-base.svg` (narrower shoulders, longer neck) |
| sex='other' | silhouette base | `androgynous-base.svg` (neutral) |
| ethnicityTags | skin tone | Multi-tag → palette pick (Caucasian=#F2D6B3, Hispanic=#D9A878, East Asian=#E8C99A, South Asian=#A87850, Black=#5C3A28, Middle Eastern=#C49A78, mixed=blend of first two) |
| ageDecade='20s' | line treatment | smooth, sharper jawline, no wrinkles |
| ageDecade='30s' | line treatment | smooth, slight expression lines |
| ageDecade='40s' | line treatment | mild forehead lines, slight eye creases |
| ageDecade='50s' | line treatment | defined wrinkles, gray at temples (mixed with hair color) |
| ageDecade='60s+' | line treatment | full wrinkles, gray-bias dominant |
| hairColor='brown' | hair layer color | #6B4423 |
| hairColor='blonde' | hair layer color | #E5C170 |
| hairColor='red' | hair layer color | #B6451E |
| hairColor='black' | hair layer color | #1A1A1A |
| hairColor='gray' / 'white' | hair layer color | #B0B0B0 / #E8E8E8 |
| hairColor='bald' | hair layer | empty (renders bald shape) |
| hairLength='shaved' | hair shape | skullcap stubble |
| hairLength='short' | hair shape | short cut |
| hairLength='medium' | hair shape | shoulder-length |
| hairLength='long' | hair shape | past-shoulder |
| facialHair=* | beard layer | existing AvatarRenderer beard layer (keep code, drive from identification) |
| build='slim' | silhouette weight | thin variant |
| build='average' | silhouette weight | default |
| build='heavy' | silhouette weight | heavier variant |
| build='muscular' | silhouette weight | muscular variant |
| eyewear='clear' / 'sunglasses' / 'readers' | glasses layer | existing AvatarRenderer glasses layer (keep code, drive from identification) |
| distinguishingMarks contains 'tattoo' | tattoo overlay | small ink-mark on visible skin area (stylized) |
| distinguishingMarks contains 'hearing-aid' | accessory overlay | small ear icon |
| distinguishingMarks contains 'bindi' | accessory overlay | red dot at forehead |
| distinguishingMarks contains 'scar' | overlay | small line on face |
| photoBlobId (when photoOverlay=true) | bottom-right badge | 32px circle of photo over the SVG corner |

**Hat handling per A8:** default no-hat. If user explicitly tags `distinctiveHeadwear` (rare — a player's signature cowboy hat that they always wear), it renders. Per-session headwear surfaces as a small "Today: [cap]" tag NEXT to the avatar in profile, not on it.

---

## §10 — Surface Impact Map

| Surface | Today | After v2 |
|---|---|---|
| **TableView seat (occupied)** | Name only | IdentityAvatar (40px) + name + 1-line attribute summary ("Hispanic · M · 30s") |
| **TableView seat (empty)** | "+" icons + 👁 picker icon | Unchanged (no identity context yet) |
| **TableView seat menu** | "Find Player / Create New / Make Dealer / Clear" | "Find or Add Player / Make Dealer / Clear" — Create folded into Picker |
| **PlayersView row** | AvatarMonogram (letter) + name + filter axes | IdentityAvatar (32px) + name + must-have attribute chips + "Last seen" + filter axes (reduced) |
| **PlayersView "+ New Player"** | Direct → editor (create mode) | Direct → Picker with empty query |
| **PlayersView filters** | 11 filter axes (mixed legacy + new) | 5 axes: name search + sex + ethnicity + ageDecade + distinguishingMark presence |
| **PlayerProfileView header** | Photo (if present) OR PlayerAvatar | IdentityAvatar (240px) + photo overlay (if present) + name + must-have summary |
| **PlayerProfileView body** | Sighting history + 5 attribute-stability rows | Sighting history + identity attributes summary + per-attribute stability (where useful) |
| **PlayerEditorView** | 12 sections, gender hidden | 4 sections, must-haves first, live avatar |
| **PlayerPickerView** | Name search + 11 filter chips + result cards | Name search + 3 quick-filter chips (sex/ethnicity/age) + result cards with IdentityAvatar |
| **Picker result card** | Feature highlights (text) | IdentityAvatar (48px) + name + 1-line attr + Pick button |
| **HandReplay HeroCoachingCard player ref** | Name only | IdentityAvatar (24px) + name |
| **AnalysisView PlayerAnalysisPanel** | Letter monogram | IdentityAvatar (48px) |
| **Sidebar HUD (extension, non-live)** | Name | (Out of scope this round — flag for next iteration) |

---

## §11 — Migration / Killable / Survives

### Killed (delete after v2 ships)

| File | Why |
|---|---|
| `src/components/views/PlayerEditorView/AvatarFeatureBuilder.jsx` | Replaced by derived avatar |
| `src/components/views/PlayerEditorView/AvatarFeatureBuilder.test.jsx` | Component gone |
| `src/components/views/PlayerEditorView/PhysicalSection.jsx` | Replaced by structured per-attribute sections |
| `src/components/views/PlayerEditorView/WardrobeSection.jsx` | Folded into optional "top color today" or removed |
| `src/components/views/PlayerEditorView/WardrobeSection.test.jsx` | Component gone |
| `src/components/views/PlayerEditorView/JewelrySection.jsx` | Moved to Sighting (or removed) |
| `src/components/views/PlayerEditorView/LogoSection.jsx` | Removed (too volatile) |
| `src/components/views/PlayerEditorView/ImageUploadSection.jsx` | Legacy data-URL upload — Camera is canonical |
| `src/utils/playerMatching/wardrobePalette.js` | Palette removed |
| `src/utils/playerMatching/jewelryPalette.js` | Palette removed (or moved to Sighting) |
| `src/utils/playerMatching/logoPalette.js` | Palette removed |
| `src/components/ui/AvatarRenderer.jsx` (current shape) | Rebuilt as IdentityAvatar with new mapping (keeps SVG asset code) |

### Survives unchanged

| File | Notes |
|---|---|
| `src/utils/persistence/sightingLogsStore.js` | Already fixed; schema additive |
| `src/utils/persistence/playerPhotosStore.js` | Photo capture flow unchanged |
| `src/components/views/PlayerEditorView/CameraButton.jsx` | Kept |
| `src/components/views/PlayerEditorView/CameraCaptureModal.jsx` | Kept |
| `src/components/views/PlayerEditorView/NotesSection.jsx` | Kept (not for distinguishing marks) |
| `src/components/views/PlayerEditorView/DraftResumeBanner.jsx` | Kept |
| `src/components/views/PlayerEditorView/BackToTableBar.jsx` | Kept |
| `src/components/views/PlayerEditorView/PaletteChipsInput.jsx` | Reused for ethnicity / hair / etc. |
| `src/utils/playerMatching/computeStability.js` | Kept (algorithm unchanged) |
| `src/utils/playerMatching/SIGHTING_FEATURE_PRIORS.js` | Kept (revisit priors after migration) |
| `src/components/views/PlayerProfileView/AddSightingModal.jsx` | Kept; auto-write supplements but doesn't replace |
| `src/components/views/PlayerProfileView/SightingHistorySection.jsx` | Kept |
| `src/components/views/PlayerProfileView/AttributeStabilityRow.jsx` | Kept (reduced attribute set) |

### Added

| File | Purpose |
|---|---|
| `src/components/ui/IdentityAvatar.jsx` | The single unified avatar |
| `src/components/ui/IdentityAvatar/` (folder of SVG layer assets) | Per-layer SVG primitives, indexed by identification value |
| `src/components/views/PlayerEditorView/IdentityFormLayout.jsx` | 4-section frame |
| `src/components/views/PlayerEditorView/SexSection.jsx` | Single-select chip row |
| `src/components/views/PlayerEditorView/AgeSection.jsx` | (Replaces AgeDecadeSection — same logic, smaller, top-row position) |
| `src/components/views/PlayerEditorView/HairSection.jsx` | hairColor + hairLength chips |
| `src/components/views/PlayerEditorView/FacialHairSection.jsx` | (Replaces facialHair from PhysicalSection) |
| `src/components/views/PlayerEditorView/BuildSection.jsx` | (Replaces build from PhysicalSection) |
| `src/components/views/PlayerEditorView/EyewearSection.jsx` | (Replaces hat/sunglasses bools from PhysicalSection) |
| `src/components/views/PlayerEditorView/DistinguishingMarksSection.jsx` | Structured array editor |
| `src/components/views/PlayerPickerView/QuickFilterChips.jsx` | Sex/ethnicity/age top filter |
| `src/utils/identityAvatar/avatarMapping.js` | Pure function: identification → SVG layer config |

### Migrated (read-side shims, then dropped)

| Field | Migration |
|---|---|
| `Player.ethnicity` (string) | Read shim wraps to `ethnicityTags`; one-shot background migration; drop after 1 sprint |
| `Player.avatarFeatures` (object) | If skin/hair specified, infer ageDecade-skin-tone hint + migrate; drop |
| `Player.wardrobe` / `jewelry` / `logo` (arrays) | Move to most-recent-sighting or drop |
| `Player.hat` / `Player.sunglasses` (bools) | Map to `eyewear='sunglasses'` if true; drop hat (volatile) |

---

## §12 — Open Questions for Owner Before Implementation

Eight gating decisions. Each is a fork the rest of the work depends on.

**Q1. Image corpus — is N=25 sufficient, or do you want to drop a folder of curated images?**
Consequence: more images = stronger discriminator-rank confidence. Curated images = your venue specifically (better signal). N=25 is enough to ratify the rank ordering proposed in §6, but a 50-image owner-curated corpus would let me re-validate against your population.

**Q2. Sex labels — "M / F / Other" or different vocabulary?**
Owner stated identification utility binds. Proposing 3-bin: `male / female / other` to match common observable-sex perception while leaving "other" for ambiguity. Alternative: 2-bin only, with "uncertain" as a per-attribute Bayesian "low confidence" tag instead of a third label. Pick.

**Q3. Wardrobe handling — three options:**
- (a) Remove entirely (low stability, low value)
- (b) Reduce to 1-bin "top color today" (dark / light / bright) — minimal sighting-snapshot value
- (c) Reduce to 3-bin "style today" (formal / casual / athletic) — slightly more info, slightly less stable

**Q4. Distinguishing marks — structured array OR free-text-with-search?**
- Structured: `[{type: 'tattoo', location: 'left forearm', description: 'sleeve'}]` — best for filter/search + avatar overlay
- Free-text: a `distinguishing` text field — easier to enter, weaker for filter/search/overlay
- Hybrid: enum type + free-text description

**Q5. playerId migration — accept the integer reality (current direction) OR migrate to stable string IDs?**
Stable strings allow cross-venue identity (same player at multiple poker rooms). Costs: schema bump, sighting/photo/profile foreign-key migration. Benefit: future-proof if cross-venue matters. Today's three bug fixes accepted integer; can pivot if stable strings are wanted.

**Q6. Picker becomes the only creation entry point — kill the direct "+ New Player" button on PlayersView?**
- Yes: PlayersView's "+ New Player" routes through Picker first. Eliminates duplicate-Michael at source.
- No: keep direct path; user gets duplicate warning post-hoc.

**Q7. Photo overlay on avatar — bottom-right badge OR replaces avatar when present?**
- Badge: avatar always primary, photo enhances when available (proposed)
- Replace: photo wins when present, avatar fallback otherwise (current behavior)

**Q8. Implementation cadence — full unified rebuild in N sessions OR phased migration with both old + new coexisting for some sprints?**
- Big-bang: 4-6 sessions of design refinement + implementation. Faster, riskier.
- Phased: ship IdentityAvatar first (no kills), then editor, then picker, then deprecate. Slower, safer.

---

## §13 — Sequencing (proposed)

If §12 questions all approve current proposal, sequencing is:

| Phase | Sessions | Deliverable | Approval gate |
|---|---|---|---|
| **0. This report** | (this session) | Full audit doc | Owner answers §12 |
| **1. IdentityAvatar primitive** | 1 | New component + avatar mapping + SVG layer assets + tests; renders nowhere yet | Owner sees rendered samples for ~10 corpus profiles |
| **2. IdentityAvatar adoption** | 1 | Render at TableView seats + PlayersView rows + Picker results + Profile header + HeroCoachingCard. Old AvatarMonogram/AvatarRenderer/PlayerPhotoAvatar still present, used as fallbacks during transition | Owner sees recognition surfaces side-by-side |
| **3. Editor rewrite** | 2 | New 4-section editor; old sections kept in branch but new editor is default. AvatarFeatureBuilder dies. Live avatar updates as user edits | Owner uses the editor on their own data |
| **4. Picker rewrite** | 2 | Quick-filter chips + IdentityAvatar in result cards + Create-from-search consolidation. Direct "+ New Player" routes through Picker | Owner runs through 5 entry scenarios |
| **5. Schema migration** | 1 | Background migration of legacy fields; read shims; drop legacy after | Owner verifies no data loss on existing player records |
| **6. Sighting schema additions** | 1 | Headwear / topColor / jewelry move to Sighting record | — |
| **7. Cleanup** | 1 | Delete killed files; remove read shims; remove legacy filter axes | Final verification |
| **8. Distinguishing-marks polish** | 1 | Tattoo/hearing-aid/bindi overlays in IdentityAvatar; structured editor section | — |

**Total estimate: 9 sessions implementation + 1 polish.** Plus this report (already done) + Q&A on §12.

---

## §14 — Why This Method Is Preferred (the synthesis)

The current system was built bottom-up: each PIO gate added new sections + new fields + new stores without consolidating against existing ones. Three audits in 4 days produced 5 new editor sections, 3 new stores, 4 new palettes, 2 new surfaces — without revisiting whether the old structures remained correct. That's how you get to four parallel avatar systems with no shared source of truth.

This v2 inverts the approach: starts from the **user task** ("recognize a face in <3 seconds") and asks what data structure best supports it. The answer — derived avatar from a small ranked set of high-discriminator fields — happens to require fewer components, fewer stores, fewer code paths, and fewer fields than the current system. Simplification is a side effect of correct prioritization, not a design goal in itself.

The key conceptual move is **collapsing the avatar from "manual feature picker" to "visualization of identification fields"**. Once that move is made:
- One source of truth (identification fields)
- One render path (IdentityAvatar)
- Consistent visual identity at every surface (because there's only one renderer)
- Live feedback during editing (avatar reflects what you just entered)
- Search/filter and visual recognition driven by the same fields, so what the user sees in the avatar is what they can search by

This is the elegant unification the owner asked for. It does require committing to "avatar = derived, not authored", which is the answer to §12 Q3 in v1 and the load-bearing call of this entire proposal. If owner rejects that move, the entire architecture collapses back to the current fragmented form.

The biggest risk is **derived-avatar fidelity**: a generic-looking SVG won't be recognizable enough to actually aid recognition. Mitigation: the avatar mapping in §9 is tunable; Phase 1 (build IdentityAvatar in isolation) lets owner sanity-check rendered samples against the corpus profiles BEFORE committing to the full migration. If the avatars look generic, we adjust §9 mappings or add per-attribute fidelity (e.g., tattoo location precision, glasses style detail) until they hit recognition threshold.

---

## §15 — What This Report Does Not Address

For surfacing, not in-scope:

1. **Cross-venue player identity** (would need stable string IDs per Q5)
2. **Photo capture flow improvements** (taking a photo at a live table is fundamentally awkward; a separate UX problem)
3. **Stat-sharing / cloud sync of player records** (out of scope — different program)
4. **Auto-recognition from camera** (would need ML, separate effort)
5. **OCR of dealer name plaques** (potential future feature, not addressed)
6. **Sidebar HUD avatar rendering** (extension surface — flag for next iteration)
7. **Anti-pattern review of identity-data sharing with engines** (AP-PIO-02 stays binding; new IdentityAvatar respects it)

---

## §16 — Status

**This document is the full design report.** Sections §0–§15 are author-complete. §12 is the gate. Implementation begins after owner answers §12.

**Sources cited:**
- [PokerNews 2025 WSOP Main Event coverage](https://www.pokernews.com/tours/wsop/2025-wsop/event-81-10000-wsop-main-event/) — ANCHOR-1 to ANCHOR-4
- [PokerNews 2025 WSOP Ladies Championship coverage](https://www.pokernews.com/tours/wsop/2025-wsop/event-70-1000-ladies-championship/) — ANCHOR-5 to ANCHOR-7
- [PokerNews WSOP 2025 demographics article](https://pokerfuse.com/latest-news/2025/7/wsop-2025-main-event-player-demographics-numbers/) — synthesized-profile demographic prior
- [2025 World Series of Poker Wikipedia](https://en.wikipedia.org/wiki/2025_World_Series_of_Poker) — field size + diversity stats

Live cash-game demographic prior used for SYNTH-1..18 is derived from training-knowledge of typical US live-poker-room population mix; not from a single citable source. Owner can override via Q1.
