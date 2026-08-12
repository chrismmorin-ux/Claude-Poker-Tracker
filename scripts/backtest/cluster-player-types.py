"""
cluster-player-types.py — WS-273 follow-on. Are the app's player archetypes real?

RESEARCH-ONLY (WS-436 close, 2026-08-12). This script has ZERO downstream code
consumers, by design — its artifact (out/player-clusters.json) is gitignored and
does not persist member ids, so it cannot be joined back to players. Its FINDING
is what shipped: bestK = 2, silhouette 0.3428 (more than double every other k),
inertia falling smoothly with no elbow — a continuum with one dominant
looseness/stickiness axis, not six discrete types. That finding is carried into
code by WS-436: the game-tree engine derives villain parameters from continuous
shrunk posteriors (villainModelData.villainFoldLevel, and the continuous
Dirichlet prior seed in villainDecisionModel.buildActionPriors), never from the
six classifyStyle labels. Durable record:
docs/research/player-archetypes-empirical-2026-07-26.md — which also names the
instrument for any future archetype rung (dump-records/runner arm) and the
number to beat: 1.69% lift / 52.2% accuracy over 10,147 held-out decisions.

THE QUESTION (founder, 2026-07-26): "did we just use our existing player
archetypes or did we do any sort of k clustering to see if there are predominant
types in the data?"

Answer at the time: existing archetypes only. `tendencyCalculations.classifyStyle`
partitions villains with SIX HAND-AUTHORED THRESHOLDS —

    vpip > 40                        -> Fish
    vpip > 30 and pfr > 20           -> LAG
    vpip > 30 and pfr < 10           -> LP
    vpip < 15 and pfr < 10           -> Nit
    20<=vpip<=30, 15<=pfr<=25, af>1.5 -> Reg
    15<=vpip<=30, 10<=pfr<=25        -> TAG
    otherwise                        -> Unknown

— and that label selects STYLE_PRIORS, which seed the villain decision model. The
thresholds were authored, never derived. With 12.9M hands of per-player data we
can ask the population directly instead.

WHY IT MATTERS BEYOND TIDINESS. The WS-273 ablation found the model is
DATA-STARVED: conditioning on a dimension splits a villain's history into cells
too thin to beat the population prior. Archetype is a conditioning dimension too.
If the authored buckets cut the population along the wrong seams, they impose
exactly that cost while delivering less separation than a data-derived partition
would. Whether the six buckets are natural is therefore a live accuracy question,
not a cosmetic one.

METHOD
  - Per-player (k, n) tallies come from the WS-262 miner UNCHANGED, so the stat
    semantics match the app exactly (including the deliberate foldTo3Bet quirk).
  - Features: the six canonical rates, z-scored (k-means is scale-sensitive and
    the raw rates span very different ranges).
  - k-means++ init + Lloyd's algorithm, implemented here — sklearn is not
    installed and this does not justify adding a dependency. Deterministic seed:
    a clustering that moves between runs cannot be cited.
  - Model selection: inertia (elbow) + mean silhouette on a subsample.
  - Then cross-tab the discovered clusters against the authored labels.

LIMITATION, STATED UP FRONT: the miner does not compute aggression factor (AF),
and `classifyStyle` needs AF only to separate 'Reg' from 'TAG'. Every other label
is reproducible from VPIP/PFR alone. Reg is therefore folded into TAG here and
the comparison is against a 5-label variant. Flagged wherever it matters.

Usage:
    python scripts/backtest/cluster-player-types.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --miner-path  C:/Users/chris/data/phh-mining \
        --min-hands 200 --out out/player-clusters.json
"""

import argparse
import json
import os
import sys
from collections import defaultdict

import numpy as np

STAT_KEYS = ["vpip", "pfr", "threeBet", "foldTo3Bet", "cbet", "foldToCbet"]
SEAT_BUCKETS = ("6max", "full")


