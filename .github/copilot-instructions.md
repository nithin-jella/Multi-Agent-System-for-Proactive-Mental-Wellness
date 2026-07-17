# UGM-AICare Project Instructions

## Project Overview

UGM-AICare is a mental health AI platform for Indonesian university students (UGM) implementing a **Safety Agent Suite** for proactive intervention. The system uses LangGraph-orchestrated agents with Google Gemini 2.5 API for CBT-informed therapeutic support.

**Tech Stack:** Next.js 15 (TypeScript), FastAPI (Python 3.9+), PostgreSQL, Redis, LangChain/LangGraph

## Core Architecture

### Safety Agent Suite (Four Agents)
1. **Safety Triage Agent (STA)** - `backend/app/agents/sta/` - Crisis detection and risk classification
2. **Support Coach Agent (SCA)** - `backend/app/agents/sca/` - CBT-informed coaching and intervention plans
3. **Service Desk Agent (SDA)** - `backend/app/agents/sda/` - Clinical case management and SLA tracking
4. **Insights Agent (IA)** - `backend/app/agents/ia/` - Privacy-preserving analytics with differential privacy

All agents orchestrated via **LangGraph** with specifications in `backend/app/agents/safety_graph_specs.py`.

### Repository Structure
- `backend/` - FastAPI with async SQLAlchemy, Alembic migrations, LangGraph agents
- `frontend/` - Next.js 15 App Router with grouped routes `(main)`, `(admin)`, `(protected)`
- `blockchain/` - Hardhat smart contracts for NFT achievement badges
- `docs/` - Project documentation (see `PROJECT_SINGLE_SOURCE_OF_TRUTH.md`)

## Development Workflow

### Setup Commands
```bash
# Backend
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev  # Runs on port 4000

# Database
# Ensure PostgreSQL running on localhost:5432
# Ensure Redis running on localhost:6379
```

### Testing
```bash
# Backend tests
cd backend
pytest tests/ -v

# Frontend tests
cd frontend
npm test
```

### Build
```bash
# Backend - no build step (Python)

# Frontend production build
cd frontend
npm run build
```

## Code Standards

### TypeScript/Frontend
- **Always use TypeScript strict mode** with explicit type definitions
- **Functional components only** with React hooks (no class components)
- **App Router patterns** - Use grouped routes: `app/(main)/`, `app/(admin)/`, `app/(protected)/`
- **Imports:** Use `@/` path alias (e.g., `import { Button } from '@/components/ui/button'`)
- **Styling:** Tailwind CSS only - no inline styles or CSS modules
- **State:** React hooks + custom hooks (e.g., `useChat`, `useInterventionPlans`)
- **Error handling:** Use `react-hot-toast` for user notifications

### Python/Backend
- **Type hints required** on all functions and classes
- **Async/await patterns** for all I/O operations (database, LLM, Redis)
- **SQLAlchemy 2.0 style** - Use `select()` with `execute()`, not legacy query API
- **Pydantic models** for all request/response validation
- **Error handling:** Raise `HTTPException` with user-friendly messages
- **Logging:** Use structured logging with context (no print statements)

### Database
- **Always use Alembic** for schema changes (never raw SQL migrations)
- **Async patterns:** Use `AsyncSession` and `asyncpg` driver
- **Models location:** `backend/app/models/`
- **Never commit with `# type: ignore`** - Fix type issues properly

### Security Rules
- **Never hardcode secrets** - Use environment variables
- **Never log PII** - Use redaction utilities in `backend/app/core/redaction.py`
- **Validate all inputs** - Use Pydantic schemas
- **JWT validation** - All protected routes use `Depends(get_current_active_user)`
- **Consent checks** - All analytics/coaching operations must verify user consent

## Agent Development

### Adding New Agents
1. Create package in `backend/app/agents/{agent_name}/`
2. Implement service class extending base patterns
3. Register in LangGraph orchestration at `backend/app/agents/safety_graph_specs.py`
4. Add API endpoints in `backend/app/routes/`
5. Update Redis state management for coordination
6. Add tests in `backend/tests/agents/`

### LangGraph Integration
- **All agent routing via LangGraph** - No direct agent-to-agent calls
- **State management via Redis** - Keys: `agent_state:{agent_name}`
- **Graph specs:** Define nodes, edges, and conditionals in `safety_graph_specs.py`
- **Orchestration:** Use `orchestrator.py` for intent classification

### Agent Coordination Pattern
```python
# Workflow: STA → (SCA | SDA) → IA
# 1. STA classifies messages and emits TriageAssessment
# 2. SCA provides coaching or SDA escalates to clinical staff
# 3. IA aggregates anonymized metrics with differential privacy
```

