"""
app.routers.scan
----------------
Medical image analysis endpoint.
Uses Llama 4 Scout's vision capabilities to analyze:
  - Chest X-rays
  - ECG strips
  - CT scans
  - MRI images
"""

from __future__ import annotations

import base64
import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.anonymizer import anonymizer
from app.config import get_settings
from app.schemas import ScanAnalysisResponse, ScanType

router = APIRouter(prefix="/scan", tags=["Medical Imaging"])

logger = logging.getLogger("uvicorn.error")

# ---------------------------------------------------------------------------
# Allowed image MIME types
# ---------------------------------------------------------------------------

_ALLOWED_TYPES = {
    "image/jpeg", "image/png", "image/webp", "image/gif",
    "application/octet-stream",
}

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif"}

# ---------------------------------------------------------------------------
# Prompts  (one per scan type for specialized analysis)
# ---------------------------------------------------------------------------

_SCAN_PROMPTS: dict[str, str] = {
    "chest_xray": """\
You are an expert radiologist AI assistant analyzing a chest X-ray.

Provide a detailed analysis with this structure:

**Step 1 — Systematic Review:**
- Airway: trachea position, patency
- Breathing: lung fields, costophrenic angles, pleural spaces
- Cardiac: heart size (cardiothoracic ratio), mediastinum
- Diaphragm: position, contour
- Everything else: bones, soft tissues, foreign bodies

**Step 2 — Findings (JSON):**
Return a JSON block with:
```json
{
  "normal_findings": ["finding1", "finding2"],
  "abnormal_findings": [
    {"finding": "description", "location": "where", "severity": "mild|moderate|severe", "significance": "clinical meaning"}
  ],
  "cardiothoracic_ratio": "estimated ratio",
  "lung_fields": "clear | hazy | opacified | ...",
  "overall_impression": "summary",
  "urgency": "critical | high | moderate | low | normal",
  "recommended_followup": ["action1", "action2"]
}
```

**Step 3 — Report:**
Write a comprehensive radiology-style report in Markdown.

Always include a disclaimer that this is AI-assisted analysis and must be reviewed by a qualified radiologist.""",

    "ecg": """\
You are an expert cardiologist AI assistant analyzing an ECG/EKG strip.

Provide a detailed analysis:

**Step 1 — Systematic Review:**
- Rate & Rhythm: regular/irregular, estimated HR
- P waves: present, morphology, axis
- PR interval: normal/prolonged/short
- QRS complex: width, morphology, axis
- ST segment: elevation/depression/normal
- T waves: morphology, inversions
- QT interval: normal/prolonged

**Step 2 — Findings (JSON):**
```json
{
  "rhythm": "sinus rhythm | afib | aflutter | ...",
  "heart_rate_estimate": "bpm range",
  "normal_findings": ["finding1"],
  "abnormal_findings": [
    {"finding": "description", "leads_affected": "which leads", "severity": "mild|moderate|severe", "significance": "meaning"}
  ],
  "intervals": {"pr": "normal/abnormal", "qrs": "normal/abnormal", "qt": "normal/abnormal"},
  "overall_impression": "summary",
  "urgency": "critical | high | moderate | low | normal",
  "recommended_followup": ["action1"]
}
```

**Step 3 — Report:**
Write a comprehensive cardiology-style ECG interpretation report in Markdown.

Always include a disclaimer.""",

    "ct_scan": """\
You are an expert radiologist AI assistant analyzing a CT scan image.

Provide a systematic analysis covering:
- Anatomical structures visible
- Normal vs abnormal findings
- Masses, lesions, or abnormalities
- Measurements if possible
- Overall impression and urgency

Return findings as JSON then a full Markdown report.
Always include a disclaimer that this requires review by a qualified radiologist.""",

    "mri": """\
You are an expert radiologist AI assistant analyzing an MRI image.

Provide a systematic analysis covering:
- Tissue contrast and signal characteristics
- Anatomical structures visible
- Normal vs abnormal findings
- Lesions, edema, or structural abnormalities
- Overall impression and urgency

Return findings as JSON then a full Markdown report.
Always include a disclaimer that this requires review by a qualified radiologist.""",
}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_image(file: UploadFile) -> None:
    """Raise 400 if upload is not a supported image."""
    filename = (file.filename or "").lower()
    content_type = file.content_type or ""

    ext_ok = any(filename.endswith(ext) for ext in _ALLOWED_EXTENSIONS)
    type_ok = content_type in _ALLOWED_TYPES

    if not (ext_ok or type_ok):
        raise HTTPException(
            status_code=400,
            detail=(
                f"Unsupported file type. "
                f"Accepted: {', '.join(sorted(_ALLOWED_EXTENSIONS))}. "
                f"Got: '{filename}' ({content_type})"
            ),
        )


