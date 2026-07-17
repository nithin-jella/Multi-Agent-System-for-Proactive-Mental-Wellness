"""
Activity Logger for Aika Meta-Agent

Tracks and broadcasts agent activities in real-time for monitoring and debugging.
"""

import logging
from typing import Dict, List, Optional, Callable, Any
from datetime import datetime
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class ActivityType(str, Enum):
    """Types of agent activities"""
    AGENT_START = "agent_start"
    AGENT_COMPLETE = "agent_complete"
    AGENT_ERROR = "agent_error"
    NODE_START = "node_start"
    NODE_COMPLETE = "node_complete"
    ROUTING_DECISION = "routing_decision"
    RISK_ASSESSMENT = "risk_assessment"
    INTERVENTION_CREATED = "intervention_created"
    CASE_CREATED = "case_created"
    LLM_CALL = "llm_call"
    DATABASE_OPERATION = "database_operation"
    INFO = "info"
    WARNING = "warning"


@dataclass
class ActivityEvent:
    """Single activity event"""
    timestamp: str
    activity_type: ActivityType
    agent: str  # STA, TCA, CMA, IA, or Aika
    message: str
    details: Optional[Dict[str, Any]] = None
    duration_ms: Optional[float] = None
    
    def to_dict(self) -> Dict:
        """Convert to dictionary for serialization"""
        return {
            "timestamp": self.timestamp,
            "activity_type": self.activity_type.value,
            "agent": self.agent,
            "message": self.message,
            "details": self.details or {},
            "duration_ms": self.duration_ms,
        }


class ActivityLogger:
    """
    Collects and broadcasts agent activities in real-time.
    
    Usage:
        activity_logger = ActivityLogger()
        activity_logger.set_callback(websocket.send_json)
        
        activity_logger.log_agent_start("STA", "Analyzing message for safety concerns")
        # ... agent work ...
        activity_logger.log_agent_complete("STA", "Risk assessment complete", {"risk_level": "low"})
    """
    
    def __init__(self):
        self.activities: List[ActivityEvent] = []
        self.callback: Optional[Callable] = None
        self._start_times: Dict[str, float] = {}
    
    def set_callback(self, callback: Callable):
        """Set callback function for real-time broadcasting"""
        self.callback = callback
    
    def _emit(self, event: ActivityEvent):
        """Emit event to callback and store in history"""
        self.activities.append(event)
        
        if self.callback:
            try:
                # Call callback with event data (e.g., WebSocket send)
                self.callback({
                    "type": "activity_log",
                    "data": event.to_dict()
                })
            except Exception as e:
                logger.warning(f"Failed to emit activity event: {e}")
    
    def _get_duration(self, key: str) -> Optional[float]:
        """Calculate duration since start time"""
        if key in self._start_times:
            import time
            duration = (time.time() - self._start_times[key]) * 1000
            del self._start_times[key]
            return duration
        return None
    
    def _mark_start(self, key: str):
        """Mark start time for duration calculation"""
        import time
        self._start_times[key] = time.time()
    
    # ===================== PUBLIC API =====================
    
    def log_agent_start(self, agent: str, message: str, details: Optional[Dict] = None):
        """Log agent starting execution"""
        self._mark_start(agent)
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.AGENT_START,
            agent=agent,
            message=message,
            details=details,
        )
        self._emit(event)
        logger.info(f"[{agent}] START: {message}")
    
    def log_agent_complete(self, agent: str, message: str, details: Optional[Dict] = None):
        """Log agent completing execution"""
        duration = self._get_duration(agent)
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.AGENT_COMPLETE,
            agent=agent,
            message=message,
            details=details,
            duration_ms=duration,
        )
        self._emit(event)
        logger.info(f"[{agent}] COMPLETE: {message} ({duration:.2f}ms)")
    
    def log_agent_error(self, agent: str, message: str, error: Exception):
        """Log agent error"""
        duration = self._get_duration(agent)
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.AGENT_ERROR,
            agent=agent,
            message=message,
            details={"error": str(error), "error_type": type(error).__name__},
            duration_ms=duration,
        )
        self._emit(event)
        logger.error(f"[{agent}] ERROR: {message} - {error}")
    
    def log_node_start(self, agent: str, node_name: str):
        """Log node starting execution"""
        key = f"{agent}:{node_name}"
        self._mark_start(key)
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.NODE_START,
            agent=agent,
            message=f"Executing node: {node_name}",
            details={"node": node_name},
        )
        self._emit(event)
    
    def log_node_complete(self, agent: str, node_name: str, details: Optional[Dict] = None):
        """Log node completing execution"""
        key = f"{agent}:{node_name}"
        duration = self._get_duration(key)
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.NODE_COMPLETE,
            agent=agent,
            message=f"Node complete: {node_name}",
            details={**(details or {}), "node": node_name},
            duration_ms=duration,
        )
        self._emit(event)
    
    def log_routing_decision(self, agent: str, decision: str, reason: str):
        """Log routing decision"""
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.ROUTING_DECISION,
            agent=agent,
            message=f"Routing decision: {decision}",
            details={"decision": decision, "reason": reason},
        )
        self._emit(event)
    
    def log_risk_assessment(self, risk_level: str, risk_score: float, risk_factors: List[str]):
        """Log risk assessment results"""
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.RISK_ASSESSMENT,
            agent="STA",
            message=f"Risk assessed: {risk_level} (score: {risk_score:.2f})",
            details={
                "risk_level": risk_level,
                "risk_score": risk_score,
                "risk_factors": risk_factors,
            },
        )
        self._emit(event)
    
    def log_intervention_created(self, plan_id: int, intervention_type: str):
        """Log intervention plan creation"""
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.INTERVENTION_CREATED,
            agent="TCA",
            message=f"Intervention plan created: {intervention_type}",
            details={
                "plan_id": plan_id,
                "intervention_type": intervention_type,
            },
        )
        self._emit(event)
    
    def log_case_created(self, case_id: int, severity: str, sla_hours: int):
        """Log case creation"""
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.CASE_CREATED,
            agent="CMA",
            message=f"Crisis case created: #{case_id} (SLA: {sla_hours}h)",
            details={
                "case_id": case_id,
                "severity": severity,
                "sla_hours": sla_hours,
            },
        )
        self._emit(event)
    
    def log_llm_call(self, agent: str, model: str, purpose: str):
        """Log LLM API call"""
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.LLM_CALL,
            agent=agent,
            message=f"LLM call: {purpose}",
            details={"model": model, "purpose": purpose},
        )
        self._emit(event)
    
    def log_info(self, agent: str, message: str, details: Optional[Dict] = None):
        """Log general info"""
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.INFO,
            agent=agent,
            message=message,
            details=details,
        )
        self._emit(event)
    
    def log_warning(self, agent: str, message: str, details: Optional[Dict] = None):
        """Log warning"""
        event = ActivityEvent(
            timestamp=datetime.utcnow().isoformat(),
            activity_type=ActivityType.WARNING,
            agent=agent,
            message=message,
            details=details,
        )
        self._emit(event)
    
    def get_activities(self) -> List[Dict]:
        """Get all activities as dictionaries"""
        return [event.to_dict() for event in self.activities]
    
    def clear(self):
        """Clear activity history"""
        self.activities.clear()
        self._start_times.clear()
