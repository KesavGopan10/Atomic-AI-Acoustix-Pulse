"""
app.routers.drugs
-----------------
Drug interaction checker.
Analyzes a list of medications for interactions, contraindications,
and condition-specific warnings using Groq LLM.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request

from app.anonymizer import anonymizer
from app.config import get_settings
from app.schemas import DrugCheckRequest, DrugCheckResponse
from app.text_formatter import strip_markdown

router = APIRouter(prefix="/drugs", tags=["Drug Interactions"])

logger = logging.getLogger("uvicorn.error")

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are a board-certified clinical pharmacologist AI with expertise in drug-drug interactions, pharmacokinetics, and medication safety.

## Analysis Methodology
For each medication combination, systematically evaluate:

1. **Drug Identification** — Verify each medication: generic name, brand names, drug class, mechanism of action, typical indications, standard dosing range.
2. **Pairwise Interaction Screening** — Check EVERY combination using these interaction pathways:
   - **CYP450 metabolism**: Identify if drugs are substrates, inhibitors, or inducers of CYP1A2, CYP2C9, CYP2C19, CYP2D6, CYP3A4
   - **P-glycoprotein transport**: Drugs affecting P-gp efflux (digoxin, dabigatran, etc.)
   - **Protein binding displacement**: Highly protein-bound drugs competing for albumin
   - **Renal elimination**: Drugs competing for tubular secretion
   - **Pharmacodynamic synergy/antagonism**: Additive effects (e.g., two CNS depressants, dual antiplatelet)
   - **QT prolongation risk**: Cumulative QTc-prolonging effect of multiple drugs
3. **Condition-Specific Contraindications** — If medical condition provided, check drug-disease interactions.
4. **Patient Factor Adjustment** — Age-related pharmacokinetic changes (pediatric/geriatric), allergy cross-reactivity.

## Response Format — ONLY valid JSON:
{
  "interactions": [
    {
      "drug_pair": ["Drug A (generic)", "Drug B (generic)"],
      "severity": "major|moderate|minor|none",
      "type": "pharmacokinetic|pharmacodynamic|additive|synergistic|antagonistic",
      "mechanism": "Specific mechanism (e.g., 'Drug A inhibits CYP3A4, increasing Drug B plasma levels by 40-80%')",
      "clinical_effect": "What the patient may experience",
      "onset": "immediate|hours|days|weeks",
      "evidence_level": "established|probable|suspected|theoretical",
      "management": "Specific action: dose adjustment, monitoring parameter, timing separation, or avoid combination"
    }
  ],
  "warnings": [
    {
      "medication": "Drug name",
      "type": "contraindication|precaution|black_box|allergy_cross_reactivity",
      "description": "Specific warning with clinical context",
      "severity": "critical|high|moderate|low",
      "action_required": "What the patient/provider should do"
    }
  ],
  "safe_summary": "2-3 sentence overall safety assessment with clear risk level",
  "medication_details": [
    {
      "name": "Generic name (Brand name)",
      "class": "Specific drug class",
      "mechanism": "How the drug works",
      "common_uses": "Primary indications",
      "key_side_effects": ["common side effect", "serious but rare effect"],
      "monitoring": "Key labs or vitals to monitor"
    }
  ],
  "timing_recommendations": [
    {
      "drug": "Drug name",
      "best_time": "Morning/Evening/With food/Empty stomach",
      "spacing": "Take X hours apart from Drug Y",
      "reasoning": "Why this timing matters"
    }
  ],
  "recommendations": [
    "Prioritized, actionable recommendation with reasoning"
  ]
}

## Severity Classification
- **major**: Life-threatening risk or permanent damage. Avoid combination or requires intensive monitoring. Evidence: established or probable.
- **moderate**: May worsen patient condition, require dose adjustment, or need lab monitoring. Evidence: probable or suspected.
- **minor**: Minimal clinical significance, but patient should be aware. Evidence: suspected or theoretical.
- **none**: No clinically significant interaction known.

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$).
- Use plain text for numbers and units: "500 mg", "2x daily", "CYP3A4".
- Use plain Unicode: ≥, ≤, ±, →

⛕️ This is AI-generated. All drug decisions require review by a qualified pharmacist or physician."""


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

from app.dependencies import invoke_llm

