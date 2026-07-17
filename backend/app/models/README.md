# Models Architecture Documentation

## Overview

The UGM-AICare backend models have been completely modularized from a single large `models.py` file into organized domain-specific modules. This improves maintainability, reduces coupling, and makes the codebase easier to navigate and understand.

## File Structure

```bash
backend/app/models/
├── __init__.py                 # Central imports and exports
├── user.py                    # User authentication and profiles
├── conversations.py           # Chat and conversation history
├── journal.py                 # Journal entries and reflections
├── appointments.py            # Appointment scheduling and psychologists
├── feedback.py                # User feedback and surveys
├── content.py                 # Educational content and CBT modules
├── email.py                   # Email templates and distribution
├── social.py                  # Social media and gamification
├── interventions.py           # Automated intervention campaigns
├── agents.py                  # Agent execution tracking
├── assessments.py             # Risk assessment and triage
├── scheduling.py              # Therapist scheduling and sessions
└── langgraph_tracking.py      # Phase 2: LangGraph execution tracking
```

## Model Categories

### Core Models

- **user.py**: User authentication, profiles, preferences, and clinical data
  - `User`: Complete user profile with auth, clinical, and preference fields

### Communication Models

- **conversations.py**: Chat history and summaries
  - `Conversation`: User-AI chat interactions
  - `UserSummary`: Conversation summaries and insights

- **journal.py**: Reflective writing and mental health tracking
  - `JournalPrompt`: Writing prompts for users
  - `JournalEntry`: User journal entries
  - `JournalReflectionPoint`: Reflection points within entries

### Service Models

- **appointments.py**: Professional mental health services
  - `Psychologist`: Licensed professionals
  - `AppointmentType`: Types of appointments available
  - `Appointment`: Scheduled sessions

- **feedback.py**: User experience and research data
  - `Feedback`: User platform feedback
  - `Survey`: Survey definitions
  - `SurveyQuestion`: Individual survey questions
  - `SurveyResponse`: User survey responses
  - `SurveyAnswer`: Individual question answers

### Content Models

- **content.py**: Educational and therapeutic resources
  - `ContentResource`: Educational materials and resources
  - `CbtModule`: Cognitive Behavioral Therapy modules
  - `CbtModuleStep`: Individual CBT steps and exercises

- **email.py**: Communication system
  - `EmailTemplate`: Email templates for automation
  - `EmailGroup`: Distribution groups
  - `EmailRecipient`: Email recipients
  - `EmailLog`: Email sending history

### Engagement Models

- **social.py**: Gamification and social features
  - `Tweet`: Social media sentiment analysis
  - `UserBadge`: Achievement badges and rewards

### Intervention Models

> Legacy analytics reporting tables (`analytics.py`, `clinical_analytics.py`) were removed in favor of the Safety Agent telemetry schema.


- **interventions.py**: Automated mental health interventions
  - `InterventionCampaign`: Automated intervention campaigns
  - `CampaignExecution`: Individual campaign executions
  - `InterventionAgentSettings`: Automation settings

### System Models

- **agents.py**: AI agent execution tracking
  - `AgentRun`: Agent execution sessions
  - `AgentMessage`: Agent communication logs

- **assessments.py**: Risk evaluation and triage
  - `TriageAssessment`: Mental health risk assessments

- **scheduling.py**: Professional services management
  - `TherapistSchedule`: Therapist availability
  - `FlaggedSession`: Sessions requiring review

## Import Strategy

### Centralized Imports

All models are imported and exported through `models/__init__.py`, providing a single import point:

```python
from app.models import User, Conversation, JournalEntry
```

### Relationship Management

- Uses string references for relationships to avoid circular imports
- Maintains proper foreign key relationships between domains
- Supports complex many-to-many and one-to-many relationships

### Backward Compatibility

- All existing import statements continue to work unchanged
- Model names and table structures remain identical
- Database migrations not required

## Benefits

### Maintainability

- **Single Responsibility**: Each file focuses on one domain
- **Reduced Complexity**: Smaller, focused files are easier to understand
- **Easier Navigation**: Logical organization makes finding models intuitive

### Development Efficiency

- **Parallel Development**: Multiple developers can work on different domains
- **Reduced Merge Conflicts**: Changes isolated to specific domains
- **Clear Ownership**: Domain experts can own specific model files

### Code Quality

- **Better Testing**: Domain-specific model tests
- **Improved Documentation**: Focused documentation per domain
- **Reduced Coupling**: Clear separation of concerns

### Scalability

- **Easy Extension**: New domains can be added as separate files
- **Modular Deployment**: Could support domain-specific deployments
- **Performance**: Smaller import footprint for domain-specific operations

## Usage Examples

### Standard Import

```python
from app.models import User, Conversation, JournalEntry

# Create new user
user = User(email="user@example.com", name="John Doe")

# Create conversation
conversation = Conversation(
    user_id=user.id,
    session_id="session_123",
    message="Hello",
    response="Hi there!"
)
```

### Domain-Specific Import

```python
# For appointment scheduling system
from app.models import Psychologist, Appointment, AppointmentType

# For intervention system
from app.models import InterventionCampaign, CampaignExecution
```

## Migration Notes

### No Database Changes Required

- All table names and structures remain identical
- Foreign key relationships preserved
- Existing data unaffected

### Code Changes Required

- None for basic imports from `app.models`
- Update any direct imports from `app.models` (rare)
- Service layer code remains unchanged

### Testing

- All existing tests should pass without modification
- Consider adding domain-specific model tests
- Verify relationship integrity across domains

## Future Enhancements

### Potential Additions

- **notifications.py**: Push notification models
- **integration.py**: Third-party integration models
- **reporting.py**: Advanced reporting and dashboard models
- **security.py**: Security audit and access control models

### Architecture Evolution

- Consider domain-driven design (DDD) principles
- Potential microservice boundaries align with model domains
- Support for domain-specific validation and business rules

## Conclusion

The modularized models architecture provides a solid foundation for the UGM-AICare platform's continued growth and development. It maintains backward compatibility while improving maintainability, development efficiency, and code quality. The clear domain separation makes the codebase more approachable for new developers and easier to extend with new features.
