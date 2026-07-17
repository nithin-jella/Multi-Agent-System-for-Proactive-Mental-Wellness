"""Safety Triage Agent API endpoints."""
from fastapi import APIRouter, Depends, HTTPException

from app.agents.sta.schemas import STAClassifyRequest, STAClassifyResponse
from app.agents.sta.service import SafetyTriageService, get_safety_triage_service

router = APIRouter(prefix="/api/v1/safety-triage", tags=["Safety Triage"])


@router.post("/classify", response_model=STAClassifyResponse)
async def classify_message(
    payload: STAClassifyRequest,
    service: SafetyTriageService = Depends(get_safety_triage_service),
) -> STAClassifyResponse:
    """Classify a single user message using the Safety Triage Agent service."""
    try:
        return await service.classify(payload)
    except NotImplementedError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - passthrough for now
        raise HTTPException(status_code=500, detail="Failed to classify message") from exc
