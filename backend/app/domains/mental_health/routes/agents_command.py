from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Depends, HTTPException, WebSocket, WebSocketDisconnect

from app import auth_utils
from app.dependencies import get_admin_user
from app.models import User
from app.domains.mental_health.services.agent_command import dispatcher


router = APIRouter(prefix="/api/v1/agents", tags=["Agents - Command Center"])

@router.post("/command")
async def dispatch_agent_command(
    payload: Dict[str, Any],
    admin: User = Depends(get_admin_user),
) -> Dict[str, Any]:
    agent = payload.get("agent")
    action = payload.get("action")
    data = payload.get("data") or {}

    if not agent or not action:
        raise HTTPException(status_code=422, detail="Both 'agent' and 'action' are required")

    run_state = await dispatcher.start_run(str(agent), str(action), data)

    return {
        "runId": run_state.run_id,
        "correlationId": run_state.correlation_id,
        "status": run_state.status,
    }


@router.post("/runs/{run_id}/cancel")
async def cancel_agent_run(
    run_id: str,
    admin: User = Depends(get_admin_user),
) -> Dict[str, Any]:
    cancelled = await dispatcher.cancel_run(run_id)
    if not cancelled:
        raise HTTPException(status_code=404, detail="Run not found")

    return {"runId": run_id, "status": "cancelled"}


@router.websocket("/ws")
async def agent_command_ws(websocket: WebSocket, token: str) -> None:
    try:
        auth_utils.decrypt_and_validate_token(token)
    except Exception:
        await websocket.close(code=4401)
        return

    await websocket.accept()
    await dispatcher.register(websocket)

    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await dispatcher.unregister(websocket)
