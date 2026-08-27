"""
Batwa — PIN Service
bcrypt-based PIN hashing and verification.
"""

import bcrypt


def hash_pin(pin: str) -> str:
    """Hash a 4-digit PIN string using bcrypt. Returns the hash as a UTF-8 string."""
    return bcrypt.hashpw(pin.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_pin(pin: str, pin_hash: str) -> bool:
    """Verify a plain PIN against a stored bcrypt hash."""
    return bcrypt.checkpw(pin.encode("utf-8"), pin_hash.encode("utf-8"))
