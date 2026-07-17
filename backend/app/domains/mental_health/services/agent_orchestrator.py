"""Agent orchestrator for coordinating agent actions and workflows.

Handles automatic case creation, event dispatching, and agent coordination.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.settings import get_settings
from app.models import AgentHealthLog, CaseAssignment  # Core infrastructure models
from app.domains.mental_health.models import (
    Case,
    CaseSeverityEnum,
    CaseStatusEnum,
    TriageAssessment,
)
from app.services.event_bus import EventType, get_event_bus, publish_event

logger = logging.getLogger(__name__)
settings = get_settings()


class AgentOrchestrator:
    """Orchestrates agent actions and workflows.
    
    Primary responsibilities:
    - Auto-create CMA cases from high/critical STA classifications
    - Link triage assessments to cases
    - Calculate SLA breach times
    - Emit events for monitoring and coordination
    - Log agent health and errors
    """
    
    def __init__(self, db: AsyncSession) -> None:
        self.db = db
        self.event_bus = get_event_bus()
    
    async def handle_sta_classification(
        self,
        triage_assessment: TriageAssessment,
        user_hash: str,
        session_id: str | None = None,
        conversation_id: int | None = None
    ) -> Case | None:
        """Handle STA classification result and auto-create case if needed.
        
        Args:
            triage_assessment: The completed triage assessment
            user_hash: Anonymized user identifier
            session_id: Session identifier
            conversation_id: Optional conversation ID to link
            
        Returns:
            Created Case object if severity is high/critical, None otherwise
        """
        severity_level = triage_assessment.severity_level.lower()
        risk_score = triage_assessment.risk_score
        
        logger.info(
            f"Processing STA classification: severity={severity_level}, "
            f"risk_score={risk_score}, user_hash={user_hash}"
        )
        
        # Auto-create case for high/critical severity
        if severity_level in ('high', 'critical'):
            try:
                case = await self._create_case_from_triage(
                    triage_assessment=triage_assessment,
                    user_hash=user_hash,
                    session_id=session_id,
                    conversation_id=conversation_id
                )
                
                # Emit event
                event_type = (
                    EventType.CRITICAL_RISK_DETECTED if severity_level == 'critical'
                    else EventType.HIGH_RISK_DETECTED
                )
                await publish_event(
                    event_type=event_type,
                    source_agent='sta',
                    data={
                        'case_id': str(case.id),
                        'severity': severity_level,
                        'risk_score': risk_score,
                        'user_hash': user_hash,
                        'triage_assessment_id': triage_assessment.id
                    }
                )
                
                logger.info(f"Created case {case.id} from STA classification")
                return case
                
            except Exception as e:
                logger.error(f"Failed to create case from STA classification: {e}", exc_info=True)
                await self._log_agent_error('sta', str(e))
                raise
        
        logger.debug(f"No case created for severity={severity_level}")
        return None
    
    async def _create_case_from_triage(
        self,
        triage_assessment: TriageAssessment,
        user_hash: str,
        session_id: str | None,
        conversation_id: int | None
    ) -> Case:
        """Create a new case from triage assessment.
        
        Args:
            triage_assessment: Source triage assessment
            user_hash: Anonymized user identifier
            session_id: Session ID
            conversation_id: Optional conversation ID
            
        Returns:
            Created Case object
        """
        # Map severity level to CaseSeverityEnum
        severity_map = {
            'low': CaseSeverityEnum.low,
            'med': CaseSeverityEnum.med,
            'high': CaseSeverityEnum.high,
            'critical': CaseSeverityEnum.critical
        }
        severity = severity_map.get(
            triage_assessment.severity_level.lower(),
            CaseSeverityEnum.med
        )
        
        # Calculate SLA breach time based on severity
        sla_minutes = (
            settings.sda_sla_minutes if severity == CaseSeverityEnum.critical
            else 60  # Default to 1 hour for high severity
        )
        sla_breach_at = datetime.utcnow() + timedelta(minutes=sla_minutes)
        
        # Generate redacted summary
        risk_factors = triage_assessment.risk_factors or []
        risk_factors_str = ', '.join(risk_factors) if isinstance(risk_factors, list) else 'unknown'
        summary_redacted = (
            f"Risk score: {triage_assessment.risk_score:.2f}, "
            f"Confidence: {triage_assessment.confidence_score:.2f}, "
            f"Risk factors: {risk_factors_str}"
        )
        
        # Create case
        case = Case(
            status=CaseStatusEnum.new,
            severity=severity,
            user_hash=user_hash,
            session_id=session_id,
            conversation_id=conversation_id,
            summary_redacted=summary_redacted,
            sla_breach_at=sla_breach_at,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.db.add(case)
        await self.db.flush()  # Get case.id without committing
        
        # Link triage assessment to case (if your schema supports it)
        # Note: You may need to add triage_assessment_id to cases table
        
        await self.db.commit()
        await self.db.refresh(case)
        
        logger.info(
            f"Created case {case.id}: severity={severity.value}, "
            f"SLA breach at {sla_breach_at}"
        )
        
        return case
    
    async def handle_case_assignment(
        self,
        case_id: UUID,
        assigned_to: str,
        assigned_by: int | None = None,
        previous_assignee: str | None = None,
        reason: str | None = None
    ) -> None:
        """Handle case assignment and create audit record.
        
        Args:
            case_id: Case UUID
            assigned_to: Assignee identifier (counselor ID/name)
            assigned_by: Admin user ID who made the assignment
            previous_assignee: Previous assignee if reassignment
            reason: Reassignment reason
        """
        # Create assignment audit record
        assignment = CaseAssignment(
            case_id=case_id,
            assigned_to=assigned_to,
            assigned_by=assigned_by,
            assigned_at=datetime.utcnow(),
            previous_assignee=previous_assignee,
            reassignment_reason=reason
        )
        
        self.db.add(assignment)
        await self.db.commit()
        
        # Emit event
        await publish_event(
            event_type=EventType.CASE_ASSIGNED,
            source_agent='sda',
            data={
                'case_id': str(case_id),
                'assigned_to': assigned_to,
                'assigned_by': assigned_by,
                'is_reassignment': previous_assignee is not None
            }
        )
        
        logger.info(f"Case {case_id} assigned to {assigned_to}")
    
    async def handle_ia_report_generated(
        self,
        report_id: UUID,
        trending_topics: list[dict[str, Any]],
        high_risk_count: int
    ) -> None:
        """Handle IA report generation and evaluate campaign triggers.
        
        Args:
            report_id: Generated report UUID
            trending_topics: List of trending topics with counts
            high_risk_count: Count of high/critical assessments
        """
        await publish_event(
            event_type=EventType.IA_REPORT_GENERATED,
            source_agent='ia',
            data={
                'report_id': str(report_id),
                'trending_topics': trending_topics,
                'high_risk_count': high_risk_count
            }
        )
        
        logger.info(f"IA report {report_id} generated, evaluating triggers...")
        
        # TODO: In Phase 5, evaluate campaign triggers here
        # For now, just emit the event for monitoring
    
    async def _log_agent_error(self, agent_name: str, error_details: str) -> None:
        """Log agent error to health monitoring.
        
        Args:
            agent_name: Name of agent that errored
            error_details: Error description
        """
        try:
            health_log = AgentHealthLog(
                agent_name=agent_name,
                status='degraded',
                last_run_at=datetime.utcnow(),
                error_count=1,
                error_details=error_details,
                created_at=datetime.utcnow()
            )
            
            self.db.add(health_log)
            await self.db.commit()
            
            await publish_event(
                event_type=EventType.AGENT_ERROR,
                source_agent=agent_name,
                data={'error': error_details}
            )
            
        except Exception as e:
            logger.error(f"Failed to log agent error: {e}", exc_info=True)
    
    async def log_agent_success(
        self,
        agent_name: str,
        performance_metrics: dict[str, Any] | None = None
    ) -> None:
        """Log successful agent execution.
        
        Args:
            agent_name: Name of agent
            performance_metrics: Optional performance data
        """
        try:
            health_log = AgentHealthLog(
                agent_name=agent_name,
                status='healthy',
                last_run_at=datetime.utcnow(),
                last_success_at=datetime.utcnow(),
                error_count=0,
                performance_metrics=performance_metrics,
                created_at=datetime.utcnow()
            )
            
            self.db.add(health_log)
            await self.db.commit()
            
        except Exception as e:
            logger.error(f"Failed to log agent success: {e}", exc_info=True)


def get_agent_orchestrator(db: AsyncSession) -> AgentOrchestrator:
    """Dependency to get agent orchestrator instance."""
    return AgentOrchestrator(db)
