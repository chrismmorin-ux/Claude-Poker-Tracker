"""
analyze_records.py — conditional / paired analysis over per-decision records.

The scorecard answers MARGINAL questions (lift by street, OR by sprZone). This
answers the two it cannot:

  1. PAIRED-ON-DIVERGENT — when comparing two hierarchy arms, restrict to the
     decisions that actually ROUTE DIFFERENTLY. Decisions that route identically
     contribute exactly zero to the difference but are counted in the aggregate
     denominator, diluting the effect by the identical:divergent ratio.
  2. ABLATION — per-dimension information content, ONLY_<dim> (informative alone)
     and DROP_<dim> (irreplaceable), each against the ctrl:full / ctrl:none
     bracket so the numbers are a fraction of something.

Usage:  python scripts/backtest/analyze_records.py out/records.json
"""
import json, math, sys
from collections import defaultdict

EPS = 1e-12


def logloss(p, actual):
    return -math.log(max(p.get(actual, 0.0), EPS))


def summarize(recs, idx=None):
    """Mean model log-loss and baseline log-loss over an index subset."""
    idx = range(len(recs)) if idx is None else idx
    n = 0
    ml = bl = 0.0
    hits = 0
    for i in idx:
        r = recs[i]
        a = r["a"]
        ml += logloss(r["p"], a)
        bl += logloss(r["b"], a)
        pred = max(r["p"].items(), key=lambda kv: kv[1])[0] if r["p"] else None
        hits += 1 if pred == a else 0
        n += 1
    if n == 0:
        return None
    return {
        "n": n,
        "logLoss": ml / n,
        "baseLogLoss": bl / n,
        "lift": (bl - ml) / bl if bl else 0.0,
        "accuracy": hits / n,
    }


def paired_delta(a_recs, b_recs, idx):
    """Per-decision paired log-loss delta (b - a) with a bootstrap CI + sign test."""
    d = []
    for i in idx:
        act = a_recs[i]["a"]
        d.append(logloss(b_recs[i]["p"], act) - logloss(a_recs[i]["p"], act))
    n = len(d)
    if n == 0:
        return None
    mean = sum(d) / n
    var = sum((x - mean) ** 2 for x in d) / (n - 1) if n > 1 else 0.0
    se = math.sqrt(var / n) if n else 0.0
    wins = sum(1 for x in d if x < -1e-12)    # b better
    losses = sum(1 for x in d if x > 1e-12)   # a better
    return {
        "n": n,
        "meanDelta": mean,
        "se": se,
        "ci95": (mean - 1.96 * se, mean + 1.96 * se),
        "tStat": (mean / se) if se > 0 else 0.0,
        "bBetter": wins,
        "aBetter": losses,
        "ties": n - wins - losses,
    }


