"""
CARE Token API Routes

Endpoints for managing CARE token operations:
- Check balances
- Mint rewards
- View token information
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from typing import Optional
from decimal import Decimal

from app.domains.finance.services.care_token_service import get_care_token_service, CareTokenService
from app.dependencies import get_current_active_user
from app.models.user import User

router = APIRouter(prefix="/api/v1/care-token", tags=["CARE Token"])


# Request/Response Models
class TokenBalanceResponse(BaseModel):
    wallet_address: str
    balance: Decimal = Field(description="Balance in CARE tokens")
    balance_formatted: str


class MintRequest(BaseModel):
    user_id: int
    wallet_address: str
    amount: int = Field(gt=0, description="Amount of CARE tokens to mint")
    reason: str = Field(min_length=1, max_length=200)


class MintResponse(BaseModel):
    success: bool
    tx_hash: str
    amount: int
    recipient: str
    reason: str
    block_number: Optional[int] = None
    explorer_url: Optional[str] = None


class TokenInfoResponse(BaseModel):
    name: str
    symbol: str
    decimals: int
    total_supply: Decimal
    max_supply: Decimal
    contract_address: str
    chain_id: int
    network: str


@router.get("/balance/{wallet_address}", response_model=TokenBalanceResponse)
async def get_token_balance(
    wallet_address: str,
    care_service: CareTokenService = Depends(get_care_token_service)
):
    """
    Get CARE token balance for a wallet address
    
    Public endpoint - anyone can check any wallet balance
    """
    try:
        balance = await care_service.get_balance(wallet_address)
        
        return TokenBalanceResponse(
            wallet_address=wallet_address,
            balance=balance,
            balance_formatted=f"{balance:,.2f} CARE"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get balance: {str(e)}"
        )


@router.get("/info", response_model=TokenInfoResponse)
async def get_token_info(
    care_service: CareTokenService = Depends(get_care_token_service)
):
    """
    Get CARE token contract information
    
    Public endpoint - shows token details
    """
    try:
        info = await care_service.get_token_info()
        
        # Determine network name
        chain_id = care_service.w3.eth.chain_id
        network_name = "SOMNIA Mainnet" if chain_id == 5031 else "SOMNIA Testnet"
        
        return TokenInfoResponse(
            name=info["name"],
            symbol=info["symbol"],
            decimals=info["decimals"],
            total_supply=info["total_supply"],
            max_supply=info["max_supply"],
            contract_address=info["contract_address"],
            chain_id=chain_id,
            network=network_name
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get token info: {str(e)}"
        )


@router.post("/mint", response_model=MintResponse)
async def mint_tokens(
    mint_request: MintRequest,
    current_user: User = Depends(get_current_active_user),
    care_service: CareTokenService = Depends(get_care_token_service)
):
    """
    Mint CARE tokens to a user wallet
    
    Protected endpoint - requires authentication
    Only admin users or the reward system can call this
    """
    # Check if current user is admin (or has special minting permission)
    # TODO: Implement proper permission check
    # if not current_user.is_admin:
    #     raise HTTPException(status_code=403, detail="Not authorized to mint tokens")
    
    try:
        result = await care_service.mint_reward(
            user_wallet=mint_request.wallet_address,
            amount=mint_request.amount,
            reason=mint_request.reason
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=500,
                detail="Minting transaction failed"
            )
        
        # Generate explorer URL
        chain_id = care_service.w3.eth.chain_id
        explorer_base = (
            "https://explorer.somnia.network" if chain_id == 5031
            else "https://shannon-explorer.somnia.network"
        )
        explorer_url = f"{explorer_base}/tx/{result['tx_hash']}"
        
        return MintResponse(
            success=result["success"],
            tx_hash=result["tx_hash"],
            amount=result["amount"],
            recipient=result["recipient"],
            reason=result["reason"],
            block_number=result.get("block_number"),
            explorer_url=explorer_url
        )
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to mint tokens: {str(e)}"
        )


@router.get("/my-balance", response_model=TokenBalanceResponse)
async def get_my_balance(
    current_user: User = Depends(get_current_active_user),
    care_service: CareTokenService = Depends(get_care_token_service)
):
    """
    Get CARE token balance for the authenticated user
    
    Requires user to have wallet_address set in their profile
    """
    if not current_user.wallet_address:
        raise HTTPException(
            status_code=400,
            detail="User does not have a wallet address set"
        )
    
    try:
        balance = await care_service.get_balance(current_user.wallet_address)
        
        return TokenBalanceResponse(
            wallet_address=current_user.wallet_address,
            balance=balance,
            balance_formatted=f"{balance:,.2f} CARE"
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to get balance: {str(e)}"
        )
