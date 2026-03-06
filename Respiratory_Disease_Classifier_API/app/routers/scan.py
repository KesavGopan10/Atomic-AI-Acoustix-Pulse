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
from app.text_formatter import strip_markdown

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
You are a board-certified radiologist AI assistant specializing in thoracic imaging. Analyze this chest X-ray using a systematic, evidence-based approach.

## Step 1 — ABCDE Systematic Review
Evaluate each area methodically and report findings:

**A — Airway & Mediastinum:**
- Trachea: midline or deviated? (deviation suggests tension pneumothorax, mass, or collapse)
- Mediastinal width: normal (< 8cm on PA) or widened? (widened → aortic dissection, lymphadenopathy)
- Hilum: size, density, position (hilar enlargement → lymphadenopathy, pulmonary HTN)

**B — Breathing (Lungs & Pleura):**
- Lung fields: systematically compare left vs right, upper vs lower zones
- Opacities: consolidation (air bronchograms → pneumonia), ground-glass (infection, edema), nodules (masses)
- Hyperlucency: hyperinflation (COPD/asthma), pneumothorax (absent lung markings)
- Costophrenic angles: sharp (normal) or blunted (pleural effusion > 200mL)
- Pleural thickening, calcification, or pneumothorax signs

**C — Cardiac:**
- Cardiothoracic ratio (CTR): measure and report (normal < 0.5 on PA film)
- CTR > 0.5 → cardiomegaly (heart failure, pericardial effusion, valvular disease)
- Heart borders: clear or obscured? (silhouette sign → adjacent pathology)

**D — Diaphragm:**
- Position: right should be 1-2cm higher than left
- Flattening → hyperinflation (COPD)
- Elevation → phrenic nerve palsy, hepatomegaly, subphrenic abscess
- Free air under diaphragm → bowel perforation (surgical emergency)

**E — Everything Else:**
- Bones: ribs (fractures, lytic lesions), spine (compression fractures, scoliosis)
- Soft tissues: subcutaneous emphysema, breast shadows, calcifications
- Lines/tubes: ETT position, central lines, chest drains, pacemaker leads

## Step 2 — Structured Findings (JSON)
Return a JSON block:
```json
{
  "normal_findings": ["specific normal finding with location"],
  "abnormal_findings": [
    {
      "finding": "specific abnormality",
      "location": "anatomical location (e.g., right lower lobe, left costophrenic angle)",
      "pattern": "consolidation|ground-glass|nodular|reticular|cavity|effusion|pneumothorax",
      "severity": "mild|moderate|severe",
      "significance": "clinical meaning and likely diagnosis",
      "differential": ["most likely cause", "alternative cause"]
    }
  ],
  "cardiothoracic_ratio": "measured ratio (e.g., 0.48)",
  "lung_fields": "clear|hazy|opacified|hyperinflated|asymmetric",
  "overall_impression": "concise clinical summary",
  "urgency": "critical|high|moderate|low|normal",
  "confidence": "high|moderate|low",
  "recommended_followup": ["specific next step with rationale"]
}
```

## Step 3 — Radiology Report
Write a structured report in Markdown:
- **Clinical Indication** (if apparent from image context)
- **Technique** (PA/AP, erect/supine if determinable)
- **Findings** (organized by ABCDE)
- **Impression** (numbered list, most important first)
- **Recommendations** (specific follow-up actions)

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$). This breaks the app display.
- Use plain Unicode: ≥, ≤, ±, °, ², ³, μ, →, ×
- Format as clean Markdown with headings, bullet points, **bold**, tables
- Keep mobile-friendly: short paragraphs, clear section breaks

⚕️ **Disclaimer**: This is AI-assisted analysis for informational purposes only. All findings must be verified by a qualified radiologist. Do not make clinical decisions based solely on this analysis.""",

    "ecg": """\
You are a board-certified cardiologist AI assistant specializing in electrophysiology and ECG interpretation. Analyze this ECG/EKG strip using a systematic, evidence-based approach.

## Step 1 — Systematic ECG Interpretation (Rate → Rhythm → Axis → Intervals → Morphology)

**Rate:**
- Calculate HR using R-R interval method (300 ÷ large boxes between R waves)
- Classify: Bradycardia (< 60 bpm), Normal (60-100), Tachycardia (> 100)
- Note if rate is regular or irregular

