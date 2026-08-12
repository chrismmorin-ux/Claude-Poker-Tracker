"""
latent-class-behaviors.py — is a behaviour something you either DO or DON'T, or a dial?

RESEARCH-ONLY (WS-436 close, 2026-08-12). Zero downstream code consumers, by
design — out/latent-classes.json is gitignored. The finding shipped instead of
the artifact: 8 of 9 behaviours are DIALS, not switches (only triple_barrel
picked the switch model, by a BIC margin of 2 — a tie, not a win), which is an
argument against any per-villain discrete-archetype channel and for the
continuous shrunk-posterior channel WS-436 shipped. Durable record:
docs/research/player-archetypes-empirical-2026-07-26.md.

THE HYPOTHESIS (founder, 2026-07-26, restated precisely):

    "I was referring to villains being in different stages of their poker
     lifecycle. I would expect that there are categories of things that if a
     player does, they do regularly, and if they don't, they almost never. Might
     not actually be true, but would explain a certain consistency of villain
     behavior observed."

This is a CROSS-SECTIONAL claim about the shape of a behaviour's distribution
across players — not about players changing over time (that was Part 3). If true,
a behaviour like 3-bet bluffing is governed by a latent binary "has this player
acquired it" trait, and the population is BIMODAL or ZERO-INFLATED rather than a
smooth spread.

WHY THE EARLIER CLUSTERING COULD NOT SEE THIS. Parts 1-2 used Euclidean k-means on
continuous rate vectors. That method reports a continuum unless the clusters are
separated in the SAME metric it optimises. A set of binary latent traits — each
player a vector of on/off switches — produces structure k-means on rates is poorly
suited to recover. Testing it needs a mixture model on the COUNTS, which is what
this does.

Crucially the test must run on (k, n) counts, never on the raw rates: a player with
8 opportunities and 0 successes looks like a hard zero but is perfectly consistent
with a 10% true rate. Raw-rate histograms manufacture spurious zero-inflation.

THREE COMPETING MODELS, compared by BIC on the same data:

  M1  single binomial      — one rate for everyone; individual variation is noise
                             (1 parameter)
  M2  beta-binomial        — a CONTINUUM of individual rates
                             (2 parameters)  <- Parts 1-2's implicit model
  M3  2-component binomial — TWO DISCRETE CLASSES, weight w on the low one
                             (3 parameters)  <- the founder's hypothesis

  M3 wins  -> the behaviour is a switch: you do it or you don't
  M2 wins  -> the behaviour is a dial: everyone has a personal rate on a spectrum
  M1 wins  -> no real individual variation to model at all

Also reported: EXCESS ZEROS — observed players with k=0 versus the number a single
binomial predicts. A large excess is the signature of a genuine "never does this"
population, independent of the model comparison.

Usage:
    python scripts/backtest/latent-class-behaviors.py \
        --behavioral out/behavioral-features.json \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --miner-path C:/Users/chris/data/phh-mining \
        --out out/latent-classes.json
"""

import argparse
import json
import os
import re
import sys
from collections import defaultdict

import numpy as np
from scipy.special import betaln, gammaln
from scipy.optimize import minimize

# behaviour -> minimum opportunities for a player to enter the test.
# Low bars are fine here BECAUSE the models work on counts and account for
# sampling noise directly; the earlier clustering needed high bars only because
# it fed raw rates to a distance metric.
CANDIDATES = [
    ("threeBet", 40),          # the founder's own example: "should be 3bet bluffing more"
    ("cbet", 25),
    ("foldToCbet", 25),
    ("double_barrel", 12),
    ("triple_barrel", 6),
    ("check_raise_flop", 10),
    ("donk_flop", 15),
    ("limp_raise", 12),
    ("river_bet_air", 5),
]

PREFLOP_STATS = {"vpip", "pfr", "threeBet", "foldTo3Bet", "cbet", "foldToCbet"}


def log_binom_coef(n, k):
    return gammaln(n + 1) - gammaln(k + 1) - gammaln(n - k + 1)


def ll_single(params, k, n, lc):
    p = np.clip(params[0], 1e-9, 1 - 1e-9)
    return -np.sum(lc + k * np.log(p) + (n - k) * np.log(1 - p))


def ll_betabin(params, k, n, lc):
    a, b = np.exp(params)
    a, b = np.clip(a, 1e-6, 1e6), np.clip(b, 1e-6, 1e6)
    return -np.sum(lc + betaln(k + a, n - k + b) - betaln(a, b))


def ll_mixture(params, k, n, lc):
    w = 1 / (1 + np.exp(-params[0]))
    p1 = 1 / (1 + np.exp(-params[1]))
    p2 = 1 / (1 + np.exp(-params[2]))
    l1 = lc + k * np.log(np.clip(p1, 1e-9, 1)) + (n - k) * np.log(np.clip(1 - p1, 1e-9, 1))
    l2 = lc + k * np.log(np.clip(p2, 1e-9, 1)) + (n - k) * np.log(np.clip(1 - p2, 1e-9, 1))
    m = np.maximum(l1, l2)
    return -np.sum(m + np.log(w * np.exp(l1 - m) + (1 - w) * np.exp(l2 - m)))


