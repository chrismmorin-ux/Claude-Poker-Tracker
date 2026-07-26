"""
mine-stationarity.py — do players change in STEPS, or drift?

THE HYPOTHESIS (founder, 2026-07-26):

    "I am optimistically expecting to see little cliffs where one player sort of
     slides or drops into another bucket, probably based on skill/education level.
     If they have eventually learned something, like that they should be 3bet
     bluffing a lot more... I have to think that we will see a sharp change in
     particular behaviors of opponents, hopefully that I can identify at the table"

WHY IT MATTERS TO SHIPPING CODE, not just to theory. `decisionAccumulator.js`
weights every observation by `DECAY_HALFLIFE = 50` — an exponential decay, weight
halving every 50 hands. That encodes SMOOTH DRIFT: the past fades gradually and
the model glides after it. If players actually change in steps, exponential decay
is the wrong adaptation model — a step needs change-point DETECTION, so the
pre-break data is discarded outright rather than decaying away over the next
hundred hands. Those two behave very differently in exactly the window where a
read is most valuable.

Every clustering study so far used CAREER-AGGREGATE stats. If players change
discretely, those aggregates average across two different players and smear the
very effect being looked for. This script is the check.

BINDING LIMITATION, STATED BEFORE ANY RESULT. The corpus spans 2009-07-01 to
2009-07-23 — TWENTY-THREE DAYS. Learning of the kind the hypothesis describes
happens over months. This data can test whether frequency changes are SHARP or
GRADUAL, and can detect session-to-session mode switching (tilt, table change,
A-game vs C-game). It CANNOT test "the player eventually learned to 3-bet bluff".
Any result here is about sharpness, not about education.

METHOD
  Block each player's hands BY DAY (a natural session-ish unit, 23 of them).
  For a stat with per-day counts (k_i, n_i):

  1. Stationarity test. Under a single fixed rate p, the counts are binomial.
     X2 = sum (k_i - n_i*p)^2 / (n_i*p*(1-p)) ~ chi2(B-1).
     Dispersion = X2/df. 1.0 = exactly as variable as chance allows;
     >1 = the player is genuinely non-stationary.

  2. Shape. For non-stationary players, scan every split point for the two-segment
     binomial MLE and keep the best. Then compare that STEP model against a
     LINEAR-DRIFT model (logistic regression on block index) by BIC. Whichever
     wins tells us whether the change is a cliff or a ramp — which is the whole
     question.

Only stats with enough per-day volume are testable: vpip and pfr have a
denominator on every dealt hand. The rare reads (triple barrel, check-raise) were
already shown to be unmeasurable per player at ANY horizon, so they cannot be
block-tested either.

Usage:
    python scripts/backtest/mine-stationarity.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --out out/stationarity.json --workers 12
"""

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from multiprocessing import Pool

import numpy as np
from scipy import stats

STATS = ["vpip", "pfr"]