**Rhythm:**
- Is it regular? (use march-out method)
- P waves present before every QRS? P waves uniform?
- Sinus rhythm criteria: upright P in II, inverted P in aVR, consistent P-P and R-R intervals
- Common rhythms to identify: NSR, sinus bradycardia/tachycardia, atrial fibrillation (irregularly irregular, no P waves), atrial flutter (sawtooth pattern), SVT, VT, heart blocks

**Axis:**
- Use leads I and aVF to determine quadrant
- Normal axis: -30° to +90° | LAD: -30° to -90° | RAD: +90° to +180°
- Clinical significance: LAD → LVH, LAFB | RAD → RVH, LPFB, PE

**Intervals:**
- PR interval: Normal 120-200ms | Short (< 120ms → WPW, pre-excitation) | Long (> 200ms → AV block)
- QRS duration: Normal < 120ms | 120-150ms (incomplete BBB) | > 150ms (complete BBB)
- QT/QTc: Calculate corrected QT (Bazett's formula) | Normal < 440ms (M) / < 460ms (F) | Prolonged → Torsades risk
- ST segment: Isoelectric (normal) | Elevation (STEMI, pericarditis) | Depression (ischemia, digoxin)

**Morphology:**
- P wave: bifid (LAE), peaked (RAE)
- QRS: RBBB pattern (rsR' in V1) vs LBBB pattern (broad notched R in I, V5-V6)
- Q waves: pathological if > 40ms wide or > 25% of R wave height → prior MI
- T waves: peaked (hyperkalemia), inverted (ischemia, strain), flattened (hypokalemia)
- U waves: prominent → hypokalemia

## Step 2 — Structured Findings (JSON)
```json
{
  "rhythm": "specific rhythm diagnosis",
  "heart_rate_estimate": "rate in bpm with method used",
  "axis": "normal|LAD|RAD|extreme",
  "normal_findings": ["specific normal finding"],
  "abnormal_findings": [
    {
      "finding": "specific abnormality",
      "leads_affected": "specific leads (e.g., V1-V4, II, III, aVF)",
      "severity": "mild|moderate|severe",
      "significance": "clinical meaning",
      "differential": ["likely cause 1", "likely cause 2"]
    }
  ],
  "intervals": {
    "pr": {"value": "ms", "status": "normal|short|prolonged"},
    "qrs": {"value": "ms", "status": "normal|wide"},
    "qt_qtc": {"value": "ms", "status": "normal|prolonged|short"}
  },
  "overall_impression": "clinical summary",
  "urgency": "critical|high|moderate|low|normal",
  "recommended_followup": ["specific action with rationale"]
}
```

## Step 3 — ECG Interpretation Report
Write a structured cardiology-style report in Markdown:
- **Rate and Rhythm**
- **Axis**
- **Intervals** (table format: Interval | Measured | Normal Range | Status)
- **Waveform Morphology** (P, QRS, ST, T analysis)
- **Interpretation** (numbered clinical impressions)
- **Recommendations**

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$). This breaks the app display.
- Use plain Unicode: ≥, ≤, ±, °, ², ³, μ, →
- Format as clean Markdown with headings, bullet points, **bold**, tables
- Keep mobile-friendly

⚕️ **Disclaimer**: This is AI-assisted ECG analysis. All interpretations must be confirmed by a qualified cardiologist.""",

    "ct_scan": """\
You are a board-certified radiologist AI assistant specializing in cross-sectional imaging and CT interpretation.

## Systematic CT Analysis

**Image Assessment:**
- Identify the body region, scan plane (axial, coronal, sagittal), and contrast phase (non-contrast, arterial, portal venous, delayed)
- Window settings apparent: soft tissue, lung, bone, liver

**Anatomical Survey (region-dependent):**
- **Chest CT**: lungs (nodules, masses, ground-glass, consolidation, emphysema), mediastinum (lymphadenopathy, masses), pleura (effusion, thickening), airways (bronchiectasis, wall thickening), pulmonary vasculature (PE — filling defects in pulmonary arteries)
- **Abdominal CT**: liver (lesions, fatty change), gallbladder, pancreas, spleen, kidneys (stones, masses, hydronephrosis), adrenals, bowel (obstruction, wall thickening, free air), aorta (aneurysm, dissection), lymph nodes
- **Head CT**: brain parenchyma (hemorrhage — hyperdense, infarct — hypodense, edema), ventricles (hydrocephalus), midline shift, skull fractures, sinuses
- **Musculoskeletal**: bones (fractures, lytic/sclerotic lesions), joints, soft tissues

**Key Density Values (Hounsfield Units):**
- Air: -1000 | Fat: -100 to -50 | Water: 0 | Soft tissue: 20-80 | Blood: 50-70 | Bone: 400-1000

**Findings Documentation:**
For each finding, report: location, size (if measurable), density characteristics, enhancement pattern, relationship to adjacent structures.

## Structured Findings (JSON)
Return a JSON block then a full Markdown report with:
```json
{
  "scan_region": "chest|abdomen|head|spine|other",
  "contrast_phase": "non-contrast|arterial|portal_venous|delayed|unknown",
  "normal_findings": ["finding with location"],
  "abnormal_findings": [
    {
      "finding": "description",
      "location": "anatomical location",
      "size": "measurements if possible",
      "density": "HU range or descriptor",
      "severity": "mild|moderate|severe",
      "significance": "clinical meaning",
      "differential": ["diagnosis 1", "diagnosis 2"]
    }
  ],
  "overall_impression": "summary",
  "urgency": "critical|high|moderate|low|normal",
  "recommended_followup": ["action with rationale"]
}
```

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$). This breaks the app.
- Use plain Unicode: ≥, ≤, ±, °, ², ³, μ, →. Use Markdown tables for measurements.
- Keep mobile-friendly with clean Markdown formatting.

