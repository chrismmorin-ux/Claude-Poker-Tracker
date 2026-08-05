"""
spectrum.py — the canonical skew decomposition of the preflop equity operator.

    python scripts/research/spectrum.py equity-matrix.csv [equity-matrix-B.csv]
                                        [--emit-artifact PATH] [--planes K]

Reads one or two equity-matrix CSVs (row 0 = class labels, produced by
build-equity-matrix.mjs) and produces the four invariants of the operator:

    1. the antisymmetry residual                    max |M + M^T - 1|
    2. the transitive / intransitive split          exact orthogonal (Hodge) projection
    3. the rotation-plane spectrum                  sigma_1 >= sigma_2 >= ... , 84 planes
    4. the intransitivity map                       per-hand-class cyclic magnitude

Give it TWO matrices built from independent seeds and it additionally derives the
SAMPLING-NOISE FLOOR, which is what turns "significant plane" from a taste
judgement into a measurement. See NOISE FLOOR below.

------------------------------------------------------------------------------
WHY THE MATHEMATICS IS WHAT IT IS. Read this before changing anything here.

E(a,b) + E(b,a) = 1 exactly, so S = M - 1/2 is exactly skew-symmetric. Three
consequences, none of them modelling choices:

  * S has no real eigen-axes. There is no such thing as a "principal hand class"
    of this operator. Reporting eigenvectors of S as if they were principal
    components is a category error.
  * S decomposes canonically into 2D ROTATION PLANES (Youla / real Schur form),
    each with a magnitude sigma_k. A rotation in range space is a cycle. Each
    plane is one rock-paper-scissors structure with a size attached.
  * dim 169 is ODD, so S has at least one zero eigenvalue: at most 84 planes.

DO NOT SYMMETRISE. (S + S^T)/2 is identically zero — symmetrising this operator
destroys 100% of its content, not some of it.

FORMING -S^2 = S^T S IS NOT SYMMETRISING. It is the Gram operator. Its
eigenvalues are the sigma_k^2, each twice, and its eigenspaces ARE S's invariant
planes. That is the standard route to the Youla form, and it is what
`numpy.linalg.svd` does internally. The distinction matters and is easy to lose.

WITHIN A PLANE, THE AXES ARE ARBITRARY. If (u, v) spans plane k then so does any
rotation of them. The invariants of a plane are (a) its magnitude sigma_k and
(b) each class's RADIUS in it, sqrt(u_i^2 + v_i^2). A table of "plane k axis A
top loadings" is a table of a basis choice, not of the operator. This script does
not print one; the earlier exploratory version of this file did, and that was
wrong.

THE TRANSITIVE / INTRANSITIVE SPLIT IS A PROJECTION, NOT A FIT. A game is
transitive exactly when S_ij = f_i - f_j for some potential f. Those matrices
form a linear subspace of dimension N-1, so the transitive part of S is the
ORTHOGONAL PROJECTION onto that subspace, and the split obeys Pythagoras:
||S||^2 = ||T||^2 + ||R||^2, with R orthogonal to every transitive matrix.

Solving the least-squares problem in the combo-frequency inner product
<A,B>_w = sum_ij w_i w_j A_ij B_ij gives, with no free parameter,

        f = S w   =   (equity vs a random hand) - 1/2.

So the strength ladder is not a model to be fitted with a scalar; it is a
projection whose potential is exactly the average-equity vector. The earlier
exploratory version fitted a scalar alpha to a UNIT-NORMALISED strength vector
under the UNWEIGHTED inner product — mixing two metrics — which is why its split
was not orthogonal and its shares did not have to sum to one.

NOISE FLOOR. The operator is estimated from sampled boards, so small planes are
indistinguishable from sampling noise. Given S_A and S_B from independent seeds:

        Sbar = (S_A + S_B)/2        signal, at 2x the boards
        D    = (S_A - S_B)/2        pure noise, with the SAME noise variance

Both carry noise of variance var/2, so D is a statistically exact noise replica
of Sbar. sigma_1(D) is therefore the level below which a plane of Sbar cannot be
distinguished from board sampling. That is the threshold this script reports, and
it is measured rather than chosen.
------------------------------------------------------------------------------
"""
import hashlib
import json
import subprocess
import sys

