# backend/app/auth_utils.py (New File)
import os
import logging
import json
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from fastapi import HTTPException, status

from hkdf import Hkdf  # type: ignore
from jose import jwe, jwt, JWTError  # type: ignore
from pydantic import BaseModel, ValidationError

# Load environment variables
JWT_SECRET = os.environ.get("JWT_SECRET_KEY")
ALGORITHM = "HS256"
NEXTAUTH_SECRET = os.environ.get("NEXTAUTH_SECRET")  # If set, enables JWE (NextAuth) session token support
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ.get("ACCESS_TOKEN_EXPIRE_MINUTES", 60 * 24))


logger = logging.getLogger(__name__)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Creates a new JWT access token."""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    
    if not JWT_SECRET:
        raise ValueError("JWT_SECRET_KEY is not set, cannot create token.")

    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)
    return encoded_jwt

def validate_auth_config() -> None:
    """Validate required authentication configuration at application startup.

    Call this from the FastAPI lifespan context manager so that a config error
    raises at startup (with a clear message) rather than crashing at the first
    authenticated request, and rather than at module-import time (which breaks
    unit tests that mock the environment).
    """
    if not JWT_SECRET:
        logger.error("CRITICAL: JWT_SECRET_KEY environment variable is not set.")
        raise ValueError("JWT_SECRET_KEY must be set in the environment.")

    if len(JWT_SECRET) < 32:
        logger.error(
            "CRITICAL: JWT_SECRET_KEY is too short (%d chars). Minimum 32 characters required.",
            len(JWT_SECRET),
        )
        raise ValueError("JWT_SECRET_KEY must be at least 32 characters long.")

    logger.info("Auth configuration validated successfully.")


class TokenPayload(BaseModel):
    """Pydantic model for expected JWT payload structure AFTER decryption"""
    sub: str # User ID (subject)
    name: Optional[str] = None
    email: Optional[str] = None
    picture: Optional[str] = None
    role: Optional[str] = None
    google_sub: Optional[str] = None
    allow_email_checkins: Optional[bool] = None
    iat: Optional[int] = None # Issued at timestamp
    exp: Optional[int] = None # Expiration timestamp
    accessToken: Optional[str] = None

# --- HKDF Key Derivation Helper ---
def _derive_encryption_key(secret: str) -> bytes:
    """
    Derives the encryption key from the shared secret using HKDF,
    matching NextAuth v4's likely parameters.
    """
    # Encode the necessary strings to bytes
    secret_bytes = secret.encode('utf-8')
    # For NextAuth v4, salt is typically empty, info is specific string
    salt_bytes = b""
    info_bytes = b"NextAuth.js Generated Encryption Key"
    # Key length for A256CBC-HS512 (common in v4 JWE) is 64 bytes (512 bits)
    key_length_bytes = 32

    try:
        hkdf = Hkdf(salt_bytes, secret_bytes)
        derived_key = hkdf.expand(info_bytes, key_length_bytes)
        # logger.debug(f"Derived HKDF key length: {len(derived_key)} bytes") # For debugging
        if len(derived_key) != key_length_bytes:
             # This shouldn't happen with hkdf.expand but good check
             raise ValueError(f"Derived key length is incorrect. Expected {key_length_bytes}, got {len(derived_key)}.")
        return derived_key
    except Exception as e:
        logger.error("Failed to derive encryption key using HKDF: %s", e)
        raise RuntimeError("Could not derive necessary encryption key.")

def _try_decode_jwt(token: str) -> TokenPayload | None:
    """Attempt to decode a standard HS256 JWT token."""
    if not JWT_SECRET:
        logger.warning("JWT_SECRET not available for JWT decoding")
        return None
    try:
        payload_dict = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        logger.debug("Successfully decoded JWT. Payload keys: %s", list(payload_dict.keys()))
        return TokenPayload(**payload_dict)
    except JWTError as e:
        logger.warning("JWT decode failed: %s: %s", type(e).__name__, e)
        return None
    except ValidationError as e:
        logger.warning("JWT payload validation failed: %s", e)
        return None
    except Exception as e:
        logger.error("Unexpected error decoding JWT: %s: %s", type(e).__name__, e)
        return None


def _try_decrypt_nextauth_jwe(token: str) -> TokenPayload | None:
    """Attempt to decrypt a NextAuth style JWE (5 segments) using HKDF derived key."""
    if not (NEXTAUTH_SECRET or JWT_SECRET):
        return None
    secret_source = NEXTAUTH_SECRET or JWT_SECRET  # fallback so deploys with one secret still work
    if not secret_source:
        return None
    try:
        key = _derive_encryption_key(secret_source)  # 32 bytes
        plaintext = jwe.decrypt(token, key)  # bytes
        # NextAuth encodes JSON string
        try:
            payload_dict = json.loads(plaintext.decode("utf-8"))  # type: ignore[arg-type]
        except Exception:
            return None
        # Some NextAuth payloads nest user inside 'user' key; flatten important fields
        if isinstance(payload_dict, dict):
            # Promote nested user fields if present
            user_section = payload_dict.get("user")
            if isinstance(user_section, dict):
                for k in ["id", "name", "email", "role", "google_sub", "allow_email_checkins"]:
                    if k in user_section and k not in payload_dict:
                        payload_dict[k] = user_section[k]
        return TokenPayload(**payload_dict)
    except Exception as e:
        logger.debug("NextAuth JWE decryption failed: %s", e)
        return None


def decrypt_and_validate_token(token: str) -> TokenPayload:
    """Validate HS256 JWT or (if configured) decrypt NextAuth JWE session token."""
    if not JWT_SECRET:
         # Should not happen if checked at startup, but safeguard anyway
         logger.error("JWT Secret Key is missing, cannot decrypt token.")
         raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail="Authentication configuration error.",
         )

    parts = token.split(".")
    logger.debug("Token has %d segments (first 20 chars: %s...)", len(parts), token[:20])

    payload: TokenPayload | None = None
    if len(parts) == 3:
        # HS256 JWT
        logger.debug("Attempting to decode as HS256 JWT (3 segments)")
        payload = _try_decode_jwt(token)
        if payload:
            logger.debug("Successfully validated JWT for user: %s", payload.sub)
    elif len(parts) == 5:
        # Likely NextAuth JWE
        logger.debug("Attempting to decrypt as NextAuth JWE (5 segments)")
        payload = _try_decrypt_nextauth_jwe(token)
        if payload:
            logger.debug("Successfully decrypted NextAuth JWE for user: %s", payload.sub)
    else:
        logger.warning("Unsupported token format with %d segments", len(parts))

    if not payload:
        logger.error("Token validation failed for all attempted methods")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: invalid token",
            headers={"WWW-Authenticate": 'Bearer error="invalid_token"'},
        )
    
    return payload
