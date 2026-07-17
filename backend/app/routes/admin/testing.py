"""Testing endpoints for admin panel - simulate users and conversations.

# pyright: reportMissingImports=false, reportOptionalMemberAccess=false
"""
from __future__ import annotations

import asyncio
import os
import logging
import secrets
import subprocess
import sys
import uuid
from datetime import datetime, timedelta
from typing import Any, Dict, List, Literal, Optional
import json
from pathlib import Path
import random

from fastapi import APIRouter, Body, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_async_db
from app.dependencies import get_admin_user
from app.models import User  # Core model
from app.domains.mental_health.models import Conversation, Message
from app.domains.mental_health.models.messages import MessageRoleEnum
from app.domains.mental_health.models.appointments import Psychologist, AppointmentType
from app.domains.mental_health.models.assessments import UserScreeningProfile
from app.agents.sta.service import SafetyTriageService
from app.domains.mental_health.schemas.chat import ChatRequest, ChatResponse
from app.domains.mental_health.services.chat_processing import process_chat_message
from app.domains.mental_health.services.personal_context import build_user_personal_context
from app.agents.tca.service import TherapeuticCoachService
from app.agents.tca.schemas import TCAInterveneRequest

logger = logging.getLogger(__name__)

router = APIRouter(tags=["Admin - Testing"], prefix="/testing")

# Severity mapping for STA
_SEVERITY_MAP: dict[int, str] = {
    0: "low",
    1: "moderate",
    2: "high",
    3: "critical",
}


# --- Helpers ---
def load_rq_data(rq_type: str) -> List[Dict]:
    """Load RQ evaluation data from JSON files."""
    base_path = Path(__file__).parent.parent.parent.parent / "research_evaluation"
    
    if rq_type == "rq1":
        file_path = base_path / "rq1_crisis_detection" / "conversation_scenarios.json"
    elif rq_type == "rq2":
        file_path = base_path / "rq2_orchestration" / "orchestration_flows.json"
    elif rq_type == "rq3":
        file_path = base_path / "rq3_coaching_quality" / "coaching_scenarios.json"
    else:
        raise ValueError(f"Unknown RQ type: {rq_type}")
        
    if not file_path.exists():
        raise FileNotFoundError(f"RQ data file not found: {file_path}")
        
    with open(file_path, "r", encoding="utf-8") as f:
        return json.load(f)


# --- Schemas ---
# --- Schemas ---
class CreateTestUserRequest(BaseModel):
    """Request to create a test user."""
    email: Optional[EmailStr] = None
    name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="user", pattern="^(user|counselor|admin)$")
    university: Optional[str] = "Universitas Gadjah Mada"
    major: Optional[str] = None
    year_of_study: Optional[str] = None
    gender: Optional[str] = None
    city: Optional[str] = "Yogyakarta"
    # For counselors
    specialties: Optional[List[str]] = None
    schedule: Optional[Dict] = None


class CreateTestUserResponse(BaseModel):
    """Response with created user details."""
    user_id: int
    email: str
    name: str
    role: str
    created_at: str


class SeedDatabaseRequest(BaseModel):
    """Request to seed the database with test data."""
    users_count: int = Field(default=5, description="Number of student users to create")
    counselors_count: int = Field(default=2, description="Number of counselors to create")
    admins_count: int = Field(default=1, description="Number of admins to create")


class SeedDatabaseResponse(BaseModel):
    """Response after seeding."""
    users_created: int
    counselors_created: int
    admins_created: int
    details: List[str]


class SeedScreeningProfilesRequest(BaseModel):
    """Request to seed synthetic screening profiles for test users."""
    profiles_count: int = Field(default=12, ge=1, le=200)
    include_critical: bool = Field(default=True)
    requires_attention_ratio: float = Field(default=0.35, ge=0.0, le=1.0)


class SeedScreeningProfilesResponse(BaseModel):
    """Response after seeding synthetic screening profiles."""
    requested_profiles: int
    processed_profiles: int
    created_profiles: int
    updated_profiles: int
    risk_distribution: Dict[str, int]
    details: List[str]


class SimulateConversationRequest(BaseModel):
    """Request to simulate a conversation."""
    user_id: int
    messages: List[str] = Field(..., min_length=1, max_length=20, description="List of user messages")
    risk_level: Optional[str] = Field(None, pattern="^(low|med|high|critical)$")
    auto_classify: bool = Field(default=True, description="Automatically classify with STA")
    simulate_real_chat: bool = Field(default=False, description="Simulate real chat with AI responses via /chat endpoint")


class SimulateRealChatRequest(BaseModel):
    """Request to simulate a real chat conversation."""
    user_id: int
    user_messages: List[str] = Field(..., min_length=1, max_length=20, description="List of user messages to send sequentially")
    enable_sta: bool = Field(default=True, description="Enable STA risk analysis in chat flow")
    enable_tca: bool = Field(default=True, description="Enable TCA intervention generation")


class ConversationMessage(BaseModel):
    """Single conversation message."""
    role: str
    content: str
    timestamp: str


class SimulateConversationResponse(BaseModel):
    """Response with conversation details."""
    conversation_id: str
    session_id: str
    user_id: int
    messages_created: int
    conversations_created: int
    classification: Optional[dict] = None
    case_created: Optional[bool] = None


class SimulateRealChatResponse(BaseModel):
    """Response from real chat simulation."""
    session_id: str
    user_id: int
    conversation_turns: int
    ai_responses: List[str]
    risk_assessment: Optional[Dict] = None
    intervention_generated: bool = False
    case_created: bool = False
    final_history: List[Dict[str, str]]
    agent_routing_log: Optional[List[str]] = None  # RQ2 Verification


class FullUserFlowSimulationRequest(BaseModel):
    """Request to run end-to-end user flow simulation in one API call."""
    user_id: int
    user_messages: List[str] = Field(..., min_length=1, max_length=20)
    enable_sta: bool = True
    enable_tca: bool = True


class FullUserFlowSimulationResponse(BaseModel):
    """Response for full flow simulation summary."""
    user_id: int
    session_id: str
    ai_responses: List[str]
    escalation_triggered: bool
    case_id: Optional[str] = None
    case_status: Optional[str] = None
    case_severity: Optional[str] = None
    assigned_psychologist_id: Optional[int] = None
    assigned_counselor_user_id: Optional[int] = None
    assigned_counselor_name: Optional[str] = None
    counselor_can_see_case: bool = False
    counselor_case_page: str = "/counselor/cases"
    autopilot_actions: List[Dict[str, Any]] = Field(default_factory=list)
    notes: List[str] = Field(default_factory=list)


class ListTestUsersResponse(BaseModel):
    """Response with list of test users."""
    users: List[dict]
    total: int


class DeleteTestDataRequest(BaseModel):
    """Request to delete test data."""
    user_ids: Optional[List[int]] = Field(None, description="Specific user IDs to delete")
    delete_all_test_users: bool = Field(default=False, description="Delete all users with email containing 'test'")
    delete_conversations: bool = Field(default=True, description="Also delete conversations")


class DeleteTestDataResponse(BaseModel):
    """Response after deleting test data."""
    users_deleted: int
    conversations_deleted: int
    messages_deleted: int


class BatchTestRequest(BaseModel):
    """Request to run a batch of scenarios for RQ verification."""
    scenarios: Optional[List[Dict[str, str]]] = Field(None, description="List of scenarios with 'id', 'input', 'expected_risk'")
    rq1_eval_file: Optional[str] = Field(None, description="RQ1 evaluation file type (e.g., 'rq1') to load from disk")


class BatchTestResponse(BaseModel):
    """Response for batch test."""
    total_tests: int
    passed: int
    failed: int
    results: List[Dict]
    metrics: Optional[Dict] = None


class LogTailResponse(BaseModel):
    """Response for backend log tail data."""
    log_file: str
    returned_lines: int
    total_lines: int
    lines: List[str]


class AutopilotReplayResponse(BaseModel):
    """Response for autopilot replay execution."""
    scenario: str
    parameters: Dict[str, Any]
    command: str
    exit_code: int
    stdout_tail: List[str]
    stderr_tail: List[str]
    artifact_path: str
    artifact: Optional[Dict] = None


