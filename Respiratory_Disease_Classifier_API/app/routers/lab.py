"""
app.routers.lab
---------------
Lab report analyzer — upload a photo of a blood test / lab report.
Uses Llama 4 Scout vision to:
  Step 1 — OCR + extract all values with normal ranges
  Step 2 — Interpret findings and generate patient report
"""

from __future__ import annotations

import base64
import json
import logging

from fastapi import APIRouter, File, Form, HTTPException, Request, UploadFile

from app.config import get_settings
from app.schemas import LabReportResponse, LabReportType

router = APIRouter(prefix="/lab", tags=["Lab Report Analysis"])

logger = logging.getLogger("uvicorn.error")

# ---------------------------------------------------------------------------
# Allowed image types
# ---------------------------------------------------------------------------

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}

# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

EXTRACTION_PROMPT = """\
You are a clinical laboratory AI specialist with expertise in reading lab reports.

Analyze the provided lab report image carefully. Extract ALL test values visible in the report.

You MUST respond with ONLY valid JSON in this exact structure:
{
  "report_type": "blood_test|urine_test|lipid_panel|liver_function|kidney_function|thyroid_panel|cbc|metabolic_panel|general",
  "patient_info": {
    "name": "if visible, else null",
    "age": "if visible, else null",
    "date": "test date if visible, else null"
  },
  "extracted_values": [
    {
      "parameter": "Test name (e.g., Hemoglobin, WBC, Glucose)",
      "value": 14.5,
      "unit": "g/dL",
      "normal_range": "13.5-17.5",
      "status": "normal|low|high|critical_low|critical_high",
      "category": "Hematology|Biochemistry|Liver|Kidney|Thyroid|Lipid|Other"
    }
  ],
  "abnormal_count": 3,
  "critical_flags": [
    "Parameter X is critically high/low — requires immediate attention"
  ],
  "summary": "Brief overall summary of the lab report findings"
}

## Rules
- Extract EVERY value visible in the image, not just abnormal ones
- Compare each value against its normal range to determine status
- Mark values outside normal range as "low" or "high"
- Mark values significantly outside range (>2x deviation) as "critical_low" or "critical_high"
- If you cannot read a value clearly, include it with value: null and note "unclear" in status
- Be precise with units and normal ranges"""

