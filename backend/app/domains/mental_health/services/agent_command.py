from __future__ import annotations

import asyncio
import contextlib
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, Set

from fastapi import WebSocket


@dataclass
class AgentRunState:
    """In-memory representation of an agent run used for testing and dev."""

    run_id: str
    correlation_id: str
    agent: str
    action: str
    status: str = "running"
    payload: Dict[str, Any] = field(default_factory=dict)


class AgentCommandDispatcher:
    """Broadcasts agent command lifecycle events to connected WebSocket clients."""

    def __init__(self) -> None:
        self._connections: Set[WebSocket] = set()
        self._runs: Dict[str, AgentRunState] = {}
        self._tasks: Dict[str, asyncio.Task[None]] = {}
        self._lock = asyncio.Lock()

    async def register(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.add(websocket)

    async def unregister(self, websocket: WebSocket) -> None:
        async with self._lock:
            self._connections.discard(websocket)

    async def _snapshot_connections(self) -> Set[WebSocket]:
        async with self._lock:
            return set(self._connections)

    async def broadcast(self, payload: Dict[str, Any]) -> None:
        for ws in await self._snapshot_connections():
            try:
                await ws.send_json(payload)
            except Exception:
                await self.unregister(ws)

    async def _set_status(self, run_id: str, status: str) -> None:
        async with self._lock:
            state = self._runs.get(run_id)
            if state:
                state.status = status

    async def _get_run(self, run_id: str) -> AgentRunState | None:
        async with self._lock:
            return self._runs.get(run_id)

    async def start_run(self, agent: str, action: str, payload: Dict[str, Any] | None = None) -> AgentRunState:
        run_id = str(uuid.uuid4())
        correlation_id = str(uuid.uuid4())
        state = AgentRunState(
            run_id=run_id,
            correlation_id=correlation_id,
            agent=agent,
            action=action,
            payload=payload or {},
        )
        async with self._lock:
            self._runs[run_id] = state

        await self.broadcast(
            {
                "type": "run_started",
                "runId": run_id,
                "agent": agent,
                "action": action,
                "correlationId": correlation_id,
            }
        )

        async def _simulate_stream() -> None:
            try:
                # Simulate streaming token events emitted by an agent LLM.
                for chunk in ["This", "is", "a", "simulated", "response."]:
                    if await self._is_cancelled(run_id):
                        return
                    await asyncio.sleep(0)
                    await self.broadcast(
                        {
                            "type": "token",
                            "token": chunk,
                            "runId": run_id,
                            "agent": agent,
                            "correlationId": correlation_id,
                        }
                    )

                if await self._is_cancelled(run_id):
                    return

                await self._set_status(run_id, "completed")
                await self.broadcast(
                    {
                        "type": "run_completed",
                        "runId": run_id,
                        "agent": agent,
                        "correlationId": correlation_id,
                    }
                )
            except asyncio.CancelledError:
                # Cancellation is handled by the cancelling caller by emitting run_cancelled.
                raise
            finally:
                async with self._lock:
                    self._tasks.pop(run_id, None)

        task = asyncio.create_task(_simulate_stream())
        async with self._lock:
            self._tasks[run_id] = task

        return state

    async def _is_cancelled(self, run_id: str) -> bool:
        state = await self._get_run(run_id)
        return state is not None and state.status == "cancelled"

    async def cancel_run(self, run_id: str) -> bool:
        async with self._lock:
            state = self._runs.get(run_id)
            task = self._tasks.get(run_id)
            if not state:
                return False
            state.status = "cancelled"

        if task:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task

        assert state is not None

        await self.broadcast(
            {
                "type": "run_cancelled",
                "runId": run_id,
                "agent": state.agent,
                "correlationId": state.correlation_id,
            }
        )
        return True

    async def cleanup(self) -> None:
        """Gracefully cancel all in-flight runs (used for app shutdown)."""
        async with self._lock:
            tasks = list(self._tasks.values())
            self._tasks.clear()
            self._runs.clear()

        for task in tasks:
            task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await task


dispatcher = AgentCommandDispatcher()
