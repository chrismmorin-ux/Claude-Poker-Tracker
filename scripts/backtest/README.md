# Backtest harness — running it, and running it somewhere else

The WS-273 harness replays the HandHQ corpus through the engine and scores its predictions.
Everything here reads the corpus through `corpusFiles.mjs`.

## The corpus lives outside this repo

It is a **blobless sparse clone** of `phh-dataset` with the git pack retained after the
WS-262 mining. Blobs are already local, so any stake directory re-materialises with no
download:

```bash
cd <clone>                     # e.g. C:/Users/chris/data/phh-dataset
git sparse-checkout add data/handhq/PS-2009-07-01_2009-07-23_200NLH_OBFU
```

Directory names carry the two dimensions the harness slices on:

```
data/handhq/PS-2009-07-01_2009-07-23_200NLH_OBFU
            ^^                        ^^^^^^
            site                      stake label
```

## Pointing the harness at your copy (WS-321)

Resolution order, highest first:

| Source | Example |
|---|---|
| `--corpus-root` flag | `node scripts/backtest/run.mjs --corpus-root /srv/handhq` |
| `$HANDHQ_CORPUS_ROOT` | `export HANDHQ_CORPUS_ROOT=/srv/handhq` |
| Built-in G16 fallback | `C:/Users/chris/data/phh-dataset/data/handhq` |

**Use the environment variable for anything scheduled or unattended.** The flag is fine
interactively, but a cron job or a `/fleet-run` invocation that has to carry
`--corpus-root` on every call will eventually be run without it.

Before WS-321 the root was a hardcoded G16 path with no override at the module level, so
every consumer here was G16-only. That is why HomeBase WS-608/WS-609 (running these jobs
on CM-NODE1) listed it as a blocker.

## Bringing up a second machine

1. Clone `phh-dataset` blobless and sparse, or copy the existing clone across.
2. `git sparse-checkout add` at least one stake directory.
3. Set `HANDHQ_CORPUS_ROOT` to `<clone>/data/handhq` — persistently, in the machine's
   environment, not just the current shell.
4. Verify without running a full job:
   ```bash
   node -e "import('./scripts/backtest/corpusFiles.mjs').then(async m =>
     console.log((await m.discoverCorpusFiles()).length, 'files'))"
   ```
   A wrong or unmaterialised root **throws**, naming the path it tried and the variable to
   set. It never returns an empty list — see below.

## Why discovery throws instead of returning nothing

This is measurement code. A run that finds zero hands and reports "no leakage detected"
is a **false green**, and the harness's whole job is to be trusted about numbers. So both
"root missing" and "root present but empty" are errors, and both name the resolved path
and where it came from.

This is the same failure class as HomeBase WS-572, where a scheduled task reported success
while every pull failed and a node ran eight-day-stale code unnoticed.

## Entry points

| Script | Does |
|---|---|
| `run.mjs` | Main backtest — replay + score |
| `run-hero-ev.mjs` | Hero-EV instrument — does the ADVICE make money |
| `run-range-calibration.mjs` | Score inferred ranges against showdowns |
| `run-teachable-arms.mjs` | Study-ladder arm comparison |
| `mine-behavior-policy.mjs` | Behaviour-policy mining pass |
| `dump-records.mjs` | Emit per-decision records for `analyze_records.py` |

All six accept `--corpus-root` and all six honour `$HANDHQ_CORPUS_ROOT`.