def _detect_mime(filename: str, content_type: str) -> str:
    """Detect MIME type for base64 data URI."""
    fn = filename.lower()
    if fn.endswith(".png"):
        return "image/png"
    if fn.endswith(".webp"):
        return "image/webp"
    if fn.endswith(".gif"):
        return "image/gif"
    if content_type and content_type.startswith("image/"):
        return content_type
    return "image/jpeg"  # default


def _extract_json_from_text(text: str) -> dict:
    """Try to extract a JSON object from mixed text/markdown output."""
    # Find the first { ... } block
    start = text.find("{")
    if start == -1:
        return {}

    depth = 0
    end = start
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    try:
        return json.loads(text[start:end])
    except json.JSONDecodeError:
        return {}


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

from app.dependencies import invoke_llm

# ...
@router.post(
    "/analyze",
    summary="Analyze a medical image (X-ray, ECG, CT, MRI)",
    response_model=ScanAnalysisResponse,
)
async def analyze_scan(
    request: Request,
    file: UploadFile = File(..., description="Medical image file (JPEG, PNG, WebP)"),
    scan_type: ScanType = Form(ScanType.chest_xray, description="Type of medical scan"),
):
    """
    Upload a medical image and receive:

    - **findings** — structured JSON with normal/abnormal findings, urgency, follow-up
    - **report** — full radiology/cardiology-style Markdown report

    Supported scan types: `chest_xray`, `ecg`, `ct_scan`, `mri`

    Powered by the configured AI Provider (Bedrock/Groq).
    """
    _validate_image(file)

    try:
        # --- Read, EXIF-strip, and encode image ---
        raw_image_bytes = await file.read()
        # ANONYMIZATION: Strip all EXIF / metadata from the image.
        # Medical imaging devices embed patient name, DOB, MRN, facility name,
        # and device serial numbers in EXIF headers — all classified as PHI.
        image_bytes = anonymizer.scrub_image(raw_image_bytes, field_name=f"scan_{scan_type.value}")
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = _detect_mime(file.filename or "", file.content_type or "")

        logger.info(
            "🔬 Analyzing %s image (%d KB) as %s",
            scan_type.value, len(image_bytes) // 1024, mime_type,
        )

        # --- AI vision call using common format ---
        system_prompt = _SCAN_PROMPTS.get(scan_type.value, _SCAN_PROMPTS["chest_xray"])

        # Map to common "AcoustixPulse" format
        messages = [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "data": b64_image,
                        "mime": mime_type,
                    },
                    {
                        "type": "text",
                        "text": (
                            f"Please analyze this {scan_type.value.replace('_', ' ')} image. "
                            "Provide the JSON findings block first, then the full Markdown report."
                        ),
                    },
                ],
            }
        ]

        result_text, usage = await invoke_llm(
            request, system_prompt, messages, temperature=0.3
        )

        # --- Parse structured findings from the output ---
        findings = _extract_json_from_text(result_text)

        return {
            "scan_type": scan_type.value,
            "findings": findings,
            "report": result_text,
            "model": request.app.state.ai_model,
            "tokens_used": usage,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Scan analysis failed: {str(exc)}",
        ) from exc
