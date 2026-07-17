# CARE Token Dashboard

**Independent finance and tokenomics management system for CARE token ecosystem**

This is a standalone application separate from the main UGM-AICare mental health platform, designed specifically for finance team operations, revenue tracking, and Sharia-compliant staking management.

## Architecture

```
care-token-dashboard/
├── frontend/          # Vite + React + TypeScript + Tailwind
├── backend/           # FastAPI + SQLAlchemy + Web3
├── docker-compose.yml # PostgreSQL database
└── README.md
```

## Tech Stack

### Frontend

- **Framework**: Vite + React 18 + TypeScript
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Query (TanStack Query)
- **Web3**: ethers.js v6
- **Charts**: Recharts
- **Authentication**: JWT tokens

### Backend

- **Framework**: FastAPI 0.100+
- **Database**: PostgreSQL 15 with asyncpg
- **ORM**: SQLAlchemy 2.0 (async)
- **Migrations**: Alembic
- **Web3**: web3.py >=6.0.0
- **Scheduler**: APScheduler 3.10+
- **Authentication**: JWT with bcrypt

### Blockchain

- **Network**: SOMNIA
- **Contracts**: CareStakingHalal, PlatformRevenueOracle
- **Standards**: ERC-20 (CARE token)

## Features

### Revenue Management

- 📊 Real-time revenue dashboard (5 streams)
- 📈 Monthly revenue reports with trends
- 💰 Automated blockchain submission
- 🔐 Multi-sig approval workflow (3-of-5)
- 📅 Monthly scheduler (1st of month automation)

### Staking Analytics

- 👥 Staker distribution by tier (Bronze/Silver/Gold/Platinum)
- 💎 TVL (Total Value Locked) tracking
- 📊 Profit distribution history
- 🎯 Wellness activity integration stats

### Finance Operations

- ✅ Submit monthly reports
- 👍 Approve reports (multi-sig)
- 🚨 Challenge reports (auditor)
- 📋 Audit trail with full history
- 💼 Treasury management

### Security Features

- 🔒 JWT authentication with refresh tokens
- 👨‍💼 Role-based access control (Admin, Finance Team, Auditor)
- 📝 Complete audit logging
- 🔐 Environment-based secrets management
- 🛡️ Rate limiting and CORS protection

## Quick Start

### Prerequisites

- Node.js 18+ and npm 9+
- Python 3.10+
- PostgreSQL 15+
- SOMNIA network RPC access

### 1. Database Setup

```bash
# Start PostgreSQL with Docker
cd care-token-dashboard
docker compose up -d postgres

# Or use existing PostgreSQL:
# Create database: care_token_dashboard
# Create user: care_token_user (password in .env)
```

### 2. Backend Setup

```bash
cd care-token-dashboard/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your values

# Run migrations
alembic upgrade head

# Create admin user
python scripts/create_admin.py

# Start server
uvicorn app.main:app --reload --port 8001
```

Backend runs on: `http://localhost:8001`

### 3. Frontend Setup

```bash
cd care-token-dashboard/frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with backend URL

# Start dev server
npm run dev
```

Frontend runs on: `http://localhost:5173`

### 4. Verify Installation

1. Open browser: `http://localhost:5173`
2. Login with admin credentials
3. Check dashboard loads revenue data
4. Verify blockchain connection status

## Environment Configuration

### Backend (.env)

```env
# Database
DATABASE_URL=postgresql+asyncpg://care_token_user:password@localhost:5432/care_token_dashboard

# JWT
SECRET_KEY=your-secret-key-here
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# SOMNIA Blockchain
SOMNIA_RPC_URL=https://rpc.somnia.network
PLATFORM_REVENUE_ORACLE_ADDRESS=0x...
CARE_STAKING_HALAL_ADDRESS=0x...
CARE_TOKEN_ADDRESS=0x...

# Finance Team Wallet (must have FINANCE_TEAM_ROLE)
FINANCE_TEAM_PRIVATE_KEY=0x...

# Scheduler
ENABLE_MONTHLY_SCHEDULER=true
SCHEDULER_TEST_MODE=false

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://token-dashboard.ugm-aicare.org
```

### Frontend (.env)

```env
VITE_API_BASE_URL=http://localhost:8001/api/v1
VITE_SOMNIA_RPC_URL=https://rpc.somnia.network
VITE_CARE_TOKEN_ADDRESS=0x...
VITE_PLATFORM_REVENUE_ORACLE_ADDRESS=0x...
VITE_CARE_STAKING_HALAL_ADDRESS=0x...
```

## API Documentation

Once backend is running, visit:

- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

### Key Endpoints

#### Authentication

