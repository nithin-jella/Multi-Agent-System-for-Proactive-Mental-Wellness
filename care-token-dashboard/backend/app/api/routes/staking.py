"""
Staking analytics API routes
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import List

from app.models import User
from app.core.auth import get_current_active_user

router = APIRouter()


class TierDistribution(BaseModel):
    tier: str
    count: int
    total_staked: str
    percentage: float


class StakingOverview(BaseModel):
    total_value_locked: str
    total_stakers: int
    tier_distribution: List[TierDistribution]


@router.get("/overview")
async def get_staking_overview(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get staking overview with TVL and staker distribution
    
    TODO: Connect to smart contract to fetch real data
    """
    # Placeholder data
    overview = StakingOverview(
        total_value_locked="50000000",  # 50M CARE
        total_stakers=1250,
        tier_distribution=[
            TierDistribution(tier="Bronze", count=500, total_staked="10000000", percentage=20.0),
            TierDistribution(tier="Silver", count=400, total_staked="15000000", percentage=30.0),
            TierDistribution(tier="Gold", count=250, total_staked="15000000", percentage=30.0),
            TierDistribution(tier="Platinum", count=100, total_staked="10000000", percentage=20.0),
        ]
    )
    
    return {
        "success": True,
        "data": overview
    }


@router.get("/history")
async def get_profit_distribution_history(
    current_user: User = Depends(get_current_active_user)
):
    """
    Get historical profit distribution data
    
    TODO: Connect to smart contract to fetch real data
    """
    # Placeholder data
    history = [
        {
            "month": "202410",
            "total_profit": "4000.00",
            "distributed_to_stakers": "3200.00",
            "distribution_rate": 80.0
        },
        {
            "month": "202409",
            "total_profit": "3500.00",
            "distributed_to_stakers": "2800.00",
            "distribution_rate": 80.0
        }
    ]
    
    return {
        "success": True,
        "data": history
    }
