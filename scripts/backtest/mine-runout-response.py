"""
mine-runout-response.py — WS-310 GATE. What do players do as the window closes?

THE QUESTION (founder concept, 2026-07-30):

    A runout is a collapsing window of the hands that can still be made, fixed at
    the river. Model the window (Layer A, deterministic), and model what players do
    while it is still open (Layer B, measured).

This script is the GATE ONLY. It does not build Layer A or Layer B as engine
primitives. It answers one falsifiable question, and the answer decides whether the
design work happens at all:

    STATED PREDICTION — on nut-changing turns, continuation drops MORE than the
    combinatorial change in range strength justifies. Villains over-fold to the
    scare card relative to what their own range supports.

    Confirmed -> the behavioural layer has a measured effect with a sign.
    Flat      -> Layer A alone may carry the value. Cheaper build, useful answer.

Both outcomes are acceptable. A flat result is a real result — do not go looking for
a slice that confirms.

WHY A DEVIATION AND NEVER A FREQUENCY.
Per the standing rule that feedback numbers carry their conditional, a behavioural
number conditioned on a runout is meaningless raw. "Villains fold 71% on
flush-completing rivers" is a read if their range holds the flush 12% of the time
and is close to correct play if it holds it 40%. So every headline number here is a
DEVIATION from what the combinatorics support, measured against blank turns as the
reference cell.

    deviation = (B_class - B_blank) - (A_class - A_blank)

    B_x = observed continuation rate on turns of class x
    A_x = combinatorial change in the range's strength, over the SAME boards

A_x is reported under three strength metrics rather than one, because the obvious
scalar turned out to be an artifact — see the METRICS block below, which is worth
reading before trusting any number this script prints.

    deviation < 0  ->  over-folding beyond what the card did to the range (predicted)
    deviation ~ 0  ->  players are tracking the combinatorics (flat; gate fails)
    deviation > 0  ->  under-folding / stickiness

Differencing against `blank` is what makes this robust: any constant bias in the
strength proxy, the range assumption, or the spot filter cancels. Only the
CLASS-RELATIVE movement survives, which is the quantity the prediction is about.

THE SPOT — fully observable, which is rare here.
    1. Preflop raise.
    2. Flop: the preflop raiser c-bets, exactly ONE opponent calls, no raise.
    3. Turn: the same player bets again, first-in.
    4. Villain (the flop caller) folds, calls, or raises.  <- the measured decision

Note what is NOT censored: the fold/call decision is always in the log. Unlike
mine-intent-splits.py, this is not a "given they showed" conditional, so the counts
are the real population. What IS unobservable is villain's HOLDING when they fold,
which is exactly why Layer A's denominator has to be DECLARED rather than measured
(see below).

BINDING — WHY THE DENOMINATOR IS DECLARED (FIND-038).
Layer A must be derived from board combinatorics against a DECLARED range, never
from the engine's own narrowed estimate. Taking the base rate from the model makes
the model validate itself; that is FIND-038, where sizing told measured
self-consistency with the engine's prior while the UI claimed showdown confirmation.
So the two denominators below are both frozen in this file, and neither is imported
from the engine.

TWO DENOMINATORS, REPORTED SIDE BY SIDE (founder decision, SPR-167).
    universe  all 1326 combos minus board cards. Zero assumptions. Measures purely
              what the card did to the space of hands. A player who called a flop
              bet is not holding random cards, so this is a bound, not a model.
    declared  a frozen preflop DEFEND range (see DECLARED_CALL_RANGE). Closer to a
              real caller, but see the bias note on that constant.
If the deviation's sign survives both, it is robust to the range assumption. If the
two disagree, that disagreement is itself the finding and belongs in the report.

CENSORING AND BIAS — direction stated, per accept criteria.
    1. Villain's true flop-CALL range is STRONGER than either denominator: they
       called a preflop raise AND a flop c-bet. Both denominators therefore
       UNDERSTATE how much strength the range holds.
    2. That bias is largely differenced away by the blank-turn reference, because it
       applies to every cell. It only survives to the extent it interacts with turn
       class — plausible but unmeasured, and it is the main threat to validity here.
    3. Spot selection conditions on reaching a turn bet, which is downstream of flop
       play. Rates are "given this spot", never unconditional.
    4. HandHQ online cash, 2009 (SRC-011). Era-fragile by construction: Layer B is
       exactly the layer that ages. Layer A does not age.

Usage:
    python scripts/backtest/mine-runout-response.py \
        --corpus-root C:/Users/chris/data/phh-dataset/data/handhq \
        --out out/runout-response.json --workers 12

    # verify the instrument against the synthetic fixture first:
    python scripts/backtest/mine-runout-response.py --self-test
"""

import argparse
import json
import os
import re
import sys
import time
import zlib
from collections import defaultdict, Counter
from itertools import combinations
from multiprocessing import Pool

RANK_VAL = {r: i for i, r in enumerate("23456789TJQKA", 2)}
VAL_RANK = {v: r for r, v in RANK_VAL.items()}
SUITS = "cdhs"