import numpy as np

ARTIFACT_VERSION = 1


# ---------------------------------------------------------------- loading ---

def load(path):
    with open(path) as fh:
        labels = fh.readline().strip().split(",")
    M = np.loadtxt(path, delimiter=",", skiprows=1)
    if M.shape != (len(labels), len(labels)):
        raise SystemExit(f"{path}: expected square matrix over {len(labels)} labels")
    with open(path, "rb") as fh:
        digest = "sha256:" + hashlib.sha256(fh.read()).hexdigest()
    # The sidecar carries the seed and board count the CSV was ACTUALLY built with. Taking them
    # from a flag here would let the recorded provenance and the file disagree silently.
    try:
        with open(path + ".meta.json") as fh:
            meta = json.load(fh)
    except FileNotFoundError:
        meta = None
    return labels, M, digest, meta


def multiplicity(label):
    """Combos per 169-grid class: 6 pairs, 4 suited, 12 offsuit."""
    if len(label) == 2:
        return 6
    return 4 if label.endswith("s") else 12


def asymmetry_residual(M):
    """max |M[i][j] + M[j][i] - 1|. Zero to machine precision, or the premise is false."""
    return float(np.abs(M + M.T - 1.0).max())


# ------------------------------------------------------- the decomposition ---

def hodge_split(S, w):
    """
    Exact orthogonal projection of S onto the transitive subspace, in the
    inner product weighted by w (which must sum to 1).

    Returns (potential f, transitive T, residual R). No fitted parameter: f = S w
    is the exact minimiser, and <R, G(g)>_w = 0 for every potential g.
    """
    f = S @ w
    T = f[:, None] - f[None, :]
    return f, T, S - T


def wnorm(A, w):
    """Frobenius norm in the w-weighted inner product."""
    return float(np.sqrt(np.einsum("i,j,ij,ij->", w, w, A, A)))


def planes(S, w):
    """
    Canonical rotation-plane decomposition of the skew operator S, taken in the
    w-weighted inner product.

    Conjugating by W^(1/2) makes the weighted geometry into ordinary Frobenius
    geometry; Sw stays skew, so its singular values come in EQUAL PAIRS and each
    pair spans one invariant plane.

    Returns (sigma per plane, plane bases in weighted coords, pair-equality
    residual, block residual). The last two are self-checks: if either is not at
    machine precision, the pairing into planes is not trustworthy and the caller
    must say so rather than report plane counts.
    """
    r = np.sqrt(w)
    Sw = (r[:, None] * S) * r[None, :]
    U, sv, _ = np.linalg.svd(Sw)

    n = Sw.shape[0]
    n_planes = n // 2
    sigma = sv[0:2 * n_planes:2]
    # For a real skew matrix the singular values MUST pair up exactly.
    pair_gap = float(np.abs(sv[0:2 * n_planes:2] - sv[1:2 * n_planes:2]).max())

    # Verify each pair really is a rotation block: P^T Sw P = [[0, s], [-s, 0]].
    block_res = 0.0
    for k in range(min(24, n_planes)):
        P = U[:, 2 * k:2 * k + 2]
        B = P.T @ Sw @ P
        want = np.array([[0.0, B[0, 1]], [-B[0, 1], 0.0]])
        block_res = max(block_res, float(np.abs(B - want).max()),
                        float(abs(abs(B[0, 1]) - sigma[k])))
    return sigma, U, pair_gap, block_res, Sw


def truncate(Sw, U, k):
    """Best rank-2k skew approximation of Sw: keep the top k rotation planes."""
    P = U[:, :2 * k]
    return P @ (P.T @ Sw)


def reconstruction_table(S, Sw, U, w, ks):
    """
    Reconstruction error of the k-plane approximation, back on the equity scale,
    in percentage points. Reported alongside energy share, never instead of it:
    energy share flatters a low-rank claim and reconstruction error does not.
    """
    r = np.sqrt(w)
    inv = 1.0 / r
    out = []
    for k in ks:
        approx = (inv[:, None] * truncate(Sw, U, k)) * inv[None, :]
        err = np.abs(approx - S) * 100.0
        out.append({
            "planes": int(k),
            "coordinatesPerClass": int(2 * k),
            "meanAbsPP": float(np.einsum("i,j,ij->", w, w, err)),
            "p90PP": float(np.percentile(err, 90)),
            "maxPP": float(err.max()),
        })
    return out


