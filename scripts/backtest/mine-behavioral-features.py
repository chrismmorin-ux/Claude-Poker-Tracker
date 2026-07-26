"""
mine-behavioral-features.py — per-player POSTFLOP/LINE features for behavioural clustering.

WHY THIS EXISTS
---------------
The first clustering pass (`cluster-player-types.py`) found two poles and no
support for six archetypes. That conclusion was OVER-STATED, and the founder
caught the reason:

    "It certainly feels like there are more styles of play when at a live table
     (observing trapping frequencies, bluff frequencies, aggression, limp raises,
     triple barrel bluff capable) but that all finds its way into a specific
     player's history."

Correct. That pass clustered on six stats — vpip, pfr, threeBet, foldTo3Bet,
cbet, foldToCbet. Five are preflop and the sixth is a single c-bet frequency.
NONE of the behaviours above were in the feature set, so the finding was really
"the stats we currently record resolve two types", not "the pool contains two
types". Absence of structure in a feature set is not absence of structure.

This script extracts the missing dimensions per player, so the question can be
asked properly.

FEATURES, and the behaviour each is a proxy for
  double_barrel      turn bet after making a flop c-bet     — barrel persistence
  triple_barrel      river bet after a turn barrel          — "triple barrel capable"
  check_raise_flop   check then raise on the flop           — trapping / aggression
  limp_raise         raise preflop after own limp           — limp-raise trapping
  donk_flop          leading into the preflop aggressor     — non-standard aggression
  postflop_af        (bets+raises)/calls after the flop      — postflop aggression
  wtsd               showdowns reached per flop seen        — stickiness
  river_bet_air      river bettor shown holding air         — BLUFF FREQUENCY (direct)
  showdown_slowplay  strong holding that checked the flop   — TRAPPING (direct)
  fold_small / fold_big  fold vs <=1/3 pot vs >=2/3 pot      — size sensitivity

The last three are the ones the pooled miner already computed but never kept per
player, and they are the closest thing in the corpus to the reads a live player
actually forms.

CENSORING — BINDING CAVEAT. `river_bet_air` and `showdown_slowplay` are computable
only when a player SHOWS. Showdown samples are censored (called bets only) and
biased toward hands that reached the river. They are labelled as the conditionals
they actually are and require a minimum count before being used as features.

Parsing mirrors `phh_miner.py` exactly (same tokens, same street handling) so the
stat semantics stay comparable with everything else built on that corpus.

Usage:
    python scripts/backtest/mine-behavioral-features.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --out out/behavioral-features.json --workers 12
"""

import argparse
import json
import os
import re
import sys
import time
from collections import defaultdict
from multiprocessing import Pool

RANKS = "23456789TJQKA"
RANK_VAL = {r: i for i, r in enumerate(RANKS, 2)}

# Counter pairs: name -> (successes, opportunities)
PAIR_FEATURES = [
    "double_barrel", "triple_barrel", "check_raise_flop", "limp_raise",
    "donk_flop", "wtsd", "river_bet_air", "showdown_slowplay",
    "fold_small", "fold_big",
]


def parse_cards(s):
    out = []
    for i in range(0, len(s) - 1, 2):
        r, su = s[i], s[i + 1]
        if r in RANK_VAL:
            out.append((RANK_VAL[r], su))
    return out


def hand_class(hole, board):
    """'air' | 'pair' | 'strong' — same classifier as phh_miner."""
    cards = hole + board
    ranks = sorted((c[0] for c in cards), reverse=True)
    suits = defaultdict(int)
    for _, s in cards:
        suits[s] += 1
    counts = defaultdict(int)
    for r in ranks:
        counts[r] += 1
    mult = sorted(counts.values(), reverse=True)
    if mult[0] >= 3 or (mult[0] == 2 and mult[1] >= 2):
        return "strong"
    if max(suits.values()) >= 5:
        return "strong"
    uniq = sorted(set(ranks))
    if 14 in uniq:
        uniq = [1] + uniq
    run = 1
    for a, b in zip(uniq, uniq[1:]):
        run = run + 1 if b == a + 1 else 1
        if run >= 5:
            return "strong"
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
            key = line[:eq].strip()
            val = line[eq + 1:].strip()
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
    if hand:
        yield hand


def new_player():
    d = {f: [0, 0] for f in PAIR_FEATURES}
    d["pf_bets_raises"] = [0, 0]   # [bets+raises, calls] -> postflop AF
    return d


