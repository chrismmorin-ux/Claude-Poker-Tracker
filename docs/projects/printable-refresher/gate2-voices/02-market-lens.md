# Gate 2 Voice 2 — Market / Competitive Lens — Printable Refresher

**Date:** 2026-04-24
**Voice:** Market + competitive research
**Stages owned:** B (JTBD coverage)

## Summary

The printable-reference market is crowded at the preflop-chart tier and nearly empty everywhere else. Upswing, GTO Wizard, BBZ, and PokerCoaching all ship preflop matrices in free / freemium / subscription tiers; almost nobody ships rigorous **math tables** (geometric betting, binomial survival, implied odds) or **texture-conditioned postflop references** as first-class printable artifacts. Red Chip Poker comes closest with inline "SPR decision guide / pot odds / break-even" tables buried in a blog post. The competitive survey also surfaces a **legality constraint** (most casinos forbid any reference material at the live table) that Gate 1 under-weighted — this materially reshapes PRF-NEW-1. Verdict: **Stage B ⚠️ YELLOW-leaning-GREEN** after three JTBD refinements + two additions; Gate 1's three JTBDs survive with sharper scoping. Two new JTBDs proposed (pre-session visualization; session-narrative codex export).

## Competitive survey

| Product | Content scope | Price | Format | What they do right | What they don't do |
|---------|---------------|-------|--------|--------------------|-------------------|
| **Upswing Preflop Prodigy** ([charts](https://upswingpoker.com/charts/), [cheat sheets](https://upswingpoker.com/preflop-poker-cheat-sheets/)) | Preflop ranges only (RFI, 3-bet, defense) — 6-max + heads-up | Free (basic charts); Lab $99/mo or bundled | Interactive app + downloadable PDF | Clean GTO-derived ranges, mobile-friendly viewer, industry baseline for chart aesthetics | No postflop, no math tables, no personalization, no rake-awareness, no lineage/version |
| **GTO Wizard** ([gtowizard.com](https://gtowizard.com/), [help/ranges](https://help.gtowizard.com/ranges-tab/)) | Solver solutions (preflop + postflop), custom range copy/paste to GTO+/Pio | $39–$129/mo tiers | Interactive web + range-copy to solver format | Depth (millions of spots), solver-authentic | **Not printable-first** — range export is text-blob for re-solving, not a laminate-ready artifact. User must hand-build the print. |
| **BBZ Cash + MTT Charts** ([cash](https://bbzpoker.com/product/cash-charts/), [MTT](https://bbzpoker.com/product/mtt-charts/), [bundle](https://bbzpoker.com/product/complete-chart-package/)) | ChipEV preflop, 3bb–100bb, 78 8-max + 36 HU solutions, trainer | $12.50/mo MTT, $20.80/mo Complete (annual) | Browser chart viewer + trainer; **no downloads, no tracker integration** | Stack-depth coverage is deep; trainer closes loop | Explicitly non-printable ("runs entirely in your browser"); no postflop strategy sheets; no math references |
| **Jonathan Little Cash Game Cheat Sheet** ([PDF](https://jlsecrets.s3.amazonaws.com/cheatsheet/cash-game-cheat-sheet.pdf), [Float The Turn Push/Fold app](https://jonathanlittlepoker.com/pushfoldapp/)) | 41 text tips (pre/during/post-session) + separate push/fold app + position charts | Free PDF + paid app | PDF + mobile app | Well-liked free tier; good for lead-gen | Tips are **label-driven prose**, not math-grounded charts ("Don't bluff a calling station" is the format); push-fold app is isolated from postflop |
| **Crush Live Poker (Bart Hanson)** ([crushlivepoker.com](https://crushlivepoker.com/)) | Live-specific videos + articles + "Crushing Live NL" course | ~$30/mo | Video + text | Live-cash-native voice; covers rake/rooms/tells Upswing ignores | **No cheat-sheet product at all** — training is narrative, not reference. Notable gap in the market. |
| **Red Chip Poker Cheat Sheets page** ([page](https://redchippoker.com/poker-cheat-sheets/), PRO $50/mo, CORE $5/wk) | Preflop + **postflop bet sizing, pot odds table, SPR decision guide, break-even %** in one free page | Free page; memberships for courses | Inline blog post with printable fragments | Closest to PRF's ambition — one page covers preflop + postflop + math | Cobbled-together blog rather than designed laminate; no versioning, no personalization, no rake-aware math |
| **Amazon laminated cheat sheets** ([search](https://www.amazon.com/poker-cheat-sheet/s?k=poker+cheat+sheet)) | Hand rankings + "beginner cheat sheets" | $6–$15 | Physical laminated card | Meets consumer-grade at-home-game need | Exclusively novice content; zero strategic depth; none rake/stack-aware |
| **PokerCoaching.com free preflop charts** ([page](https://pokercoaching.com/preflop-charts)) | Free preflop chart downloads (Jonathan Little network) | Free | PDF | Free lead-gen into paid funnel | Preflop-only, no math/postflop layer |
| **Reddit r/poker DIY charts** | User-printed Upswing/PokerCoaching PDFs | Free (DIY) | Laminated home-print | High community appetite for the at-table paper artifact | [Card rooms prohibit at-table reference material in most live venues](https://upswingpoker.com/preflop-poker-cheat-sheets/) — DIY users study at home, not at table |

**Key market insight — legality:** [Casino policy](https://www.winstar.com/blog/poker-cheat-sheet/) is overwhelmingly that **any form of reference material (paper, phone, app, notes) is prohibited mid-hand** at the live table, varying by room. Quora/WinStar/Lodge consensus: cheat sheets are for **pre-session study and between-session review**, not at-table use. Upswing's own page acknowledges: "in a live card room, using charts at the table will invariably contravene house rules and get you tossed out." This does not kill PRF-NEW-1 but **relocates** the primary-use situation from `mid-hand-chris` to `between-hands-chris` (bathroom / smoke break / stand-up), `presession-preparer`, and `post-session-chris`. Voice 1 should take the persona amendment; Voice 2 flags the market-evidence basis.

## Stage B — JTBD coverage

### Proposed 3 JTBDs (PRF-NEW-1/2/3) assessment

- **PRF-NEW-1 (Carry-the-reference-offline) — REFINE.** Survives, but the **at-table** framing is wrong per market evidence above. Rewrite: *"When I'm in a live-cash context where the app is forbidden or impractical (between hands, at the rail, in the bathroom, pre-session in the car), I want a physical laminated artifact carrying the highest-leverage decision scaffolds, so I can reinforce preparation and review without reaching for the phone."* The removed framing (`mid-hand-chris` glance-at-laminate) is not impossible but is edge-case in most venues and should not drive design.
- **PRF-NEW-2 (Trust-the-sheet) — SURVIVE.** This is the genuine **market differentiator**. No competitor ships lineage-stamped, engine-derived, rake-aware, re-derivable-on-demand reference. Upswing charts are generic GTO; BBZ charts are solver-black-box; Little's PDFs are prose. We uniquely can ship "this number came from `pokerCore/preflopCharts.js v1.4` + `src/utils/potCalculator.js` estimateRake at $2/$5 w/ $5 cap as of 2026-04-24" — an offer the entire market refuses. Keep unchanged.
- **PRF-NEW-3 (Know-my-sheet-is-stale) — SURVIVE.** Also genuinely unique. Every competitor ships evergreen-labeled content that is silently updated (or not); none surface drift to the user. Keep unchanged. Market angle: this is a **trust dividend** from PRF-NEW-2 — the two JTBDs reinforce each other.

### Missing JTBDs (propose 2 additional)

- **PRF-NEW-4 — Pre-session visualization / kinesthetic memorization.** *"When I prepare for tonight's session, I want a physical artifact I can walk through slowly, touch, mark up, and internalize — so decision patterns become muscle-memory rather than lookup-dependence."* This is a **job the market serves but the Gate 1 framing missed**. Evidence: Jonathan Little's Cheat Sheet is explicitly "things to focus on before / during / after a session" — its primary use is pre-session rehearsal. Red Chip / CLP podcasts frame "pre-session prep routine" as a core live-cash habit. The **laminate-as-physical-object** has kinesthetic properties the in-app view cannot replicate: annotatable with dry-erase, ordered on a desk, tactile. Distinct from DS-46 (spaced repetition — declarative memory) and from DS-52 (retention maintenance — procedural monitoring); this is **pre-event rehearsal**. Served by: the refresher itself + a "today's focus cards" presession filter. Domain: Session Entry (SE-04 candidate) OR new micro-domain.
- **PRF-NEW-5 — Export the anchor/codex I've already authored.** *"When I've built up a private library of exploit anchors / decision rules / corrections from my own play, I want to print them as a personal codex alongside the generic reference, so the printed artifact reflects MY game, not just GTO baseline."* This bridges to EAL (Exploit Anchor Library) and SR-32 (nominate hand for corpus). Competitors cannot serve this — the content doesn't exist for them; only a user-engine-coupled product can. Served by: a "my codex" card section of the refresher, populated from EAL anchors + retired-but-remembered corrections + owner-ratified deviations from Upper Surface. Market analog: GTO Wizard's user-tagged drill collections, but printable. Domain: Cross-cutting OR extends DS-57 (capture-the-insight) into an **export-the-insight** companion.

### Existing JTBDs that subsume / overlap

- **DS-46 (spaced repetition for key charts, Proposed)** — PRF is **not** spaced repetition. PRF is reference-mode lookup. They are complementary: Anki-like drill + laminated reference answer two different jobs. Do not collapse.
- **DS-47 (skill map / mastery grid)** — tangential. PRF is content-delivery, not mastery-visibility. Keep distinct.
- **DS-48 / DS-49 / DS-51** — source utilities for **equity-bucket / weighted-EV / range-shape cards** on PRF. PRF is a presentation layer over these jobs, not a replacement.
- **MH-04 / MH-09** — source utilities for **geometric-betting / SPR cards**. Same relationship.
- **ON-87 (cold-start descriptor seeding)** — **mild tension.** ON-87 bypasses onboarding for experts using descriptor self-report; PRF's preflop cards are the kind of artifact an expert-bypass user prints *first-session*. No conflict; note the synergy.
- **SE-01 (prepare tonight's watchlist)** — **real overlap** with PRF-NEW-4. SE-01 is villain-specific pre-session prep; PRF-NEW-4 is generic pre-session rehearsal. Keep distinct but cross-reference.

## Differentiation summary

**What we uniquely can do (no competitor does):**
1. **Engine-derived, rake-aware, stack-conditioned numbers.** Upswing/BBZ chart numbers assume no rake; our geometric-betting card can show "get-it-in-by-river" sizing that accounts for $5/cap-at-$15 rake at the user's venue.
2. **Lineage-stamped content** (PRF-NEW-2). `v1.4 / 2026-04-24 / src/utils/pokerCore/preflopCharts.js` footer on every card.
3. **Staleness in-app** (PRF-NEW-3). Competitors ship evergreen-or-silent-update; we flag drift.
4. **User-specific codex export** (PRF-NEW-5). Personal anchors + corrections, not just GTO baseline.
5. **Pure-plays + exceptions codex** as first-class (owner's explicit ask). No competitor treats exceptions as equal to rules; they ship rule charts and bury exceptions in courses.

**What we should refuse to duplicate** (market-lens grounds):
1. **Generic GTO preflop charts** — if ours are visually indistinguishable from Upswing's free chart pack, we add no value. Our version **must** either (a) be derivable from `pokerCore/preflopCharts.js` + rake + stack-depth inputs the user sets, or (b) show the **deviation layer** over GTO baseline, or (c) be refused entirely in favor of linking to Upswing.
2. **Hand-rank reminders / beginner's glossary** — Amazon's $6 laminates own this segment. Not our audience.
3. **Jonathan-Little-style prose tip lists** ("41 things to focus on"). Violates first-principles doctrine AND is not our format.
4. **Solver-text range copy-paste** (GTO Wizard's `AA:1.0,KK:1.0,…` blob export). Not a print artifact; also not our differentiation.

## Content refused on market-lens grounds

Four content types common-in-market that PRF should **explicitly refuse** (feeds Voice 3's fidelity audit):

1. **Label-conditioned blanket rules** — "Iso-3bet fish OOP always" (Upswing's Lab, Little's prose, RCP inline). First-principles-doctrine violation; market prevalence doesn't make it correct.
2. **"VPIP 40+ = calling station = never bluff"** — every cheat sheet in the market encodes this; POKER_THEORY.md §3.2 + feedback_reasoning_quality.md refuse it.
3. **Static push-fold charts stripped of ICM/rake** — Little's push-fold app (and many tournament cheat sheets) present 15bb push ranges as context-free tables. Our version must cite stack / ante / ICM-or-chipEV / rake-adjusted.
4. **"GTO chart" without bet-size branch** — Upswing's free sheets show one open size and one 3-bet size. Modern poker uses 2-3 sizings per position; a single-size chart encodes a sizing choice without disclosing it.

## Stage B verdict signal

- **Stage B: ⚠️ YELLOW-leaning-GREEN.** The three Gate 1 JTBDs survive with refinement (PRF-NEW-1 relocates primary situation away from mid-hand per casino-legality evidence). Two additions close market-visible gaps (PRF-NEW-4 pre-session visualization, PRF-NEW-5 personal-codex export). Competitive landscape is clear: preflop is crowded, math + postflop + lineage + personalization is open water.

## Recommended follow-ups for Gate 3 / Gate 4

- [ ] Rewrite PRF-NEW-1 with "between-hands / pre-session / post-session" primary-situation framing, not mid-hand. Voice 1 takes the persona amendment on `mid-hand-chris`; Voice 2 supplies the market evidence.
- [ ] Author PRF-NEW-4 (pre-session visualization) and PRF-NEW-5 (personal-codex export) as Gate 3 outputs; classify domain (SE-* vs new).
- [ ] Gate 4 surface spec must include a **"refused content" register** listing the 4 refusals above, referenced by every card-authoring doc.
- [ ] Pricing / tiering question for owner (Gate 3 interview): is PRF a **free lead-gen** (like Little's cash cheat sheet) or **Plus-tier differentiator** (like BBZ's $20/mo bundle)? Market permits either; owner's WTP framework decides.
- [ ] Confirm with owner that preflop cards are intentionally **derivation-of-our-own-engine**, not a reprint of Upswing's public chart. If derivation doesn't differentiate visibly, cut the preflop card tier and defer to linking Upswing.
- [ ] Gate 5 content-drift CI: tie version stamps to utility SHAs so lineage footer is automatic, not manually maintained.

**Sources cited (all):** [Upswing charts](https://upswingpoker.com/charts/), [Upswing cheat sheets](https://upswingpoker.com/preflop-poker-cheat-sheets/), [GTO Wizard](https://gtowizard.com/), [GTO Wizard ranges tab](https://help.gtowizard.com/ranges-tab/), [BBZ cash charts](https://bbzpoker.com/product/cash-charts/), [BBZ MTT charts](https://bbzpoker.com/product/mtt-charts/), [BBZ complete package](https://bbzpoker.com/product/complete-chart-package/), [Jonathan Little cash cheat sheet PDF](https://jlsecrets.s3.amazonaws.com/cheatsheet/cash-game-cheat-sheet.pdf), [Float The Turn Push/Fold app](https://jonathanlittlepoker.com/pushfoldapp/), [Crush Live Poker](https://crushlivepoker.com/), [Red Chip Poker cheat sheets](https://redchippoker.com/poker-cheat-sheets/), [Red Chip Poker PRO](https://redchippoker.com/pro-membership/), [PokerCoaching.com preflop charts](https://pokercoaching.com/preflop-charts), [PokerNews cheat sheet](https://www.pokernews.com/poker-cheat-sheet.htm), [Amazon poker cheat sheet search](https://www.amazon.com/poker-cheat-sheet/s?k=poker+cheat+sheet), [WinStar on cheat-sheet legality](https://www.winstar.com/blog/poker-cheat-sheet/).
