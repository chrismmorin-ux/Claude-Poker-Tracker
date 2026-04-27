# Situational Persona — Cold-Read Chris

**Type:** Situational (derived from [Chris, Live Player](../core/chris-live-player.md))
**Evidence status:** Proto
**Last reviewed:** 2026-04-26
**Owner review:** Pending

---

## Snapshot

Chris is sitting down at a table for the first time — either at a new venue, on a new day, or at a table where most seats fill with players he has never seen before. He is the one populating every seat himself. Some faces half-register from prior sessions; most are strangers. He is observing visual features, picking up name fragments off dealer plaques and conversation, occasionally absorbing volunteered cues ("told me he was Serbian"), and committing the observations to the app while introducing himself and watching first hands shape up.

This is **not** a polished post-session edit, **not** a single seat swap, and **not** an in-table emergency. It is the entry act of an entire session — typically the longest single block of player-management activity Chris will do at the table — and it is currently spread across three loosely-coordinated surfaces (`PlayerPickerView`, `PlayerEditorView`, `PlayersView`) with seams that show.

---

## Situation trigger

- Chris arrives at a table, occupies hero's seat, and needs to populate the other 5–8 seats over the next 5–15 minutes.
- New-venue variant: nearly every face is unknown; dominant action is **create + observe**.
- Familiar-venue variant: 2–4 faces are partially recognized, the rest are unknown; dominant action is **match-or-create**, with significant cost to false matches and to false misses (creating a duplicate of an existing record).
- Exits when: every seat that should have a player is assigned, and Chris has captured enough features per record that next session's recognition will work.

## Context (deltas from between-hands and seat-swap)

- **Time pressure:** Loose at the start (5–15 min before first hand if Chris arrives early), tightening as hands approach. Unlike Seat-Swap Chris (10–60s) and Mid-Hand Chris (3–30s), Cold-Read has the longest available window per persona-action of any in-session player-management task.
- **Attention:** Sustained head-down is socially acceptable in the first 2–3 minutes ("setting up notes"), then becomes intermittent.
- **Hands:** Often two-handed during this window. The dealer hasn't pitched cards. This is one of the few moments where the one-handed-landscape constraint relaxes.
- **Cognitive load:** Moderate. Two parallel tasks: visual recognition (pattern matching against the player database) AND fresh observation (capturing features for unknowns). Both compete for working memory.
- **Information sources:** Dealer plaque (first name, sometimes), volunteered conversation (accent, ethnicity, "I'm new here"), visible features (skin, build, hair, glasses-type, clothing-today), behavioral hints from first hand (seat posture, chip-stack handling).

## Goals

