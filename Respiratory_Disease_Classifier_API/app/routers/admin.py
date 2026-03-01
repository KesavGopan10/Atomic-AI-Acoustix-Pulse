"""
app.routers.admin
-----------------
Admin endpoints for monitoring and metrics.
"""

from __future__ import annotations

from fastapi import APIRouter, Request

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/metrics", summary="Get API metrics for the admin dashboard")
async def get_metrics(request: Request):
    """Return a full metrics snapshot including per-endpoint stats, tokens, and cache."""
    metrics = request.app.state.metrics
    snapshot = metrics.snapshot()

    # Add model / config info
    settings = request.app.state.settings
    snapshot["config"] = {
        "version": "2.1.0",
        "groq_model": settings.groq_model,
        "cache_max_size": settings.cache_max_size,
        "model_path": settings.model_path,
        "groq_connected": bool(settings.groq_api_key),
    }

    # Add endpoint registry (which endpoints are registered)
    snapshot["registered_endpoints"] = [
        {"path": "/", "method": "GET", "tag": "Health"},
        {"path": "/classes", "method": "GET", "tag": "Health"},
        {"path": "/predict", "method": "POST", "tag": "Prediction"},
        {"path": "/report", "method": "POST", "tag": "Report"},
        {"path": "/heart/analyze", "method": "POST", "tag": "Heart Disease"},
        {"path": "/scan/analyze", "method": "POST", "tag": "Medical Imaging"},
        {"path": "/lab/analyze", "method": "POST", "tag": "Lab Reports"},
        {"path": "/symptoms/chat", "method": "POST", "tag": "Symptom Checker"},
        {"path": "/drugs/check", "method": "POST", "tag": "Drug Interactions"},
    ]

    return snapshot
