"""
Conversation State Management for Efficient Assessment

Tracks conversation state to enable smart caching and reduce redundant API calls.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class ConversationState:
    """Track conversation state for adaptive risk assessment."""
    
    conversation_id: str
    user_id: int
    
    # Message tracking
    message_count: int = 0
    messages_since_last_assessment: int = 0
    
    # Risk history
    last_risk_level: str = "unknown"
    last_risk_score: float = 0.0
    last_assessment_time: Optional[datetime] = None
    risk_trend: list[float] = field(default_factory=list)
    
    # Intent tracking (for caching intent classification)
    last_intent: str = "unknown"
    intent_stable_count: int = 0  # How many messages with same intent
    intent_changes: list[str] = field(default_factory=list)  # History of intent changes
    
    # Risk assessments history
    risk_assessments: list[dict] = field(default_factory=list)  # History of risk assessments
    
    # Emotional tracking
    recent_emotional_scores: list[float] = field(default_factory=list)
    emotional_volatility: float = 0.0
    
    # Efficiency metrics
    assessments_performed: int = 0
    assessments_skipped: int = 0
    gemini_calls_made: int = 0
    
    @property
    def cache_hit_rate(self) -> float:
        """Calculate cache hit rate (% of assessments skipped)."""
        total = self.assessments_performed + self.assessments_skipped
        if total == 0:
            return 0.0
        return self.assessments_skipped / total
    
    @property
    def efficiency_score(self) -> float:
        """Calculate efficiency score (0-1, higher = more efficient)."""
        # Penalize Gemini calls, reward skipped assessments
        if self.message_count == 0:
            return 1.0
        
        calls_per_message = self.gemini_calls_made / self.message_count
        # Ideal: < 0.3 Gemini calls per message (70%+ skip rate)
        efficiency = max(0.0, 1.0 - (calls_per_message / 0.5))
        return min(1.0, efficiency)
    
    def should_skip_intent_classification(self) -> bool:
        """
        Determine if intent classification can be skipped.
        
        Skip if:
        - Same intent for 3+ consecutive messages
        - Low risk level (safe conversation)
        - Short message (<20 words)
        """
        return (
            self.intent_stable_count >= 3 and
            self.last_risk_level == "low" and
            self.message_count > 0
        )
    
    def update_after_assessment(
        self,
        risk_level: str,
        risk_score: float,
        intent: str,
        skipped: bool = False,
        gemini_called: bool = False,
    ):
        """Update state after assessment."""
        self.message_count += 1
        
        if skipped:
            self.assessments_skipped += 1
        else:
            self.assessments_performed += 1
            self.messages_since_last_assessment = 0
            self.last_risk_level = risk_level
            self.last_risk_score = risk_score
            self.last_assessment_time = datetime.now()
            self.risk_trend.append(risk_score)
            
            # Keep only recent trend (last 10 assessments)
            if len(self.risk_trend) > 10:
                self.risk_trend = self.risk_trend[-10:]
        
        # Track intent stability
        if intent == self.last_intent:
            self.intent_stable_count += 1
        else:
            self.intent_stable_count = 1
            self.last_intent = intent
        
        if gemini_called:
            self.gemini_calls_made += 1
