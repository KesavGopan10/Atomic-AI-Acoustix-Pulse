"""
app.routers.predict
-------------------
Audio classification endpoint — upload a WAV → get prediction.
"""

from __future__ import annotations

import os
import tempfile

from fastapi import APIRouter, File, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse

from app.schemas import PredictionResponse

router = APIRouter(tags=["Prediction"])


def _validate_wav(file: UploadFile) -> None:
    """Raise 400 if the upload doesn't look like a WAV file."""
    filename = file.filename or ""
    content_type = file.content_type or ""
    if not (
        filename.lower().endswith(".wav")
        or content_type.startswith("audio/")
        or content_type == "application/octet-stream"
    ):
        raise HTTPException(
            status_code=400,
            detail="Only WAV audio files are supported. Please upload a .wav file.",
        )


@router.post(
    "/predict",
    summary="Classify a respiratory audio sample",
    response_model=PredictionResponse,
)
async def predict(
    request: Request,
    file: UploadFile = File(..., description="WAV audio file to classify"),
):
    """
    Upload a WAV file and receive:

    - **prediction** – most likely respiratory condition
    - **confidence** – probability of the predicted class (0–1)
    - **all_probabilities** – probability for every class
    """
    _validate_wav(file)

    model = request.app.state.model
    pipeline = request.app.state.pipeline
    cache = request.app.state.cache

    temp_path: str | None = None
    try:
        content = await file.read()

        # --- Cache check ---
        file_hash = cache.hash_bytes(content)
        cached = cache.get(file_hash)
        if cached is not None:
            return JSONResponse(content=cached)

        # --- Write temp file with correct extension so librosa uses right decoder ---
        # Detect extension from filename, fallback to content_type mapping
        orig_name = (file.filename or "").lower()
        if orig_name.endswith(".m4a") or (file.content_type or "") in ("audio/mp4", "audio/m4a", "audio/x-m4a"):
            suffix = ".m4a"
        elif orig_name.endswith(".ogg") or (file.content_type or "") in ("audio/ogg", "audio/vorbis"):
            suffix = ".ogg"
        elif orig_name.endswith(".flac") or (file.content_type or "") == "audio/flac":
            suffix = ".flac"
        elif orig_name.endswith(".webm") or (file.content_type or "") == "audio/webm":
            suffix = ".webm"
        elif orig_name.endswith(".aac") or (file.content_type or "") == "audio/aac":
            suffix = ".aac"
        else:
            suffix = ".wav"  # default: treat as WAV

        with tempfile.NamedTemporaryFile(
            delete=False, suffix=suffix, prefix="resp_"
        ) as tmp:
            tmp.write(content)
            temp_path = tmp.name

        # --- Feature extraction ---
        features_df = pipeline.transform([temp_path])

        # --- Inference ---
        prediction = model.predict(features_df)[0]
        probabilities = model.predict_proba(features_df)[0]
        confidence = float(max(probabilities))
        all_probs = {
            cls: round(float(prob), 6)
            for cls, prob in zip(model.classes_, probabilities)
        }

        result = {
            "prediction": str(prediction),
            "confidence": round(confidence, 6),
            "all_probabilities": all_probs,
        }

        cache.set(file_hash, result)
        return JSONResponse(content=result)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction failed: {str(exc)}",
        ) from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except OSError:
                # On Windows, pydub may still hold the file handle open.
                # The OS will clean up the temp file on its own.
                pass