# ---------------------------------------------------------------- authored labels
def classify_style(vpip_pct, pfr_pct):
    """Mirror of tendencyCalculations.classifyStyle, minus the AF-dependent 'Reg'.

    Order matters and is preserved exactly — the JS returns on the FIRST match,
    so re-ordering these silently relabels players.
    """
    if vpip_pct > 40:
        return "Fish"
    if vpip_pct > 30 and pfr_pct > 20:
        return "LAG"
    if vpip_pct > 30 and pfr_pct < 10:
        return "LP"
    if vpip_pct < 15 and pfr_pct < 10:
        return "Nit"
    # 'Reg' would be tested here; it needs AF, which the miner does not compute.
    if 15 <= vpip_pct <= 30 and 10 <= pfr_pct <= 25:
        return "TAG"
    return "Unknown"


# ---------------------------------------------------------------- k-means
def kmeans_pp_init(X, k, rng):
    """k-means++ seeding — plain random init produces unstable, poor solutions."""
    n = X.shape[0]
    centers = [X[rng.integers(n)]]
    for _ in range(1, k):
        d2 = np.min(((X[:, None, :] - np.array(centers)[None, :, :]) ** 2).sum(axis=2), axis=1)
        total = d2.sum()
        if total <= 0:
            centers.append(X[rng.integers(n)])
            continue
        centers.append(X[rng.choice(n, p=d2 / total)])
    return np.array(centers)