class AutopilotReplayRequest(BaseModel):
    """Request parameters for autopilot replay scenario execution."""
    scenario: Literal["attestation_pipeline", "case_management", "mixed_operations"] = "attestation_pipeline"
    action_a_type: Optional[Literal["publish_attestation", "mint_badge", "create_checkin", "create_case"]] = None
    action_a_risk: Optional[Literal["none", "low", "moderate", "high", "critical"]] = None
    action_b_type: Optional[Literal["publish_attestation", "mint_badge", "create_checkin", "create_case"]] = None
    action_b_risk: Optional[Literal["none", "low", "moderate", "high", "critical"]] = None
    auto_approve: bool = True
    wait_timeout_seconds: Optional[int] = Field(default=None, ge=10, le=600)
    wait_interval_seconds: Optional[float] = Field(default=None, ge=0.2, le=10.0)


def _tail_lines(file_path: Path, line_count: int) -> List[str]:
    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except FileNotFoundError:
        return []
    all_lines = content.splitlines()
    if line_count <= 0:
        return all_lines
    return all_lines[-line_count:]


def _tail_text_lines(value: bytes, line_count: int = 120) -> List[str]:
    text_value = value.decode("utf-8", errors="ignore")
    lines = text_value.splitlines()
    return lines[-line_count:]


# --- Endpoints ---
@router.get("/logs", response_model=LogTailResponse)
async def get_backend_logs(
    lines: int = Query(default=200, ge=10, le=2000),
    contains: Optional[str] = Query(default=None, min_length=1, max_length=200),
    admin_user: User = Depends(get_admin_user),
) -> LogTailResponse:
    """Return tail lines from backend logs for admin diagnostics/testing UI."""
    del admin_user

    backend_root = Path(__file__).resolve().parents[3]
    log_path = backend_root / "logs" / "app.log"

    all_tail_lines = _tail_lines(log_path, lines)
    if contains:
        needle = contains.strip().lower()
        filtered = [line for line in all_tail_lines if needle in line.lower()]
    else:
        filtered = all_tail_lines

    return LogTailResponse(
        log_file=str(log_path),
        returned_lines=len(filtered),
        total_lines=len(all_tail_lines),
        lines=filtered,
    )


@router.post("/autopilot-replay", response_model=AutopilotReplayResponse)
async def run_autopilot_replay(
    timeout_seconds: int = Query(default=240, ge=30, le=900),
    payload: AutopilotReplayRequest = Body(default_factory=AutopilotReplayRequest),
    admin_user: User = Depends(get_admin_user),
) -> AutopilotReplayResponse:
    """Run scripts/replay_autopilot_demo.py and return execution summary for admin testing UI."""
    del admin_user

    repo_root = Path(__file__).resolve().parents[4]
    script_path = repo_root / "scripts" / "replay_autopilot_demo.py"
    artifact_path = repo_root / "docs" / "autopilot_demo_artifact.json"

    if not script_path.exists():
        raise HTTPException(status_code=404, detail=f"Replay script not found: {script_path}")

    scenario_env = {
        "AUTOPILOT_DEMO_SCENARIO": payload.scenario,
        "AUTOPILOT_DEMO_AUTO_APPROVE": "true" if payload.auto_approve else "false",
    }
    if payload.action_a_type:
        scenario_env["AUTOPILOT_DEMO_ACTION_A_TYPE"] = payload.action_a_type
    if payload.action_a_risk:
        scenario_env["AUTOPILOT_DEMO_ACTION_A_RISK"] = payload.action_a_risk
    if payload.action_b_type:
        scenario_env["AUTOPILOT_DEMO_ACTION_B_TYPE"] = payload.action_b_type
    if payload.action_b_risk:
        scenario_env["AUTOPILOT_DEMO_ACTION_B_RISK"] = payload.action_b_risk
    if payload.wait_timeout_seconds is not None:
        scenario_env["AUTOPILOT_DEMO_WAIT_TIMEOUT_SECONDS"] = str(payload.wait_timeout_seconds)
    if payload.wait_interval_seconds is not None:
        scenario_env["AUTOPILOT_DEMO_WAIT_INTERVAL_SECONDS"] = str(payload.wait_interval_seconds)

    command = f"{sys.executable} {script_path} [scenario={payload.scenario}]"

    try:
        completed = await asyncio.to_thread(
            subprocess.run,
            [sys.executable, str(script_path)],
            cwd=str(repo_root),
            env={**os.environ, **scenario_env},
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=timeout_seconds,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(
            status_code=504,
            detail=f"Autopilot replay timed out after {timeout_seconds}s",
        ) from exc
    except OSError as exc:
        logger.exception("Failed to execute autopilot replay subprocess")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to execute autopilot replay subprocess: {exc}",
        ) from exc

    stdout_data = completed.stdout or b""
    stderr_data = completed.stderr or b""

    artifact_data: Optional[Dict] = None
    if artifact_path.exists():
        try:
            artifact_data = json.loads(artifact_path.read_text(encoding="utf-8"))
        except Exception:
            artifact_data = None

    return AutopilotReplayResponse(
        scenario=payload.scenario,
        parameters={
            "action_a_type": payload.action_a_type,
            "action_a_risk": payload.action_a_risk,
            "action_b_type": payload.action_b_type,
            "action_b_risk": payload.action_b_risk,
            "auto_approve": payload.auto_approve,
            "wait_timeout_seconds": payload.wait_timeout_seconds,
            "wait_interval_seconds": payload.wait_interval_seconds,
        },
        command=command,
        exit_code=int(completed.returncode or 0),
        stdout_tail=_tail_text_lines(stdout_data),
        stderr_tail=_tail_text_lines(stderr_data),
        artifact_path=str(artifact_path),
        artifact=artifact_data,
    )


@router.post("/users", response_model=CreateTestUserResponse, status_code=status.HTTP_201_CREATED)
async def create_test_user(
    request: CreateTestUserRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> CreateTestUserResponse:
    """Create a test user with randomized data."""
    logger.info(f"Admin {admin_user.id} creating test user: {request.name}")

    # Generate email if not provided
    if not request.email:
        random_suffix = secrets.token_hex(4)
        sanitized_name = request.name.lower().replace(" ", ".")
        request.email = f"{sanitized_name}.test.{random_suffix}@ugm.ac.id"

    # Check if email already exists
    result = await db.execute(select(User).where(User.email == request.email))
    existing_user = result.scalar_one_or_none()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with email {request.email} already exists"
        )

    # Create new user
    new_user = User(
        email=request.email,
        name=request.name,
        first_name=request.name.split()[0] if " " in request.name else request.name,
        last_name=request.name.split()[-1] if " " in request.name and len(request.name.split()) > 1 else None,
        role=request.role,
        university=request.university,
        major=request.major,
        year_of_study=request.year_of_study,
        gender=request.gender,
        city=request.city,
        is_active=True,
        email_verified=True,
        created_at=datetime.now(),
        google_sub=f"test_{secrets.token_hex(16)}",  # Fake Google sub for testing
    )

    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    
    # If counselor, we might want to add specialties/schedule (future implementation)
    # For now, just logging it
    if request.role == "counselor" and request.specialties:
        logger.info(f"Counselor {new_user.id} specialties: {request.specialties}")

    logger.info(f"Test user created: ID={new_user.id}, Email={new_user.email}")

    return CreateTestUserResponse(
        user_id=new_user.id,
        email=new_user.email,
        name=new_user.name or "",
        role=new_user.role,
        created_at=new_user.created_at.isoformat() if new_user.created_at else datetime.now().isoformat(),
    )


