---
name: provenance-audit
description: "Audit a repo's data provenance. On first baseline, drafts data-source-registry.draft.md + provenance-chain-map.draft.md from migrations + ORM schemas + SDK dependencies + URL/HTTP-client patterns + fixtures + config blocks. Founder reviews and promotes via rename. Subsequent runs catch drift, undocumented sources, trust-tier upgrades through the chain, broken chains, stale source authorities, orphan sources. Findings auto-promote to prog-data-provenance queue. Honors no-silent-install."
user-invocable: false
default_mode: decide
---

## Intent Contract (ADR-038)

Before phase work, read the `engine_intent_recorded` event from the loaded envelope (look-back 5 min, match on `engine: provenance-audit` + target). The contract carries four fields this engine MUST honor:

- **`mode`** — output shape. Frontmatter declares `default_mode: decide`. Specializations: `decide` (comparison/audit/scoring with tradeoffs), `build-best` (commit to one direction; concrete deliverable; sequencing-ranked), `mockup` (low-fidelity sketch; structure-only; skip scoring + work-item creation), `explore` (surface adjacent possibilities; emphasize divergence over selection). When the loaded contract specifies a mode that differs from the default, honor the contract; the briefing's Contract Alignment block records the departure.
- **`stretch`** — when `true`, question the AS-N tags + constraints already loaded in the envelope; surface where current state is load-bearing vs. inertial. When `false` (default), honor loaded state. **Stretch MUST NOT re-read `system/` files** — INV-cli-envelope-consumed-completely applies.
- **`success_shape`** — the structured target the briefing phase MUST honor. The Briefing's Contract Alignment block reports honored vs. departed items with reason.
- **`scope_ceiling`** — items listed here are out-of-bounds. Do not spend cycles on them; briefing's Contract Alignment block reports compliance.

---

# Data Provenance Audit Engine

You are auditing a repo's **data provenance** — every data point a user sees must trace to its source. The program this engine feeds, `prog-data-provenance`, has a load-bearing anti-invariant: *"No record may be displayed to users without source attribution."* A wrong entry in a promoted source registry sits load-bearing for a long time; a chain map that silently upgrades trust tiers through transformations is an inference error masquerading as truth. Default to *fewer well-cited sources* over *more weakly-cited ones*.

## Input

`$ARGUMENTS` — a repo path (absolute) or `current`. Optionally a second argument: path to a previous provenance set for drift comparison.

If no argument given: audit the current repo and use `docs/provenance/` (if it has promoted artifacts) as the reference set.

---

## INVARIANTS (load-bearing — read first)

Three contracts this engine MUST honor on every run. Violating them turns the engine from a drafting aid into a silent-install hazard.

1. **Anti-overwrite contract.** If `docs/provenance/data-source-registry.md` or `docs/provenance/provenance-chain-map.md` exists as a non-draft file, that artifact's Phase 0b sub-step is a strict no-op. The engine never replaces, edits, or appends to a promoted artifact. Drafts always land at `*.draft.md`. The founder promotes via rename — only the founder.

2. **Anti-silent-mutation contract.** This engine NEVER writes to `prog-data-provenance.yaml` content fields (contract, capability_brief, problem_classes, scope.invariants, scope.constraints, scope.anti_invariants, tier, accountability, interconnections). It MAY update only metadata fields: `last_run_by_protocol.<protocol>.*`, `health_score`, `health_breakdown`, `findings_open`, `work_items_open`, `evidence.last_audit_report`, `evidence.protocol_history`, `updated_at`. Load-bearing source registrations enter the program only through founder promotion of drafts.

3. **Founder-review contract.** Every drafted source carries `confidence` (High/Medium/Low) + `trust_tier` (T1-T5) + `review_notes`. Every chain entry carries a tier-monotonicity check note (the chain MUST never upgrade tier). The DRAFTS manifest tells the founder what to verify before promotion.

---

## PHASE 0 — GATHER CONTEXT