def kmeans(X, k, rng, iters=100, tol=1e-7):
    C = kmeans_pp_init(X, k, rng)
    labels = np.zeros(X.shape[0], dtype=int)
    for _ in range(iters):
        d2 = ((X[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)
        new_labels = d2.argmin(axis=1)
        newC = np.array([
            X[new_labels == j].mean(axis=0) if np.any(new_labels == j) else C[j]
            for j in range(k)
        ])
        shift = np.abs(newC - C).max()
        C, labels = newC, new_labels
        if shift < tol:
            break
    inertia = float(((X - C[labels]) ** 2).sum())
    return C, labels, inertia


def mean_silhouette(X, labels, rng, sample=2000):
    """Mean silhouette on a subsample — the full O(n^2) matrix is not affordable."""
    n = X.shape[0]
    idx = rng.choice(n, size=min(sample, n), replace=False)
    Xs, ls = X[idx], labels[idx]
    uniq = np.unique(ls)
    if len(uniq) < 2:
        return None
    D = np.sqrt(((Xs[:, None, :] - Xs[None, :, :]) ** 2).sum(axis=2))
    sil = []
    for i in range(len(Xs)):
        same = ls == ls[i]
        same[i] = False
        if not np.any(same):
            continue
        a = D[i, same].mean()
        b = min(D[i, ls == c].mean() for c in uniq if c != ls[i])
        sil.append((b - a) / max(a, b))
    return float(np.mean(sil)) if sil else None


# ---------------------------------------------------------------- data
def collect_players(corpus_root, mine_file, workers, min_hands, stakes=None):
    """Per-player (k, n) tallies, merged across every mined file."""
    import re
    from multiprocessing import Pool

    files = []
    for name in sorted(os.listdir(corpus_root)):
        d = os.path.join(corpus_root, name)
        if not os.path.isdir(d):
            continue
        m = re.match(r"^([A-Z]+)-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}_(\d+NLH)_OBFU$", name)
        if not m or (stakes and m.group(2) not in stakes):
            continue
        for root, _, names in os.walk(d):
            files.extend(os.path.join(root, f) for f in names if f.endswith(".phhs"))

    if not files:
        sys.exit("no .phhs files found — check --corpus-root / --stakes")
    print("mining %d files for per-player vectors..." % len(files), flush=True)

    players = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    with Pool(workers) as pool:
        for i, res in enumerate(pool.imap_unordered(mine_file, files, chunksize=4)):
            for bucket, agg in res.items():
                if bucket not in SEAT_BUCKETS:
                    continue
                for pid, stats in agg["players"].items():
                    for s, (k, n) in stats.items():
                        players[pid][s][0] += k
                        players[pid][s][1] += n
            if (i + 1) % 300 == 0:
                print("  %d/%d files, %d players" % (i + 1, len(files), len(players)), flush=True)

    rows, ids = [], []
    for pid, stats in players.items():
        vp = stats.get("vpip", [0, 0])
        if vp[1] < min_hands:
            continue
        vec, ok = [], True
        for s in STAT_KEYS:
            k, n = stats.get(s, [0, 0])
            if n < 20:          # a rate over <20 trials is noise, not a feature
                ok = False
                break
            vec.append(k / n)
        if ok:
            rows.append(vec)
            ids.append(pid)
    return np.array(rows, dtype=float), ids


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--corpus-root", required=True)
    ap.add_argument("--miner-path", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--min-hands", type=int, default=200)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--kmax", type=int, default=10)
    ap.add_argument("--stakes", default=None)
    args = ap.parse_args()

    sys.path.insert(0, args.miner_path)
    try:
        from phh_miner import mine_file
    except ImportError:
        ap.error("could not import phh_miner from %s" % args.miner_path)

    stakes = set(args.stakes.split(",")) if args.stakes else None
    X, ids = collect_players(args.corpus_root, mine_file, args.workers, args.min_hands, stakes)
    print("\n%d players with >=%d preflop hands and all six stats" % (len(ids), args.min_hands))
    if len(ids) < 50:
        sys.exit("too few players to cluster — lower --min-hands or mine more stakes")

    mu, sd = X.mean(axis=0), X.std(axis=0)
    sd[sd == 0] = 1.0
    Z = (X - mu) / sd

    rng = np.random.default_rng(20260726)   # fixed: a clustering that moves cannot be cited
    sweep = []
    best = None
    for k in range(2, args.kmax + 1):
        C, labels, inertia = kmeans(Z, k, rng)
        sil = mean_silhouette(Z, labels, rng)
        sweep.append({"k": k, "inertia": inertia, "silhouette": sil})
        print("  k=%-2d inertia=%10.1f silhouette=%s" % (k, inertia, ("%.4f" % sil) if sil else "n/a"))
        if sil is not None and (best is None or sil > best["sil"]):
            best = {"k": k, "sil": sil, "C": C, "labels": labels}

    k = best["k"]
    labels = best["labels"]
    centers_raw = best["C"] * sd + mu
    print("\nbest k by silhouette = %d (%.4f)" % (k, best["sil"]))

    # Authored label for each player, from the same vectors.
    authored = [classify_style(X[i, 0] * 100, X[i, 1] * 100) for i in range(len(ids))]

    clusters = []
    for j in range(k):
        mask = labels == j
        counts = defaultdict(int)
        for i in np.where(mask)[0]:
            counts[authored[i]] += 1
        total = int(mask.sum())
        clusters.append({
            "cluster": j,
            "n": total,
            "share": total / len(ids),
            "centroid": {s: round(float(centers_raw[j, c]), 4) for c, s in enumerate(STAT_KEYS)},
            "authoredMix": {kk: {"n": v, "share": round(v / total, 4)}
                            for kk, v in sorted(counts.items(), key=lambda x: -x[1])},
            "purity": round(max(counts.values()) / total, 4),
        })
    clusters.sort(key=lambda c: -c["n"])

    auth_counts = defaultdict(int)
    for a in authored:
        auth_counts[a] += 1

    payload = {
        "question": "Are the app's hand-authored player archetypes the natural partition of the pool?",
        "caveat": ("HandHQ online cash, July 2009, numeric stakes (SRC-011). "
                   "'Reg' is folded into TAG: the miner does not compute AF, which is the "
                   "only thing separating them. Live generalisation is an assumption."),
        "players": len(ids),
        "minHands": args.min_hands,
        "features": STAT_KEYS,
        "featureMeans": {s: round(float(mu[i]), 4) for i, s in enumerate(STAT_KEYS)},
        "kSweep": sweep,
        "bestK": k,
        "bestSilhouette": best["sil"],
        "clusters": clusters,
        "authoredDistribution": {kk: {"n": v, "share": round(v / len(ids), 4)}
                                 for kk, v in sorted(auth_counts.items(), key=lambda x: -x[1])},
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("wrote %s" % args.out)


if __name__ == "__main__":
    main()
