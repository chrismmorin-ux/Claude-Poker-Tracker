"""
mine-rare-act-inference.py — what does ONE rare act tell you about everything else?

THREE FOUNDER QUESTIONS, 2026-07-26:

  1. "did we look at if this is same folks who are check raising the turn are the
      same ones daring enough to check raise the river?"
     -> NESTING. Are lines acquired in an order (a Guttman scale), so that using a
        harder line implies the easier ones?

  2. "you again are missing BLUFFS. Each of these varies by value or bluff.
      86% never check raised the river. So how much of those were bluffs?"
     -> Correct again. Part 7's line coverage counted ACTIONS. A river check-raise
        for value and a river check-raise as a bluff are different skills.

  3. "Those players, who get caught in a rare act, what does that one act say is
      statistically likely about them across the board? how confident can we
      classify their archetype and immediately adjust in seemingly unrelated way
      on different board textures streets and positions"
     -> THE GATE-JUMPING TEST, and this is the RIGHT form of it.

WHY THIS SUPERSEDES PART 7's CORRELATION TEST. That test correlated continuous
rates across players clearing EVERY minimum simultaneously — 564 of 59,700, almost
all high-volume regulars. Range restriction that severe could manufacture a null on
its own, which is why Finding 16 was logged "not supported" rather than refuted.

This asks the question the other way round, and the asymmetry is what rescues it:
"did this player EVER do X" is observable for anyone with any sample at all, and Y
is measured on whoever has Y data. No intersection requirement, no restriction to
regs. The population is the whole corpus.

    lift(Y | X) = E[Y | player did X at least once] / E[Y | player never did X]

A lift far from 1.0 means one rare observation genuinely relocates the player's
whole distribution — which is exactly the claim, and exactly what would let a
single caught act drive adjustments on unrelated streets and textures.

CENSORING, unchanged and binding: bluff/value splits need shown cards, and a bluff
that works is never shown. Splits below are CAUGHT-bluff shares.

Usage:
    python scripts/backtest/mine-rare-act-inference.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --behavioral out/behavioral-features.json \
        --out out/rare-act-inference.json --workers 12
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

RANK_VAL = {r: i for i, r in enumerate("23456789TJQKA", 2)}

# Lines tracked, roughly ordered by the boldness the founder implied.
LINES = ["flop_checkraise", "turn_checkraise", "river_checkraise",
         "turn_barrel", "river_barrel", "flop_donk", "turn_probe", "river_probe"]


def parse_cards(s):
    out = []
    for i in range(0, len(s) - 1, 2):
        r, su = s[i], s[i + 1]
        if r in RANK_VAL:
            out.append((RANK_VAL[r], su))
    return out


def is_air(hole, board):
    """True when the holding has no pair and no draw against this board."""
    cards = hole + board
    ranks = [c[0] for c in cards]
    suits = defaultdict(int)
    for _, s in cards:
        suits[s] += 1
    counts = defaultdict(int)
    for r in ranks:
        counts[r] += 1
    if max(counts.values()) >= 2:
        return False
    if max(suits.values()) >= 4:
        return False
    u = sorted(set(ranks))
    probe = [1] + u if 14 in u else u
    for i in range(len(probe)):
        if len([r for r in probe if probe[i] <= r <= probe[i] + 4]) >= 4:
            return False
    return True


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
    d = {l: 0 for l in LINES}
    for l in LINES:
        d[l + "__shown"] = 0
        d[l + "__air"] = 0
    d["postflop_actions"] = 0
    return d


def mine_hand(hand, acc):
    if hand.get("variant") != "NT":
        return
    actions, blinds, players = hand.get("actions"), hand.get("blinds"), hand.get("players")
    if not actions or not blinds or not players:
        return
    n = len(players)
    if n < 3:
        return

    committed = list(blinds) + [0.0] * (n - len(blinds))
    committed = committed[:n]
    current_bet = max(blinds) if blinds else 0.0
    street = 0
    board = []
    last_pf_raiser = None
    checked = [[False] * n for _ in range(4)]
    street_has_bet = [False] * 4
    shown = {}
    events = []

    for tok in actions:
        parts = tok.split()
        if parts[0] == "d":
            if parts[1] == "db":
                board.extend(parse_cards(parts[2]))
                street = {3: 1, 4: 2, 5: 3}.get(len(board), street)
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
        if verb == "sm":
            if len(parts) > 2 and "?" not in parts[2]:
                shown[p] = parse_cards(parts[2])
            continue
        if verb == "f":
            continue
        owed = current_bet - committed[p]
        if verb == "cc":
            if owed > 1e-9:
                committed[p] = current_bet
            elif street >= 1:
                checked[street][p] = True
            if street >= 1:
                acc[players[p]]["postflop_actions"] += 1
            continue
        if verb == "cbr":
            amount = float(parts[2])
            if street == 0:
                last_pf_raiser = p
            else:
                acc[players[p]]["postflop_actions"] += 1
                first_agg = not street_has_bet[street]
                name = None
                if checked[street][p]:
                    name = {1: "flop_checkraise", 2: "turn_checkraise", 3: "river_checkraise"}[street]
                elif first_agg:
                    if street == 1:
                        name = "flop_donk" if p != last_pf_raiser else None
                    elif street == 2:
                        name = "turn_barrel" if p == last_pf_raiser else "turn_probe"
                    elif street == 3:
                        name = "river_barrel" if p == last_pf_raiser else "river_probe"
                if name:
                    acc[players[p]][name] += 1
                    events.append((p, name, list(board)))
                street_has_bet[street] = True
            committed[p] = amount
            current_bet = amount
            continue

    for p, name, snap in events:
        hole = shown.get(p)
        if hole and len(hole) == 2 and len(snap) >= 3:
            acc[players[p]][name + "__shown"] += 1
            if is_air(hole, snap):
                acc[players[p]][name + "__air"] += 1


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
    ap.add_argument("--min-postflop", type=int, default=30)
    args = ap.parse_args()

    files = []
    for name in sorted(os.listdir(args.corpus_root)):
        d = os.path.join(args.corpus_root, name)
        if not os.path.isdir(d):
            continue
        if not re.match(r"^([A-Z]+)-\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}_(\d+NLH)_OBFU$", name):
            continue
        for root, _, names in os.walk(d):
            files.extend(os.path.join(root, f) for f in names if f.endswith(".phhs"))

    print("mining %d files..." % len(files), flush=True)
    t0 = time.time()
    merged = defaultdict(new_player)
    with Pool(args.workers) as pool:
        for i, res in enumerate(pool.imap_unordered(mine_file, files, chunksize=4)):
            for pid, d in res.items():
                t = merged[pid]
                for k, v in d.items():
                    t[k] += v
            if (i + 1) % 600 == 0:
                print("  %d/%d files, %.0fs" % (i + 1, len(files), time.time() - t0), flush=True)

    elig = {pid: d for pid, d in merged.items() if d["postflop_actions"] >= args.min_postflop}
    print("\n%d players with >=%d postflop actions" % (len(elig), args.min_postflop))

    # ---- Q1: nesting
    print("\nQ1  NESTING — P(row line | player also uses column line)")
    ever = {l: {pid for pid, d in elig.items() if d[l] > 0} for l in LINES}
    base = {l: len(ever[l]) / len(elig) for l in LINES}
    nesting = {}
    order = ["flop_checkraise", "turn_checkraise", "river_checkraise"]
    for a in order:
        nesting[a] = {}
        for b in order:
            if a == b:
                continue
            inter = len(ever[a] & ever[b])
            nesting[a][b] = round(inter / len(ever[b]), 4) if ever[b] else None
        nesting[a]["base"] = round(base[a], 4)
    for a in order:
        print("  P(%-18s | ...) base=%.3f  %s" % (
            a, base[a],
            "  ".join("%s=%.3f" % (b[:14], nesting[a][b]) for b in order if b != a)))

    # ---- Q2: bluff share per line
    print("\nQ2  BLUFF SHARE per line (caught bluffs — a bluff that works is never shown)")
    bluff = {}
    for l in LINES:
        shown = sum(d[l + "__shown"] for d in merged.values())
        air = sum(d[l + "__air"] for d in merged.values())
        bluff[l] = {"shown": shown, "air": air,
                    "airShare": round(air / shown, 4) if shown >= 50 else None}
        print("  %-18s shown=%-7d air=%-6d share=%s" % (
            l, shown, air, ("%.1f%%" % (air / shown * 100)) if shown >= 50 else "n/a"))

    # ---- Q3: what one rare act licenses
    with open(args.behavioral, "r", encoding="utf-8") as f:
        behavioral = json.load(f)["players"]

    def rate(pid, feat, min_n):
        b = behavioral.get(pid)
        if not b:
            return None
        k, n = b.get(feat, [0, 0])
        return k / n if n >= min_n else None

    TARGETS = [("double_barrel", 8), ("donk_flop", 10), ("wtsd", 25),
               ("fold_small", 12), ("river_bet_air", 4), ("limp_raise", 10)]
    MARKERS = ["river_checkraise", "turn_checkraise", "flop_checkraise"]

    print("\nQ3  LIFT — E[Y | ever did X] / E[Y | never did X]   (whole population, no intersection filter)")
    lifts = {}
    for marker in MARKERS:
        lifts[marker] = {}
        did = ever[marker]
        print("\n  marker: %s  (%d of %d players, %.1f%%)" % (
            marker, len(did), len(elig), base[marker] * 100))
        for feat, min_n in TARGETS:
            a = [v for pid in did if (v := rate(pid, feat, min_n)) is not None]
            b = [v for pid in elig if pid not in did and (v := rate(pid, feat, min_n)) is not None]
            if len(a) < 30 or len(b) < 30:
                lifts[marker][feat] = {"skipped": "thin", "nDid": len(a), "nNot": len(b)}
                continue
            ma, mb = float(np.mean(a)), float(np.mean(b))
            u, p = stats.mannwhitneyu(a, b, alternative="two-sided")
            lifts[marker][feat] = {
                "nDid": len(a), "nNot": len(b),
                "meanDid": round(ma, 4), "meanNot": round(mb, 4),
                "lift": round(ma / mb, 3) if mb > 0 else None,
                "pvalue": float(p),
            }
            flag = "***" if p < 1e-4 else ("**" if p < 0.01 else ("*" if p < 0.05 else "   "))
            print("    %-16s did=%.4f (n=%-5d)  never=%.4f (n=%-5d)  lift=%.2fx  p=%.2e %s" % (
                feat, ma, len(a), mb, len(b), ma / mb if mb > 0 else float("nan"), p, flag))

    payload = {
        "questions": {
            "q1": "Are lines nested — do turn check-raisers also check-raise rivers?",
            "q2": "How much of each line is a BLUFF, not value?",
            "q3": "What does ONE rare act license about the rest of a player's game?",
        },
        "caveat": ("HandHQ online cash, July 2009 (SRC-011). Bluff shares are CAUGHT bluffs — "
                   "a bluff that works is never shown, so true bluffing is higher. Q3 uses the "
                   "whole eligible population with no intersection filter, which is what "
                   "Part 7's correlation test could not do."),
        "eligiblePlayers": len(elig),
        "baseRates": {l: round(base[l], 4) for l in LINES},
        "nesting": nesting,
        "bluffShare": bluff,
        "lift": lifts,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("\nwrote %s in %.0fs" % (args.out, time.time() - t0))


if __name__ == "__main__":
    main()
