"""
mine-sizing-and-lines.py — is there a single "sophistication" factor behind a player's leaks?

THE HYPOTHESIS (founder, 2026-07-26), and it is the most consequential one raised:

    "I would expect a player to eventually learn to increase their 3bet sizing
     from later position and the blinds... But if a player has not learned this,
     and his sizing isn't adjusted normally, then we probably see a whole host of
     other sizing mistakes that, given the one infers the other is present and we
     can jump the statistical gate because we know how they are correlated by the
     sub-archetype... And some players may be missing whole lines entirely."

If leaks are CORRELATED, the starvation wall stops being fatal. Findings 5, 11 and
14 all landed on the same problem: the most diagnostic behaviours are the rarest,
and one player in 59,700 has enough shown check-raises to read. But if a player who
does not adjust 3-bet sizing (observed hundreds of times) reliably also under-bluffs
the river (observed twice), then the cheap measurement licenses the expensive
inference. That is jumping the statistical gate.

If leaks are INDEPENDENT, no amount of cheap observation helps, and per-villain
modelling stays capped by the rarest behaviour.

WHAT THIS MEASURES

  1. SIZING ADJUSTMENT — the founder's own example. A 3-bet's size is recorded as a
     multiple of the open it faces, split by whether the 3-bettor is in the blinds
     (out of position postflop) or not. `sizing_spread` = blinds ratio − non-blinds
     ratio. Theory says these should differ; a player using one size everywhere has
     not learned the adjustment. Sign is not assumed — the question is whether the
     player DISCRIMINATES at all, so the magnitude is what is scored.

  2. LINE COVERAGE — "some players may be missing whole lines entirely." Counts how
     many of a fixed set of canonical postflop lines a player has ever taken
     (check-raise, donk, check-call-then-lead, double barrel, triple barrel,
     check-raise then barrel, ...). A player who never takes a line either cannot
     or will not.

  3. CORRELATION STRUCTURE — the actual test. Per-player metrics are assembled,
     Spearman-correlated, and a PCA reports whether one dominant factor explains
     the covariance. A large first eigenvalue = a general "sophistication" axis =
     the gate can be jumped.

METHODOLOGICAL NOTE THAT MATTERS FOR READING THE RESULT.
Sampling noise ATTENUATES correlations (classical regression dilution): a noisy
measure of X correlates less with Y than the true X does. Every per-player rate
here is noisy. So observed correlations are a LOWER BOUND on the true ones — a
correlation found despite the noise is real, while a null is genuinely ambiguous
between "no relationship" and "too little data". State findings accordingly.

Usage:
    python scripts/backtest/mine-sizing-and-lines.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --behavioral out/behavioral-features.json \
        --out out/sizing-lines.json --workers 12
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

# Canonical postflop lines. Coverage = how many a player has EVER taken.
LINES = [
    "flop_cbet", "flop_checkraise", "flop_donk", "flop_checkcall",
    "turn_barrel", "turn_checkraise", "turn_probe",
    "river_barrel", "river_checkraise", "river_probe",
]


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
            if key in ("actions", "blinds_or_straddles", "players"):
                body = val[val.index("[") + 1:val.rindex("]")]
                items = [t.strip().strip("'\"") for t in body.split(",")] if body.strip() else []
                if key == "actions":
                    hand["actions"] = items
                elif key == "players":
                    hand["players"] = items
                else:
                    hand["blinds"] = [float(t) for t in items] if items else []
            elif key == "variant":
                hand["variant"] = val.strip("'\"")
    if hand:
        yield hand


def new_player():
    return {
        "tb_blind": [0.0, 0],      # [sum of size ratios, count] 3-betting from a blind
        "tb_other": [0.0, 0],      # ... from any other seat
        "lines": {l: 0 for l in LINES},
    }


def mine_hand(hand, acc):
    if hand.get("variant") != "NT":
        return
    actions, blinds, players = hand.get("actions"), hand.get("blinds"), hand.get("players")
    if not actions or not blinds or not players:
        return
    n = len(players)
    if n < 3:
        return

    # PHH lists players in blind order: index 0 = SB, 1 = BB, last = button.
    is_blind = [i < 2 for i in range(n)]

    committed = list(blinds) + [0.0] * (n - len(blinds))
    committed = committed[:n]
    current_bet = max(blinds) if blinds else 0.0
    street = 0

    pf_raise_count = 0
    open_size = None
    last_pf_raiser = None

    checked = [[False] * n for _ in range(4)]
    bet_made = [[False] * n for _ in range(4)]
    called = [[False] * n for _ in range(4)]
    street_has_bet = [False] * 4

    for tok in actions:
        parts = tok.split()
        if parts[0] == "d":
            if parts[1] == "db":
                street = min(street + 1, 3)
                for i in range(n):
                    committed[i] = 0.0
                current_bet = 0.0
            continue

        m = re.match(r"^p(\d+)$", parts[0])
        if not m:
            continue
        p = int(m.group(1)) - 1
        if p >= n:
            continue
        verb = parts[1]
        if verb in ("sm", "f"):
            continue

        owed = current_bet - committed[p]

        if verb == "cc":
            if owed > 1e-9:
                called[street][p] = True
                committed[p] = current_bet
            else:
                checked[street][p] = True
            continue

        if verb == "cbr":
            amount = float(parts[2])
            if street == 0:
                pf_raise_count += 1
                if pf_raise_count == 1:
                    open_size = amount
                elif pf_raise_count == 2 and open_size and open_size > 0:
                    # A 3-bet. Size recorded as a multiple of the open it faces.
                    ratio = amount / open_size
                    if 1.0 < ratio < 10.0:      # guard against all-in shoves distorting the mean
                        key = "tb_blind" if is_blind[p] else "tb_other"
                        acc[players[p]][key][0] += ratio
                        acc[players[p]][key][1] += 1
                last_pf_raiser = p
            else:
                first_agg = not street_has_bet[street]
                L = acc[players[p]]["lines"]
                if street == 1:
                    if checked[1][p]:
                        L["flop_checkraise"] += 1
                    elif first_agg:
                        L["flop_cbet" if p == last_pf_raiser else "flop_donk"] += 1
                elif street == 2:
                    if checked[2][p]:
                        L["turn_checkraise"] += 1
                    elif first_agg:
                        L["turn_barrel" if p == last_pf_raiser else "turn_probe"] += 1
                elif street == 3:
                    if checked[3][p]:
                        L["river_checkraise"] += 1
                    elif first_agg:
                        L["river_barrel" if p == last_pf_raiser else "river_probe"] += 1
                bet_made[street][p] = True
                street_has_bet[street] = True
            committed[p] = amount
            current_bet = amount
            continue

    for i in range(n):
        if checked[1][i] and called[1][i]:
            acc[players[i]]["lines"]["flop_checkcall"] += 1


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
    return dict(acc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus-root", required=True)
    ap.add_argument("--behavioral", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=12)
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

    print("mining %d files for sizing + line coverage..." % len(files), flush=True)
    t0 = time.time()
    merged = defaultdict(new_player)
    with Pool(args.workers) as pool:
        for i, res in enumerate(pool.imap_unordered(mine_file, files, chunksize=4)):
            for pid, d in res.items():
                t = merged[pid]
                t["tb_blind"][0] += d["tb_blind"][0]
                t["tb_blind"][1] += d["tb_blind"][1]
                t["tb_other"][0] += d["tb_other"][0]
                t["tb_other"][1] += d["tb_other"][1]
                for l in LINES:
                    t["lines"][l] += d["lines"][l]
            if (i + 1) % 500 == 0:
                print("  %d/%d files, %.0fs" % (i + 1, len(files), time.time() - t0), flush=True)

    with open(args.behavioral, "r", encoding="utf-8") as f:
        behavioral = json.load(f)["players"]

    # ---- line coverage
    cover_rows = []
    for pid, d in merged.items():
        total = sum(d["lines"].values())
        if total >= 30:
            cover_rows.append(sum(1 for l in LINES if d["lines"][l] > 0))
    cover = np.array(cover_rows)

    line_freq = {l: 0 for l in LINES}
    eligible = 0
    for pid, d in merged.items():
        if sum(d["lines"].values()) >= 30:
            eligible += 1
            for l in LINES:
                if d["lines"][l] > 0:
                    line_freq[l] += 1

    # ---- assemble per-player metric table for the correlation test
    METRICS = ["sizing_spread", "line_coverage", "double_barrel", "donk_flop",
               "wtsd", "fold_small", "postflop_af"]
    rows, ids = [], []
    for pid, d in merged.items():
        nb, no = d["tb_blind"][1], d["tb_other"][1]
        if nb < 8 or no < 8:
            continue
        spread = abs(d["tb_blind"][0] / nb - d["tb_other"][0] / no)
        b = behavioral.get(pid)
        if not b:
            continue
        db_k, db_n = b.get("double_barrel", [0, 0])
        dk_k, dk_n = b.get("donk_flop", [0, 0])
        w_k, w_n = b.get("wtsd", [0, 0])
        fs_k, fs_n = b.get("fold_small", [0, 0])
        agg, call = b.get("pf_bets_raises", [0, 0])
        if db_n < 8 or dk_n < 10 or w_n < 25 or fs_n < 12 or call < 12:
            continue
        rows.append([spread, sum(1 for l in LINES if d["lines"][l] > 0),
                     db_k / db_n, dk_k / dk_n, w_k / w_n, fs_k / fs_n,
                     min(agg / call, 5.0)])
        ids.append(pid)

    payload = {
        "question": ("Are a player's leaks CORRELATED — is there one 'sophistication' factor? "
                     "If so, a cheap measurement licenses an expensive inference."),
        "caveat": ("HandHQ online cash, July 2009 (SRC-011). Per-player rates are NOISY, and "
                   "sampling noise ATTENUATES correlation (regression dilution). Observed "
                   "correlations are a LOWER BOUND on true ones: a correlation found here is "
                   "real, a null is ambiguous between 'no relationship' and 'too little data'."),
        "lineCoverage": {
            "playersWith30plusPostflopActions": eligible,
            "linesTracked": len(LINES),
            "meanLinesUsed": round(float(cover.mean()), 2) if len(cover) else None,
            "medianLinesUsed": int(np.median(cover)) if len(cover) else None,
            "distribution": {str(i): int((cover == i).sum()) for i in range(len(LINES) + 1)} if len(cover) else {},
            "shareOfPlayersUsingEachLine": {
                l: round(line_freq[l] / eligible, 4) for l in LINES} if eligible else {},
        },
    }

    if len(ids) >= 100:
        X = np.array(rows, dtype=float)
        rho, pv = stats.spearmanr(X)
        Z = (X - X.mean(axis=0)) / np.where(X.std(axis=0) == 0, 1, X.std(axis=0))
        eig = np.linalg.eigvalsh(np.corrcoef(Z, rowvar=False))[::-1]
        payload["correlation"] = {
            "players": len(ids),
            "metrics": METRICS,
            "spearman": [[round(float(rho[i][j]), 3) for j in range(len(METRICS))]
                         for i in range(len(METRICS))],
            "pvalues": [[float(pv[i][j]) for j in range(len(METRICS))] for i in range(len(METRICS))],
            "pcaEigenvalues": [round(float(e), 3) for e in eig],
            "firstFactorShare": round(float(eig[0] / eig.sum()), 4),
        }
        print("\nCORRELATION TEST  (%d players)" % len(ids))
        print("%-16s %s" % ("", "  ".join("%7s" % m[:7] for m in METRICS)))
        for i, m in enumerate(METRICS):
            print("%-16s %s" % (m[:16], "  ".join("%7.3f" % rho[i][j] for j in range(len(METRICS)))))
        print("\nPCA eigenvalues:", [round(float(e), 2) for e in eig])
        print("first factor explains %.1f%% of covariance" % (eig[0] / eig.sum() * 100))
    else:
        payload["correlation"] = {"players": len(ids), "skipped": "too few players"}
        print("\ncorrelation test skipped — only %d players cleared every minimum" % len(ids))

    print("\nLINE COVERAGE  (players with >=30 postflop actions: %d)" % eligible)
    if eligible:
        print("  mean lines used: %.2f of %d" % (cover.mean(), len(LINES)))
        for l in LINES:
            print("    %-18s %5.1f%% of players ever use it" % (l, line_freq[l] / eligible * 100))

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("\nwrote %s in %.0fs" % (args.out, time.time() - t0))


if __name__ == "__main__":
    main()