# Turn-card classes. Mutually exclusive by the precedence in classify_turn_card.
TURN_CLASSES = ["flush_completing", "straight_completing", "board_pairing", "blank"]
# Villain's decision facing the turn bet. Exhaustive and uncensored.
DECISIONS = ["fold", "call", "raise"]
# Strength taxonomy — deliberately identical to mine-intent-splits.py so Layer A is
# expressed in the same units as Finding 12's terminal-strength table.
CLASSES = ["air", "draw", "pair", "strong"]

# Layer A summary metrics. THREE, not one, and the choice is load-bearing —
# measured on real boards 2026-08-02 (universe denominator, delta vs flop):
#
#     turn class    d(continuing)   d(made)    d(strong)
#     blank             +0.1033     +0.1016     +0.0279
#     straight          +0.3480     -0.0473     +0.0705
#     flush             +0.3123     +0.0064     +0.0678
#     pairing           +0.5714     +0.5697     +0.3311
#
# `continuing` (1 - air) is INFLATED BY AN ARTIFACT: a 4-card board mechanically
# admits more 4-in-a-five-window draws than a 3-card one, so most of its movement is
# combos being relabelled `draw`, not strength arriving.
# `made` (pair+strong) is CORRUPTED by classify()'s precedence — `draw` outranks
# `pair`, so a combo that was a pair on the flop can be relabelled a draw on the
# turn. That is why the straight cell goes NEGATIVE, which is not a real weakening.
# `strong` (two-pair-or-better) is evaluated FIRST in classify(), so it is immune to
# both effects, and it orders exactly as the combinatorics demand: pairing a board
# opens boats and quads, straight/flush cards open one new nut category, a blank
# opens almost nothing.
#
# So `strong` is the headline. The other two are reported anyway: a gate that turns
# on one contestable scalar is a gate that can be argued away, and if the sign of
# the deviation holds across all three it cannot be blamed on the metric.
METRICS = ["strong", "made", "continuing"]
PRIMARY_METRIC = "strong"

# ---------------------------------------------------------------------------
# DECLARED RANGES — frozen here on purpose. Do NOT import these from the engine.
# ---------------------------------------------------------------------------
# Copied 2026-08-02 from src/utils/pokerCore/rangeMatrix.js PREFLOP_CHARTS.BB
# (line 209), the repo's declared BB defending range. Frozen rather than tracked:
# if this silently followed the engine's charts, Layer A would drift with the model
# it is supposed to independently check — the FIND-038 failure mode.
#
# BIAS, STATED: this is a PREFLOP DEFEND range. Villain in our spot also called a
# flop c-bet, so their true range is strictly stronger and narrower than this. The
# blank-turn reference cell absorbs most of that; the residual is the known weak
# point of this gate.
DECLARED_CALL_RANGE = (
    "22+,A2s+,K4s+,Q7s+,J7s+,T7s+,97s+,86s+,76s,75s,65s,64s,54s,53s,43s,"
    "A6o+,K9o+,Q9o+,J9o+,T9o,98o,87o"
)


# ---------------------------------------------------------------------------
# Card / range parsing
# ---------------------------------------------------------------------------

def parse_cards(s):
    out = []
    for i in range(0, len(s) - 1, 2):
        r, su = s[i], s[i + 1]
        if r in RANK_VAL:
            out.append((RANK_VAL[r], su))
    return out


def parse_range_string(spec):
    """Expand a range string into a set of (rank_hi, rank_lo, kind) classes.

    kind: 'p' pair, 's' suited, 'o' offsuit. Supports the three forms used in
    rangeMatrix.js: '22+', 'A9s+'/'AJo+', and exact tokens like 'T9s'/'KQo'.
    """
    out = set()
    for tok in spec.split(","):
        tok = tok.strip()
        if not tok:
            continue
        plus = tok.endswith("+")
        if plus:
            tok = tok[:-1]
        r1, r2 = RANK_VAL[tok[0]], RANK_VAL[tok[1]]
        kind = tok[2] if len(tok) > 2 else "p"
        if r1 == r2:
            # '66+' -> every pair from 66 to AA
            lo, hi = (r1, 14) if plus else (r1, r1)
            for r in range(lo, hi + 1):
                out.add((r, r, "p"))
        else:
            hi, lo = max(r1, r2), min(r1, r2)
            # 'A9s+' -> raise the LOW card up to one below the high card
            lo_end = hi - 1 if plus else lo
            for r in range(lo, lo_end + 1):
                out.add((hi, r, kind))
    return out


def expand_combos(classes):
    """Expand hand classes into concrete 2-card combos as ((r,s),(r,s)) tuples."""
    out = []
    for hi, lo, kind in classes:
        if kind == "p":
            for a, b in combinations(SUITS, 2):
                out.append(((hi, a), (hi, b)))
        elif kind == "s":
            for s in SUITS:
                out.append(((hi, s), (lo, s)))
        else:
            for a in SUITS:
                for b in SUITS:
                    if a != b:
                        out.append(((hi, a), (lo, b)))
    return out


def all_combos():
    deck = [(r, s) for r in range(2, 15) for s in SUITS]
    return [tuple(c) for c in combinations(deck, 2)]


# Built once per process; both are pure constants.
_UNIVERSE_COMBOS = None
_DECLARED_COMBOS = None


