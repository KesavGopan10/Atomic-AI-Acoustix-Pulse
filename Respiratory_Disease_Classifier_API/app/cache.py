"""
app.cache
---------
Thread-safe, bounded in-memory prediction cache.
Keyed by SHA-256 of raw audio file bytes.
"""

from __future__ import annotations

import hashlib
from collections import OrderedDict


class PredictionCache:
    """LRU-style dict cache with a configurable max size."""

    def __init__(self, max_size: int = 128) -> None:
        self._max_size = max_size
        self._store: OrderedDict[str, dict] = OrderedDict()

    # ----- public API -----

    @staticmethod
    def hash_bytes(data: bytes) -> str:
        """Return the SHA-256 hex digest of *data*."""
        return hashlib.sha256(data).hexdigest()

    def get(self, key: str) -> dict | None:
        """Return cached result or ``None``. Moves key to end (LRU)."""
        if key in self._store:
            self._store.move_to_end(key)
            return self._store[key]
        return None

    def set(self, key: str, value: dict) -> None:
        """Insert *value*; evict the oldest entry if cache is full."""
        if key in self._store:
            self._store.move_to_end(key)
        elif len(self._store) >= self._max_size:
            self._store.popitem(last=False)
        self._store[key] = value

    def __contains__(self, key: str) -> bool:
        return key in self._store

    def __len__(self) -> int:
        return len(self._store)
