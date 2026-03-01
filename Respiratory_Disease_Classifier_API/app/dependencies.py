"""
app.dependencies
----------------
Application lifespan manager — loads model & pipeline at startup.
Exposes shared state via ``app.state``.
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager

import joblib
from groq import AsyncGroq
import boto3
import json
import asyncio
from botocore.config import Config

# ... existing imports ...
from app.cache import PredictionCache
from app.config import get_settings
from model_utils import create_respiratory_pipeline

logger = logging.getLogger("uvicorn.error")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup / shutdown logic (replaces deprecated ``on_event``)."""
    settings = get_settings()

    # --- startup ---
    if not __import__("os").path.exists(settings.model_path):
        raise FileNotFoundError(
            f"Model file not found at '{settings.model_path}'. "
            "Make sure respiratory_classifier.pkl is in the project root."
        )

    app.state.model = joblib.load(settings.model_path)
    app.state.pipeline = create_respiratory_pipeline()
    app.state.pipeline.fit([])  # mark stateless transformers as fitted
    app.state.cache = PredictionCache(max_size=settings.cache_max_size)
    
    # --- AI Factory ---
    provider = settings.ai_provider.lower()
    app.state.ai_provider = provider

    if provider == "bedrock":
        boto_config = Config(
            region_name=settings.aws_region_name,
            retries={'max_attempts': 3, 'mode': 'standard'}
        )
        session = boto3.Session(
            aws_access_key_id=settings.aws_access_key_id or None,
            aws_secret_access_key=settings.aws_secret_access_key or None,
        )
        app.state.ai_client = session.client('bedrock-runtime', config=boto_config)
        app.state.ai_model = settings.bedrock_model_id
        logger.info("✅  AI Provider: Amazon Bedrock (%s)", settings.bedrock_model_id)
    elif provider == "groq":
        app.state.ai_client = AsyncGroq(api_key=settings.groq_api_key or None)
        app.state.ai_model = settings.groq_model
        logger.info("✅  AI Provider: Groq (%s)", settings.groq_model)
    else:
        raise ValueError(f"Unsupported AI provider: {provider}")

    app.state.settings = settings
    logger.info("✅  Model loaded from '%s'", settings.model_path)
    
    yield  # app runs here

    # --- shutdown ---
    logger.info("👋  Shutting down")


# ---------------------------------------------------------------------------
# Convenience helpers used by routers
# ---------------------------------------------------------------------------

def get_model(request: Request):
    return request.app.state.model


def get_pipeline(request: Request):
    return request.app.state.pipeline


def get_cache(request: Request) -> PredictionCache:
    return request.app.state.cache


async def invoke_llm(
    request: Request,
    system_prompt: str,
    messages: list[dict],
    temperature: float = 0.4,
    max_tokens: int = 4096,
):
    """
    Unified AI invoker for the platform.
    Handles Bedrock (Claude) and Groq (LLama) cross-compatibility.
    
    Accepts messages in a simple format:
    [{ "role": "user", "content": "text" | [{"type": "text", "text": "..."}, {"type": "image", "data": "base64", "mime": "image/jpeg"}] }]
    """
    provider = request.app.state.ai_provider
    client = request.app.state.ai_client
    model = request.app.state.ai_model
    
    if provider == "bedrock":
        # --- Map to Bedrock/Claude Format ---
        bedrock_messages = []
        for msg in messages:
            content = msg["content"]
            if isinstance(content, list):
                # Multimodal
                mapped_content = []
                for item in content:
                    if item["type"] == "text":
                        mapped_content.append({"type": "text", "text": item["text"]})
                    elif item["type"] == "image":
                        # Convert common image format to Bedrock format
                        mapped_content.append({
                            "type": "image",
                            "source": {
                                "type": "base64",
                                "media_type": item["mime"],
                                "data": item["data"]
                            }
                        })
                bedrock_messages.append({"role": msg["role"], "content": mapped_content})
            else:
                # Simple text
                bedrock_messages.append({"role": msg["role"], "content": content})

        body = json.dumps({
            "anthropic_version": "bedrock-2023-05-31",
            "max_tokens": max_tokens,
            "system": system_prompt,
            "messages": bedrock_messages,
            "temperature": temperature,
        })

        def _invoke():
            return client.invoke_model(
                modelId=model,
                body=body,
                contentType="application/json",
                accept="application/json",
            )

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(None, _invoke)
        resp_body = json.loads(response.get("body").read())
        
        usage = resp_body.get("usage", {})
        return (
            resp_body["content"][0]["text"],
            {
                "prompt_tokens": usage.get("input_tokens", 0),
                "completion_tokens": usage.get("output_tokens", 0),
                "total_tokens": usage.get("input_tokens", 0) + usage.get("output_tokens", 0),
            }
        )

    elif provider == "groq":
        # --- Map to Groq/OpenAI Format ---
        groq_messages = [{"role": "system", "content": system_prompt}]
        for msg in messages:
            content = msg["content"]
            if isinstance(content, list):
                # Multimodal mapping
                mapped_content = []
                for item in content:
                    if item["type"] == "text":
                        mapped_content.append({"type": "text", "text": item["text"]})
                    elif item["type"] == "image":
                        # Convert to data URI for Groq
                        uri = f"data:{item['mime']};base64,{item['data']}"
                        mapped_content.append({
                            "type": "image_url",
                            "image_url": {"url": uri}
                        })
                groq_messages.append({"role": msg["role"], "content": mapped_content})
            else:
                groq_messages.append({"role": msg["role"], "content": content})

        response = await client.chat.completions.create(
            model=model,
            messages=groq_messages,
            temperature=temperature,
            max_completion_tokens=max_tokens,
        )
        
        usage = response.usage
        return (
            response.choices[0].message.content,
            {
                "prompt_tokens": usage.prompt_tokens,
                "completion_tokens": usage.completion_tokens,
                "total_tokens": usage.total_tokens,
            }
        )

    return "No provider configured", {}