def denominator_combos(name):
    global _UNIVERSE_COMBOS, _DECLARED_COMBOS
    if name == "universe":
        if _UNIVERSE_COMBOS is None:
            _UNIVERSE_COMBOS = all_combos()
        return _UNIVERSE_COMBOS
    if _DECLARED_COMBOS is None:
        _DECLARED_COMBOS = expand_combos(parse_range_string(DECLARED_CALL_RANGE))
    return _DECLARED_COMBOS


# ---------------------------------------------------------------------------
# Strength classification — byte-identical logic to mine-intent-splits.py
# ---------------------------------------------------------------------------

def classify(hole, board):
    """air | draw | pair | strong, evaluated against the board AS GIVEN.

    Duplicated rather than imported: these mining scripts are standalone by
    convention, and Layer A must be reproducible from this file alone.
    """
    cards = list(hole) + list(board)
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
        u = sorted(set(ranks))
        for i in range(len(u)):
            window = [r for r in u if u[i] <= r <= u[i] + 4]
            if len(window) >= 4:
                return "draw"

    if mult[0] == 2:
        return "pair"
    return "air"


# ---------------------------------------------------------------------------
# LAYER A — board combinatorics. No player data. Does not age.
# ---------------------------------------------------------------------------

def nut_category(board):
    """Highest 5-card category ANY two hole cards could make on this board.

    This is the 'nut identity' the concept is named for. It is a pure function of
    the board, so it is deterministic, uncensored, and permanently true.

    The ladder is ordered by hand strength, so the first hit wins:
      straight_flush > quads > full_house > flush > straight > trips
    Trips is the floor: on any unpaired board a pocket pair makes a set.
    """
    ranks = [c[0] for c in board]
    suits = [c[1] for c in board]
    rank_freq = Counter(ranks)
    suit_freq = Counter(suits)
    max_rank_freq = max(rank_freq.values())
    top_suit, max_suit_freq = suit_freq.most_common(1)[0]

    def straight_possible(rs):
        """3+ of these ranks inside one 5-wide window (wheel aware)."""
        u = set(rs)
        if 14 in u:
            u = u | {1}
        return any(sum(1 for r in range(low, low + 5) if r in u) >= 3
                   for low in range(1, 11))

    if max_suit_freq >= 3:
        suited_ranks = [r for r, s in board if s == top_suit]
        if straight_possible(suited_ranks):
            return "straight_flush"
    if max_rank_freq >= 2:
        # A board pair means a pocket pair of that rank makes quads.
        return "quads"
    if max_suit_freq >= 3:
        return "flush"
    if straight_possible(ranks):
        return "straight"
    return "trips"


def classify_turn_card(flop, turn_card):
    """Which structural change did this turn card make? Mutually exclusive.

    Precedence flush > straight > pair is arbitrary where a card does two things at
    once (e.g. pairing the board with the third card of a suit). Overlaps are rare
    but real, so they are counted separately and reported rather than hidden.
    """
    turn_board = list(flop) + [turn_card]
    flop_suits = Counter(s for _, s in flop)
    turn_suits = Counter(s for _, s in turn_board)
    flop_ranks = [r for r, _ in flop]

    # Flush becomes possible when the board reaches 3 of a suit (3 board + 2 hole).
    # Also fires 3->4, which changes the nuts from a 2-card to a 1-card flush.
    flush_completing = (max(turn_suits.values()) >= 3
                        and max(turn_suits.values()) > max(flop_suits.values()))

    def straight_possible(rs):
        u = set(rs)
        if 14 in u:
            u = u | {1}
        return any(sum(1 for r in range(low, low + 5) if r in u) >= 3
                   for low in range(1, 11))

    # This is the J-T-x + 9 case the ticket calls out: the existing isScary test
    # sees a card that neither paired the board nor brought a third suit, while the
    # nuts moved from a set to a straight.
    straight_completing = (straight_possible([r for r, _ in turn_board])
                           and not straight_possible(flop_ranks))

    board_pairing = turn_card[0] in set(flop_ranks)

    flags = {
        "flush_completing": flush_completing,
        "straight_completing": straight_completing,
        "board_pairing": board_pairing,
    }
    hits = [k for k, v in flags.items() if v]
    primary = hits[0] if len(hits) == 1 else (
        "flush_completing" if flush_completing else
        "straight_completing" if straight_completing else
        "board_pairing" if board_pairing else "blank")
    return primary, flags, len(hits) > 1


def range_metrics(board, combos):
    """Strength summary of a declared range on one board.

    Returns the full 4-class split (the same presentation as Finding 12's
    terminal-strength table) plus the three scalars in METRICS. See the METRICS
    comment for why three and why `strong` leads.
    """
    dead = set(board)
    split = {c: 0 for c in CLASSES}
    total = 0
    for combo in combos:
        if combo[0] in dead or combo[1] in dead:
            continue
        split[classify(combo, board)] += 1
        total += 1
    if total == 0:
        return None
    shares = {c: split[c] / total for c in CLASSES}
    return {
        "n": total,
        "shares": shares,
        "strong": shares["strong"],
        "made": shares["pair"] + shares["strong"],
        "continuing": 1.0 - shares["air"],
    }


