# Shared Infrastructure Documentation

## Overview

The **shared infrastructure** represents common code and utilities used across all domains (Finance, Blockchain, Mental Health). This layer provides foundational services that enable domain-specific functionality.

## 🎯 Purpose

Shared infrastructure provides:

- **Authentication & Authorization**: JWT validation, role-based access control
- **LLM Integration**: Google Gemini API client and utilities
- **Caching**: Redis-based caching for performance
- **Memory**: Conversation memory and context management
- **Scheduling**: Background job scheduling (APScheduler)
- **Database**: Connection pooling and session management
- **Middleware**: Request/response processing, performance monitoring
- **Utilities**: Email, security, environment validation

## 📁 Current Structure

### Core Services (`app/core/`)

**Purpose**: Core business logic and integrations shared across domains

```bash
app/core/
├── auth.py                          # JWT token generation and validation
├── llm.py                           # LLM client (Google Gemini)
├── memory.py                        # Redis-based conversation memory
├── cache.py                         # Caching utilities
├── scheduler.py                     # Background job scheduler
├── events.py                        # Event bus for inter-service communication
├── blockchain_utils.py              # Blockchain connection utilities
├── redaction.py                     # PII redaction for privacy
├── rate_limiter.py                  # Rate limiting utilities
├── rbac.py                          # Role-based access control
├── policy.py                        # Policy enforcement
├── settings.py                      # Application settings
├── tools.py                         # LLM tool definitions
├── twitter.py                       # Twitter integration
├── cbt_module_logic.py              # CBT module execution logic
├── cbt_module_types.py              # CBT module type definitions
└── abi/                             # Smart contract ABIs
```

**Key Services**:

- **LLM Client** (`llm.py`): Google Gemini 2.0 Flash integration
- **Memory** (`memory.py`): Redis conversation history storage
- **Auth** (`auth.py`): JWT token generation/validation
- **Scheduler** (`scheduler.py`): APScheduler for background jobs
- **Events** (`events.py`): Pub/sub event bus for agent communication

### Middleware (`app/middleware/`)

**Purpose**: Request/response processing pipeline

```bash
app/middleware/
└── performance.py                   # Performance monitoring and metrics
```

**Middleware Stack**:

1. **CORS Middleware**: Handle cross-origin requests (configured in `main.py`)
2. **Performance Middleware**: Request timing and metrics
3. **Error Handling Middleware**: Global exception handling (FastAPI default)

### Database (`app/database/`)

**Purpose**: Database connection and session management

```
app/database/
├── __init__.py                      # Database initialization
└── session.py                       # AsyncSession management
```

**Key Functions**:

- `init_db()`: Initialize database connections
- `get_async_db()`: Dependency for database sessions
- `close_db()`: Close database connections

**Database Stack**:

- **ORM**: SQLAlchemy 2.0 (async)
- **Driver**: asyncpg (PostgreSQL)
- **Migrations**: Alembic

### Dependencies (`app/dependencies.py`)

**Purpose**: FastAPI dependency injection for auth and authorization

```python
# Key Dependencies
get_token_from_request()              # Extract JWT from request
get_current_active_user()             # Get authenticated user
get_admin_user()                      # Require admin access
```

**Usage**:

```python
from app.dependencies import get_current_active_user, get_admin_user

@router.get("/protected")
async def protected_endpoint(
    current_user: User = Depends(get_current_active_user)
):
    # Requires valid JWT
    pass

@router.post("/admin-only")
async def admin_endpoint(
    current_user: User = Depends(get_admin_user)
):
    # Requires admin role
    pass
```

### Utilities (`app/utils/`)

**Purpose**: Common utility functions

```
app/utils/
├── email_utils.py                   # Email sending utilities
├── security_utils.py                # Password hashing, token generation
├── password_reset.py                # Password reset flow
└── env_check.py                     # Environment variable validation
```

**Key Utilities**:

