"""Server-Sent Events (SSE) broadcaster for real-time dashboard updates.

Manages SSE connections, broadcasts events to connected clients, and handles
connection lifecycle with heartbeat mechanism.
"""

from __future__ import annotations

import asyncio
import json
import logging
from collections import defaultdict
from datetime import datetime
from typing import Any, AsyncGenerator, Optional
from uuid import UUID, uuid4

from app.core.memory import get_redis_client

logger = logging.getLogger(__name__)

_INSTANCE_ID = str(uuid4())


class SSEConnection:
    """Represents a single SSE connection from a client."""
    
    def __init__(self, connection_id: UUID, user_id: int):
        """Initialize SSE connection.
        
        Args:
            connection_id: Unique connection identifier
            user_id: ID of connected admin user
        """
        self.connection_id = connection_id
        self.user_id = user_id
        self.queue: asyncio.Queue = asyncio.Queue()
        self.connected_at = datetime.utcnow()
        self.last_ping_at = datetime.utcnow()
    
    async def send(self, event: dict[str, Any]) -> None:
        """Send an event to this connection.
        
        Args:
            event: Event data to send
        """
        await self.queue.put(event)
    
    async def get_events(self) -> AsyncGenerator[str, None]:
        """Generate SSE-formatted event stream.
        
        Yields:
            SSE-formatted event strings
        """
        while True:
            try:
                # Wait for event with timeout (for heartbeat)
                event = await asyncio.wait_for(self.queue.get(), timeout=30.0)
                
                # Format as SSE
                event_type = event.get('type', 'message')
                event_data = event.get('data', {})
                event_id = event.get('id', str(uuid4()))
                
                sse_message = f"id: {event_id}\n"
                sse_message += f"event: {event_type}\n"
                sse_message += f"data: {self._format_data(event_data)}\n\n"
                
                yield sse_message
                
            except asyncio.TimeoutError:
                # Send heartbeat ping
                ping_message = f"event: ping\ndata: {{'timestamp': '{datetime.utcnow().isoformat()}'}}\n\n"
                yield ping_message
                self.last_ping_at = datetime.utcnow()
    
    @staticmethod
    def _format_data(data: Any) -> str:
        """Format data as JSON string for SSE.
        
        Args:
            data: Data to format
            
        Returns:
            JSON string
        """
        import json
        return json.dumps(data, default=str)


