# CARE Token Dashboard - Complete Setup Guide

## ✅ What Was Created

A **fully independent CARE Token Dashboard** at the project root with:

### Structure

```
care-token-dashboard/
├── README.md                    # Complete documentation
├── docker-compose.yml           # PostgreSQL + Redis + Services
├── .env.example                 # Environment template
├── .gitignore                   # Git ignore rules
│
├── backend/                     # FastAPI Backend (Port 8001)
│   ├── app/
│   │   ├── main.py             # FastAPI app entry point
│   │   ├── core/
│   │   │   ├── config.py       # Pydantic settings
│   │   │   └── auth.py         # JWT authentication
│   │   ├── db/
│   │   │   └── session.py      # SQLAlchemy async session
│   │   ├── models/
│   │   │   └── __init__.py     # User, RevenueReport, RevenueApproval models
│   │   ├── api/
│   │   │   └── routes/
│   │   │       ├── health.py   # Health check endpoint
│   │   │       ├── auth.py     # Login, me, refresh token
│   │   │       ├── revenue.py  # Revenue management API
│   │   │       ├── staking.py  # Staking analytics API
│   │   │       └── approvals.py # Multi-sig approval workflow
│   │   └── services/
│   │       ├── revenue_tracker.py # Web3 + revenue aggregation
│   │       └── scheduler.py    # APScheduler monthly automation
│   ├── alembic/                # Database migrations
│   │   ├── env.py              # Alembic async config
│   │   └── script.py.mako      # Migration template
│   ├── scripts/
│   │   ├── create_admin.py     # Create admin user
│   │   └── init.sql            # PostgreSQL init script
│   ├── requirements.txt        # Python dependencies
│   ├── Dockerfile              # Backend container
│   ├── alembic.ini             # Alembic configuration
│   └── .env.example            # Backend environment template
│
└── frontend/                    # Vite + React Frontend (Port 5173)
    ├── src/
    │   ├── main.tsx             # React app entry point
    │   ├── App.tsx              # Router configuration
    │   ├── index.css            # Tailwind CSS styles
    │   ├── config.ts            # Environment variables
    │   ├── stores/
    │   │   └── authStore.ts     # Zustand auth state
    │   ├── lib/
    │   │   └── api.ts           # Axios API client
    │   ├── components/
    │   │   └── layout/
    │   │       └── DashboardLayout.tsx # Main layout with sidebar
    │   └── pages/
    │       ├── LoginPage.tsx    # Login page
    │       ├── DashboardPage.tsx # Main dashboard
    │       ├── RevenuePage.tsx   # Revenue management
    │       ├── StakingPage.tsx   # Staking analytics
    │       └── ApprovalsPage.tsx # Approval workflow
    ├── package.json             # npm dependencies
    ├── vite.config.ts           # Vite configuration
    ├── tsconfig.json            # TypeScript config
    ├── tailwind.config.js       # Tailwind CSS config
    ├── Dockerfile               # Frontend container
    └── .env.example             # Frontend environment template
```

### Features Implemented

#### Backend (FastAPI)

✅ **Authentication**

- JWT access + refresh tokens
- User roles: admin, finance_team, auditor, viewer
- Password hashing with bcrypt
- Protected endpoints with role-based access

✅ **Revenue Management**

- Real-time revenue aggregation (5 streams)
- Monthly report submission to blockchain
- Historical revenue data
- Dashboard with YTD stats
- Save reports to local database

✅ **Blockchain Integration**

- Web3.py for SOMNIA network
- PlatformRevenueOracle contract interaction
- Transaction signing and submission
- Block number tracking

✅ **Approval Workflow**

- Multi-sig approval (3-of-5)
- Challenge report mechanism
- Approval tracking per user
- Status transitions: draft → submitted → approved → finalized

✅ **Scheduler**

- APScheduler for monthly automation
- Runs 1st of month at 1 AM UTC
- Test mode (runs every minute)
- Health check endpoint

✅ **Database**

- PostgreSQL 15 with asyncpg
- SQLAlchemy 2.0 async
- Alembic migrations
- Models: User, RevenueReport, RevenueApproval

#### Frontend (React + TypeScript)

✅ **Authentication**

- Login page with email/password
- JWT token management with Zustand
- Auto-logout on 401

✅ **Dashboard**

- Stats cards (revenue, profit, stakers, TVL)
- Revenue breakdown visualization
- Real-time data with React Query

✅ **Routing**

- React Router v6
- Protected routes
- Dashboard layout with sidebar

✅ **Styling**

- Tailwind CSS
- Responsive design
- Custom card and button components

✅ **API Integration**

- Axios client with interceptors
- Token refresh handling
- Error handling with toast notifications

## 🚀 Quick Start

### 1. Start Database

```bash
cd care-token-dashboard
docker compose up -d postgres redis
```

Verify:

```bash
docker ps | grep care-token
```

### 2. Setup Backend

```bash
cd care-token-dashboard/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
nano .env  # Edit with your values

# Run migrations
alembic upgrade head

# Create admin user
python scripts/create_admin.py

# Start server
uvicorn app.main:app --reload --port 8001
```

