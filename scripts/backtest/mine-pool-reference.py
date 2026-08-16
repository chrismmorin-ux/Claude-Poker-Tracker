"""
mine-pool-reference.py — WS-273. Mine a BACKTEST-ONLY Reference table from POOL players.

WHY THIS EXISTS
---------------
`src/utils/exploitEngine/handhqReferencePool.js` (SRC-011) was mined from ALL
12.9M HandHQ hands. It is correct for production — it is the Reference tier the
app ships. But it makes WS-273's acceptance criterion ("no hand used for prior
fitting may appear in the scored set") impossible to satisfy against the corpus,
because every corpus hand trained it.

This script produces a SECOND, backtest-only table built from the POOL half of
the player partition. The EVAL half — the only players the harness scores — then
contributed nothing to the priors they are scored against.

The shipped table is NOT touched. This output is never imported by the app.

USAGE
-----
    python scripts/backtest/mine-pool-reference.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --miner-path  C:/Users/chris/data/phh-mining \
        --out         out/pool-reference.json \
        [--pool-pct 50] [--workers 8] [--stakes 200NLH,400NLH]

Then feed it to the harness:

    node scripts/backtest/run.mjs --reference out/pool-reference.json

RUNTIME. Cheap. The WS-262 mine recorded its own wall-clock in each output file's
`_meta.elapsed_s`: **278 s total (4.6 min)** for all 28 site x stake directories,
21,783 files, at 8 workers on the G16. The dominant cost is not the mining, it is
re-materialising the corpus working tree (15.2 GB) from the local git pack.

WHAT IS REUSED. Hand parsing and stat semantics come from the WS-262 miner
(`phh_miner.py`) unchanged, so the POOL table means exactly what the shipped
table means — same canonical definitions, including the deliberate foldTo3Bet
quirk. The ONLY difference is which players are counted.
"""

import argparse
import json
import os
import sys
import time
from collections import defaultdict

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from partition import partition_of, GROUP_POOL, DEFAULT_POOL_PCT  # noqa: E402
from corpus_stamp import corpus_stamp  # noqa: E402

# Mirrors STAKE_MAP in scripts/generate-handhq-reference.mjs. Mined labels are
# buy-in denominated (25NL = $25 max buy-in = $0.10/$0.25 blinds).
STAKE_MAP = [
    {"minedLabel": "25NLH", "bb": 0.25, "canonical": "0.1-0.25"},
    {"minedLabel": "50NLH", "bb": 0.5, "canonical": "0.25-0.5"},
    {"minedLabel": "100NLH", "bb": 1, "canonical": "0.5-1"},
    {"minedLabel": "200NLH", "bb": 2, "canonical": "1-2"},
    {"minedLabel": "400NLH", "bb": 4, "canonical": "2-4"},
    {"minedLabel": "600NLH", "bb": 6, "canonical": "3-6"},
    {"minedLabel": "1000NLH", "bb": 10, "canonical": "5-10"},
]

SEAT_BUCKETS = ["6max", "full"]
STAT_KEYS = ["vpip", "pfr", "threeBet", "foldTo3Bet", "cbet", "foldToCbet"]

DIR_RE = None  # set in main once re is imported lazily


def stake_of_dir(name):
    """'PS-2009-07-01_2009-07-23_200NLH_OBFU' -> ('PS', '200NLH')."""
    import re
    m = re.match(r"^([A-Z]+)-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}_(\d+NLH)_OBFU$", name)
    return (m.group(1), m.group(2)) if m else (None, None)


