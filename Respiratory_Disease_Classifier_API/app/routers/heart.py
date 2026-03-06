"""
app.routers.heart
-----------------
Heart disease risk assessment using a multi-step LLM chain:
  Step 1 — Triage:    urgency classification (JSON)
  Step 2 — Diagnosis: condition analysis     (JSON)
  Step 3 — Report:    full patient report    (Markdown)

All three steps run sequentially; each step receives the previous output.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request

from app.anonymizer import anonymizer
from app.config import get_settings
from app.schemas import HeartAnalysisResponse, HeartDiseaseInput
from app.text_formatter import strip_markdown

router = APIRouter(prefix="/heart", tags=["Heart Disease"])

logger = logging.getLogger("uvicorn.error")


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

TRIAGE_SYSTEM = """\
You are an emergency cardiac triage AI specialist trained in ACC/AHA risk stratification.
Analyze the patient's clinical data systematically and classify urgency.

Return ONLY valid JSON with this exact structure:
{
  "urgency": "critical" | "high" | "moderate" | "low",
  "reasoning": "detailed clinical reasoning citing specific values",
  "immediate_action_needed": true | false,
  "key_red_flags": ["specific finding with value"],
  "risk_score_estimate": "Framingham 10-year risk category: low(<10%) / intermediate(10-20%) / high(>20%)"
}

## Clinical Triage Criteria
- **CRITICAL** (activate cath lab / code STEMI protocol):
  - ST depression > 2mm in contiguous leads
  - Asymptomatic (ASY) chest pain + bradycardia (HR < 60) + downsloping ST segment → silent ischemia
  - Exercise-induced angina + significant ST changes → unstable angina / NSTEMI pattern
  - Oldpeak > 2.0 with flat/downsloping ST → high-risk ischemia
- **HIGH** (urgent cardiology consult within 24h):
  - ≥ 3 major risk factors present simultaneously
  - Exercise angina positive + abnormal resting ECG
  - Cholesterol > 300 mg/dL + hypertension (BP > 160)
  - ST depression 1-2mm with symptoms
- **MODERATE** (schedule outpatient cardiology within 1-2 weeks):
  - 1-2 risk factors with borderline values
  - Resting ECG showing ST-T wave abnormalities without acute changes
  - Fasting blood sugar elevated (pre-diabetic cardiac risk)
- **LOW** (routine follow-up):
  - All values within normal ranges
  - No exercise-induced symptoms
  - Normal ST segment and ECG

## Value Interpretation Reference
- Resting BP: Normal < 120, Elevated 120-129, Stage 1 HTN 130-139, Stage 2 HTN ≥ 140
- Cholesterol: Desirable < 200, Borderline 200-239, High ≥ 240
- Max HR: Age-predicted max = 220 - age; < 85% suggests chronotropic incompetence
- Oldpeak: Normal ≤ 0.5mm, Mild 0.5-1.0, Moderate 1.0-2.0, Severe > 2.0
- ST Slope: Upsloping (best prognosis) → Flat (intermediate) → Downsloping (worst prognosis)"""

DIAGNOSIS_SYSTEM = """\
You are a senior interventional cardiologist AI with expertise in cardiac diagnostics.
Based on the patient data AND the triage assessment, provide a detailed evidence-based diagnosis.

Return ONLY valid JSON with this exact structure:
{
  "primary_condition": "most likely cardiac condition with confidence level",
  "clinical_reasoning": "step-by-step reasoning connecting data points to the diagnosis",
  "differential_diagnoses": [
    {
      "condition": "specific cardiac condition",
      "likelihood": "high|medium|low",
      "supporting_evidence": ["specific findings that support this"],
      "against_evidence": ["specific findings that argue against this"],
      "reasoning": "clinical reasoning"
    }
  ],
  "risk_score": 1-10,
  "risk_factors_present": ["factor with specific value"],
  "protective_factors": ["factor with explanation"],
  "abnormal_values": [
    {
      "parameter": "name",
      "value": "actual value with unit",
      "normal_range": "expected range with unit",
      "deviation": "how far from normal (% or absolute)",
      "significance": "clinical meaning and what it suggests"
    }
  ],
  "framingham_risk_factors": {
    "count": 0,
    "factors_present": [],
    "estimated_10yr_risk": "low|intermediate|high"
  }
}

## Diagnostic Considerations (evaluate each systematically)
- **Coronary Artery Disease (CAD)** — ST changes + exercise angina + multiple risk factors
- **Acute Coronary Syndrome (ACS)** — significant ST depression + chest pain pattern
- **Stable Angina Pectoris** — exertional chest pain that resolves with rest
- **Unstable Angina / NSTEMI** — crescendo pattern, ST changes at rest
- **Heart Failure (HFrEF/HFpEF)** — reduced exercise capacity, elevated BP chronically
- **Hypertensive Heart Disease** — sustained hypertension + LVH indicators on ECG
- **Arrhythmia Risk** — abnormal resting ECG, exercise-induced HR abnormalities
- **Valvular Heart Disease** — atypical chest pain patterns, exercise intolerance
- **Metabolic Cardiomyopathy** — diabetes + obesity + multiple metabolic risk factors

