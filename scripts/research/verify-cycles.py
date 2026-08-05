"""
verify-cycles.py — falsification harness for the skew decomposition.

    python scripts/research/verify-cycles.py equity-matrix.csv [equity-matrix-B.csv]

The decomposition claims the intransitive residual is organised into rotation planes, and that
those planes correspond to real cycles. This script tries to break that claim in the RAW matrix,
where no decomposition can hide.

Three sections:

  A. CONFIRMED CYCLES. Genuine rock-paper-scissors triples in the raw matrix. If these do not
     exist, "intransitivity" is a word about an artefact of the arithmetic.

  B. THE RECORDED FAILED LOCATOR. A heuristic that does NOT work, kept here so it is not
     re-proposed: that classes ~120 degrees apart in the top RESIDUAL plane form raw-matrix
     triples. It finds none, and it is invalid BY CONSTRUCTION — it uses residual angles to
     predict cycles in the raw matrix while the transitive component, 74% of the structure, is
     added back in and swamps them. The rotation-plane decomposition is untouched by this: that
     is a theorem about skew matrices. It is the LOCATOR that is wrong.

  C. THE INTRANSITIVITY MAP, with its spread stated. The ranking is real; the spread is 1.6x, so
     it does not license a partition of the grid into "cyclic" and "ladder" regions.

The mathematics lives in spectrum.py — in particular the transitive/intransitive split is the
exact orthogonal projection there, not a fitted scalar. Duplicating it here is how the two files
would come to disagree.
"""
import sys

import numpy as np

from spectrum import (
    asymmetry_residual,
    hodge_split,
    intransitivity_map,
    load,
    multiplicity,
    planes,
    reconstruction_table,
)


def main():
    paths = [a for a in sys.argv[1:] if not a.startswith("--")] or ["equity-matrix.csv"]
    labels, M, _, _ = load(paths[0])
    if len(paths) > 1:
        labels_B, M_B, _, _ = load(paths[1])
        if labels_B != labels:
            raise SystemExit("the two matrices do not share a label order")
        M = 0.5 * (M + M_B)

    N = len(labels)
    w = np.array([multiplicity(l) for l in labels], float)
    w /= w.sum()

    res = asymmetry_residual(M)
    print(f"premise: max |M + M^T - 1| = {res:.3e}")
    if res >= 1e-12:
        raise SystemExit("the operator is not antisymmetric; nothing below is meaningful")

    S = M - 0.5
    _, _, R = hodge_split(S, w)

    print()
    print("=" * 72)
    print("A. CONFIRMED CYCLES IN THE RAW MATRIX")
    print("=" * 72)
    # Search among the classes carrying the most cyclic magnitude — the map says that is where
    # a cycle can exist at all, so it is the honest place to look.
    imap = intransitivity_map(R, w)
    top = np.argsort(imap)[::-1][:45]
    found = []
    for a in top:
        for b in top:
            for c in top:
                if a < b < c:
                    for (x, y, z) in ((a, b, c), (a, c, b)):
                        if M[x, y] > 0.5 and M[y, z] > 0.5 and M[z, x] > 0.5:
                            found.append((min(M[x, y], M[y, z], M[z, x]), x, y, z))
    found.sort(reverse=True)
    seen, shown = set(), 0
    for _, x, y, z in found:
        key = frozenset((x, y, z))
        if key in seen:
            continue
        seen.add(key)
        print(f"  {labels[x]:>4} > {labels[y]:>4} ({M[x,y]*100:5.2f}%)   "
              f"{labels[y]:>4} > {labels[z]:>4} ({M[y,z]*100:5.2f}%)   "
              f"{labels[z]:>4} > {labels[x]:>4} ({M[z,x]*100:5.2f}%)")
        shown += 1
        if shown >= 6:
            break
    if not found:
        print("  NONE. The operator would then be a ladder in disguise — report this, loudly.")

    print()
    print("=" * 72)
    print("B. THE RECORDED FAILED LOCATOR — 120-degree spacing in the top residual plane")
    print("=" * 72)
    _, U_R, _, _, _ = planes(R, w)
    r = np.sqrt(w)
    u, v = U_R[:, 0] / r, U_R[:, 1] / r
    ang = np.degrees(np.arctan2(v, u)) % 360
    rad = np.hypot(u, v)

    hits = 0
    for off in range(0, 120, 2):
        picks = []
        for t in (off, off + 120, off + 240):
            d = np.abs((ang - t + 180) % 360 - 180)
            cand = np.where(d < 22)[0]
            if len(cand) == 0:
                picks = None
                break
            picks.append(cand[np.argmax(rad[cand])])
        if not picks or len(set(picks)) < 3:
            continue
        a, b, c = picks
        if min(M[a, b], M[b, c], M[c, a]) > 0.5:
            hits += 1
            print(f"  UNEXPECTED HIT at offset {off}: {labels[a]} > {labels[b]} > {labels[c]}")
    if hits == 0:
        print("  0 triples, as recorded. The heuristic is invalid BY CONSTRUCTION: residual")
        print("  angles cannot predict raw-matrix cycles while the transitive component (74%)")
        print("  is added back in. Do not re-propose it. A valid locator searches the RESIDUAL")
        print("  operator, where the cycles actually live.")
    else:
        print(f"  {hits} hits — this contradicts the recorded result. Investigate before quoting.")

    print()
    print("=" * 72)
    print("C. RECONSTRUCTION, AND THE SPREAD OF THE INTRANSITIVITY MAP")
    print("=" * 72)
    sigma, U, _, _, Sw = planes(S, w)
    print("  planes  coords   mean |err|   90th pct    max |err|      (percentage points)")
    for row in reconstruction_table(S, Sw, U, w, (1, 3, 6, 13, 20)):
        print(f"  {row['planes']:>6}  {row['coordinatesPerClass']:>6}   {row['meanAbsPP']:9.3f}   "
              f"{row['p90PP']:8.3f}   {row['maxPP']:9.3f}")
    print("  The MAX column is the one a sufficiency claim has to answer to.")

    lo, hi = float(imap.min()), float(imap.max())
    o = np.argsort(imap)[::-1]
    print(f"\n  map spread: {lo:.3f} - {hi:.3f} pp, ratio {hi/lo:.2f}x")
    print(f"  most cyclic:  {', '.join(labels[i] for i in o[:12])}")
    print(f"  least cyclic: {', '.join(labels[i] for i in o[::-1][:12])}")
    print("  A 1.6x spread licenses a RANKING. It does not license a partition of the grid")
    print("  into cyclic and ladder regions, and the least cyclic hand in the deck still")
    print(f"  carries {100*lo/hi:.0f}% of the most cyclic hand's cyclic magnitude.")


if __name__ == "__main__":
    main()