- `POST /api/v1/auth/login` - Login with email/password
- `POST /api/v1/auth/refresh` - Refresh access token
- `GET /api/v1/auth/me` - Get current user

#### Revenue

- `GET /api/v1/revenue/current` - Real-time revenue
- `GET /api/v1/revenue/month/{year}/{month}` - Historical data
- `POST /api/v1/revenue/submit` - Submit monthly report
- `GET /api/v1/revenue/dashboard` - 6-month summary
- `GET /api/v1/revenue/reports` - All reports with status

#### Approvals

- `POST /api/v1/approvals/approve/{report_id}` - Approve report
- `POST /api/v1/approvals/challenge/{report_id}` - Challenge report
- `GET /api/v1/approvals/pending` - Pending approvals

#### Staking

- `GET /api/v1/staking/overview` - TVL and staker stats
- `GET /api/v1/staking/tiers` - Tier distribution
- `GET /api/v1/staking/history` - Profit distribution history

## Development Workflow

### Running Tests

```bash
# Backend tests
cd care-token-dashboard/backend
pytest tests/ -v --cov=app

# Frontend tests
cd care-token-dashboard/frontend
npm test
```

### Database Migrations

```bash
cd care-token-dashboard/backend

# Create migration after model changes
alembic revision --autogenerate -m "Description of changes"

# Apply migrations
alembic upgrade head

# Rollback
alembic downgrade -1
```

### Building for Production

```bash
# Frontend
cd care-token-dashboard/frontend
npm run build
# Output in dist/

# Backend (no build needed, Python)
cd care-token-dashboard/backend
# Ensure requirements.txt up to date
pip freeze > requirements.txt
```

## Deployment

### Option 1: Docker Compose (Recommended)

```bash
cd care-token-dashboard
docker compose up -d
```

Services:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:8001`
- PostgreSQL: `localhost:5432`

### Option 2: Manual Deployment

1. **Frontend**: Deploy to Vercel/Netlify
2. **Backend**: Deploy to Railway/Render/DigitalOcean
3. **Database**: Use managed PostgreSQL (Supabase/Railway)

### Environment Variables (Production)

Ensure these are set in production:

- `DATABASE_URL` - Production PostgreSQL connection
- `SECRET_KEY` - Strong random key (never commit to Git)
- `FINANCE_TEAM_PRIVATE_KEY` - Secure wallet key (use secrets manager)
- `ALLOWED_ORIGINS` - Production frontend URL

## Security Considerations

### Authentication

- JWT tokens stored in httpOnly cookies
- Refresh token rotation
- Strong password hashing (bcrypt)
- Rate limiting on login attempts

### Blockchain

- Private keys stored in environment variables (use secrets manager in production)
- Multi-sig approval workflow (3-of-5)
- Transaction replay protection
- Gas price limits

### API Security

- CORS whitelist
- Request validation with Pydantic
- SQL injection protection (parameterized queries)
- Rate limiting per endpoint

### Audit Trail

- All revenue submissions logged
- Approval history tracked
- User actions logged with timestamps
- Blockchain transaction hashes stored

## Monitoring

### Health Checks

- Backend: `GET /api/v1/health`
- Database: Connection pool status
- Blockchain: RPC connection status
- Scheduler: Last run timestamp

### Logging

- Structured logging with context
- Log levels: DEBUG, INFO, WARNING, ERROR
- Separate log files for scheduler
- Audit logs for finance operations

## Troubleshooting

### Backend won't start

```bash
# Check database connection
psql postgresql://care_token_user:password@localhost:5432/care_token_dashboard

# Check migrations
alembic current
alembic upgrade head

# Check logs
tail -f backend/logs/app.log
```

### Frontend can't connect

```bash
# Check backend is running
curl http://localhost:8001/api/v1/health

# Check CORS settings in backend
# Ensure ALLOWED_ORIGINS includes frontend URL
```

### Scheduler not running

```bash
# Check logs
tail -f backend/logs/scheduler.log

# Verify environment variable
echo $ENABLE_MONTHLY_SCHEDULER  # Should be "true"

# Test manual trigger
curl -X POST http://localhost:8001/api/v1/revenue/submit \
  -H "Authorization: Bearer <token>"
```

### Blockchain submission fails

```bash
# Check wallet balance (gas fees)
# Check RPC connection
curl -X POST https://rpc.somnia.network \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Verify contract addresses
# Check finance wallet has FINANCE_TEAM_ROLE
```

## Contributing

This is an internal finance tool. For changes:

1. Create feature branch
2. Write tests
3. Update documentation
4. Submit PR for review by finance team lead

## License

Proprietary - UGM-AICare Internal Tool

---

**Support**: For issues, contact finance team lead or dev team
**Documentation**: Full API docs at `/docs` when backend running
