"""
app.routers.symptoms
--------------------
Conversational symptom checker chatbot.

Stateless design — the client sends the full conversation history each time.
No server-side sessions, no Redis — the frontend manages chat state.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, HTTPException, Request

from app.anonymizer import anonymizer

from app.config import get_settings
from app.schemas import SymptomChatRequest, SymptomChatResponse
from app.text_formatter import strip_markdown

router = APIRouter(prefix="/symptoms", tags=["Symptom Checker"])

logger = logging.getLogger("uvicorn.error")

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an experienced emergency medicine and primary care AI triage assistant. Your role is to conduct a systematic symptom assessment through conversational dialogue, mimicking a skilled clinician's history-taking process.

## Core Clinical Methodology — SOCRATES Framework
Use this structured approach to assess each symptom:
- **S**ite — Where exactly is the symptom?
- **O**nset — When did it start? Sudden or gradual?
- **C**haracter — What does it feel like? (sharp, dull, burning, pressure, etc.)
- **R**adiation — Does it spread anywhere?
- **A**ssociations — Any other symptoms alongside it?
- **T**ime course — Constant or intermittent? Getting better/worse/same?
- **E**xacerbating/relieving — What makes it better or worse?
- **S**everity — Rate 1-10, impact on daily activities

## Conversation Flow
1. **Opening** (message 1): Acknowledge symptom warmly. Ask the single most clinically important follow-up question.
2. **Assessment** (messages 2-4): Work through SOCRATES systematically, ONE question per message. Prioritize questions that differentiate dangerous from benign conditions.
3. **Red flag screening** (by message 3): Actively screen for emergency signs relevant to the reported symptom.
4. **Synthesis** (messages 4-6): Once enough data gathered, provide a structured assessment with suspected conditions and recommendations.

## Behavior Rules
1. Ask ONE focused, specific question per message — never overwhelm with multiple questions.
2. Frame questions conversationally, not like a medical form.
3. Adapt follow-up questions based on previous answers — show clinical reasoning.
4. Prioritize ruling out dangerous conditions FIRST (e.g., chest pain → rule out MI before GERD).
5. Consider patient's age group and sex in differential diagnosis weighting.
6. If history involves medications, consider drug side effects as a differential.

## Response Format

You MUST respond with ONLY valid JSON in this exact structure:
{
  "reply": "Your conversational response — warm, professional, empathetic. Use plain language. Include brief clinical reasoning when providing an assessment (e.g., 'Based on the sharp, localized pain that worsens with breathing, this pattern is most consistent with...').",
  "follow_up_questions": ["Primary next question", "Alternative if patient can't answer the first"],
  "suspected_conditions": [
    {
      "condition": "Specific condition name",
      "likelihood": "high|medium|low",
      "key_features": ["matching symptom 1", "matching symptom 2"],
      "reasoning": "Why this condition fits the symptom pattern"
    }
  ],
  "urgency": "emergency|high|moderate|low|information_gathering",
  "should_continue": true,
  "red_flags_checked": ["specific dangerous condition ruled out or flagged"]
}

## Urgency Classification (evidence-based)
- **emergency** (call 911 NOW):
  - Chest pain + dyspnea + diaphoresis → ACS
  - Worst headache of life + neck stiffness → SAH
  - Sudden weakness/speech changes → Stroke (FAST criteria)
  - Severe allergic reaction with airway compromise → Anaphylaxis
  - Heavy bleeding that won't stop
- **high** (ER / urgent care within hours):
  - Persistent fever > 39.5°C / 103°F with rigors
  - Severe abdominal pain with guarding
  - Acute breathing difficulty at rest
  - Suspected fracture or dislocation
- **moderate** (see doctor within 24-48h):
  - Persistent symptoms > 1 week without improvement
  - Moderate pain affecting sleep or daily activities
  - New skin rashes with systemic symptoms
  - Recurrent episodes of the same symptom
- **low** (self-care + routine appointment):
  - Mild cold/flu symptoms < 7 days
  - Minor aches/pains with clear cause
  - Stable chronic symptoms without change
- **information_gathering**: Still collecting data, cannot assess yet

## OUTPUT FORMATTING — CRITICAL
- NEVER use LaTeX syntax (\\(, \\), \\[, \\], \\frac{}{}, \\text{}, $...$) in the reply field.
- Use plain text with Unicode symbols: ≥, ≤, ±, °
- Write values naturally: "temperature 38.5°C", "pain 7/10", "BP 140/90 mmHg"
- Keep replies warm, concise, and mobile-friendly.

## Important Rules
- Set "should_continue" to false when you've gathered enough info and provided a final assessment
- Keep "suspected_conditions" empty until you have enough data (at least 2-3 exchanges)
- If symptoms suggest EMERGENCY, set urgency immediately regardless of conversation length — patient safety first
- Always include a disclaimer that this is AI-assisted and not a substitute for professional diagnosis
- Never diagnose definitively — use language like "this pattern is most consistent with" or "could suggest\""""


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

from app.dependencies import invoke_llm

# ...
@router.post(
    "/chat",
    summary="Conversational symptom checker",
    response_model=SymptomChatResponse,
)
async def symptom_chat(request: Request, req: SymptomChatRequest):
    """
    Send your conversation history and receive an AI doctor's response.

    **How to use:**
    1. Start with your symptom: `{"messages": [{"role": "user", "content": "I have a headache"}]}`
    2. Send the full history + AI reply + your next message each time
    3. Continue until `should_continue` is `false`

    The API is **stateless** — your frontend manages the chat history.

    Powered by the configured AI Provider (Bedrock/Groq).
    """
    # -----------------------------------------------------------------------
    # ANONYMIZATION: scrub PHI from every message before sending to cloud AI
    # Free-text chat is the highest-risk PHI surface — patients may include
    # their name, DOB, phone number, address, or MRN in natural language.
    # -----------------------------------------------------------------------
    raw_messages = [
        {"role": msg.role, "content": msg.content}
        for msg in req.messages
    ]
    messages = anonymizer.scrub_messages(raw_messages, field_prefix="symptom_chat")

    try:
        raw_text, usage = await invoke_llm(
            request, SYSTEM_PROMPT, messages, temperature=0.4
        )

        # Parse structured response
        try:
            # Strip markdown code fences if present
            cleaned = raw_text.strip()
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
            
            # Simple JSON parse
            parsed = json.loads(cleaned)
        except json.JSONDecodeError:
            # Fallback: return raw text as the reply
            parsed = {
                "reply": raw_text,
                "follow_up_questions": [],
                "suspected_conditions": [],
                "urgency": "information_gathering",
                "should_continue": True,
            }

        return {
            "reply": strip_markdown(parsed.get("reply", raw_text)),
            "follow_up_questions": parsed.get("follow_up_questions", []),
            "suspected_conditions": parsed.get("suspected_conditions", []),
            "urgency": parsed.get("urgency", "information_gathering"),
            "should_continue": parsed.get("should_continue", True),
            "tokens_used": usage,
        }

    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Symptom chat failed: {str(exc)}",
        ) from exc