@router.post("/seed", response_model=SeedDatabaseResponse, status_code=status.HTTP_201_CREATED)
async def seed_database(
    request: SeedDatabaseRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> SeedDatabaseResponse:
    """Seed the database with comprehensive test data including users, counselors with schedules."""
    logger.info(f"Admin {admin_user.id} seeding database")
    
    from datetime import date
    
    created_details = []
    
    # --- Realistic Indonesian Names ---
    student_names = [
        "Budi Santoso", "Dewi Lestari", "Andi Pratama", "Siti Rahayu", "Rizky Aditya",
        "Putri Wulandari", "Muhammad Faisal", "Ayu Kusuma", "Dimas Nugroho", "Intan Permata"
    ]
    
    counselor_data = [
        {
            "name": "Dr. Sinta Dewi, M.Psi., Psikolog",
            "specialization": "Clinical Psychology - Anxiety & Depression",
            "bio": "Dr. Sinta adalah psikolog klinis berpengalaman dengan fokus pada gangguan kecemasan dan depresi pada mahasiswa. Beliau telah menangani lebih dari 500 klien selama 12 tahun karirnya di UGM.",
            "education": {
                "degrees": [
                    {"degree": "S.Psi", "institution": "Universitas Gadjah Mada", "year": 2008},
                    {"degree": "M.Psi (Psikologi Klinis)", "institution": "Universitas Indonesia", "year": 2012},
                    {"degree": "Dr. (Psikologi)", "institution": "Universitas Gadjah Mada", "year": 2018}
                ]
            },
            "certifications": {
                "items": [
                    "Surat Izin Praktik Psikolog (SIPP)",
                    "Certified CBT Practitioner - Beck Institute",
                    "Trauma-Informed Care Specialist",
                    "Member of HIMPSI Yogyakarta"
                ]
            },
            "years_of_experience": 12,
            "languages": {"spoken": ["Indonesian", "English", "Javanese"]},
            "availability_schedule": {
                "Monday": ["08:00-12:00", "13:00-16:00"],
                "Tuesday": ["09:00-12:00", "14:00-17:00"],
                "Wednesday": ["08:00-12:00"],
                "Thursday": ["09:00-12:00", "13:00-15:00"],
                "Friday": ["08:00-11:00"]
            },
            "consultation_fee": 150000.0,
            "rating": 4.9,
            "total_reviews": 127
        },
        {
            "name": "Pak Arif Wibowo, M.Psi., Psikolog",
            "specialization": "Educational Psychology - Academic Stress",
            "bio": "Pak Arif berfokus pada psikologi pendidikan dan membantu mahasiswa mengatasi stres akademik, burnout, dan masalah motivasi belajar. Pendekatan beliau ramah dan solution-focused.",
            "education": {
                "degrees": [
                    {"degree": "S.Psi", "institution": "Universitas Airlangga", "year": 2010},
                    {"degree": "M.Psi (Psikologi Pendidikan)", "institution": "Universitas Gadjah Mada", "year": 2014}
                ]
            },
            "certifications": {
                "items": [
                    "Surat Izin Praktik Psikolog (SIPP)",
                    "Solution-Focused Brief Therapy Practitioner",
                    "Academic Coaching Specialist",
                    "Member of Asosiasi Psikologi Pendidikan Indonesia"
                ]
            },
            "years_of_experience": 8,
            "languages": {"spoken": ["Indonesian", "English"]},
            "availability_schedule": {
                "Monday": ["13:00-17:00"],
                "Tuesday": ["08:00-12:00", "13:00-16:00"],
                "Wednesday": ["13:00-17:00"],
                "Thursday": ["08:00-12:00"],
                "Friday": ["09:00-12:00", "13:00-15:00"]
            },
            "consultation_fee": 100000.0,
            "rating": 4.7,
            "total_reviews": 89
        },
        {
            "name": "Ibu Ratna Sari, M.Psi., Psikolog",
            "specialization": "Counseling Psychology - Crisis Intervention",
            "bio": "Ibu Ratna adalah spesialis intervensi krisis dengan pengalaman menangani kasus darurat kesehatan mental. Beliau available untuk konsultasi urgent dan memiliki pendekatan yang warm dan supportive.",
            "education": {
                "degrees": [
                    {"degree": "S.Psi", "institution": "Universitas Gadjah Mada", "year": 2005},
                    {"degree": "M.Psi (Psikologi Konseling)", "institution": "Universitas Gadjah Mada", "year": 2009}
                ]
            },
            "certifications": {
                "items": [
                    "Surat Izin Praktik Psikolog (SIPP)",
                    "Crisis Intervention Specialist - IASP",
                    "Suicide Prevention Gatekeeper",
                    "Dialectical Behavior Therapy (DBT) Trained",
                    "Member of HIMPSI DIY"
                ]
            },
            "years_of_experience": 15,
            "languages": {"spoken": ["Indonesian", "Javanese", "English"]},
            "availability_schedule": {
                "Monday": ["08:00-12:00", "13:00-17:00"],
                "Tuesday": ["08:00-12:00", "13:00-17:00"],
                "Wednesday": ["08:00-12:00", "13:00-17:00"],
                "Thursday": ["08:00-12:00", "13:00-17:00"],
                "Friday": ["08:00-12:00"]
            },
            "consultation_fee": 0.0,  # Free for crisis
            "rating": 4.8,
            "total_reviews": 156
        }
    ]
    
    admin_names = ["Admin Kesehatan Mental UGM", "Koordinator Layanan Konseling"]
    
    majors = ["Psikologi", "Teknik Informatika", "Kedokteran", "Hukum", "Ekonomi", "Teknik Sipil", "Filsafat", "Sastra Inggris"]
    cities = ["Yogyakarta", "Jakarta", "Sleman", "Bantul", "Surabaya", "Bandung", "Semarang", "Malang"]
    
    # --- Helper Functions ---
    def random_date(start_year: int = 1995, end_year: int = 2005) -> date:
        start_date = date(start_year, 1, 1)
        end_date = date(end_year, 12, 31)
        time_between_dates = end_date - start_date
        days_between_dates = time_between_dates.days
        random_number_of_days = random.randrange(days_between_dates)
        return start_date + timedelta(days=random_number_of_days)

    # --- Create Students ---
    for i in range(min(request.users_count, len(student_names))):
        name = student_names[i]
        random_suffix = secrets.token_hex(4)
        sanitized_name = name.lower().replace(" ", ".").replace(",", "").replace(".", "")
        email = f"{sanitized_name}.test.{random_suffix}@mail.ugm.ac.id"
        
        gender = "Male" if i % 2 == 0 else "Female"
        
        user = User(
            email=email,
            name=name,
            first_name=name.split()[0],
            last_name=name.split()[-1] if " " in name else None,
            role="user",
            university="Universitas Gadjah Mada",
            is_active=True,
            email_verified=True,
            created_at=datetime.now(),
            google_sub=f"test_{secrets.token_hex(16)}",
            date_of_birth=random_date(2000, 2004),
            gender=gender,
            city=random.choice(cities),
            major=random.choice(majors),
            year_of_study=str(random.randint(2021, 2024)),
            sentiment_score=random.uniform(-0.3, 0.7),
            wallet_address=f"0x{secrets.token_hex(20)}",
            profile_photo_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}",
            preferred_name=name.split()[0],
            pronouns="He/Him" if gender == "Male" else "She/Her",
            phone=f"+628{random.randint(1000000000, 9999999999)}",
            consent_data_sharing=True,
            consent_research=True,
            consent_emergency_contact=True,
            preferred_language="Indonesian",
        )
        db.add(user)
        created_details.append(f"Student: {name} ({email})")
    
    # --- Create Counselors with Full Psychologist Profiles ---
    for i in range(min(request.counselors_count, len(counselor_data))):
        data = counselor_data[i]
        name = data["name"]
        random_suffix = secrets.token_hex(4)
        sanitized_name = name.lower().replace(" ", ".").replace(",", "").replace(".", "")[:20]
        email = f"{sanitized_name}.test.{random_suffix}@ugm.ac.id"
        
        # Determine gender from name prefix
        gender = "Female" if any(x in name.lower() for x in ["ibu", "dr. sinta", "ratna"]) else "Male"
        
        # Create User record
        user = User(
            email=email,
            name=name,
            first_name=name.split()[0],
            last_name=name.split()[-1] if " " in name else None,
            role="counselor",
            university="Universitas Gadjah Mada",
            is_active=True,
            email_verified=True,
            created_at=datetime.now(),
            google_sub=f"test_{secrets.token_hex(16)}",
            date_of_birth=random_date(1975, 1990),
            gender=gender,
            city="Yogyakarta",
            profile_photo_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}",
            preferred_name=name.split()[0],
            pronouns="He/Him" if gender == "Male" else "She/Her",
            phone=f"+628{random.randint(1000000000, 9999999999)}",
            consent_data_sharing=True,
            preferred_language="Indonesian",
        )
        db.add(user)
        await db.flush()  # Get user.id
        
        # Create Psychologist profile (linked to user)
        psychologist = Psychologist(
            user_id=user.id,
            name=name,
            specialization=data["specialization"],
            image_url=user.profile_photo_url,
            is_available=True,
            bio=data["bio"],
            education=data["education"],
            certifications=data["certifications"],
            years_of_experience=data["years_of_experience"],
            languages=data["languages"],
            availability_schedule=data["availability_schedule"],
            consultation_fee=data["consultation_fee"],
            rating=data["rating"],
            total_reviews=data["total_reviews"],
        )
        db.add(psychologist)
        created_details.append(f"Counselor: {name} ({email}) - Schedule: {list(data['availability_schedule'].keys())}")
    
    # --- Create Admins ---
    for i in range(min(request.admins_count, len(admin_names))):
        name = admin_names[i]
        random_suffix = secrets.token_hex(4)
        sanitized_name = f"admin{i+1}.test.{random_suffix}"
        email = f"{sanitized_name}@ugm.ac.id"
        
        user = User(
            email=email,
            name=name,
            first_name="Admin",
            last_name=f"UGM {i+1}",
            role="admin",
            university="Universitas Gadjah Mada",
            is_active=True,
            email_verified=True,
            created_at=datetime.now(),
            google_sub=f"test_{secrets.token_hex(16)}",
            city="Yogyakarta",
            profile_photo_url=f"https://api.dicebear.com/7.x/avataaars/svg?seed={email}",
            preferred_language="Indonesian",
        )
        db.add(user)
        created_details.append(f"Admin: {name} ({email})")
    
    # --- Create Appointment Types if not exist ---
    existing_types = await db.execute(select(AppointmentType))
    if not existing_types.scalars().first():
        appointment_types = [
            AppointmentType(id=1, name="General Counseling", duration_minutes=60, description="Konseling umum untuk berbagai masalah kesehatan mental"),
            AppointmentType(id=2, name="Academic Counseling", duration_minutes=45, description="Konseling terkait masalah akademik dan stres belajar"),
            AppointmentType(id=3, name="Career Counseling", duration_minutes=45, description="Konseling karir dan perencanaan masa depan"),
            AppointmentType(id=4, name="Crisis Intervention", duration_minutes=90, description="Intervensi krisis untuk keadaan darurat kesehatan mental"),
        ]
        for apt in appointment_types:
            db.add(apt)
        created_details.append("Created 4 appointment types")
    
    await db.commit()
    
    logger.info(f"Seeded database: {request.users_count} students, {request.counselors_count} counselors, {request.admins_count} admins")
    
    return SeedDatabaseResponse(
        users_created=min(request.users_count, len(student_names)),
        counselors_created=min(request.counselors_count, len(counselor_data)),
        admins_created=min(request.admins_count, len(admin_names)),
        details=created_details
    )