def layer_a_for_board(flop, turn_card, denom):
    """Combinatorial movement caused by exactly this turn card.

    Returns the CHANGE in each metric. Positive means the card gave the range more;
    negative means it took strength away. Pure card math — no player data, no
    sampling error, and it does not age.
    """
    combos = denominator_combos(denom)
    turn_board = list(flop) + [turn_card]
    a_flop = range_metrics(flop, combos)
    a_turn = range_metrics(turn_board, combos)
    if a_flop is None or a_turn is None:
        return None
    return {
        "deltas": {mt: a_turn[mt] - a_flop[mt] for mt in METRICS},
        "flop": {mt: a_flop[mt] for mt in METRICS},
        "turn": {mt: a_turn[mt] for mt in METRICS},
        "flop_shares": a_flop["shares"],
        "turn_shares": a_turn["shares"],
        "nut_before": nut_category(flop),
        "nut_after": nut_category(turn_board),
    }


# ---------------------------------------------------------------------------
# LAYER B — corpus mining. Measured, era-fragile.
# ---------------------------------------------------------------------------

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


def board_key(flop, turn_card):
    """Order-independent, process-stable key. Python's hash() is salted per
    process, so sampling must not depend on it."""
    f = "".join(sorted("%s%s" % (VAL_RANK[r], s) for r, s in flop))
    return "%s|%s%s" % (f, VAL_RANK[turn_card[0]], turn_card[1])


def extract_spot(hand):
    """Return (turn_class, decision, flop, turn_card, overlapped) or None.

    Returns None for every hand that is not the exact spot — no partial credit, and
    no silent widening of the population.
    """
    if hand.get("variant") != "NT":
        return None
    actions, blinds, players = hand.get("actions"), hand.get("blinds"), hand.get("players")
    if not actions or not blinds or not players:
        return None
    n = len(players)
    if n < 2:
        return None

    committed = list(blinds) + [0.0] * (n - len(blinds))
    committed = committed[:n]
    current_bet = max(blinds) if blinds else 0.0
    street = 0
    board = []
    flop_snapshot = None
    turn_card = None

    last_pf_raiser = None
    flop_bettor = None
    flop_callers = []
    flop_raised = False
    turn_bet_by = None
    villain = None
    decision = None

    for tok in actions:
        parts = tok.split()
        if parts[0] == "d":
            if parts[1] == "db":
                dealt = parse_cards(parts[2])
                board.extend(dealt)
                if len(board) == 3:
                    street, flop_snapshot = 1, list(board)
                elif len(board) == 4:
                    street, turn_card = 2, dealt[0]
                    # The flop betting round is closed, so the caller is now fixed.
                    if len(flop_callers) == 1:
                        villain = flop_callers[0]
                elif len(board) == 5:
                    street = 3
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
            continue

        if street == 3:
            break  # spot is decided on the turn; the river cannot change it

        if verb == "f":
            if street == 2 and turn_bet_by is not None and p == villain:
                decision = "fold"
                break
            continue

        if verb == "cc":
            owed = current_bet - committed[p]
            if owed > 1e-9:
                committed[p] = current_bet
                if street == 1 and flop_bettor is not None and p != flop_bettor:
                    flop_callers.append(p)
                elif street == 2 and turn_bet_by is not None and p == villain:
                    decision = "call"
                    break
            continue

        if verb == "cbr":
            amount = float(parts[2])
            if street == 0:
                last_pf_raiser = p
            elif street == 1:
                if current_bet <= 1e-9 and flop_bettor is None:
                    flop_bettor = p
                else:
                    flop_raised = True  # raised flop is a different animal
            elif street == 2:
                if turn_bet_by is None and current_bet <= 1e-9:
                    if p != flop_bettor:
                        return None      # donk bet — villain is not facing a bet
                    turn_bet_by = p
                elif turn_bet_by is not None and p == villain:
                    decision = "raise"
                    break
            committed[p] = amount
            current_bet = amount
            continue

    # The spot, in full. Every clause is required.
    if flop_raised or flop_bettor is None or flop_bettor != last_pf_raiser:
        return None
    if len(flop_callers) != 1:           # heads-up only; multiway differs
        return None
    if turn_bet_by is None or decision is None:
        return None
    if flop_snapshot is None or turn_card is None:
        return None

    primary, _flags, overlapped = classify_turn_card(flop_snapshot, turn_card)
    return primary, decision, flop_snapshot, turn_card, overlapped


def new_acc():
    return {
        "counts": {c: {d: 0 for d in DECISIONS} for c in TURN_CLASSES},
        "overlaps": {c: 0 for c in TURN_CLASSES},
        "boards": defaultdict(Counter),   # class -> Counter[board_key]
    }


def merge_acc(dst, src):
    for c in TURN_CLASSES:
        for d in DECISIONS:
            dst["counts"][c][d] += src["counts"][c][d]
        dst["overlaps"][c] += src["overlaps"][c]
        dst["boards"][c].update(src["boards"][c])


SAMPLE_MOD = 97  # ~1% deterministic board sample for Layer A; see --sample-mod


def mine_file(args):
    path, sample_mod = args
    acc = new_acc()
    try:
        for hand in iter_hands(path):
            try:
                spot = extract_spot(hand)
            except Exception:
                continue
            if not spot:
                continue
            cls, decision, flop, turn_card, overlapped = spot
            acc["counts"][cls][decision] += 1
            if overlapped:
                acc["overlaps"][cls] += 1
            key = board_key(flop, turn_card)
            # Deterministic hash-based sample: independent of file order, stable
            # across processes, and reproducible across runs.
            if zlib.crc32(key.encode()) % sample_mod == 0:
                acc["boards"][cls][key] += 1
    except Exception as e:
        sys.stderr.write("file error %s: %s\n" % (path, e))
    return acc