## Risk Score Interpretation (1-10)
1-2: Minimal risk, all values normal | 3-4: Low risk, 1 minor abnormality
5-6: Moderate risk, multiple borderline values | 7-8: High risk, significant abnormalities
9-10: Very high risk, multiple critical findings suggesting acute cardiac event"""

REPORT_SYSTEM = """\
You are a senior cardiologist AI assistant generating a comprehensive cardiac risk report.
Synthesize the patient data, triage result, and diagnosis analysis into a clear, actionable report.

The report MUST include ALL sections below:

### 1. 🫀 Patient Cardiac Profile
- Present all clinical data in a clean Markdown table with columns: Parameter | Value | Normal Range | Status
- Status indicators: ✅ Normal, ⚠️ Borderline, 🔴 Abnormal
- Include calculated metrics (e.g., heart rate reserve, BP category)

### 2. 🚨 Triage Assessment
- Urgency level with color-coded badge (🟢 Low, 🟡 Moderate, 🟠 High, 🔴 Critical)
- Immediate actions required (if any)
- Key red flags identified

### 3. Clinical Findings Analysis
For EACH clinical parameter, explain:
- What the value means clinically
- How it compares to normal range
- Its contribution to overall cardiac risk
- Correlation with other findings

### 4. Diagnosis & Risk Assessment
- Primary diagnosis with confidence level
- Differential diagnoses ranked by likelihood
- Overall risk score with visual indicator (e.g., "Risk Score: 7/10 🟠")
- 10-year cardiovascular event risk estimate

### 5. Risk Factor Profile
Organize into a table:
| Risk Factor | Status | Impact Level | Modifiable? |
- Highlight the most impactful modifiable risk factors
- Note any protective factors

### 6. Recommended Diagnostic Tests
Prioritized list with rationale:
- **Urgent** (within 24-48h): tests needed based on triage urgency
- **Soon** (within 1-2 weeks): comprehensive cardiac workup
- **Routine** (within 1-3 months): baseline and monitoring
- Include: 12-lead ECG, echocardiogram, stress test, cardiac biomarkers (troponin, BNP), lipid panel, HbA1c, coronary calcium score, cardiac CT/MRI if indicated

### 7. Treatment Plan
Structured by priority:
- **Immediate interventions** (if critical/high urgency)
- **Medications**: specific drug classes with rationale
  - Antiplatelets (aspirin, clopidogrel)
  - Statins (atorvastatin, rosuvastatin) with target LDL
  - Beta-blockers, ACE inhibitors/ARBs, calcium channel blockers
  - Anticoagulants if arrhythmia indicated
- **Procedural** (if indicated): catheterization, PCI, CABG referral
- Timeline for treatment reassessment

### 8. Lifestyle Modifications
- **Diet**: DASH diet specifics — sodium < 2,300mg/day, emphasize fruits/vegetables/whole grains, limit saturated fats
- **Exercise**: specific prescription — type (walking, cycling), intensity (moderate), duration (150 min/week), precautions
- **Weight management**: target BMI range, realistic goals
- **Stress management**: evidence-based techniques (mindfulness, CBT)
- **Smoking**: cessation timeline, pharmacotherapy if applicable
- **Alcohol**: limits per AHA guidelines

### 9. Follow-up Schedule
| Timeframe | Action | Purpose |
|-----------|--------|---------|
- 1 week, 1 month, 3 months, 6 months, 1 year milestones
- Specific tests to repeat at each interval

### 10. ⚠️ Emergency Warning Signs
Clear, scannable list:
- 🔴 Chest pain/pressure lasting > 5 minutes
- 🔴 Pain radiating to jaw, left arm, or back
- 🔴 Sudden severe shortness of breath
- 🔴 Loss of consciousness or near-fainting
- 🔴 Rapid or irregular heartbeat with dizziness
- 🔴 Sudden weakness/numbness on one side
- **Action**: "Call 911 immediately. Chew one aspirin (325mg) if not allergic."

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$). This will break the app.
- Use plain Unicode: ≥, ≤, ±, °, ², ³, μ, →, ×, ÷, %, /
- Format as clean Markdown: headings, bullet points, **bold**, numbered lists, tables
- Keep paragraphs short (2-3 sentences) for mobile readability