1. Read `prog-data-provenance.yaml` — confirm registration; read `problem_classes` (5 buckets: Source Attribution Coverage / Evidence Classification / Provenance Chain Integrity / Source Freshness & Validity / Attribution Accuracy), `scope.file_patterns`, `scope.anti_invariants`, `tier_triggers`, `phase_relevance`.
2. Read `CLAUDE.md` — repo purpose, declared data domain, declared external integrations.
3. Read `README.md` — public framing of where data comes from.
4. Read `system/intention.md` — founder principles + anti-goals; check for provenance-shaped commitments (e.g., "every claim traces to source").
5. Read `.cwos-onboarding.yaml` if present — extract relevant capability state.
6. Scan repo top-level for provenance-relevant directories: `docs/provenance/`, `db/`, `migrations/`, `models/`, `prisma/`, `alembic/`, `seeds/`, `fixtures/`. List existing files (drafts vs promoted in `docs/provenance/`).
7. Read dependency manifests (`package.json`, `pyproject.toml`, `requirements.txt`, `Gemfile`, `go.mod`) as plain text.
8. If a previous provenance set exists, read each promoted artifact for drift comparison.

Record: repo type, archetype, declared external integrations, dependency-derived signals, tier. Set `run_workspace = .claude/workstream/evidence/data-provenance/run-<run_id>/`. Create phase subdirectories: `phase-0/`, `phase-0b/`, `phase-1/`, `phase-2/`, `phase-3/`.

---

## PHASE 0b — GENERATIVE INFERENCE (conditional, runs before Phase 1)

**Per-artifact conditional skip** (mirrors compliance-audit / claims-audit / ADR-030):

- `data-source-registry.draft.md` → skip sub-step if `docs/provenance/data-source-registry.md` exists as non-draft
- `provenance-chain-map.draft.md` → skip sub-step if promoted version exists

If both promoted artifacts exist, Phase 0b is a strict no-op. Continue to Phase 1.

If `--regenerate-draft <artifact>` is passed, regenerate the named artifact (still never overwriting a non-draft promoted file).

### 0b-i — Data-source detection

Compose a source-signals report from four input streams:

1. **Migrations.** Scan these directory patterns:
   - `db/migrate/`, `db/migrations/`, `migrations/`
   - `alembic/versions/`
   - `prisma/migrations/`
   - `supabase/migrations/`
   - `drizzle/migrations/`
   - Per file, extract: table name(s) created/altered, columns added, foreign-key relationships. Each migration file → one or more source signals (one per table).

2. **ORM schemas.** Scan for declarative schema files:
   - `prisma/schema.prisma`
   - SQLAlchemy models — files matching `models/*.py` with `class .+\(Base\):` or `Column(` patterns
   - Mongoose schemas — `models/*.{js,ts}` with `mongoose.Schema` or `Schema(` patterns
   - ActiveRecord — `db/schema.rb`
   - Drizzle / Kysely table definitions — files importing `pgTable`, `mysqlTable`, `sqliteTable`, or kysely's `defineTable`
   - Per model class / table def → one source signal.

3. **API integration imports + SDK dependencies.** Two sub-streams:
   - **Dependency manifest scan.** Match against this SDK keyword list (extend as the fleet teaches):
     - Cloud platforms: `@aws-sdk/*` / `aws-sdk` / `boto3` → AWS service surfaces; `@google-cloud/*` / `googleapis` → GCP; `@azure/*` → Azure
     - Payment: `stripe` / `stripe-*` → Stripe transactional data
     - Auth: `auth0` / `okta-*` / `firebase-admin` / `@clerk/*` / `next-auth` → user identity surfaces
     - Communication: `twilio` / `sendgrid` / `mailgun` / `resend` → message records
     - Search / data: `algolia` / `@elastic/*` / `meilisearch` → indexed external sources
     - Analytics / observability: `mixpanel` / `segment` / `sentry` / `datadog` / `posthog` → user-event capture
     - Databases: `pg` / `mysql2` / `mongodb` / `redis` / `@prisma/client` → DB driver presence
     - LLMs / AI: `openai` / `@anthropic-ai/sdk` / `cohere-ai` / `replicate` → AI-generated data surfaces
   - **Hardcoded HTTPS URLs in code.** Regex scan across code files (`*.{js,ts,jsx,tsx,py,rb,go,java}`): `https://[a-zA-Z0-9.-]+/[\w/.-]*`. Exclude common false-positives (CDN URLs in HTML/CSS, schema URIs in `xmlns=`, OpenAPI spec URLs). Each unique host → one external_api signal.

