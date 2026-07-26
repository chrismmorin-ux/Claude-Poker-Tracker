"""
mine-intent-splits.py — separate a bet's INTENT from the bet.

THE DEFECT THIS FIXES (founder, 2026-07-26):

    "Triple barrel bluff and triple barrel are not the same, of course a value
     player can intuitively triple barrel a good hand. And I bet there are a lot
     of these small distinctions."

Seven of the ten features in the earlier behavioural pass measured an ACTION and
were read as an INTENT. `triple_barrel` counted every player who bet a good hand
three times. Same error class as WS-278 (protection vs value vs bluff): a bet's
motivation is not recoverable from the bet alone.

Intent is recoverable only where the player SHOWS. So every number here is a
conditional, and the conditioning is not benign — see the censoring note below.

CLASSIFY AT THE MOMENT OF THE ACTION, NOT AT THE END OF THE HAND.
A player who c-bets the flop with a flush draw and rivers the flush shows a
made hand. Scoring that flop c-bet as "value" would be exactly backwards. So each
aggressive action is classified against the board AS IT STOOD on that street:
flop actions vs 3 cards, turn vs 4, river vs 5.

FOUR CLASSES, deliberately not collapsed to bluff/value:
    air     no pair, no draw            — a bluff
    draw    4-flush or open-ender       — a SEMI-bluff, a different animal
    pair    one pair                    — thin value OR protection: WS-278's
                                          ambiguity, left visible rather than
                                          forced into a bucket
    strong  two pair or better          — value

Collapsing `pair` into value would re-commit the WS-278 error at the measurement
layer, so the split is reported in full and the reader decides.

CENSORING — BINDING, AND IT BITES HARDER THAN USUAL.
**A bluff that works is never shown.** The opponent folds and the hand is mucked,
so these rates measure CAUGHT bluffs. A player who bluffs often and successfully
appears here as a player who rarely bluffs. Therefore:
  - every field is "…given the player was called and showed", never "bluff frequency"
  - LEVEL comparisons across players are unsafe (different call rates → different
    censoring); rank comparisons are plausibly safer but are unverified
  - the pool-level split is the trustworthy output; per-player splits will be thin

Usage:
    python scripts/backtest/mine-intent-splits.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --out out/intent-splits.json --workers 12
"""

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from multiprocessing import Pool

RANK_VAL = {r: i for i, r in enumerate("23456789TJQKA", 2)}

ACTIONS = ["cbet_flop", "barrel_turn", "barrel_river", "checkraise_flop", "donk_flop"]
CLASSES = ["air", "draw", "pair", "strong"]


def parse_cards(s):
    out = []
    for i in range(0, len(s) - 1, 2):
        r, su = s[i], s[i + 1]
        if r in RANK_VAL:
            out.append((RANK_VAL[r], su))
    return out