def intransitivity_map(R, w):
    """
    Per hand class: the RMS cyclic edge it carries against a randomly drawn
    opponent hand, in percentage points. This is the part of a class's equity
    that NO strength ladder can express.

    Weighted over the opponent index by combo frequency, because the opponent is
    drawn from combos and not from the 169 labels.
    """
    return np.sqrt(np.einsum("j,ij->i", w, R * R)) * 100.0


# ------------------------------------------------------------------ report ---

def cumulative(sigma):
    e = sigma ** 2
    return np.cumsum(e) / e.sum()


def planes_for(cum, target):
    return int(np.searchsorted(cum, target)) + 1


def main():
    # Flags take a value, so skipping only the "--x" token would leave its VALUE in the
    # positional list and silently inflate the matrix count.
    flags = sys.argv[1:]
    args = []
    skip = False
    for i, tok in enumerate(flags):
        if skip:
            skip = False
            continue
        if tok.startswith("--"):
            skip = True
            continue
        args.append(tok)

    def flag(name, dflt=None):
        return flags[flags.index(name) + 1] if name in flags else dflt

    keep_planes = int(flag("--planes", "13"))
    artifact_path = flag("--emit-artifact")

    paths = args or ["equity-matrix.csv"]
    labels, M_A, hash_A, meta_A = load(paths[0])
    N = len(labels)
    w = np.array([multiplicity(l) for l in labels], float)
    w /= w.sum()

    print("=" * 74)
    print("1. PREMISE — is the operator actually antisymmetric?")
    print("=" * 74)
    res_A = asymmetry_residual(M_A)
    print(f"  {paths[0]}")
    print(f"    max |M + M^T - 1| = {res_A:.3e}")

    M_B = hash_B = res_B = meta_B = None
    if len(paths) > 1:
        labels_B, M_B, hash_B, meta_B = load(paths[1])
        if labels_B != labels:
            raise SystemExit("the two matrices do not share a label order")
        res_B = asymmetry_residual(M_B)
        print(f"  {paths[1]}")
        print(f"    max |M + M^T - 1| = {res_B:.3e}")
        if meta_A and meta_B:
            if meta_A["seed"] == meta_B["seed"]:
                raise SystemExit(
                    "  Both matrices were built with the same seed. The noise floor derived "
                    "from them\n  would be zero, and every plane would look significant."
                )
            if meta_A["boards"] != meta_B["boards"]:
                raise SystemExit(
                    "  The two matrices used different board counts, so (S_A - S_B)/2 is not a "
                    "noise\n  replica of (S_A + S_B)/2 and the threshold below would be wrong."
                )

    tol = 1e-12
    worst = max(res_A, res_B or 0.0)
    verdict = "HOLDS" if worst < tol else "FAILS"
    print(f"\n  verdict at tol {tol:.0e}: {verdict}")
    if worst >= tol:
        raise SystemExit(
            "  The operator is NOT antisymmetric to tolerance. Everything below this\n"
            "  point assumes it is. Stop and find out why before reading further."
        )

    # ---- signal / noise decomposition -------------------------------------
    S_A = M_A - 0.5
    if M_B is not None:
        S_B = M_B - 0.5
        S = 0.5 * (S_A + S_B)
        D = 0.5 * (S_A - S_B)
    else:
        S = S_A
        D = None

    print()
    print("=" * 74)
    print("2. TRANSITIVE / INTRANSITIVE SPLIT — orthogonal projection, not a fit")
    print("=" * 74)
    split = {}
    for tag, ww in (("combo-frequency weighted", w), ("unweighted (169 classes equal)",
                                                      np.full(N, 1.0 / N))):
        f, T, R = hodge_split(S, ww)
        nS, nT, nR = wnorm(S, ww), wnorm(T, ww), wnorm(R, ww)
        # Pythagoras is the proof the projection is orthogonal, not an accident.
        pyth = abs(nT ** 2 + nR ** 2 - nS ** 2) / nS ** 2
        print(f"  {tag}")
        print(f"    ||S|| = {nS:.5f}   ||T|| = {nT:.5f}   ||R|| = {nR:.5f}")
        print(f"    strength ladder (transitive) : {100 * nT**2 / nS**2:6.2f}% of skew energy")
        print(f"    intransitive residual        : {100 * nR**2 / nS**2:6.2f}%")
        print(f"    Pythagoras check |1 - (T^2+R^2)/S^2| = {pyth:.2e}")
        split[tag] = dict(transitiveShare=nT ** 2 / nS ** 2,
                          intransitiveShare=nR ** 2 / nS ** 2,
                          skewNorm=nS, transitiveNorm=nT, residualNorm=nR)

    f, T, R = hodge_split(S, w)

    print()
    print("=" * 74)
    print("3. ROTATION PLANES — the canonical invariants of S")
    print("=" * 74)
    sigma, U, pair_gap, block_res, Sw = planes(S, w)
    cum = cumulative(sigma)
    print(f"  singular values pair to {pair_gap:.2e}  (a real skew matrix forces exact pairs)")
    print(f"  rotation-block residual {block_res:.2e}  (P^T S P = [[0,s],[-s,0]])")
    if max(pair_gap, block_res) > 1e-9:
        print("  *** pairing is NOT trustworthy at this tolerance — do not quote plane counts")

    sigma_noise = None
    if D is not None:
        sigma_noise = float(planes(D, w)[0][0])
        n_sig = int((sigma > sigma_noise).sum())
        print(f"\n  MEASURED noise floor (two independent seeds): sigma_noise = {sigma_noise:.3e}")
        print(f"  planes above the sampling-noise floor: {n_sig} of {len(sigma)}")
        print(f"  those {n_sig} planes carry {100 * cum[n_sig - 1]:.3f}% of the skew energy")
    else:
        n_sig = None
        print("\n  no second seed supplied — the noise floor is unmeasured, so no plane")
        print("  count here is defensible. Pass a second matrix.")

    print("\n  plane   sigma      share of energy   cumulative")
    for k in range(12):
        print(f"  {k+1:>4}   {sigma[k]:9.6f}   {100 * 2 * 0 + 100 * sigma[k]**2 / (sigma**2).sum():7.2f}%"
              f"        {100 * cum[k]:7.3f}%")
    for t in (0.90, 0.95, 0.99, 0.999):
        print(f"  planes for {t*100:5.1f}% of energy: {planes_for(cum, t)}")

    print()
    print("=" * 74)
    print("4. RECONSTRUCTION ERROR — the honest half of any compression claim")
    print("=" * 74)
    ks = [1, 2, 3, 4, 5, 6, 8, 10, 13, 20, 30]
    table = reconstruction_table(S, Sw, U, w, ks)
    print("  planes  coords   mean |err|   90th pct    max |err|      (percentage points)")
    for row in table:
        print(f"  {row['planes']:>6}  {row['coordinatesPerClass']:>6}   "
              f"{row['meanAbsPP']:9.3f}   {row['p90PP']:8.3f}   {row['maxPP']:9.3f}")

    print()
    print("  THE SAME QUESTION ASKED OF THE INTRANSITIVE RESIDUAL ALONE.")
    print("  A pure strength ladder is already rank 2, so 'S is low rank' is no news.")
    sigma_R, U_R, _, _, Rw = planes(R, w)
    cum_R = cumulative(sigma_R)
    n_sig_R = None
    if D is not None:
        _, _, R_noise_op = hodge_split(D, w)
        sigma_noise_R = float(planes(R_noise_op, w)[0][0])
        n_sig_R = int((sigma_R > sigma_noise_R).sum())
        print(f"  residual noise floor {sigma_noise_R:.3e}; {n_sig_R} of {len(sigma_R)} "
              f"residual planes clear it, carrying {100 * cum_R[n_sig_R - 1]:.3f}% "
              f"of the residual's energy")
    table_R = reconstruction_table(R, Rw, U_R, w, ks)
    print("  planes  coords   mean |err|   90th pct    max |err|   cum. energy")
    for row, k in zip(table_R, ks):
        print(f"  {row['planes']:>6}  {row['coordinatesPerClass']:>6}   "
              f"{row['meanAbsPP']:9.3f}   {row['p90PP']:8.3f}   {row['maxPP']:9.3f}"
              f"   {100 * cum_R[k-1]:8.3f}%")
    for t in (0.90, 0.95, 0.99):
        print(f"  planes for {t*100:5.1f}% of the RESIDUAL's energy: {planes_for(cum_R, t)}")

    print()
    print("=" * 74)
    print("5. THE INTRANSITIVITY MAP — where cyclic structure can exist at all")
    print("=" * 74)
    imap = intransitivity_map(R, w)
    noise_map = None
    if D is not None:
        _, _, R_noise = hodge_split(D, w)
        noise_map = intransitivity_map(R_noise, w)
        print(f"  per-class sampling noise on this map: median {np.median(noise_map):.4f} pp,"
              f" max {noise_map.max():.4f} pp")
        print(f"  classes whose map value clears their own noise by 10x: "
              f"{int((imap > 10 * noise_map).sum())} of {N}")
    order = np.argsort(imap)[::-1]
    print("\n  MOST cyclic (equity least expressible by any strength ladder):")
    for i in order[:16]:
        print(f"    {labels[i]:>4}  {imap[i]:6.3f} pp", end="")
        if noise_map is not None:
            print(f"   (noise {noise_map[i]:.4f})", end="")
        print()
    print("  LEAST cyclic (a pure strength ladder describes them):")
    print("   ", ", ".join(f"{labels[i]} {imap[i]:.3f}" for i in order[::-1][:12]))

    if artifact_path:
        metas = [m for m in (meta_A, meta_B) if m]
        if len(metas) != len(paths):
            raise SystemExit(
                "refusing to emit an artifact without every matrix's .meta.json — the seed and "
                "board count are what make the numbers replicable"
            )
        emit(artifact_path, labels, w, dict(
            paths=paths, hashes=[h for h in (hash_A, hash_B) if h],
            seeds=[m["seed"] for m in metas], boards=metas[0]["boards"],
            residuals=[r for r in (res_A, res_B) if r is not None],
            split=split, sigma=sigma, cum=cum, sigma_R=sigma_R, cum_R=cum_R,
            sigma_noise=sigma_noise, n_sig=n_sig, n_sig_R=n_sig_R, pair_gap=pair_gap,
            block_res=block_res, table=table, table_R=table_R, imap=imap,
            noise_map=noise_map, U=U, w=w, keep=keep_planes, potential=f,
        ))
        print(f"\n  wrote artifact -> {artifact_path}")


