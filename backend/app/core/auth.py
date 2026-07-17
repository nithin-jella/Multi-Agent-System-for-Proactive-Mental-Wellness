from typing import List
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_async_db
from app.auth_utils import decrypt_and_validate_token
from app.models.user import User

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_async_db)) -> User:
    """Get the current authenticated user from JWT token."""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        # Decrypt and validate the token (handles both JWT and NextAuth JWE)
        payload = decrypt_and_validate_token(token)
        
        # Get user ID from token payload
        user_id: str = payload.sub
        if user_id is None:
            raise credentials_exception
            
    except Exception:
        raise credentials_exception
    
    # Fetch user from database
    try:
        result = await db.execute(select(User).where(User.id == int(user_id)))
        user = result.scalar_one_or_none()
        
        if user is None:
            raise credentials_exception
            
        return user
    except Exception:
        raise credentials_exception


def require_role(allowed_roles: List[str]):
    """
    Dependency factory to require specific user roles.
    
    Usage:
        @router.get("/admin-only")
        async def admin_endpoint(current_user: User = Depends(require_role(["admin"]))):
            ...
    """
    async def _role_checker(current_user: User = Depends(get_current_user)) -> User:
        if not current_user.role or current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required roles: {', '.join(allowed_roles)}"
            )
        return current_user
    
    return _role_checker
