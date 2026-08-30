"""
Batwa — Admin authentication

Admin access is intentionally separate from customer PINs. The configured
admin PIN is exchanged for a short-lived bearer token before dashboard data
can be read.
"""

import base64
import hashlib
import hmac
import json
import os
import secrets
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer


ADMIN_PIN_ENV = "BATWA_ADMIN_PIN"
DEFAULT_ADMIN_PIN = "2468"
TOKEN_SECRET_ENV = "BATWA_ADMIN_TOKEN_SECRET"
TOKEN_TTL_ENV = "BATWA_ADMIN_TOKEN_TTL_SECONDS"
DEFAULT_TOKEN_TTL_SECONDS = 3600

_token_secret = os.getenv(TOKEN_SECRET_ENV) or secrets.token_urlsafe(32)
bearer_scheme = HTTPBearer(auto_error=False)


class AdminAuthError(Exception):
    """Base error for expected admin authentication failures."""


def _configured_pin() -> str:
    return os.getenv(ADMIN_PIN_ENV, DEFAULT_ADMIN_PIN).strip() or DEFAULT_ADMIN_PIN


def _token_ttl_seconds() -> int:
    try:
        return max(60, int(os.getenv(TOKEN_TTL_ENV, DEFAULT_TOKEN_TTL_SECONDS)))
    except ValueError:
        return DEFAULT_TOKEN_TTL_SECONDS


def _encode(value: bytes) -> str:
    return base64.urlsafe_b64encode(value).rstrip(b"=").decode("ascii")


def _decode(value: str) -> bytes:
    return base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))


def issue_admin_token(pin: str) -> tuple[str, int]:
    """Validate the configured PIN and return a signed token plus its TTL."""
    if not hmac.compare_digest(pin, _configured_pin()):
        raise AdminAuthError

    expires_at = int(time.time()) + _token_ttl_seconds()
    payload = _encode(json.dumps({"exp": expires_at}, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(_token_secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).digest()
    return f"{payload}.{_encode(signature)}", expires_at - int(time.time())


def verify_admin_token(token: str) -> None:
    """Raise when a token is malformed, forged, or expired."""
    try:
        payload_part, signature_part = token.split(".", 1)
        expected_signature = hmac.new(
            _token_secret.encode("utf-8"),
            payload_part.encode("ascii"),
            hashlib.sha256,
        ).digest()
        if not hmac.compare_digest(_decode(signature_part), expected_signature):
            raise AdminAuthError
        payload = json.loads(_decode(payload_part))
        if int(payload["exp"]) <= int(time.time()):
            raise AdminAuthError
    except (AdminAuthError, KeyError, TypeError, ValueError, UnicodeDecodeError):
        raise AdminAuthError


def require_admin(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> None:
    """FastAPI dependency protecting admin-only read endpoints."""
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Admin authentication required.")
    try:
        verify_admin_token(credentials.credentials)
    except AdminAuthError:
        raise HTTPException(status_code=401, detail="Admin authentication required.")
