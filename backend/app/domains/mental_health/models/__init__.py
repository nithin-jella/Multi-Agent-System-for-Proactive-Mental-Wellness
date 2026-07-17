"""
Mental Health Domain Models
============================

Database models specific to mental health domain functionality.

Models are organized by subdomain:
- Chat: conversations, messages
- Wellness: journal entries, quests
- Clinical: appointments, interventions, assessments
- Agents: agent-specific data structures
- Feedback: user feedback and ratings
- Safety: cases, consents, events, resources
"""

# Chat subdomain
from .conversations import Conversation, UserSummary
from .messages import Message, MessageRoleEnum

# Wellness subdomain
from .journal import JournalPrompt, JournalEntry, JournalReflectionPoint, JournalTag
from .quests import (
    QuestTemplate,
    QuestInstance,
    QuestCategoryEnum,
    QuestDifficultyEnum,
    QuestStatusEnum,
    PlayerWellnessState,
    RewardLedgerEntry,
    AttestationRecord,
    AttestationStatusEnum,
    ComplianceAuditLog,
    QuestAnalyticsEvent,
)

# Clinical subdomain
from .appointments import Psychologist, AppointmentType, Appointment
from .interventions import (
    InterventionCampaign,
    CampaignExecution,
    InterventionPlanRecord,
    InterventionPlanStepCompletion,
)
from .assessments import TriageAssessment, ConversationRiskAssessment, UserScreeningProfile

# Agents subdomain
from .agents import AgentRun, AgentMessage

# Feedback subdomain
from .feedback import Feedback, Survey, SurveyQuestion, SurveyResponse, SurveyAnswer

# Content subdomain
from .content import ContentResource, CbtModule, CbtModuleStep

# Events subdomain
from .events import Event, AgentNameEnum

# Safety subdomain
from .cases import Case, CaseNote, CaseStatusEnum, CaseSeverityEnum
from .consents import Consent, ConsentScopeEnum
from .resources import Resource
from .autopilot_actions import (
    AutopilotAction,
    AutopilotActionType,
    AutopilotPolicyDecision,
    AutopilotActionStatus,
)
from .agent_decision_events import AgentDecisionEvent

__all__ = [
    # Chat
    "Conversation",
    "UserSummary",
    "Message",
    "MessageRoleEnum",
    # Wellness
    "JournalPrompt",
    "JournalEntry",
    "JournalReflectionPoint",
    "JournalTag",
    "QuestTemplate",
    "QuestInstance",
    "QuestCategoryEnum",
    "QuestDifficultyEnum",
    "QuestStatusEnum",
    "PlayerWellnessState",
    "RewardLedgerEntry",
    "AttestationRecord",
    "AttestationStatusEnum",
    "ComplianceAuditLog",
    "QuestAnalyticsEvent",
    # Clinical
    "Psychologist",
    "AppointmentType",
    "Appointment",
    "InterventionCampaign",
    "CampaignExecution",
    "InterventionPlanRecord",
    "InterventionPlanStepCompletion",
    "TriageAssessment",
    "ConversationRiskAssessment",
    "UserScreeningProfile",
    # Agents
    "AgentRun",
    "AgentMessage",
    # Feedback
    "Feedback",
    "Survey",
    "SurveyQuestion",
    "SurveyResponse",
    "SurveyAnswer",
    # Content
    "ContentResource",
    "CbtModule",
    "CbtModuleStep",
    # Events
    "Event",
    "AgentNameEnum",
    # Safety
    "Case",
    "CaseNote",
    "CaseStatusEnum",
    "CaseSeverityEnum",
    "Consent",
    "ConsentScopeEnum",
    "Resource",
    "AutopilotAction",
    "AutopilotActionType",
    "AutopilotPolicyDecision",
    "AutopilotActionStatus",
    "AgentDecisionEvent",
]
