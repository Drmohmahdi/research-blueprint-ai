"""Small dependency-free operational logging and request correlation layer."""

from __future__ import annotations

import contextvars
import datetime
import json
import logging
import re
import sys
from typing import Any

from .config import settings

request_id_context: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="-")
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")
_SENSITIVE_KEYS = {"authorization", "cookie", "password", "token", "api_key", "secret", "prompt", "content"}


def _safe(value: Any, limit: int = 256) -> Any:
    if value is None or isinstance(value, (bool, int, float)):
        return value
    text = _CONTROL_CHARS.sub(" ", str(value)).replace("\r", " ").replace("\n", " ")
    return text[:limit]


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
            "level": record.levelname,
            "event": _safe(getattr(record, "event", record.getMessage()), 128),
            "request_id": _safe(getattr(record, "request_id", request_id_context.get()), 64),
        }
        fields = getattr(record, "fields", {})
        if isinstance(fields, dict):
            for key, value in fields.items():
                if key.lower() not in _SENSITIVE_KEYS:
                    payload[key] = _safe(value)
        if record.exc_info:
            payload["exception_type"] = record.exc_info[0].__name__ if record.exc_info[0] else "Exception"
        return json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def configure_logging() -> logging.Logger:
    logger = logging.getLogger("baseerah")
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JsonFormatter())
        logger.addHandler(handler)
    logger.setLevel(getattr(logging, settings.LOG_LEVEL, logging.INFO))
    logger.propagate = False
    return logger


logger = configure_logging()


def log_event(level: int, event: str, **fields: Any) -> None:
    logger.log(level, event, extra={"event": event, "fields": fields})
