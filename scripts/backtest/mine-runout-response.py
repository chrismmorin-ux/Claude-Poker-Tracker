"""
mine-runout-response.py — what do players do as the terminal-hand window closes?

WS-310 GATE, Stage 1. Founder concept, 2026-07-30: a runout is a collapsing window
of the hands that can still be made, fixed at the river. LAYER A is the window itself
(pure combinatorics, never ages, never censored). LAYER B is what players do while it
is still open (measured, censored, era-fragile). This script measures the raw material
for Layer B; scripts/backtest/runoutBenchmark.mjs supplies Layer A's denominator.

THE GAP THIS FILLS. No mining script in this repo conditions on board texture or runout
class — verified 2026-07-31, the apparent `flush` hits in mine-intent-splits.py,
mine-sizing-and-lines.py and mine-behavioral-features.py are all `print(flush=True)`.
We hold a corpus with complete runouts and have never asked what players do when the
flush completes.

WHAT IS MEASURED, AND WHY IT IS UNUSUALLY CLEAN FOR THIS REPO.
The population is: a player called a flop bet, then FACED a turn bet. The decision —
fold, call, or raise — is an action in the hand log, so BOTH the numerator and the
denominator are fully observed. That is a real departure from Findings 12/13 and from
mine-intent-splits.py, which are shown-hand conditionals and inherit showdown censoring
on both sides. Here the censoring lives entirely in the HOLDINGS: we never learn what
the folder held. That is exactly where the declared range in Stage 2 does its work, and
it is why Layer A has to exist for these numbers to mean anything.

STANDING RULE, BINDING (memory: feedback_numbers_carry_their_conditional).
A continuation rate conditioned on a runout is meaningless as a raw frequency.
"Villains fold 71% when the flush completes" is a large read if their range holds the
flush 12% of the time and is close to correct play if it holds it 40%. NOTHING in this
file's output is a finding on its own. The deliverable is a DEVIATION from what the
combinatorics support, and that subtraction happens in Stage 2. Every count here is
emitted as k/n so the conditioning stays attached to the number.

CELLS — NUT IDENTITY, COMPUTED, NOT A TEXTURE HEURISTIC.
The ticket asks for turns that "changed the nut identity". Taken literally: compute the
category of the best five-card hand available to ANY two-card holding, on the 3-card
board and again on the 4-card board. Different -> the card moved the nuts.

This is the distinction the shipped engine cannot draw. gameTreeDepth2.js:570 asks only

    const isScary = suitFreq[nextCard & 3] >= 2 || boardRanks.has(nextCard >> 2);
    if (isScary && heroScore <= heroScoreBefore) scaryCardCount++;

which is hero-centric and binary. A 9 on J-T-x moves the nuts from a set to a straight;
that test sees a card which neither paired the board nor brought a third suit, and
counts nothing. `completes_straight` below is precisely that case.

    completes_sf        nuts move to a straight flush (rare, reported separately)
    pairs_board         nuts move to quads
    completes_flush     third suit lands, nuts move to a flush
    completes_straight  nuts move to a straight
    overcard_blank      CONTROL — nut identity unchanged, turn is an overcard to the flop
    blank               nut identity unchanged, no overcard

`overcard_blank` is the control axis the design leans on (memory:
feedback_test_archetype_before_building_channel — a contrast without a control axis is
not evidence). An overcard raises hero-centric danger WITHOUT moving the nut window.
If the effect is real and is about the window, these must separate. If overcard_blank
moves as much as completes_flush, the effect is generic scare-card aversion and Layer A
is not what is doing the work.

KNOWN LIMIT OF THE CELL DEFINITION, stated rather than discovered later: this captures
nut identity at CATEGORY level. A turn that puts a fourth straight card out, moving the
nuts from one straight to a higher one, is scored `blank`. That is a conservative
direction — it dilutes the blank cell with genuinely nut-moving cards, which shrinks any
measured contrast rather than manufacturing one.

Usage:
    python scripts/backtest/mine-runout-response.py --self-test
    python scripts/backtest/mine-runout-response.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --out out/runout-response.json --workers 12

Run --self-test first. It checks the nut-identity classifier against a brute-force
enumeration of all 1,081 two-card holdings; the classifier is a hand-derived shortcut and
every number downstream depends on it being right.
"""