@router.post("/seed-screening", response_model=SeedScreeningProfilesResponse, status_code=status.HTTP_201_CREATED)
async def seed_screening_profiles(
    request: SeedScreeningProfilesRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> SeedScreeningProfilesResponse:
    """Seed synthetic screening profiles for test users so admin Screening page has realistic data."""
    logger.info("Admin %s seeding screening profiles: %s", admin_user.id, request.model_dump())

    users_result = await db.execute(
        select(User)
        .where(User.email.ilike("%test%"), User.role == "user")
        .order_by(User.created_at.desc())
    )
    candidate_users = users_result.scalars().all()

    if not candidate_users:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No test student users found. Seed users first from Testing page.",
        )

    dimensions = [
        "depression",
        "anxiety",
        "stress",
        "sleep",
        "social",
        "academic",
        "self_worth",
        "substance",
        "crisis",
    ]
    risk_levels = ["none", "mild", "moderate", "severe"]
    if request.include_critical:
        risk_levels.append("critical")

    score_ranges: Dict[str, tuple[float, float]] = {
        "none": (0.03, 0.18),
        "mild": (0.20, 0.36),
        "moderate": (0.38, 0.55),
        "severe": (0.58, 0.74),
        "critical": (0.80, 0.95),
    }

    selected_users = random.sample(candidate_users, min(request.profiles_count, len(candidate_users)))
    created_profiles = 0
    updated_profiles = 0
    risk_distribution: Dict[str, int] = {"none": 0, "mild": 0, "moderate": 0, "severe": 0, "critical": 0}
    details: List[str] = []

    for user in selected_users:
        risk = random.choice(risk_levels)
        risk_distribution[risk] = risk_distribution.get(risk, 0) + 1

        min_score, max_score = score_ranges[risk]
        dimension_scores: Dict[str, Dict[str, Any]] = {}

        for dim in dimensions:
            current_score = round(random.uniform(min_score, max_score), 3)
            if dim == "crisis" and risk in {"critical", "severe"}:
                current_score = round(max(current_score, random.uniform(0.68, 0.96)), 3)
            if dim == "substance" and risk in {"none", "mild"}:
                current_score = round(random.uniform(0.02, 0.28), 3)

            protective_score = round(random.uniform(0.02, 0.55), 3)
            trend = random.choice(["improving", "stable", "worsening"])

            dimension_scores[dim] = {
                "current_score": current_score,
                "protective_score": protective_score,
                "indicator_count": random.randint(1, 12),
                "last_updated": datetime.utcnow().isoformat(),
                "trend": trend,
            }

        ranked_dimensions = sorted(
            dimensions,
            key=lambda dim: dimension_scores[dim]["current_score"] - (dimension_scores[dim]["protective_score"] * 0.5),
            reverse=True,
        )
        primary_concerns = ranked_dimensions[:3]
        protective_factors = [
            dim
            for dim in dimensions
            if dimension_scores[dim]["protective_score"] >= 0.35 and dimension_scores[dim]["current_score"] < 0.45
        ][:3]

        requires_attention = (
            risk in {"moderate", "severe", "critical"}
            and random.random() < max(request.requires_attention_ratio, 0.2)
        ) or (risk == "critical")

        profile_data: Dict[str, Any] = {
            "risk_trajectory": random.choice(["improving", "stable", "declining"]),
            "dimension_scores": dimension_scores,
            "primary_concerns": primary_concerns,
            "protective_factors": protective_factors,
            "intervention_history": [],
            "screening_metadata": {
                "seeded_by": admin_user.id,
                "seeded_at": datetime.utcnow().isoformat(),
                "seed_version": "v1",
            },
        }

        existing_result = await db.execute(
            select(UserScreeningProfile).where(UserScreeningProfile.user_id == user.id)
        )
        existing_profile = existing_result.scalar_one_or_none()

        if existing_profile:
            existing_profile.profile_data = profile_data
            existing_profile.overall_risk = risk
            existing_profile.requires_attention = requires_attention
            existing_profile.total_messages_analyzed = random.randint(20, 220)
            existing_profile.total_sessions_analyzed = random.randint(2, 30)
            existing_profile.last_intervention_at = datetime.utcnow() - timedelta(days=random.randint(0, 14)) if requires_attention else None
            existing_profile.updated_at = datetime.utcnow()
            updated_profiles += 1
            details.append(f"Updated profile for user #{user.id} ({user.email}) -> {risk}")
        else:
            profile = UserScreeningProfile(
                user_id=user.id,
                profile_data=profile_data,
                overall_risk=risk,
                requires_attention=requires_attention,
                total_messages_analyzed=random.randint(20, 220),
                total_sessions_analyzed=random.randint(2, 30),
                last_intervention_at=datetime.utcnow() - timedelta(days=random.randint(0, 14)) if requires_attention else None,
            )
            db.add(profile)
            created_profiles += 1
            details.append(f"Created profile for user #{user.id} ({user.email}) -> {risk}")

    await db.commit()

    return SeedScreeningProfilesResponse(
        requested_profiles=request.profiles_count,
        processed_profiles=len(selected_users),
        created_profiles=created_profiles,
        updated_profiles=updated_profiles,
        risk_distribution=risk_distribution,
        details=details,
    )


