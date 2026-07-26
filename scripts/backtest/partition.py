"""
partition.py — WS-273 deterministic player partition, Python mirror of partition.mjs.

The Python miner (C:/Users/chris/data/phh-mining/phh_miner.py) must select exactly
the same POOL players as the Node backtest runner when it builds the train-only
Reference table. If the two implementations disagree by even one player, an EVAL
player's hands leak into the priors and the harness reports a falsely good number
— the precise failure WS-273 was written to prevent.

The two implementations are held together by a shared fixture:
    scripts/backtest/fixtures/partition-vectors.json
asserted by BOTH scripts/__tests__/partition.test.js and partition_check.py.
Change one implementation without the other and the fixture assertion fails.

See partition.mjs for the full rationale (two-level split, why by player and not
by hand, why the partition unit is the player row).

Usage as a module:
    from partition import partition_of, GROUP_POOL
    if partition_of(pid) == GROUP_POOL: ...

Self-check:
    python partition.py --check
"""

import json
import os
import sys

GROUP_POOL = "pool"
GROUP_EVAL = "eval"

DEFAULT_POOL_PCT = 50

_FNV_OFFSET_BASIS = 0x811C9DC5
_FNV_PRIME = 0x01000193
_MASK32 = 0xFFFFFFFF


def fnv1a32(s):
    """FNV-1a, 32-bit, over the UTF-8 bytes of `s`.

    The & _MASK32 after each multiply is what keeps this identical to the JS
    Math.imul path — Python ints are unbounded and would otherwise diverge
    immediately.
    """
    h = _FNV_OFFSET_BASIS
    for b in s.encode("utf-8"):
        h ^= b
        h = (h * _FNV_PRIME) & _MASK32
    return h


def partition_of(player_id, pool_pct=DEFAULT_POOL_PCT):
    """Assign a player pseudonym to GROUP_POOL or GROUP_EVAL.

    Stable across runs, machines, and languages.
    """
    if not isinstance(player_id, str) or not player_id:
        raise ValueError("partition_of: player_id must be a non-empty string")
    if not isinstance(pool_pct, int) or not 0 <= pool_pct <= 100:
        raise ValueError(
            "partition_of: pool_pct must be an integer 0-100 (got %r)" % (pool_pct,)
        )
    return GROUP_POOL if (fnv1a32(player_id) % 100) < pool_pct else GROUP_EVAL


def is_pool_player(player_id, pool_pct=DEFAULT_POOL_PCT):
    return partition_of(player_id, pool_pct) == GROUP_POOL


def is_eval_player(player_id, pool_pct=DEFAULT_POOL_PCT):
    return partition_of(player_id, pool_pct) == GROUP_EVAL


# ---------------------------------------------------------------- fixture check
FIXTURE_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)), "fixtures", "partition-vectors.json"
)


def check_fixture(path=FIXTURE_PATH):
    """Assert this implementation reproduces the shared cross-language fixture.

    Returns (passed, failures). Mirrors the assertions in partition.test.js.
    """
    with open(path, "r", encoding="utf-8") as f:
        fixture = json.load(f)

    failures = []

    for case in fixture["hashVectors"]:
        got = fnv1a32(case["input"])
        if got != case["fnv1a32"]:
            failures.append(
                "fnv1a32(%r) = %d, fixture says %d" % (case["input"], got, case["fnv1a32"])
            )

    pool_pct = fixture["poolPct"]
    for case in fixture["partitionVectors"]:
        got = partition_of(case["playerId"], pool_pct)
        if got != case["group"]:
            failures.append(
                "partition_of(%r) = %s, fixture says %s"
                % (case["playerId"], got, case["group"])
            )

    return (len(failures) == 0), failures


if __name__ == "__main__":
    if "--check" in sys.argv:
        ok, failures = check_fixture()
        if ok:
            print("partition.py: fixture OK")
            sys.exit(0)
        for f in failures:
            print("FAIL: %s" % f, file=sys.stderr)
        sys.exit(1)
    print(__doc__)
