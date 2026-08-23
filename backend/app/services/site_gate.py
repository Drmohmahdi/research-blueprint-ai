"""Temporary development-only access gate — independent of application auth.

Blocks public visibility of the whole platform while under active development.
Enabled only when SITE_GATE_PASSWORD is set on the server; any environment
without it configured (including local development) is completely unaffected.

The frontend static server (server/static-server.mjs) computes the same
SHA-256 token from the same password to independently gate the compiled SPA
bundle before it ever reaches the browser — the prefix and hashing here must
stay in sync with that file.
"""
import hashlib
from typing import Optional

from ..config import settings

GATE_COOKIE_NAME = "baseerah_gate"
_TOKEN_PREFIX = "baseerah-site-gate:"


def _hash_password(password: str) -> str:
    return hashlib.sha256(f"{_TOKEN_PREFIX}{password}".encode("utf-8")).hexdigest()


def get_expected_site_gate_token() -> Optional[str]:
    """The cookie value that unlocks the gate, or None if the gate is disabled."""
    if not settings.SITE_GATE_PASSWORD:
        return None
    return _hash_password(settings.SITE_GATE_PASSWORD)


def verify_site_gate_password(password: str) -> Optional[str]:
    """Returns the cookie token if the password is correct, else None."""
    expected = get_expected_site_gate_token()
    if expected is None:
        return None
    return expected if _hash_password(password) == expected else None
