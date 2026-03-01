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

router = APIRouter(prefix="/symptoms", tags=["Symptom Checker"])

logger = logging.getLogger("uvicorn.error")

# ---------------------------------------------------------------------------
# System prompt
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
You are an experienced medical triage AI assistant. Your role is to help patients understand their symptoms through a conversational assessment.

## Behavior Rules

1. **Ask follow-up questions** to narrow down the diagnosis. Never jump to conclusions from one message.
2. **Ask ONE focused question at a time** — don't overwhelm the patient.
3. **Cover these areas gradually:**
   - Primary symptom details (onset, duration, severity 1-10, location)
   - Associated symptoms (fever, nausea, dizziness, etc.)
   - Medical history (chronic conditions, recent illnesses)
   - Lifestyle factors (smoking, exercise, stress)
   - Medications currently taking
4. **After gathering enough info (typically 3-5 exchanges), provide an assessment.**
5. **Always maintain a warm, professional, empathetic tone.**

## Response Format

You MUST respond with ONLY valid JSON in this exact structure:
{
  "reply": "Your conversational response to the patient",
  "follow_up_questions": ["Question 1 you'd like to ask next", "Alternative question"],
  "suspected_conditions": [
    {"condition": "name", "likelihood": "high|medium|low", "reasoning": "brief explanation"}
  ],
  "urgency": "emergency|high|moderate|low|information_gathering",
  "should_continue": true
}

## Urgency Guidelines
- **emergency**: Chest pain + shortness of breath, stroke symptoms, severe bleeding → Tell them to call 911
- **high**: Persistent high fever, severe pain, breathing difficulty → Recommend urgent care/ER
- **moderate**: Ongoing symptoms needing medical attention → Recommend doctor visit
- **low**: Minor symptoms, self-care possible → Provide advice
- **information_gathering**: Still collecting info, not enough to assess yet

## Important
- Set "should_continue" to false when you've gathered enough info and provided a final assessment
- Keep "suspected_conditions" empty until you have enough data (at least 2-3 exchanges)
- If symptoms suggest EMERGENCY, set urgency immediately regardless of conversation length
- Always include a disclaimer that this is AI-assisted and not a substitute for professional diagnosis"""


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
            "reply": parsed.get("reply", raw_text),
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