4. **Fixtures + config blocks.**
   - Fixture directories: `fixtures/`, `seeds/`, `db/seeds/`, `test/fixtures/`, `__fixtures__/`, `cypress/fixtures/`, `spec/fixtures/`. Each file → one fixture signal.
   - Config: `.env.example`, `config/services.{yaml,yml}`, `config/credentials.yml.enc.example`, `config/initializers/` (Rails). Each declared third-party endpoint or service block → one config signal.

For each signal, capture: `name | type | file:line | surface_class | confidence`. Where:
- `type` ∈ {database, external_api, sdk_service, fixture, config_endpoint}
- `surface_class` ∈ {internal_db, vendor_api, regulatory_registry, scraped_external, derived, static_fixture}
- `confidence` ∈ {High (signal is unambiguous: explicit migration / declared SDK), Medium (URL or import-only with context), Low (text-only mention, e.g., README without code)}

Output: `phase-0b/source-signals.md` — flat table:

```markdown
# Source signals (detected)

| Name | Type | File:lines | Surface class | Confidence | Note |
|------|------|------------|---------------|------------|------|
| users (table) | database | db/migrate/20260101_create_users.rb:1-24 | internal_db | High | created in migration; columns: id, email, created_at |
| Stripe Customer API | external_api | package.json:18 | vendor_api | High | dep: stripe@^14.0.0; auth via STRIPE_SECRET_KEY |
| seed-products.json | fixture | fixtures/seed-products.json | static_fixture | Medium | 12 records; format: { id, sku, price } |
| ... | ... | ... | ... | ... | ... |
```

If fewer than 3 signals pass High confidence, note in synthesis: "Repo has thin data surface — drafts will be sparse; founder may need to add manual entries before promotion."

### 0b-ii — Load-bearing data point inventory

Identify data points that are **displayed to users or used in decisions**. The heuristic is:

A value is **load-bearing** if it satisfies all three:
1. **Visible:** appears in a view / template / API response / report / CLI output. Detect via reference to the value from files under `app/`, `pages/`, `templates/`, `views/`, `routes/`, `controllers/`, or any function whose return-type is the source of an HTTP response body or rendered output.
2. **Source-traced:** the value originates from a source detected in 0b-i (database / external_api / sdk_service / fixture / config_endpoint). Trace via direct read, ORM query, SDK call, or fixture import.
3. **Named:** has its own column/field name OR is referenced by a UI label or API field name (not an unnamed intermediate).

For each load-bearing data point, capture: `label | displayed_at (file:line) | originating_source(s) | transform_path (rough)`.

Output: `phase-0b/data-points.md` — flat table.

If fewer than 3 data points qualify (rare in non-trivial repos), note in synthesis: "Engine could detect few load-bearing data points — chain map will be thin; founder should add manually before promotion."

### 0b-iii — Data-source registry draft

Skip if `docs/provenance/data-source-registry.md` exists as non-draft.

Dispatch the **architect** persona with this mandate:

