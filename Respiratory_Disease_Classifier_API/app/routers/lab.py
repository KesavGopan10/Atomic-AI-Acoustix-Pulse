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

from app.anonymizer import anonymizer
from app.config import get_settings
from app.schemas import LabReportResponse, LabReportType
from app.text_formatter import strip_markdown

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
You are a board-certified clinical pathologist AI with expertise in laboratory medicine and diagnostic testing.

Analyze the provided lab report image with meticulous attention to detail. Extract ALL test values visible in the report.

## PRIVACY & HIPAA COMPLIANCE — CRITICAL
Do NOT extract, read, or return any of the following:
- Patient name, initials, or any personal identifier
- Patient date of birth or age
- Physician or provider name
- Facility or hospital name
- Account number, MRN, or any ID number
- Collection date or report date
Set ALL `patient_info` fields to null. Your sole focus is laboratory test values.

## Panel-Specific Expected Parameters
Use these as a checklist to ensure completeness:

**CBC (Complete Blood Count):**
WBC, RBC, Hemoglobin, Hematocrit, MCV, MCH, MCHC, RDW, Platelet count, MPV, Neutrophils, Lymphocytes, Monocytes, Eosinophils, Basophils (absolute and %)

**Lipid Panel:**
Total Cholesterol, LDL, HDL, Triglycerides, VLDL, Total/HDL ratio, Non-HDL cholesterol

**Metabolic Panel (BMP/CMP):**
Glucose, BUN, Creatinine, BUN/Creatinine ratio, Sodium, Potassium, Chloride, CO2/Bicarbonate, Calcium, eGFR, Anion gap, Albumin, Total protein, ALP, ALT, AST, Bilirubin (total/direct)

**Thyroid Panel:**
TSH, Free T4, Free T3, Total T4, Total T3, Thyroid antibodies (TPO, TG)

**Liver Function:**
ALT, AST, ALP, GGT, Total bilirubin, Direct bilirubin, Albumin, Total protein, PT/INR

**Kidney Function:**
Creatinine, BUN, eGFR, Cystatin C, Uric acid, Microalbumin, ACR

## Critical Value Thresholds (flag immediately)
- Potassium: < 2.5 or > 6.5 mEq/L
- Sodium: < 120 or > 160 mEq/L
- Glucose: < 40 or > 500 mg/dL
- Hemoglobin: < 7.0 g/dL
- Platelets: < 50,000 or > 1,000,000 /μL
- WBC: < 2,000 or > 30,000 /μL
- Creatinine: > 10 mg/dL
- Troponin: any elevation above reference
- INR: > 5.0

## Response Format — ONLY valid JSON:
{
  "report_type": "blood_test|urine_test|lipid_panel|liver_function|kidney_function|thyroid_panel|cbc|metabolic_panel|general",
  "patient_info": {
    "name": null,
    "age": null,
    "date": null
  },
  "extracted_values": [
    {
      "parameter": "Official test name (e.g., Hemoglobin, WBC, Glucose, TSH)",
      "value": 14.5,
      "unit": "g/dL",
      "normal_range": "13.5-17.5",
      "status": "normal|low|high|critical_low|critical_high",
      "category": "Hematology|Biochemistry|Liver|Kidney|Thyroid|Lipid|Cardiac|Inflammatory|Other",
      "clinical_note": "Brief note if value is abnormal (e.g., 'suggests iron deficiency' or 'indicates hyperthyroidism')"
    }
  ],
  "abnormal_count": 3,
  "critical_flags": [
    "Parameter X is critically high/low (value: Y, critical threshold: Z) — requires immediate medical attention"
  ],
  "panels_detected": ["CBC", "Lipid Panel"],
  "summary": "Brief overall summary focusing on clinically significant findings (NO patient identifiers)"
}

## Extraction Rules
- Extract EVERY test value visible, not just abnormal ones
- Use standardized test names (e.g., "Hemoglobin" not "Hb" or "HGB")
- Compare each value against its printed normal range to determine status
- Mark values outside normal range as "low" or "high"
- Mark values beyond critical thresholds as "critical_low" or "critical_high"
- If value is unclear, include with value: null and status: "unclear"
- Be precise with units — distinguish between mg/dL, g/dL, mmol/L, mEq/L, μIU/mL
- NEVER include any patient name, ID, date, or facility in your response"""

INTERPRETATION_PROMPT = """\
You are a board-certified clinical pathologist and laboratory medicine specialist with expertise in interpreting lab results and correlating findings across multiple parameters.

