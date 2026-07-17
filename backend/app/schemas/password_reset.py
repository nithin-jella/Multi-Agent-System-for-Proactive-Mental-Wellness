"""Password reset related schemas."""

from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import Optional

class ForgotPasswordRequest(BaseModel):
    """Request to initiate password reset."""
    email: EmailStr = Field(..., description="Email address of the user")

class ForgotPasswordResponse(BaseModel):
    """Response after initiating password reset."""
    message: str = Field(..., description="Confirmation message")

class ResetPasswordRequest(BaseModel):
    """Request to reset password with token."""
    token: str = Field(..., description="Password reset token", min_length=32)
    new_password: str = Field(
        ..., 
        description="New password", 
        min_length=8,
        max_length=100
    )
    confirm_password: str = Field(
        ..., 
        description="Password confirmation", 
        min_length=8,
        max_length=100
    )

class ResetPasswordResponse(BaseModel):
    """Response after password reset attempt."""
    success: bool = Field(..., description="Whether the reset was successful")
    message: str = Field(..., description="Result message")

class ValidateTokenRequest(BaseModel):
    """Request to validate a reset token."""
    token: str = Field(..., description="Password reset token", min_length=32)

class ValidateTokenResponse(BaseModel):
    """Response after token validation."""
    valid: bool = Field(..., description="Whether the token is valid")
    message: str = Field(..., description="Validation message")
    email: Optional[EmailStr] = Field(None, description="Associated email if token is valid")