def decode_board_key(key):
    f, t = key.split("|")
    return parse_cards(f), parse_cards(t)[0]


def layer_a_worker(job):
    """Pool entry point. Layer A costs ~17ms per board (1326 combos x 2 boards x
    classify), so at the default cap this is ~30 min single-threaded — it has to be
    parallelised or the gate looks hung after the mining pass finishes."""
    key, denom = job
    flop, turn_card = decode_board_key(key)
    return (key, denom), layer_a_for_board(flop, turn_card, denom)


def plan_layer_a(acc, denoms, cap):
    """Build the (board, denominator) work list and the per-cell board samples.

    `most_common(cap)` is a deterministic truncation. Specific 4-card boards recur
    at near-uniform low frequency in a real corpus, so this is close to arbitrary
    selection rather than a meaningful bias — but it IS a truncation, and the
    reported distinct_boards makes it visible rather than silent.
    """
    plan, jobs = {}, set()
    for d in denoms:
        for c in TURN_CLASSES:
            items = acc["boards"][c].most_common(cap)
            plan[(d, c)] = items
            for key, _w in items:
                jobs.add((key, d))
    return sorted(jobs), plan


def compute_layer_a(items, results, denom):
    """Weighted mean combinatorial delta over the sampled boards of one class.

    Weighted by observed frequency so the mean reflects the SPOT population, not the
    set of distinct boards. Returns None when the sample is too thin to mean
    anything rather than reporting a number built on nothing.
    """
    total_w = 0
    acc_delta = {mt: 0.0 for mt in METRICS}
    acc_sq = {mt: 0.0 for mt in METRICS}
    nut_changed_w = 0
    for key, w in items:
        la = results.get((key, denom))
        if la is None:
            continue
        for mt in METRICS:
            d = la["deltas"][mt]
            acc_delta[mt] += d * w
            acc_sq[mt] += (d * d) * w
        if la["nut_before"] != la["nut_after"]:
            nut_changed_w += w
        total_w += w
    if total_w < 30:
        return None
    out = {"distinct_boards": len(items), "weighted_n": total_w,
           "nut_changed_share": nut_changed_w / total_w, "metrics": {}}
    for mt in METRICS:
        mean = acc_delta[mt] / total_w
        var = max(0.0, acc_sq[mt] / total_w - mean * mean)
        out["metrics"][mt] = {
            "mean_delta": mean,
            "sd": var ** 0.5,
            "se": (var / total_w) ** 0.5,
        }
    return out


def wilson(k, n):
    """95% Wilson interval. Normal approximation is unsafe in the thin cells."""
    if n == 0:
        return (0.0, 0.0)
    z = 1.959963985
    p = k / n
    d = 1 + z * z / n
    c = (p + z * z / (2 * n)) / d
    m = z * ((p * (1 - p) / n + z * z / (4 * n * n)) ** 0.5) / d
    return (max(0.0, c - m), min(1.0, c + m))


# ---------------------------------------------------------------------------
# Reporting
# ---------------------------------------------------------------------------

def build_report(acc, denoms, cap, results, plan):
    layer_b = {}
    for c in TURN_CLASSES:
        cell = acc["counts"][c]
        n = sum(cell.values())
        k = cell["call"] + cell["raise"]
        lo, hi = wilson(k, n)
        layer_b[c] = {
            "n": n, "k_continue": k, "counts": dict(cell),
            "continuation_rate": (k / n) if n else None,
            "ci95": [lo, hi],
            "overlapping_class_n": acc["overlaps"][c],
        }

    layer_a = {d: {c: compute_layer_a(plan[(d, c)], results, d) for c in TURN_CLASSES}
               for d in denoms}

    deviations = {}
    for d in denoms:
        base_b = layer_b["blank"]["continuation_rate"]
        base_a = layer_a[d]["blank"]
        deviations[d] = {}
        for c in TURN_CLASSES:
            if c == "blank":
                continue
            b, a = layer_b[c]["continuation_rate"], layer_a[d][c]
            if b is None or base_b is None or a is None or base_a is None:
                deviations[d][c] = None
                continue
            b_rel = b - base_b
            per_metric = {}
            for mt in METRICS:
                a_rel = a["metrics"][mt]["mean_delta"] - base_a["metrics"][mt]["mean_delta"]
                per_metric[mt] = {
                    "combinatorial_drop_vs_blank": a_rel,
                    "deviation": b_rel - a_rel,
                    "sign": "over-fold" if b_rel - a_rel < 0 else "under-fold/sticky",
                }
            deviations[d][c] = {
                "behavioural_drop_vs_blank": b_rel,
                "by_metric": per_metric,
                # Consistent sign across all three metrics means the reading cannot
                # be blamed on the choice of strength scalar.
                "sign_consistent": len({per_metric[mt]["sign"] for mt in METRICS}) == 1,
                "primary_metric": PRIMARY_METRIC,
                "deviation": per_metric[PRIMARY_METRIC]["deviation"],
                "sign": per_metric[PRIMARY_METRIC]["sign"],
            }
    return layer_b, layer_a, deviations


