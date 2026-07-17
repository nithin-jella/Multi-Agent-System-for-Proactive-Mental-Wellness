"""Performance tracking middleware for FastAPI."""

import time
from typing import Callable, Optional
from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.services.api_performance import get_performance_service

class PerformanceTrackingMiddleware(BaseHTTPMiddleware):
    """Middleware to track API request performance metrics."""
    
    def __init__(self, app, exclude_paths: Optional[list] = None):
        super().__init__(app)
        self.exclude_paths = exclude_paths or [
            "/docs",
            "/redoc", 
            "/openapi.json",
            "/health",
            "/favicon.ico"
        ]
        self.performance_service = get_performance_service()
    
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """Track request performance metrics."""
        # Skip tracking for excluded paths
        if any(request.url.path.startswith(path) for path in self.exclude_paths):
            return await call_next(request)
        
        # Record start time
        start_time = time.time()
        
        # Process request
        response = await call_next(request)
        
        # Calculate duration
        duration_ms = (time.time() - start_time) * 1000
        
        # Extract user info if available
        user_id = None
        if hasattr(request.state, 'user') and request.state.user:
            user_id = str(getattr(request.state.user, 'id', None))
        
        # Get client IP
        client_ip = request.client.host if request.client else None
        
        # Get user agent
        user_agent = request.headers.get('user-agent')
        
        # Record metrics
        self.performance_service.record_request(
            endpoint=request.url.path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=duration_ms,
            user_id=user_id,
            ip_address=client_ip,
            user_agent=user_agent
        )
        
        # Add performance headers to response
        response.headers["X-Response-Time"] = f"{duration_ms:.2f}ms"
        
        return response