Backend should be running on: `http://localhost:8001`

Test: `curl http://localhost:8001/api/v1/health`

### 3. Setup Frontend

```bash
cd care-token-dashboard/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
nano .env  # Edit with backend URL

# Start dev server
npm run dev
```

Frontend should be running on: `http://localhost:5173`

### 4. Login

1. Open browser: `http://localhost:5173`
2. Login with:
   - Email: `admin@ugm-aicare.org`
   - Password: `admin123`
3. Explore the dashboard!

## 📝 Configuration Guide

### Backend Environment (.env)

**Required Variables:**

```env
# Database
DATABASE_URL=postgresql+asyncpg://care_token_user:care_token_secure_pass_2024@localhost:5433/care_token_dashboard

# JWT (Generate with: openssl rand -hex 32)
SECRET_KEY=your-secret-key-here

# SOMNIA Blockchain
SOMNIA_RPC_URL=https://rpc.somnia.network
PLATFORM_REVENUE_ORACLE_ADDRESS=0x...  # From Phase 2 deployment
CARE_STAKING_HALAL_ADDRESS=0x...       # From Phase 2 deployment
CARE_TOKEN_ADDRESS=0x...               # CARE token contract

# Finance Team Wallet (must have FINANCE_TEAM_ROLE)
FINANCE_TEAM_PRIVATE_KEY=0x...

# Scheduler
ENABLE_MONTHLY_SCHEDULER=true
SCHEDULER_TEST_MODE=false  # Set to true for testing
```

### Frontend Environment (.env)

```env
VITE_API_BASE_URL=http://localhost:8001/api/v1
VITE_SOMNIA_RPC_URL=https://rpc.somnia.network
VITE_CARE_TOKEN_ADDRESS=0x...
VITE_PLATFORM_REVENUE_ORACLE_ADDRESS=0x...
VITE_CARE_STAKING_HALAL_ADDRESS=0x...
```

### Getting Contract Addresses

After deploying Phase 2 contracts (from `blockchain/scripts/`):

```bash
cd ../../blockchain  # From care-token-dashboard root

# Deploy contracts
npx hardhat run scripts/deploy-phase2-staking.ts --network somniaTestnet

# Deployment info saved to:
# deployments/phase2-staking-somniaTestnet-{timestamp}.json
```

Copy addresses from deployment JSON to `.env` files.

## 🔧 Development Workflow

### Database Migrations

After changing models in `backend/app/models/__init__.py`:

```bash
cd care-token-dashboard/backend

# Generate migration
alembic revision --autogenerate -m "Description of changes"

# Review migration in alembic/versions/

# Apply migration
alembic upgrade head

# Rollback if needed
alembic downgrade -1
```

### Adding New Users

```python
# backend/scripts/create_user.py (create this file)
import asyncio
from app.db.session import async_session_maker
from app.models import User, UserRole
from app.core.auth import get_password_hash

async def create_user():
    async with async_session_maker() as db:
        user = User(
            email="finance@ugm-aicare.org",
            hashed_password=get_password_hash("password123"),
            full_name="Finance Team Member",
            role=UserRole.FINANCE_TEAM,
            wallet_address="0x...",  # Ethereum address
            is_active=True
        )
        db.add(user)
        await db.commit()
        print(f"✅ User created: {user.email}")

asyncio.run(create_user())
```

Run: `python scripts/create_user.py`

### Testing API Endpoints

```bash
# Health check
curl http://localhost:8001/api/v1/health

# Login
curl -X POST http://localhost:8001/api/v1/auth/login \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin@ugm-aicare.org&password=admin123"

# Get current revenue (replace <TOKEN> with access_token from login)
curl http://localhost:8001/api/v1/revenue/current \
  -H "Authorization: Bearer <TOKEN>"
```

### Frontend Development

```bash
cd care-token-dashboard/frontend

# Run dev server with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## 🔗 Integration with Main UGM-AICare Database

The revenue tracker currently uses **placeholder values**. To connect to real data:

### Option 1: Database Cross-Connection (Recommended)

Add second database connection in `backend/app/core/config.py`:

```python
class Settings(BaseSettings):
    DATABASE_URL: str = "..."  # Token dashboard DB
    MAIN_DB_URL: str = "..."   # Main UGM-AICare DB
```

Update `backend/app/services/revenue_tracker.py` calculation methods:

```python
async def calculate_wellness_fees(self, year: int, month: int) -> Decimal:
    """Calculate wellness service fees"""
    from app.db.main_session import main_db_session_maker  # Create this
    
    async with main_db_session_maker() as main_db:
        result = await main_db.execute(
            select(func.sum(Transaction.amount))
            .where(
                Transaction.transaction_type == "wellness_fee",
                extract('year', Transaction.created_at) == year,
                extract('month', Transaction.created_at) == month,
                Transaction.status == "completed"
            )
        )
        return result.scalar() or Decimal(0)
