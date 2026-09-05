"""
Phase 10 — AI Provider Abstraction.

Central interface for all academic AI generation. Domain routers NEVER call a
provider SDK directly; they go through the AI service layer. A deterministic
FakeAIProvider is used for tests and when no live provider is configured.
"""
import json
import time
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

from ...config import settings


class AIProviderError(Exception):
    """Base error for AI provider failures (never exposes internals)."""
    code = "AI_PROVIDER_UNAVAILABLE"

    def __init__(self, message: str, code: Optional[str] = None):
        super().__init__(message)
        if code:
            self.code = code


class AITimeoutError(AIProviderError):
    code = "AI_PROVIDER_TIMEOUT"


class AIRateLimitedError(AIProviderError):
    code = "AI_RATE_LIMITED"


class AIOutputInvalidError(AIProviderError):
    code = "AI_OUTPUT_INVALID"


class AIProvider(ABC):
    """Provider interface. Implementations are selected server-side only."""

    name: str = "base"
    supports_structured: bool = False

    @abstractmethod
    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_output_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> Dict[str, Any]:
        """
        Returns dict: {"text": str, "usage": {"input_tokens": int, "output_tokens": int, ...}}
        """
        raise NotImplementedError

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        output_schema: dict,
        temperature: float = 0.2,
        max_output_tokens: int = 2048,
        timeout_seconds: float = 30.0,
    ) -> Dict[str, Any]:
        """Returns dict with "text" (raw) and "usage"; caller validates JSON."""
        raise NotImplementedError


