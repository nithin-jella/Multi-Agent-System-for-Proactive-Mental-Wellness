# backend/app/utils/security_utils.py
"""
DEPRECATED: Encryption utilities for sensitive user data.

These functions are DEPRECATED and no longer used in the codebase.
Encryption was removed for performance reasons at scale.
All data (emails, names, etc.) is now stored as plaintext.

The functions remain as no-op pass-throughs for backward compatibility
with any external scripts or tools that may still import them.
"""
import logging
from typing import Optional

logger = logging.getLogger(__name__)


def encrypt_data(data: Optional[str]) -> Optional[str]:
    """DEPRECATED: Returns data as-is. Encryption has been removed."""
    return data


def decrypt_data(encrypted_data: Optional[str]) -> Optional[str]:
    """DEPRECATED: Returns data as-is. Encryption has been removed."""
    return encrypted_data