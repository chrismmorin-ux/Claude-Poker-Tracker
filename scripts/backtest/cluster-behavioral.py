"""
cluster-behavioral.py — does POSTFLOP behaviour reveal sub-types the preflop stats miss?

RESEARCH-ONLY (WS-436 close, 2026-08-12). Zero downstream code consumers, by
design — out/behavioral-clusters.json is gitignored. The finding shipped instead
of the artifact: behavioural features confirm the k=2 continuum (authored
six-label partition purity 0.63 / 0.44, 21.1% Unknown fallthrough), and WS-436
removed the six labels as engine inputs in favour of continuous shrunk
posteriors. See docs/research/player-archetypes-empirical-2026-07-26.md for the
durable record and the number any future archetype rung must beat.

The founder's objection, 2026-07-26, and it was correct:

    "it is a little concerning that the labels don't encompass potential
     sub-behavior and how to identify and adapt to it. It certainly feels like
     there are more styles of play when at a live table (observing trapping
     frequencies, bluff frequencies, aggression, limp raises, triple barrel bluff
     capable) but that all finds its way into a specific player's history."

The first pass clustered on six PREFLOP-weighted stats and found two poles. That
was a statement about the FEATURE SET, not about the pool. This re-runs the
question on the behaviours actually named, and does the requested close-up: take
the dominant preflop group and sub-cluster it on behaviour alone.

Requires both mining passes:
  cluster-player-types.py   -> preflop stats  (assigns the two poles)
  mine-behavioral-features.py -> postflop/line features

Usage:
    python scripts/backtest/cluster-behavioral.py \
        --behavioral out/behavioral-features.json \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --miner-path C:/Users/chris/data/phh-mining \
        --out out/behavioral-clusters.json
"""

import argparse
import json
import os
import sys
from collections import defaultdict

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from cluster_helpers import kmeans, mean_silhouette  # noqa: E402

# (feature, minimum denominator).
#
# THE THRESHOLDS ARE THE FINDING. Measured per-player denominators over 59,736
# corpus players (1.07M hands of 50NL):
#
#   feature            median n   p90    p99    max
#   triple_barrel             0     2      9      80
#   check_raise_flop          0     4     13      86
#   river_bet_air             0     3     10      51
#   double_barrel             1     7     46     456
#   donk_flop                 3    18     63     425
#
# The behaviours a live player most wants to read — does this villain triple
# barrel, does he check-raise, does he bluff the river — occur so rarely that
# even the 99th-percentile player offers under a dozen observations. An
# INDIVIDUAL rate for them is not estimable at any realistic sample size. That is
# not a mining artefact; it is a property of poker.
#
# So they are excluded from the FITTED set (a rate over 2 trials clusters as
# noise) and reported as DESCRIPTIVE per cluster instead. The practical
# consequence is the argument for archetype-level pooling: you cannot learn
# whether THIS villain triple-barrels, but you may be able to learn whether
# players like him do.
BEHAVIORAL = [
    ("double_barrel", 10),
    ("donk_flop", 15),
    ("wtsd", 30),
    ("fold_big", 20),
    ("fold_small", 15),
]

# Rare or censored. Reported per cluster, never fitted. `river_bet_air` and
# `showdown_slowplay` are additionally showdown-conditional, so they describe
# called-and-shown hands rather than the player's true frequency.
DESCRIPTIVE = [
    ("triple_barrel", 5),
    ("check_raise_flop", 5),
    ("river_bet_air", 4),
    ("showdown_slowplay", 5),
    ("limp_raise", 10),
]


def load_behavioral(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)["players"]


def build_matrix(players, feature_spec):
    rows, ids = [], []
    for pid, d in players.items():
        vec, ok = [], True
        for feat, min_n in feature_spec:
            k, n = d.get(feat, [0, 0])
            if n < min_n:
                ok = False
                break
            vec.append(k / n)
        if not ok:
            continue
        agg, call = d.get("pf_bets_raises", [0, 0])
        if call < 15:
            continue
        vec.append(min(agg / call, 5.0))     # postflop AF, capped so one outlier cannot dominate
        rows.append(vec)
        ids.append(pid)
    return np.array(rows, dtype=float), ids