def iter_hands(path):
    hand = None
    with open(path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            if line.startswith("["):
                if hand:
                    yield hand
                hand = {}
                continue
            if hand is None:
                continue
            eq = line.find("=")
            if eq == -1:
                continue
            key, val = line[:eq].strip(), line[eq + 1:].strip()
            if key == "actions":
                body = val[val.index("[") + 1:val.rindex("]")]
                hand["actions"] = [t.strip().strip("'\"") for t in body.split(",")] if body.strip() else []
            elif key == "blinds_or_straddles":
                body = val[val.index("[") + 1:val.rindex("]")]
                hand["blinds"] = [float(t) for t in body.split(",")] if body.strip() else []
            elif key == "players":
                body = val[val.index("[") + 1:val.rindex("]")]
                hand["players"] = [t.strip().strip("'\"") for t in body.split(",")]
            elif key == "variant":
                hand["variant"] = val.strip("'\"")
            elif key == "day":
                try:
                    hand["day"] = int(val)
                except ValueError:
                    pass
    if hand:
        yield hand


def mine_hand(hand, acc):
    """Per-player, per-DAY vpip/pfr counts. Semantics mirror phh_miner exactly."""
    if hand.get("variant") != "NT":
        return
    actions, blinds, players = hand.get("actions"), hand.get("blinds"), hand.get("players")
    day = hand.get("day")
    if not actions or not blinds or not players or day is None:
        return
    n = len(players)
    if n < 3:
        return

    committed = list(blinds) + [0.0] * (n - len(blinds))
    committed = committed[:n]
    current_bet = max(blinds) if blinds else 0.0
    street = 0

    acted_pf = [False] * n
    vpip = [False] * n
    pfr = [False] * n

    for tok in actions:
        parts = tok.split()
        if parts[0] == "d":
            if parts[1] == "db":
                street += 1
            continue
        m = re.match(r"^p(\d+)$", parts[0])
        if not m:
            continue
        p = int(m.group(1)) - 1
        if p >= n:
            continue
        verb = parts[1]
        if verb == "sm":
            continue
        if street == 0:
            acted_pf[p] = True
            owed = current_bet - committed[p]
            if verb == "cc" and owed > 1e-9:
                vpip[p] = True
                committed[p] = current_bet
            elif verb == "cbr":
                vpip[p] = True
                pfr[p] = True
                amount = float(parts[2])
                committed[p] = amount
                current_bet = amount
        elif verb == "cbr":
            current_bet = float(parts[2])

    for i in range(n):
        if not acted_pf[i]:
            continue
        d = acc[players[i]][day]
        d["vpip"][1] += 1
        d["pfr"][1] += 1
        if vpip[i]:
            d["vpip"][0] += 1
        if pfr[i]:
            d["pfr"][0] += 1


def new_player():
    return defaultdict(lambda: {"vpip": [0, 0], "pfr": [0, 0]})


def mine_file(path):
    acc = defaultdict(new_player)
    try:
        for hand in iter_hands(path):
            try:
                mine_hand(hand, acc)
            except Exception:
                pass
    except Exception as e:
        sys.stderr.write("file error %s: %s\n" % (path, e))
    return {pid: {d: {s: list(v) for s, v in day.items()} for d, day in days.items()}
            for pid, days in acc.items()}


# ---------------------------------------------------------------- analysis
def analyse_series(ks, ns):
    """Stationarity + step-vs-drift for one player's one stat.

    Returns None when the series is too thin to say anything.
    """
    B = len(ks)
    if B < 4:
        return None
    K, N = float(sum(ks)), float(sum(ns))
    if N <= 0:
        return None
    p = K / N
    if p <= 0 or p >= 1:
        return None

    # 1. Overdispersion vs a single fixed rate.
    var = np.array(ns) * p * (1 - p)
    if np.any(var <= 0):
        return None
    x2 = float(np.sum((np.array(ks) - np.array(ns) * p) ** 2 / var))
    df = B - 1
    dispersion = x2 / df
    pval = float(stats.chi2.sf(x2, df))

    # 2. Best single change-point by two-segment binomial likelihood.
    def loglik(k, n):
        if n == 0:
            return 0.0
        q = k / n
        if q <= 0 or q >= 1:
            return 0.0
        return k * np.log(q) + (n - k) * np.log(1 - q)

    ll1 = loglik(K, N)
    best = None
    for t in range(1, B):
        ka, na = float(sum(ks[:t])), float(sum(ns[:t]))
        kb, nb = float(sum(ks[t:])), float(sum(ns[t:]))
        if na < 20 or nb < 20:
            continue
        ll = loglik(ka, na) + loglik(kb, nb)
        if best is None or ll > best["ll"]:
            best = {"t": t, "ll": ll, "before": ka / na, "after": kb / nb}
    if best is None:
        return None

    # 3. Step vs linear drift, by BIC. Lower is better.
    #    Step: 3 params (p_before, p_after, changepoint). Drift: 2 (intercept, slope).
    idx = np.arange(B, dtype=float)
    w = np.array(ns, dtype=float)
    y = np.array(ks, dtype=float) / np.maximum(w, 1)
    xm = np.average(idx, weights=w)
    ym = np.average(y, weights=w)
    denom = np.sum(w * (idx - xm) ** 2)
    slope = float(np.sum(w * (idx - xm) * (y - ym)) / denom) if denom > 0 else 0.0
    fitted = np.clip(ym + slope * (idx - xm), 1e-6, 1 - 1e-6)
    ll_drift = float(np.sum(np.array(ks) * np.log(fitted)
                            + (np.array(ns) - np.array(ks)) * np.log(1 - fitted)))

    bic_step = -2 * best["ll"] + 3 * np.log(N)
    bic_drift = -2 * ll_drift + 2 * np.log(N)
    bic_flat = -2 * ll1 + 1 * np.log(N)

    shapes = {"step": bic_step, "drift": bic_drift, "flat": bic_flat}
    shape = min(shapes, key=shapes.get)

    return {
        "blocks": B, "n": int(N), "rate": round(p, 4),
        "dispersion": round(dispersion, 3), "pvalue": pval,
        "changepointBlock": best["t"],
        "before": round(best["before"], 4), "after": round(best["after"], 4),
        "delta": round(best["after"] - best["before"], 4),
        "shape": shape,
        "bic": {k: round(v, 1) for k, v in shapes.items()},
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus-root", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--min-day-hands", type=int, default=30, help="hands needed for a day to count as a block")
    ap.add_argument("--min-blocks", type=int, default=5)
    ap.add_argument("--stakes", default=None)
    args = ap.parse_args()

    stakes = set(args.stakes.split(",")) if args.stakes else None
    files = []
    for name in sorted(os.listdir(args.corpus_root)):
        d = os.path.join(args.corpus_root, name)
        if not os.path.isdir(d):
            continue
        m = re.match(r"^([A-Z]+)-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}_(\d+NLH)_OBFU$", name)
        if not m or (stakes and m.group(2) not in stakes):
            continue
        for root, _, names in os.walk(d):
            files.extend(os.path.join(root, f) for f in names if f.endswith(".phhs"))
    if not files:
        sys.exit("no .phhs files found")

    print("mining %d files for per-player per-day series..." % len(files), flush=True)
    t0 = time.time()
    merged = defaultdict(new_player)
    with Pool(args.workers) as pool:
        for i, res in enumerate(pool.imap_unordered(mine_file, files, chunksize=4)):
            for pid, days in res.items():
                tgt = merged[pid]
                for day, st in days.items():
                    for s, v in st.items():
                        tgt[day][s][0] += v[0]
                        tgt[day][s][1] += v[1]
            if (i + 1) % 400 == 0:
                print("  %d/%d files, %d players, %.0fs" % (i + 1, len(files), len(merged), time.time() - t0), flush=True)

    print("\nanalysing %d players..." % len(merged), flush=True)
    results = {s: [] for s in STATS}
    for pid, days in merged.items():
        ordered = sorted(days.items(), key=lambda kv: int(kv[0]))
        for s in STATS:
            ks, ns = [], []
            for _, st in ordered:
                k, n = st[s]
                if n >= args.min_day_hands:
                    ks.append(k)
                    ns.append(n)
            if len(ks) < args.min_blocks:
                continue
            r = analyse_series(ks, ns)
            if r:
                r["player"] = pid
                results[s].append(r)

    summary = {}
    for s in STATS:
        rs = results[s]
        if not rs:
            summary[s] = {"players": 0}
            continue
        disp = np.array([r["dispersion"] for r in rs])
        sig = [r for r in rs if r["pvalue"] < 0.01]
        shapes = defaultdict(int)
        for r in rs:
            shapes[r["shape"]] += 1
        big = [r for r in sig if abs(r["delta"]) >= 0.05]
        summary[s] = {
            "players": len(rs),
            "medianDispersion": round(float(np.median(disp)), 3),
            "meanDispersion": round(float(np.mean(disp)), 3),
            "shareNonStationary_p01": round(len(sig) / len(rs), 4),
            "shapeCounts": dict(shapes),
            "shapeShares": {k: round(v / len(rs), 4) for k, v in shapes.items()},
            "shareWithStep_ge5pp": round(len(big) / len(rs), 4),
            "medianAbsDeltaAmongSignificant": round(
                float(np.median([abs(r["delta"]) for r in sig])), 4) if sig else None,
        }

    payload = {
        "question": "Do players change in STEPS or drift? Is exponential recency decay the right adaptation model?",
        "caveat": ("HandHQ online cash, 2009-07-01..2009-07-23 — a TWENTY-THREE DAY window. "
                   "This tests whether frequency changes are sharp or gradual, and can see "
                   "session-to-session mode switching. It CANNOT test the months-long "
                   "learning arc the hypothesis describes. Live generalisation is an assumption."),
        "method": ("Blocks = calendar days with >= %d hands; >= %d blocks required. "
                   "Dispersion = chi2/df vs a single fixed rate (1.0 = binomial noise only). "
                   "Shape chosen by BIC among flat / linear drift / single step."
                   % (args.min_day_hands, args.min_blocks)),
        "summary": summary,
        "examples": {s: sorted([r for r in results[s] if r["pvalue"] < 0.01],
                               key=lambda r: -abs(r["delta"]))[:15] for s in STATS},
    }

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("wrote %s in %.0fs" % (args.out, time.time() - t0))
    for s in STATS:
        print(" ", s, summary[s])


if __name__ == "__main__":
    main()