INTERPRETATION_PROMPT = """\
You are a senior pathologist and clinical laboratory specialist.
Based on the extracted lab values, generate a comprehensive patient-friendly interpretation report in Markdown.

The report MUST include ALL of these sections:

1. **Report Overview** — Type of test, date, patient info if available
2. **Results Summary** — Table of all values with status indicators (✅ Normal, ⚠️ Abnormal, 🔴 Critical)
3. **Abnormal Findings** — Detailed explanation of each abnormal value:
   - What the test measures
   - Why the value is abnormal
   - Possible causes
   - Clinical significance
4. **Critical Alerts** — Any values needing immediate medical attention
5. **Pattern Analysis** — Correlations between abnormal values (e.g., low iron + low hemoglobin = possible anemia)
6. **Recommendations** — Suggested follow-up tests, lifestyle changes, when to see a doctor
7. **Normal Results** — Brief confirmation of values within range

Use clear, non-technical language. Include a results table with emojis for quick scanning.
Always include a disclaimer that this is AI-generated and must be confirmed by a healthcare provider."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _validate_image(file: UploadFile) -> None:
    """Raise 400 if upload is not a supported image."""
    filename = (file.filename or "").lower()
    if not any(filename.endswith(ext) for ext in _ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file. Accepted: {', '.join(sorted(_ALLOWED_EXTENSIONS))}",
        )


def _detect_mime(filename: str, content_type: str) -> str:
    """Detect MIME type for base64 data URI."""
    fn = filename.lower()
    if fn.endswith(".png"):
        return "image/png"
    if fn.endswith(".webp"):
        return "image/webp"
    if content_type and content_type.startswith("image/"):
        return content_type
    return "image/jpeg"


def _parse_json_safe(text: str) -> dict:
    """Parse JSON from LLM output, handling markdown code fences."""
    cleaned = text.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)

    # Find first { ... } block
    start = cleaned.find("{")
    if start == -1:
        return {}

    depth = 0
    end = start
    for i in range(start, len(cleaned)):
        if cleaned[i] == "{":
            depth += 1
        elif cleaned[i] == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    try:
        return json.loads(cleaned[start:end])
    except json.JSONDecodeError:
        return {}


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

from app.dependencies import invoke_llm

# ...
@router.post(
    "/analyze",
    summary="Analyze a lab report image (blood test, CBC, lipid panel, etc.)",
    response_model=LabReportResponse,
)
async def analyze_lab_report(
    request: Request,
    file: UploadFile = File(..., description="Photo of lab report (JPEG, PNG, WebP)"),
    report_type: LabReportType = Form(
        LabReportType.general,
        description="Type of lab report (helps improve accuracy)",
    ),
):
    """
    Upload a photo of a lab report and receive:

    - **extracted_values** — every test value with normal range and status
    - **abnormal_count** — number of out-of-range values
    - **critical_flags** — values needing immediate attention
    - **report** — full interpretation report in Markdown

    Supports: blood tests, CBC, lipid panels, liver/kidney function,
    thyroid panels, metabolic panels, and urine tests.

    Powered by the configured AI Provider (Bedrock/Groq).
    """
    _validate_image(file)

    total_tokens = {"prompt": 0, "completion": 0, "total": 0}

    try:
        # --- Read and encode image ---
        image_bytes = await file.read()
        b64_image = base64.b64encode(image_bytes).decode("utf-8")
        mime_type = _detect_mime(file.filename or "", file.content_type or "")

        logger.info(
            "🔬 Analyzing lab report (%d KB) — type: %s",
            len(image_bytes) // 1024, report_type.value,
        )

        # =================================================================
        # STEP 1 — OCR + Value Extraction (Vision)
        # =================================================================
        logger.info("🧪 Step 1/2: Extracting lab values")

        messages1 = [
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
                            f"Analyze this {report_type.value.replace('_', ' ')} lab report image. "
                            "Extract ALL test values, their units, normal ranges, and status."
                        ),
                    },
                ],
            }
        ]

        raw_extraction, usage1 = await invoke_llm(
            request, EXTRACTION_PROMPT, messages1, temperature=0.2
        )

        total_tokens["prompt"] += usage1["prompt_tokens"]
        total_tokens["completion"] += usage1["completion_tokens"]

        extracted = _parse_json_safe(raw_extraction)

        # =================================================================
        # STEP 2 — Medical Interpretation (Report)
        # =================================================================
        logger.info("🧪 Step 2/2: Generating interpretation report")

        messages2 = [
            {
                "role": "user",
                "content": (
                    f"Lab report type: {report_type.value.replace('_', ' ')}\n\n"
                    f"Extracted values:\n{json.dumps(extracted, indent=2)}\n\n"
                    "Generate the full patient interpretation report."
                ),
            }
        ]

        report_text, usage2 = await invoke_llm(
            request, INTERPRETATION_PROMPT, messages2, temperature=0.4
        )

        total_tokens["prompt"] += usage2["prompt_tokens"]
        total_tokens["completion"] += usage2["completion_tokens"]
        total_tokens["total"] = total_tokens["prompt"] + total_tokens["completion"]

        logger.info("✅ Lab analysis complete — %d total tokens", total_tokens["total"])

        return {
            "report_type": extracted.get("report_type", report_type.value),
            "extracted_values": extracted.get("extracted_values", []),
            "abnormal_count": extracted.get("abnormal_count", 0),
            "critical_flags": extracted.get("critical_flags", []),
            "summary": extracted.get("summary", ""),
            "report": report_text,
            "model": request.app.state.ai_model,
            "tokens_used": total_tokens,
        }

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Lab report analysis failed: {str(exc)}",
        ) from exc