- **Email** (`email_utils.py`): Send transactional emails
- **Security** (`security_utils.py`): Password hashing (bcrypt), token generation
- **Environment** (`env_check.py`): Validate required environment variables

### Models (`app/models/`)

**Purpose**: Shared database models (SQLAlchemy ORM)

```
app/models/
├── user.py                          # User model
├── message.py                       # Chat message model
├── session.py                       # Chat session model
├── intervention.py                  # Intervention plan model
├── appointment.py                   # Appointment model
├── survey.py                        # Survey model
└── (other models)
```

**Note**: Models are shared because they represent the database schema,
which is global to the application. Domains reference these models but
don't own them exclusively.

### Schemas (`app/schemas/`)

**Purpose**: Pydantic validation schemas

```
app/schemas/
├── user.py                          # User request/response schemas
├── message.py                       # Message schemas
├── session.py                       # Session schemas
└── (other schemas)
```

**Note**: Schemas define API contracts and validation rules. They're shared
because multiple domains may need to validate similar data structures.

## 🏗️ Architecture Patterns

### Dependency Injection (FastAPI Pattern)

```python
# Shared dependency
from app.dependencies import get_current_active_user
from app.database import get_async_db

@router.get("/example")
async def example(
    db: AsyncSession = Depends(get_async_db),
    current_user: User = Depends(get_current_active_user)
):
    # Database session and authenticated user injected
    pass
```

### Service Layer Pattern

```python
# Core service (shared)
from app.core.llm import get_llm_response

# Domain service uses shared service
async def chat_with_ai(message: str):
    response = await get_llm_response(
        prompt=message,
        model="gemini-2.0-flash",
        temperature=0.7
    )
    return response
```

### Event-Driven Communication

```python
# Shared event bus
from app.core.events import event_bus

# Domain publishes event
await event_bus.publish("user.registered", {"user_id": 123})

# Domain subscribes to event
@event_bus.subscribe("user.registered")
async def send_welcome_email(event):
    user_id = event["user_id"]
    # Send email
```

## 🔄 Why NOT Move to `shared/`?

### Current Structure Advantages

1. **FastAPI Convention**: `app/core/`, `app/middleware/` are standard FastAPI patterns
2. **Import Clarity**: `from app.core.llm import ...` is clear and idiomatic
3. **Tool Support**: IDEs and linters understand standard FastAPI structure
4. **No Migration Needed**: Existing code works without import changes
5. **Community Alignment**: Matches FastAPI documentation and examples

### When to Consider `shared/` Directory

- If you need strict domain isolation (e.g., microservices preparation)
- If shared code grows beyond core utilities
- If you need to version shared code separately
- If multiple teams own different domains

### Current Recommendation

**Keep shared code in root-level directories** (`core/`, `middleware/`, `utils/`).
This is pragmatic, follows FastAPI conventions, and avoids unnecessary refactoring.

## 🔐 Security & Privacy

### Authentication Flow

1. User logs in → JWT token generated (`app/core/auth.py`)
2. Token stored in cookie or Authorization header
3. Request → `get_token_from_request()` extracts token
4. Token validated → `get_current_active_user()` loads user
5. Authorization checked → `get_admin_user()` verifies role

### PII Redaction

All logs pass through redaction (`app/core/redaction.py`):

- Email addresses → `[REDACTED_EMAIL]`
- Phone numbers → `[REDACTED_PHONE]`
- Names → `[REDACTED_NAME]`
- Addresses → `[REDACTED_ADDRESS]`

### Rate Limiting

API endpoints protected by rate limiter (`app/core/rate_limiter.py`):

- Per-user limits
- Per-IP limits
- Per-endpoint limits

## 📊 Monitoring & Observability

### Performance Middleware

Tracks request metrics:

- Request duration
- Response status codes
- Slow queries (>1s)
- Error rates

### Logging

Structured logging with context:

```python
import logging
logger = logging.getLogger(__name__)

logger.info("Processing request", extra={
    "user_id": user.id,
    "endpoint": "/api/v1/chat",
    "duration_ms": 150
})
```