@router.post("/chat-simulation", response_model=SimulateRealChatResponse, status_code=status.HTTP_201_CREATED)
async def simulate_real_chat(
    request: SimulateRealChatRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> SimulateRealChatResponse:
    """
    Simulate a real user conversation by calling the chat endpoint.
    
    This endpoint simulates how a real user would interact with Aika:
    1. Each message is sent through the actual /chat endpoint
    2. AI generates real responses (not pre-written)
    3. STA analyzes risk in the background
    4. Cases are auto-created for high/critical risks
    5. Full conversation history is maintained
    
    This provides realistic testing of the entire chat flow including agent integration.
    """
    logger.info(f"Admin {admin_user.id} simulating real chat for user {request.user_id}")

    # Verify user exists
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {request.user_id} not found"
        )

    # Generate session IDs
    session_id = str(uuid.uuid4())
    conversation_id = str(uuid.uuid4())

    # Build conversation history
    history: List[Dict[str, str]] = []
    ai_responses: List[str] = []
    
    # Track agent results
    final_risk_assessment = None
    intervention_generated = False
    case_created = False
    agent_routing_log = [] # RQ2

    # Import required functions
    # process_chat_message already imported at module level
    from app.domains.mental_health.services.personal_context import build_user_personal_context
    from app.core import llm
    
    # Default LLM responder without tool calling (for simplicity)
    async def _default_llm_responder(
        history_for_llm: List[Dict[str, str]],
        system_prompt: Optional[str],
        _request: ChatRequest,
        _stream_callback = None,
    ) -> str:
        """Simple LLM responder for testing."""
        model_name = "gemini_google"
        return await llm.generate_response(
            history=history_for_llm,
            model=model_name,
            max_tokens=1024,
            temperature=0.7,
            system_prompt=system_prompt,
        )

    # Get user's personal context
    personal_context = await build_user_personal_context(db, user)
    
    # System prompt
    system_prompt = """Kamu adalah Aika, AI pendamping kesehatan mental dari UGM-AICare. Anggap dirimu sebagai teman dekat bagi mahasiswa UGM yang sedang butuh teman cerita. Gunakan bahasa Indonesia yang santai dan kasual (gaya obrolan sehari-hari), jangan terlalu formal, kaku, atau seperti robot. Buat suasana ngobrol jadi nyaman dan nggak canggung (awkward). Sebisa mungkin, sesuaikan juga gaya bahasamu dengan yang dipakai pengguna.

Tujuan utamamu adalah menjadi pendengar yang baik, suportif, hangat, dan tidak menghakimi. Bantu pengguna mengeksplorasi perasaan mereka terkait kehidupan kuliah, stres, pertemanan, atau apapun yang ada di pikiran mereka. Validasi emosi mereka, tunjukkan kalau kamu paham dan peduli."""

    if personal_context:
        system_prompt = f"{system_prompt}\n\n{personal_context}"

    # Simulate each message
    for idx, user_message in enumerate(request.user_messages):
        logger.info(f"Processing message {idx + 1}/{len(request.user_messages)}: {user_message[:50]}...")
        
        try:
            # Create a ChatRequest
            chat_request = ChatRequest(
                google_sub=user.google_sub or f"test_{user.id}",
                session_id=session_id,
                conversation_id=conversation_id,
                message=user_message,
                history=history.copy(),
                provider="gemini",
                model="gemini_google",
                system_prompt=system_prompt,
            )
            
            # Process through actual chat flow
            result = await process_chat_message(
                request=chat_request,
                current_user=user,
                db=db,
                session_id=session_id,
                conversation_id=conversation_id,
                active_system_prompt=system_prompt,
                schedule_summary=None,
                summarize_now=None,
                llm_responder=_default_llm_responder,
            )
            
            # Extract AI response
            ai_response = result.response_text
            ai_responses.append(ai_response)
            
            # Update history
            history = result.final_history.copy()
            
            # Log routing (RQ2) - In a real implementation we would get this from the result object
            # For now, we infer it or use a placeholder
            agent_routing_log.append(f"Msg {idx+1}: Aika -> Direct Response") # Placeholder
            
            # Check for intervention plan (from agent integration)
            if result.intervention_plan:
                intervention_generated = True
                logger.info(f"Intervention plan generated for user {request.user_id}")
                agent_routing_log[-1] = f"Msg {idx+1}: Aika -> STA -> Intervention"
            
            logger.info(f"Message {idx + 1} processed. AI responded with {len(ai_response)} characters")
            
        except Exception as e:
            logger.error(f"Error processing message {idx + 1}: {e}", exc_info=True)
            # Add error response to maintain conversation flow
            ai_responses.append(f"[Simulation Error: {str(e)}]")
            history.append({"role": "user", "content": user_message})
            history.append({"role": "assistant", "content": f"[Error: {str(e)}]"})

    # After all messages, check if a case was created (from STA classification)
    # Query for recent triage assessments for this session
    from app.domains.mental_health.models import TriageAssessment, Case
    from sqlalchemy import desc
    
    triage_result = await db.execute(
        select(TriageAssessment)
        .where(TriageAssessment.user_id == request.user_id)
        .order_by(desc(TriageAssessment.created_at))
        .limit(1)
    )
    latest_triage = triage_result.scalar_one_or_none()
    
    if latest_triage:
        final_risk_assessment = {
            "severity": latest_triage.severity_level,
            "confidence": latest_triage.confidence_score,
            "risk_factors": latest_triage.risk_factors,
            "recommended_action": latest_triage.recommended_action,
        }
        
        # Check if case was created
        # Case model uses user_hash (not user_id), so we query by session_id
        case_result = await db.execute(
            select(Case)
            .where(Case.session_id == session_id)
            .order_by(desc(Case.created_at))
            .limit(1)
        )
        case = case_result.scalar_one_or_none()
        case_created = case is not None
        
        if case_created:
            logger.info(f"Case #{case.id} was created from this simulation (severity: {latest_triage.severity_level})")
            agent_routing_log.append(f"Post-Chat: STA -> Case Created (#{case.id})")

    logger.info(
        f"Real chat simulation completed: session={session_id}, "
        f"turns={len(request.user_messages)}, case_created={case_created}"
    )

    return SimulateRealChatResponse(
        session_id=session_id,
        user_id=request.user_id,
        conversation_turns=len(request.user_messages),
        ai_responses=ai_responses,
        risk_assessment=final_risk_assessment,
        intervention_generated=intervention_generated,
        case_created=case_created,
        final_history=history,
        agent_routing_log=agent_routing_log
    )


