"""
app.routers.report
------------------
AI-generated patient report endpoint powered by Groq LLM.
"""

from fastapi import APIRouter, HTTPException, Request

from app.anonymizer import anonymizer
from app.config import get_settings
from app.schemas import ReportRequest, ReportResponse

router = APIRouter(tags=["Report"])

# ---------------------------------------------------------------------------
# Prompt constants
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a senior pulmonologist AI assistant.
Generate a detailed, professional patient report based on the information provided.

The report must include ALL of the following sections:

1. **Patient Summary** – Demographics and key metrics provided.
2. **Condition Overview** – What the diagnosed condition is, pathophysiology, and prevalence.
3. **Symptoms & Clinical Presentation** – Typical symptoms, how they manifest, severity indicators.
4. **Risk Factors** – Lifestyle, environmental, genetic, and age-related risk factors.
5. **Recommended Diagnostic Tests** – Lab work, imaging, spirometry, etc.
6. **Treatment Plan** – Medications, therapies, lifestyle modifications, and timeline.
7. **Lifestyle Recommendations** – Diet, exercise, smoking cessation, environmental adjustments.
8. **Prognosis & Follow-up** – Expected outcomes, monitoring schedule, red flags.
9. **Emergency Warning Signs** – When to seek immediate medical attention.

Format the report in clean Markdown with clear headings.
Be medically accurate but understandable to a patient.
If patient demographics are not provided, focus on the condition itself.
Always include a disclaimer that this is AI-generated and not a substitute for professional medical advice."""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _build_patient_context(req: ReportRequest) -> str:
    """
    Build an anonymized patient context string.
    Exact age/height/weight are replaced with HIPAA-safe brackets
    before this string is ever sent to the cloud AI model.
    """
    parts = [f"Diagnosed condition: **{req.disease.value}**"]
    # --- ANONYMIZATION: replace exact values with safe brackets ---
    if req.age is not None:
        parts.append(f"Age group: {anonymizer.bucket_age(req.age)}")
    if req.height is not None:
        parts.append(f"Height range: {anonymizer.bracket_height(req.height)}")
    if req.weight is not None:
        parts.append(f"Weight range: {anonymizer.bracket_weight(req.weight)}")
    # BMI is derived from exact height+weight — omit to prevent re-identification
    if req.height and req.weight:
        # Send BMI category instead of exact value
        bmi = req.weight / ((req.height / 100) ** 2)
        if bmi < 18.5:
            bmi_label = "Underweight (BMI < 18.5)"
        elif bmi < 25:
            bmi_label = "Normal weight (BMI 18.5–24.9)"
        elif bmi < 30:
            bmi_label = "Overweight (BMI 25–29.9)"
        else:
            bmi_label = "Obese (BMI ≥ 30)"
        parts.append(f"BMI category: {bmi_label}")
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

from app.dependencies import invoke_llm

# ...
@router.post(
    "/report",
    summary="Generate a patient report using AI",
    response_model=ReportResponse,
)
async def generate_report(request: Request, req: ReportRequest):
    """
    Generate a comprehensive patient report for a respiratory condition
    using the configured AI Provider (Bedrock/Groq).

    - **disease** (required) – one of the 8 classified conditions
    - **age**, **height**, **weight** – optional patient details
    """
    patient_context = _build_patient_context(req)

    user_prompt = (
        f"Generate a comprehensive patient report for the following:\n\n"
        f"{patient_context}\n\n"
        f"Please provide a thorough, professional medical report."
    )

    try:
        report_text, usage = await invoke_llm(
            request, 
            SYSTEM_PROMPT, 
            [{"role": "user", "content": user_prompt}], 
            temperature=0.6
        )

        return {
            "disease": req.disease.value,
            "patient_info": {
                "age": req.age,
                "height": req.height,
                "weight": req.weight,
            },
            "report": report_text,
            "model": request.app.state.ai_model,
            "tokens_used": usage,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(exc)}",
        ) from exc