def pool_counts_for_dir(dir_path, mine_file, pool_pct, workers):
    """Mine one stake directory, keeping only POOL players' per-player rows.

    Returns { seat_bucket: { 'hands': n, 'stats': {stat: {k, n}} } }.

    The partition filter is applied to the PER-PLAYER maps the miner already
    produces, so a hand containing both POOL and EVAL players contributes only
    its POOL players' rows. That is sound because all six Reference stats are
    per-player tallies.
    """
    from multiprocessing import Pool

    files = []
    for root, _, names in os.walk(dir_path):
        files.extend(os.path.join(root, f) for f in names if f.endswith(".phhs"))

    merged = {}
    with Pool(workers) as pool:
        for res in pool.imap_unordered(mine_file, files, chunksize=4):
            for bucket, agg in res.items():
                if bucket not in SEAT_BUCKETS:
                    continue  # hu / short excluded, matching WS-262 headline numbers
                tgt = merged.setdefault(bucket, {"hands": 0, "players": defaultdict(lambda: defaultdict(lambda: [0, 0]))})
                tgt["hands"] += agg["hands"]
                for pid, stats in agg["players"].items():
                    if partition_of(pid, pool_pct) != GROUP_POOL:
                        continue
                    for s, (k, n) in stats.items():
                        tgt["players"][pid][s][0] += k
                        tgt["players"][pid][s][1] += n

    out = {}
    for bucket, data in merged.items():
        totals = {s: [0, 0] for s in STAT_KEYS}
        for stats in data["players"].values():
            for s in STAT_KEYS:
                k, n = stats.get(s, (0, 0))
                totals[s][0] += k
                totals[s][1] += n
        out[bucket] = {
            "hands": data["hands"],
            "poolPlayers": len(data["players"]),
            "stats": {s: {"k": totals[s][0], "n": totals[s][1]} for s in STAT_KEYS},
        }
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--corpus-root", required=True)
    ap.add_argument("--miner-path", required=True, help="directory containing phh_miner.py")
    ap.add_argument("--out", required=True)
    ap.add_argument("--pool-pct", type=int, default=DEFAULT_POOL_PCT)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--stakes", default=None, help="comma-separated mined labels, e.g. 200NLH,400NLH")
    args = ap.parse_args()

    sys.path.insert(0, args.miner_path)
    try:
        from phh_miner import mine_file
    except ImportError:
        ap.error(f"could not import phh_miner from {args.miner_path}")

    wanted = set(args.stakes.split(",")) if args.stakes else None

    t0 = time.time()
    by_stake = defaultdict(lambda: {b: None for b in SEAT_BUCKETS})

    for name in sorted(os.listdir(args.corpus_root)):
        full = os.path.join(args.corpus_root, name)
        if not os.path.isdir(full):
            continue
        site, stake = stake_of_dir(name)
        if not stake or (wanted and stake not in wanted):
            continue
        print("mining %s (%s %s)…" % (name, site, stake), flush=True)
        counts = pool_counts_for_dir(full, mine_file, args.pool_pct, args.workers)
        for bucket, data in counts.items():
            acc = by_stake[stake][bucket]
            if acc is None:
                by_stake[stake][bucket] = data
            else:
                acc["hands"] += data["hands"]
                acc["poolPlayers"] += data["poolPlayers"]
                for s in STAT_KEYS:
                    acc["stats"][s]["k"] += data["stats"][s]["k"]
                    acc["stats"][s]["n"] += data["stats"][s]["n"]

    stakes = []
    for entry in STAKE_MAP:
        label = entry["minedLabel"]
        buckets = by_stake.get(label)
        if not buckets:
            continue
        usable = {b: v for b, v in buckets.items() if v and v["stats"]["vpip"]["n"] > 0}
        if not usable:
            continue
        stakes.append({
            "bb": entry["bb"],
            "canonical": entry["canonical"],
            "minedLabel": label,
            # WS-373 — WHICH POPULATION this row describes. The accumulation above sums
            # raw k and n across players, so a 40,000-hand regular carries 40x the weight
            # of a 1,000-hand recreational: this is the average HAND dealt, not the
            # average PLAYER. Stamped per row because poolBaseline.referenceWeightingFor
            # reads it off the matched row, and a consumer that receives a prior with no
            # declared basis REFUSES the run rather than assuming one.
            "weighting": "hand-weighted",
            "buckets": {b: {"hands": v["hands"], "stats": v["stats"]} for b, v in usable.items()},
        })

    if not stakes:
        print("ERROR: no stake rows produced — check --corpus-root and --stakes", file=sys.stderr)
        sys.exit(1)

    payload = {
        "provenance": {
            # The stamp leakageGuard.validateReferenceTable REQUIRES. Without it
            # the harness refuses to run, which is the point: an unstamped table
            # is assumed to be the corpus-wide one.
            "partition": "pool-train",
            "poolPct": args.pool_pct,
            "generator": "scripts/backtest/mine-pool-reference.py",
            "corpusRoot": args.corpus_root,
            # WS-492 — WHAT WAS ACTUALLY ON DISK. corpusRoot is a path and cannot
            # distinguish the 2-dir sparse slice this repo mined until 2026-08-15
            # from the full 27-dir corpus. Without this the two runs are
            # indistinguishable in their own manifests.
            "corpus": corpus_stamp(args.corpus_root),
            "stakesMined": sorted(by_stake.keys()),
            "elapsedS": round(time.time() - t0, 1),
            "caveat": (
                "HandHQ online cash, July 2009, numeric stakes. BACKTEST ONLY — "
                "never import into the app; the shipped Reference tier is "
                "src/utils/exploitEngine/handhqReferencePool.js (SRC-011)."
            ),
        },
        "stakes": stakes,
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("wrote %s (%d stake rows) in %.0fs" % (args.out, len(stakes), time.time() - t0))


if __name__ == "__main__":
    main()