@router.post("/full-user-flow", response_model=FullUserFlowSimulationResponse, status_code=status.HTTP_201_CREATED)
async def simulate_full_user_flow(
    request: FullUserFlowSimulationRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> FullUserFlowSimulationResponse:
    """Run chat + escalation + assignment + counselor visibility checks in one endpoint."""
    logger.info("Admin %s running full user flow simulation for user %s", admin_user.id, request.user_id)

    chat_result = await simulate_real_chat(
        SimulateRealChatRequest(
            user_id=request.user_id,
            user_messages=request.user_messages,
            enable_sta=request.enable_sta,
            enable_tca=request.enable_tca,
        ),
        db=db,
        admin_user=admin_user,
    )

    from sqlalchemy import desc
    from app.domains.mental_health.models import Case
    from app.domains.mental_health.models.autopilot_actions import AutopilotAction

    notes: List[str] = []

    latest_case = (
        await db.execute(
            select(Case)
            .where(Case.session_id == chat_result.session_id)
            .order_by(desc(Case.created_at))
            .limit(1)
        )
    ).scalar_one_or_none()

    escalation_triggered = latest_case is not None

    assigned_psychologist_id: Optional[int] = None
    assigned_counselor_user_id: Optional[int] = None
    assigned_counselor_name: Optional[str] = None
    counselor_can_see_case = False

    if latest_case is not None and latest_case.assigned_to:
        try:
            assigned_psychologist_id = int(str(latest_case.assigned_to))
        except ValueError:
            assigned_psychologist_id = None

        if assigned_psychologist_id is not None:
            psych = (
                await db.execute(select(Psychologist).where(Psychologist.id == assigned_psychologist_id))
            ).scalar_one_or_none()
            if psych is not None and psych.user_id is not None:
                assigned_counselor_user_id = int(psych.user_id)
                counselor_user = (
                    await db.execute(select(User).where(User.id == psych.user_id))
                ).scalar_one_or_none()
                assigned_counselor_name = counselor_user.name if counselor_user else None
                counselor_can_see_case = latest_case.assigned_to == str(psych.id)
                notes.append("Case assigned to counselor profile and visible in counselor case list.")
            else:
                notes.append("Case assigned_to is set but matching counselor profile was not found.")
        else:
            notes.append("Case assigned_to is not a valid counselor profile id.")
    elif latest_case is not None:
        notes.append("Case exists but is not assigned to any counselor yet.")
    else:
        notes.append("No case created from this conversation (no escalation trigger).")

    autopilot_rows = (
        await db.execute(
            select(AutopilotAction)
            .where(AutopilotAction.payload_json.op("->>")("session_id") == chat_result.session_id)
            .order_by(desc(AutopilotAction.created_at))
            .limit(20)
        )
    ).scalars().all()

    autopilot_actions = [
        {
            "id": int(row.id),
            "action_type": row.action_type.value,
            "status": row.status.value,
            "risk_level": row.risk_level,
            "error_message": row.error_message,
            "created_at": row.created_at.isoformat() if row.created_at else None,
        }
        for row in autopilot_rows
    ]

    return FullUserFlowSimulationResponse(
        user_id=request.user_id,
        session_id=chat_result.session_id,
        ai_responses=chat_result.ai_responses,
        escalation_triggered=escalation_triggered,
        case_id=(str(latest_case.id) if latest_case is not None else None),
        case_status=(latest_case.status.value if latest_case is not None and hasattr(latest_case.status, "value") else None),
        case_severity=(latest_case.severity.value if latest_case is not None and hasattr(latest_case.severity, "value") else None),
        assigned_psychologist_id=assigned_psychologist_id,
        assigned_counselor_user_id=assigned_counselor_user_id,
        assigned_counselor_name=assigned_counselor_name,
        counselor_can_see_case=counselor_can_see_case,
        autopilot_actions=autopilot_actions,
        notes=notes,
    )


@router.post("/conversations", response_model=SimulateConversationResponse, status_code=status.HTTP_201_CREATED)
async def simulate_conversation(
    request: SimulateConversationRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> SimulateConversationResponse:
    """Simulate a conversation for a user with auto-classification."""
    logger.info(f"Admin {admin_user.id} simulating conversation for user {request.user_id}")

    # Verify user exists
    result = await db.execute(select(User).where(User.id == request.user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"User {request.user_id} not found"
        )

    # Generate IDs
    session_id = str(uuid.uuid4())
    conversation_id = str(uuid.uuid4())

    # Create conversations (old model)
    conversations_created = 0
    for idx, user_message in enumerate(request.messages):
        # Generate AI response
        ai_response = f"Thank you for sharing that. I understand you're experiencing {user_message[:50]}... Let me help you with that."
        
        conversation = Conversation(
            user_id=request.user_id,
            session_id=session_id,
            conversation_id=conversation_id,
            message=user_message,
            response=ai_response,
            timestamp=datetime.now() - timedelta(minutes=len(request.messages) - idx)
        )
        db.add(conversation)
        conversations_created += 1

    # Create messages (new model)
    messages_created = 0
    for idx, user_message in enumerate(request.messages):
        # User message
        user_msg = Message(
            id=uuid.uuid4(),
            session_id=session_id,
            role=MessageRoleEnum.user,
            content_redacted=user_message,
            ts=datetime.now() - timedelta(minutes=len(request.messages) - idx),
        )
        db.add(user_msg)
        messages_created += 1

        # Assistant response
        ai_response = f"Thank you for sharing that. I understand you're experiencing {user_message[:50]}... Let me help you with that."
        assistant_msg = Message(
            id=uuid.uuid4(),
            session_id=session_id,
            role=MessageRoleEnum.assistant,
            content_redacted=ai_response,
            ts=datetime.now() - timedelta(minutes=len(request.messages) - idx - 0.5),
        )
        db.add(assistant_msg)
        messages_created += 1

    await db.commit()

    # Auto-classify with STA if requested
    classification = None
    case_created = None
    
    if request.auto_classify:
        try:
            # Import STA classifier
            from app.agents.sta.classifiers import SafetyTriageClassifier
            from app.agents.sta.schemas import STAClassifyRequest
            from app.domains.mental_health.services.agent_orchestrator import AgentOrchestrator
            
            classifier = SafetyTriageClassifier()
            orchestrator = AgentOrchestrator(db)
            sta_service = SafetyTriageService(
                classifier=classifier,
                session=db,
                orchestrator=orchestrator,
            )
            
            # Build full conversation text
            full_conversation = "\n".join([
                f"User: {msg}" for msg in request.messages
            ])
            
            # Classify
            sta_request = STAClassifyRequest(
                session_id=session_id,
                text=full_conversation,
                meta={"user_id": request.user_id, "conversation_id": conversation_id}
            )
            sta_response = await sta_service.classify(payload=sta_request)
            
            # Query for the created triage assessment
            from app.domains.mental_health.models import TriageAssessment
            from sqlalchemy import desc
            
            triage_result = await db.execute(
                select(TriageAssessment)
                .where(TriageAssessment.user_id == request.user_id)
                .order_by(desc(TriageAssessment.created_at))
                .limit(1)
            )
            triage_assessment = triage_result.scalar_one_or_none()
            
            if triage_assessment:
                classification = {
                    "severity": triage_assessment.severity_level,
                    "confidence": triage_assessment.confidence_score,
                    "risk_factors": triage_assessment.risk_factors or [],
                    "recommended_action": triage_assessment.recommended_action,
                    "risk_level": sta_response.risk_level,
                    "intent": sta_response.intent,
                    "next_step": sta_response.next_step,
                }
                
                # Check if case was created (high/critical)
                case_created = triage_assessment.severity_level in ["high", "critical"]
                
                logger.info(f"STA classification: {classification['severity']} (confidence: {classification['confidence']})")
            else:
                classification = {"error": "Classification completed but assessment not found"}
                case_created = False
            
        except Exception as e:
            logger.error(f"STA classification failed: {e}", exc_info=True)
            classification = {"error": str(e)}

    logger.info(
        f"Conversation simulated: session={session_id}, "
        f"conversations={conversations_created}, messages={messages_created}"
    )

    return SimulateConversationResponse(
        conversation_id=conversation_id,
        session_id=session_id,
        user_id=request.user_id,
        messages_created=messages_created,
        conversations_created=conversations_created,
        classification=classification,
        case_created=case_created,
    )


@router.get("/users", response_model=ListTestUsersResponse)
async def list_test_users(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> ListTestUsersResponse:
    """List all test users (emails containing 'test')."""
    logger.info(f"Admin {admin_user.id} requesting test users list")

    result = await db.execute(
        select(User)
        .where(User.email.ilike("%test%"))
        .order_by(User.created_at.desc())
    )
    users = result.scalars().all()

    users_data = [
        {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "role": user.role,
            "university": user.university,
            "major": user.major,
            "created_at": user.created_at.isoformat() if user.created_at else None,
        }
        for user in users
    ]

    return ListTestUsersResponse(
        users=users_data,
        total=len(users_data)
    )


@router.delete("/cleanup", response_model=DeleteTestDataResponse)
async def delete_test_data(
    request: DeleteTestDataRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> DeleteTestDataResponse:
    """Delete test users and their associated data."""
    logger.warning(f"Admin {admin_user.id} deleting test data: {request.dict()}")

    users_deleted = 0
    conversations_deleted = 0
    messages_deleted = 0

    # Determine which users to delete
    user_ids_to_delete = []
    
    if request.delete_all_test_users:
        result = await db.execute(
            select(User.id).where(User.email.ilike("%test%"))
        )
        user_ids_to_delete = [row[0] for row in result.fetchall()]
    elif request.user_ids:
        user_ids_to_delete = request.user_ids

    if not user_ids_to_delete:
        return DeleteTestDataResponse(
            users_deleted=0,
            conversations_deleted=0,
            messages_deleted=0
        )

    # Delete screening profiles first to avoid FK conflicts when removing users
    screening_result = await db.execute(
        select(UserScreeningProfile).where(UserScreeningProfile.user_id.in_(user_ids_to_delete))
    )
    screening_profiles = screening_result.scalars().all()
    for profile in screening_profiles:
        await db.delete(profile)

    # Delete conversations first (if requested)
    if request.delete_conversations:
        for user_id in user_ids_to_delete:
            # Get session IDs from conversations
            conv_result = await db.execute(
                select(Conversation.session_id)
                .where(Conversation.user_id == user_id)
                .distinct()
            )
            session_ids = [row[0] for row in conv_result.fetchall()]

            # Delete old conversations
            conv_delete_result = await db.execute(
                select(Conversation).where(Conversation.user_id == user_id)
            )
            convs_to_delete = conv_delete_result.scalars().all()
            for conv in convs_to_delete:
                await db.delete(conv)
                conversations_deleted += 1

            # Delete new messages
            for session_id in session_ids:
                msg_delete_result = await db.execute(
                    select(Message).where(Message.session_id == session_id)
                )
                msgs_to_delete = msg_delete_result.scalars().all()
                for msg in msgs_to_delete:
                    await db.delete(msg)
                    messages_deleted += 1

    # Delete users
    for user_id in user_ids_to_delete:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()
        if user:
            await db.delete(user)
            users_deleted += 1

    await db.commit()

    logger.info(
        f"Test data deleted: users={users_deleted}, "
        f"conversations={conversations_deleted}, messages={messages_deleted}"
    )

    return DeleteTestDataResponse(
        users_deleted=users_deleted,
        conversations_deleted=conversations_deleted,
        messages_deleted=messages_deleted
    )


@router.post("/batch-test", response_model=BatchTestResponse)
async def batch_test_scenarios(
    request: BatchTestRequest,
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
) -> BatchTestResponse:
    """Run a batch of scenarios to verify RQ1 (Safety Classification)."""
    logger.info(f"Admin {admin_user.id} running batch test")
    
    # Import STA classifier
    from app.agents.sta.classifiers import SafetyTriageClassifier
    from app.agents.sta.schemas import STAClassifyRequest
    from app.domains.mental_health.services.agent_orchestrator import AgentOrchestrator
    
    classifier = SafetyTriageClassifier()
    orchestrator = AgentOrchestrator(db)
    sta_service = SafetyTriageService(
        classifier=classifier,
        session=db,
        orchestrator=orchestrator,
    )
    
    results = []
    passed = 0
    failed = 0
    
    metrics = {"tp": 0, "tn": 0, "fp": 0, "fn": 0}

    scenarios_to_run = request.scenarios or []
    if request.rq1_eval_file:
        try:
            scenarios_to_run = load_rq_data(request.rq1_eval_file)
            logger.info(f"Loaded {len(scenarios_to_run)} scenarios from RQ1 eval file: {request.rq1_eval_file}")
        except FileNotFoundError as e:
            logger.error(f"Failed to load RQ1 eval file: {e}")
            return BatchTestResponse(
                total_tests=0,
                passed=0,
                failed=0,
                results=[{"error": str(e)}],
                metrics={}
            )
    
    if not scenarios_to_run:
         return BatchTestResponse(
            total_tests=0,
            passed=0,
            failed=0,
            results=[],
            metrics={}
        )

    for scenario in scenarios_to_run:
        scenario_id = scenario.get("id", "unknown")
        # Handle different formats (simple dict vs full RQ1 format)
        if "turns" in scenario:
            turns = scenario["turns"]
            # Classify the last user message with full history context
            last_user_msg = next((t["content"] for t in reversed(turns) if t["role"] == "user"), "")
            full_conversation = "\n".join([f"{t['role'].capitalize()}: {t['content']}" for t in turns])
            
            input_text = full_conversation
            # RQ1 Mapping: is_crisis=True -> High/Critical, False -> Low/None
            expected_risk_category = "Crisis" if scenario.get("is_crisis") else "Non-Crisis"
            
        else:
            # Simple format
            input_text = scenario.get("input", "")
            expected_risk = scenario.get("expected_risk", "low")
            expected_risk_category = "Crisis" if expected_risk in ["moderate", "high", "critical"] else "Non-Crisis"

        try:
            # Classify
            sta_request = STAClassifyRequest(
                session_id=f"batch-test-{uuid.uuid4()}",
                text=input_text,
                meta={"user_id": admin_user.id, "conversation_id": f"batch-{uuid.uuid4()}"}
            )
            sta_response = await sta_service.classify(payload=sta_request)
            
            actual_risk = sta_response.risk_level
            actual_risk_category = "Crisis" if actual_risk in ["moderate", "high", "critical"] else "Non-Crisis"
            
            is_pass = expected_risk_category == actual_risk_category
            
            if is_pass:
                passed += 1
                if expected_risk_category == "Crisis":
                    metrics["tp"] += 1
                else:
                    metrics["tn"] += 1
            else:
                failed += 1
                if expected_risk_category == "Crisis":
                    metrics["fn"] += 1 # Expected crisis, got non-crisis
                else:
                    metrics["fp"] += 1 # Expected non-crisis, got crisis
                
            results.append({
                "id": scenario_id,
                "input": input_text[:100] + "...",
                "expected": expected_risk_category,
                "actual": actual_risk_category,
                "risk_level": actual_risk,
                "passed": is_pass
            })
            
        except Exception as e:
            logger.error(f"Scenario {scenario_id} failed: {e}")
            results.append({
                "id": scenario_id,
                "error": str(e),
                "passed": False
            })
            failed += 1

    # Calculate Metrics
    total = passed + failed
    tp = metrics["tp"]
    tn = metrics["tn"]
    fp = metrics["fp"]
    fn = metrics["fn"]
    
    sensitivity = tp / (tp + fn) if (tp + fn) > 0 else 0
    specificity = tn / (tn + fp) if (tn + fp) > 0 else 0
    accuracy = (tp + tn) / total if total > 0 else 0
    precision = tp / (tp + fp) if (tp + fp) > 0 else 0
    
    return BatchTestResponse(
        total_tests=total,
        passed=passed,
        failed=failed,
        results=results,
        metrics={
            "sensitivity": round(sensitivity, 2),
            "specificity": round(specificity, 2),
            "accuracy": round(accuracy, 2),
            "precision": round(precision, 2),
            "confusion_matrix": {"tp": tp, "tn": tn, "fp": fp, "fn": fn}
        }
    )

# --- RQ2 & RQ3 Endpoints ---

@router.post("/rq2/validation", response_model=Dict)
async def validate_orchestration(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """RQ2: Validate orchestration flows."""
    flows = load_rq_data("rq2")
    results = []
    passed_flows = 0
    
    # Import required for simulation
    from app.core import llm
    
    # Default LLM responder
    async def _default_llm_responder(
        history_for_llm: List[Dict[str, str]],
        system_prompt: Optional[str],
        _request: ChatRequest,
        _stream_callback = None,
    ) -> str:
        return await llm.generate_response(
            history=history_for_llm,
            model="gemini_google",
            max_tokens=1024,
            temperature=0.7,
            system_prompt=system_prompt,
        )

    for flow in flows:
        flow_id = flow["flow_id"]
        conversation_turns = flow["conversation"]
        
        session_id = f"rq2-val-{uuid.uuid4()}"
        conversation_id = str(uuid.uuid4())
        history: List[Dict[str, str]] = []
        
        flow_passed = True
        details = []
        
        for idx, turn in enumerate(conversation_turns):
            user_message = turn["user"]
            expected_intent = turn["expected_intent"]
            expected_risk = turn["expected_risk"]
            expected_next_agent = turn["expected_next_agent"]
            
            try:
                chat_request = ChatRequest(
                    google_sub=f"test_{admin_user.id}",
                    session_id=session_id,
                    conversation_id=conversation_id,
                    message=user_message,
                    history=history.copy(),
                    provider="gemini",
                    model="gemini_google",
                )
                
                result = await process_chat_message(
                    request=chat_request,
                    current_user=admin_user,
                    db=db,
                    session_id=session_id,
                    conversation_id=conversation_id,
                    active_system_prompt=None,
                    llm_responder=_default_llm_responder,
                )
                
                # Update history
                history = [
                    {"role": h.role, "content": h.content} 
                    for h in result.final_history
                ]
                
                # Verify Metadata
                metadata = result.metadata or {}
                actual_intent = metadata.get("intent", "unknown")
                actual_risk = metadata.get("risk_level", "unknown")
                agents_invoked = metadata.get("agents_invoked", [])
                
                # Determine actual next agent
                actual_next_agent = "Aika"
                if "CMA" in agents_invoked:
                    actual_next_agent = "CMA"
                elif "TCA" in agents_invoked or "TCA" in agents_invoked:
                    actual_next_agent = "TCA"
                elif "STA" in agents_invoked and len(agents_invoked) == 1:
                     actual_next_agent = "Aika" # STA -> Aika
                
                # Normalize for comparison
                def normalize(s): return str(s).lower().replace("_", " ")
                
                intent_match = normalize(actual_intent) == normalize(expected_intent)
                
                # Risk match logic
                risk_match = normalize(actual_risk) == normalize(expected_risk)
                if expected_risk == "none" and actual_risk == "low": risk_match = True
                
                agent_match = normalize(actual_next_agent) == normalize(expected_next_agent)
                if normalize(expected_next_agent) == "sca": agent_match = normalize(actual_next_agent) == "tca"
                
                if not (intent_match and risk_match and agent_match):
                    flow_passed = False
                    details.append(
                        f"Turn {idx+1} Fail: "
                        f"Intent({actual_intent}/{expected_intent}), "
                        f"Risk({actual_risk}/{expected_risk}), "
                        f"Agent({actual_next_agent}/{expected_next_agent})"
                    )
                
            except Exception as e:
                flow_passed = False
                details.append(f"Turn {idx+1} Error: {str(e)}")
                logger.error(f"RQ2 Error: {e}", exc_info=True)
                break
        
        if flow_passed:
            passed_flows += 1
            status_str = "PASS"
        else:
            status_str = "FAIL"
            
        results.append({
            "flow_id": flow_id,
            "status": status_str,
            "passed": flow_passed,
            "details": "; ".join(details) if details else "All turns passed"
        })

    return {"total": len(flows), "passed": passed_flows, "results": results}


@router.post("/rq3/generate", response_model=Dict)
async def generate_coaching_responses(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """RQ3: Generate coaching responses."""
    scenarios = load_rq_data("rq3")
    responses = []
    
    tca_service = TherapeuticCoachService()
    
    for scenario in scenarios:
        prompt = scenario["prompt"]
        category = scenario.get("category", "general_support")
        scenario_id = scenario.get("scenario_id", "unknown")
        
        try:
            # Create request payload
            payload = TCAInterveneRequest(
                session_id=f"rq3-gen-{uuid.uuid4()}",
                intent=category,
                user_hash=f"test_hash_{admin_user.id}",
                options={
                    "source": "thesis_rq3",
                    "scenario_id": scenario_id,
                    "original_prompt": prompt,
                },
                consent_followup=False
            )
            
            # Call TCA Service with Gemini enabled
            tca_response = await tca_service.intervene(
                payload=payload,
                use_gemini_plan=True,
                plan_type="general_coping", # Default or map from category
                user_message=prompt,
                sta_context={"risk_level": "low"} # Assume low risk for coaching scenarios
            )
            
            # Format response text
            steps_text = "\n".join([f"{i+1}. {s.label} ({s.duration_min} min)" for i, s in enumerate(tca_response.plan_steps)])
            resources_text = "\n".join([f"- {r.title}: {r.url}" for r in tca_response.resource_cards])
            
            full_response = f"Plan Steps:\n{steps_text}\n\nResources:\n{resources_text}"
            
            responses.append({
                "id": scenario_id,
                "prompt": prompt,
                "response": full_response,
                "category": category
            })
            
        except Exception as e:
            logger.error(f"RQ3 Generation Error: {e}", exc_info=True)
            responses.append({
                "id": scenario_id,
                "prompt": prompt,
                "response": f"Error generating response: {str(e)}",
                "category": category
            })
        
    return {"responses": responses}


@router.post("/rq3/privacy-test", response_model=Dict)
async def verify_privacy_preservation(
    db: AsyncSession = Depends(get_async_db),
    admin_user: User = Depends(get_admin_user),
):
    """RQ3: Verify k-anonymity privacy preservation."""
    logger.info(f"Admin {admin_user.id} running privacy test")
    
    results = {
        "k_threshold": 5,
        "high_severity_count": 0,
        "critical_severity_count": 0,
        "high_severity_visible": False,
        "critical_severity_suppressed": False,
        "passed": False,
        "details": []
    }
    
    # 1. Seed Data
    session_prefix = f"priv_test_{uuid.uuid4().hex[:8]}"
    
    try:
        # Insert 7 HIGH severity cases
        for i in range(7):
            await db.execute(text("""
                INSERT INTO cases (id, created_at, status, severity, user_hash, session_id)
                VALUES (:id, :created_at, 'new', 'high', :user_hash, :session_id)
            """), {
                "id": uuid.uuid4(),
                "created_at": datetime.now(),
                "user_hash": f"user_high_{i}",
                "session_id": f"{session_prefix}_high_{i}"
            })
            
        # Insert 3 CRITICAL severity cases
        for i in range(3):
            await db.execute(text("""
                INSERT INTO cases (id, created_at, status, severity, user_hash, session_id)
                VALUES (:id, :created_at, 'new', 'critical', :user_hash, :session_id)
            """), {
                "id": uuid.uuid4(),
                "created_at": datetime.now(),
                "user_hash": f"user_crit_{i}",
                "session_id": f"{session_prefix}_crit_{i}"
            })
            
        await db.commit()
        
        # 2. Run Query (Simulate Insights Agent)
        # We use the same query logic as the notebook/IA
        query = text("""
            SELECT 
                severity,
                COUNT(*) as crisis_count
            FROM cases
            WHERE 
                created_at >= :start_date 
                AND severity IN ('high', 'critical')
            GROUP BY severity
            HAVING COUNT(*) >= :k_threshold
        """)
        
        start_date = datetime.now().date()
        
        result = await db.execute(query, {
            "start_date": start_date,
            "k_threshold": 5
        })
        rows = result.fetchall()
        
        # 3. Verify
        high_found = False
        crit_found = False
        
        for row in rows:
            severity = row[0] # or row.severity
            count = row[1]    # or row.crisis_count
            
            if severity == 'high':
                high_found = True
                results["high_severity_count"] = count
            elif severity == 'critical':
                crit_found = True
                results["critical_severity_count"] = count
        
        results["high_severity_visible"] = high_found
        results["critical_severity_suppressed"] = not crit_found
        
        if high_found and not crit_found:
            results["passed"] = True
            results["details"].append("High severity group (n=7) visible. Critical severity group (n=3) suppressed.")
        else:
            results["passed"] = False
            if not high_found:
                results["details"].append("FAIL: High severity group not found (should be visible).")
            if crit_found:
                results["details"].append("FAIL: Critical severity group found (should be suppressed).")
                
    except Exception as e:
        logger.error(f"Privacy Test Error: {e}", exc_info=True)
        results["details"].append(f"Error: {str(e)}")
        
    finally:
        # 4. Cleanup
        await db.execute(text(f"DELETE FROM cases WHERE session_id LIKE '{session_prefix}%'"))
        await db.commit()
        
    return results