> **Mandate:** Draft a data-source registry from `phase-0b/source-signals.md`. Use the template at `kit/templates/provenance/data-source-registry-template.md`.
>
> **For each detected source,** produce a register entry:
>
> ```yaml
> - source_id: SRC-NNN
>   name: "<source name e.g. 'Stripe Customer API' / 'users table' / 'fixtures/seed-products.json'>"
>   type: <database | external_api | sdk_service | fixture | config_endpoint>
>   surface_class: <internal_db | vendor_api | regulatory_registry | scraped_external | derived | static_fixture>
>   source_evidence:
>     - file: <file_path>
>       lines: "<line_range>"
>       note: "<what evidence shows this is the source — migration creating table, SDK import, URL string, fixture file>"
>   trust_tier: T1 | T2 | T3 | T4 | T5
>   confidence: High | Medium | Low
>   review_notes: "<what the founder must verify before promotion>"
> ```
>
> **Trust-tier scale (provenance-specific):**
>
> - **T1 — Authoritative source with verifiable provenance.** Government registries (FDA Orange Book, EDGAR, USPTO, US Census), peer-reviewed datasets, official regulator APIs. Independently audit-able by a third party.
> - **T2 — Trusted vendor / canonical service.** Stripe (transactional truth), AWS (infrastructure state), Auth0 / Clerk (identity), Twilio (delivery records). Vendor-of-record for the data they hold.
> - **T3 — Internal database (audit-logged write path).** Your own DB tables where the write path is logged and the source-of-truth is your application. Trust depends on your own write-side controls.
> - **T4 — Internal derivation / aggregation.** Computed from T1-T3 via your code (sums, joins, classifications, scores). Trust derives from input tiers minus transformation risk.
> - **T5 — External unverified.** Scraped data, third-party API without authority verification, user-submitted without validation, anonymous community contributions. Lowest trust; should rarely surface in production claims.
>
> **Surface-class disambiguation:**
> - `derived` is for sources that LOOK internal (sit in your DB) but ORIGINATE elsewhere (a `users.is_premium` column populated from Stripe webhooks is `derived`, not `internal_db`).
> - `regulatory_registry` is reserved for actual regulator APIs / official datasets, not for "this lawyer-vendor's compliance feed."
>
> **Coverage target:** 5-25 sources on a typical repo. Padding the registry harms the founder; surface only sources with concrete repo evidence. Sources detected in 0b-i with `confidence: Low` should have `confidence: Low` in the registry too — never upgrade confidence to fill the registry.
>
> **Confidence calibration:**
> - High: source is in the manifest / migration / schema with unambiguous evidence
> - Medium: source detected by URL pattern or import-only with implicit usage
> - Low: source mentioned in docs / config but not directly referenced in code
>
> **Anti-pattern detection:** if you find yourself drafting > 30 sources, stop. Either the repo is a heavy-data product (rare in CWOS scope) or you're cataloging engineering details (cache backends, internal RPC endpoints) as sources. Re-read 0b-i and prune.
>
> **Constitutional check:** before finalizing, ask: "If a source were promoted and audited, does its remediation push the system toward `system/intention.md` Failed States #3 (compliance over value) or #10 (self-aggrandizing complexity)?" Surface any flagged source.

Save to `docs/provenance/data-source-registry.draft.md`.

### 0b-iv — Provenance-chain-map draft

Skip if `docs/provenance/provenance-chain-map.md` exists as non-draft.

Dispatch the **architect** persona with this mandate:

> **Mandate:** Draft a provenance-chain-map from `phase-0b/data-points.md` + `phase-0b/source-signals.md` + the registry from 0b-iii. Use the template at `kit/templates/provenance/provenance-chain-map-template.md`.
>
> **For each load-bearing data point,** produce a chain entry:
>
> ```yaml
> - data_point_id: DP-NNN
>   label: "<user-facing label or column name>"
>   displayed_at:
>     file: <file_path>
>     lines: "<line_range>"
>     surface: <view | template | api_response | report | cli_output>
>   chain:
>     - step: source
>       source_id: SRC-NNN   # references registry from 0b-iii
>       tier_at_step: <T1..T5>
>       file: <file:line of the read / SDK call / fixture import>
>     - step: ingest
>       file: <file:line>
>       transform: "<what happens to the data here — JSON parse, type coercion, validation>"
>       tier_at_step: <T1..T5>   # MUST be <= prior step's tier
>     - step: derive   # optional; only if value is computed/aggregated
>       file: <file:line>
>       transform: "<derivation description>"
>       tier_at_step: <T1..T5>   # typically downgrades to T4
>     - step: serve
>       file: <file:line>
>       transform: "<serialization / formatting>"
>       tier_at_step: <T1..T5>   # MUST be <= prior step's tier
>     - step: display
>       file: <file:line>
>   tier_at_display: <T1..T5>   # MUST equal final step's tier_at_step
>   review_notes: "<chain-specific verification cue: missing transformation step, derivation that the founder must verify>"
> ```
>
> **HARD RULE — trust tier MONOTONICITY (load-bearing):** trust tier never increases through the chain. A T3 internal-DB source can stay T3 or downgrade (e.g., to T4 after derivation), but it cannot upgrade to T2 by passing through your code. If you find yourself writing a chain where `tier_at_step[N+1] > tier_at_step[N]`, you've made an inference error: STOP, mark the chain `confidence: Low`, and add a review_note explaining what you couldn't determine. The 0b-v cross-check will flag any chain that violates monotonicity.
>
> **Chain length:** typical chains are 3-5 steps (source → ingest → optional derive → serve → display). Padding chains harms readability. If a step is trivial (e.g., a JSON parse with no schema change), inline it into the next step's transform note rather than emitting a separate step.
>
> **Coverage target:** every data point in `data-points.md` should appear in the chain map. If a data point couldn't be traced (e.g., the value is computed from multiple sources joined in a complex query), emit it with `chain: []` and `review_notes: "engine-could-not-trace — founder must complete chain manually"`.
>
> **Confidence per chain:** carry forward the lowest-confidence step's confidence. A High-confidence source feeding into a Medium-confidence derive step yields Medium overall.

