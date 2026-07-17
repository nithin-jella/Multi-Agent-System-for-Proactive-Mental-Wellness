"""
Finance Domain Services

This module aggregates all finance-related services for the UGM-AICare platform.
Services handle blockchain integration, token operations, and financial analytics.

Service Categories:
- Blockchain Integration: care_token_service (SOMNIA blockchain)
"""

# Blockchain integration services
from . import care_token_service

__all__ = [
    "care_token_service",
]
