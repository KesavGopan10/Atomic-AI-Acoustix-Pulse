"""
main.py
-------
Slim FastAPI entrypoint — assembles middleware, routers, and lifespan.

Run:
    uvicorn main:app --host 0.0.0.0 --port 8000

Docs:
    http://localhost:8000/docs

Dashboard:
    http://localhost:8000/dashboard
"""

import time

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.dependencies import lifespan
from app.metrics import MetricsCollector
from app.routers import admin, drugs, health, heart, lab, predict, report, scan, symptoms

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="Medical AI Platform API",
    description=(
        "Upload a breath/cough WAV audio file and receive a respiratory "
        "condition prediction from a pre-trained Random Forest model. "
        "Generate AI-powered patient reports via Groq LLM. "
        "Assess heart disease risk with multi-step AI analysis."
    ),
    version="2.1.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# Metrics  (in-memory, resets on restart)
# ---------------------------------------------------------------------------

_metrics = MetricsCollector()


@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    """Track request count, response time, and status code per endpoint."""
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000

    path = request.url.path
    # Skip dashboard, admin, static, and docs — only track real API calls
    skip = path.startswith("/static") or path.startswith("/admin") or path in (
        "/", "/docs", "/redoc", "/openapi.json", "/favicon.ico",
    )
    if not skip:
        _metrics.record_request(path, duration_ms, response.status_code)

    return response

# Make metrics available via app.state
app.state.metrics = _metrics

# ---------------------------------------------------------------------------
# CORS  (allow all origins — tighten for production)
# ---------------------------------------------------------------------------

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Static files & dashboard route
# ---------------------------------------------------------------------------

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
async def serve_dashboard():
    """Serve the admin monitoring dashboard at root."""
    return FileResponse("static/dashboard.html")

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------

app.include_router(health.router)
app.include_router(predict.router)
app.include_router(report.router)
app.include_router(heart.router)
app.include_router(scan.router)
app.include_router(symptoms.router)
app.include_router(drugs.router)
app.include_router(lab.router)
app.include_router(admin.router)
