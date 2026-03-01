"""
app.routers.health
------------------
Health-check and model metadata endpoints.
"""

from fastapi import APIRouter, Request

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Health check")
def health_check():
    """Simple health-check endpoint."""
    return {"status": "ok", "message": "Medical AI Platform is running 🏥"}


@router.get("/classes", summary="List model classes")
def list_classes(request: Request):
    """Return the respiratory condition labels the model can predict."""
    model = request.app.state.model
    return {"classes": list(model.classes_)}
