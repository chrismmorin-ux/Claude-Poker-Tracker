"""
cluster_helpers.py — k-means++ and silhouette, shared by the clustering studies.

sklearn is not installed and a clustering study does not justify adding it. Both
routines take an explicit rng: a clustering that moves between runs cannot be
cited in a research note.
"""

import numpy as np


def kmeans_pp_init(X, k, rng):
    """k-means++ seeding. Plain random init gives unstable, poor solutions."""
    n = X.shape[0]
    centers = [X[rng.integers(n)]]
    for _ in range(1, k):
        d2 = np.min(((X[:, None, :] - np.array(centers)[None, :, :]) ** 2).sum(axis=2), axis=1)
        total = d2.sum()
        if total <= 0:
            centers.append(X[rng.integers(n)])
            continue
        centers.append(X[rng.choice(n, p=d2 / total)])
    return np.array(centers)


def kmeans(X, k, rng, iters=100, tol=1e-7):
    C = kmeans_pp_init(X, k, rng)
    labels = np.zeros(X.shape[0], dtype=int)
    for _ in range(iters):
        d2 = ((X[:, None, :] - C[None, :, :]) ** 2).sum(axis=2)
        new_labels = d2.argmin(axis=1)
        newC = np.array([
            X[new_labels == j].mean(axis=0) if np.any(new_labels == j) else C[j]
            for j in range(k)
        ])
        shift = np.abs(newC - C).max()
        C, labels = newC, new_labels
        if shift < tol:
            break
    return C, labels, float(((X - C[labels]) ** 2).sum())


def mean_silhouette(X, labels, rng, sample=2000):
    """Mean silhouette on a subsample — the full O(n^2) distance matrix is not affordable."""
    n = X.shape[0]
    idx = rng.choice(n, size=min(sample, n), replace=False)
    Xs, ls = X[idx], labels[idx]
    uniq = np.unique(ls)
    if len(uniq) < 2:
        return None
    D = np.sqrt(((Xs[:, None, :] - Xs[None, :, :]) ** 2).sum(axis=2))
    sil = []
    for i in range(len(Xs)):
        same = ls == ls[i]
        same[i] = False
        if not np.any(same):
            continue
        a = D[i, same].mean()
        b = min(D[i, ls == c].mean() for c in uniq if c != ls[i])
        sil.append((b - a) / max(a, b))
    return float(np.mean(sil)) if sil else None