## CBT Module System

### Module Location
`backend/app/cbt_modules/` - Therapeutic intervention modules

### Required Methods
```python
async def get_step_prompt(step: int, state: Dict) -> str
async def process_response(user_input: str, step: int, state: Dict) -> ProcessingResult
async def should_complete(state: Dict) -> bool
```

### State Management
- **Redis keys:** `module_state:{user_id}:{session_id}`
- **Track:** Current step, collected responses, completion status
- **Always anonymize** data before feeding to analytics

## Mental Health Safeguards

### Crisis Detection
- Monitor for crisis indicators in real-time via STA
- Provide emergency resources immediately
- Log all crisis escalations for audit

### Therapeutic Guidelines
- **Empathetic tone:** Always supportive and non-judgmental
- **Set boundaries:** Clearly state AI limitations
- **Cultural context:** Consider Indonesian mental health stigma
- **Professional referral:** Encourage human professional help when appropriate

### Privacy Requirements
- **Differential privacy:** Use ε-δ budgets for analytics (IA)
- **k-anonymity:** Aggregate data must meet k≥5 threshold
- **Consent ledger:** Append-only consent history with withdrawal support
- **No PII in logs:** Use redaction before logging

## API Conventions

### Backend Endpoints
- **Agent APIs:** `/api/v1/agents/{agent_name}/`
- **Admin APIs:** `/api/v1/admin/{resource}/`
- **Auth:** `/api/auth/`
- **Internal:** `/api/internal/` (secured with `INTERNAL_API_KEY`)

### Response Format
```python
# Success
{"success": True, "data": {...}}

# Error
{"success": False, "error": {"message": "User-friendly message", "code": "ERROR_CODE"}}
```

## Common Patterns

### Database Queries
```python
# Good - Async SQLAlchemy 2.0
async with db.begin():
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

# Bad - Don't use legacy query API
user = db.query(User).filter_by(id=user_id).first()  # AVOID
```

### LLM Calls
```python
# Use abstraction in backend/app/core/llm.py
from app.core.llm import get_llm_response

response = await get_llm_response(
    prompt=prompt,
    model="gemini-2.5-pro",
    temperature=0.7
)
```

### Redis State
```python
# Agent state
await redis.set(f"agent_state:{agent_name}", json.dumps(state))

# Module state
await redis.set(f"module_state:{user_id}:{session_id}", json.dumps(module_state))
```

## Testing Requirements

### Unit Tests Required For:
- All agent service methods
- All CBT module methods
- All API endpoints
- Database models and queries
- LangGraph orchestration logic

### Test Location
- Backend: `backend/tests/`
- Frontend: `frontend/__tests__/`

### Run Tests Before Commit
```bash
# Backend
pytest tests/ -v

# Frontend
npm test
```

## Documentation

### When to Update Docs
- Adding new agents → Update `backend/README.md` and agent table
- Changing architecture → Update `PROJECT_SINGLE_SOURCE_OF_TRUTH.md`
- New features → Update root `README.md`
- Deprecating code → Add to `docs/DEPRECATED.md`

### Reference Docs
- **Architecture:** `PROJECT_SINGLE_SOURCE_OF_TRUTH.md`
- **Safety Agents:** `docs/refactor_plan.md`
- **Mental Health:** `docs/mental-health-ai-guidelines.md`
- **API Reference:** Backend auto-generates OpenAPI docs at `/docs`

## Important Notes

### What NOT to Do
- ❌ Don't create standalone agent files outside `backend/app/agents/{sta,sca,sda,ia}/`
- ❌ Don't use n8n references (migrated to pure LangGraph)
- ❌ Don't reference legacy agents: `analytics_agent.py`, `intervention_agent.py`, `triage_agent.py` (deleted)
- ❌ Don't bypass LangGraph for agent coordination
- ❌ Don't hardcode Gemini API keys or database credentials

### Priorities
1. **User Safety** - Mental health data privacy and crisis handling
2. **Agent Coordination** - LangGraph-orchestrated workflows
3. **Privacy Compliance** - Differential privacy and consent management
4. **Therapeutic Quality** - Evidence-based CBT interventions
5. **Research Integrity** - Design Science Research (DSR) methodology

### Current Focus (October 2025)
- Migrating from legacy three-agent to Safety Agent Suite (STA/SCA/SDA/IA)
- Implementing LangGraph orchestration specifications
- Building Service Desk and Insights dashboards
- Expanding CBT module library

---

**For detailed architecture and research context, see `PROJECT_SINGLE_SOURCE_OF_TRUTH.md`**