Save to `docs/provenance/provenance-chain-map.draft.md`.

### 0b-v — Cross-check (false-positive sweep)

Dispatch the **failure-engineer** persona with this mandate:

> **Mandate:** Read both drafts (`docs/provenance/data-source-registry.draft.md` + `docs/provenance/provenance-chain-map.draft.md`). Treat them as a unified inference set. Flag entries that are not load-bearing data sources, chains that violate trust-tier monotonicity, and cross-document inconsistencies.
>
> **For each registry entry, answer:**
>   1. Is this an actual data SOURCE, or an engineering detail (cache layer, internal RPC, monitoring agent)? Caches, log aggregators, error trackers, and feature-flag services are NOT data sources for provenance purposes — they're infrastructure. Flag for `remove`.
>   2. Is the trust tier calibrated? A `users.is_premium` derived from Stripe webhooks should be T2 (vendor source) → T4 (derived in your code), NOT T3 (internal DB) — surface_class should be `derived`, not `internal_db`. Flag for `rewrite`.
>   3. Does `source_evidence` actually point at the source declaration, or at code that happens to be near the topic?
>
> **For each chain map entry, answer:**
>   4. **Trust-tier monotonicity (load-bearing).** Walk the chain. Does `tier_at_step` ever increase from one step to the next? Any upgrade is an inference error — flag for `rewrite`. The architect was supposed to catch this; if a chain slipped through, the architect's confidence calibration was wrong.
>   5. Does `chain[].file:line` actually contain the transformation described, or is the citation off by a function?
>   6. Is `tier_at_display` consistent with the final step's `tier_at_step`?
>
> **Cross-document checks:**
>   7. **Orphan data point.** Does any chain entry reference a `source_id` that isn't in the registry? Flag for `resolve` (either add the source to the registry or correct the chain reference).
>   8. **Orphan source.** Is any registry entry not referenced by any chain map entry? This is informational, not a failure — sources may exist for non-displayed data (logging, audit trails) — but flag for `note` so the founder confirms the source is intentionally orphan.
>   9. **Trust-tier disagreement.** Does the registry's `trust_tier` for SRC-X match the chain's `tier_at_step` for the source step that references SRC-X? Mismatch → flag for `rewrite`.
>
> **Output: a YAML diff against the drafts:**
>
> ```yaml
> alterations:
>   - target: registry | chain-map
>     entry_id: <SRC-NNN | DP-NNN>
>     action: "remove" | "downgrade_confidence" | "rewrite" | "resolve" | "note"
>     reason: "..."
>     replacement: "<only if action == rewrite>"
> ```
>
> Be ruthless on monotonicity (load-bearing) and tier calibration. Be lenient on orphan sources (informational).

Save to `phase-0b/cross-check.yaml`. Apply the alterations to produce `phase-0b/final-drafts/{data-source-registry,provenance-chain-map}.md`. Copy the finals over the `*.draft.md` files (preserving `.draft.md` suffix).

### 0b-vi — Write DRAFTS.md

Append (or replace) a `## Data Provenance` section in repo-root `DRAFTS.md` (per `kit/templates/domain/DRAFTS-template.md` structure). Two artifact entries:
- `docs/provenance/data-source-registry.draft.md` (path, generated-at, run_id, summary line, promotion command)
- `docs/provenance/provenance-chain-map.draft.md` (same fields)