### Health Checks

- `/health` - Application health
- `/api/v1/finance/health` - Finance domain health
- `/api/v1/blockchain/health` - Blockchain health

## 🧪 Testing Shared Infrastructure

### Unit Tests

```
backend/tests/
├── core/
│   ├── test_auth.py                 # Test JWT generation/validation
│   ├── test_llm.py                  # Test LLM client
│   └── test_memory.py               # Test Redis memory
├── middleware/
│   └── test_performance.py          # Test performance middleware
└── utils/
    ├── test_email.py                # Test email utilities
    └── test_security.py             # Test security utilities
```

### Integration Tests

- Test database connection pooling
- Test Redis connection and caching
- Test LLM API integration (with mocks)
- Test authentication flow end-to-end

## 🔄 Domain Dependencies on Shared Infrastructure

### Finance Domain Dependencies

- **Database**: `get_async_db()` for revenue queries
- **Auth**: `get_admin_user()` for financial operations
- **Blockchain**: `blockchain_utils.py` for Web3 connection
- **Scheduler**: `scheduler.py` for monthly revenue jobs

### Blockchain Domain Dependencies

- **Database**: `get_async_db()` for transaction logs
- **Auth**: `get_current_active_user()`, `get_admin_user()`
- **Blockchain**: `blockchain_utils.py` for smart contract interactions
- **Cache**: `cache.py` for contract data caching

### Mental Health Domain Dependencies

- **Database**: `get_async_db()` for user/session queries
- **Auth**: `get_current_active_user()` for all endpoints
- **LLM**: `llm.py` for AI-powered chat
- **Memory**: `memory.py` for conversation history
- **Cache**: `cache.py` for LLM response caching
- **Events**: `events.py` for agent coordination
- **CBT Logic**: `cbt_module_logic.py` for CBT execution

## 📚 Configuration Management

### Environment Variables

Managed by `app/core/settings.py` and `app/utils/env_check.py`:

**Required**:

- `DATABASE_URL` - PostgreSQL connection
- `REDIS_URL` - Redis connection
- `GOOGLE_API_KEY` - Gemini API key
- `JWT_SECRET_KEY` - JWT signing key
- `ALLOWED_ORIGINS` - CORS origins

**Optional**:

- `ENABLE_REVENUE_SCHEDULER` - Finance scheduler
- `CARE_MINTER_PRIVATE_KEY` - Blockchain minting
- `SMTP_SERVER` - Email sending

### Settings Pattern

```python
from app.core.settings import get_settings

settings = get_settings()
database_url = settings.DATABASE_URL
```

## 🔗 Related Documentation

- **Finance Domain**: `backend/app/domains/finance/README.md`
- **Blockchain Domain**: `backend/app/domains/blockchain/README.md`
- **Mental Health Domain**: `backend/app/domains/mental_health/README.md`
- **Main Application**: `backend/app/main.py`
- **Architecture**: `PROJECT_SINGLE_SOURCE_OF_TRUTH.md`

## 📋 Summary

### Current Status: **ORGANIZED & DOCUMENTED**

**What This Provides**:

- ✅ Clear identification of shared infrastructure
- ✅ Documentation of current structure
- ✅ Rationale for NOT moving to `shared/` directory
- ✅ Guidelines for when to reconsider
- ✅ Domain dependency mapping

**What This Achieves**:

- **Clarity**: Everyone knows what's shared vs. domain-specific
- **Stability**: No breaking changes to existing code
- **Convention**: Follows FastAPI best practices
- **Flexibility**: Easy to move to `shared/` later if needed

**Recommendation**: **Keep current structure**. It works well, follows conventions, and avoids unnecessary refactoring.

---

**Last Updated**: October 28, 2025  
**Version**: 1.0.0  
**Status**: ✅ **Organized & Documented**

**Key Takeaway**: "Not all shared code needs to be in a `shared/` directory. FastAPI conventions (`core/`, `middleware/`, `utils/`) are perfectly valid for shared infrastructure."