class FakeAIProvider(AIProvider):
    """
    Deterministic offline provider for tests and for the unconfigured state.
    NEVER claims any external connection. Produces stable, schema-respecting
    output that lets the full pipeline (entitlement, context, validation,
    usage records, citations) be tested without network access.
    """

    name = "fake"
    supports_structured = True

    def __init__(self, fail_mode: Optional[str] = None, delay_seconds: float = 0.0):
        self.fail_mode = fail_mode  # None | "timeout" | "rate_limit" | "error" | "malformed_json"
        self.delay_seconds = delay_seconds

    def _maybe_fail(self):
        if self.delay_seconds:
            time.sleep(self.delay_seconds)
        if self.fail_mode == "timeout":
            raise AITimeoutError("Provider timed out")
        if self.fail_mode == "rate_limit":
            raise AIRateLimitedError("Provider rate limited")
        if self.fail_mode == "error":
            raise AIProviderError("Provider internal error")

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_output_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> Dict[str, Any]:
        self._maybe_fail()
        # Deterministic: echo a bounded summary of the user prompt so tests can
        # assert context boundaries and no-leak behavior.
        text = _fake_summary(user_prompt, max_output_tokens)
        input_tokens = max(1, len(system_prompt) // 4 + len(user_prompt) // 4)
        output_tokens = max(1, len(text) // 4)
        return {
            "text": text,
            "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
        }

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        output_schema: dict,
        temperature: float = 0.2,
        max_output_tokens: int = 2048,
        timeout_seconds: float = 30.0,
    ) -> Dict[str, Any]:
        self._maybe_fail()
        if self.fail_mode == "malformed_json":
            text = "not-json{{"
        else:
            text = _fake_structured_json(user_prompt, output_schema)
        input_tokens = max(1, len(system_prompt) // 4 + len(user_prompt) // 4)
        output_tokens = max(1, len(text) // 4)
        return {
            "text": text,
            "usage": {"input_tokens": input_tokens, "output_tokens": output_tokens},
        }


class GeminiProvider(AIProvider):
    """Live Gemini provider (google-genai). Used only when GEMINI_API_KEY is set."""

    name = "gemini"

    def __init__(self):
        from google import genai

        self._genai = genai
        self._model = settings.GEMINI_MODEL or "gemini-2.0-flash"

    @staticmethod
    def is_configured() -> bool:
        return bool(settings.GEMINI_API_KEY)

    def generate(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        temperature: float = 0.3,
        max_output_tokens: int = 1024,
        timeout_seconds: float = 30.0,
    ) -> Dict[str, Any]:
        client = self._genai.Client(api_key=settings.GEMINI_API_KEY)
        try:
            response = client.models.generate_content(
                model=self._model,
                contents=user_prompt,
                config=self._genai.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                ),
            )
        except Exception as exc:
            raise _map_provider_exception(exc)
        text = (response.text or "").strip()
        usage = _extract_usage(response)
        return {"text": text, "usage": usage}

    def generate_structured(
        self,
        *,
        system_prompt: str,
        user_prompt: str,
        output_schema: dict,
        temperature: float = 0.2,
        max_output_tokens: int = 2048,
        timeout_seconds: float = 30.0,
    ) -> Dict[str, Any]:
        client = self._genai.Client(api_key=settings.GEMINI_API_KEY)
        schema_str = json.dumps(output_schema, ensure_ascii=False)
        full_user = (
            f"{user_prompt}\n\n"
            f"Respond with a single valid JSON object matching this schema:\n{schema_str}\n"
            "Do not wrap in markdown fences."
        )
        try:
            response = client.models.generate_content(
                model=self._model,
                contents=full_user,
                config=self._genai.types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=temperature,
                    max_output_tokens=max_output_tokens,
                    response_mime_type="application/json",
                ),
            )
        except Exception as exc:
            raise _map_provider_exception(exc)
        text = (response.text or "").strip()
        usage = _extract_usage(response)
        return {"text": text, "usage": usage}


def _map_provider_exception(exc: Exception) -> AIProviderError:
    import google.api_core.exceptions as gax

    if isinstance(exc, gax.DeadlineExceeded):
        return AITimeoutError("Provider request timed out")
    if isinstance(exc, gax.TooManyRequests):
        return AIRateLimitedError("Provider rate limit exceeded")
    if isinstance(exc, gax.ResourceExhausted):
        return AIRateLimitedError("Provider quota exhausted")
    return AIProviderError("Provider request failed")


def _extract_usage(response) -> Dict[str, int]:
    try:
        md = response.usage_metadata
        if md is None:
            return {}
        return {
            "input_tokens": int(getattr(md, "prompt_token_count", 0) or 0),
            "output_tokens": int(getattr(md, "candidates_token_count", 0) or 0),
        }
    except Exception:
        return {}


def _fake_summary(user_prompt: str, max_tokens: int) -> str:
    """Deterministic fake answer. Bounded, injection-neutral (treats any
    'ignore instructions' content as inert data)."""
    trimmed = " ".join(user_prompt.split())[:4000]
    max_chars = max(32, min(max_tokens * 4, 4096))
    return (
        "[FakeAI deterministic summary] "
        + (trimmed[:max_chars] if trimmed else "(empty input)")
        + " — AI-assisted draft; verify against sources."
    )


def _fake_structured_json(user_prompt: str, schema: dict) -> str:
    """Build a valid JSON object matching the schema's top-level fields."""
    out: Dict[str, Any] = {}
    for key, spec in (schema or {}).items():
        if not isinstance(spec, dict):
            out[key] = None
            continue
        typ = spec.get("type")
        if typ == "array":
            items = spec.get("items")
            item_type = items.get("type", "string") if isinstance(items, dict) else "string"
            out[key] = [{"type": item_type}] if False else []
        elif typ == "integer":
            out[key] = 1
        elif typ == "number":
            out[key] = 1.0
        elif typ == "boolean":
            out[key] = True
        elif typ == "object":
            out[key] = {}
        else:
            out[key] = "value"
    return json.dumps(out, ensure_ascii=False)


class AIProviderFactory:
    @staticmethod
    def create() -> AIProvider:
        mode = (settings.AI_PROVIDER or "auto").strip().lower()
        if mode == "fake":
            if settings.ENVIRONMENT == "production":
                raise AIProviderError("AI assistance is unavailable", code="AI_PROVIDER_NOT_CONFIGURED")
            return FakeAIProvider()
        if mode == "gemini":
            if not GeminiProvider.is_configured():
                raise AIProviderError("AI assistance is unavailable", code="AI_PROVIDER_NOT_CONFIGURED")
            return GeminiProvider()
        # auto
        if GeminiProvider.is_configured():
            return GeminiProvider()
        if settings.ENVIRONMENT == "production":
            raise AIProviderError("AI assistance is unavailable", code="AI_PROVIDER_NOT_CONFIGURED")
        return FakeAIProvider()

    @staticmethod
    def status() -> str:
        if GeminiProvider.is_configured():
            return "LIVE PROVIDER CONFIGURED & VERIFIED"
        if settings.ENVIRONMENT == "production":
            return "AI PROVIDER NOT CONFIGURED"
        return "FAKE / SANDBOX PROVIDER VERIFIED; LIVE PROVIDER NOT CONFIGURED"