def main(path):
    blob = json.load(open(path))
    arms = blob["recordsByArm"]
    names = list(arms.keys())
    n = len(next(iter(arms.values())))
    print(f"arms: {len(names)}   decisions/arm: {n}")
    print("HandHQ online cash, July 2009, 50NL. Live generalisation unproven.\n")

    # ---------- 0. BAKE-OFF: every arm paired against shipped ----------
    # WS-285. The ablation sections below answer "which dimensions carry
    # information". They do not answer "which candidate should ship", because that
    # needs every arm ranked on the SAME decisions against the SAME reference. A
    # candidate is only admissible if its paired CI against `shipped` excludes zero
    # — a better mean with a CI straddling zero is a coin flip, not a result.
    if "shipped" in arms and len(names) > 1:
        REF = "shipped"
        ref_recs = arms[REF]
        ref_s = summarize(ref_recs)
        print("=" * 96)
        print("0. BAKE-OFF — every arm paired against `shipped` on the same decisions")
        print("=" * 96)
        print(f"   {'arm':<26}{'logLoss':>10}{'acc':>8}{'lift':>9}"
              f"{'pairedD':>11}{'t':>9}{'95% CI':>22}   verdict")
        rows = []
        for name in names:
            if name == REF:
                continue
            s = summarize(arms[name])
            p = paired_delta(ref_recs, arms[name], range(n))
            if not s or not p:
                continue
            rows.append((name, s, p))
        # Best (most negative paired delta = biggest log-loss reduction) first.
        rows.sort(key=lambda r: r[2]["meanDelta"])

        def line(name, s, p):
            lo, hi = p["ci95"]
            if hi < 0:
                verdict = "BETTER"
            elif lo > 0:
                verdict = "WORSE"
            else:
                verdict = "n.s."
            return (f"   {name:<26}{s['logLoss']:>10.5f}{s['accuracy']*100:>7.1f}%"
                    f"{s['lift']*100:>8.2f}%{p['meanDelta']:>+11.5f}{p['tStat']:>+9.2f}"
                    f"   [{lo:+.5f},{hi:+.5f}]   {verdict}")

        for name, s, p in rows:
            print(line(name, s, p))
        print(f"   {REF+' (reference)':<26}{ref_s['logLoss']:>10.5f}"
              f"{ref_s['accuracy']*100:>7.1f}%{ref_s['lift']*100:>8.2f}%"
              f"{0.0:>+11.5f}{0.0:>+9.2f}{'':>22}   reference")

        # A candidate must also beat plain pooling, not just the shipped ladder —
        # otherwise the honest fix is to delete the hierarchy rather than reshape it.
        if "ctrl:none" in arms:
            print()
            print("   vs `ctrl:none` (pool everything by facingAction) — the delete-it baseline:")
            pool_recs = arms["ctrl:none"]
            for name, _s, _p in rows:
                if name == "ctrl:none":
                    continue
                p2 = paired_delta(pool_recs, arms[name], range(n))
                if not p2:
                    continue
                lo, hi = p2["ci95"]
                verdict = "beats pooling" if hi < 0 else ("loses to pooling" if lo > 0 else "n.s. vs pooling")
                print(f"     {name:<26}{p2['meanDelta']:>+11.5f}{p2['tStat']:>+9.2f}"
                      f"   [{lo:+.5f},{hi:+.5f}]   {verdict}")
        print()

    # ---------- 1. PAIRED-ON-DIVERGENT: shipped vs texture-last ----------
    if "shipped" in arms and "texture-last" in arms:
        A, B = arms["shipped"], arms["texture-last"]
        div = [i for i in range(n) if A[i]["src"] != B[i]["src"]]
        same = n - len(div)
        print("=" * 78)
        print("1. shipped vs texture-last — FULL SAMPLE vs DIVERGENT-ONLY")
        print("=" * 78)
        print(f"   identical routing: {same}   divergent routing: {len(div)}"
              f"   dilution factor: {n / max(len(div),1):.1f}x")
        full = paired_delta(A, B, range(n))
        sub = paired_delta(A, B, div)
        for label, r in (("full sample ", full), ("divergent   ", sub)):
            if not r:
                continue
            lo, hi = r["ci95"]
            sig = "SIGNIFICANT" if (lo > 0 or hi < 0) else "not significant"
            print(f"   {label} n={r['n']:>6}  mean d-logloss(texture-last - shipped)="
                  f"{r['meanDelta']:+.6f}  95%CI[{lo:+.6f},{hi:+.6f}]  t={r['tStat']:+.2f}  {sig}")
            print(f"                 texture-last better on {r['bBetter']}, "
                  f"shipped better on {r['aBetter']}, ties {r['ties']}")
        print()
        for label, idx in (("shipped ", None), ):
            pass
        s_all, s_div = summarize(A, div), summarize(B, div)
        if s_all and s_div:
            print(f"   on the divergent subset only:")
            print(f"     shipped      logLoss={s_all['logLoss']:.5f} lift={s_all['lift']:+.4f} acc={s_all['accuracy']:.4f}")
            print(f"     texture-last logLoss={s_div['logLoss']:.5f} lift={s_div['lift']:+.4f} acc={s_div['accuracy']:.4f}")
        print()

    # ---------- 2. ABLATION ----------
    if "ctrl:full" in arms and "ctrl:none" in arms:
        print("=" * 78)
        print("2. ABLATION — per-dimension information content")
        print("=" * 78)
        full_s = summarize(arms["ctrl:full"])
        none_s = summarize(arms["ctrl:none"])
        span = none_s["logLoss"] - full_s["logLoss"]
        print(f"   ctrl:full logLoss={full_s['logLoss']:.5f}   ctrl:none logLoss={none_s['logLoss']:.5f}"
              f"   span={span:+.5f}")
        if abs(span) < 1e-9:
            print("   span is ~0 — ablation fractions are meaningless; report raw numbers only.")
        print(f"   {'dim':<14}{'ONLY logLoss':>14}{'alone%':>9}{'DROP logLoss':>14}{'irreplace%':>12}")
        dims = sorted({a[5:] for a in names if a.startswith("only:")})
        for d in dims:
            o = summarize(arms.get(f"only:{d}", []))
            dr = summarize(arms.get(f"drop:{d}", []))
            if not o or not dr:
                continue
            alone = (none_s["logLoss"] - o["logLoss"]) / span if abs(span) > 1e-9 else float("nan")
            irrep = (dr["logLoss"] - full_s["logLoss"]) / span if abs(span) > 1e-9 else float("nan")
            print(f"   {d:<14}{o['logLoss']:>14.5f}{alone*100:>8.1f}%{dr['logLoss']:>14.5f}{irrep*100:>11.1f}%")
        print()

    # ---------- 3. INTERACTIONS on the shipped arm ----------
    base = arms.get("shipped") or arms[names[0]]
    print("=" * 78)
    print("3. INTERACTIONS — two-way conditional lift (shipped arm)")
    print("=" * 78)
    pairs = [("facingAction", "sprZone"), ("facingAction", "obsBucket"),
             ("facingAction", "street"), ("facingAction", "playersInPot")]
    for k1, k2 in pairs:
        cells = defaultdict(list)
        for i, r in enumerate(base):
            s = r["s"] or {}
            if k1 in s and k2 in s:
                cells[(s[k1], s[k2])].append(i)
        rows = []
        for key, idx in cells.items():
            if len(idx) < 100:
                continue
            st = summarize(base, idx)
            rows.append((key, st))
        if not rows:
            continue
        rows.sort(key=lambda kv: kv[1]["lift"])
        print(f"\n   {k1} x {k2}   (cells with n>=100, worst lift first)")
        print(f"   {'cell':<34}{'n':>7}{'logLoss':>10}{'lift':>9}{'acc':>8}")
        for key, st in rows:
            label = f"{key[0]} x {key[1]}"
            print(f"   {label:<34}{st['n']:>7}{st['logLoss']:>10.4f}{st['lift']*100:>8.2f}%{st['accuracy']*100:>7.1f}%")
    print()


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "out/records.json")
