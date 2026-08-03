"""
spectrum.py — EXPLORATORY. Skew-spectral decomposition of the 169x169
all-in preflop equity matrix.

Reads equity-matrix.csv (row 0 = class labels), then:
  1. validates against published all-in equities,
  2. splits M = 0.5*J + S with S skew-symmetric,
  3. decomposes S into its canonical 2D rotation planes (= RPS cycles),
  4. reports how many planes carry the energy, and what they are made of.
"""
import sys
import numpy as np

PATH = sys.argv[1] if len(sys.argv) > 1 else "equity-matrix.csv"

with open(PATH) as fh:
    labels = fh.readline().strip().split(",")
M = np.loadtxt(PATH, delimiter=",", skiprows=1)
N = M.shape[0]
idx = {lab: i for i, lab in enumerate(labels)}

# combo multiplicity per class
def mult(lab):
    if len(lab) == 2:
        return 6
    return 4 if lab.endswith("s") else 12

n = np.array([mult(l) for l in labels], dtype=float)
freq = n / n.sum()  # 1326 total

print("=" * 68)
print("1. VALIDATION — computed vs published all-in preflop equity")
print("=" * 68)
KNOWN = [
    ("AA", "KK", 0.8154), ("AA", "AKs", 0.8757), ("AA", "72o", 0.8850),
    ("KK", "AKs", 0.6580), ("QQ", "AKs", 0.5375), ("QQ", "AKo", 0.5657),
    ("JJ", "TT", 0.8047), ("AKs", "QJs", 0.6540), ("AKo", "22", 0.4695),
    ("76s", "AA", 0.2270), ("AQo", "KJo", 0.6420), ("T9s", "AKo", 0.4110),
]
errs = []
for a, b, pub in KNOWN:
    got = M[idx[a], idx[b]]
    errs.append(abs(got - pub))
    print(f"  {a:>4} vs {b:<4}  computed {got*100:6.2f}%   published {pub*100:6.2f}%"
          f"   diff {(got-pub)*100:+5.2f} pp")
print(f"\n  mean |error| = {np.mean(errs)*100:.2f} pp   max = {np.max(errs)*100:.2f} pp")

print()
print("=" * 68)
print("2. STRUCTURE — M = 0.5*J + S")
print("=" * 68)
S = M - 0.5
print(f"  max |S + S.T|            = {np.abs(S + S.T).max():.3e}   (0 => exactly skew)")
print(f"  Frobenius norm of S      = {np.linalg.norm(S, 'fro'):.4f}")

# --- canonical skew decomposition: eigenvalues are +/- i*sigma pairs ---
# singular values of a real skew matrix come in equal pairs; each pair = one
# rotation plane (one rock-paper-scissors cycle).
U, sv, Vt = np.linalg.svd(S)
pairs = sv[::2]  # take one per pair
energy = sv**2
cum = np.cumsum(energy) / energy.sum()

print()
print("=" * 68)
print("3. CYCLE PLANES — unweighted (each hand class counts once)")
print("=" * 68)
print("  plane   magnitude   share of energy   cumulative")
for k in range(12):
    e = 2 * pairs[k] ** 2 / energy.sum()
    print(f"  {k+1:>4}    {pairs[k]:8.4f}      {e*100:6.2f}%          {cum[2*k+1]*100:6.2f}%")
for target in (0.90, 0.95, 0.99, 0.999):
    k = int(np.searchsorted(cum, target)) + 1
    print(f"  planes needed for {target*100:5.1f}% of energy: {int(np.ceil(k/2))}")

# --- frequency-weighted: ranges are distributions over 1326 combos ---
print()
print("=" * 68)
print("4. CYCLE PLANES — frequency-weighted (combo multiplicity honoured)")
print("=" * 68)
W = np.diag(np.sqrt(freq))
Sw = W @ S @ W
svw = np.linalg.svd(Sw, compute_uv=False)
pw = svw[::2]
ew = svw**2
cw = np.cumsum(ew) / ew.sum()
print("  plane   magnitude   share of energy   cumulative")
for k in range(12):
    e = 2 * pw[k] ** 2 / ew.sum()
    print(f"  {k+1:>4}    {pw[k]:8.5f}      {e*100:6.2f}%          {cw[2*k+1]*100:6.2f}%")
for target in (0.90, 0.95, 0.99, 0.999):
    k = int(np.searchsorted(cw, target)) + 1
    print(f"  planes needed for {target*100:5.1f}% of energy: {int(np.ceil(k/2))}")

# --- what are the planes made of? ---
print()
print("=" * 68)
print("5. WHAT EACH PLANE IS — top loadings (unweighted S)")
print("=" * 68)
for k in range(4):
    u = U[:, 2 * k]
    v = U[:, 2 * k + 1]
    for name, vec in (("axis A", u), ("axis B", v)):
        o = np.argsort(vec)
        hi = ", ".join(f"{labels[i]}" for i in o[::-1][:8])
        lo = ", ".join(f"{labels[i]}" for i in o[:8])
        print(f"  plane {k+1} {name}:  + [{hi}]")
        print(f"  {'':13}  - [{lo}]")
    print()

# --- is plane 1 just transitive strength? ---
print("=" * 68)
print("6. IS PLANE 1 JUST 'STRENGTH'?  (a purely transitive game is rank 2)")
print("=" * 68)
strength = M @ freq              # equity of each class vs a random hand
sr = (strength - strength.mean())
sr /= np.linalg.norm(sr)
rank2 = np.outer(sr, np.ones(N)) - np.outer(np.ones(N), sr)
# best-fit scalar for the transitive model
alpha = np.sum(S * rank2) / np.sum(rank2 * rank2)
resid = S - alpha * rank2
print(f"  transitive (strength-ladder) model explains "
      f"{100*(1 - np.linalg.norm(resid,'fro')**2/np.linalg.norm(S,'fro')**2):.2f}% of S")
print(f"  residual Frobenius norm  = {np.linalg.norm(resid,'fro'):.4f}"
      f"   (vs {np.linalg.norm(S,'fro'):.4f} total)")
svr = np.linalg.svd(resid, compute_uv=False)
er = svr**2
cr = np.cumsum(er) / er.sum()
print("\n  INTRANSITIVE residual — the genuine rock-paper-scissors content:")
print("  plane   magnitude   share of residual energy   cumulative")
for k in range(10):
    print(f"  {k+1:>4}    {svr[2*k]:8.4f}      {2*svr[2*k]**2/er.sum()*100:6.2f}%"
          f"                  {cr[2*k+1]*100:6.2f}%")
for target in (0.90, 0.95, 0.99):
    k = int(np.searchsorted(cr, target)) + 1
    print(f"  planes needed for {target*100:5.1f}% of residual: {int(np.ceil(k/2))}")

Ur, svr2, _ = np.linalg.svd(resid)
print("\n  top intransitive cycle, loadings:")
for k in range(2):
    for name, vec in (("axis A", Ur[:, 2*k]), ("axis B", Ur[:, 2*k+1])):
        o = np.argsort(vec)
        hi = ", ".join(labels[i] for i in o[::-1][:8])
        lo = ", ".join(labels[i] for i in o[:8])
        print(f"    cycle {k+1} {name}:  + [{hi}]")
        print(f"    {'':15}  - [{lo}]")
