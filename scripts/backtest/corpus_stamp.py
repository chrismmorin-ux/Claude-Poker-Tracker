"""
corpus_stamp.py — WS-492. Describe the corpus tree a miner actually read.

WHY THIS EXISTS
---------------
Miner manifests recorded `corpusRoot` (a path) and, at best, the dataset commit.
Neither describes a SPARSE tree. phh-dataset is a blobless sparse checkout, and
from 2026-05 until 2026-08-15 exactly 2 of its 27 stake directories were
materialised — so every prior, curve and reference table in this repo was fitted
on ~8% of the available corpus while its manifest said, truthfully and
uselessly, `corpusRoot: .../data/handhq`.

A commit hash does not describe a sparse tree. Two runs at the same commit, one
with 2 dirs and one with 27, produce different numbers and identical provenance.
That is the failure this stamp removes: the manifest now carries what was on
disk, so a slice can never again be silently mistaken for the whole.

Emit `corpus_stamp(root)` into any manifest that reports a corpus-derived number.
"""

import os
import subprocess


def _git(repo, args):
    """Run git in `repo`, return stripped stdout, or None if anything goes wrong.

    Never raises: a missing git or a non-repo path must degrade the stamp, not
    kill a mine that is otherwise fine.
    """
    try:
        out = subprocess.run(
            ["git"] + args,
            cwd=repo,
            capture_output=True,
            text=True,
            timeout=30,
        )
        if out.returncode != 0:
            return None
        return out.stdout.strip() or None
    except Exception:
        return None


def corpus_stamp(corpus_root):
    """Return a dict describing the corpus tree actually present at `corpus_root`.

    `corpus_root` is the .../data/handhq directory. The dataset repo is assumed
    to be two levels up; if it is not a git repo the git fields come back None
    and the on-disk facts (which are the load-bearing ones) still record.
    """
    root = os.path.abspath(corpus_root)
    repo = os.path.abspath(os.path.join(root, os.pardir, os.pardir))

    dirs = sorted(
        name for name in os.listdir(root)
        if os.path.isdir(os.path.join(root, name))
    ) if os.path.isdir(root) else []

    file_count = 0
    for _dirpath, _dirnames, filenames in os.walk(root):
        file_count += sum(1 for f in filenames if f.endswith(".phhs"))

    sparse = _git(repo, ["sparse-checkout", "list"])

    return {
        # The two facts that distinguish a slice from the whole corpus.
        "dirCount": len(dirs),
        "handFileCount": file_count,
        "dirs": dirs,
        # Sparse patterns are what CAUSED the slice; keep them next to the effect.
        "sparsePatterns": sparse.splitlines() if sparse else None,
        "datasetCommit": _git(repo, ["rev-parse", "HEAD"]),
        "datasetRoot": repo,
    }
