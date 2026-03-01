"""
app.metrics
------------
In-memory metrics collector for the admin dashboard.
Tracks request counts, response times, errors, and token usage per endpoint.
Thread-safe via collections.deque (GIL-protected).
"""

from __future__ import annotations

import time
from collections import deque
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class EndpointStats:
    """Rolling stats for a single endpoint."""

    total_requests: int = 0
    total_errors: int = 0
    response_times_ms: deque = field(default_factory=lambda: deque(maxlen=100))
    last_request_at: str | None = None
    status_codes: dict[int, int] = field(default_factory=dict)

    def record(self, duration_ms: float, status_code: int) -> None:
        self.total_requests += 1
        self.response_times_ms.append(round(duration_ms, 1))
        self.last_request_at = datetime.now(timezone.utc).isoformat()
        self.status_codes[status_code] = self.status_codes.get(status_code, 0) + 1
        if status_code >= 400:
            self.total_errors += 1

    @property
    def avg_response_ms(self) -> float:
        if not self.response_times_ms:
            return 0
        return round(sum(self.response_times_ms) / len(self.response_times_ms), 1)

    @property
    def p95_response_ms(self) -> float:
        if not self.response_times_ms:
            return 0
        sorted_times = sorted(self.response_times_ms)
        idx = int(len(sorted_times) * 0.95)
        return sorted_times[min(idx, len(sorted_times) - 1)]

    def to_dict(self) -> dict:
        return {
            "total_requests": self.total_requests,
            "total_errors": self.total_errors,
            "avg_response_ms": self.avg_response_ms,
            "p95_response_ms": self.p95_response_ms,
            "recent_response_times": list(self.response_times_ms),
            "last_request_at": self.last_request_at,
            "status_codes": self.status_codes,
            "error_rate": round(
                (self.total_errors / self.total_requests * 100)
                if self.total_requests > 0
                else 0,
                1,
            ),
        }


class MetricsCollector:
    """Application-wide metrics store."""

    def __init__(self) -> None:
        self.started_at = datetime.now(timezone.utc).isoformat()
        self.endpoints: dict[str, EndpointStats] = {}
        self.total_tokens: dict[str, int] = {
            "prompt": 0,
            "completion": 0,
            "total": 0,
        }
        self.cache_hits: int = 0
        self.cache_misses: int = 0

    def record_request(self, path: str, duration_ms: float, status_code: int) -> None:
        """Record a completed request."""
        # Normalize path (strip query params, group by route)
        route = self._normalize_path(path)
        if route not in self.endpoints:
            self.endpoints[route] = EndpointStats()
        self.endpoints[route].record(duration_ms, status_code)

    def record_tokens(self, prompt: int, completion: int) -> None:
        """Record Groq token usage."""
        self.total_tokens["prompt"] += prompt
        self.total_tokens["completion"] += completion
        self.total_tokens["total"] += prompt + completion

    def record_cache_hit(self) -> None:
        self.cache_hits += 1

    def record_cache_miss(self) -> None:
        self.cache_misses += 1

    def snapshot(self) -> dict:
        """Return full metrics snapshot for the dashboard."""
        total_req = sum(e.total_requests for e in self.endpoints.values())
        total_err = sum(e.total_errors for e in self.endpoints.values())

        return {
            "server": {
                "started_at": self.started_at,
                "uptime_seconds": round(
                    (
                        datetime.now(timezone.utc)
                        - datetime.fromisoformat(self.started_at)
                    ).total_seconds()
                ),
            },
            "totals": {
                "requests": total_req,
                "errors": total_err,
                "error_rate": round(
                    (total_err / total_req * 100) if total_req > 0 else 0, 1
                ),
            },
            "tokens": self.total_tokens.copy(),
            "cache": {
                "hits": self.cache_hits,
                "misses": self.cache_misses,
                "hit_rate": round(
                    (
                        self.cache_hits
                        / (self.cache_hits + self.cache_misses)
                        * 100
                    )
                    if (self.cache_hits + self.cache_misses) > 0
                    else 0,
                    1,
                ),
            },
            "endpoints": {
                route: stats.to_dict()
                for route, stats in sorted(self.endpoints.items())
            },
        }

    @staticmethod
    def _normalize_path(path: str) -> str:
        """Normalize request paths to route groups."""
        # Remove query string
        path = path.split("?")[0]
        # Skip static / docs / openapi
        if path in ("/docs", "/openapi.json", "/redoc", "/favicon.ico"):
            return path
        return path
