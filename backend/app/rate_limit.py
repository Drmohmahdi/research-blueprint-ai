"""Shared SlowAPI limiter.

Route decorators only take effect when they use the same Limiter instance
wired to FastAPI via app.state.limiter and SlowAPIMiddleware.
"""
import os
import sys

from slowapi import Limiter
from slowapi.util import get_remote_address

is_testing = "pytest" in sys.modules or os.getenv("TESTING") == "True"
limiter = Limiter(key_func=get_remote_address, default_limits=["200/minute"], enabled=not is_testing)