### 0b-vii — Phase 0b reporting

In Phase 3 synthesis, include a section:

```
### Draft Artifacts Generated (Phase 0b)
- data-source-registry.draft.md: <N sources across <T> types, tier breakdown: T1=<n> T2=<n> T3=<n> T4=<n> T5=<n>>
- provenance-chain-map.draft.md: <M data points across <S> surfaces, monotonicity violations caught by cross-check: <N>>
- Confidence breakdown: <high count> high, <medium count> medium, <low count> low

Review them with: cat docs/provenance/*.draft.md
Then: cat DRAFTS.md  # for promotion instructions

Promote with (per artifact, after review):
  mv docs/provenance/<name>.draft.md docs/provenance/<name>.md
```

If Phase 0b skipped (both promoted exist), state: `Phase 0b: skipped (both promoted artifacts present).`

---

## PHASE 1 — DATA-SOURCE DRIFT SCAN

**Skip Phase 1 if Phase 0b just generated drafts** — there's no promoted set to drift against.

If at least one promoted artifact exists, dispatch the **architect** persona with this mandate:

> Read the promoted artifacts (`docs/provenance/data-source-registry.md`, `provenance-chain-map.md`). For each registry entry's `source_evidence`:
>   1. **Source still present:** is the cited file:line still there? Did the table / SDK import / migration get removed?
>   2. **Source still authoritative:** has the source authority changed? (URL moved, agency renamed, vendor sunsetted, regulation updated.)
>   3. **Drift since last verified:** has the cited file changed since the registry's `last_verified` date? Run `git log --since=<last_verified_date> -- <file>`.
>   4. **Tier still appropriate:** is the originally-assigned trust tier still correct? (A vendor that was T2 may downgrade to T5 if it changed business model or got acquired by an unverified buyer.)
>
> For each chain entry:
>   5. **Chain still intact:** does each step's file:line still implement the cited transform?
>   6. **Tier monotonicity preserved:** any new code path that upgrades tier mid-chain?
>
> Emit `aligned`, `drift_suspected`, `removed`, `tier_violation`, `chain_broken` per entry.

Save to `phase-1/provenance-drift.yaml`.

---

## PHASE 1b — STRUCTURAL BLINDSPOT SWEEP

Run only if at least one promoted artifact exists. Five checks:

### Check 1 — Sources promoted with no code presence
Each registry entry whose `source_evidence` no longer matches actual code → finding tagged `blindspot: true, blindspot_type: orphaned_source_evidence`.

### Check 2 — Migration / schema entries not represented in promoted registry
Re-run 0b-i streams 1-2 (migrations + ORM schemas). Any new table / model class not present in the promoted registry → finding tagged `blindspot: true, blindspot_type: undocumented_source`.

### Check 3 — Trust-tier upgrade in promoted chain map
Walk every promoted chain. Any step whose `tier_at_step` is greater than the prior step's tier → finding tagged `blindspot: true, blindspot_type: tier_violation`. Severity: high (load-bearing — a tier-upgrade in the chain is an inference error masquerading as truth).

### Check 4 — Stale `last_verified` dates
For each registry entry with `last_verified` older than 90 days → finding tagged `blindspot: true, blindspot_type: stale_verification`.

### Check 5 — Anti-invariant violation: unattributed display
`prog-data-provenance.yaml scope.anti_invariants` includes "No record may be displayed to users without source attribution." Re-run heuristic from 0b-ii: walk view / template / API-response surfaces for value references that originate from sources not in the promoted registry. Each unattributed display → finding tagged `blindspot: true, blindspot_type: anti_invariant_violation`.

Blindspot findings bypass per-run `finding_cap`. Honor `waived_blindspots`.

---

## PHASE 2 — CROSS-CRITIQUE

Dispatch the **cross-critic** persona with the standard adversarial block from `engines/standard/eng-engine.md` § Cross-Critique, plus provenance-specific adjustments mirroring `prog-data-provenance.yaml challenge` protocol:

> **Investigative-journalist mandate (per prog-data-provenance.challenge):**
>
> 1. **Wrongness audit:** check whether the architect's cited file:line actually implements the transform claimed. Provenance audits get fooled by name similarity (a function called `import_users` may not be the actual ingest path if there's an `import_users_v2` shadowed elsewhere).
> 2. **Missing dimension — pick 5 random data points displayed to users, can you trace each to its source?** Is the chain map complete, or did the architect skip the messy ones (joined queries, multi-source aggregations, derived columns populated by webhooks)?
> 3. **What data enters the system without going through the attribution pipeline?** Common misses: SDK callbacks (Stripe webhooks writing directly to DB), background jobs ingesting from external APIs without registry entries, fixtures used in production by accident.
> 4. **If a source is retracted or corrected, does the system know?** Are there freshness checks for T1 / T5 sources?
> 5. **What aggregations or calculations obscure the underlying source data?** A `total_revenue` field that aggregates Stripe + manual entries should surface BOTH source ids in the chain, not just one.
> 6. **Could someone fabricate a record that passes attribution checks?** Is there a write path that allows `source_id: null` or `source_id: "manual"` without founder review?
> 7. **Severity recalibration:** an unattributed claim in a phase-foundation repo is medium; the same in a phase-launch repo serving real users is critical.
> 8. **Constitutional check:** read `system/intention.md` Failed States #3 and #10. Flag any finding whose remediation produces compliance theatre rather than actual provenance strengthening.

Save to `phase-2/cross-critique.md`.

---

## PHASE 3 — SYNTHESIS

Dispatch the **facilitator** persona with this mandate:

> Synthesize:
>
> **Header**
> ```
> DATA PROVENANCE AUDIT — [repo name], [date]
> Status: [DRAFTS generated | PROMOTED — Nsources/Mdata-points | NO ARTIFACTS, Phase 0b SKIPPED]
> Detected source types: [counts: database=N, external_api=N, sdk_service=N, fixture=N, config_endpoint=N]
> Trust-tier breakdown: [T1=N, T2=N, T3=N, T4=N, T5=N]
> Attribution coverage: [<N% of detected data points have a complete chain entry> OR "N/A — no promoted set"]
> ```
>
> **Phase 0b summary** (if 0b ran)
> Counts + tier breakdown + monotonicity-violation count.
>
> **Drift summary** (if Phase 1 ran)
> ```
> Registry entries:    N
> Aligned:             N
> Drift suspected:     N
> Removed:             N
> Tier violations:     N
> Chain broken:        N
> ```
>
> **Top findings** (top 5 by severity × phase-relevance) — cite specific SRC-NNN / DP-NNN ids.
>
> **Constitutional risks** (Phase 2)
>
> **Convergence path** — 1-3 concrete actions to close the highest-leverage gap. Each action references a specific source or chain by id.
>
> **Open questions for the founder** — sources whose tier the engine could not determine, chains the engine could not trace, anti-invariant violations requiring founder judgment.

Save to `phase-3/synthesis.md`.

---

## PHASE 4 — FINDING GENERATION

For each gap from Phases 1, 1b, 2 that meets promotion criteria, generate a finding file in `.claude/workstream/findings/`.

**Promotion criteria:**
- Severity critical → always promote.
- Severity high → always promote.
- Severity medium AND program is at maturity level 1 or 2 → promote.
- Severity medium at maturity 3+ → promote only if it blocks the convergence-path recommendation.
- Severity low → aggregate into a single "polish pass" finding at most.

**Respect program finding cap:** `prog-data-provenance.yaml accountability.on_finding.max_open_items` is 3. If near cap, only promote highest-severity new gaps. Blindspot-tagged findings bypass.

**Phase-0b-pending special case:** if Phase 0b just generated drafts and Phase 1+ skipped, do NOT promote findings from Phase 1b checks. Emit a single informational finding: "Data-provenance drafts pending founder promotion at `docs/provenance/*.draft.md`. After promotion, re-run `/pulse run data-provenance baseline` to engage drift and blindspot checks." Not tagged blindspot.

**Finding format:** standard FIND-*.yaml schema. `program: data-provenance`. Each finding includes `source_id` and/or `data_point_id` when applicable.

---

## PHASE 5 — BACKLOG PROMOTION