def print_report(layer_b, layer_a, deviations, denoms):
    print("\nLAYER B — OBSERVED TURN CONTINUATION (uncensored; k/n per cell)")
    print("%-22s %9s %9s %9s %9s %18s" % ("turn class", "n", "continue", "fold", "rate", "95% CI"))
    for c in TURN_CLASSES:
        d = layer_b[c]
        if not d["n"]:
            print("%-22s %9d %9s %9s %9s %18s" % (c, 0, "-", "-", "-", "insufficient"))
            continue
        print("%-22s %9d %9d %9d %8.1f%% %8.1f%%-%.1f%%" % (
            c, d["n"], d["k_continue"], d["counts"]["fold"],
            d["continuation_rate"] * 100, d["ci95"][0] * 100, d["ci95"][1] * 100))

    for den in denoms:
        print("\nLAYER A — COMBINATORIAL DELTA BY METRIC  [denominator: %s]" % den)
        print("  primary metric is '%s'; see METRICS in this script for why." % PRIMARY_METRIC)
        print("%-22s %12s %12s %12s %9s %12s" % (
            "turn class", "d(strong)", "d(made)", "d(contin)", "boards", "nut changed"))
        for c in TURN_CLASSES:
            a = layer_a[den][c]
            if a is None:
                print("%-22s %12s %12s %12s %9s %12s" % (c, "-", "-", "-", "-", "insufficient"))
                continue
            m = a["metrics"]
            print("%-22s %+11.4f %+11.4f %+11.4f %9d %11.1f%%" % (
                c, m["strong"]["mean_delta"], m["made"]["mean_delta"],
                m["continuing"]["mean_delta"], a["distinct_boards"],
                a["nut_changed_share"] * 100))

        print("\nDEVIATION = behavioural drop - combinatorial drop   [denominator: %s]" % den)
        print("  negative => over-folding beyond what the card did to the range (PREDICTED)")
        print("%-22s %12s %11s %11s %11s %s" % (
            "turn class", "behav drop", "dev/strong", "dev/made", "dev/contin", "sign consistent"))
        for c in TURN_CLASSES:
            if c == "blank":
                continue
            dv = deviations[den].get(c)
            if dv is None:
                print("%-22s %12s %11s %11s %11s %s" % (c, "-", "-", "-", "-", "insufficient data"))
                continue
            bm = dv["by_metric"]
            print("%-22s %+11.4f %+10.4f %+10.4f %+10.4f  %-5s (%s)" % (
                c, dv["behavioural_drop_vs_blank"],
                bm["strong"]["deviation"], bm["made"]["deviation"],
                bm["continuing"]["deviation"],
                "YES" if dv["sign_consistent"] else "NO", dv["sign"]))

        print("\n  GATE READING [%s]: the prediction is CONFIRMED only where dev/%s < 0" % (den, PRIMARY_METRIC))
        print("  with a continuation-rate CI that excludes the blank cell. A flat or")
        print("  positive deviation is a real result — record it and stop.")


# ---------------------------------------------------------------------------
# Self-test — the instrument must be verifiable without the corpus
# ---------------------------------------------------------------------------

SELF_TEST_PHHS = """[1]
variant = 'NT'
blinds_or_straddles = [0.25, 0.50]
actions = ['d dh p1 ????', 'd dh p2 ????', 'p2 cbr 1.50', 'p1 cc', 'd db JsTd3c', 'p1 cc', 'p2 cbr 2.00', 'p1 cc', 'd db 9h', 'p1 cc', 'p2 cbr 5.00', 'p1 f']
players = ['alice', 'bob']

[2]
variant = 'NT'
blinds_or_straddles = [0.25, 0.50]
actions = ['d dh p1 ????', 'd dh p2 ????', 'p2 cbr 1.50', 'p1 cc', 'd db JsTd3c', 'p1 cc', 'p2 cbr 2.00', 'p1 cc', 'd db 2d', 'p1 cc', 'p2 cbr 5.00', 'p1 cc', 'd db 7s']
players = ['alice', 'bob']

[3]
variant = 'NT'
blinds_or_straddles = [0.25, 0.50]
actions = ['d dh p1 ????', 'd dh p2 ????', 'p2 cbr 1.50', 'p1 cc', 'd db AhKh4c', 'p1 cc', 'p2 cbr 2.00', 'p1 cc', 'd db 7h', 'p1 cc', 'p2 cbr 5.00', 'p1 cbr 15.00']
players = ['alice', 'bob']

[4]
variant = 'NT'
blinds_or_straddles = [0.25, 0.50]
actions = ['d dh p1 ????', 'd dh p2 ????', 'p2 cbr 1.50', 'p1 cc', 'd db AhKd4c', 'p1 cc', 'p2 cbr 2.00', 'p1 cc', 'd db 4s', 'p1 cc', 'p2 cbr 5.00', 'p1 f']
players = ['alice', 'bob']

[5]
variant = 'NT'
blinds_or_straddles = [0.25, 0.50]
actions = ['d dh p1 ????', 'd dh p2 ????', 'p2 cbr 1.50', 'p1 cc', 'd db AhKd4c', 'p1 cbr 2.00', 'p2 cc', 'd db 9s', 'p1 cbr 5.00', 'p2 f']
players = ['alice', 'bob']
"""


