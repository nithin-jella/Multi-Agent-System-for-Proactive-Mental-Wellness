"""
User Clinical Record Model

**RESTRICTED ACCESS** - Contains sensitive mental health data.

Access Control:
- counselor: Can view/edit assigned users only
- admin: Can view all, edit with justification
- researcher: Anonymized access only (via IA agent)
- user: Can view own record (read-only)

Industry Best Practices Applied:
- TEXT for clinical notes (unlimited length)
- ARRAY for lists (warning_signs, coping_strategies)
- access_level field for granular permissions
- Audit fields (updated_by, last_reviewed_at) for compliance
"""

from sqlalchemy import Column, Integer, String, Date, DateTime, Boolean, ForeignKey, Text, ARRAY, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class UserClinicalRecord(Base):
    """
    User Clinical Record - **RESTRICTED** sensitive mental health data.
    
    Contains: Risk assessments, clinical summary, therapy info, safety plans.
    Access: Counselors/admins only. Isolated from public profile data.
    """
    
    __tablename__ = "user_clinical_records"
    
    # Primary Key & Foreign Key
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        unique=True, 
        nullable=False,
        index=True,
        comment="FK to users table (one-to-one relationship)"
    )
    
    # =====================================================================
    # RISK ASSESSMENT (STA Agent writes here)
    # =====================================================================
    current_risk_level = Column(
        String(20),
        index=True,
        comment="Current risk level: low, medium, high, critical"
    )
    last_risk_assessment_date = Column(
        DateTime(timezone=True),  # Best Practice: Always use timezone
        index=True
    )
    last_risk_score = Column(
        Float,
        comment="Numeric risk score (0.0-10.0) from STA agent"
    )
    highest_risk_level_ever = Column(
        String(20),
        comment="Historical peak risk level (for trend analysis)"
    )
    crisis_count = Column(
        Integer,
        default=0,
        comment="Number of crisis episodes detected"
    )
    
    # =====================================================================
    # CLINICAL SUMMARY
    # =====================================================================
    clinical_summary = Column(
        Text,  # Best Practice: TEXT for long clinical notes
        comment="Counselor's clinical summary (unlimited length)"
    )
    primary_concerns = Column(
        ARRAY(String),  # Best Practice: ARRAY better than comma-separated
        comment="Main mental health concerns (e.g., ['anxiety', 'depression'])"
    )
    diagnosed_conditions = Column(
        ARRAY(String),
        comment="Professionally diagnosed conditions (if any)"
    )
    symptom_onset_date = Column(
        Date,
        comment="When symptoms first appeared"
    )
    
    # =====================================================================
    # SAFETY PLAN (Critical for crisis intervention)
    # =====================================================================
    safety_plan_active = Column(
        Boolean,
        default=False,
        comment="Whether user has an active safety plan"
    )
    safety_plan_notes = Column(Text)
    safety_plan_created_at = Column(DateTime(timezone=True))
    safety_plan_reviewed_at = Column(DateTime(timezone=True))
    safety_plan_reviewed_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        comment="Counselor who last reviewed the safety plan"
    )
    
    # CBT-informed safety planning
    warning_signs = Column(
        ARRAY(String),
        comment="Early warning signs of crisis (e.g., ['isolation', 'sleep_disruption'])"
    )
    coping_strategies = Column(
        ARRAY(String),
        comment="Coping strategies for crisis (e.g., ['call_friend', 'breathing_exercise'])"
    )
    
    # =====================================================================
    # EXTERNAL THERAPY INFO
    # =====================================================================
    is_in_external_therapy = Column(
        Boolean,
        default=False,
        comment="Whether user is seeing an external therapist"
    )
    external_therapist_name = Column(String(200))
    external_therapist_contact = Column(String(100))
    external_therapist_institution = Column(String(200))
    therapy_modality = Column(
        String(100),
        comment="Type of therapy (e.g., 'CBT', 'DBT', 'Psychodynamic')"
    )
    therapy_frequency = Column(
        String(100),
        comment="e.g., 'weekly', 'biweekly', 'monthly'"
    )
    therapy_notes = Column(
        Text,
        comment="Non-sensitive therapy notes / context (avoid detailed clinical transcripts)"
    )
    therapy_start_date = Column(Date)
    therapy_end_date = Column(Date)
    
    # =====================================================================
    # MEDICATION INFO
    # =====================================================================
    is_on_medication = Column(
        Boolean,
        default=False,
        comment="Whether user is taking psychiatric medication"
    )
    medication_notes = Column(
        Text,
        comment="Medication details (not prescriptions - reference only)"
    )
    medication_start_date = Column(Date)
    prescribing_doctor = Column(String(200))
    
    # =====================================================================
    # INTERNAL NOTES (Counselor/Admin only)
    # =====================================================================
    aicare_team_notes = Column(
        Text,
        comment="Internal notes from UGM-AICare team (not visible to user)"
    )
    
    # =====================================================================
    # CASE MANAGEMENT (CMA Agent uses these)
    # =====================================================================
    flagged_for_review = Column(
        Boolean,
        default=False,
        index=True,
        comment="Flagged by agent for counselor review"
    )
    flagged_reason = Column(Text)
    flagged_at = Column(DateTime(timezone=True))
    flagged_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        comment="Agent/counselor who flagged this case"
    )
    
    # =====================================================================
    # ACCESS CONTROL (Best Practice: Granular permissions)
    # =====================================================================
    access_level = Column(
        String(50),
        default="counselor_only",
        comment="counselor_only | clinical_team | research_anonymized"
    )
    data_sharing_restrictions = Column(
        Text,
        comment="Special restrictions on data sharing (e.g., 'Do not share with external research')"
    )
    
    # =====================================================================
    # TIMESTAMPS & AUDIT TRAIL
    # =====================================================================
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False
    )
    updated_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        comment="Last counselor/admin who edited this record"
    )
    
    last_reviewed_at = Column(
        DateTime(timezone=True),
        comment="Last clinical review date (for SLA tracking)"
    )
    last_reviewed_by_user_id = Column(
        Integer,
        ForeignKey("users.id"),
        comment="Counselor who performed last review"
    )
    
    # =====================================================================
    # RELATIONSHIPS
    # =====================================================================
    user = relationship("User", back_populates="clinical_record", foreign_keys=[user_id])
    
    def __repr__(self):
        return f"<UserClinicalRecord(user_id={self.user_id}, risk_level='{self.current_risk_level}')>"
