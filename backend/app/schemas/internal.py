# backend/app/schemas/internal.py
from pydantic import BaseModel, EmailStr, ConfigDict
from typing import Optional

#? --- Internal API Schemas ---
class UserInternalResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    
    id: int
    google_sub: str
    email: Optional[str] = None # Encrypted email, can be decrypted if needed
    wallet_address: str | None = None
    role: Optional[str] = None
    allow_email_checkins: bool = True # Whether user wants email check-ins
        
#? --- Schemas for POST /internal/sync-user ---
class UserSyncPayload(BaseModel):
    google_sub: str
    email: Optional[EmailStr] = None # Validate email format from frontend

class UserSyncResponse(BaseModel):
    message: str
    user_id: int # Return the internal DB user ID
    google_sub: str
    email_stored: bool # Indicate if encrypted email is now stored