class SSEBroadcaster:
    """Manages multiple SSE connections and broadcasts events."""
    
    _instance: Optional[SSEBroadcaster] = None
    
    def __init__(self):
        """Initialize SSE broadcaster."""
        self.connections: dict[UUID, SSEConnection] = {}
        self.user_connections: dict[int, set[UUID]] = defaultdict(set)
        self._lock = asyncio.Lock()
        self._redis_task: Optional[asyncio.Task] = None
        self._redis_pubsub = None
    
    @classmethod
    def get_instance(cls) -> SSEBroadcaster:
        """Get singleton instance of SSEBroadcaster.
        
        Returns:
            SSEBroadcaster instance
        """
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
    
    async def add_connection(self, user_id: int) -> SSEConnection:
        """Add a new SSE connection.
        
        Args:
            user_id: ID of connected admin user
            
        Returns:
            SSEConnection instance
        """
        connection_id = uuid4()
        connection = SSEConnection(connection_id, user_id)
        
        async with self._lock:
            self.connections[connection_id] = connection
            self.user_connections[user_id].add(connection_id)
        
        logger.info(
            f"SSE connection established: {connection_id} for user {user_id}. "
            f"Total connections: {len(self.connections)}"
        )

        await self._ensure_redis_listener()
        
        return connection
    
    async def remove_connection(self, connection_id: UUID) -> None:
        """Remove an SSE connection.
        
        Args:
            connection_id: Connection to remove
        """
        async with self._lock:
            connection = self.connections.pop(connection_id, None)
            
            if connection:
                self.user_connections[connection.user_id].discard(connection_id)
                
                # Clean up empty user sets
                if not self.user_connections[connection.user_id]:
                    del self.user_connections[connection.user_id]
                
                logger.info(
                    f"SSE connection closed: {connection_id} for user {connection.user_id}. "
                    f"Remaining connections: {len(self.connections)}"
                )
    
    async def broadcast(
        self,
        event_type: str,
        data: dict[str, Any],
        user_id: Optional[int] = None
    ) -> int:
        """Broadcast an event to connections.
        
        Args:
            event_type: Type of event (alert_created, case_updated, etc.)
            data: Event data
            user_id: Optional - send only to specific user, None = broadcast to all
            
        Returns:
            Number of connections that received the event
        """
        event = {
            'id': str(uuid4()),
            'type': event_type,
            'data': data,
            'timestamp': datetime.utcnow().isoformat(),
            'user_id': user_id,
        }
        
        sent_count = await self._broadcast_local(event, user_id=user_id)
        await self._publish_redis(event)
        return sent_count

    async def _broadcast_local(
        self,
        event: dict[str, Any],
        user_id: Optional[int] = None
    ) -> int:
        sent_count = 0

        async with self._lock:
            if user_id is not None:
                connection_ids = self.user_connections.get(user_id, set())
                for conn_id in list(connection_ids):
                    connection = self.connections.get(conn_id)
                    if connection:
                        try:
                            await connection.send(event)
                            sent_count += 1
                        except Exception as e:
                            logger.error(f"Error sending to connection {conn_id}: {e}")
                            await self.remove_connection(conn_id)
            else:
                for conn_id, connection in list(self.connections.items()):
                    try:
                        await connection.send(event)
                        sent_count += 1
                    except Exception as e:
                        logger.error(f"Error broadcasting to connection {conn_id}: {e}")
                        await self.remove_connection(conn_id)

        logger.debug(f"Broadcasted {event.get('type')} to {sent_count} connections")
        return sent_count

    async def _publish_redis(self, event: dict[str, Any]) -> None:
        try:
            redis_client = await get_redis_client()
            if not hasattr(redis_client, "publish"):
                return

            payload = dict(event)
            payload["instance_id"] = _INSTANCE_ID
            await redis_client.publish("sse:events", json.dumps(payload))
        except Exception as exc:
            logger.warning("Redis publish failed for SSE event %s: %s", event.get("type"), exc)

    async def _ensure_redis_listener(self) -> None:
        if self._redis_task is not None:
            return

        try:
            redis_client = await get_redis_client()
            if not hasattr(redis_client, "pubsub"):
                return
            pubsub = redis_client.pubsub()
            await pubsub.subscribe("sse:events")
            self._redis_pubsub = pubsub
            self._redis_task = asyncio.create_task(self._redis_listen())
        except Exception as exc:
            logger.warning("Redis pubsub not available for SSE: %s", exc)

    async def _redis_listen(self) -> None:
        pubsub = self._redis_pubsub
        if pubsub is None:
            return

        try:
            async for message in pubsub.listen():
                if not message:
                    continue
                if message.get("type") != "message":
                    continue

                data = message.get("data")
                if not data:
                    continue
                if isinstance(data, bytes):
                    data = data.decode("utf-8")

                try:
                    payload = json.loads(data)
                except json.JSONDecodeError:
                    continue

                if payload.get("instance_id") == _INSTANCE_ID:
                    continue

                await self._broadcast_local(payload, user_id=payload.get("user_id"))
        except Exception as exc:
            logger.warning("Redis SSE listener stopped: %s", exc)
    
    async def cleanup_dead_connections(self, max_idle_seconds: int = 300) -> int:
        """Clean up connections that haven't responded to pings.
        
        Args:
            max_idle_seconds: Maximum idle time before considering connection dead
            
        Returns:
            Number of connections removed
        """
        cutoff_time = datetime.utcnow().timestamp() - max_idle_seconds
        removed_count = 0
        
        async with self._lock:
            dead_connections = [
                conn_id
                for conn_id, conn in self.connections.items()
                if conn.last_ping_at.timestamp() < cutoff_time
            ]
            
            for conn_id in dead_connections:
                await self.remove_connection(conn_id)
                removed_count += 1
        
        if removed_count > 0:
            logger.info(f"Cleaned up {removed_count} dead SSE connections")
        
        return removed_count
    
    def get_stats(self) -> dict[str, Any]:
        """Get broadcaster statistics.
        
        Returns:
            Statistics dictionary
        """
        return {
            'total_connections': len(self.connections),
            'connected_users': len(self.user_connections),
            'connections_per_user': {
                user_id: len(conn_ids)
                for user_id, conn_ids in self.user_connections.items()
            }
        }


# Global broadcaster instance
_broadcaster = SSEBroadcaster.get_instance()


def get_broadcaster() -> SSEBroadcaster:
    """Get the global SSE broadcaster instance.
    
    Returns:
        SSEBroadcaster instance
    """
    return _broadcaster