import argparse
import json
import os
import random
import re
import sys
import time
from collections import defaultdict
from multiprocessing import Pool

# Card encoding matches src/utils/pokerCore/cardParser.js exactly: rank * 4 + suit,
# ranks 2..A -> 0..12, suits from gameConstants SUITS = [spade, heart, diamond, club].
# Stage 2 hands these integers straight to bestFiveFromSeven, so any drift here is a
# silent wrong answer there.
RANK_VAL = {r: i for i, r in enumerate("23456789TJQKA")}
SUIT_VAL = {"s": 0, "h": 1, "d": 2, "c": 3}

# Straight windows over rank indices, including the wheel (A-2-3-4-5).
WINDOWS = [frozenset(range(i, i + 5)) for i in range(9)] + [frozenset([12, 0, 1, 2, 3])]

CELLS = ["completes_sf", "pairs_board", "completes_flush", "completes_straight",
         "overcard_blank", "blank"]
NUT_CHANGING = {"completes_sf", "pairs_board", "completes_flush", "completes_straight"}

DECISIONS = ["fold", "call", "raise"]

# Reservoir size per cell. Stage 2's equity pass subsamples from this; 5000 is far more
# than it needs and keeps the JSON manageable.
SAMPLE_PER_CELL = 5000

# Bet-size buckets as a fraction of the pot before the bet. Reported per cell so a
# continuation drop caused by PRICE rather than by the card stays visible.
SIZE_BUCKETS = [0.35, 0.55, 0.75, 1.0, 1.5]


def parse_cards(s):
    """Parse a PHH card string like 'Ah7d2c' into encoded ints. Skips junk."""
    out = []
    for i in range(0, len(s) - 1, 2):
        r, su = s[i], s[i + 1]
        if r in RANK_VAL and su in SUIT_VAL:
            out.append(RANK_VAL[r] * 4 + SUIT_VAL[su])
    return out


def board_features(board):
    """(paired, flush_possible, straight_possible, sf_possible) for a 3- or 4-card board.

    'Possible' means SOME two-card holding completes it — the board defines the universe
    (POKER_THEORY 15.1), so these are properties of the board alone, no range involved.
    """
    rank_counts = defaultdict(int)
    suit_ranks = defaultdict(set)
    ranks = set()
    for c in board:
        r, s = c >> 2, c & 3
        rank_counts[r] += 1
        suit_ranks[s].add(r)
        ranks.add(r)

    paired = any(v >= 2 for v in rank_counts.values())
    flush = any(len(v) >= 3 for v in suit_ranks.values())
    # A straight needs three board ranks inside one five-wide window; two hole cards
    # fill the rest.
    straight = any(len(w & ranks) >= 3 for w in WINDOWS)
    sf = any(any(len(w & rs) >= 3 for w in WINDOWS)
             for rs in suit_ranks.values() if len(rs) >= 3)
    return paired, flush, straight, sf


def nut_category(features):
    """Category of the best hand ANY two-card holding can make. Higher is better.

    8 straight flush | 7 quads | 5 flush | 4 straight | 3 trips

    A full house (6) never surfaces as the maximum: it requires a paired board, and a
    paired board always also permits quads, which outranks it. Trips is the floor —
    a pocket pair matching any board rank always exists.
    """
    paired, flush, straight, sf = features
    if sf:
        return 8
    if paired:
        return 7
    if flush:
        return 5
    if straight:
        return 4
    return 3


