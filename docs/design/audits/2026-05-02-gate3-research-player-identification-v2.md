# Gate 3 Research — Player Identification v2 (PIO)

**Gate:** 3 (Research)
**Date:** 2026-05-02
**References:**
- [Gate 1 Entry — `audits/2026-05-02-entry-player-identification-v2.md`](2026-05-02-entry-player-identification-v2.md)
- [Gate 2 Blind-Spot — `audits/2026-05-02-blindspot-player-identification-v2.md`](2026-05-02-blindspot-player-identification-v2.md)
- [Table-build Gate 1 — `audits/2026-04-26-entry-table-build.md`](2026-04-26-entry-table-build.md) (inherited prior art)
- [Table-build Gate 2 — `audits/2026-04-26-blindspot-table-build.md`](2026-04-26-blindspot-table-build.md) (inherited prior art)
- [persona — `personas/situational/cold-read-chris.md`](../personas/situational/cold-read-chris.md) (Proto, ratified by table-build Gate 2)
- [persona — `personas/core/chris-live-player.md`](../personas/core/chris-live-player.md) §Autonomy constraint (9 red lines binding)
- [JTBD domain — `jtbd/domains/player-management.md`](../jtbd/domains/player-management.md) §PIO Umbrella JTBDs (PM-13/14/15)

**Sprint / WS:** SPR-019 / WS-006 (Master Plan §A, A-line first Phase-3 Research gate; D-line SCF-G3 shipped in SPR-018 per A/D alternation continuation)

**Status:** Draft, pending owner ratification.

This document specifies the 5 PIO-G3-* carry-forwards from Gate 2 (`SLOG`, `STAB`, `PHOTO`, `PALETTE`, `MIG`) — all named as **BLOCKING Gate 4** — plus 5 owner-decided ratifications captured in plan-mode AskUserQuestion (round 1 + round 2). Gate 4 (Design surfaces — Player Profile / Sighting History, camera-capture modal, PlayerEditorView extensions, Settings photo-toggle, recognition disambiguation flow) is unblocked when this document is ratified.

---

## Decisions ratified (executive summary)

Owner-decided in /next plan-mode AskUserQuestion 2026-05-02:

| # | Decision flag | Outcome |
|---|---|---|
| 1 | **Age representation** | **Decade ranges** — `'20s' \| '30s' \| '40s' \| '50s' \| '60+'`. Closed enum, 5 bins, single string field on Player record + on sighting `featuresSeen`. Stability default `always`. Renders honestly without false precision; cold-read-chris's per-glance bucketing is decade-grain, not year-grain. |
| 2 | **Attribute palette structure** | **Hybrid per category** — closed-enum primary palette + `'other'` slot with free-text `otherText` for the 4 net-new categories (`wardrobe`, `jewelry`, `logo`, plus extended `hat`). Closed-enum drives recognition-search ranking math (deterministic feature comparison). Free-text captures rare cases without polluting the palette. Ethnicity remains `string[]` curated-autocomplete (settled by table-build Gate 2; not subject to PIO-G3-PALETTE). |
| 3 | **Stability formula** | **Bayesian-Beta posterior**. α = priorAlpha + observed; β = priorBeta + (sessionCount − observed). Posterior mean rendered as `'always' \| 'sometimes' \| 'today-only'`; half-width rendered as `±X.X%` on user-visible surfaces (matches SPR-016/017 MoE convention from FIND-001/FIND-002 close-outs). Floor: n≥5 sightings before any "always/today-only" claim renders. |
| 4 | **Sighting-log temporal grain** | **Both** — per-event append-only persistence (`sightingLogs` store rows; one row per observation event) + computed per-session rollups on read (read-side aggregation in `getSessionsForPlayer(playerId)`; no extra store; no caching layer for v1). Mirrors EAL `anchorObservations` per-event grain + read-side rollup convention. |
| 5 | **Camera flow** | **Capture + crop step**. `<input type="file" capture="environment">` → native camera → modal preview with 1:1 crop frame + Accept/Redo. Library: `react-easy-crop` (or canvas-API equivalent if no-dep is preferred — owner amends in Gate 4 surface review). Cropped blob written atomically to `playerPhotos` store. |

Inline-handled (recommended-with-rationale; owner amends in review):

6. **PIO-G3-SLOG schema details:** record shape + indexes + retention TTL — see PIO-G3-SLOG below.
7. **PIO-G3-PHOTO schema details:** blobId scheme + cascade-on-delete + atomic-txn pattern — see PIO-G3-PHOTO below.
8. **PIO-G3-MIG migration shape:** additive-only IDB v22 with multi-store bumps — see PIO-G3-MIG below.
9. **Recognition-search ranking weights:** 8-dimension default weighting; owner tunes empirically — see Output 3.
10. **SIGHTING_FEATURE_PRIORS:** per-attribute α/β defaults reflecting expected stability; aligned with cold-read-chris stability-flag defaults — see Output 4.

---

## PM-13/14/15 detail-out — promote Proposed → Active

**Framing.** Gate 2 §B confirmed PM-13/14/15 as the 3 umbrella JTBDs binding PIO; PM-10/11/12 are sub-jobs. Gate 3 fills out success criteria, distinct-from clauses, load-bearing constraint refs, and 2-3 failure modes per umbrella. State transitions from `Proposed` → `Active` in `docs/design/jtbd/domains/player-management.md`.

### PM-13 — Describe someone into existence (Active)