def mine_hand(hand, players_acc):
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
    pot = sum(blinds)
    street = 0
    board = []

    limped = [False] * n
    pf_raised = [False] * n
    limp_then_raise = [False] * n
    last_pf_raiser = None

    flop_acted = [False] * n
    flop_checked = [False] * n
    flop_bet = [False] * n
    flop_checkraised = [False] * n
    flop_faced_bet_after_check = [False] * n
    donk_opp = [False] * n
    donk_did = [False] * n
    turn_bet = [False] * n
    river_bet = [False] * n
    saw_flop = [False] * n
    postflop_agg = [0] * n
    postflop_call = [0] * n
    shown = {}
    river_bettor = None

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

        owed = current_bet - committed[p]
        if street >= 1:
            saw_flop[p] = True
            if street == 1:
                flop_acted[p] = True

        if verb == "f":
            # Size sensitivity: fold facing a small vs a large bet.
            if owed > 1e-9 and pot > 0:
                frac = owed / pot
                if frac <= 0.34:
                    players_acc[players[p]]["fold_small"][0] += 1
                    players_acc[players[p]]["fold_small"][1] += 1
                elif frac >= 0.66:
                    players_acc[players[p]]["fold_big"][0] += 1
                    players_acc[players[p]]["fold_big"][1] += 1
            continue

        if verb == "cc":
            if owed > 1e-9:
                if street == 0 and not pf_raised[p] and current_bet <= max(blinds) + 1e-9:
                    limped[p] = True
                if street >= 1:
                    postflop_call[p] += 1
                    # Denominator for the size-sensitivity rates: called instead of folding.
                    if pot > 0:
                        frac = owed / pot
                        if frac <= 0.34:
                            players_acc[players[p]]["fold_small"][1] += 1
                        elif frac >= 0.66:
                            players_acc[players[p]]["fold_big"][1] += 1
                if street == 1 and flop_checked[p]:
                    flop_faced_bet_after_check[p] = True
                pot += owed
                committed[p] = current_bet
            else:
                if street == 1:
                    flop_checked[p] = True
            continue

        if verb == "cbr":
            amount = float(parts[2])
            if street == 0:
                if limped[p] and not pf_raised[p]:
                    limp_then_raise[p] = True
                pf_raised[p] = True
                last_pf_raiser = p
            else:
                postflop_agg[p] += 1
                if street == 1:
                    if flop_checked[p]:
                        flop_checkraised[p] = True
                    if current_bet <= 1e-9:
                        flop_bet[p] = True
                elif street == 2:
                    turn_bet[p] = True
                elif street == 3:
                    river_bet[p] = True
                    river_bettor = p
            pot += amount - committed[p]
            committed[p] = amount
            current_bet = amount
            continue

    # ---- fold to a c-bet / donk opportunity bookkeeping
    if last_pf_raiser is not None:
        for i in range(n):
            if i != last_pf_raiser and flop_acted[i]:
                # A donk is leading into the preflop aggressor before they act.
                donk_opp[i] = True
                if flop_bet[i]:
                    donk_did[i] = True

    for i in range(n):
        pid = players[i]
        acc = players_acc[pid]

        if limped[i]:
            acc["limp_raise"][1] += 1
            if limp_then_raise[i]:
                acc["limp_raise"][0] += 1

        if flop_faced_bet_after_check[i]:
            acc["check_raise_flop"][1] += 1
            if flop_checkraised[i]:
                acc["check_raise_flop"][0] += 1

        if donk_opp[i]:
            acc["donk_flop"][1] += 1
            if donk_did[i]:
                acc["donk_flop"][0] += 1

        # Barrel chain — only meaningful for the player who actually c-bet.
        if i == last_pf_raiser and flop_bet[i]:
            acc["double_barrel"][1] += 1
            if turn_bet[i]:
                acc["double_barrel"][0] += 1
                acc["triple_barrel"][1] += 1
                if river_bet[i]:
                    acc["triple_barrel"][0] += 1

        if saw_flop[i]:
            acc["wtsd"][1] += 1
            if i in shown:
                acc["wtsd"][0] += 1

        acc["pf_bets_raises"][0] += postflop_agg[i]
        acc["pf_bets_raises"][1] += postflop_call[i]

    # ---- showdown-derived reads (censored sample; labelled as such downstream)
    if len(board) == 5:
        for i, hole in shown.items():
            cls = hand_class(hole, board)
            acc = players_acc[players[i]]
            # Bluff frequency: this player bet the river and showed air.
            if river_bettor == i:
                acc["river_bet_air"][1] += 1
                if cls == "air":
                    acc["river_bet_air"][0] += 1
            # Trapping: showed a strong hand having checked the flop.
            if cls == "strong" and flop_acted[i]:
                acc["showdown_slowplay"][1] += 1
                if flop_checked[i] and not flop_bet[i]:
                    acc["showdown_slowplay"][0] += 1


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
    return {pid: {k: list(v) for k, v in d.items()} for pid, d in acc.items()}


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
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
    print("mining %d files for per-player behavioural features..." % len(files), flush=True)

    t0 = time.time()
    merged = defaultdict(new_player)
    with Pool(args.workers) as pool:
        for i, res in enumerate(pool.imap_unordered(mine_file, files, chunksize=4)):
            for pid, d in res.items():
                tgt = merged[pid]
                for k, v in d.items():
                    tgt[k][0] += v[0]
                    tgt[k][1] += v[1]
            if (i + 1) % 300 == 0:
                print("  %d/%d files, %d players, %.0fs" % (i + 1, len(files), len(merged), time.time() - t0), flush=True)

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump({
            "caveat": ("HandHQ online cash, July 2009 (SRC-011). river_bet_air and "
                       "showdown_slowplay are CENSORED — computable only when a player "
                       "shows, and showdown samples are conditional on reaching the "
                       "river and being called. Live generalisation is an assumption."),
            "features": PAIR_FEATURES + ["pf_bets_raises"],
            "players": {pid: d for pid, d in merged.items()},
        }, f)
    print("wrote %s (%d players) in %.0fs" % (args.out, len(merged), time.time() - t0))


if __name__ == "__main__":
    main()
