"""
Blockchain API Routes

Endpoints for blockchain operations:
- Token balance queries
- Token minting (admin-only)
- Token information
- Contract health checks

Access: Admin-only for sensitive operations, authenticated for queries
"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Dict, Any
from pydantic import BaseModel, Field
from decimal import Decimal

from app.domains.blockchain.care_token_client import CareTokenClient
from app.dependencies import get_current_active_user, get_admin_user
from app.models.user import User

router = APIRouter()


# ============ SCHEMAS ============

class TokenBalanceResponse(BaseModel):
    """Token balance response"""
    address: str = Field(..., description="Wallet address")
    balance: str = Field(..., description="Balance in CARE tokens")
    balance_wei: str = Field(..., description="Balance in wei")


class MintTokenRequest(BaseModel):
    """Request to mint CARE tokens"""
    to_address: str = Field(..., description="Recipient wallet address")
    amount: Decimal = Field(..., gt=0, description="Amount of CARE tokens to mint")
    category: int = Field(..., ge=0, le=13, description="Mint category ID (0-13)")
    reason: str = Field(..., description="Reason for minting")


class MintTokenResponse(BaseModel):
    """Response after minting tokens"""
    success: bool
    transaction_hash: str
    amount_minted: str
    recipient: str
    category: int
    message: str


class TokenInfoResponse(BaseModel):
    """Token information"""
    name: str
    symbol: str
    decimals: int
    total_supply: str
    contract_address: str
    chain_id: int


# ============ TOKEN ENDPOINTS ============

@router.get("/token/balance/{address}", response_model=TokenBalanceResponse)
async def get_token_balance(
    address: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Get CARE token balance for an address
    
    Requires authentication
    """
    try:
        client = CareTokenClient()
        balance_decimal = await client.get_balance(address)
        balance_wei = int(balance_decimal * Decimal(10**18))
        
        return TokenBalanceResponse(
            address=address,
            balance=str(balance_decimal),
            balance_wei=str(balance_wei)
        )
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get balance: {str(e)}")


@router.post("/token/mint", response_model=MintTokenResponse)
async def mint_tokens(
    mint_request: MintTokenRequest,
    current_user: User = Depends(get_admin_user)
):
    """
    Mint CARE tokens to a user
    
    Admin-only access
    
    Categories (MintCategory enum):
    0 = PLATFORM_OPS, 1 = COMMUNITY_STAKING, 2 = CBT_COMPLETION,
    3 = DAILY_CHECKIN, 4 = QUEST_COMPLETION, 5 = WELLNESS_SESSION,
    6 = REFERRAL_BONUS, 7 = COMMUNITY_CONTRIBUTION, 8 = RESEARCH_PARTICIPATION,
    9 = CONTENT_CREATION, 10 = PEER_SUPPORT, 11 = GOVERNANCE_PARTICIPATION,
    12 = TREASURY_ALLOCATION, 13 = PARTNER_DISTRIBUTION
    """
    try:
        client = CareTokenClient()
        
        # Convert CARE to wei
        amount_wei = int(mint_request.amount * Decimal(10**18))
        
        # Mint tokens
        result = await client.mint_for_category(
            category=mint_request.category,
            to=mint_request.to_address,
            amount=amount_wei,
            reason=mint_request.reason
        )
        
        if not result:
            raise HTTPException(status_code=500, detail="Minting failed - check logs")
        
        return MintTokenResponse(
            success=True,
            transaction_hash=result["transactionHash"],
            amount_minted=str(mint_request.amount),
            recipient=mint_request.to_address,
            category=mint_request.category,
            message=f"Successfully minted {mint_request.amount} CARE tokens (category {mint_request.category})"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to mint tokens: {str(e)}")


@router.get("/token/info", response_model=TokenInfoResponse)
async def get_token_info(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get CARE token information
    
    Requires authentication
    """
    try:
        client = CareTokenClient()
        info = await client.get_token_info()
        
        if "error" in info:
            raise HTTPException(status_code=500, detail=info["error"])
        
        return TokenInfoResponse(
            name=info["name"],
            symbol=info["symbol"],
            decimals=info["decimals"],
            total_supply=str(info["total_supply"]),
            contract_address=info["contract_address"],
            chain_id=info["chain_id"]
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get token info: {str(e)}")


# ============ HEALTH CHECK ============

@router.get("/health", response_model=Dict[str, Any])
async def blockchain_health_check():
    """
    Health check for blockchain services
    
    Public endpoint (no auth required)
    """
    try:
        health = {
            "status": "healthy",
            "contracts": {}
        }
        
        # Check token contract
        try:
            token_client = CareTokenClient()
            info = await token_client.get_token_info()
            
            if "error" in info:
                health["contracts"]["token"] = {"status": "error", "error": info["error"]}
                health["status"] = "degraded"
            else:
                health["contracts"]["token"] = {
                    "status": "connected",
                    "address": info["contract_address"],
                    "name": info["name"]
                }
        except Exception as e:
            health["contracts"]["token"] = {"status": "error", "error": str(e)}
            health["status"] = "degraded"
        
        return health
        
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }
