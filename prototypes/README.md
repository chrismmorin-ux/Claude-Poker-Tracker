# Prototypes — standalone interactive instruments

Self-contained HTML files. Open directly in a browser — no build, no dev server, no app dependencies. Nothing here imports from `src/`, and nothing in `src/` imports from here.

**Why this directory exists:** some questions are answered faster by a throwaway instrument than by a spec. These files are *evidence*, not features. Some are disposable demos; some are load-bearing research instruments a design gate is blocked on. The table says which.

**Status vocabulary**
`instrument` — a measurement tool a gate depends on. Do not delete.
`demo` — validated a mechanism, kept for reference. Disposable once absorbed.
`design source` — the origin artifact for a shipped or specced surface.

---

## Index

| File | Status | What it does | Owner action | Referenced from |
|------|--------|--------------|--------------|-----------------|
| `projection-explorer-gate3.html` | **instrument** | Numeric calibration tool for the Projection Explorer. Drag-drop a real `poker-tracker-backup-*.json`; computes full-feature-space silhouette, classifier-blind silhouette, k-means disagreement, and the 2D-vs-3D readability comparison — independent of the picture. | ⚠️ **Gate 3 is blocked on the owner running this against a real backup.** Report the four calibration numbers + the 2D-vs-3D preference. | `docs/design/audits/2026-06-18-gate3-research-projection-explorer.md` · `.claude/projects/projection-explorer.md` · WS-234 |
| `player-cloud-3d.html` | demo | v1 throwaway. Projects logged opponents as 7-feature tendency vectors into a rotatable 3D cloud via PCA; dot = opponent, colour = style label, size = sample confidence. Validated the mechanism on synthetic data only. | None — superseded by the Gate 3 instrument above. | `docs/design/audits/2026-06-18-entry-projection-explorer.md` · `...-blindspot-projection-explorer.md` |
| `voice-hand-timeline.html` | design source | Standalone design source for the voice hand-timeline editor. Became `src/components/views/VoiceTimelineSandbox/`. | None. | `docs/design/surfaces/voice-hand-timeline.md` · DEC-021 |
| `voice-action-sequence.html` | design source | Companion exploration — voice action-sequence parsing shape. | None. | DEC-021 context |

---

## Where the rest of the visual reference lives

This directory is one of seven places. Full picture:

| What | Location |
|------|----------|
| Interactive instruments & prototypes | `prototypes/` — this file |
| Sidebar visual prototype | `docs/sidebar-prototype.html` |
| Ignition sidebar visual harness (16 scenarios, live) | `cd ignition-poker-tracker && npm run harness` → `localhost:3333` |
| Design-audit evidence screenshots | `docs/design/audits/evidence/` |
| Line-audit evidence screenshots | `docs/design/audits/line-audits/evidence/` |
| Playwright visual baselines | `tests/playwright/*.spec.js-snapshots/` |
| Surface specs (the written counterpart to all of the above) | `docs/design/surfaces/` — indexed in `docs/design/surfaces/CATALOG.md` |

There are **no stored 3D model files** in this repo. The 3D work is runtime canvas rendering inside the two projection prototypes above — there is nothing to open in a model viewer.

## Conventions

- **One file, no dependencies.** If a prototype needs a package, it does not belong here.
- **Register it in the table above when you add one.** An unlisted prototype is one nobody will find; that is the specific failure this README corrects.
- **Cite the prototype from the doc that depends on it, and cite the doc back.** Both directions, so either entry point leads to the other.
- **Prototypes are not tested and not linted.** They are outside the app's quality gates by design. Do not import from them.
- **Published artifacts are not a record.** Design research published to claude.ai leaves no repo trace. The record of record for any design decision is a file under `docs/design/` — the artifact is a view of it.
