"""
verify-cycles.py — falsification check on the skew decomposition.

The decomposition CLAIMS the intransitive residual is organised into rotation
planes. If true, then within the top plane, hand classes separated by ~120 deg
of angle must form genuine rock-paper-scissors triples in the RAW matrix.
This script goes and looks. If no triple shows up, the interpretation is wrong.

Also reports reconstruction error: how accurately can k planes reproduce every
class-vs-class equity?
"""
import sys
import numpy as np

PATH = sys.argv[1] if len(sys.argv) > 1 else "equity-matrix.csv"
with open(PATH) as fh:
    labels = fh.readline().strip().split(",")
M = np.loadtxt(PATH, delimiter=",", skiprows=1)
N = len(labels)
idx = {l: i for i, l in enumerate(labels)}
S = M - 0.5


def mult(l):
    return 6 if len(l) == 2 else (4 if l.endswith("s") else 12)


freq = np.array([mult(l) for l in labels], float)
freq /= freq.sum()

# ---------- reconstruction error vs number of planes ----------
print("=" * 70)
print("A. RECONSTRUCTION — can k planes reproduce real equities?")
print("=" * 70)
U, sv, Vt = np.linalg.svd(S)
print("  planes   mean |err|   90th pct   max |err|      (percentage points)")
for k in (1, 2, 3, 4, 5, 6, 8, 10, 13, 20):
    approx = (U[:, :2 * k] * sv[:2 * k]) @ Vt[:2 * k, :]
    err = np.abs(approx - S) * 100
    # weight by how often the matchup actually occurs
    w = np.outer(freq, freq)
    mean_w = (err * w).sum() / w.sum()
    print(f"  {k:>5}    {mean_w:8.3f}    {np.percentile(err,90):8.3f}   {err.max():8.3f}")

# ---------- transitive / intransitive split ----------
strength = M @ freq
sr = strength - strength.mean()
sr /= np.linalg.norm(sr)
rank2 = np.outer(sr, np.ones(N)) - np.outer(np.ones(N), sr)
alpha = np.sum(S * rank2) / np.sum(rank2 * rank2)
R = S - alpha * rank2

print()
print("=" * 70)
print("B. THE PREDICTED CYCLE — top intransitive plane")
print("=" * 70)
Ur, svr, _ = np.linalg.svd(R)
u, v = Ur[:, 0], Ur[:, 1]
ang = np.degrees(np.arctan2(v, u)) % 360
rad = np.hypot(u, v)

# pick the strongest-loading class near each of three angles 120 deg apart,
# scanning the starting offset for the cleanest triple in the RAW matrix.
best = None
for off in range(0, 120, 2):
    picks = []
    for t in (off, off + 120, off + 240):
        d = np.abs((ang - t + 180) % 360 - 180)
        cand = np.where(d < 22)[0]
        if len(cand) == 0:
            picks = None
            break
        picks.append(cand[np.argmax(rad[cand])])
    if not picks:
        continue
    a, b, c = picks
    if len({a, b, c}) < 3:
        continue
    e = (M[a, b], M[b, c], M[c, a])
    if min(e) > 0.5:                       # a genuine cycle in the RAW data
        score = min(e)
        if best is None or score > best[0]:
            best = (score, a, b, c, e)

if best:
    _, a, b, c, e = best
    print("  Cycle found in the RAW equity matrix (not the model):")
    print(f"    {labels[a]:>4} beats {labels[b]:<4}  {e[0]*100:5.2f}%")
    print(f"    {labels[b]:>4} beats {labels[c]:<4}  {e[1]*100:5.2f}%")
    print(f"    {labels[c]:>4} beats {labels[a]:<4}  {e[2]*100:5.2f}%")
    print(f"  -> intransitive triple confirmed, weakest link {min(e)*100:.2f}%")
else:
    print("  NO intransitive triple found at 120-degree spacing.")
    print("  -> the rotation-plane interpretation is NOT supported.")

# strongest cycle anywhere in the top plane, by raw-matrix margin
print()
print("  Strongest raw intransitive triples among high-loading classes:")
top = np.argsort(rad)[::-1][:45]
found = []
for i in top:
    for j in top:
        for k in top:
            if i < j and j < k:
                for (x, y, z) in ((i, j, k), (i, k, j)):
                    if M[x, y] > 0.5 and M[y, z] > 0.5 and M[z, x] > 0.5:
                        found.append((min(M[x, y], M[y, z], M[z, x]), x, y, z))
found.sort(reverse=True)
seen = set()
shown = 0
for m, x, y, z in found:
    key = frozenset((x, y, z))
    if key in seen:
        continue
    seen.add(key)
    print(f"    {labels[x]:>4} > {labels[y]:>4} ({M[x,y]*100:5.2f}%)   "
          f"{labels[y]:>4} > {labels[z]:>4} ({M[y,z]*100:5.2f}%)   "
          f"{labels[z]:>4} > {labels[x]:>4} ({M[z,x]*100:5.2f}%)")
    shown += 1
    if shown >= 6:
        break
if not found:
    print("    none")

# ---------- how much of the game is transitive, per class ----------
print()
print("=" * 70)
print("C. WHERE THE INTRANSITIVITY LIVES — residual magnitude by hand class")
print("=" * 70)
rowmag = np.linalg.norm(R, axis=1)
o = np.argsort(rowmag)[::-1]
print("  MOST cyclic (equity least predicted by a strength ladder):")
print("   ", ", ".join(f"{labels[i]}" for i in o[:16]))
print("  LEAST cyclic (a pure strength ladder describes them well):")
print("   ", ", ".join(f"{labels[i]}" for i in o[::-1][:16]))
