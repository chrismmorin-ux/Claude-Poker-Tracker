"""
mine-sizing-distributions.py — what sizes does the pool actually use, per street and line?

THE QUESTION (founder, 2026-07-31):

    "Did we pull the default actions and common sizes from the MDA and make it specific
     to street? Common cbets are different than common check raises or turn probes or
     river thin value/bluff and stabs (aggressive action from callers to the preflop
     raise that isn't a donk)."

The answer was no. `potCalculator.js:456-459` hardcodes four arrays with no derivation,
and `CommandStrip.jsx:509-515` collapses ALL postflop betting into one context — a flop
c-bet, a turn probe and a river bluff get the same 1/4, 1/2, 3/4, pot buttons.

WHY A SEPARATE SCRIPT. `mine-sizing-and-lines.py` already classifies every postflop
aggressive action into the exact taxonomy needed (flop_cbet / flop_donk / turn_probe /
...), but it is answering a different question — whether leaks CORRELATE within a
player — so it counts line COVERAGE per player and discards the size. Rather than
overload that study, this script reuses its classification logic and accumulates
POOL-LEVEL size distributions instead.

WHAT IT ADDS OVER THAT SCRIPT. One thing: a running pot. The original zeroes
`committed[]` at every street boundary and throws those chips away, because coverage
counting never needed a pot. Carrying it forward is what makes a bet expressible as a
fraction of the pot.

WHY THIS IS THE CLEANEST QUESTION THE CORPUS CAN ANSWER. Sizing is the least-censored
quantity in the dataset. Hand strength is censored brutally — folds are never shown,
successful bluffs are never shown — which is why the standing doctrine reads corpus
findings as shape and bound, not level. Sizing is the exception: every bet's size is
recorded whether or not the hand reached showdown, so the level is directly observed.

THE CAVEAT THAT LIMITS THE OUTPUT. This corpus is ONLINE play. The founder plays LIVE
$1/$3 nine-handed, and live pools size differently (notably larger preflop opens). Read
the output as a PRIOR whose SHAPE is trustworthy and whose LEVEL may be displaced. It is
not a drop-in default set for a live game.

ONE CATEGORY IT CANNOT DELIVER. River thin-value vs bluff cannot be separated here.
Sizes are fully observed; the value-vs-bluff INTENT label needs a showdown. This script
reports the river bet-size distribution unconditionally and makes no intent claim.

Usage:
    python scripts/backtest/mine-sizing-distributions.py \\
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \\
        --out out/sizing-distributions.json --workers 12

    # smoke test against the checked-in fixture:
    python scripts/backtest/mine-sizing-distributions.py \\
        --files scripts/backtest/fixtures/sample-hands.phhs --out out/sizing-smoke.json
"""

import argparse
import json
import math
import os
import re
import sys
import time
from collections import defaultdict
from multiprocessing import Pool

# ---------------------------------------------------------------------------
# Cells. Postflop first-aggression and check-raises, split by street and role.
# "probe" is the founder's "stab": non-PFA first aggression on turn or river.
# There is deliberately no flop stab — on the flop a non-PFA first bet IS a donk,
# because a stab requires the preflop aggressor to have already declined.
# ---------------------------------------------------------------------------
POT_FRACTION_CELLS = [
    "flop_cbet", "flop_donk",
    "turn_barrel", "turn_probe",
    "river_barrel", "river_probe",
]
RAISE_MULTIPLE_CELLS = [
    "flop_checkraise", "turn_checkraise", "river_checkraise",
]
PREFLOP_CELLS = ["pf_open_bb", "pf_3bet_x", "pf_4bet_x"]

ALL_CELLS = POT_FRACTION_CELLS + RAISE_MULTIPLE_CELLS + PREFLOP_CELLS

# Histograms rather than raw samples: 21.6M hands would not fit in memory, and a
# fine-binned histogram gives quantiles to well within the precision anyone can act on.
FRAC_BINS, FRAC_MAX = 300, 3.0     # pot fractions 0..3.0 in 0.01 steps
MULT_BINS, MULT_MAX = 300, 15.0    # raise multiples 0..15x in 0.05 steps


def _bins_for(cell):
    return (FRAC_BINS, FRAC_MAX) if cell in POT_FRACTION_CELLS else (MULT_BINS, MULT_MAX)