def classify_turn(flop, turn_card):
    """(cell, multi_mechanism) for a turn card landing on a flop.

    multi_mechanism flags the rare card that fires two mechanisms at once (e.g. a 2h on
    Ah-Kh-2c both pairs the board and brings a third heart). The primary label follows
    the mechanism that drove the category change; the flag keeps the overlap visible
    instead of hiding it inside a single bucket.
    """
    f = board_features(flop)
    t = board_features(flop + [turn_card])

    newly = []
    if t[3] and not f[3]:
        newly.append("completes_sf")
    if t[0] and not f[0]:
        newly.append("pairs_board")
    if t[1] and not f[1]:
        newly.append("completes_flush")
    if t[2] and not f[2]:
        newly.append("completes_straight")

    if nut_category(t) != nut_category(f):
        # Priority follows the category ladder, so the label names the mechanism that
        # actually moved the nuts.
        for name in ("completes_sf", "pairs_board", "completes_flush", "completes_straight"):
            if name in newly:
                return name, len(newly) > 1
        # Category moved but no mechanism newly fired — should be unreachable; fall
        # through to blank rather than assert, and it will show up as a zero cell.
    max_flop_rank = max(c >> 2 for c in flop)
    if (turn_card >> 2) > max_flop_rank:
        return "overcard_blank", len(newly) > 1
    return "blank", len(newly) > 1


def _cat7_oracle(cards):
    """Category of the best 5-card hand from 7 cards. Slow, dumb, and obviously correct.

    Exists only to check `nut_category`, which is a hand-derived combinatorial shortcut
    and therefore the thing most likely to be quietly wrong.
    """
    ranks = [c >> 2 for c in cards]
    by_suit = defaultdict(set)
    counts = defaultdict(int)
    for c in cards:
        by_suit[c & 3].add(c >> 2)
        counts[c >> 2] += 1
    mult = sorted(counts.values(), reverse=True)
    rset = set(ranks)

    for rs in by_suit.values():
        if len(rs) >= 5 and any(w <= rs for w in WINDOWS):
            return 8
    if mult[0] >= 4:
        return 7
    if mult[0] == 3 and len(mult) > 1 and mult[1] >= 2:
        return 6
    if any(len(v) >= 5 for v in by_suit.values()):
        return 5
    if any(w <= rset for w in WINDOWS):
        return 4
    if mult[0] == 3:
        return 3
    if mult[0] == 2 and len(mult) > 1 and mult[1] == 2:
        return 2
    if mult[0] == 2:
        return 1
    return 0


def self_test():
    """Validate nut_category against brute-force enumeration of all 2-card holdings.

    Two of the fixtures below were originally written the other way round from intuition
    and the oracle rejected them, which is the whole reason this exists:
      - an ACE on J-T-2 completes Broadway (KQ), so it is not a blank overcard;
      - A-K-Q of hearts already permits a straight flush on the FLOP, so a fourth heart
        moves nothing.
    """
    import itertools
    import random as _random

    rng = _random.Random(20260801)
    mismatches = []
    for trial in range(400):
        size = 3 if trial % 2 == 0 else 4
        board = rng.sample(range(52), size)
        got = nut_category(board_features(board))
        bset = set(board)
        deck = [c for c in range(52) if c not in bset]
        want = max(_cat7_oracle(list(board) + [a, b]) for a, b in itertools.combinations(deck, 2))
        if got != want:
            mismatches.append((board, got, want))

    fixtures = [
        ("JsTh2c", "9d", "completes_straight"),   # the ticket's own example
        ("JsTh2c", "3d", "blank"),
        ("JsTh2c", "Ad", "completes_straight"),   # ace completes Broadway
        ("JsTh2c", "2d", "pairs_board"),
        ("JhTh2c", "5h", "completes_flush"),
        ("9s8s2c", "7d", "completes_straight"),
        ("AhKhQh", "Jh", "blank"),                # SF already reachable on the flop
        ("AhKh2c", "Qh", "completes_sf"),
        ("8s3h2c", "Kd", "overcard_blank"),
        ("8s3h2c", "7d", "blank"),
    ]
    fails = []
    for flop_s, turn_s, want_cell in fixtures:
        got_cell, _ = classify_turn(parse_cards(flop_s), parse_cards(turn_s)[0])
        if got_cell != want_cell:
            fails.append((flop_s, turn_s, got_cell, want_cell))

    print("random boards checked: 400, nut_category mismatches: %d" % len(mismatches))
    for b, got, want in mismatches[:10]:
        print("   board=%s got=%d want=%d" % (b, got, want))
    print("fixtures: %d, failures: %d" % (len(fixtures), len(fails)))
    for f in fails:
        print("   flop=%s turn=%s got=%s want=%s" % f)
    ok = not mismatches and not fails
    print("self-test: %s" % ("PASS" if ok else "FAIL"))
    return 0 if ok else 1