def classify(hole, board):
    """air | draw | pair | strong, evaluated against the board AS GIVEN.

    Draw detection runs only when the board is incomplete — there is no such
    thing as a draw on the river, so a river 'draw' is simply air.
    """
    cards = hole + board
    ranks = [c[0] for c in cards]
    suits = defaultdict(int)
    for _, s in cards:
        suits[s] += 1
    counts = defaultdict(int)
    for r in ranks:
        counts[r] += 1
    mult = sorted(counts.values(), reverse=True)

    if mult[0] >= 3 or (mult[0] == 2 and len(mult) > 1 and mult[1] >= 2):
        return "strong"
    if max(suits.values()) >= 5:
        return "strong"
    uniq = sorted(set(ranks))
    probe = [1] + uniq if 14 in uniq else uniq
    run = 1
    for a, b in zip(probe, probe[1:]):
        run = run + 1 if b == a + 1 else 1
        if run >= 5:
            return "strong"

    if len(board) < 5:
        if max(suits.values()) == 4:
            return "draw"
        # Open-ended / double-gutter proxy: four ranks inside a five-wide window.
        u = sorted(set(ranks))
        for i in range(len(u)):
            window = [r for r in u if u[i] <= r <= u[i] + 4]
            if len(window) >= 4:
                return "draw"

    if mult[0] == 2:
        return "pair"
    return "air"


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
    return {a: {c: 0 for c in CLASSES} for a in ACTIONS}


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
    flop_checked = [False] * n
    shown = {}
    # (player, action_name, board_snapshot) recorded AT THE TIME OF THE ACTION
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

        if verb == "cc":
            owed = current_bet - committed[p]
            if owed > 1e-9:
                committed[p] = current_bet
            elif street == 1:
                flop_checked[p] = True
            continue

        if verb == "cbr":
            amount = float(parts[2])
            if street == 0:
                last_pf_raiser = p
            else:
                snap = list(board)
                if street == 1:
                    if flop_checked[p]:
                        events.append((p, "checkraise_flop", snap))
                    elif current_bet <= 1e-9:
                        if p == last_pf_raiser:
                            events.append((p, "cbet_flop", snap))
                        else:
                            events.append((p, "donk_flop", snap))
                elif street == 2 and current_bet <= 1e-9:
                    events.append((p, "barrel_turn", snap))
                elif street == 3 and current_bet <= 1e-9:
                    events.append((p, "barrel_river", snap))
            committed[p] = amount
            current_bet = amount
            continue

    for p, action, snap in events:
        hole = shown.get(p)
        if not hole or len(hole) != 2 or len(snap) < 3:
            continue                      # unshown -> intent unknowable, not counted
        acc[players[p]][action][classify(hole, snap)] += 1


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
    return {pid: d for pid, d in acc.items()}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus-root", required=True)
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

    print("mining %d files for intent splits..." % len(files), flush=True)
    t0 = time.time()
    merged = defaultdict(new_player)
    with Pool(args.workers) as pool:
        for i, res in enumerate(pool.imap_unordered(mine_file, files, chunksize=4)):
            for pid, d in res.items():
                tgt = merged[pid]
                for a in ACTIONS:
                    for c in CLASSES:
                        tgt[a][c] += d[a][c]
            if (i + 1) % 400 == 0:
                print("  %d/%d files, %.0fs" % (i + 1, len(files), time.time() - t0), flush=True)

    pool_totals = {a: {c: 0 for c in CLASSES} for a in ACTIONS}
    for d in merged.values():
        for a in ACTIONS:
            for c in CLASSES:
                pool_totals[a][c] += d[a][c]

    print("\nPOOL-LEVEL INTENT SPLIT (given called and shown)")
    print("%-18s %8s %8s %8s %8s %8s" % ("action", "n", "air", "draw", "pair", "strong"))
    summary = {}
    for a in ACTIONS:
        tot = sum(pool_totals[a].values())
        if tot == 0:
            continue
        shares = {c: pool_totals[a][c] / tot for c in CLASSES}
        summary[a] = {"n": tot, "counts": pool_totals[a],
                      "shares": {c: round(shares[c], 4) for c in CLASSES},
                      "bluffShare": round(shares["air"], 4),
                      "semiBluffShare": round(shares["draw"], 4)}
        print("%-18s %8d %7.1f%% %7.1f%% %7.1f%% %7.1f%%" % (
            a, tot, shares["air"] * 100, shares["draw"] * 100,
            shares["pair"] * 100, shares["strong"] * 100))

    # How many players could ever support a PER-VILLAIN intent read?
    depth = {}
    for a in ACTIONS:
        counts = sorted((sum(d[a].values()) for d in merged.values()), reverse=True)
        depth[a] = {
            "playersWithAny": sum(1 for c in counts if c > 0),
            "playersWith10plus": sum(1 for c in counts if c >= 10),
            "playersWith30plus": sum(1 for c in counts if c >= 30),
            "max": counts[0] if counts else 0,
        }

    print("\nPER-VILLAIN FEASIBILITY (shown observations per player)")
    print("%-18s %12s %12s %12s %6s" % ("action", "any", ">=10", ">=30", "max"))
    for a in ACTIONS:
        d = depth[a]
        print("%-18s %12d %12d %12d %6d" % (
            a, d["playersWithAny"], d["playersWith10plus"], d["playersWith30plus"], d["max"]))

    payload = {
        "question": "What fraction of each aggressive action is a bluff, rather than value?",
        "caveat": ("HandHQ online cash, July 2009 (SRC-011). EVERY number is conditional on "
                   "the player being CALLED AND SHOWING. A bluff that works is never shown, so "
                   "these are CAUGHT-bluff rates and understate true bluffing. Level "
                   "comparisons across players are unsafe. Hands are classified against the "
                   "board AS IT STOOD on the acting street, not at showdown."),
        "classes": {"air": "bluff", "draw": "semi-bluff",
                    "pair": "thin value OR protection — WS-278 ambiguity, deliberately not collapsed",
                    "strong": "value"},
        "poolSplit": summary,
        "perVillainFeasibility": depth,
        "playersSeen": len(merged),
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("\nwrote %s in %.0fs" % (args.out, time.time() - t0))


if __name__ == "__main__":
    main()
