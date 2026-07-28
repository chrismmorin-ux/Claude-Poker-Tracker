# GUT probes — numerical tests of registered assumptions

Standalone Node scripts that test an `AS-GUT-N` assumption from the charter. Each prints its result to stdout and asserts nothing — they are **measurements**, not tests. Results are transcribed into the charter's "Probe results" section with a date.

## Running them

The repo's source uses extensionless relative imports (Vite resolves these; bare Node does not). `loader.mjs` + `register.mjs` are a resolver shim so the probes can run **without `npm install`**:

```bash
cd docs/projects/grand-unified-theory/probes
node --import ./register.mjs probe-entropy.mjs
node --import ./register.mjs probe-spr.mjs
```

If `node_modules` is present you can instead run them through Vite's own resolver and drop the shim.

## Index

| Probe | Tests | Result | Verdict |
|---|---|---|---|
| `probe-entropy.mjs` | **AS-GUT-4** — does range entropy separate morphology classes? | 564 (range × board) pairs from 47 real archetype ranges × 12 flops. No class pair cleanly separates. polarized-vs-linear d=0.73, linear-vs-condensed d=0.73. | **FALSIFIED** as written |
| `probe-spr.mjs` | **AS-GUT-2** — are SPR regime boundaries switch-like, and do they follow a law? | Stacking law derives 4 and 13 exactly; 2 and 8 do not follow the same sizing. One-street model degenerates to always-jam. | **AMENDED** — partially supported |

## Design rule learned the hard way

`probe-spr.mjs` was **redesigned mid-session because the original was circular.** The first design swept SPR through `evaluateGameTree` and looked for discontinuities — but `gameTreeConstants.js:93-97` hardcodes the zone cuts at 2/4/8/13 and `buildHeroActions` branches on them, so the probe would have rediscovered its own input.

**Rule for every future probe: name the code path that could make the result circular, and route around it.** A probe that consumes the constant it is testing measures the implementation, not the game.