def iter_hands(path):
    """Yield raw PHH hand dicts. Same reader as mine-intent-splits.py."""
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


def walk_hand(hand):
    """Replay one hand; return a result dict.

    Three things come out of one pass, because Stage 2 needs all of them and they are
    all cheap here:

      1. `spot`      — the measured decision (defender's answer to a turn bet).
      2. `flop`      — flop decisions facing the flop bet. This sets the WIDTH of the
                       declared defender range in Stage 2: how much of a preflop range
                       actually continues past a flop bet is observed and uncensored,
                       so it should not be a guessed parameter.
      3. `turnAction`— whether the flop bettor barrelled or checked this turn, by cell.
                       This conditions the declared BETTING range in Stage 2 (a card the
                       bettor barrels rarely implies a narrower, stronger betting range),
                       and it answers Layer B's second question directly: which runouts
                       kill aggression.

    A spot is: player B called a flop bet from player A, they went to the turn
    HEADS-UP, A bet the turn, and B answered. B's answer is the measured decision.

    Deliberately excluded, each for a reason:
      - flop raises      -> B's range is not 'called a bet', it is 'called a raise'
      - multiway turns   -> counted separately; a second live player changes the price
                            and the correct fold rate, so pooling them would confound
      - B donk-bets turn -> B made no decision facing a bet
      - A checks turn    -> no bet to respond to
    """
    empty = {"flopDecisions": None, "cell": None, "turnAction": None, "spot": None,
             "excluded": None}
    if hand.get("variant") != "NT":
        return empty
    actions, blinds, players = hand.get("actions"), hand.get("blinds"), hand.get("players")
    if not actions or not blinds or not players:
        return empty
    n = len(players)
    if n < 2:
        return empty

    street_committed = (list(blinds) + [0.0] * n)[:n]
    pot = sum(street_committed)
    current_bet = max(blinds) if blinds else 0.0
    street = 0
    board = []
    folded = [False] * n
    last_pf_raiser = None

    flop_bettor = None
    flop_callers = []
    flop_raised = False
    flop_first_actor = None
    flop_board = None
    turn_card = None
    turn_bettor = None
    turn_bet = 0.0
    pot_before_turn_bet = 0.0
    decision = None
    turn_action = None
    # Decisions taken FACING the flop bet — the observed width of a flop-continue range.
    flop_dec = {"folds": 0, "calls": 0, "raises": 0}

    def result(excluded=None):
        return {"flopDecisions": dict(flop_dec), "cell": None, "turnAction": None,
                "spot": None, "excluded": excluded}

    for tok in actions:
        parts = tok.split()
        if not parts:
            continue

        if parts[0] == "d":
            if len(parts) > 2 and parts[1] == "db":
                board.extend(parse_cards(parts[2]))
                new_street = {3: 1, 4: 2, 5: 3}.get(len(board))
                if new_street is None:
                    return result()
                if new_street == 2:
                    # Turn dealt. Everything the flop had to tell us is now fixed.
                    # Exclusions are COUNTED, not silently dropped — a bare "multiway
                    # excluded: 3" would read as 'multiway is rare' when it really means
                    # 'multiway went uncounted'.
                    if flop_bettor is None or flop_raised:
                        return result("no_clean_flop_bet")
                    if len(flop_callers) >= 2:
                        return result("multiway")
                    if len(flop_callers) != 1:
                        return result("no_clean_flop_bet")
                    active = [i for i in range(n) if not folded[i]]
                    if len(active) != 2 or set(active) != {flop_bettor, flop_callers[0]}:
                        return result("multiway" if len(active) > 2 else "other")
                    flop_board = board[:3]
                    turn_card = board[3]
                if new_street == 3:
                    break  # river reached; turn action already classified
                street = new_street
                street_committed = [0.0] * n
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
            continue

        if verb == "f":
            folded[p] = True
            if street == 1 and flop_bettor is not None and p != flop_bettor:
                flop_dec["folds"] += 1
            if street == 2 and turn_bettor is not None and p == flop_callers[0]:
                decision = "fold"
                break
            continue

        if verb == "cc":
            owed = current_bet - street_committed[p]
            if owed > 1e-9:
                pot += owed
                street_committed[p] = current_bet
            if street == 1:
                if flop_first_actor is None:
                    flop_first_actor = p
                if owed > 1e-9 and flop_bettor is not None:
                    flop_callers.append(p)
                    flop_dec["calls"] += 1
            elif street == 2 and turn_bettor is not None and p == flop_callers[0] and owed > 1e-9:
                decision = "call"
                break
            continue

        if verb == "cbr":
            try:
                amount = float(parts[2])
            except (IndexError, ValueError):
                return result()
            delta = amount - street_committed[p]
            if delta > 0:
                pot += delta
            if street == 0:
                last_pf_raiser = p
            elif street == 1:
                if flop_first_actor is None:
                    flop_first_actor = p
                if flop_bettor is None and current_bet <= 1e-9:
                    flop_bettor = p
                else:
                    flop_raised = True
                    flop_dec["raises"] += 1
            elif street == 2:
                if turn_bettor is None and current_bet <= 1e-9:
                    if p != flop_bettor:
                        # Defender donked. No decision facing a bet, but the bettor's
                        # aggression was pre-empted — recorded as its own turn action so
                        # the barrel-frequency denominator stays honest.
                        turn_action = "donk"
                        break
                    turn_bettor = p
                    turn_action = "bet"
                    turn_bet = amount
                    pot_before_turn_bet = pot - delta
                elif turn_bettor is not None and p == flop_callers[0]:
                    decision = "raise"
                    break
                else:
                    break
            street_committed[p] = amount
            current_bet = amount
            continue

    if flop_board is None or turn_card is None:
        return result()

    cell, multi = classify_turn(flop_board, turn_card)
    if turn_action is None:
        # Heads-up turn reached and neither player bet it.
        turn_action = "check"

    out = {"flopDecisions": dict(flop_dec), "cell": cell, "turnAction": turn_action,
           "spot": None, "excluded": None}
    if decision is None or pot_before_turn_bet <= 0 or turn_bet <= 0:
        return out

    defender = flop_callers[0]
    out["spot"] = {
        "flop": flop_board,
        "turn": turn_card,
        "cell": cell,
        "multi": multi,
        "potBefore": round(pot_before_turn_bet, 4),
        "bet": round(turn_bet, 4),
        # Price the defender is offered: call `bet` to win (potBefore + bet).
        "reqEquity": round(turn_bet / (pot_before_turn_bet + 2 * turn_bet), 5),
        "betFrac": round(turn_bet / pot_before_turn_bet, 4),
        "defenderOop": flop_first_actor == defender,
        "bettorIsPfr": flop_bettor == last_pf_raiser,
        "decision": decision,
    }
    return out