def describe(players, ids, feats):
    out = {}
    for feat, min_n in feats:
        vals = []
        for pid in ids:
            k, n = players[pid].get(feat, [0, 0])
            if n >= min_n:
                vals.append(k / n)
        out[feat] = {"n_players": len(vals),
                     "mean": round(float(np.mean(vals)), 4) if vals else None}
    return out


def sweep(Z, rng, kmax, label):
    print("\n%s" % label)
    best = None
    rows = []
    for k in range(2, kmax + 1):
        C, labels, inertia = kmeans(Z, k, rng)
        sil = mean_silhouette(Z, labels, rng)
        rows.append({"k": k, "inertia": float(inertia), "silhouette": sil})
        print("  k=%-2d inertia=%9.1f silhouette=%s" % (k, inertia, ("%.4f" % sil) if sil else "n/a"))
        if sil is not None and (best is None or sil > best["sil"]):
            best = {"k": k, "sil": sil, "C": C, "labels": labels}
    return rows, best


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--behavioral", required=True)
    ap.add_argument("--preflop-clusters", default=None,
                    help="out/player-clusters.json — optional, for the pole close-up")
    ap.add_argument("--out", required=True)
    ap.add_argument("--kmax", type=int, default=8)
    args = ap.parse_args()

    players = load_behavioral(args.behavioral)
    X, ids = build_matrix(players, BEHAVIORAL)
    names = [f for f, _ in BEHAVIORAL] + ["postflop_af"]
    print("%d players clear every behavioural minimum" % len(ids))
    if len(ids) < 50:
        sys.exit("too few players — lower the minimums or mine more stakes")

    mu, sd = X.mean(axis=0), X.std(axis=0)
    sd[sd == 0] = 1.0
    Z = (X - mu) / sd
    rng = np.random.default_rng(20260726)

    rows, best = sweep(Z, rng, args.kmax, "ALL PLAYERS, behavioural features:")
    k, labels = best["k"], best["labels"]
    centers = best["C"] * sd + mu
    print("  best k = %d (silhouette %.4f)" % (k, best["sil"]))

    clusters = []
    for j in range(k):
        mask = labels == j
        members = [ids[i] for i in np.where(mask)[0]]
        clusters.append({
            "cluster": j,
            "n": int(mask.sum()),
            "share": round(float(mask.mean()), 4),
            "centroid": {names[c]: round(float(centers[j, c]), 4) for c in range(len(names))},
            "descriptive": describe(players, members, DESCRIPTIVE),
        })
    clusters.sort(key=lambda c: -c["n"])

    payload = {
        "question": "Do postflop behaviours reveal sub-types the preflop stats cannot see?",
        "caveat": ("HandHQ online cash, July 2009 (SRC-011). river_bet_air and "
                   "showdown_slowplay are CENSORED showdown-only conditionals and are "
                   "DESCRIPTIVE ONLY — never fitted. Live generalisation is an assumption."),
        "featuresFitted": names,
        "featuresDescriptiveOnly": [f for f, _ in DESCRIPTIVE],
        "players": len(ids),
        "kSweep": rows,
        "bestK": k,
        "bestSilhouette": best["sil"],
        "clusters": clusters,
    }

    # ---- the requested close-up: sub-cluster the dominant preflop pole
    if args.preflop_clusters and os.path.exists(args.preflop_clusters):
        payload["closeUpNote"] = (
            "Sub-clustering within a preflop pole requires per-player pole assignment, "
            "which cluster-player-types.py does not currently persist. The all-players "
            "behavioural sweep above is the substantive answer; the pole close-up needs "
            "that script to emit member ids.")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("wrote %s" % args.out)


if __name__ == "__main__":
    main()