def new_acc():
    # per cell: [histogram, n, sum, overflow_count]  — overflow tracked, never dropped silently
    return {c: [[0] * _bins_for(c)[0], 0, 0.0, 0] for c in ALL_CELLS}


def record(acc, cell, value, split=None):
    if value is None or value <= 0 or not math.isfinite(value):
        return
    nbins, vmax = _bins_for(cell)
    for key in ([cell] + ([cell + "|" + split] if split else [])):
        if key not in acc:
            acc[key] = [[0] * nbins, 0, 0.0, 0]
        h = acc[key]
        idx = int(value / vmax * nbins)
        if idx >= nbins:
            h[3] += 1          # overflow: counted, reported, not binned
        else:
            h[0][idx] += 1
        h[1] += 1
        h[2] += value


def iter_hands(path):
    """PHH-style records. Mirrors mine-sizing-and-lines.py's reader."""
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
                try:
                    body = val[val.index("[") + 1:val.rindex("]")]
                except ValueError:
                    continue
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


def mine_hand(hand, acc):
    if hand.get("variant") != "NT":
        return
    actions, blinds, players = hand.get("actions"), hand.get("blinds"), hand.get("players")
    if not actions or not blinds or not players:
        return
    n = len(players)
    if n < 2:
        return

    bb = max(blinds)
    if bb <= 0:
        return

    committed = list(blinds) + [0.0] * (n - len(blinds))
    committed = committed[:n]
    current_bet = max(blinds)
    pot_prior = 0.0                 # <-- the addition: chips from COMPLETED streets
    street = 0

    pf_raise_count = 0
    open_size = None
    threebet_size = None
    last_pf_raiser = None

    folded = [False] * n
    checked = [[False] * 4 for _ in range(1)] * 0 or [[False] * n for _ in range(4)]
    street_has_bet = [False] * 4

    for tok in actions:
        parts = tok.split()
        if not parts:
            continue

        if parts[0] == "d":
            if len(parts) > 1 and parts[1] == "db":
                pot_prior += sum(committed)      # carry the street's chips into the pot
                street = min(street + 1, 3)
                committed = [0.0] * n
                current_bet = 0.0
            continue

        m = re.match(r"^p(\d+)$", parts[0])
        if not m:
            continue
        p = int(m.group(1)) - 1
        if p >= n:
            continue
        verb = parts[1]

        if verb == "f":
            folded[p] = True
            continue
        if verb == "sm":
            continue

        if verb == "cc":
            owed = current_bet - committed[p]
            if owed > 1e-9:
                committed[p] = current_bet
            else:
                checked[street][p] = True
            continue

        if verb != "cbr":
            continue

        try:
            amount = float(parts[2])
        except (IndexError, ValueError):
            continue

        if street == 0:
            pf_raise_count += 1
            if pf_raise_count == 1:
                open_size = amount
                record(acc, "pf_open_bb", amount / bb)
            elif pf_raise_count == 2 and open_size and open_size > 0:
                threebet_size = amount
                record(acc, "pf_3bet_x", amount / open_size)
            elif pf_raise_count == 3 and threebet_size and threebet_size > 0:
                record(acc, "pf_4bet_x", amount / threebet_size)
            last_pf_raiser = p
        else:
            pot_before = pot_prior + sum(committed)
            live = sum(1 for i in range(n) if not folded[i])
            split = "hu" if live <= 2 else "multi"

            if checked[street][p]:
                # check-raise: the poker-native unit is a multiple of the bet faced
                if current_bet > 1e-9:
                    cell = ["", "flop_checkraise", "turn_checkraise", "river_checkraise"][street]
                    record(acc, cell, amount / current_bet, split)
            elif not street_has_bet[street]:
                # first aggression on this street
                if pot_before > 1e-9:
                    is_pfa = (p == last_pf_raiser)
                    if street == 1:
                        cell = "flop_cbet" if is_pfa else "flop_donk"
                    elif street == 2:
                        cell = "turn_barrel" if is_pfa else "turn_probe"
                    else:
                        cell = "river_barrel" if is_pfa else "river_probe"
                    record(acc, cell, amount / pot_before, split)

            street_has_bet[street] = True

        committed[p] = amount
        current_bet = amount