Based on the extracted lab values, generate a comprehensive, patient-friendly interpretation report in Markdown.

## Report Structure (include ALL sections)

### 1. 📋 Report Overview
- Type of lab test(s) identified
- Total parameters analyzed
- Quick status summary: X normal, Y abnormal, Z critical

### 2. 📊 Results Summary Table
Create a complete table with emoji status indicators:
| Parameter | Result | Unit | Normal Range | Status |
|-----------|--------|------|-------------|--------|
- Use: ✅ Normal | ⚠️ Low/High | 🔴 Critical
- Sort by: Critical first, then abnormal, then normal

### 3. 🔴 Critical Alerts (if any)
For each critical value:
- **What this test measures** in simple terms
- **Your result vs normal** with clear comparison
- **Why this is urgent** — potential immediate health implications
- **Recommended action** — specific next steps (e.g., "Contact your doctor within 24 hours")

### 4. ⚠️ Abnormal Findings Analysis
For each abnormal value, provide:
- **What the test measures** — explain in patient-friendly language
- **Your value** vs **normal range** — how far off and in which direction
- **Possible causes** (most common to least common):
  - Dietary/lifestyle causes
  - Medication effects
  - Medical conditions
- **Clinical significance** — what this means for your health
- **What you can do** — actionable steps

### 5. 🧩 Pattern Analysis & Clinical Correlations
Look for clinically meaningful patterns across multiple values:

**Common patterns to identify:**
- **Iron-deficiency anemia**: Low hemoglobin + Low MCV + Low MCH + Low iron/ferritin
- **Vitamin B12/Folate deficiency**: Low hemoglobin + High MCV + Low B12/folate
- **Infection/Inflammation**: High WBC + High neutrophils + High CRP/ESR
- **Liver disease**: Elevated ALT/AST + Elevated bilirubin + Low albumin + Prolonged PT
- **Kidney disease**: Elevated creatinine + Elevated BUN + Low eGFR + Abnormal electrolytes
- **Metabolic syndrome**: High glucose + High triglycerides + Low HDL + Elevated BP markers
- **Thyroid disorders**: Abnormal TSH with corresponding T3/T4 changes
- **Dehydration**: Elevated BUN/creatinine ratio + Elevated hematocrit + Concentrated urine
- **Diabetes monitoring**: Elevated glucose + Elevated HbA1c + Possible kidney involvement
- **Cardiovascular risk**: High LDL + Low HDL + High triglycerides + High total/HDL ratio

Explain each pattern found in plain language with its clinical significance.

### 6. 📝 Recommendations
Provide prioritized, actionable recommendations:
- **Immediate** (if critical values): urgent medical consultation needed
- **Follow-up tests**: specific tests to confirm or investigate abnormal findings
- **Lifestyle modifications**: diet changes, exercise, hydration, sleep
- **Medication review**: if results suggest drug effects, recommend discussion with provider
- **Retest timeline**: when to repeat the lab work

### 7. ✅ Normal Results Confirmation
Briefly confirm which values are within normal range and what this indicates about organ function:
- Group by system: blood counts, liver function, kidney function, metabolic, etc.
- Reassure the patient about healthy values

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$). This breaks the app display.
- Use plain Unicode: ≥, ≤, ±, °, ², ³, μ, →, %, /
- Format as clean Markdown: headings (#, ##, ###), bullet points, **bold**, tables
- Keep paragraphs short (2-3 sentences max) for mobile readability
- Use emoji for visual scanning but don't overuse

⚕️ **Disclaimer**: This lab interpretation is AI-generated for informational purposes only. Lab results must be interpreted in the context of your complete medical history, symptoms, and physical examination. Always consult your healthcare provider for definitive interpretation and treatment decisions."""


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
        # --- Read, EXIF-strip, and encode image ---
        raw_image_bytes = await file.read()
        # ANONYMIZATION LAYER 1: Strip all EXIF / metadata from the image.
        # Lab printouts photographed or scanned may carry patient name, DOB,
        # MRN, and facility data in image metadata — all classified as PHI.
        image_bytes = anonymizer.scrub_image(raw_image_bytes, field_name="lab_report")
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

        # ANONYMIZATION LAYER 3: Drop patient_info entirely before Step 2.
        # Even though the prompt instructs the AI not to extract patient info,
        # we also filter it out defensively from the parsed output so it is
        # never forwarded to the second LLM call or logged.
        extracted.pop("patient_info", None)

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
            "summary": strip_markdown(extracted.get("summary", "")),
            "report": strip_markdown(report_text),
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