⚕️ **Disclaimer**: This report is AI-generated for informational purposes only. It is not a substitute for professional medical advice. Always consult a qualified cardiologist."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_patient_summary(req: HeartDiseaseInput) -> str:
    """
    Format the clinical input as a readable summary for the LLM.

    ANONYMIZATION APPLIED:
    - Exact age is replaced with an age bracket (HIPAA Safe Harbor §164.514(b))
    - All other fields are clinical measurements, not direct patient identifiers
    """
    return (
        f"Age group: {anonymizer.bucket_age(req.age)} | Sex: {req.sex}\n"
        f"Chest Pain Type: {req.chest_pain_type}\n"
        f"Resting BP: {req.resting_bp} mm Hg\n"
        f"Cholesterol: {req.cholesterol} mg/dl\n"
        f"Fasting Blood Sugar > 120: {'Yes' if req.fasting_bs else 'No'}\n"
        f"Resting ECG: {req.resting_ecg}\n"
        f"Max Heart Rate: {req.max_hr}\n"
        f"Exercise Angina: {req.exercise_angina}\n"
        f"Oldpeak (ST depression): {req.oldpeak}\n"
        f"ST Slope: {req.st_slope}"
    )


def _parse_json_safe(text: str) -> dict:
    """Parse JSON from LLM output, handling markdown code fences."""
    cleaned = text.strip()
    # Strip ```json ... ``` wrapper if present
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        # Remove first line (```json) and last line (```)
        lines = [l for l in lines if not l.strip().startswith("```")]
        cleaned = "\n".join(lines)
    return json.loads(cleaned)


from app.dependencies import invoke_llm

# ...
@router.post(
    "/analyze",
    summary="Multi-step heart disease risk analysis (Triage → Diagnosis → Report)",
    response_model=HeartAnalysisResponse,
)
async def analyze_heart(request: Request, req: HeartDiseaseInput):
    """
    Submit clinical data and receive a comprehensive 3-step analysis:

    1. **Triage** — urgency classification + red flags
    2. **Diagnosis** — conditions, risk score, abnormal values
    3. **Report** — full Markdown patient report

    Powered by the configured AI Provider (Bedrock/Groq).
    """
    settings = get_settings()
    patient_summary = _build_patient_summary(req)
    total_tokens = {"prompt": 0, "completion": 0, "total": 0}

    try:
        # =================================================================
        # STEP 1 — Triage
        # =================================================================
        logger.info("🫀 Step 1/3: Triage")
        triage_text, usage1 = await invoke_llm(
            request, TRIAGE_SYSTEM,
            [{"role": "user", "content": f"Patient clinical data:\n\n{patient_summary}"}],
        )
        total_tokens["prompt"] += usage1["prompt_tokens"]
        total_tokens["completion"] += usage1["completion_tokens"]

        try:
            triage = _parse_json_safe(triage_text)
        except json.JSONDecodeError:
            triage = {"raw_response": triage_text, "urgency": "unknown"}

        # =================================================================
        # STEP 2 — Diagnosis  (receives patient data + triage result)
        # =================================================================
        logger.info("🫀 Step 2/3: Diagnosis")
        diagnosis_text, usage2 = await invoke_llm(
            request, DIAGNOSIS_SYSTEM,
            [{"role": "user", "content": (
                f"Patient clinical data:\n\n{patient_summary}\n\n"
                f"Triage assessment:\n{json.dumps(triage, indent=2)}"
            )}],
        )
        total_tokens["prompt"] += usage2["prompt_tokens"]
        total_tokens["completion"] += usage2["completion_tokens"]

        try:
            diagnosis = _parse_json_safe(diagnosis_text)
        except json.JSONDecodeError:
            diagnosis = {"raw_response": diagnosis_text}

        # =================================================================
        # STEP 3 — Report  (receives everything)
        # =================================================================
        logger.info("🫀 Step 3/3: Report generation")
        report_text, usage3 = await invoke_llm(
            request, REPORT_SYSTEM,
            [{"role": "user", "content": (
                f"Patient clinical data:\n\n{patient_summary}\n\n"
                f"Triage assessment:\n{json.dumps(triage, indent=2)}\n\n"
                f"Diagnosis analysis:\n{json.dumps(diagnosis, indent=2)}\n\n"
                f"Generate the full patient report now."
            )}],
        )
        total_tokens["prompt"] += usage3["prompt_tokens"]
        total_tokens["completion"] += usage3["completion_tokens"]

        total_tokens["total"] = total_tokens["prompt"] + total_tokens["completion"]

        logger.info("✅ Heart analysis complete — %d total tokens", total_tokens["total"])

        return {
            "patient_input": req.model_dump(),
            "triage": triage,
            "diagnosis": diagnosis,
            "report": strip_markdown(report_text),
            "model": request.app.state.ai_model,
            "tokens_used": total_tokens,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Heart analysis failed: {str(exc)}",
        ) from exc
