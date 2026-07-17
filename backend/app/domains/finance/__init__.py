"""
Finance Domain Module

Centralized module for financial operations:
- Revenue tracking and aggregation
- Report generation and management
- Blockchain integration for revenue reporting
- Monthly automation
- Finance API routes

Contains:
- models.py: Database models (RevenueReport, Transaction, etc.)
- schemas.py: Pydantic validation models
- revenue_tracker.py: Revenue aggregation logic
- revenue_scheduler.py: APScheduler monthly automation
- routes.py: FastAPI routes for finance operations
"""

from app.domains.finance.models import (
    RevenueReport,
    RevenueApproval,
)

from app.domains.finance.schemas import (
    RevenueReportCreate,
    RevenueReportUpdate,
    RevenueReportResponse,
    RevenueReportListResponse,
    RevenueSubmissionResponse,
    RevenueBreakdownResponse,
    RevenueApprovalCreate,
    RevenueApprovalResponse
)

# Conditional imports: Skip runtime dependencies during migrations
# Check if we're in Alembic migration context (alembic.context is available)
import sys
_is_migration = 'alembic' in sys.modules

if not _is_migration:
    from app.domains.finance.revenue_tracker import revenue_tracker
    from app.domains.finance.revenue_scheduler import scheduler, start_scheduler, stop_scheduler
    from app.domains.finance.routes import router as finance_router

__all__ = [
    # Models
    "RevenueReport",
    "RevenueApproval",
    # Schemas
    "RevenueReportCreate",
    "RevenueReportUpdate",
    "RevenueReportResponse",
    "RevenueReportListResponse",
    "RevenueSubmissionResponse",
    "RevenueBreakdownResponse",
    "RevenueApprovalCreate",
    "RevenueApprovalResponse",
]

# Add runtime services to __all__ only if not in migration
if not _is_migration:
    __all__.extend([
        # Services
        "revenue_tracker",
        # Scheduler
        "scheduler",
        "start_scheduler",
        "stop_scheduler",
        # Routes
        "finance_router"
    ])