def new_acc():
    return {
        "cells": {c: {d: 0 for d in DECISIONS} for c in CELLS},
        "multi": {c: 0 for c in CELLS},
        "oop": {c: {"oop": 0, "ip": 0} for c in CELLS},
        "pfr": {c: {"pfr": 0, "nonpfr": 0} for c in CELLS},
        "sizes": {c: [0] * (len(SIZE_BUCKETS) + 1) for c in CELLS},
        "reqEquitySum": {c: 0.0 for c in CELLS},
        "samples": {c: [] for c in CELLS},
        "seen": {c: 0 for c in CELLS},
        "excluded": defaultdict(int),
        # Turn aggression by cell — 'which runouts kill aggression', and the width of
        # the declared betting range Stage 2 conditions on.
        "turnAction": {c: {"bet": 0, "check": 0, "donk": 0} for c in CELLS},
        # Flop decisions facing the flop bet — width of the declared defender range.
        "flopDecisions": {"folds": 0, "calls": 0, "raises": 0},
        "handsScanned": 0,
    }


def size_bucket(frac):
    for i, edge in enumerate(SIZE_BUCKETS):
        if frac <= edge:
            return i
    return len(SIZE_BUCKETS)


def absorb(acc, spot, rng):
    """Fold one spot into the accumulator, reservoir-sampling per cell."""
    c = spot["cell"]
    acc["cells"][c][spot["decision"]] += 1
    if spot["multi"]:
        acc["multi"][c] += 1
    acc["oop"][c]["oop" if spot["defenderOop"] else "ip"] += 1
    acc["pfr"][c]["pfr" if spot["bettorIsPfr"] else "nonpfr"] += 1
    acc["sizes"][c][size_bucket(spot["betFrac"])] += 1
    acc["reqEquitySum"][c] += spot["reqEquity"]

    acc["seen"][c] += 1
    res = acc["samples"][c]
    if len(res) < SAMPLE_PER_CELL:
        res.append(spot)
    else:
        j = rng.randrange(acc["seen"][c])
        if j < SAMPLE_PER_CELL:
            res[j] = spot