def self_test():
    """Verify the instrument end to end without the corpus.

    Hand-checked expectations, one per structural branch. If any of these drift, the
    gate's numbers cannot be trusted, so this must pass before a corpus run.
    """
    import tempfile
    failures = []
    checks = [0]

    def check(name, got, want):
        checks[0] += 1
        if got != want:
            failures.append("%s: got %r, want %r" % (name, got, want))

    # --- nut_category ladder -------------------------------------------------
    C = parse_cards
    check("nuts JsTd3c", nut_category(C("JsTd3c")), "trips")
    check("nuts JsTd3c9h", nut_category(C("JsTd3c9h")), "straight")
    check("nuts AhKh4h", nut_category(C("AhKh4h")), "flush")
    check("nuts AhKd4c4s", nut_category(C("AhKd4c4s")), "quads")
    check("nuts 5h6h7h", nut_category(C("5h6h7h")), "straight_flush")

    # --- turn-card classification -------------------------------------------
    # The ticket's headline example: 9 on J-T-x moves the nuts set -> straight,
    # while the existing isScary test sees nothing (no pair, no third suit).
    prim, flags, _ = classify_turn_card(C("JsTd3c"), C("9h")[0])
    check("JTx+9 primary", prim, "straight_completing")
    check("JTx+9 not flush", flags["flush_completing"], False)
    check("JTx+9 not pair", flags["board_pairing"], False)

    prim, _, _ = classify_turn_card(C("AhKh4c"), C("7h")[0])
    check("2-flush +3rd suit", prim, "flush_completing")
    prim, _, _ = classify_turn_card(C("AhKd4c"), C("4s")[0])
    check("board pairs", prim, "board_pairing")
    prim, _, _ = classify_turn_card(C("AhKd4c"), C("9s")[0])
    check("blank turn", prim, "blank")
    # A straight already possible on the flop is not 'completed' again by the turn.
    prim, _, _ = classify_turn_card(C("JsTd9c"), C("2h")[0])
    check("straight already live", prim, "blank")

    # --- Layer A ------------------------------------------------------------
    la = layer_a_for_board(C("JsTd3c"), C("9h")[0], "universe")
    check("JTx+9 nut before", la["nut_before"], "trips")
    check("JTx+9 nut after", la["nut_after"], "straight")
    for phase in ("flop", "turn"):
        for mt in METRICS:
            checks[0] += 1
            if not 0.0 <= la[phase][mt] <= 1.0:
                failures.append("%s/%s share out of [0,1]: %r" % (phase, mt, la[phase][mt]))

    # LOCKED-IN PROPERTY, and the reason `strong` is the primary metric. Measured
    # 2026-08-02: pairing a board opens boats and quads, straight/flush cards open
    # one new nut category, a blank opens almost nothing. If this ordering ever
    # breaks, the Layer A denominator is no longer measuring what it claims to.
    d_strong = {}
    for f, t, lbl in (("JsTd3c", "9h", "straight"), ("AhKh4c", "7h", "flush"),
                      ("AhKd4c", "4s", "pairing"), ("AhKd4c", "9s", "blank")):
        d_strong[lbl] = layer_a_for_board(C(f), C(t)[0], "universe")["deltas"]["strong"]
    checks[0] += 1
    if not (d_strong["pairing"] > d_strong["straight"] > d_strong["blank"]
            and d_strong["flush"] > d_strong["blank"]):
        failures.append("d(strong) ordering broken: %r" % d_strong)
    # The artifact this metric choice exists to dodge: `continuing` must NOT rank
    # the straight card near the pairing card. If it stops being distorted, the
    # METRICS rationale needs rewriting rather than silently drifting.
    d_cont = layer_a_for_board(C("JsTd3c"), C("9h")[0], "universe")["deltas"]["continuing"]
    checks[0] += 1
    if not d_cont > d_strong["straight"] * 2:
        failures.append("`continuing` no longer shows the draw-relabel inflation: "
                        "%.4f vs strong %.4f — revisit METRICS" % (d_cont, d_strong["straight"]))

    # Declared range must be a strict subset of the universe and non-trivial.
    n_dec = len(denominator_combos("declared"))
    n_uni = len(denominator_combos("universe"))
    check("universe combo count", n_uni, 1326)
    if not (200 < n_dec < 1326):
        failures.append("declared range size implausible: %d" % n_dec)

    # --- spot extraction ----------------------------------------------------
    with tempfile.NamedTemporaryFile("w", suffix=".phhs", delete=False,
                                     encoding="utf-8") as fh:
        fh.write(SELF_TEST_PHHS)
        tmp = fh.name
    try:
        acc = mine_file((tmp, 1))
    finally:
        os.unlink(tmp)

    check("hand1 straight fold", acc["counts"]["straight_completing"]["fold"], 1)
    check("hand2 blank call", acc["counts"]["blank"]["call"], 1)
    check("hand3 flush raise", acc["counts"]["flush_completing"]["raise"], 1)
    check("hand4 pairing fold", acc["counts"]["board_pairing"]["fold"], 1)
    # Hand 5 is a DONK bet (p1 leads the flop, not the preflop raiser) -> excluded.
    total = sum(sum(v.values()) for v in acc["counts"].values())
    check("total spots (donk excluded)", total, 4)

    # --- Wilson interval ----------------------------------------------------
    lo, hi = wilson(50, 100)
    if not (lo < 0.5 < hi and 0.39 < lo < 0.41 and 0.59 < hi < 0.61):
        failures.append("wilson(50,100) = (%.4f, %.4f), expected ~(0.40, 0.60)" % (lo, hi))
    check("wilson n=0", wilson(0, 0), (0.0, 0.0))

    if failures:
        print("SELF-TEST FAILED (%d)" % len(failures))
        for f in failures:
            print("  - %s" % f)
        return 1
    print("SELF-TEST PASSED — instrument verified (%d checks)" % checks[0])
    print("  declared range: %d combos, universe: %d combos" % (n_dec, n_uni))
    return 0