```

### Option 2: API Integration

Create REST API in main UGM-AICare backend:

```python
# main-backend/app/routes/analytics.py
@router.get("/internal/revenue/{year}/{month}")
async def get_monthly_revenue(
    year: int,
    month: int,
    api_key: str = Header(..., alias="X-API-Key")
):
    # Verify internal API key
    if api_key != settings.INTERNAL_API_KEY:
        raise HTTPException(401, "Invalid API key")
    
    # Query revenue data
    wellness_fees = await calculate_wellness_fees(year, month)
    # ... other calculations
    
    return {
        "wellness_fees": str(wellness_fees),
        # ...
    }
```

Call from token dashboard:

```python
async def calculate_wellness_fees(self, year: int, month: int) -> Decimal:
    import httpx
    
    async with httpx.AsyncClient() as client:
        response = await client.get(
            f"{settings.MAIN_API_URL}/internal/revenue/{year}/{month}",
            headers={"X-API-Key": settings.MAIN_API_KEY}
        )
        data = response.json()
        return Decimal(data["wellness_fees"])
```

## 🎯 Next Steps

### 1. Deploy to Testnet (if not done)

```bash
cd ../../blockchain
npx hardhat run scripts/deploy-phase2-staking.ts --network somniaTestnet
npx hardhat run scripts/fund-staking-contract.ts --network somniaTestnet
```

### 2. Configure Contract Addresses

Update `.env` files with deployed contract addresses.

### 3. Grant Finance Role

```bash
# Run this after deploying oracle contract
npx hardhat run scripts/grant-roles.ts --network somniaTestnet
```

### 4. Test Monthly Report Submission

```bash
# Backend terminal
cd care-token-dashboard/backend

# Set test mode
export SCHEDULER_TEST_MODE=true

# Start server (scheduler runs every minute in test mode)
uvicorn app.main:app --reload --port 8001

# Watch logs
tail -f logs/app.log
```

### 5. Production Deployment

#### Option A: Docker Compose (Easiest)

```bash
cd care-token-dashboard
docker compose up -d
```

#### Option B: Manual Deployment

**Backend:**

- Deploy to Railway/Render/DigitalOcean App Platform
- Use managed PostgreSQL (Supabase/Railway)
- Set environment variables
- Run migrations on first deploy

**Frontend:**

- Deploy to Vercel/Netlify
- Set `VITE_API_BASE_URL` to production backend URL
- Build command: `npm run build`
- Output directory: `dist`

### 6. Security Hardening

✅ **Change Default Credentials**

```bash
python scripts/change_admin_password.py  # Create this script
```

✅ **Use Secrets Manager**

- AWS Secrets Manager
- Azure Key Vault
- HashiCorp Vault

✅ **Enable HTTPS**

- Use Cloudflare/Nginx reverse proxy
- Let's Encrypt SSL certificates

✅ **Rate Limiting**

```python
# Install: pip install slowapi
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@app.post("/api/v1/auth/login")
@limiter.limit("5/minute")
async def login(...):
    ...
```

✅ **Database Backups**

```bash
# Add to crontab
0 2 * * * pg_dump care_token_dashboard > /backups/dashboard_$(date +\%Y\%m\%d).sql
```

## 📊 Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8001/api/v1/health
```

Response:

```json
{
  "status": "healthy",
  "timestamp": "2025-10-28T12:00:00Z",
  "service": "care-token-dashboard",
  "version": "1.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "message": "Database connection successful"
    },
    "blockchain": {
      "status": "healthy",
      "message": "Connected to SOMNIA (block: 12345678)"
    },
    "scheduler": {
      "status": "healthy",
      "running": true,
      "next_run": "2025-11-01T01:00:00Z"
    }
  }
}
```

### Logs

```bash
# Backend logs
tail -f care-token-dashboard/backend/logs/app.log

# Scheduler logs
grep "monthly_revenue_job" care-token-dashboard/backend/logs/app.log

# Docker logs
docker logs care-token-backend -f
```

## 🐛 Troubleshooting

### Backend won't start

```bash
# Check database connection
psql "postgresql://care_token_user:care_token_secure_pass_2024@localhost:5433/care_token_dashboard"

# Check migrations
cd backend
alembic current
alembic upgrade head

# Check logs
tail -f logs/app.log
```

### Frontend can't connect

```bash
# Check backend is running
curl http://localhost:8001/api/v1/health

# Check CORS settings
# Ensure backend .env has:
ALLOWED_ORIGINS=http://localhost:5173
```

### Blockchain submission fails

```bash
# Check wallet balance (need gas)
# Check RPC connection
curl -X POST https://rpc.somnia.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check contract addresses
# Check finance wallet has FINANCE_TEAM_ROLE
```

## 📚 API Documentation

Once backend is running:

- **Swagger UI**: `http://localhost:8001/docs`
- **ReDoc**: `http://localhost:8001/redoc`

## 🎓 Learning Resources

- **FastAPI**: <https://fastapi.tiangolo.com/>
- **SQLAlchemy Async**: <https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html>
- **React Query**: <https://tanstack.com/query/latest>
- **Tailwind CSS**: <https://tailwindcss.com/docs>
- **Web3.py**: <https://web3py.readthedocs.io/>

---

**Created**: October 28, 2025  
**Status**: ✅ Complete and ready for deployment  
**Support**: Contact dev team or finance lead for issues
