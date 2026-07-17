"""AI-powered campaign generation service using Gemini.

MIGRATION NOTE: Migrated from google-generativeai to google-genai SDK (Nov 2025)
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

logger = logging.getLogger(__name__)


class AICampaignGenerator:
    """Generates complete campaign configurations using Gemini AI.
    
    Uses the new google-genai SDK (Client-based approach).
    """

    def __init__(self):
        """Initialize the campaign generator with Gemini client."""
        self.client = None

    async def _get_client(self):
        if self.client is None:
            from app.core.llm import get_gemini_client
            self.client = await get_gemini_client()
        return self.client

    async def generate_campaign_config(
        self,
        campaign_name: str,
        campaign_description: str,
    ) -> Dict[str, Any]:
        """Generate complete campaign configuration from name and description.
        
        Uses Gemini to intelligently create:
        - Target audience selection
        - Personalized message template
        - Appropriate trigger rules
        - Priority level
        - Recommended schedule
        
        Args:
            campaign_name: Campaign name/title
            campaign_description: Campaign purpose and goals
            
        Returns:
            Dictionary with complete campaign configuration
        """
        original_response = ""
        try:
            # Build the prompt
            prompt = f"""You are a mental health campaign specialist for a university counseling system. Generate a complete campaign configuration based on the following information:

**Campaign Name:** {campaign_name}
**Campaign Description:** {campaign_description}

**Your Task:**
Analyze the campaign name and description, then generate a complete campaign configuration in JSON format.

**Available Options:**

**Target Audiences:**
- all_users: All active students
- high_risk: Students with high/critical risk assessments
- inactive_users: Students who haven't logged in recently
- recent_cases: Students with active support cases
- custom: Custom targeting criteria

**Trigger Types:**
- sentiment_threshold: Trigger when sentiment score crosses threshold (operator: >, <, >=, <=, ==; value: 0.0-1.0)
- risk_score: Trigger when risk assessment changes (operator: ==; value: low, medium, high, critical)
- case_count: Trigger based on number of active cases (operator: >, <, >=, <=, ==; value: number; time_period_days: optional)
- inactivity: Trigger after X days of no activity (days_inactive: number)
- sla_breach: Trigger when case response time is exceeded (no additional params)

**Priority Levels:**
- low: Informational campaigns, general wellness
- medium: Regular check-ins, moderate concerns
- high: Urgent outreach, high-risk situations

**Template Variables Available:**
- {{{{user_name}}}} or {{{{name}}}}: Student's name
- {{{{sentiment_score}}}}: Current sentiment score (0.0-1.0)
- {{{{risk_score}}}}: Risk level (LOW/MEDIUM/HIGH/CRITICAL)
- {{{{case_count}}}}: Number of active cases
- {{{{days_inactive}}}}: Days since last activity

**Instructions:**
1. Choose the most appropriate target audience based on the campaign description
2. Create a warm, empathetic message template using available variables
3. Generate 1-3 relevant trigger rules that match the campaign purpose
4. Assign appropriate priority level
5. Suggest a cron schedule if periodic execution is needed (optional)

**Output Format (MUST be valid JSON):**
```json
{{
  "target_audience": "audience_type",
  "message_template": "Personalized message using {{{{variables}}}}",
  "triggers": [
    {{
      "trigger_type": "type",
      "condition_type": "ia_insight or threshold",
      "conditions": {{
        "metric": "metric_name",
        "operator": "operator",
        "value": value,
        "days_inactive": number (for inactivity type)
      }},
      "description": "What this trigger does"
    }}
  ],
  "priority": "priority_level",
  "schedule": "cron_expression or null",
  "ai_rationale": "Brief explanation of your choices"
}}
```

**Important:**
- Message must be supportive, non-judgmental, and encouraging
- Use {{{{variable}}}} syntax (double curly braces) for template variables
- Triggers should be realistic and actionable
- Keep message concise (2-4 sentences)
- Always include a call-to-action