# ---------------------------------------------------------------- artifact ---

SPLIT_KEYS = {
    "combo-frequency weighted": "comboFrequencyWeighted",
    "unweighted (169 classes equal)": "unweighted",
}

ARTIFACT_HEADER = '''/**
 * equitySkewDecomposition.js — GENERATED. Do not hand-edit.
 *
 * The canonical skew decomposition of the 169x169 all-in preflop equity operator.
 * Regenerate with:
 *
 *   node --import ./scripts/utils/register-src-resolver.mjs \\
 *        scripts/research/build-equity-matrix.mjs --boards 20000 --seed 20260803 --out A.csv
 *   node --import ./scripts/utils/register-src-resolver.mjs \\
 *        scripts/research/build-equity-matrix.mjs --boards 20000 --seed 987654321 --out B.csv
 *   python scripts/research/spectrum.py A.csv B.csv --planes 13 \\
 *        --emit-artifact src/utils/pokerCore/data/equitySkewDecomposition.js
 *
 * ENGINE-INDEPENDENT. Built from the hand evaluator and a seeded board sampler alone — no
 * villain model, no fold curve, no realization, no EV. The matrix is a property of the deck.
 *
 * WHAT THE FIELDS MEAN, and the two that are easy to misread:
 *
 *   planeSigma            magnitudes of the 84 rotation planes, descending. Each plane is one
 *                         rock-paper-scissors cycle. 169 is odd, so 84 is the maximum possible.
 *   planeBasisA / B       a basis for each plane, in ordinary (unweighted) 169-grid coordinates.
 *                         THE TWO AXES ARE ARBITRARY inside their plane — only the plane and
 *                         `planeRadius` are invariant. Never rank hands by one axis.
 *   noiseFloorSigma       the largest plane magnitude of a pure-noise replica built from two
 *                         independent board seeds. Planes below it are indistinguishable from
 *                         board sampling. This is measured, not chosen.
 *   split                 the ORTHOGONAL transitive/intransitive projection. Shares sum to 1.
 *   intransitivityMap     per class, the RMS cyclic edge against a random opponent hand, in
 *                         percentage points — equity no strength ladder can express.
 *
 * Read by `src/utils/pokerCore/equityOperator.js`, which validates it before use.
 */

'''