def fit(k, n):
    """Fit all three models; return per-model BIC and parameters."""
    lc = log_binom_coef(n, k)
    N = len(k)
    pooled = k.sum() / n.sum()
    out = {}

    r1 = minimize(ll_single, [pooled], args=(k, n, lc), method="Nelder-Mead")
    out["single"] = {"nll": float(r1.fun), "params": 1, "rate": float(np.clip(r1.x[0], 0, 1))}

    # Method-of-moments start keeps the optimiser off flat regions.
    m, v = pooled, max(np.var(k / np.maximum(n, 1)), 1e-6)
    conc = max(m * (1 - m) / v - 1, 0.1)
    r2 = minimize(ll_betabin, [np.log(max(m * conc, 1e-3)), np.log(max((1 - m) * conc, 1e-3))],
                  args=(k, n, lc), method="Nelder-Mead", options={"maxiter": 3000})
    a, b = np.exp(r2.x)
    out["betabin"] = {"nll": float(r2.fun), "params": 2,
                      "mean": float(a / (a + b)), "alpha": float(a), "beta": float(b)}

    best_mix = None
    # Several starts: a two-component likelihood is multimodal and a single start
    # lands in a local optimum often enough to change the verdict.
    for w0, lo, hi in [(0.5, pooled * 0.2, pooled * 2.0),
                       (0.7, 1e-3, pooled * 1.5),
                       (0.3, pooled * 0.5, pooled * 3.0)]:
        lo = float(np.clip(lo, 1e-4, 0.98))
        hi = float(np.clip(hi, 1e-3, 0.99))
        x0 = [np.log(w0 / (1 - w0)), np.log(lo / (1 - lo)), np.log(hi / (1 - hi))]
        r3 = minimize(ll_mixture, x0, args=(k, n, lc), method="Nelder-Mead",
                      options={"maxiter": 5000})
        if best_mix is None or r3.fun < best_mix.fun:
            best_mix = r3
    w = 1 / (1 + np.exp(-best_mix.x[0]))
    p1 = 1 / (1 + np.exp(-best_mix.x[1]))
    p2 = 1 / (1 + np.exp(-best_mix.x[2]))
    if p1 > p2:                      # canonical order: component 1 is the low one
        w, p1, p2 = 1 - w, p2, p1
    out["mixture"] = {"nll": float(best_mix.fun), "params": 3,
                      "weightLow": float(w), "rateLow": float(p1), "rateHigh": float(p2)}

    for name, d in out.items():
        d["bic"] = round(2 * d["nll"] + d["params"] * np.log(N), 1)
    return out


def excess_zeros(k, n, rate):
    observed = int(np.sum(k == 0))
    expected = float(np.sum((1 - rate) ** n))
    return {"observedZeroPlayers": observed,
            "expectedUnderSingleRate": round(expected, 1),
            "excessRatio": round(observed / expected, 2) if expected > 0.5 else None}


def load_preflop(corpus_root, miner_path, workers, stakes):
    sys.path.insert(0, miner_path)
    from phh_miner import mine_file
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

    print("mining %d files for per-player preflop counts..." % len(files), flush=True)
    players = defaultdict(lambda: defaultdict(lambda: [0, 0]))
    with Pool(workers) as pool:
        for res in pool.imap_unordered(mine_file, files, chunksize=4):
            for bucket, agg in res.items():
                if bucket not in ("6max", "full"):
                    continue
                for pid, stats in agg["players"].items():
                    for s, (kk, nn) in stats.items():
                        players[pid][s][0] += kk
                        players[pid][s][1] += nn
    return players


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--behavioral", required=True)
    ap.add_argument("--corpus-root", required=True)
    ap.add_argument("--miner-path", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--stakes", default=None)
    args = ap.parse_args()

    stakes = set(args.stakes.split(",")) if args.stakes else None
    with open(args.behavioral, "r", encoding="utf-8") as f:
        behavioral = json.load(f)["players"]
    preflop = load_preflop(args.corpus_root, args.miner_path, args.workers, stakes)

    results = {}
    for feat, min_n in CANDIDATES:
        src = preflop if feat in PREFLOP_STATS else behavioral
        pairs = []
        for pid, d in src.items():
            kn = d.get(feat)
            if not kn:
                continue
            kk, nn = kn[0], kn[1]
            if nn >= min_n:
                pairs.append((kk, nn))
        if len(pairs) < 200:
            results[feat] = {"players": len(pairs), "skipped": "too few players"}
            print("  %-18s skipped (%d players)" % (feat, len(pairs)))
            continue

        k = np.array([p[0] for p in pairs], dtype=float)
        n = np.array([p[1] for p in pairs], dtype=float)
        models = fit(k, n)
        winner = min(("single", "betabin", "mixture"), key=lambda m: models[m]["bic"])
        pooled = float(k.sum() / n.sum())
        results[feat] = {
            "players": len(pairs), "minOpportunities": min_n,
            "pooledRate": round(pooled, 4),
            "models": models,
            "winner": winner,
            "verdict": {"mixture": "SWITCH (two discrete classes)",
                        "betabin": "DIAL (continuum of personal rates)",
                        "single": "NO individual variation"}[winner],
            "excessZeros": excess_zeros(k, n, pooled),
        }
        mx = models["mixture"]
        print("  %-18s n=%-5d pooled=%.3f  winner=%-8s  mix: %.0f%% at %.3f / %.0f%% at %.3f"
              % (feat, len(pairs), pooled, winner,
                 mx["weightLow"] * 100, mx["rateLow"], (1 - mx["weightLow"]) * 100, mx["rateHigh"]))

    payload = {
        "question": ("Is a behaviour a SWITCH (you do it or you don't) or a DIAL "
                     "(everyone has a personal rate)?"),
        "caveat": ("HandHQ online cash, July 2009 (SRC-011). Models are fitted to (k, n) "
                   "COUNTS so sampling noise is handled explicitly — a player with 8 "
                   "opportunities and 0 successes is not treated as a hard zero. "
                   "river_bet_air is showdown-censored. Live generalisation is an assumption."),
        "models": {"single": "one rate for everyone (1 param)",
                   "betabin": "continuum of personal rates (2 params)",
                   "mixture": "two discrete classes (3 params)"},
        "results": results,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("wrote %s" % args.out)


if __name__ == "__main__":
    main()