- **Populate every seat fast enough that the first hand isn't compromised.** ~5 min for 7 seats is realistic if half the seats are matches; ~10 min if all are creates.
- **Match recognized players to their existing records reliably**, even when a beard, haircut, or today's clothing has changed since last session.
- **Capture enough features on new players that next session's recognition works.** Features that won't survive (today's hat, today's beard variant, today's shirt) are observation-grade, not record-grade.
- **Avoid creating duplicate records** for players who already exist — and avoid false matches that pin one player's stats onto another.
- **Keep the observation feel light** — entering player notes should look like glancing at the phone, not running a forensic interview.

## Frustrations

- **Three-surface seam.** PlayerPickerView (search), PlayerEditorView (create), PlayersView (database browser + alt seat-fill grid) all serve overlapping needs but require explicit user-driven transitions. Match-or-create is not a single fluid action; it is two separate flows joined by a CTA.
- **Filter row eats the landscape viewport.** PlayersView's filter row is 209px / ~29% of the 1600×720 reference viewport (DCOMP-W4-A1 F8). PlayerPickerView's chips are smaller but still consume a meaningful header band.
- **Keyboard occlusion.** Virtual keyboard in landscape covers the bottom half of the screen. Current name-search input + result list is laid out vertically, so typing a name hides the very candidate list the typing is supposed to narrow. Chris is typing blind.
- **Feature buckets don't reflect feature stability.** Glasses *type* (clear-frame ≈ always; sunglasses ≈ today; tinted/prescription ≈ unknown) is treated identically with hair-color (sticky) and hat (today). The current `avatarFeatures` schema has no stability dimension, so search ranking can't discount unstable features and a new beard breaks "John W" recognition.
- **Hair vocabulary is recognizability-thin.** Current hair-style swatches don't differentiate the cues Chris actually uses to recognize someone across sessions (e.g., receding hairline, ponytail, buzz, slick-back).
- **Ethnicity is an enum.** Limited categories collapse the discriminations Chris actually makes ("Irish", "Serbian", "Punjabi") into too-broad buckets. He can't capture what he heard or saw.
- **No clothing field anywhere.** Today's vest is a strong recognizer for a 5-minute attention window but a poor durable identifier. There is no per-seat-per-session observation slot for it. If he writes it into Notes, it pollutes the player record forever.
- **No dedup affordance on save.** When stable-feature + partial-name overlap with an existing record, the editor saves a fresh duplicate silently. Chris discovers it next session and has to merge by hand.
- **Avatar features absent on every player by default.** Per DCOMP-W4-A1 F13, seed players have empty `avatarFeatures` and render as "S" monograms — the visual recognition channel never actually fires for the database he relies on.

## Non-goals

- **Deep player profile editing.** Notes, range tagging, style-tag refinement — these belong to Post-Session Chris.
- **Bulk database operations.** Cleanup, export, mass-delete — out of scope for this situation.
- **AI image-recognition or photo-upload at scale.** Chris is not photographing players; the social cost is too high. Image upload remains a discoverable affordance, not a primary path.
- **Sub-second decision support.** That is Mid-Hand Chris. Cold-Read can tolerate a 200ms result-list refresh.

---

## Constraints specific to this persona

- **Time budget:** 5–15 min total for the situation. Per-seat budget: ~30s for a clean match, ~60s for a create with ≤3 features captured, up to 2 min for a create with notes + ethnicity + features + clothing-today.
- **Error tolerance:** Low for false matches (pin one player's stats on another → silently corrupts data for weeks). Low for accidental duplicates (no automatic recovery; manual merge later). Moderate for typos (Chris will fix in a Post-Session Chris pass).
- **Visibility tolerance:** Live candidate list must stay visible while typing or selecting features. Keyboard must not occlude it. Minimum target: input + result list both above the keyboard fold simultaneously in 1600×720 landscape with virtual keyboard up.
- **Recovery expectation:** Saved duplicates surface as a "Possible matches" panel before save commits — manual-merge UI preserves stats, range profile, and hand history of the surviving record. No silent auto-merge; no "this action cannot be undone" copy on the merge.
- **Stability semantics:** Each visual feature carries a stability flag — `always` / `today` / `unknown`. Defaults vary by feature and sub-type (clear-frame glasses default `always`; sunglasses default `today`; hair-color default `always`; today's hat default `today`). User can override.

## Stability-flag defaults (load-bearing for search ranking)

| Feature | Default stability | Override common? |
|---|---|---|
| Skin tone | `always` | Rare |
| Build | `always` | Rare |
| Gender (male default) | `always` | Rare |
| Ethnicity tag(s) | `always` | Rare |
| Hair color (baseline) | `always` | Possible (dye) |
| Hair style | `always` | Possible (haircut) |
| Beard presence | `always` if observed across ≥2 sessions; otherwise `today` | Yes |
| Beard variant (full / goatee / stubble) | `today` until repeat-observed | Yes |
| Eye color | `always` | Rare |
| Glasses — clear-frame | `always` | Rare |
| Glasses — sunglasses | `today` | Common |
| Glasses — tinted / prescription-style | `unknown` | Yes |
| Hat | `today` | Yes |
| Clothing item (vest, chain, jersey, hoodie) | `today` (per-seat-per-session observation) | Promote to `always` after repeat-observation |

Search ranking weights `always` features highest, `today` features lowest, with a recency-adjusted boost when a `today` feature matches the current session. **A new beard or new haircut should not displace a partial-name + stable-feature match from the top of the candidate list.**

---

## Related JTBD

- **JTBD-PM-02** assign a known player to a seat — recognition path
- **JTBD-PM-03** create a new player and assign to seat — observation path
- **JTBD-PM-05** batch-assign players to seats at session start — the umbrella job
- **JTBD-PM-09** find a player by visual features — heavy use here, including the new stable-vs-ephemeral discrimination
- **JTBD-PM-10 (proposed)** cold-read a table at session start with mixed match-or-create flow
- **JTBD-PM-11 (proposed)** detect potential duplicates on save and offer manual merge
- **JTBD-PM-12 (proposed)** capture today-only observations (clothing, today's hat, sunglasses) as per-seat-per-session features without polluting the player record

---

## What a surface must offer

1. **Single-screen match-or-create loop.** Live candidate list always visible while user types name fragment, picks features, or types an ethnicity tag. "Create new" is a continuation past zero matches, not a separate route.
2. **Keyboard-aware landscape layout.** Input + candidate list both above the keyboard fold simultaneously. Feature controls flank rather than stack below.
3. **Stable-vs-ephemeral feature controls.** Every feature swatch shows its current stability (always / today / unknown). Defaults are smart per feature/sub-type; one tap to override.
4. **Recognizability-first hair vocabulary.** Hair styles distinguish the cues used cross-session: hairline shape (full / receding / bald), length (short / medium / long), texture (straight / curly / coiled), management (loose / tied / slicked).
5. **Ethnicity as expanding tag list.** Free-text input with autocomplete from a curated list (regional / national / cultural tags including European specifics — Irish, Serbian, Polish, Greek, Punjabi, etc.). Stored as an array on the player. Abbreviations rendered where intuitive (UK / US-S / N.Eur).
6. **Clothing as per-seat-per-session observation.** Lives on the seat-observation, not the player record. Promotes to a sticky note on the player only after repeat-observation across sessions.
7. **Possible-matches panel before save.** When stable-feature + partial-name overlap with an existing record crosses threshold, surface candidates above the save button. Tap → side-by-side compare → manual merge into the existing record (stats + range profile + hand history preserved). Final-edit pass on the merged record before commit.
8. **Avatar preview that reflects the rich feature set.** Default-male, build-aware, with the recognizability-first hair vocabulary rendered. Fallback monogram only when zero features are set.
9. **Per-seat assignment loop with progress indicator.** "Seat 4 of 8 filled" or equivalent — Chris should know how far through he is without counting.
10. **Last-played metadata on every candidate row.** Date of last session + total hands seen + 1–2 stable identifying features rendered as chips, so candidate-recognition is high-bandwidth.

## What a surface must NOT do

- Open a second route for "create" when the user types past zero matches. The loop must stay on one screen.
- Treat all features identically. A surface that can't distinguish "always-true" from "today-only" cannot rank the candidate list correctly.
- Auto-merge on save without user confirmation. Manual-merge with side-by-side compare is non-negotiable.
- Pollute the player record with today-only observations. Vest-today is per-seat-per-session, not a Notes field append.
- Hide the candidate list under the virtual keyboard. Typing must keep narrowing visible.
- Require viewport >720px height for the primary loop to be usable.

---

## Open questions (for Gate 2)

- **Ringmaster overlap.** Ringmaster (home-game host) does a similar batch-assign at the start of every session, but with a database of regulars where matching dominates and creates are rare. Should Cold-Read Chris and Ringmaster share the same surface, or does Ringmaster get a fast-path that prioritizes match over create?
- **Duplicate-detection threshold.** What feature-overlap-plus-name-overlap score should trigger the "Possible matches" panel? Too aggressive → noise; too lax → silent duplicates. Worth roundtable input.
- **Clothing promotion rule.** "Repeat-observed across ≥2 sessions promotes today→always" — is 2 sessions the right threshold? Should it be configurable, or is the rule baked?
- **Today-feature lifetime.** A `today` flag should presumably auto-clear at session end. Does it clear silently, or does Post-Session Chris see a review prompt ("3 today-features observed this session — promote, demote, or discard")?

---

## Change log

- 2026-04-26 — Created. Authored as Gate 1 input for the table-build surface entry doc (`audits/2026-04-26-entry-table-build.md`). Proto-status; awaiting owner confirmation of stability-flag defaults and clothing-promotion rule.