**Success criterion.** Owner can commit a Player record from any combination of partial signals (name fragment OR visual features OR today's wardrobe OR a captured photo) without forcing a complete identity. The save flow never blocks on missing fields; possible-matches panel surfaces overlapping records before commit (per cold-read-chris §What a surface must offer #7).

**Distinct from PM-03** (create-new-and-assign): PM-03 assumes complete identity; PM-13 explicitly supports the partial-information case where identity is being assembled across sessions.

**Load-bearing constraint:** red lines #1 (opt-in), #2 (transparency — possible-matches panel before commit), #4 (reversibility — record can be edited at any time post-creation).

**Failure modes:**
- Commit-blocked-on-missing-fields. The save button must always be tappable; missing-name records save as "Unnamed (sighting)" placeholder.
- Silent auto-merge into a similar-feature record. AP-PIO-04 + cold-read-chris §What a surface must NOT do #3 forbid auto-merge; manual side-by-side compare is non-negotiable.
- Photo capture without explicit user-tap. AP-PIO-03 binding.

### PM-14 — Build temporal attribute history (Active)

**Success criterion.** Per-feature observations accumulate across sessions in `sightingLogs` store; stability formula (Bayesian-Beta) renders per-feature `'always' \| 'sometimes' \| 'today-only'` labels with `±X.X%` MoE on Player Profile / Sighting History surface (PIO-G4-S1) when n≥5; below-floor surfaces render `"Insufficient sample (need {5 - n} more sightings)"` factual placeholder.

**Distinct from PM-12** (per-seat-per-session clothing observation): PM-12 captures one session's observation on one seat. PM-14 is the cross-session aggregate that PM-12 feeds.

**Scope:** across-session at same venue (per Gate 1 owner decision). Cross-venue / cross-operator deferred; `venueId` field reserved on sighting-log records for graceful future amendment.

**Load-bearing constraint:** red line #8 (no cross-surface contamination — sighting-log NEVER feeds exploit engine; AP-PIO-01); red line #4 (reversibility — sighting can be deleted per record).

**Failure modes:**
- Stability claim renders below n≥5 floor. Forbidden — surfaces consume `computeStability()` output and respect `null` return.
- `featuresSeen` snapshot writes to live-decision surface (OnlineView, sidebar HUD, TableView seat chrome). AP-PIO-02 forbids; sourceUtilPolicy whitelist enforces (Gate 5 CI-grep).
- Cross-venue silently aggregating sightings from different venues. Gate 3 schema reserves `venueId` field; Gate 5 read paths filter by venue.

### PM-15 — Convert uncertain sighting to known player (Active)

**Success criterion.** When current-session observation overlaps with one or more historical Player records (stability-weighted match score above threshold), recognition disambiguation flow (PIO-G4-DISAMB) surfaces candidate cards with confidence display (`'87% match score'` per AP-PIO-04 neutral copy). User picks candidate (link sighting to existing player) or "Create new record" (no match). System never auto-merges (red line #1).

**Distinct from PM-09** (find-player-by-visual-features): PM-09 is direct lookup. PM-15 is probabilistic comparison.

**Load-bearing constraint:** red line #1 (opt-in — user is always arbiter), red line #5 (no shame — neutral copy on mismatch per AP-PIO-04).

**Failure modes:**
- Auto-merge on high-confidence match. Forbidden — disambiguation UI is non-negotiable.
- Shame copy on mismatch. AP-PIO-04 forbids forbidden phrases ("Are you sure?", "We're confident this is X").
- Confidence display absent. Red line #2 (transparency) requires `'X% match'` rendered on every candidate card.

---

## PIO-G3-SLOG — Sighting-log parallel-store schema (BLOCKING Gate 4)

**Framing.** Gate 2 §D V3 ratified parallel-store decision (mirrors EAL `anchorObservationsStore.js`). Gate 3 specifies the record shape, indexes, write paths, retention, and cross-session aggregation read API sufficient for Gate 4 surface design + Gate 5 implementation.

**Evidence.**

- **EAL precedent (`anchorObservationsStore.js`).** Per-event observation rows; aggregate-on-read pattern; userId + parent-entity (anchorId / playerId) indexes; same `[userId, parentId, timestamp]` compound index for time-bounded reads.
- **PEO atomic-commit precedent (`draftsStorage.js:164-197`).** Single readwrite txn spanning multiple stores; oncomplete fires only if both succeed. Sighting writes that include a photo blob span `sightingLogs` + `playerPhotos` in one txn.
- **Gate 1 §Discovery 2** + **Gate 2 §D Stage D row "Sighting log store"**: parallel decision ratified (responsibility-clean — per-session observations stay in PM-12-keyed clothing store; cross-session aggregation lives in sighting-log).

**Recommendation.**

**New IDB store: `sightingLogs`** (v22)

```
keypath: sightingId (auto-increment)

indexes:
  by_userId:                   on .userId
  by_playerId:                 on .playerId
  by_userId_playerId_timestamp: on [.userId, .playerId, .timestamp]   // hot path: getSightingsByPlayer time-bounded
  by_sessionId:                on .sessionId
  by_userId_venueId:           on [.userId, .venueId]                  // future cross-venue scope (single-venue v1; index reserved)

record shape:
  {
    sightingId: <auto>,                        // primary key
    userId: 'self',                            // v1 single-user; broadens in v2
    playerId: number,                          // FK to players store
    sessionId: number,                         // FK to sessions store
    venueId: string | null,                    // graceful future amendment per PIO-G2 §D cross-venue reservation
    timestamp: number,                         // Date.now() at observation
    featuresSeen: {
      ageRange:      '20s' | '30s' | '40s' | '50s' | '60+' | null,
      skin:          'skin.medium' | ... | null,
      hair:          'hair.short-wavy' | ... | null,
      hairColor:     'color.black' | ... | null,
      beard:         'beard.full' | 'beard.goatee' | 'beard.stubble' | 'beard.none' | null,
      eyes:          'eyes.round' | ... | null,
      eyeColor:      'eye-color.brown' | ... | null,
      glasses:       'glasses.clear-frame' | 'glasses.sunglasses' | 'glasses.tinted' | 'glasses.none' | null,
      hat:           { palette: 'cap-team' | 'cap-plain' | 'beanie' | 'visor' | 'cowboy' | 'none' | 'other', otherText: string },
      wardrobe:      { palette: 'polo' | 'team-jersey' | 'hawaiian-shirt' | 'hoodie' | 'button-down' | 'tank' | 'suit' | 'tee' | 'other', otherText: string },
      jewelry:       { palette: 'silver-chain' | 'gold-chain' | 'cross-pendant' | 'wedding-band' | 'rolex' | 'bracelet' | 'earring' | 'other', otherText: string },
      logo:          { palette: 'dolphins' | 'yankees' | 'lakers' | 'gucci' | 'nike' | 'rolex' | 'other', otherText: string },
      ethnicityTags: string[] | null,
    },
    photoBlobId: string | null,                // FK to playerPhotos store (null if no photo this sighting)
    notes: string,                             // free-text owner note
  }
```

**Write paths.**

- **Cold-read entry** (table-build sub-surface, PM-12 sub-job): seat-edit row save → if seat is linked to a player, append a sightingLogs row + (optional) playerPhotos blob in one atomic txn.
- **Mid-session quick observation update** (between-hands-chris): same write path, single-tap from seat-edit row.
- **Post-session manual add** (Player Profile surface, PIO-G4-S1): owner can add or edit historical sightings; same store, manual-write path.

**Retention.** Configurable per-user TTL (default: 18 months — long enough for cross-season cross-session aggregation, short enough that very stale data doesn't dominate posterior). User-driven purge always available via Player Profile surface (delete-sighting affordance per record + Settings master purge for entire sighting-log). Per red line #4 (reversibility).

**Read API.** Two functions cover all known consumers:

```
getSightingsByPlayer(playerId, { startTimestamp, endTimestamp } = {}) → Sighting[]
  // Time-bounded reads via [userId, playerId, timestamp] compound index.

getSessionsForPlayer(playerId) → SessionRollup[]
  // Read-side aggregation: groups sightings by sessionId; emits per-session rollup
  // { sessionId, startedAt, endedAt, sightingCount, featuresSeenSummary, photoBlobIds[] }.
  // No extra store; no cache layer for v1 (sighting volumes are small — n<1000 per player even after years).
```

**sourceUtilPolicy whitelist** (Gate 5 CI-grep). `sightingLogs` reads ONLY from whitelisted surfaces: `PlayerEditorView`, `PlayerPickerView`, `PlayerProfileView` (PIO-G4-S1 net-new), `table-build` (cold-read entry). Blacklist: `OnlineView`, sidebar HUD, `TableView` chrome, `TournamentView`, `ShowdownView`, all live-decision surfaces. Mirrors AP-PIO-02 + AP-SCF source-discipline pattern.

**Confidence: High.** Mirroring EAL's `anchorObservationsStore` gives strong precedent + battle-tested patterns. Per-event grain + read-side rollup is the owner-decided shape (decision flag #4). PEO atomic-txn pattern handles photo-coupled writes.

---

## PIO-G3-STAB — Stability formula spec (BLOCKING Gate 4)

**Framing.** Gate 2 §E V3 ratified Bayesian-Beta as the recommended formula. Gate 3 specifies the formula, the n≥5 floor (per owner decision flag #3), the per-feature SIGHTING_FEATURE_PRIORS table, and the integration point (`scorePlayerMatch` extension via `stabilityWeights` parameter — already established in PEO Gate 1 §Discovery 4).

**Evidence.**

- **Villain-side convention (`weaknessDetector.js` + `bayesianConfidence.js:301`).** `credibleInterval(k, n, priorAlpha, priorBeta, level=0.95)` returns `{ lower, upper, mean, level }`. Posterior is `Beta(priorAlpha + k, priorBeta + (n - k))`. STAT_PRIORS at `bayesianConfidence.js:25-35` give villain-side examples (e.g., `foldToCbet: Beta(4.5, 5.5)`).
- **MoE-rendering precedent (`tendencyCalculations.js`).** `±X.X%` half-width suffix wired into `TendencyStats.jsx` + `SeatGrid.jsx` (SPR-017 close of FIND-001). Same convention applies here.
- **cold-read-chris stability-flag defaults table** (lines 70-89 of persona file). Authoritative for per-feature prior alignment.

**Recommendation.**

**New util: `src/utils/playerIdentification/stabilityCalc.js`** (Gate 5 implementation; spec'd here).

```
import { credibleInterval } from '../bayesianConfidence.js';

const STABILITY_FLOOR_N = 5;

export function computeStability(observedCount, totalSessions, prior = { alpha: 1, beta: 1 }) {
  if (totalSessions < STABILITY_FLOOR_N) return null;   // below floor — surfaces render placeholder
  const ci = credibleInterval(observedCount, totalSessions, prior.alpha, prior.beta, 0.95);
  return {
    mean: ci.mean,
    halfWidth: (ci.upper - ci.lower) / 2,    // ±X.X%
    lower: ci.lower,
    upper: ci.upper,
    label: classifyStability(ci.mean),
  };
}

function classifyStability(mean) {
  if (mean >= 0.7) return 'always';
  if (mean <= 0.3) return 'today-only';
  return 'sometimes';
}
```

**Floor rationale (n≥5).** SCF-G3 used n≥30 floor for hero-leak claims because hand-action samples are large (hundreds per session). Sighting samples are small (1 per session per feature observed; cross-session aggregation grows linearly in sessions seen). n≥5 is the smallest floor that gives the Beta posterior meaningful tightening over the prior. Below 5, surfaces render `"Insufficient sample (need {5 - n} more sightings)"` factual placeholder per AP-PIO-04 (no shame framing).

**SIGHTING_FEATURE_PRIORS table.** Per-feature α/β defaults reflecting cold-read-chris's expected stability semantics. Total pseudocount = α + β; data dominates after n ≈ pseudocount × 2.

```
ageRange:      Beta(4, 1)   // 'always' default; Skin tone equivalent — pseudo=5
skin:          Beta(4, 1)   // 'always' default per cold-read-chris — pseudo=5
ethnicityTags: Beta(4, 1)   // 'always' default — pseudo=5
hair:          Beta(3, 2)   // 'always' default with possible-override (haircut) — pseudo=5
hairColor:     Beta(3, 2)   // 'always' default with possible-override (dye) — pseudo=5
eyes:          Beta(4, 1)   // 'always' default — pseudo=5
eyeColor:      Beta(4, 1)   // 'always' default — pseudo=5
glasses:       Beta(2, 3)   // varies (clear-frame=always; sunglasses=today; tinted=unknown) — pseudo=5
beard:         Beta(1, 2)   // 'today' until repeat-observed; promotes after ≥2 sessions — pseudo=3
hat:           Beta(1, 4)   // 'today' default — pseudo=5
wardrobe:      Beta(1, 4)   // 'today' default per cold-read-chris clothing — pseudo=5
jewelry:       Beta(3, 1)   // chains/watches tend toward 'always' — pseudo=4 (Master Plan §A "always" semantics)
logo:          Beta(1, 4)   // logo-on-wardrobe → 'today' — pseudo=5
```

**Alignment check** with cold-read-chris stability-flag defaults table (lines 73-87): all 13 priors map directly to the table's `'always' / 'today' / unknown` defaults. `glasses` collapses 3 sub-types into one prior because glasses-as-feature is one IDB field; sub-type-specific stability is a Gate 4 UI concern (sub-type selector with sub-type-conditional default). Owner amends specific values during Gate 4 surface review if walkthrough surfaces a feature needing different prior.

**Integration with `scorePlayerMatch`.** Per PIO Gate 1 §Discovery 4, `scorePlayerMatch` in `src/hooks/usePlayerFiltering.js` is parameter-extensible. Gate 4-5 add a `stabilityWeights` parameter:

```
scorePlayerMatch(query, candidate, { stabilityWeights } = {})
  // stabilityWeights[feature] = computed-stability-mean from computeStability()
  // Match-score formula multiplies per-feature match contribution by stability weight:
  //   matchScore += stabilityWeights[feature] × features-equal-indicator
  // Stable matches (mean ≥ 0.7) contribute fully; today-only matches (mean ≤ 0.3) contribute weakly
```

**Confidence: High.** Bayesian-Beta is the system convention; floor is principled (smallest meaningful n); priors align with cold-read-chris defaults; integration point is parameter-extensible per existing pattern.

---

## PIO-G3-PHOTO — Photo storage spec (BLOCKING Gate 4)

**Framing.** Gate 2 §C ratified capture-with-explicit-purge. Gate 3 specifies the IDB store schema, the blobId scheme, the cascade-on-delete behavior, and the atomic-txn integration with `sightingLogs` writes. Gate 2 §C decision flag #5 chose Capture + crop step (1:1 crop modal); Gate 3 specifies the cropped blob persistence.

**Evidence.**

- **EAL sidecar precedent (`anchorObservationDraftsStorage.js`).** Sidecar pattern for transient/blob-heavy data; cascade-on-delete from parent entity; atomic txn spanning parent + sidecar stores.
- **Gate 2 §C ratifications:** blobId in separate store, per-record delete affordance, no auto-purge cadence, no encryption-at-rest baseline for v1, web-native `<input capture>`.

**Recommendation.**

**New IDB store: `playerPhotos`** (v22)

```
keypath: blobId (string)

indexes:
  by_userId:    on .userId
  by_playerId:  on .playerId
  by_sightingId: on .sightingId    // for "delete sighting also deletes its photo" cascade

record shape:
  {
    blobId: 'sighting:<playerId>:<timestamp>',  // deterministic; collision-impossible (timestamp)
    userId: 'self',
    playerId: number,
    sightingId: number | null,                  // null = direct-to-player photo (e.g., post-session add-photo from Player Profile); set = sighting-coupled
    blob: Blob,                                 // 1:1-cropped image data per camera-flow decision
    createdAt: number,                          // Date.now() at save
    expiresAt: number | null,                   // optional TTL; null = no auto-purge (Gate 2 ratified)
  }
```

**blobId scheme.** `'sighting:<playerId>:<timestamp>'` is deterministic (no UUID dependency) + collision-impossible (timestamp resolution at ms is sufficient given ≤1 photo per sighting). For direct-to-player photos (post-session add from Player Profile, no sighting context), scheme is `'player:<playerId>:<timestamp>'`.

**Lifecycle.**

- **Capture:** PlayerEditorView seat-edit row → tap '📷 Add photo' → `<input type="file" capture="environment">` → native camera → modal preview with 1:1 crop frame (react-easy-crop or canvas-API per Gate 4 spec) → Accept → cropped blob written atomically to `playerPhotos`.
- **Display:** Player Profile surface + PlayerEditorView thumbnail + recognition disambiguation candidate cards (PIO-G4-DISAMB) — read by `blobId` lookup; rendered as `<img src={URL.createObjectURL(blob)} />` in component lifecycle (revoked on unmount).
- **Delete (per record):** Player Profile surface red-X affordance → confirm modal (N05 binding per PIO-G2 §E recommended-follow-ups) → atomic delete from `playerPhotos`.
- **Cascade on Player record delete:** Settings purge of a Player record cascades to delete all `playerPhotos` rows where `playerId` matches — single readwrite txn spanning `players` + `playerPhotos` + `sightingLogs` (PEO `commitDraft` atomic-txn pattern, expanded scope).
- **Cascade on sighting delete:** deleting a `sightingLogs` row cascades to delete the corresponding `playerPhotos` row (matched via `sightingId` index) when `photoBlobId` was set.

**Atomic-txn pattern** for sighting + photo coupled writes:

```
const tx = db.transaction([SIGHTING_LOGS_STORE, PLAYER_PHOTOS_STORE], 'readwrite');
const sightingsStore = tx.objectStore(SIGHTING_LOGS_STORE);
const photosStore = tx.objectStore(PLAYER_PHOTOS_STORE);
sightingsStore.add(sightingRecord);
if (photoBlob) photosStore.add(photoRecord);
tx.oncomplete = () => resolve();   // both succeeded
tx.onerror = () => reject();       // both rolled back
```

**Settings master "photo capture enabled" toggle** (PIO-G4-SET carry-forward; spec'd in Gate 4): default ON; disable hides all photo capture buttons app-wide for users in always-prohibited venues. Ratified at Gate 2 §C.

**Confidence: High.** EAL sidecar precedent is direct; PEO atomic-txn pattern handles coupled writes; cascade-on-delete is structurally clean per FK pattern; blobId scheme is collision-impossible + URL-friendly.

---

## PIO-G3-PALETTE — Asset palettes for 4 net-new categories (BLOCKING Gate 4)

**Framing.** Owner decision flag #2 ratified hybrid per category (closed-enum primary + free-text 'other' slot). Gate 3 enumerates initial palette values for `wardrobe`, `jewelry`, `logo`, and extended `hat`. Owner amends in Gate 4 surface review. Ethnicity remains `string[]` curated-autocomplete (settled by table-build Gate 2; out of PIO-G3-PALETTE scope).

**Evidence.**

- **PEO precedent (`avatarFeatureConstants.js`).** `AVATAR_CATEGORIES = ['skin', 'hair', 'beard', 'eyes', 'glasses', 'hat']`. `DEFAULT_AVATAR_FEATURES` defines per-category defaults. Feature namespacing: `'category.kebab-id'`.
- **cold-read-chris §Stability-flag defaults table** lines 73-87 — informs which palette items are recognition-load-bearing.
- **Cultural-sensitivity V4 raised in Gate 2 §D** — palette items need labels users understand; tooltips for ambiguous items (e.g., "kufi cap" vs generic "hat" — non-blocking pattern-quality concern).

**Recommendation.**

**Extension to `src/constants/avatarFeatureConstants.js`:**

```
export const AVATAR_CATEGORIES = [
  'skin', 'hair', 'beard', 'eyes', 'glasses',  // existing (PEO)
  'hat',                                         // existing — palette extended below
  'wardrobe',                                    // NEW
  'jewelry',                                     // NEW
  'logo',                                        // NEW
  // Note: ethnicity, ageRange, hairColor, eyeColor are NOT in AVATAR_CATEGORIES;
  // they live as flat fields on the Player record (existing PEO pattern for hairColor + eyeColor).
];

// Palette items for the 4 net-new + extended-hat categories
// Hybrid: closed-enum primary + 'other' slot with free-text otherText
export const HAT_PALETTE_EXTENDED = [
  'none', 'cap-team', 'cap-plain', 'beanie', 'visor', 'cowboy', 'kufi', 'other'
];

export const WARDROBE_PALETTE = [
  'hawaiian-shirt', 'team-jersey', 'polo', 'hoodie',
  'button-down', 'tank', 'suit', 'tee', 'other'
];

export const JEWELRY_PALETTE = [
  'silver-chain', 'gold-chain', 'cross-pendant', 'wedding-band',
  'rolex', 'bracelet', 'earring', 'other'
];

export const LOGO_PALETTE = [
  'dolphins', 'yankees', 'lakers', 'rolex', 'gucci', 'nike', 'other'
];

// Per-category default — 'other' selected requires non-empty otherText (validation in editor)
export const DEFAULT_HYBRID_FEATURE = { palette: 'none', otherText: '' };
```

**Storage shape on Player record** (additive; PEO `avatarFeatures` object grows):

```
player.avatarFeatures = {
  skin: 'skin.medium',          // existing flat string
  hair: 'hair.short-wavy',
  hairColor: 'color.black',
  beard: 'beard.none',
  beardColor: 'color.black',
  eyes: 'eyes.round',
  eyeColor: 'eye-color.brown',
  glasses: 'glasses.none',
  hat: { palette: 'cap-team', otherText: '' },        // EXTENDED — was flat string in PEO; migrate-on-read
  wardrobe: { palette: 'polo', otherText: '' },       // NEW
  jewelry: { palette: 'silver-chain', otherText: '' },// NEW
  logo: { palette: 'dolphins', otherText: '' },        // NEW
};

player.ageRange = '30s';                              // NEW flat field; not in avatarFeatures
player.ethnicityTags = ['Cuban'];                     // NEW flat field; string[] — settled by table-build Gate 2
```

**Hat migration nuance.** PEO's `hat: 'hat.cap-team'` is a flat string; PIO-G3-PALETTE upgrades it to `{ palette, otherText }` shape for hybrid uniformity. Migrate-on-read pattern: legacy `hat: 'hat.cap-team'` reads as `{ palette: 'cap-team', otherText: '' }` via a getter; persisted-on-next-write. Avoids forcing a v22 mutation on existing records (additive-only IDB v22 invariant).

**Asset palettes (SVG layer additions for AvatarRenderer).** Gate 5 implementation; Gate 3 reserves the layer-ordering spec:

```
AvatarRenderer layer order (top to bottom in z):
  hat → glasses → eyes → eyeColor → beard → beardColor → hair → hairColor → wardrobe → jewelry → skin
  // logo and "other" free-text DO NOT render as SVG layers; they render as
  // sticky-note chips below the avatar (label-only, no graphic).
```

**Confidence: Medium-High.** Palette item lists are starter values; Gate 4 surface review tunes against owner's actual recall of cross-session patterns. Hat-shape migration nuance is the single non-additive complexity; migrate-on-read pattern preserves additive-only IDB invariant.

---

## PIO-G3-MIG — IDB v22 migration spec (BLOCKING Gate 4)

**Framing.** Gate 2 §D ratified silent migration + re-tag affordance for legacy ethnicity values. Gate 3 specifies the multi-store v22 migration shape using the `max(currentVersion+1, targetVersion)` dynamic pattern from `gate4-p3-decisions.md §2`. Gate 5 implements the actual migration script.

**Evidence.**

- **Current `database.js:50` `DB_VERSION = 21`** (latest: telemetryConsent v21, 2026-05-01).
- **EAL Gate 4 P3 §2 dynamic-version pattern** — multi-store bumps in single version supported via `max(currentVersion+1, targetVersion)`.
- **Existing `runMigrations(db, transaction, oldVersion)` orchestrator** at `database.js` (per Explore agent finding) — additive-guard pattern proven for v14 → v21 chain.
- **EAL v18 → v19 precedent:** 4 anchor stores + perceptionPrimitives created in single migration; mirrors PIO-G3-MIG's 2-store creation.

**Recommendation.**

**Version bump: `DB_VERSION = 22`** (or `Math.max(CURRENT_DB_VERSION + 1, 22)` if other projects co-target the same version).

**`migrateV22(db, transaction)` shape:**

```
function migrateV22(db, transaction) {
  // 1. Create sightingLogs store (PIO-G3-SLOG schema)
  if (!db.objectStoreNames.contains('sightingLogs')) {
    const store = db.createObjectStore('sightingLogs', {
      keyPath: 'sightingId',
      autoIncrement: true,
    });
    store.createIndex('userId', 'userId', { unique: false });
    store.createIndex('playerId', 'playerId', { unique: false });
    store.createIndex('userId_playerId_timestamp', ['userId', 'playerId', 'timestamp'], { unique: false });
    store.createIndex('sessionId', 'sessionId', { unique: false });
    store.createIndex('userId_venueId', ['userId', 'venueId'], { unique: false });
  }

  // 2. Create playerPhotos store (PIO-G3-PHOTO schema)
  if (!db.objectStoreNames.contains('playerPhotos')) {
    const store = db.createObjectStore('playerPhotos', { keyPath: 'blobId' });
    store.createIndex('userId', 'userId', { unique: false });
    store.createIndex('playerId', 'playerId', { unique: false });
    store.createIndex('sightingId', 'sightingId', { unique: false });
  }

  // 3. NO mutations on existing players store. New fields are forward-compatible:
  //    - ageRange: undefined on legacy records; UI renders 'unknown'
  //    - ethnicityTags: legacy string field reads as 1-element string[] via shim (Gate 2 §D ratification)
  //    - new avatarFeatures categories (wardrobe/jewelry/logo): undefined on legacy; UI defaults
  //    - hat shape upgrade: migrate-on-read pattern per PIO-G3-PALETTE
}
```

**runMigrations integration** (additive guard):

```
export function runMigrations(db, transaction, oldVersion) {
  // ... existing v1..v21 migrations
  if (oldVersion < 22) migrateV22(db, transaction);
}
```

**Silent migration of legacy ethnicity (Gate 2 §D ratified).** No v22 boot prompt. `ethnicityTags` reads as `[legacyEthnicityString]` via getter shim if record predates v22. Owner re-tags via Player Profile surface (PIO-G4-S1) when next editing the record. No forced upgrade; data integrity preserved.

**Player record delete cascade.** Gate 5 implementation extends existing `deletePlayer(playerId)` to span 3 stores in single readwrite txn:

```
const tx = db.transaction(['players', 'sightingLogs', 'playerPhotos'], 'readwrite');
// Delete the player record
// Delete all sightingLogs rows where playerId matches
// Delete all playerPhotos rows where playerId matches
tx.oncomplete = () => resolve();
```

**Confidence: High.** Multi-store migration is well-established (EAL v18→v19); additive-only invariant preserved; silent-migration shim avoids forced v22 upgrade prompts; cascade-on-delete pattern mirrors PEO commitDraft atomic-txn.

---

## Output 3 — Recognition-search ranking (recommended; owner tunes)

**Framing.** Gate 1 §Discovery 4 noted `scorePlayerMatch` is parameter-extensible; Gate 2 §D row "Search ranking" confirmed extension via `stabilityWeights` parameter. Gate 3 specifies the 8-dimension default weighting. Owner tunes empirically during Gate 4 surface walk-through.

**Recommendation.** Composite match score formula:

```
matchScore = sum over features (
  featureWeight[f]
  × stabilityWeights[f]              // 0..1, from computeStability() mean (PIO-G3-STAB)
  × featureMatchIndicator[f]         // 1 if observed feature equals candidate feature, 0 otherwise; partial fractions for fuzzy categories
)

featureWeight defaults (sum to 1.0):
  name (incl. nickname): 0.35   // strongest signal when present
  ageRange:              0.10   // 5-bin discriminator
  skin:                  0.08
  ethnicityTags:         0.10   // multi-tag overlap rewarded; identification-utility-first stance per owner
  hair (style + color):  0.08   // sub-features summed
  beard:                 0.04
  glasses:               0.05
  hat:                   0.02
  wardrobe:              0.05   // weak per stability
  jewelry:               0.08   // moderate per stability
  logo:                  0.03
  venue-recency:         0.02   // boost for recent sightings at same venue (proxy for "more likely the player I just saw")
                       ─────
                         1.00
```

**Rationale.** `name + nickname` dominates because cold-read-chris §What a surface must offer #4 is "single-screen match-or-create with name as the primary input." `ageRange + ethnicityTags + skin + hair` are the next tier (high-stability features per cold-read-chris stability defaults table). `wardrobe + hat + logo` are weakest (low-stability per cold-read defaults). `jewelry` is middle-tier (chains/watches tend toward 'always' per Master Plan §A). `venue-recency` is the only non-feature signal — a small boost for sightings within the last 7 days at the same venue surfaces the "I just saw this player" recall path.

**Owner amends in Gate 4 surface review** if walkthrough surfaces a weighting that mismatches the empirical match-quality. The composite is stability-weighted at runtime — if a feature happens to be `today-only` for a particular player, its contribution is weakened automatically without changing the static weights.

**Confidence: Medium.** Static weights are starter values informed by cold-read-chris defaults; empirical tuning is a Gate 4 concern.

---

## Appendix A — 6-scenario walkthrough (cold-read-chris exercising each surface)

**Format:** For each scenario, walk a concrete cold-read-chris situation and ask: "Which PIO surface does this exercise? Which JTBD does it map to? Does the surface spec hold up?"

### Scenario 1 — New venue, all unknown (50% unknown)

**Situation.** Chris arrives at a new $1/$3 venue. 8 seats; all unknown. Time budget: 5-10 min total.

**Surface(s) exercised.** Table-build entry (existing audited sub-surface) → PlayerEditorView extensions (PIO-G4-PEX) for capturing wardrobe/jewelry/age/logo + camera capture (PIO-G4-S2).

**JTBD(s).** PM-13 (describe-someone-into-existence) primary; PM-12 (today-only seat observations) sub-job.

**Walkthrough verdict.** Surface spec holds. Per-seat budget ~30-60s; cold-read-chris hits "save with name unknown + features captured" path. Photo capture deferred to mid-session or post-session (per Stage C three-context table — capture permitted but not recommended at session-start time budget).

### Scenario 2 — Familiar venue, 3 of 8 half-recognized (cross-session aggregation)

**Situation.** Same venue Chris plays weekly. 3 of 8 seats are "I think I've seen them before"; 5 unknown.

**Surface(s) exercised.** PlayerPickerView (PEO existing) with `scorePlayerMatch` extended via `stabilityWeights` (PIO Gate 3 spec) → recognition disambiguation flow (PIO-G4-DISAMB) when partial-match → Player Profile (PIO-G4-S1) for review.

**JTBD(s).** PM-15 (convert-uncertain-sighting-to-known-player) primary; PM-14 (build-temporal-attribute-history) read-side.

**Walkthrough verdict.** Surface spec holds. Disambiguation flow surfaces 1-3 candidate cards per uncertain seat with confidence display ("75% match"); user picks "match X" or "Create new"; AP-PIO-04 neutral copy throughout.

### Scenario 3 — Mid-session quick observation update (between-hands-chris)

**Situation.** Mid-session hand 47. Player at seat 5 just took off hoodie revealing silver chain. Chris has ≤30s before next deal.

**Surface(s) exercised.** PlayerEditorView seat-edit row → quick-edit jewelry field → save → atomic write to `sightingLogs` row + (no photo this time).

**JTBD(s).** PM-14 (build-temporal-attribute-history) primary; PM-12 (today-only seat observation) sub-job.

**Walkthrough verdict.** Surface spec holds. PM-14 + PM-12 share write path; sighting-log accumulates naturally. Photo capture not exercised (≤30s budget per Stage C).

### Scenario 4 — Post-session sighting-log review (post-session-chris)

**Situation.** Post-session at home. Chris reviews sighting log of 3 players from today's session. Wants to: (1) delete 1 sighting that was a misidentification, (2) re-tag 1 ethnicity (legacy single-string upgraded to multi-tag), (3) add a photo from the post-session memory.

**Surface(s) exercised.** Player Profile / Sighting History (PIO-G4-S1) — primary host for review-mode editing.

**JTBD(s).** PM-14 (build-temporal-attribute-history) review-mode; PM-13 (describe-someone-into-existence) for the photo-add.

**Walkthrough verdict.** Surface spec holds. Per-record delete affordance + re-tag affordance + photo-capture-from-Player-Profile path all named in PIO-G4-S1 carry-forward. N05 confirm-on-photo-delete binding.

### Scenario 5 — Disambiguation gone wrong (red line #5 stress test)

**Situation.** System suggests "match Bobby" with 78% confidence; user knows it's not Bobby (it's Bobby's brother). User picks "Create new record."

**Surface(s) exercised.** Recognition disambiguation flow (PIO-G4-DISAMB).

**JTBD(s).** PM-15 (convert-uncertain-sighting-to-known-player); red line #5 (no shame).

**Walkthrough verdict.** Surface spec holds. AP-PIO-04 forbids forbidden phrases ("Are you sure?", "We're confident this is X", "Why no match?"). Allowed: factual neutral copy ("Create new record" / "Match Bobby") + confidence display ("78% match score"). User picks freely; system records the create-new without prompting.

### Scenario 6 — Casino prohibits photos (Settings master toggle)

**Situation.** Chris plays at a venue that prohibits photos. Disables Settings master "photo capture enabled" toggle.

**Surface(s) exercised.** Settings (PIO-G4-SET).

**JTBD(s).** Cross-cutting (red line #1 opt-in at app scope; red line #4 reversibility).

**Walkthrough verdict.** Surface spec holds. Toggle hides all photo capture buttons app-wide (PlayerEditorView seat-edit row + Player Profile + recognition disambiguation flow). Existing photos remain readable (display permitted; capture disabled). Re-enabling restores capture availability.

---

## Appendix B — AP-PIO refusal catalog inline (audit-doc-only tier)

Per Gate 2 §E owner ratification (audit-doc-only tier; no companion `copy-discipline.md` or `anti-patterns.md` files). Re-stated here for Gate 3 closure + Gate 5 reference. AP-PIO-01..05 unchanged from Gate 2; binding.

- **AP-PIO-01** — Demographic data fed to exploit engine. **Refused.** Sighting-log entries, ethnicity tags, age range, wardrobe/jewelry/logo features MUST NOT be passed to `src/utils/exploitEngine/*` or `src/utils/rangeEngine/*`. Engine consumes hand-history-derived signals only (VPIP, PFR, AF, observed bet-sizing). **Red line #8.**
- **AP-PIO-02** — Cross-surface contamination. **Refused.** Sighting-log + photo display + ethnicityTags + 4 net-new avatarFeatures categories MUST NOT render on OnlineView, sidebar HUD, TableView seat chrome, TournamentView, ShowdownView, or any live-decision surface. **Red line #8.** Whitelist enforced by sourceUtilPolicy CI-grep at Gate 5.
- **AP-PIO-03** — Auto-photo-capture. **Refused.** Photo capture button MUST be user-initiated per capture event. No auto-capture on detection events; no batch-capture across multiple players. **Red line #1** at per-event scope.
- **AP-PIO-04** — Shame framing on misidentification. **Refused.** Forbidden copy on disambiguation flow + create-new flow: "Are you sure?", "We're confident this is X", "Why no match?", "This may be incorrect." **Red line #5.**
- **AP-PIO-05** — Demographic-targeted recommendations. **Refused.** Recommendation surfaces (exploit briefings, lesson assignments, drill scheduler outputs, refresher card filters) MUST NOT use Player demographic data as filter or weighting inputs. **Red lines #8 + #5.**

**EAL-inherited (transitively):** AP-01..09 from `docs/projects/exploit-anchor-library/anti-patterns.md` bind PIO surfaces that reuse EAL infrastructure (sighting-log mirrors EAL anchorObservations precedent; recognition disambiguation may reuse EAL confidence-display primitives).

---

## Stage table (5-stage verdict)

| Stage | Verdict | Closure |
|-------|---------|---------|
| A — Persona sufficiency | ✅ GREEN | Inherited from PIO-G1 + table-build Gate 2; chris-live-player + cold-read-chris (Proto, ratified) + post-session-chris cover PIO. No new authoring. |
| B — JTBD detail-out | ✅ GREEN | PM-13/14/15 promoted Proposed → Active with success criteria + distinct-from + load-bearing constraints + 2-3 failure modes per umbrella. PM-10/11/12 sub-jobs unchanged. |
| C — Schema specs (SLOG / STAB / PHOTO / PALETTE / MIG) | ✅ GREEN | All 5 PIO-G3-* carry-forwards specified with full schemas, integration contracts, and migration patterns. Owner amends inline in Gate 4 surface review. |
| D — Recognition-search ranking + SIGHTING_FEATURE_PRIORS | 🟡 YELLOW | Static weights + per-feature priors are starter values; Gate 4 surface walk tunes against empirical match-quality. Aligned with cold-read-chris stability-flag defaults. |
| E — AP-PIO + 9-red-line walk for new surfaces | ✅ GREEN | Gate 2 §E catalog + Stage D 9-red-line table inherited; PIO-G3-PHOTO + PIO-G3-SLOG schemas consistent with all 5 AP-PIO refusals. |

**Overall Gate 3 verdict: ✅ GREEN.** Gate 4 (Design surfaces) unblocked. 7 PIO-G4-* carry-forwards carried from Gate 2 (PIO-G4-S1 / S2 / PEX / PVA / DISAMB / SET / MIG); no new Gate 4 carry-forwards surfaced this session.

---

## Open questions deferred to Gate 4

1. **Per-feature SIGHTING_FEATURE_PRIORS tuning.** Initial values authored above; Gate 4 surface walk may surface features needing different prior (e.g., `glasses` collapses 3 sub-types into one prior — Gate 4 may split if walkthrough demands).
2. **Recognition-search ranking weights tuning.** Static weights authored above; owner empirically tunes during Gate 4 disambiguation-flow walk-through.
3. **Photo-replacement vs photo-history (PIO-G4-S1).** v1 ships photo-replacement (single current photo per record; new capture overwrites). Photo-history (multiple photos timestamped) is Phase 2 (Gate 4 v2 deferral).
4. **Hat shape migrate-on-read implementation detail.** Getter shim vs migrate-on-write decision (additive-only IDB invariant prefers shim; performance impact negligible at <1k Player records).
5. **`react-easy-crop` vs canvas-API for camera-flow crop modal.** Library adds ~3kB gzipped; canvas-API is no-dep but ~150 lines more code. Owner amends in Gate 4 surface review.
6. **Ethnicity tag set initial values.** Gate 2 §D V4 raised: which ethnicity values appear in tag picker autocomplete? Gate 4 surface (PIO-G4-S1 + table-build entry) ratifies initial set with owner; tag set is editable anytime per red line #4.
7. **Cross-venue scope amendment** (already deferred per Gate 1; revisit when Chris plays at 2+ venues; `venueId` field reserved on `sightingLogs` records).
8. **Tournament-mode toggle** (deferred per Gate 1 + Gate 2; cross-venue scope subsumes this; revisit at v2 if tournament play exposes the gap).

---

## Change log

- 2026-05-02 — Created. Gate 3 Research for Player Identification v2 per Master Plan §A Phase-3 entry. 5 PIO-G3-* carry-forwards from Gate 2 specified (SLOG / STAB / PHOTO / PALETTE / MIG). 5 owner-decided ratifications captured in plan-mode AskUserQuestion (decade ranges + hybrid palette + Bayesian-Beta + per-event grain with read-side rollups + capture-with-1:1-crop). Inline-handled with rationale: SIGHTING_FEATURE_PRIORS (per-feature α/β aligned with cold-read-chris stability defaults), recognition-search ranking weights (8-dimension; owner tunes empirically). PM-13/14/15 detail-out shipped (state Proposed → Active with success criteria + distinct-from + load-bearing constraints + 2-3 failure modes each). 6-scenario walkthrough Appendix A. AP-PIO-01..05 catalog re-stated inline (audit-doc-only tier per Gate 2). Audit-only — zero `src/` diff. **Master Plan A/D Gate 3 stagger COMPLETE** — both A-line (PIO-G3) and D-line (SCF-G3) Phase-3 Research gates shipped. WS-012 (SCF-G4 Design) is next natural anchor in alternation. PIO Gate 4 unblocked.
