"""
Mental Health Domain Module

This module encompasses all mental health-related functionality for UGM-AICare:
- User authentication and profile management
- Therapeutic chat and messaging
- CBT (Cognitive Behavioral Therapy) modules
- AI agents for mental health support (STA, TCA, CMA, IA)
- Clinical operations (interventions, appointments, counseling)
- Wellness tracking (journals, check-ins, summaries)
- Mental health assessments and surveys
- Gamification (quests, achievements)

This is the core domain of the platform, handling all mental health services
separate from financial operations (finance domain) and blockchain operations
(blockchain domain).

Structure:
- routes.py: Consolidated API routes for mental health services
- (Future) models/: Domain-specific models
- (Future) services/: Business logic for mental health operations
- (Future) agents/: AI agents subdirectory
"""

# For now, we'll import routes when they're created
# from app.domains.mental_health.routes import router as mental_health_router

__all__ = [
    # "mental_health_router",  # Uncomment when routes are created
]