def merge(dst, src):
    for k, v in src.items():
        if k not in dst:
            nbins = len(v[0])
            dst[k] = [[0] * nbins, 0, 0.0, 0]
        d = dst[k]
        for i, c in enumerate(v[0]):
            if c:
                d[0][i] += c
        d[1] += v[1]
        d[2] += v[2]
        d[3] += v[3]


def mine_file(path):
    acc = new_acc()
    try:
        for hand in iter_hands(path):
            try:
                mine_hand(hand, acc)
            except Exception:
                pass
    except Exception as e:
        sys.stderr.write("file error %s: %s\n" % (path, e))
    return acc


def summarize(cell, entry):
    hist, n, total, overflow = entry
    if n == 0:
        return None
    nbins, vmax = _bins_for(cell.split("|")[0])
    width = vmax / nbins

    def q(p):
        target, run = p * (n - overflow), 0
        for i, c in enumerate(hist):
            run += c
            if run >= target:
                return round((i + 0.5) * width, 3)
        return round(vmax, 3)

    modal_i = max(range(nbins), key=lambda i: hist[i]) if any(hist) else 0
    return {
        "n": n,
        "mean": round(total / n, 3),
        "p10": q(0.10), "p25": q(0.25), "p50": q(0.50), "p75": q(0.75), "p90": q(0.90),
        "mode_bucket": [round(modal_i * width, 3), round((modal_i + 1) * width, 3)],
        "overflow_n": overflow,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus-root")
    ap.add_argument("--files", nargs="*", help="explicit .phhs paths (smoke testing)")
    ap.add_argument("--out", required=True)
    ap.add_argument("--workers", type=int, default=8)
    ap.add_argument("--stakes", default=None)
    args = ap.parse_args()

    files = list(args.files or [])
    if args.corpus_root:
        stakes = set(args.stakes.split(",")) if args.stakes else None
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
        sys.exit("no .phhs files found (pass --corpus-root or --files)")

    print("mining %d file(s) for sizing distributions..." % len(files), flush=True)
    t0 = time.time()
    merged = new_acc()
    if len(files) == 1 or args.workers <= 1:
        merge(merged, mine_file(files[0]) if len(files) == 1 else new_acc())
        for f in files[1:]:
            merge(merged, mine_file(f))
    else:
        with Pool(args.workers) as pool:
            for i, res in enumerate(pool.imap_unordered(mine_file, files, chunksize=4)):
                merge(merged, res)
                if (i + 1) % 500 == 0:
                    print("  %d/%d files, %.0fs" % (i + 1, len(files), time.time() - t0), flush=True)

    summary = {}
    for cell, entry in sorted(merged.items()):
        s = summarize(cell, entry)
        if s:
            summary[cell] = s

    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({
            "generated_by": "mine-sizing-distributions.py",
            "files": len(files),
            "caveat_online_vs_live": (
                "Corpus is online play. Read as a prior whose SHAPE is trustworthy and "
                "whose LEVEL may be displaced for a live game."
            ),
            "caveat_river_intent": (
                "River bet SIZES are uncensored; the value-vs-bluff INTENT split is not "
                "derivable here (needs showdown). No intent claim is made."
            ),
            "cells": summary,
        }, f, indent=2)

    # ---- human-readable ----------------------------------------------------
    def row(cell):
        s = summary.get(cell)
        if not s:
            return "%-20s %10s" % (cell, "no data")
        return "%-20s n=%-9d p25=%-7.2f p50=%-7.2f p75=%-7.2f mode=%.2f-%.2f" % (
            cell, s["n"], s["p25"], s["p50"], s["p75"], s["mode_bucket"][0], s["mode_bucket"][1])

    print("\n=== POT FRACTION (first aggression) ===")
    for c in POT_FRACTION_CELLS:
        print("  " + row(c))
        for sp in ("hu", "multi"):
            if c + "|" + sp in summary:
                print("    " + row(c + "|" + sp))
    print("\n=== RAISE MULTIPLE (check-raise, x the bet faced) ===")
    for c in RAISE_MULTIPLE_CELLS:
        print("  " + row(c))
    print("\n=== PREFLOP ===")
    for c in PREFLOP_CELLS:
        print("  " + row(c))
    print("\nwrote %s  (%.0fs)" % (args.out, time.time() - t0))
    print("\nREAD AS PRIOR, NOT DEFAULTS: online corpus, live game. Shape trustworthy, level may be displaced.")


if __name__ == "__main__":
    main()