def emit(path, labels, w, d):
    """Write the decomposition as a JS data module — the repo has no YAML parser and this must
    load in the browser as well as the Node harness, the same argument the Strategy Card
    loader makes."""
    try:
        commit = subprocess.check_output(["git", "rev-parse", "HEAD"], text=True).strip()
        dirty = bool(subprocess.check_output(["git", "status", "--porcelain"], text=True).strip())
    except Exception:
        commit, dirty = "unknown", True

    r = np.sqrt(w)
    keep = d["keep"]
    # Plane bases mapped OUT of the weighted coordinates, so a consumer projecting an ordinary
    # 169-grid does not have to know the weighting existed.
    basis_a = [(d["U"][:, 2 * k] / r).tolist() for k in range(keep)]
    basis_b = [(d["U"][:, 2 * k + 1] / r).tolist() for k in range(keep)]
    radius = [np.hypot(d["U"][:, 2 * k], d["U"][:, 2 * k + 1]).tolist() for k in range(keep)]

    def rnd(x, p=8):
        if isinstance(x, (list, tuple)):
            return [rnd(v, p) for v in x]
        return round(float(x), p)

    obj = {
        "artifactVersion": ARTIFACT_VERSION,
        "generatedBy": "scripts/research/spectrum.py",
        "generatedFrom": "scripts/research/build-equity-matrix.mjs",
        "engineCommit": commit,
        "engineDirty": dirty,
        "sourceMatrices": [p.rsplit("/", 1)[-1] for p in d["paths"]],
        "dealBookHashes": d["hashes"],
        "seeds": d["seeds"],
        "boardsPerSeed": d["boards"],
        "labels": labels,
        "comboWeights": rnd(w.tolist(), 10),
        "antisymmetryResidual": rnd(max(d["residuals"]), 20),
        "pairingResidual": rnd(d["pair_gap"], 20),
        "rotationBlockResidual": rnd(d["block_res"], 20),
        "split": {SPLIT_KEYS[k]: {kk: rnd(vv) for kk, vv in v.items()}
                  for k, v in d["split"].items()},
        "strengthPotential": rnd(d["potential"].tolist()),
        "planeSigma": rnd(d["sigma"].tolist()),
        "planeCumulativeEnergy": rnd(d["cum"].tolist()),
        "residualPlaneSigma": rnd(d["sigma_R"].tolist()),
        "residualCumulativeEnergy": rnd(d["cum_R"].tolist()),
        "noiseFloorSigma": rnd(d["sigma_noise"]) if d["sigma_noise"] else None,
        "significantPlanes": d["n_sig"],
        "significantResidualPlanes": d["n_sig_R"],
        "reconstruction": d["table"],
        "residualReconstruction": d["table_R"],
        "intransitivityMap": rnd(d["imap"].tolist(), 6),
        "intransitivityNoise": (rnd(d["noise_map"].tolist(), 8)
                                if d["noise_map"] is not None else None),
        "planeBasisA": rnd(basis_a, 7),
        "planeBasisB": rnd(basis_b, 7),
        "planeRadius": rnd(radius, 7),
    }
    body = json.dumps(obj, indent=2)
    with open(path, "w", newline="\n", encoding="utf-8") as fh:
        fh.write(ARTIFACT_HEADER)
        fh.write("export const EQUITY_SKEW_DECOMPOSITION = Object.freeze(")
        fh.write(body)
        fh.write(");\n")


if __name__ == "__main__":
    main()
