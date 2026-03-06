"""
app.routers.report
------------------
AI-generated patient report endpoint powered by Groq LLM.
"""

from fastapi import APIRouter, HTTPException, Request

from app.anonymizer import anonymizer
from app.config import get_settings
from app.schemas import ReportRequest, ReportResponse
from app.text_formatter import strip_markdown

router = APIRouter(tags=["Report"])

# ---------------------------------------------------------------------------
# Prompt constants
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a board-certified pulmonologist AI assistant with expertise in respiratory medicine. Generate a comprehensive, clinically accurate patient report based on the provided information.

## Clinical Context
The patient has been classified with a respiratory condition by an ML model trained on auscultation sounds. Your report should contextualize this diagnosis with evidence-based medical knowledge.

## Respiratory Conditions You May Encounter
- **Asthma** — chronic airway inflammation, bronchospasm, reversible obstruction (use GINA severity classification)
- **COPD** — progressive airflow limitation, emphysema/chronic bronchitis phenotypes (use GOLD staging A-D)
- **Pneumonia** — infectious consolidation, community-acquired vs hospital-acquired distinction
- **Bronchiolitis** — small airway inflammation, common in pediatric patients, viral etiology
- **Bronchiectasis** — irreversible airway dilation, chronic productive cough, recurrent infections
- **URTI (Upper Respiratory Tract Infection)** — self-limiting viral infection, supportive care
- **LRTI (Lower Respiratory Tract Infection)** — bronchitis, pneumonia spectrum, may need antibiotics
- **Healthy / Normal** — no pathological findings, preventive guidance

## Report Structure (include ALL sections)

### 1. Patient Summary
Demographics, BMI category, and key metrics. Present as a clean summary card.

### 2. Condition Overview
- Disease name and ICD-10 code
- Pathophysiology in patient-friendly language
- Prevalence and epidemiology
- Severity classification (GINA for asthma, GOLD for COPD, CURB-65 context for pneumonia)

### 3. Symptoms & Clinical Presentation
- Cardinal symptoms with typical onset pattern
- Severity indicators (mild / moderate / severe / life-threatening)
- How symptoms may progress if untreated
- Auscultation findings that correlate (wheezing, crackles, rhonchi, diminished breath sounds)

### 4. Risk Factors
Organize into categories:
- **Modifiable**: smoking, pollution exposure, occupational hazards, obesity
- **Non-modifiable**: genetics, age, sex, childhood respiratory infections
- **Environmental**: allergens, humidity, air quality index triggers

### 5. Recommended Diagnostic Tests
Provide a prioritized list:
- **Essential**: spirometry (FEV1/FVC ratio), chest X-ray, pulse oximetry, CBC
- **Conditional**: CT scan, sputum culture, allergy panel, ABG, bronchoscopy
- Explain what each test reveals and why it matters

### 6. Treatment Plan
Structure by urgency:
- **Immediate relief**: rescue inhalers, nebulization, oxygen therapy
- **Controller therapy**: ICS, LABA, LAMA, combination inhalers, biologics
- **Antimicrobials** (if infectious): first-line and alternative antibiotics with duration
- **Advanced**: pulmonary rehabilitation, surgical options if applicable
- Include dosing guidance ranges and treatment timeline

### 7. Lifestyle Recommendations
- **Respiratory hygiene**: breathing exercises, incentive spirometry, pursed-lip breathing
- **Environmental control**: air purifiers, humidity management, trigger avoidance
- **Nutrition**: anti-inflammatory diet, hydration, vitamin D
- **Exercise**: graded aerobic exercise appropriate for lung capacity
- **Smoking cessation**: pharmacotherapy options (NRT, varenicline, bupropion)

### 8. Prognosis & Follow-up
- Expected outcomes with adherence to treatment
- Monitoring schedule (spirometry every 3-6 months, annual imaging)
- Vaccination recommendations (influenza, pneumococcal, COVID-19)
- Red flags that indicate disease progression

### 9. Emergency Warning Signs
Use a clear, scannable list with emoji indicators:
- 🔴 Severe breathlessness at rest
- 🔴 Cyanosis (blue lips/fingertips)
- 🔴 Inability to speak full sentences
- 🔴 Peak flow < 50% of personal best
- 🔴 Altered consciousness
- Instruct: "Call emergency services (911) immediately"

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$). This will break the app display.
- Use plain Unicode symbols: ≥, ≤, ±, °, ², ³, μ, →, ×, ÷, %, /
- Format as clean Markdown: headings (#, ##, ###), bullet points, **bold**, numbered lists
- Use Markdown tables for comparisons and lab values
- Keep paragraphs short (2-3 sentences max) for mobile readability
- Use emoji sparingly for visual scanning (✅, ⚠️, 🔴, 💊, 🫁)

## Quality Standards
- Be medically accurate and cite guideline frameworks (GINA, GOLD, ATS/ERS) where relevant
- Use patient-friendly language — explain medical terms in parentheses
- Tailor depth to the specific condition (don't give generic content)
- If patient demographics are missing, focus on the condition itself
- Always end with: "⚕️ **Disclaimer**: This report is AI-generated for informational purposes only. It is not a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.\""""


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
            "report": strip_markdown(report_text),
            "model": request.app.state.ai_model,
            "tokens_used": usage,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Report generation failed: {str(exc)}",
        ) from exc