⚕️ **Disclaimer**: AI-assisted analysis. Must be reviewed by a qualified radiologist.""",

    "mri": """\
You are a board-certified radiologist AI assistant specializing in MRI interpretation and advanced imaging.

## Systematic MRI Analysis

**Sequence Identification:**
- Identify apparent sequence type: T1-weighted, T2-weighted, FLAIR, DWI/ADC, post-contrast T1
- T1: fat bright, fluid dark | T2: fluid bright, fat variable | FLAIR: fluid suppressed
- DWI + ADC: restricted diffusion → acute infarct, abscess, hypercellular tumor

**Signal Analysis:**
For each finding, characterize:
- Signal intensity on T1 (hypo/iso/hyperintense)
- Signal intensity on T2 (hypo/iso/hyperintense)
- Enhancement pattern (if post-contrast): homogeneous, ring-enhancing, non-enhancing
- Diffusion characteristics: restricted (bright DWI + dark ADC) vs facilitated

**Anatomical Survey (region-dependent):**
- **Brain MRI**: cortex, white matter (demyelination, WMH), basal ganglia, thalamus, brainstem, cerebellum, ventricles (size/symmetry), midline structures, extra-axial spaces, IACs, orbits, sinuses
- **Spine MRI**: vertebral bodies (compression fractures, metastases), discs (herniation, degeneration), spinal cord (myelopathy, syrinx), nerve roots, ligaments, paraspinal soft tissues
- **MSK MRI**: ligaments (ACL, menisci, rotator cuff), cartilage, bone marrow (edema, fractures), tendons, muscles
- **Abdominal MRI**: liver (focal lesions — hemangioma, HCC, metastases), bile ducts (MRCP), pancreas, kidneys

**Key Diagnostic Patterns:**
- Ring-enhancing lesion → abscess, metastasis, glioblastoma, toxoplasmosis
- Restricted diffusion → acute stroke (< 6h), abscess, epidermoid
- T2 hyperintense white matter lesions → MS plaques, ischemic changes, vasculitis
- Bone marrow edema → fracture, infection, tumor infiltration

## Structured Findings (JSON)
```json
{
  "scan_region": "brain|spine|msk|abdomen|other",
  "sequences_identified": ["T1", "T2", "FLAIR", "DWI", "post-contrast"],
  "normal_findings": ["finding with location"],
  "abnormal_findings": [
    {
      "finding": "description",
      "location": "anatomical location",
      "size": "measurements if possible",
      "signal_t1": "hypo|iso|hyper",
      "signal_t2": "hypo|iso|hyper",
      "enhancement": "enhancing|non-enhancing|ring-enhancing|not applicable",
      "diffusion": "restricted|facilitated|not assessed",
      "severity": "mild|moderate|severe",
      "significance": "clinical meaning",
      "differential": ["diagnosis 1", "diagnosis 2"]
    }
  ],
  "overall_impression": "summary",
  "urgency": "critical|high|moderate|low|normal",
  "recommended_followup": ["action with rationale"]
}
```

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$). This breaks the app.
- Use plain Unicode: ≥, ≤, ±, °, ², ³, μ, →. Use Markdown tables for measurements.
- Keep mobile-friendly with clean Markdown formatting.

⚕️ **Disclaimer**: AI-assisted analysis. Must be reviewed by a qualified radiologist.""",
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
            "report": strip_markdown(result_text),
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
