from __future__ import annotations

"""Admin endpoints for agent run logs now that LangGraph flows are retired."""

import logging
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.domains.mental_health.models import AgentMessage, AgentRun


logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/admin/agents", tags=["Admin - Agents"])


@router.get("/status", summary="Get the status of the agent system")
async def get_agent_system_status() -> dict[str, str]:
    """Lightweight heartbeat for the admin command center."""
    logger.info("Agent system status endpoint called.")
    return {"status": "ok", "message": "Agent command center endpoints are available."}


@router.post("/ask", summary="Ask a legacy agent a natural language question")
async def ask_agent(_: dict[str, Any]) -> None:
    """Legacy LangGraph agents have been retired in favour of Safety Agent services."""
    raise HTTPException(
        status_code=503,
        detail="Legacy LangGraph agents have been removed. Use Safety Agent endpoints (STA/TCA/CMA/IA).",
    )


@router.get("/runs", summary="List recent agent runs")
async def list_agent_runs(
    limit: int = 25,
    agent: Optional[str] = None,
    db: AsyncSession = Depends(get_async_db),
) -> list[dict[str, Any]]:
    query = select(AgentRun).order_by(AgentRun.started_at.desc()).limit(min(limit, 100))
    if agent:
        query = query.filter(AgentRun.agent_name == agent.lower())
    result = await db.execute(query)
    runs = result.scalars().all()
    return [
        {
            "id": run.id,
            "agent": run.agent_name,
            "action": run.action,
            "status": run.status,
            "correlationId": run.correlation_id,
            "startedAt": run.started_at.isoformat() if run.started_at else None,
            "completedAt": run.completed_at.isoformat() if run.completed_at else None,
        }
        for run in runs
    ]


@router.get("/metrics", summary="Aggregated agent run metrics")
async def agent_metrics(
    db: AsyncSession = Depends(get_async_db),
) -> dict[str, Any]:
    counts_stmt = (
        select(AgentRun.agent_name, AgentRun.status, func.count(AgentRun.id))
        .group_by(AgentRun.agent_name, AgentRun.status)
    )
    counts_rows = (await db.execute(counts_stmt)).all()

    last_completed_subq = (
        select(
            AgentRun.agent_name.label("agent_name"),
            func.max(AgentRun.completed_at).label("last_completed"),
        )
        .where(AgentRun.status.in_(["succeeded", "failed", "cancelled"]))
        .group_by(AgentRun.agent_name)
        .subquery()
    )
    last_completed_rows = (
        await db.execute(select(last_completed_subq.c.agent_name, last_completed_subq.c.last_completed))
    ).all()
    last_completed_map = {row.agent_name or "unknown": row.last_completed for row in last_completed_rows}

    per_agent: dict[str, dict[str, Any]] = {}
    global_totals: dict[str, int] = {"total": 0, "running": 0, "succeeded": 0, "failed": 0, "cancelled": 0}

    for agent_name, status, count in counts_rows:
        key = agent_name or "unknown"
        record = per_agent.setdefault(
            key,
            {"total": 0, "running": 0, "succeeded": 0, "failed": 0, "cancelled": 0, "lastCompleted": None},
        )
        record["total"] += count
        global_totals["total"] += count
        if status in record:
            record[status] += count
            if status in global_totals:
                global_totals[status] += count

    for agent_name, ts in last_completed_map.items():
        per_agent.setdefault(
            agent_name,
            {"total": 0, "running": 0, "succeeded": 0, "failed": 0, "cancelled": 0, "lastCompleted": None},
        )["lastCompleted"] = ts

    return {"perAgent": per_agent, "global": global_totals}


@router.get("/runs/{run_id}/messages", summary="List messages for a run")
async def list_run_messages(
    run_id: int,
    db: AsyncSession = Depends(get_async_db),
) -> list[dict[str, Any]]:
    query = select(AgentMessage).where(AgentMessage.run_id == run_id).order_by(AgentMessage.created_at.asc())
    result = await db.execute(query)
    messages = result.scalars().all()
    return [
        {
            "id": message.id,
            "role": message.role,
            "type": message.message_type,
            "content": message.content,
            "metadata": message.meta,
            "createdAt": message.created_at.isoformat() if message.created_at else None,
        }
        for message in messages
    ]
