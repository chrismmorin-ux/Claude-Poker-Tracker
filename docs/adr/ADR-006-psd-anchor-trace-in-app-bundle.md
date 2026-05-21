# ADR-006: PSD Anchor-Trace Destination — In-App Bundle

## Status
Accepted

## Date
2026-05-19

## Context

Pre-Session Drill (PSD) cards include section anchors back to the source `docs/upper-surface/reasoning-artifacts/*.md` artifact. The PSD Gate 1 audit (2026-04-23) proposed this as DS-58 ("Anchor-trace from drill card to deep artifact when curious") and listed it as Q6 open question. Gate 2 (2026-05-19) routed the destination decision to this ADR.

Four destination options were enumerated in Gate 2 Stage D-P5:

1. **In-app bundle** — bundle `docs/upper-surface/` into the app; render artifact sections natively. Offline-robust; bundle-size cost.
2. **Inline expansion** — truncated section appears in-card; no deep nav. UX cost (information density); no offline dependency.
3. **External link** — opens hosted docs version in system browser. No bundle cost; mobile-fragile (no signal = no access).
4. **Defer to Range Lab Gate 4** — if WS-053 / WS-054 / WS-055 brings artifact rendering into the app for Range Lab, PSD inherits the renderer; v1 PSD ships with no anchor-trace.

The choice shapes WS-199 (Gate 4 surface spec) navigation section + WS-195 (Gate 3) DS-58 JTBD domain placement (cross-cutting vs drills-and-study) + WS-198 bundle-size impact.

## Decision

**Bundle `docs/upper-surface/` into the app.** Render artifact sections natively using existing markdown components. Anchor-trace tap on a PSD card navigates to the corresponding artifact section using fragment IDs (`§ headings`).

Bundle size estimate: 15 artifacts × ~10 KB/artifact ≈ 150 KB at v1. Projected ~500 KB at the 50-artifact corpus target (Gate 1 minimum-meaningful threshold). Acceptable cost — current production bundle is multi-MB; 500 KB is <5% increment.

## Alternatives Considered

### Inline expansion
- **Pros:** No bundle-size cost. No offline dependency. Simpler implementation.
- **Cons:**
  - The Gate 1 DS-58 outcome ("dig deeper into the full §11 ledger or §13 leading-theory comparison") cannot be served — truncated sections sacrifice the depth that motivated the JTBD
  - Information-density rise inside the card body conflicts with Stage E-A1 (flip-card body is dominant tap target; no competing controls inside card body)
  - Tri-state self-grade affordance (E-A4) competes for card-body real estate with inline expansion content

### External link
- **Pros:** No bundle cost. Always-fresh content (no re-bundle on artifact authoring).
- **Cons:**
  - Mobile-fragile: pre-session use is in cab / walking — Stage D Mobile-Context Skeptic flagged this directly. User in low-signal context cannot access deep context = anchor-trace fails when it matters most.
  - Persona file (`presession-preparer.md` Constraints) lists phone as the primary device. External-link dependency contradicts the persona's stated context.
  - Hosted docs do not exist yet; would require new infrastructure (docs site + deploy pipeline) to deliver this option.

### Defer to Range Lab Gate 4
- **Pros:** Avoids duplicate infra. Coordinates artifact-rendering ownership across two features that need it.
- **Cons:**
  - v1 PSD ships *without* the anchor-trace JTBD — the feature loses one of its four proposed outcomes (DS-58)
  - WS-053 Range Lab Gate 2 has not closed; the cascade of Gates 3/4 may not deliver artifact rendering as part of Range Lab's scope (Range Lab may opt for a different artifact-consumption pattern)
  - Coupling PSD's ship date to an unrelated feature's design progression is a coordination liability

### "Build now, share if Range Lab needs it later"
This decision implicitly takes that posture: PSD owns the renderer first. If Range Lab Gate 4 later wants in-app artifact rendering, the WS-053 work track inherits PSD's renderer rather than the reverse. Coordination noted in WS-195's Gate 3 deliverable.

## Consequences

### Positive
- Offline-robust per the persona's primary context (phone-in-cab)
- DS-58 JTBD ships in full at v1 — anchor-trace is a real navigation affordance, not a token affordance
- Bundle-size cost is small (5% projected at corpus saturation)
- Inverts ownership of artifact-renderer infrastructure: PSD owns it, Range Lab Gate 4 can inherit. Cleaner dependency direction (study-surface ↔ study-surface, no engineering-track coupling)

### Negative
- Bundle-size cost rises as corpus grows (linear in artifact count)
- Build-time pipeline must include `docs/upper-surface/` (Vite import.meta.glob pattern; precedent: HRP corpus loading at PWA boot — see SPR-087 / WS-193 `spotResolver/corpusIndex.js`)
- Artifact changes require rebuild; cannot ship corpus updates independent of app deploy (acceptable — corpus authoring is owner-driven, not high-velocity)

### Mitigations
- Lazy-loaded artifact bundle: artifacts are deferred imports; landing PSD doesn't fetch them until first anchor-trace tap (Vite dynamic import)
- Pre-built section anchor index for O(1) lookup (precedent: HRP `corpusIndex.js` LINES static import pattern)
- WS-198 (`hands` ↔ node-ID cross-reference) shares the bundle pipeline; no duplicated work

### DS-58 JTBD domain placement
WS-195 Gate 3 work places DS-58 in `drills-and-study.md` rather than `cross-cutting.md`. Rationale: with in-app rendering, the anchor-trace becomes a *drill-internal* navigation pattern (tap from card → artifact section → back to card), not a cross-surface navigation. Cross-cutting placement would be appropriate if the artifact-trace were a global app-wide affordance (e.g., HandReplay → artifact + Range Lab → artifact + PSD → artifact), but PSD is the first consumer; Range Lab inheriting the renderer doesn't promote DS-58 to cross-cutting until other surfaces actually consume it.

## References

- Gate 1 audit: [`docs/design/audits/2026-04-23-entry-pre-session-drill.md`](../design/audits/2026-04-23-entry-pre-session-drill.md) Q6 + DS-58 proposal
- Gate 2 audit: [`docs/design/audits/2026-05-19-blindspot-pre-session-drill.md`](../design/audits/2026-05-19-blindspot-pre-session-drill.md) Stage D-P5 + YELLOW condition #3
- Persona constraint: [`docs/design/personas/situational/presession-preparer.md`](../design/personas/situational/presession-preparer.md) "Phone primarily (walking to venue)"
- Precedent (corpus bundling pattern): SPR-087 / WS-193 spotResolver `corpusIndex.js` uses Vite `import.meta.glob` for LINES + reasoning artifacts
- Sprint: SPR-091. Ticket: WS-197.
- Implementation surface: WS-199 (Gate 4 navigation spec). Coordination: WS-053 (Range Lab Gate 2 → potential WS-053+ Gate 4 may inherit the renderer).