Generate the campaign configuration now:"""
            
            # Use new google-genai SDK with client - Gemini 2.5 Flash for campaign generation
            response = (await self._get_client()).models.generate_content(
                model='gemini-2.5-flash',
                contents=prompt,
            )
            response_text = response.text.strip()
            original_response = response_text
            
            # Extract JSON from response (handle markdown code blocks)
            if "```json" in response_text:
                json_start = response_text.find("```json") + 7
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            elif "```" in response_text:
                json_start = response_text.find("```") + 3
                json_end = response_text.find("```", json_start)
                response_text = response_text[json_start:json_end].strip()
            
            # Parse JSON
            config = json.loads(response_text)
            
            # Validate and sanitize config
            config = AICampaignGenerator._validate_config(config)
            
            logger.info(f"✨ AI-generated campaign config: {campaign_name}")
            logger.debug(f"AI Rationale: {config.get('ai_rationale', 'N/A')}")
            
            return config
            
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Gemini JSON response: {e}")
            logger.error(f"Response text: {original_response if 'original_response' in locals() else 'N/A'}")
            # Return fallback config
            return self._get_fallback_config(
                campaign_name, campaign_description
            )
        except Exception as e:
            logger.error(f"AI campaign generation failed: {e}")
            return self._get_fallback_config(
                campaign_name, campaign_description
            )

    @staticmethod
    def _validate_config(config: Dict[str, Any]) -> Dict[str, Any]:
        """Validate and sanitize AI-generated config.
        
        Args:
            config: Raw config from Gemini
            
        Returns:
            Validated and sanitized config
        """
        # Validate target_audience
        valid_audiences = [
            "all_users", "high_risk", "inactive_users", "recent_cases", "custom"
        ]
        if config.get("target_audience") not in valid_audiences:
            config["target_audience"] = "all_users"
        
        # Validate priority
        valid_priorities = ["low", "medium", "high"]
        if config.get("priority") not in valid_priorities:
            config["priority"] = "medium"
        
        # Convert {{variables}} to {variables} for Python string formatting
        if "message_template" in config:
            message = config["message_template"]
            message = message.replace("{{", "{").replace("}}", "}")
            config["message_template"] = message
        
        # Validate triggers
        if not isinstance(config.get("triggers"), list):
            config["triggers"] = []
        
        # Ensure at least one trigger (or empty array is fine)
        valid_trigger_types = [
            "sentiment_threshold", "risk_score", "case_count", "inactivity", "sla_breach"
        ]
        
        validated_triggers = []
        for trigger in config.get("triggers", []):
            if trigger.get("trigger_type") in valid_trigger_types:
                validated_triggers.append(trigger)
        
        config["triggers"] = validated_triggers
        
        return config

    @staticmethod
    def _get_fallback_config(
        campaign_name: str,
        campaign_description: str,
    ) -> Dict[str, Any]:
        """Generate fallback config if AI generation fails.
        
        Args:
            campaign_name: Campaign name
            campaign_description: Campaign description
            
        Returns:
            Basic fallback configuration
        """
        logger.warning("Using fallback campaign configuration")
        
        # Detect campaign type from keywords
        desc_lower = campaign_description.lower()
        
        if any(word in desc_lower for word in ["inactive", "check-in", "wellness"]):
            target_audience = "inactive_users"
            message = "Hi {user_name}! We haven't heard from you in {days_inactive} days. How are you doing? We're here if you need someone to talk to."
            triggers = [{
                "trigger_type": "inactivity",
                "condition_type": "threshold",
                "conditions": {"days_inactive": 7},
                "description": "Trigger after 7 days of inactivity"
            }]
        elif any(word in desc_lower for word in ["risk", "urgent", "critical", "crisis"]):
            target_audience = "high_risk"
            message = "Hello {user_name}, we noticed your recent sentiment score is {sentiment_score}. We want you to know that support is available 24/7. Would you like to connect with a counselor?"
            triggers = [{
                "trigger_type": "sentiment_threshold",
                "condition_type": "ia_insight",
                "conditions": {"metric": "sentiment_trend", "operator": "<", "value": 0.4},
                "description": "Trigger when sentiment drops below 40%"
            }]
        else:
            target_audience = "all_users"
            message = "Hi {user_name}! This is a friendly reminder that mental health support is always available. We're here to help you thrive!"
            triggers = []
        
        return {
            "target_audience": target_audience,
            "message_template": message,
            "triggers": triggers,
            "priority": "medium",
            "schedule": None,
            "ai_rationale": "Fallback configuration - AI generation unavailable"
        }