For each finding, create a corresponding WS-*.yaml:
- `program: data-provenance`
- `capability: governance`
- Priority floor: 27 (per prog-data-provenance.yaml `accountability.on_finding.priority_floor`)
- `accept_criteria` concrete: "SRC-007 (Stripe Customer API) re-cited at file:line; verified by reading the SDK call at app/services/stripe.rb:42" — never aspirational.

**WS-id allocation (WS-040):** allocate every new work item's id via `node kit/scripts/cwos-next.js allocate-ws-id` — call it once per id, in order. Do NOT compute the next id by eyeballing the active-queue max: that scan misses `queue/archive/` and re-issues retired ids, which lets reconcile force-complete the new item (the SPR-018 / WS-033 incident). The CLI scans queue + archive + index.

**Convergence-thread header (mandatory):** the first line of `description` is:
```
_Convergence: <e.g., "anchors SRC-007 (Stripe Customer API) to current file:line" | "blindspot — undocumented_source for users_audit table" | "Phase 0b drafts pending founder promotion">_
```

Update `queue-index.yaml` and `findings-index.yaml`.

---

## PHASE 6 — METADATA UPDATE & BRIEFING

Update `prog-data-provenance.yaml` (METADATA FIELDS ONLY — see Invariant #2):
- `last_run_by_protocol.<protocol>.{date, engine, run_id, result}`
- `health_score` and `health_breakdown`
- `findings_open` / `work_items_open` / `evidence.protocol_history` += this run
- `evidence.last_audit_report` → `phase-3/synthesis.md`
- `updated_at` → today

Briefing (terse):

```
DATA PROVENANCE AUDIT — [repo name], [date]
Status: [status] | Sources: [count by type] | Tier breakdown: [T1..T5]

[1-2 sentence headline]

Drafts: [count or "none — promoted set exists"]
Top findings: [count] ([critical/high/medium])
Open questions: [count]

Full report: .claude/workstream/evidence/data-provenance/[run-id]/phase-3/synthesis.md
DRAFTS manifest: DRAFTS.md
```

---

## OUTPUT ARTIFACTS

All under `.claude/workstream/evidence/data-provenance/[run-id]/`:

- `phase-0/` — context notes (repo type, archetype, declared integrations)
- `phase-0b/` — source-signals.md, data-points.md, cross-check.yaml, final-drafts/ (only when Phase 0b ran)
- `phase-1/provenance-drift.yaml` — per-entry drift status (only when promoted exists)
- `phase-1b/blindspots.yaml` — structural gap findings (only when promoted exists)
- `phase-2/cross-critique.md`
- `phase-3/synthesis.md`
- `findings-promoted.yaml` — list of FIND-* created
- `work-items-promoted.yaml` — list of WS-* created

Plus when Phase 0b runs:
- `docs/provenance/data-source-registry.draft.md` (unless promoted)
- `docs/provenance/provenance-chain-map.draft.md` (unless promoted)
- `DRAFTS.md` (appended `## Data Provenance` section)

---

## INVARIANTS (recap — these trip during runs, not just at design time)

- Never write to `docs/provenance/data-source-registry.md` or `provenance-chain-map.md`. Founder-promoted only.
- Never write to `prog-data-provenance.yaml` content fields. Metadata only (Phase 6 list).
- Never silently auto-promote a draft.
- Never emit a Low-confidence source / chain without explicit `review_notes`.
- Never aggregate critical / high findings into a "polish pass" — that's for Low only.
- Every drafted source cites file:line evidence OR is excluded.
- **Trust tier MONOTONICITY** in the chain map: tier never increases step-to-step. Cross-check rejects any chain that violates this.
- Per-artifact Phase 0b skip is independent.
- Phase 0b is a strict no-op when both `docs/provenance/<name>.md` exist as non-draft files.

---

## Contract Alignment (ADR-038)

The briefing/output phase MUST emit this block (per ADR-038 Decision #6):

```
### Contract Alignment
- mode: <honored | departed (reason)>
- stretch: <honored | departed (reason)>
- success_shape: <honored — list which target items hit | departed (reason)>
- scope_ceiling: <complied — items skipped: [list] | violated (reason)>
```