# ...
@router.post(
    "/check",
    summary="Check drug interactions and safety",
    response_model=DrugCheckResponse,
)
async def check_drugs(request: Request, req: DrugCheckRequest):
    """
    Submit a list of medications and receive:

    - **interactions** — pairwise drug-drug interactions with severity
    - **warnings** — contraindications, black box alerts, allergy flags
    - **safe_summary** — overall safety assessment
    - **report** — full Markdown pharmacology report

    Optionally provide `condition`, `age`, and `allergies` for targeted analysis.

    Powered by the configured AI Provider (Bedrock/Groq).
    """
    # -----------------------------------------------------------------------
    # ANONYMIZATION: de-identify before building the LLM prompt
    # - Age → age bracket (exact age is a HIPAA quasi-identifier)
    # - Condition → free-text scrub (user may accidentally include PII)
    # - Allergen names are NOT PHI (they are drug/substance names)
    # -----------------------------------------------------------------------
    med_list = ", ".join(req.medications)
    context_parts = [f"Medications to analyze: {med_list}"]

    if req.condition:
        # Scrub any inadvertent PHI in the condition free-text field
        clean_condition = anonymizer.scrub_text(req.condition, field_name="drug_condition")
        context_parts.append(f"Patient's medical condition: {clean_condition}")
    if req.age is not None:
        # Replace exact age with HIPAA-safe bracket
        context_parts.append(f"Patient age group: {anonymizer.bucket_age(req.age)}")
    if req.allergies:
        context_parts.append(f"Known drug allergies: {', '.join(req.allergies)}")

    user_prompt = "\n".join(context_parts)

    try:
        # --- Step 1: Structured JSON analysis ---
        raw_json_text, usage1 = await invoke_llm(
            request, SYSTEM_PROMPT, [{"role": "user", "content": user_prompt}], temperature=0.3
        )

        # Parse JSON
        try:
            cleaned = raw_json_text.strip()
            # If the response contains markdown code blocks, extract content
            if "```" in cleaned:
                start_code = cleaned.find("```")
                end_code = cleaned.rfind("```")
                if start_code != -1 and end_code != -1 and end_code > start_code:
                    code_block = cleaned[start_code:end_code+3]
                    lines = code_block.split("\n")
                    # Remove the fences (e.g. ```json and ```)
                    content = "\n".join(lines[1:-1])
                    cleaned = content
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            parsed = {
                "interactions": [],
                "warnings": [],
                "safe_summary": raw_json_text,
                "medication_details": [],
                "recommendations": [],
            }

        # --- Step 2: Human-readable report ---
        report_system_prompt = (
            "You are a clinical pharmacologist generating a comprehensive patient-friendly medication safety report in Markdown.\n\n"
            "## Report Sections (include ALL):\n"
            "### 1. Medication Overview\n"
            "For each drug: what it does, why it's prescribed, how it works in simple terms.\n\n"
            "### 2. Interaction Analysis\n"
            "For each interaction found:\n"
            "- Which drugs interact and severity badge (🔴 Major, 🟠 Moderate, 🟡 Minor)\n"
            "- What could happen in plain language\n"
            "- What to watch for (symptoms/signs)\n"
            "- How to manage it (timing, dose adjustment, monitoring)\n\n"
            "### 3. Safety Warnings\n"
            "List all contraindications, black box warnings, and precautions with clear action items.\n\n"
            "### 4. Medication Timing Guide\n"
            "Create a simple daily schedule table:\n"
            "| Time | Medication | With Food? | Notes |\n\n"
            "### 5. Monitoring Checklist\n"
            "What labs or vitals should be checked, how often, and what values to watch.\n\n"
            "### 6. Questions for Your Doctor\n"
            "5-7 specific, relevant questions the patient should discuss with their provider.\n\n"
            "## OUTPUT FORMATTING — CRITICAL\n"
            "- NEVER use LaTeX syntax (\\\\(, \\\\), \\\\[, \\\\], \\\\frac{}{}, \\\\text{}, $...$).\n"
            "- Use plain Unicode: ≥, ≤, ±, →. Use plain text for dosages.\n"
            "- Format as clean Markdown with headings, bullet points, **bold**, tables.\n"
            "- Keep mobile-friendly: short paragraphs, clear section breaks.\n\n"
            "⛕️ **Disclaimer**: This report is AI-generated for informational purposes only. "
            "All medication decisions must be reviewed by a qualified pharmacist or physician."
        )

        report_text, usage2 = await invoke_llm(
            request,
            report_system_prompt,
            [
                {
                    "role": "user",
                    "content": (
                        f"Patient info:\n{user_prompt}\n\n"
                        f"Analysis results:\n{json.dumps(parsed, indent=2)}\n\n"
                        "Generate the full patient report."
                    ),
                }
            ],
            temperature=0.4
        )

        # Aggregate token usage
        total_tokens = {
            "prompt": usage1["prompt_tokens"] + usage2["prompt_tokens"],
            "completion": usage1["completion_tokens"] + usage2["completion_tokens"],
            "total": usage1["total_tokens"] + usage2["total_tokens"],
        }

        return {
            "medications_checked": req.medications,
            "interactions": parsed.get("interactions", []),
            "warnings": parsed.get("warnings", []),
            "safe_summary": strip_markdown(parsed.get("safe_summary", "")),
            "report": strip_markdown(report_text),
            "model": request.app.state.ai_model,
            "tokens_used": total_tokens,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Drug interaction check failed: {str(exc)}",
        ) from exc
