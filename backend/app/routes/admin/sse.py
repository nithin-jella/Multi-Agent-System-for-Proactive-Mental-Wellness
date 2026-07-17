"""Server-Sent Events (SSE) API endpoints for real-time dashboard updates."""

from __future__ import annotations

import logging
from typing import AsyncGenerator

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models.user import User
from app.services.sse_broadcaster import get_broadcaster

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/sse", tags=["Admin - SSE"])


@router.get("/events")
async def stream_events(
    request: Request,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_async_db)
) -> StreamingResponse:
    """Stream Server-Sent Events (SSE) for real-time dashboard updates.
    
    **Admin only** - Requires admin role.
    
    This endpoint establishes a persistent connection and streams events such as:
    - `alert_created` - New critical alert
    - `case_updated` - Case status changed
    - `sla_breach` - Case breached SLA
    - `ia_report_generated` - New IA report available
    - `ping` - Heartbeat (every 30 seconds)
    
    Events are formatted as SSE with `id`, `event`, and `data` fields.
    
    Example client code:
    ```javascript
    const eventSource = new EventSource('/api/v1/admin/sse/events', {
      headers: { 'Authorization': 'Bearer YOUR_TOKEN' }
    });
    
    eventSource.addEventListener('alert_created', (event) => {
      const data = JSON.parse(event.data);
      console.log('New alert:', data);
    });
    
    eventSource.addEventListener('ping', (event) => {
      console.log('Connection alive');
    });
    ```
    """
    broadcaster = get_broadcaster()
    
    # Add connection
    connection = await broadcaster.add_connection(current_user.id)
    
    async def event_generator() -> AsyncGenerator[str, None]:
        """Generate SSE event stream."""
        try:
            # Send initial connection message
            yield f"event: connected\ndata: {{'message': 'SSE connection established', 'user_id': {current_user.id}}}\n\n"
            
            # Stream events
            async for event in connection.get_events():
                # Check if client disconnected
                if await request.is_disconnected():
                    logger.info(f"Client disconnected: user {current_user.id}")
                    break
                
                yield event
        
        except Exception as e:
            logger.error(f"Error in SSE stream for user {current_user.id}: {e}", exc_info=True)
        
        finally:
            # Clean up connection
            await broadcaster.remove_connection(connection.connection_id)
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable nginx buffering
        }
    )


@router.get("/stats")
async def get_sse_stats(
    current_user: User = Depends(get_admin_user)
) -> dict:
    """Get SSE broadcaster statistics.
    
    **Admin only** - Requires admin role.
    
    Returns information about active SSE connections.
    """
    broadcaster = get_broadcaster()
    stats = broadcaster.get_stats()
    
    return {
        "stats": stats,
        "current_user_connections": stats.get('connections_per_user', {}).get(current_user.id, 0)
    }