def mine_file(path):
    acc = new_acc()
    # Seeded per file so a rerun over the same corpus reproduces the same sample.
    rng = random.Random(hash(os.path.basename(path)) & 0xFFFFFFFF)
    try:
        for hand in iter_hands(path):
            acc["handsScanned"] += 1
            try:
                res = walk_hand(hand)
            except Exception:
                continue
            if not res:
                continue
            fd = res.get("flopDecisions")
            if fd:
                for k in ("folds", "calls", "raises"):
                    acc["flopDecisions"][k] += fd[k]
            if res.get("excluded"):
                acc["excluded"][res["excluded"]] += 1
                continue
            if res.get("cell") and res.get("turnAction"):
                acc["turnAction"][res["cell"]][res["turnAction"]] += 1
            if res.get("spot"):
                absorb(acc, res["spot"], rng)
    except Exception as e:
        sys.stderr.write("file error %s: %s\n" % (path, e))
    return acc


def merge(dst, src, rng):
    for k, v in src["excluded"].items():
        dst["excluded"][k] += v
    for k in ("folds", "calls", "raises"):
        dst["flopDecisions"][k] += src["flopDecisions"][k]
    dst["handsScanned"] += src["handsScanned"]
    for c in CELLS:
        for a in ("bet", "check", "donk"):
            dst["turnAction"][c][a] += src["turnAction"][c][a]
        for d in DECISIONS:
            dst["cells"][c][d] += src["cells"][c][d]
        dst["multi"][c] += src["multi"][c]
        dst["oop"][c]["oop"] += src["oop"][c]["oop"]
        dst["oop"][c]["ip"] += src["oop"][c]["ip"]
        dst["pfr"][c]["pfr"] += src["pfr"][c]["pfr"]
        dst["pfr"][c]["nonpfr"] += src["pfr"][c]["nonpfr"]
        for i in range(len(SIZE_BUCKETS) + 1):
            dst["sizes"][c][i] += src["sizes"][c][i]
        dst["reqEquitySum"][c] += src["reqEquitySum"][c]
        for spot in src["samples"][c]:
            dst["seen"][c] += 1
            res = dst["samples"][c]
            if len(res) < SAMPLE_PER_CELL:
                res.append(spot)
            else:
                j = rng.randrange(dst["seen"][c])
                if j < SAMPLE_PER_CELL:
                    res[j] = spot


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus-root", required=False)
    ap.add_argument("--out", required=False)
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--stakes", default=None)
    ap.add_argument("--limit-files", type=int, default=None)
    ap.add_argument("--self-test", action="store_true",
                    help="validate the nut-identity classifier against a brute-force oracle")
    args = ap.parse_args()

    if args.self_test:
        sys.exit(self_test())
    if not args.corpus_root or not args.out:
        ap.error("--corpus-root and --out are required unless --self-test is given")

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
            files.extend(os.path.join(root, f) for f in sorted(names) if f.endswith(".phhs"))
    if not files:
        sys.exit("no .phhs files found")
    files.sort()
    if args.limit_files:
        files = files[:args.limit_files]

    print("mining %d files for turn runout response..." % len(files), flush=True)
    t0 = time.time()
    merged = new_acc()
    merge_rng = random.Random(20260801)
    with Pool(args.workers) as pool:
        # Ordered imap, not imap_unordered: the reservoir merge depends on arrival order,
        # so ordering is what makes the sampled subset reproducible across runs.
        for i, res in enumerate(pool.imap(mine_file, files, chunksize=4)):
            merge(merged, res, merge_rng)
            if (i + 1) % 200 == 0:
                print("  %d/%d files, %.0fs" % (i + 1, len(files), time.time() - t0), flush=True)

    print("\nTURN CONTINUATION FACING A BET, BY RUNOUT CELL")
    print("(defender called a flop bet, heads-up to the turn, faced a bet)")
    print("%-20s %9s %9s %9s %11s %9s" % ("cell", "n", "folds", "conts", "cont k/n", "avg req eq"))
    summary = {}
    for c in CELLS:
        d = merged["cells"][c]
        n = sum(d.values())
        if n == 0:
            summary[c] = {"n": 0}
            print("%-20s %9d %9s %9s %11s %9s" % (c, 0, "-", "-", "-", "-"))
            continue
        cont = d["call"] + d["raise"]
        summary[c] = {
            "n": n,
            "folds": d["fold"],
            "calls": d["call"],
            "raises": d["raise"],
            "continues": cont,
            "continueRate": round(cont / n, 5),
            "nutChanging": c in NUT_CHANGING,
            "multiMechanism": merged["multi"][c],
            "defenderOop": merged["oop"][c],
            "bettorIsPfr": merged["pfr"][c],
            "sizeBuckets": merged["sizes"][c],
            "avgReqEquity": round(merged["reqEquitySum"][c] / n, 5),
            "sampled": len(merged["samples"][c]),
            "turnAction": merged["turnAction"][c],
            "barrelRate": (
                round(merged["turnAction"][c]["bet"]
                      / max(1, merged["turnAction"][c]["bet"] + merged["turnAction"][c]["check"]), 5)),
        }
        print("%-20s %9d %9d %9d %11s %9.4f" % (
            c, n, d["fold"], cont, "%d/%d" % (cont, n), summary[c]["avgReqEquity"]))

    total = sum(s.get("n", 0) for s in summary.values())
    nut_n = sum(summary[c].get("n", 0) for c in NUT_CHANGING)
    print("\ntotal measured decisions: %d  (nut-changing %d, unchanged %d)"
          % (total, nut_n, total - nut_n))
    print("excluded (counted, not silently dropped): %s"
          % ", ".join("%s=%d" % (k, v) for k, v in sorted(merged["excluded"].items())))
    print("hands scanned: %d" % merged["handsScanned"])

    print("\nTURN AGGRESSION BY CELL — which runouts kill the barrel")
    print("(flop bettor's own action on the turn, heads-up)")
    print("%-20s %9s %9s %9s %12s" % ("cell", "bets", "checks", "donked", "barrel k/n"))
    for c in CELLS:
        ta = merged["turnAction"][c]
        den = ta["bet"] + ta["check"]
        print("%-20s %9d %9d %9d %12s" % (
            c, ta["bet"], ta["check"], ta["donk"],
            "%d/%d" % (ta["bet"], den) if den else "-"))

    fd = merged["flopDecisions"]
    fd_total = fd["folds"] + fd["calls"] + fd["raises"]
    flop_continue = (fd["calls"] + fd["raises"]) / fd_total if fd_total else 0.0
    print("\nFLOP DECISIONS FACING A BET (sets the declared defender range's WIDTH)")
    print("  continue %d/%d = %.4f   (folds %d, calls %d, raises %d)"
          % (fd["calls"] + fd["raises"], fd_total, flop_continue,
             fd["folds"], fd["calls"], fd["raises"]))

    payload = {
        "question": ("Conditional on the turn card having moved the NUT IDENTITY, how "
                     "often does a player who called the flop bet continue against a "
                     "turn bet?"),
        "caveat": (
            "HandHQ online cash, July 2009 (SRC-011). The DECISION is fully observed — "
            "fold/call/raise are actions in the log, so neither numerator nor denominator "
            "is showdown-censored. The HOLDINGS are censored: we never learn what a folder "
            "held. Therefore no number here is a finding on its own. It becomes one only "
            "after subtracting the Layer-A combinatorial expectation "
            "(scripts/backtest/runoutBenchmark.mjs) — a deviation, never a frequency. "
            "Cells are nut-identity change at CATEGORY level; a turn moving the nuts from "
            "one straight to a higher straight scores as blank, which dilutes the blank "
            "cell and shrinks any contrast rather than inflating it."),
        "cellDefinitions": {
            "completes_sf": "nuts move to a straight flush",
            "pairs_board": "nuts move to quads",
            "completes_flush": "third suit lands, nuts move to a flush",
            "completes_straight": "nuts move to a straight",
            "overcard_blank": ("CONTROL — nut identity unchanged, turn is an overcard to "
                               "the flop. Hero-centric danger without a moved window."),
            "blank": "nut identity unchanged, no overcard",
        },
        "sizeBucketEdges": SIZE_BUCKETS,
        "cells": summary,
        "excluded": dict(merged["excluded"]),
        "excludedNote": ("multiway = flop bet got 2+ callers (price and correct fold rate "
                         "both differ, so pooling would confound). no_clean_flop_bet = no "
                         "flop bet, or the flop bet was raised (defender's range is then "
                         "'called a raise', a different population)."),
        "flopContinue": {
            "folds": fd["folds"], "calls": fd["calls"], "raises": fd["raises"],
            "total": fd_total, "continueRate": round(flop_continue, 5),
            "note": ("Fully observed. Stage 2 uses this as the WIDTH of the declared "
                     "flop-continue range, so that width is measured rather than assumed."),
        },
        "handsScanned": merged["handsScanned"],
        "totalDecisions": total,
        "samples": {c: merged["samples"][c] for c in CELLS},
        "sampleNote": ("Reservoir sample per cell (max %d), seeded and merged in file "
                       "order so reruns reproduce it. Stage 2 subsamples boards from "
                       "here for the equity pass." % SAMPLE_PER_CELL),
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("\nwrote %s in %.0fs" % (args.out, time.time() - t0))


if __name__ == "__main__":
    main()
