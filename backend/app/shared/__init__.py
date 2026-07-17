"""
Shared Infrastructure Module

This module represents shared/common code used across all domains:
- Finance Domain
- Blockchain Domain  
- Mental Health Domain

The shared infrastructure includes:
- Core utilities (auth, LLM, memory, cache, scheduler)
- Middleware (performance monitoring, request processing)
- Database connection and session management
- Common utilities (email, security, environment checks)
- Dependencies (authentication, authorization)

Note: In a pure Feature/Domain architecture, shared code can either:
1. Live in a dedicated `shared/` directory (current approach)
2. Live in root-level `core/`, `middleware/`, `utils/` directories
3. Be duplicated in each domain (if small and domain-specific)

Current approach: Keep shared code in root-level directories for now.
This is pragmatic and follows common FastAPI patterns.

Rationale:
- `app/core/` - Well-established FastAPI pattern for core utilities
- `app/middleware/` - Standard FastAPI middleware location
- `app/utils/` - Common utility location
- `app/database/` - Database is truly global, not domain-specific
- `app/dependencies.py` - FastAPI dependency injection pattern

Future Consideration:
If shared code grows significantly or domains need more isolation,
consider moving to `app/shared/` and updating imports.
"""

__all__ = []