# ---------------------------------------------------------------------------

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus-root")
    ap.add_argument("--out")
    ap.add_argument("--workers", type=int, default=12)
    ap.add_argument("--stakes", default=None)
    ap.add_argument("--sample-mod", type=int, default=SAMPLE_MOD,
                    help="Layer A samples boards where crc32(board) %% N == 0. "
                         "Lower N = denser sample = slower. Default 97 (~1%%).")
    ap.add_argument("--board-cap", type=int, default=4000,
                    help="Max distinct boards per class fed to Layer A. Layer A costs "
                         "~17ms per board x denominator, so this is the knob that "
                         "decides runtime. 4000 puts the SE far below the effect size "
                         "the gate is looking for; raise it only if se is reported "
                         "large relative to the deviation.")
    ap.add_argument("--self-test", action="store_true",
                    help="Verify the instrument against synthetic hands, no corpus.")
    args = ap.parse_args()

    if args.self_test:
        sys.exit(self_test())
    if not args.corpus_root or not args.out:
        sys.exit("--corpus-root and --out are required (or use --self-test)")

    # The instrument checks itself before every corpus run. A gate that reports
    # numbers from a broken classifier is worse than a gate that fails to run.
    if self_test() != 0:
        sys.exit("self-test failed — refusing to mine")

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
        sys.exit("no .phhs files found under %s" % args.corpus_root)

    print("mining %d files for runout response..." % len(files), flush=True)
    t0 = time.time()
    merged = new_acc()
    payloads = [(f, args.sample_mod) for f in files]
    with Pool(args.workers) as pool:
        for i, res in enumerate(pool.imap_unordered(mine_file, payloads, chunksize=4)):
            merge_acc(merged, res)
            if (i + 1) % 400 == 0:
                got = sum(sum(v.values()) for v in merged["counts"].values())
                print("  %d/%d files, %d spots, %.0fs" % (
                    i + 1, len(files), got, time.time() - t0), flush=True)

    denoms = ["universe", "declared"]
    jobs, plan = plan_layer_a(merged, denoms, args.board_cap)
    print("\ncomputing Layer A over %d board x denominator pairs (~%.0f min at %d workers)..."
          % (len(jobs), len(jobs) * 0.0175 / max(1, args.workers) / 60, args.workers),
          flush=True)
    results = {}
    t1 = time.time()
    with Pool(args.workers) as pool:
        for i, (key, la) in enumerate(pool.imap_unordered(layer_a_worker, jobs, chunksize=16)):
            results[key] = la
            if (i + 1) % 5000 == 0:
                print("  %d/%d boards, %.0fs" % (i + 1, len(jobs), time.time() - t1), flush=True)

    layer_b, layer_a, deviations = build_report(merged, denoms, args.board_cap, results, plan)
    print_report(layer_b, layer_a, deviations, denoms)

    total = sum(sum(v.values()) for v in merged["counts"].values())
    payload = {
        "question": ("Do villains over-fold to nut-changing turn cards relative to "
                     "what their own range's combinatorics support?"),
        "prediction": ("On nut-changing turns, continuation drops MORE than the "
                       "combinatorial change in range strength justifies "
                       "(deviation < 0)."),
        "spot": ("Preflop raiser c-bets flop, exactly one caller, no flop raise; "
                 "same player bets turn first-in; villain's response is measured."),
        "caveat": ("HandHQ online cash, 2009 (SRC-011). The fold/call decision is "
                   "UNCENSORED — unlike shown-hand conditionals, these are the real "
                   "counts. What is unobservable is villain's HOLDING, which is why "
                   "the Layer A denominator is DECLARED and frozen in this script "
                   "rather than taken from the engine (FIND-038). Villain's true "
                   "flop-call range is STRONGER than either denominator, so both "
                   "UNDERSTATE range strength; the blank-turn reference differences "
                   "most of that away, and the residual interaction with turn class "
                   "is the main threat to validity. Layer B is era-fragile by "
                   "construction; Layer A does not age."),
        "denominators": {
            "universe": "all 1326 combos minus board cards; zero assumptions",
            "declared": "frozen BB defend range from rangeMatrix.js PREFLOP_CHARTS.BB, "
                        "copied 2026-08-02, deliberately NOT tracked",
        },
        "totalSpots": total,
        "layerB": layer_b,
        "layerA": layer_a,
        "deviations": deviations,
        "sampleMod": args.sample_mod,
        "boardCap": args.board_cap,
    }
    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=1)
    print("\nwrote %s in %.0fs (%d spots)" % (args.out, time.time() - t0, total))


if __name__ == "__main__":
    main()
